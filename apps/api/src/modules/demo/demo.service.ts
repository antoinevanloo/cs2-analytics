/**
 * Demo Service - Business logic for demo management with Prisma persistence
 *
 * Features:
 * - Stream-based file upload (memory-efficient)
 * - Hash calculation during write
 * - Batch database operations for performance
 * - Re-parsing support with configurable options
 * - Parsing configuration auditability (stored in DB)
 *
 * Architecture:
 * - Extensibility: Uses ParsingConfigService for profile-based defaults
 * - Scalability: Batch inserts for large tick datasets
 * - Resilience: Graceful handling of re-parse scenarios
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../common/prisma";
import {
  DemoStatus,
  GameMode,
  GrenadeType,
  Prisma,
  ReplayEventType,
} from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import type { Readable } from "stream";
import { writeStreamWithHash } from "../../common/streaming";
import type { ParseOptionsDto } from "./dto/demo.dto";
import {
  ParsingConfigService,
  ParseOptions,
  PARSER_VERSION,
} from "../../common/config";
import { PlayerTickService } from "./services/player-tick.service";

// Interfaces for parser data
export interface DemoGrenade {
  type?: string;
  tick?: number;
  X?: number;
  Y?: number;
  Z?: number;
  thrower_steamid?: string;
  thrower_name?: string;
}

export interface DemoChatMessage {
  tick?: number;
  steamid?: string;
  name?: string;
  message?: string;
  is_all_chat?: boolean;
}

export interface DemoMetadata {
  map_name?: string;
  server_name?: string;
  tick_rate?: number;
  duration_seconds?: number;
  total_ticks?: number;
  team1_name?: string;
  team2_name?: string;
  team1_score?: number;
  team2_score?: number;
  game_mode?: string;
  demo_file_hash?: string;
}

export interface DemoPlayer {
  steamid?: string;
  name?: string;
  team_num?: number;
  clan_name?: string;
  kills?: number;
  deaths?: number;
  assists?: number;
  headshot_kills?: number;
  mvps?: number;
  score?: number;
  damage_dealt?: number;
  total_cash_spent?: number;
}

export interface DemoRound {
  round_number?: number;
  start_tick?: number;
  end_tick?: number;
  freeze_end_tick?: number;
  winner_team?: number;
  win_reason?: string;
  ct_score?: number;
  t_score?: number;
  bomb_planted?: boolean;
  bomb_plant_tick?: number;
  bomb_site?: string;
  bomb_defused?: boolean;
  bomb_exploded?: boolean;
}

export interface DemoEvent {
  event_name?: string;
  tick?: number;
  round?: number;
  [key: string]: unknown;
}

/**
 * Tick data from parser - supports both grouped and flat formats
 *
 * Grouped format: { tick, game_time, players: [{steamid, x, y, ...}, ...] }
 * Flat format: { tick, steamid, x, y, ... }
 */
export interface DemoTick {
  tick?: number;
  game_time?: number;
  // Grouped format - array of players for this tick
  players?: Array<{
    steamid?: string | number;
    name?: string;
    X?: number;
    Y?: number;
    Z?: number;
    x?: number;
    y?: number;
    z?: number;
    yaw?: number;
    pitch?: number;
    health?: number;
    armor_value?: number;
    armor?: number;
    is_alive?: boolean;
    ducking?: boolean;
    is_ducking?: boolean;
    is_scoped?: boolean;
    is_defusing?: boolean;
    is_planting?: boolean;
    team_num?: number;
    team?: number;
    active_weapon_name?: string;
    active_weapon?: string;
    has_defuser?: boolean;
    has_defuse_kit?: boolean;
    has_bomb?: boolean;
    balance?: number;
    money?: number;
    flash_duration?: number;
    [key: string]: unknown;
  }>;
  // Flat format fields
  steamid?: string;
  name?: string;
  x?: number;
  y?: number;
  z?: number;
  yaw?: number;
  pitch?: number;
  health?: number;
  armor?: number;
  is_alive?: boolean;
  is_ducking?: boolean;
  is_scoped?: boolean;
  is_defusing?: boolean;
  is_planting?: boolean;
  team?: number;
  active_weapon?: string;
  has_defuse_kit?: boolean;
  has_bomb?: boolean;
  money?: number;
  flash_duration?: number;
  [key: string]: unknown;
}

@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);
  private readonly demoStoragePath: string;

  constructor(
    @InjectQueue("demo-parsing") private parsingQueue: Queue,
    private configService: ConfigService,
    private prisma: PrismaService,
    private parsingConfig: ParsingConfigService,
    private playerTickService: PlayerTickService,
  ) {
    this.demoStoragePath = this.configService.get(
      "DEMO_STORAGE_PATH",
      "/tmp/demos",
    );

    // Ensure storage directory exists
    if (!fs.existsSync(this.demoStoragePath)) {
      fs.mkdirSync(this.demoStoragePath, { recursive: true });
    }
  }

  private calculateFileHash(buffer: Buffer): string {
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }

  async uploadDemo(data: {
    filename: string;
    buffer: Buffer;
    autoparse: boolean;
    userId?: string;
  }) {
    const fileHash = this.calculateFileHash(data.buffer);

    // Check if demo already exists
    const existing = await this.prisma.demo.findUnique({
      where: { fileHash },
    });

    if (existing) {
      return {
        id: existing.id,
        filename: existing.filename,
        fileSize: existing.fileSize,
        status: existing.status,
        message: "Demo already exists",
        existing: true,
      };
    }

    const id = crypto.randomUUID();
    const filePath = path.join(this.demoStoragePath, `${id}.dem`);

    // Save file to disk
    fs.writeFileSync(filePath, data.buffer);
    this.logger.log(`Demo saved: ${filePath} (${data.buffer.length} bytes)`);

    // Create demo record in database
    const demo = await this.prisma.demo.create({
      data: {
        id,
        filename: data.filename,
        fileSize: data.buffer.length,
        fileHash,
        storagePath: filePath,
        storageType: "LOCAL",
        mapName: "unknown",
        tickRate: 64,
        totalTicks: 0,
        durationSeconds: 0,
        status: DemoStatus.PENDING,
        uploadedById: data.userId || null,
      },
    });

    // Auto-parse if requested
    if (data.autoparse) {
      await this.queueForParsing(id, {});
    }

    return {
      id,
      filename: data.filename,
      fileSize: data.buffer.length,
      status: demo.status,
      message: data.autoparse
        ? "Demo uploaded and queued for parsing"
        : "Demo uploaded successfully. Call POST /demos/:id/parse to start parsing.",
    };
  }

  /**
   * Stream-based upload - Memory efficient for large demo files
   * Never loads entire file into memory
   */
  async uploadDemoStream(data: {
    filename: string;
    fileStream: Readable;
    autoparse: boolean;
    userId?: string;
  }) {
    const id = crypto.randomUUID();
    const filePath = path.join(this.demoStoragePath, `${id}.dem`);

    // Write stream to disk while calculating hash
    // This is memory-efficient: only chunks are in memory at any time
    const { fileSize, fileHash } = await writeStreamWithHash(
      data.fileStream,
      filePath,
    );

    this.logger.log(`Demo streamed to disk: ${filePath} (${fileSize} bytes)`);

    // Check if demo already exists (after writing to get hash)
    const existing = await this.prisma.demo.findUnique({
      where: { fileHash },
    });

    if (existing) {
      // Clean up the duplicate file
      await fs.promises.unlink(filePath).catch(() => {
        // Ignore cleanup errors
      });

      return {
        id: existing.id,
        filename: existing.filename,
        fileSize: existing.fileSize,
        status: existing.status,
        message: "Demo already exists",
        existing: true,
      };
    }

    // Create demo record in database
    const demo = await this.prisma.demo.create({
      data: {
        id,
        filename: data.filename,
        fileSize,
        fileHash,
        storagePath: filePath,
        storageType: "LOCAL",
        mapName: "unknown",
        tickRate: 64,
        totalTicks: 0,
        durationSeconds: 0,
        status: DemoStatus.PENDING,
        uploadedById: data.userId || null,
      },
    });

    // Auto-parse if requested
    if (data.autoparse) {
      await this.queueForParsing(id, {});
    }

    return {
      id,
      filename: data.filename,
      fileSize,
      status: demo.status,
      message: data.autoparse
        ? "Demo uploaded and queued for parsing"
        : "Demo uploaded successfully. Call POST /demos/:id/parse to start parsing.",
    };
  }

  /**
   * Queue a demo for parsing with configurable options
   *
   * Uses ParsingConfigService to merge user options with defaults
   * Stores the final options in the database for auditability
   *
   * @param id - Demo ID
   * @param userOptions - User-specified options (partial, merged with defaults)
   */
  async queueForParsing(id: string, userOptions: ParseOptionsDto = {}) {
    const demo = await this.prisma.demo.findUnique({ where: { id } });
    if (!demo) {
      throw new NotFoundException(`Demo ${id} not found`);
    }

    // Merge user options with centralized defaults
    // This ensures extractTicks=true by default for 2D replay support
    const mergedOptions = this.parsingConfig.mergeOptions(userOptions);

    await this.prisma.demo.update({
      where: { id },
      data: {
        status: DemoStatus.PARSING,
        // Store the options used for this parse (auditability)
        parseOptions: mergedOptions as unknown as Prisma.JsonObject,
        parseVersion: PARSER_VERSION,
      },
    });

    // Add to parsing queue with merged options
    const job = await this.parsingQueue.add(
      "parse",
      {
        demoId: id,
        filePath: demo.storagePath,
        options: mergedOptions,
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      },
    );

    this.logger.log(
      `Demo ${id} queued for parsing, job: ${job.id}, options: extractTicks=${mergedOptions.extractTicks}, tickInterval=${mergedOptions.tickInterval}`,
    );

    return {
      id,
      status: "parsing",
      jobId: job.id,
      options: mergedOptions,
      message: "Demo queued for parsing",
    };
  }

  async getParseStatus(id: string) {
    const demo = await this.prisma.demo.findUnique({ where: { id } });
    if (!demo) {
      throw new NotFoundException(`Demo ${id} not found`);
    }

    return {
      id,
      status: demo.status,
      uploadedAt: demo.createdAt,
      parsedAt: demo.parsedAt,
      parserStatus: null,
      error: demo.parseError,
      parseOptions: demo.parseOptions,
      parseVersion: demo.parseVersion,
    };
  }

  /**
   * Re-parse a demo with tick extraction enabled
   *
   * Use case: Demo was parsed without tick data (no 2D replay)
   * This method clears existing tick data and re-queues for parsing
   *
   * Architecture considerations:
   * - Resilience: Validates demo exists and file is accessible
   * - Performance: Deletes old tick data before re-parsing
   * - UX: Returns immediately, processing is async
   * - Extensibility: Accepts custom options or uses 'replay' profile
   *
   * @param id - Demo ID to re-parse
   * @param userId - User requesting the re-parse (for authorization)
   * @param options - Custom parsing options (defaults to 'replay' profile)
   */
  async reparseDemo(
    id: string,
    userId?: string,
    options?: Partial<ParseOptionsDto>,
  ) {
    const demo = await this.prisma.demo.findUnique({ where: { id } });
    if (!demo) {
      throw new NotFoundException(`Demo ${id} not found`);
    }

    // Authorization: only owner can re-parse (if userId provided)
    if (userId && demo.uploadedById && demo.uploadedById !== userId) {
      throw new ForbiddenException("Not authorized to re-parse this demo");
    }

    // Validate demo file still exists
    if (!fs.existsSync(demo.storagePath)) {
      throw new BadRequestException(
        "Demo file no longer exists. Please re-upload the demo.",
      );
    }

    // Check if already parsing
    if (demo.status === DemoStatus.PARSING) {
      throw new BadRequestException("Demo is already being parsed");
    }

    // Use 'replay' profile for re-parsing (optimized for 2D replay)
    // This ensures extractTicks=true with good tick_interval for smooth replay
    const mergedOptions = this.parsingConfig.mergeOptions(options, "replay");

    this.logger.log(
      `Re-parsing demo ${id} with options: extractTicks=${mergedOptions.extractTicks}, tickInterval=${mergedOptions.tickInterval}`,
    );

    // Delete existing tick data (will be replaced)
    // This is safe because we're re-parsing anyway
    const deletedTicks = await this.prisma.playerTick.deleteMany({
      where: { demoId: id },
    });

    if (deletedTicks.count > 0) {
      this.logger.log(`Deleted ${deletedTicks.count} existing ticks for demo ${id}`);
    }

    // Delete existing replay events (will be regenerated)
    await this.prisma.replayEvent.deleteMany({
      where: { demoId: id },
    });

    // Queue for re-parsing
    return this.queueForParsing(id, mergedOptions);
  }

  /**
   * Check if a demo needs re-parsing for 2D replay support
   *
   * @param id - Demo ID
   * @returns Whether the demo needs tick extraction
   */
  async needsReparse(id: string): Promise<{
    needsReparse: boolean;
    reason?: string;
    currentOptions?: ParseOptions | null;
  }> {
    const demo = await this.prisma.demo.findUnique({
      where: { id },
      select: {
        id: true,
        parseOptions: true,
        status: true,
      },
    });

    if (!demo) {
      throw new NotFoundException(`Demo ${id} not found`);
    }

    if (demo.status !== DemoStatus.COMPLETED && demo.status !== DemoStatus.PARSED) {
      return {
        needsReparse: false,
        reason: "Demo is not fully parsed yet",
        currentOptions: demo.parseOptions as ParseOptions | null,
      };
    }

    const currentOptions = demo.parseOptions as ParseOptions | null;

    // Check if tick data exists
    const tickCount = await this.prisma.playerTick.count({
      where: { demoId: id },
      take: 1,
    });

    if (tickCount === 0) {
      return {
        needsReparse: true,
        reason: "No tick data available for 2D replay",
        currentOptions,
      };
    }

    // Check if options indicate tick extraction was disabled
    if (currentOptions && !currentOptions.extractTicks) {
      return {
        needsReparse: true,
        reason: "Tick extraction was disabled during parsing",
        currentOptions,
      };
    }

    return {
      needsReparse: false,
      reason: "Tick data is available",
      currentOptions,
    };
  }

  async getDemo(id: string) {
    const demo = await this.prisma.demo.findUnique({ where: { id } });
    if (!demo) {
      throw new NotFoundException(`Demo ${id} not found`);
    }

    // Fetch rounds and players for completed demos
    let rounds: {
      roundNumber: number;
      winnerTeam: number;
      winReason: string;
      ctScore: number;
      tScore: number;
    }[] = [];
    let players: {
      steamId: string;
      playerName: string;
      teamNum: number;
      kills: number;
      deaths: number;
      assists: number;
      damage: number;
    }[] = [];

    if (
      demo.status === DemoStatus.COMPLETED ||
      demo.status === DemoStatus.PARSED
    ) {
      [rounds, players] = await Promise.all([
        this.prisma.round.findMany({
          where: { demoId: id },
          orderBy: { roundNumber: "asc" },
          select: {
            roundNumber: true,
            winnerTeam: true,
            winReason: true,
            ctScore: true,
            tScore: true,
          },
        }),
        this.prisma.matchPlayerStats.findMany({
          where: { demoId: id },
          select: {
            steamId: true,
            playerName: true,
            teamNum: true,
            kills: true,
            deaths: true,
            assists: true,
            damage: true,
          },
        }),
      ]);
    }

    // Calculate total rounds for ADR
    const totalRounds = rounds.length || 1;

    // Get final score from last round if team scores not set
    const lastRound = rounds[rounds.length - 1];
    const team1Score =
      demo.team1Score || (lastRound ? lastRound.ctScore : 0);
    const team2Score =
      demo.team2Score || (lastRound ? lastRound.tScore : 0);

    return {
      id: demo.id,
      filename: demo.filename,
      fileSize: demo.fileSize,
      status: demo.status.toLowerCase(),
      uploadedAt: demo.createdAt,
      parsedAt: demo.parsedAt,
      // Flat fields expected by frontend
      mapName: demo.mapName,
      team1Name: demo.team1Name || "CT",
      team2Name: demo.team2Name || "T",
      team1Score,
      team2Score,
      durationSeconds: demo.durationSeconds,
      tickRate: demo.tickRate,
      totalTicks: demo.totalTicks,
      playerCount: players.length,
      // Rounds for timeline
      rounds: rounds.map((r) => ({
        roundNumber: r.roundNumber,
        winner: r.winnerTeam === 3 ? "CT" : "T",
        winReason: r.winReason,
        ctScore: r.ctScore,
        tScore: r.tScore,
      })),
      // Players for performance table
      players: players.map((p) => ({
        steamId: p.steamId,
        name: p.playerName,
        team: p.teamNum === 3 ? "CT" : "T",
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        adr: p.damage / totalRounds,
        rating: null, // Will be fetched separately via ratings API
      })),
      // Keep metadata for backwards compatibility
      metadata: {
        map_name: demo.mapName,
        server_name: demo.serverName,
        tick_rate: demo.tickRate,
        duration_seconds: demo.durationSeconds,
        total_ticks: demo.totalTicks,
        team1_name: demo.team1Name || "CT",
        team2_name: demo.team2Name || "T",
        team1_score: team1Score,
        team2_score: team2Score,
        game_mode: demo.gameMode,
      },
    };
  }

  async getDemoEvents(
    id: string,
    filters: { eventType?: string; round?: number },
  ) {
    const demo = await this.prisma.demo.findUnique({ where: { id } });
    if (!demo) {
      throw new NotFoundException(`Demo ${id} not found`);
    }

    if (
      demo.status !== DemoStatus.COMPLETED &&
      demo.status !== DemoStatus.PARSED
    ) {
      return {
        error: "Demo not yet parsed",
        status: demo.status,
      };
    }

    const where: Prisma.GameEventWhereInput = { demoId: id };
    if (filters.eventType) {
      where.eventName = filters.eventType;
    }
    if (typeof filters.round === "number" && !isNaN(filters.round)) {
      where.roundNumber = filters.round;
    }

    const events = await this.prisma.gameEvent.findMany({
      where,
      orderBy: { tick: "asc" },
    });

    return {
      demoId: id,
      filters,
      events: events.map((e) => ({
        event_name: e.eventName,
        tick: e.tick,
        round: e.roundNumber,
        ...(e.data as object),
      })),
      total: events.length,
    };
  }

  async getDemoRounds(id: string) {
    const demo = await this.prisma.demo.findUnique({ where: { id } });
    if (!demo) {
      throw new NotFoundException(`Demo ${id} not found`);
    }

    if (
      demo.status !== DemoStatus.COMPLETED &&
      demo.status !== DemoStatus.PARSED
    ) {
      return {
        error: "Demo not yet parsed",
        status: demo.status,
      };
    }

    const rounds = await this.prisma.round.findMany({
      where: { demoId: id },
      orderBy: { roundNumber: "asc" },
    });

    return {
      demoId: id,
      rounds: rounds.map((r) => ({
        round_number: r.roundNumber,
        start_tick: r.startTick,
        end_tick: r.endTick,
        freeze_end_tick: r.freezeEndTick,
        winner_team: r.winnerTeam,
        win_reason: r.winReason,
        ct_score: r.ctScore,
        t_score: r.tScore,
        bomb_planted: r.bombPlanted,
        bomb_plant_tick: r.bombPlantTick,
        bomb_site: r.bombSite,
        bomb_defused: r.bombDefused,
        bomb_exploded: r.bombExploded,
      })),
      total: rounds.length,
    };
  }

  async getDemoPlayers(id: string) {
    const demo = await this.prisma.demo.findUnique({ where: { id } });
    if (!demo) {
      throw new NotFoundException(`Demo ${id} not found`);
    }

    if (
      demo.status !== DemoStatus.COMPLETED &&
      demo.status !== DemoStatus.PARSED
    ) {
      return {
        error: "Demo not yet parsed",
        status: demo.status,
      };
    }

    const players = await this.prisma.matchPlayerStats.findMany({
      where: { demoId: id },
    });

    return {
      demoId: id,
      players: players.map((p) => ({
        steamid: p.steamId,
        name: p.playerName,
        team_num: p.teamNum,
        team_name: p.teamName,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        headshot_kills: p.headshotKills,
        mvps: p.mvps,
        score: p.score,
        damage_dealt: p.damage,
        total_cash_spent: p.totalCashSpent,
      })),
      total: players.length,
    };
  }

  async getDemoTicks(
    id: string,
    options: { startTick?: number; endTick?: number; interval?: number },
  ) {
    const demo = await this.prisma.demo.findUnique({ where: { id } });
    if (!demo) {
      throw new NotFoundException(`Demo ${id} not found`);
    }

    if (
      demo.status !== DemoStatus.COMPLETED &&
      demo.status !== DemoStatus.PARSED
    ) {
      return {
        error: "Demo not yet parsed",
        status: demo.status,
      };
    }

    return {
      demoId: id,
      options,
      ticks: [],
      total: 0,
      message: "Tick data available via parser output files",
    };
  }

  async getDemoGrenades(id: string) {
    const demo = await this.prisma.demo.findUnique({ where: { id } });
    if (!demo) {
      throw new NotFoundException(`Demo ${id} not found`);
    }

    if (
      demo.status !== DemoStatus.COMPLETED &&
      demo.status !== DemoStatus.PARSED
    ) {
      return {
        error: "Demo not yet parsed",
        status: demo.status,
      };
    }

    const grenades = await this.prisma.grenade.findMany({
      where: { demoId: id },
      orderBy: { tick: "asc" },
    });

    return {
      demoId: id,
      grenades: grenades.map((g) => ({
        type: g.type,
        tick: g.tick,
        X: g.x,
        Y: g.y,
        Z: g.z,
        thrower_steamid: g.throwerSteamId,
        thrower_name: g.throwerName,
      })),
      total: grenades.length,
    };
  }

  async getDemoChatMessages(id: string) {
    const demo = await this.prisma.demo.findUnique({ where: { id } });
    if (!demo) {
      throw new NotFoundException(`Demo ${id} not found`);
    }

    if (
      demo.status !== DemoStatus.COMPLETED &&
      demo.status !== DemoStatus.PARSED
    ) {
      return {
        error: "Demo not yet parsed",
        status: demo.status,
      };
    }

    const messages = await this.prisma.chatMessage.findMany({
      where: { demoId: id },
      orderBy: { tick: "asc" },
    });

    return {
      demoId: id,
      chat_messages: messages.map((m) => ({
        tick: m.tick,
        steamid: m.steamId,
        name: m.playerName,
        message: m.message,
        is_all_chat: m.isAllChat,
      })),
      total: messages.length,
    };
  }

  async listDemos(options: {
    page: number;
    limit: number;
    map?: string;
    accessFilter?: Prisma.DemoWhereInput;
  }) {
    const where: Prisma.DemoWhereInput = {};
    if (options.map) {
      where.mapName = options.map;
    }

    // Apply access filter if provided
    if (options.accessFilter) {
      Object.assign(where, options.accessFilter);
    }

    const page = Number(options.page) || 1;
    const limit = Number(options.limit) || 20;

    const [demos, total] = await Promise.all([
      this.prisma.demo.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.demo.count({ where }),
    ]);

    return {
      demos: demos.map((d) => ({
        id: d.id,
        filename: d.filename,
        fileSize: d.fileSize,
        status: d.status,
        uploadedAt: d.createdAt,
        parsedAt: d.parsedAt,
        mapName: d.mapName,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private mapGrenadeType(type: string): GrenadeType {
    const typeMap: Record<string, GrenadeType> = {
      smokegrenade: "SMOKE",
      smoke: "SMOKE",
      flashbang: "FLASHBANG",
      flash: "FLASHBANG",
      hegrenade: "HEGRENADE",
      he: "HEGRENADE",
      molotov: "MOLOTOV",
      incendiary: "INCENDIARY",
      decoy: "DECOY",
    };
    return typeMap[type.toLowerCase()] || "SMOKE";
  }

  private mapGameMode(mode: string): GameMode {
    const modeMap: Record<string, GameMode> = {
      competitive: "COMPETITIVE",
      premier: "PREMIER",
      wingman: "WINGMAN",
      casual: "CASUAL",
      deathmatch: "DEATHMATCH",
      custom: "CUSTOM",
    };
    return modeMap[mode.toLowerCase()] || "UNKNOWN";
  }

  // Called by processor when parsing completes
  async markAsCompleted(
    id: string,
    data: {
      metadata?: DemoMetadata;
      players?: DemoPlayer[];
      rounds?: DemoRound[];
      events?: DemoEvent[];
      grenades?: DemoGrenade[];
      chat_messages?: DemoChatMessage[];
      ticks?: DemoTick[];
    },
  ) {
    const demo = await this.prisma.demo.findUnique({ where: { id } });
    if (!demo) {
      this.logger.error(`Demo ${id} not found in database!`);
      return;
    }

    try {
      // Update demo metadata
      await this.prisma.demo.update({
        where: { id },
        data: {
          status: DemoStatus.COMPLETED,
          parsedAt: new Date(),
          mapName: data.metadata?.map_name || "unknown",
          serverName: data.metadata?.server_name ?? null,
          tickRate: data.metadata?.tick_rate || 64,
          totalTicks: data.metadata?.total_ticks || 0,
          durationSeconds: data.metadata?.duration_seconds || 0,
          team1Name: data.metadata?.team1_name || "Team 1",
          team2Name: data.metadata?.team2_name || "Team 2",
          team1Score: data.metadata?.team1_score || 0,
          team2Score: data.metadata?.team2_score || 0,
          gameMode: this.mapGameMode(data.metadata?.game_mode || "competitive"),
        },
      });

      // Insert players
      if (data.players?.length) {
        await this.prisma.matchPlayerStats.createMany({
          data: data.players.map((p) => ({
            demoId: id,
            steamId: p.steamid || "",
            playerName: p.name || "Unknown",
            teamNum: p.team_num || 0,
            teamName: p.clan_name ?? null,
            kills: p.kills || 0,
            deaths: p.deaths || 0,
            assists: p.assists || 0,
            headshotKills: p.headshot_kills || 0,
            damage: p.damage_dealt || 0,
            mvps: p.mvps || 0,
            score: p.score || 0,
            totalCashSpent: p.total_cash_spent || 0,
          })),
          skipDuplicates: true,
        });
      }

      // Insert rounds
      if (data.rounds?.length) {
        await this.prisma.round.createMany({
          data: data.rounds.map((r) => ({
            demoId: id,
            roundNumber: r.round_number || 0,
            startTick: r.start_tick || 0,
            endTick: r.end_tick || 0,
            freezeEndTick: r.freeze_end_tick ?? null,
            winnerTeam: r.winner_team || 0,
            winReason: r.win_reason || "",
            winReasonCode: 0,
            ctScore: r.ct_score || 0,
            tScore: r.t_score || 0,
            bombPlanted: r.bomb_planted || false,
            bombPlantTick: r.bomb_plant_tick ?? null,
            bombSite: r.bomb_site ?? null,
            bombDefused: r.bomb_defused || false,
            bombExploded: r.bomb_exploded || false,
          })),
          skipDuplicates: true,
        });
      }

      // Insert events (in batches for performance)
      if (data.events?.length) {
        const batchSize = 1000;
        for (let i = 0; i < data.events.length; i += batchSize) {
          const batch = data.events.slice(i, i + batchSize);
          await this.prisma.gameEvent.createMany({
            data: batch.map((e) => {
              const { event_name, tick, round, ...rest } = e;
              return {
                demoId: id,
                eventName: event_name || "unknown",
                tick: tick || 0,
                roundNumber: round ?? null,
                data: rest as Prisma.JsonObject,
              };
            }),
          });
        }
      }

      // Get rounds for tick-to-round mapping (used by kills and grenades)
      const rounds = await this.prisma.round.findMany({
        where: { demoId: id },
        select: {
          id: true,
          roundNumber: true,
          startTick: true,
          endTick: true,
        },
        orderBy: { roundNumber: "asc" },
      });

      const findRoundForTick = (tick: number) => {
        return rounds.find((r) => tick >= r.startTick && tick <= r.endTick);
      };

      // Insert kills from player_death events
      if (data.events?.length) {
        const killEvents = data.events.filter(
          (e) => e.event_name === "player_death",
        );

        if (killEvents.length > 0) {
          // Track first kills per round for isFirstKill computation
          const firstKillByRound = new Map<string, number>();

          // Type for player_death event data
          interface PlayerDeathData {
            attacker_steamid?: string;
            attacker_name?: string;
            attacker_team?: number;
            // Attacker position (from demoparser2 other=["X","Y","Z"])
            attacker_X?: number;
            attacker_Y?: number;
            attacker_Z?: number;
            attackerX?: number;  // Alternative format
            attackerY?: number;
            attackerZ?: number;
            user_steamid?: string;
            user_name?: string;
            user_team?: number;
            // Victim position (from demoparser2 player=["X","Y","Z"])
            user_X?: number;
            user_Y?: number;
            user_Z?: number;
            victimX?: number;  // Alternative format
            victimY?: number;
            victimZ?: number;
            assister_steamid?: string;
            assister_name?: string;
            weapon?: string;
            headshot?: boolean;
            penetrated?: number;
            noscope?: boolean;
            thrusmoke?: boolean;
            attackerblind?: boolean;
            assistedflash?: boolean;
            distance?: number;
          }

          // Prepare kill data with all fields
          const killsData = killEvents
            .map((e) => {
              const round = findRoundForTick(e.tick || 0);
              if (!round) return null;

              // Cast event to typed structure - parser puts fields directly on event, not in nested data
              const d = e as unknown as PlayerDeathData;

              // Determine if this is first kill of the round
              const existingFirstKill = firstKillByRound.get(round.id);
              const isFirstKill = existingFirstKill === undefined;
              if (isFirstKill) {
                firstKillByRound.set(round.id, e.tick || 0);
              }

              // Extract attacker/victim from event data
              const attackerSteamId = d.attacker_steamid || null;
              const victimSteamId = d.user_steamid || "";
              const attackerTeam = d.attacker_team;
              const victimTeam = d.user_team ?? 0;

              // Compute derived fields
              const isSuicide =
                !attackerSteamId || attackerSteamId === victimSteamId;
              const isTeamkill =
                !isSuicide &&
                attackerTeam !== undefined &&
                attackerTeam === victimTeam;

              // Extract positions from demoparser2 format
              // attacker_X/Y/Z for attacker, user_X/Y/Z for victim
              const attackerX = d.attacker_X ?? d.attackerX ?? null;
              const attackerY = d.attacker_Y ?? d.attackerY ?? null;
              const attackerZ = d.attacker_Z ?? d.attackerZ ?? null;
              const victimX = d.user_X ?? d.victimX ?? 0;
              const victimY = d.user_Y ?? d.victimY ?? 0;
              const victimZ = d.user_Z ?? d.victimZ ?? 0;

              return {
                demoId: id,
                roundId: round.id,
                tick: e.tick || 0,
                // Attacker
                attackerSteamId,
                attackerName: d.attacker_name || null,
                attackerTeam: attackerTeam ?? null,
                attackerX: typeof attackerX === "number" ? attackerX : null,
                attackerY: typeof attackerY === "number" ? attackerY : null,
                attackerZ: typeof attackerZ === "number" ? attackerZ : null,
                // Victim
                victimSteamId,
                victimName: d.user_name || "",
                victimTeam,
                victimX: typeof victimX === "number" ? victimX : 0,
                victimY: typeof victimY === "number" ? victimY : 0,
                victimZ: typeof victimZ === "number" ? victimZ : 0,
                // Assister
                assisterSteamId: d.assister_steamid || null,
                assisterName: d.assister_name || null,
                // Kill details
                weapon: d.weapon || "unknown",
                headshot: d.headshot ?? false,
                penetrated: d.penetrated ?? 0,
                noscope: d.noscope ?? false,
                thrusmoke: d.thrusmoke ?? false,
                attackerblind: d.attackerblind ?? false,
                assistedflash: d.assistedflash ?? false,
                // Computed
                distance: d.distance ?? null,
                isSuicide,
                isTeamkill,
                isFirstKill,
                isTradeKill: false, // Will be computed in analysis phase
                tradedWithin: null as number | null,
              };
            })
            .filter((k): k is NonNullable<typeof k> => k !== null);

          // Batch insert kills for performance
          const killBatchSize = 500;
          for (let i = 0; i < killsData.length; i += killBatchSize) {
            const batch = killsData.slice(i, i + killBatchSize);
            await this.prisma.kill.createMany({ data: batch });
          }

          this.logger.log(
            `Inserted ${killsData.length} kills for demo ${id}`,
          );
        }
      }

      // =========================================================================
      // COMPUTE AND INSERT ROUND PLAYER STATS
      // =========================================================================
      // This is critical for analytics - stats per player per round
      // Computed from events (player_death, player_hurt) and round data
      await this.computeAndInsertRoundPlayerStats(id, data.events || [], rounds);

      // Insert grenades
      if (data.grenades?.length) {
        for (const g of data.grenades) {
          const round = findRoundForTick(g.tick || 0);
          const roundId = round?.id;
          if (roundId) {
            await this.prisma.grenade.create({
              data: {
                demoId: id,
                roundId,
                type: this.mapGrenadeType(g.type || "smoke"),
                tick: g.tick || 0,
                x: g.X || 0,
                y: g.Y || 0,
                z: g.Z || 0,
                throwerSteamId: g.thrower_steamid || "",
                throwerName: g.thrower_name || "",
                throwerTeam: 0,
              },
            });
          }
        }
      }

      // Insert chat messages
      if (data.chat_messages?.length) {
        await this.prisma.chatMessage.createMany({
          data: data.chat_messages.map((m) => ({
            demoId: id,
            tick: m.tick || 0,
            steamId: m.steamid || "",
            playerName: m.name || "",
            message: m.message || "",
            isAllChat: m.is_all_chat ?? true,
          })),
        });
      }

      // Insert player ticks for 2D replay using dedicated service
      if (data.ticks?.length) {
        const tickResult = await this.playerTickService.processAndStoreTicks(
          id,
          data.ticks,
        );

        if (!tickResult.success) {
          this.logger.warn(
            `Failed to process ticks for demo ${id}: ${tickResult.error}`,
          );
        } else {
          this.logger.log(
            `Processed ${tickResult.totalInputTicks} tick frames -> ${tickResult.totalInserted} player ticks ` +
            `(${tickResult.invalidSkipped} invalid) in ${tickResult.processingTimeMs}ms`,
          );
        }
      }

      // Create ReplayEvents from game events for 2D visualization overlays
      if (data.events?.length) {
        // Get rounds for event-to-round mapping (reuse if already fetched)
        const roundsForEvents = await this.prisma.round.findMany({
          where: { demoId: id },
          select: {
            id: true,
            startTick: true,
            endTick: true,
            roundNumber: true,
          },
          orderBy: { roundNumber: "asc" },
        });

        const findRoundForEvent = (tick: number) => {
          return roundsForEvents.find(
            (r) => tick >= r.startTick && tick <= r.endTick,
          );
        };

        // Event type mapping
        const eventTypeMap: Record<string, ReplayEventType | null> = {
          player_death: ReplayEventType.KILL,
          bomb_planted: ReplayEventType.BOMB_PLANT,
          bomb_defused: ReplayEventType.BOMB_DEFUSE,
          bomb_exploded: ReplayEventType.BOMB_EXPLODE,
          // player_hurt creates too many events, skip for now
        };

        const replayEvents: Prisma.ReplayEventCreateManyInput[] = [];

        for (const event of data.events) {
          const eventType = eventTypeMap[event.event_name || ""];
          if (!eventType) continue;

          const round = findRoundForEvent(event.tick || 0);
          if (!round) continue;

          // Build replay event data based on event type
          const baseEvent = {
            demoId: id,
            roundId: round.id,
            type: eventType,
            tick: event.tick || 0,
          };

          if (eventType === ReplayEventType.KILL) {
            // Kill event - attacker position for visual overlay
            replayEvents.push({
              ...baseEvent,
              x: (event.attacker_x as number) || 0,
              y: (event.attacker_y as number) || 0,
              z: (event.attacker_z as number) || 0,
              endX: (event.victim_x as number) || null,
              endY: (event.victim_y as number) || null,
              endZ: (event.victim_z as number) || null,
              data: {
                attackerSteamId: String(event.attacker_steamid || ""),
                attackerName: String(event.attacker_name || ""),
                victimSteamId: String(event.victim_steamid || ""),
                victimName: String(event.victim_name || ""),
                weapon: String(event.weapon || ""),
                headshot: Boolean(event.headshot),
                penetrated: Boolean(event.penetrated),
                noscope: Boolean(event.noscope),
                throughsmoke: Boolean(event.throughsmoke),
                attackerblind: Boolean(event.attackerblind),
              },
            });
          } else if (
            eventType === ReplayEventType.BOMB_PLANT ||
            eventType === ReplayEventType.BOMB_DEFUSE ||
            eventType === ReplayEventType.BOMB_EXPLODE
          ) {
            // Bomb events - player position comes from user_X/user_Y/user_Z (demoparser2 format)
            // or x/y/z for backward compatibility
            const playerX = (event.user_X as number) ?? (event.x as number) ?? 0;
            const playerY = (event.user_Y as number) ?? (event.y as number) ?? 0;
            const playerZ = (event.user_Z as number) ?? (event.z as number) ?? 0;

            replayEvents.push({
              ...baseEvent,
              x: playerX,
              y: playerY,
              z: playerZ,
              data: {
                playerSteamId: String(
                  event.player_steamid || event.userid_steamid || event.user_steamid || "",
                ),
                playerName: String(
                  event.player_name || event.userid_name || event.user_name || "",
                ),
                site: String(event.site || ""),
              },
            });
          }
        }

        // Batch insert replay events
        if (replayEvents.length > 0) {
          const replayEventBatchSize = 500;
          for (let i = 0; i < replayEvents.length; i += replayEventBatchSize) {
            const batch = replayEvents.slice(i, i + replayEventBatchSize);
            await this.prisma.replayEvent.createMany({
              data: batch,
            });
          }

          this.logger.log(
            `Created ${replayEvents.length} replay events for demo ${id}`,
          );
        }
      }

      this.logger.log(
        `Demo ${id} marked as completed with ${data.events?.length || 0} events, ${data.rounds?.length || 0} rounds, ${data.players?.length || 0} players, ${data.grenades?.length || 0} grenades, ${data.chat_messages?.length || 0} chat messages, ${data.ticks?.length || 0} ticks`,
      );
    } catch (error) {
      this.logger.error(`Failed to save demo ${id} data: ${error}`);
      throw error;
    }
  }

  // Called by processor when parsing fails
  async markAsFailed(id: string, error: string) {
    await this.prisma.demo.update({
      where: { id },
      data: {
        status: DemoStatus.FAILED,
        parseError: error,
      },
    });
    this.logger.error(`Demo ${id} marked as failed: ${error}`);
  }

  // ===========================================================================
  // ROUND PLAYER STATS COMPUTATION
  // ===========================================================================

  /**
   * Compute and insert RoundPlayerStats from game events
   *
   * This is critical for analytics accuracy. Stats per player per round enable:
   * - HLTV Rating 2.0 calculation (requires per-round KDA)
   * - KAST % (Kill/Assist/Survived/Traded per round)
   * - ADR (Average Damage per Round)
   * - Economy analysis (spending per round)
   * - Clutch detection
   *
   * Data sources:
   * - player_death events → kills, deaths, assists, first kill/death
   * - player_hurt events → damage dealt
   * - round_freeze_end events → economy (equipValue, moneySpent)
   *
   * Design for extensibility:
   * - Aggregates all stats in memory first (Map-based for O(1) lookups)
   * - Single batch insert at the end (performance)
   * - Graceful degradation if events are missing
   */
  private async computeAndInsertRoundPlayerStats(
    demoId: string,
    events: DemoEvent[],
    rounds: Array<{
      id: string;
      roundNumber: number;
      startTick: number;
      endTick: number;
    }>,
  ): Promise<void> {
    if (rounds.length === 0) {
      this.logger.warn(
        `No rounds found for demo ${demoId}, skipping RoundPlayerStats`,
      );
      return;
    }

    const startTime = Date.now();

    // Get players for this demo (we need steamId and teamNum)
    const players = await this.prisma.matchPlayerStats.findMany({
      where: { demoId },
      select: { steamId: true, teamNum: true, playerName: true },
    });

    if (players.length === 0) {
      this.logger.warn(
        `No players found for demo ${demoId}, skipping RoundPlayerStats`,
      );
      return;
    }

    // Build player lookup: steamId -> { teamNum, name }
    const playerLookup = new Map(
      players.map((p) => [p.steamId, { teamNum: p.teamNum, name: p.playerName }]),
    );

    // Build round lookup: tick -> round
    const findRoundForTick = (tick: number) => {
      return rounds.find((r) => tick >= r.startTick && tick <= r.endTick);
    };

    // Initialize stats accumulator: Map<roundId, Map<steamId, stats>>
    type PlayerRoundStats = {
      steamId: string;
      teamNum: number;
      kills: number;
      deaths: number;
      assists: number;
      damage: number;
      equipValue: number;
      moneySpent: number;
      startBalance: number;
      survived: boolean;
      firstKill: boolean;
      firstDeath: boolean;
      clutchVs: number | null;
      clutchWon: boolean | null;
    };

    const statsMap = new Map<string, Map<string, PlayerRoundStats>>();

    // Initialize all player slots for all rounds
    for (const round of rounds) {
      const roundStats = new Map<string, PlayerRoundStats>();
      for (const [steamId, playerInfo] of playerLookup) {
        roundStats.set(steamId, {
          steamId,
          teamNum: playerInfo.teamNum,
          kills: 0,
          deaths: 0,
          assists: 0,
          damage: 0,
          equipValue: 0,
          moneySpent: 0,
          startBalance: 0,
          survived: true, // Assume survived until death event
          firstKill: false,
          firstDeath: false,
          clutchVs: null,
          clutchWon: null,
        });
      }
      statsMap.set(round.id, roundStats);
    }

    // Track first kill/death per round
    const firstKillByRound = new Map<string, boolean>();
    const firstDeathByRound = new Map<string, boolean>();

    // Process events in tick order for accurate first kill/death detection
    const sortedEvents = [...events].sort(
      (a, b) => (a.tick || 0) - (b.tick || 0),
    );

    for (const event of sortedEvents) {
      const round = findRoundForTick(event.tick || 0);
      if (!round) continue;

      const roundStats = statsMap.get(round.id);
      if (!roundStats) continue;

      switch (event.event_name) {
        case "player_death": {
          const attackerSteamId = event.attacker_steamid as string | undefined;
          const victimSteamId = event.user_steamid as string | undefined;
          const assisterSteamId = event.assister_steamid as string | undefined;
          const attackerTeam = event.attacker_team as number | undefined;
          const victimTeam = event.user_team as number | undefined;

          // Increment attacker kills (if not suicide/teamkill)
          if (attackerSteamId && victimSteamId) {
            const isSuicide = attackerSteamId === victimSteamId;
            const isTeamkill =
              !isSuicide &&
              attackerTeam !== undefined &&
              victimTeam !== undefined &&
              attackerTeam === victimTeam;

            if (!isSuicide && !isTeamkill) {
              const attackerStats = roundStats.get(attackerSteamId);
              if (attackerStats) {
                attackerStats.kills++;

                // Check first kill
                if (!firstKillByRound.has(round.id)) {
                  firstKillByRound.set(round.id, true);
                  attackerStats.firstKill = true;
                }
              }
            }
          }

          // Increment victim deaths
          if (victimSteamId) {
            const victimStats = roundStats.get(victimSteamId);
            if (victimStats) {
              victimStats.deaths++;
              victimStats.survived = false;

              // Check first death
              if (!firstDeathByRound.has(round.id)) {
                firstDeathByRound.set(round.id, true);
                victimStats.firstDeath = true;
              }
            }
          }

          // Increment assister assists
          if (assisterSteamId) {
            const assisterStats = roundStats.get(assisterSteamId);
            if (assisterStats) {
              assisterStats.assists++;
            }
          }
          break;
        }

        case "player_hurt": {
          const attackerSteamId = event.attacker_steamid as string | undefined;
          const damage = (event.dmg_health as number) || 0;

          // Add damage (only from actual attackers, not world damage)
          if (attackerSteamId && damage > 0) {
            const attackerStats = roundStats.get(attackerSteamId);
            if (attackerStats) {
              attackerStats.damage += damage;
            }
          }
          break;
        }

        case "round_freeze_end": {
          // Economy data at freeze end (round start)
          // This event contains player equipment values
          // Note: demoparser2 may not expose per-player economy in events
          // We'll extract from tick data if available in future enhancement
          break;
        }
      }
    }

    // Detect clutches: player alone vs N enemies
    // A clutch is when a player is the last alive on their team facing multiple enemies
    for (const round of rounds) {
      const roundStats = statsMap.get(round.id);
      if (!roundStats) continue;

      // Group players by team and count survivors
      const team2Survivors: string[] = [];
      const team3Survivors: string[] = [];

      for (const [steamId, stats] of roundStats) {
        if (stats.survived) {
          if (stats.teamNum === 2) {
            team2Survivors.push(steamId);
          } else if (stats.teamNum === 3) {
            team3Survivors.push(steamId);
          }
        }
      }

      // Check for clutch situations (1vN where N >= 1)
      // We detect this from kill patterns: if a player got kills when alone
      // For now, we mark based on round end survivors
      // More accurate detection would require tracking alive counts during round

      // Simple heuristic: if one team has 1 survivor and they got kills this round
      // while the other team had more players at some point
      const team2SurvivorId = team2Survivors[0];
      if (team2Survivors.length === 1 && team2SurvivorId) {
        const clutchPlayer = roundStats.get(team2SurvivorId);
        if (clutchPlayer && clutchPlayer.kills > 0) {
          // Count how many enemies died this round
          let enemyDeaths = 0;
          for (const [, stats] of roundStats) {
            if (stats.teamNum === 3 && stats.deaths > 0) {
              enemyDeaths++;
            }
          }
          if (enemyDeaths >= 1) {
            clutchPlayer.clutchVs = enemyDeaths;
            clutchPlayer.clutchWon = team3Survivors.length === 0;
          }
        }
      }

      const team3SurvivorId = team3Survivors[0];
      if (team3Survivors.length === 1 && team3SurvivorId) {
        const clutchPlayer = roundStats.get(team3SurvivorId);
        if (clutchPlayer && clutchPlayer.kills > 0) {
          let enemyDeaths = 0;
          for (const [, stats] of roundStats) {
            if (stats.teamNum === 2 && stats.deaths > 0) {
              enemyDeaths++;
            }
          }
          if (enemyDeaths >= 1) {
            clutchPlayer.clutchVs = enemyDeaths;
            clutchPlayer.clutchWon = team2Survivors.length === 0;
          }
        }
      }
    }

    // Convert to array for batch insert
    const roundPlayerStatsData: Prisma.RoundPlayerStatsCreateManyInput[] = [];

    for (const [roundId, playerStats] of statsMap) {
      for (const [, stats] of playerStats) {
        roundPlayerStatsData.push({
          roundId,
          steamId: stats.steamId,
          teamNum: stats.teamNum,
          kills: stats.kills,
          deaths: stats.deaths,
          assists: stats.assists,
          damage: stats.damage,
          equipValue: stats.equipValue,
          moneySpent: stats.moneySpent,
          startBalance: stats.startBalance,
          survived: stats.survived,
          firstKill: stats.firstKill,
          firstDeath: stats.firstDeath,
          clutchVs: stats.clutchVs,
          clutchWon: stats.clutchWon,
        });
      }
    }

    // Batch insert for performance
    if (roundPlayerStatsData.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < roundPlayerStatsData.length; i += batchSize) {
        const batch = roundPlayerStatsData.slice(i, i + batchSize);
        await this.prisma.roundPlayerStats.createMany({
          data: batch,
          skipDuplicates: true,
        });
      }
    }

    const duration = Date.now() - startTime;
    this.logger.log(
      `Computed and inserted ${roundPlayerStatsData.length} RoundPlayerStats for demo ${demoId} in ${duration}ms`,
    );
  }

  /**
   * Recompute RoundPlayerStats for an existing demo
   *
   * Use this to fix demos that were parsed before RoundPlayerStats computation
   * was implemented. Idempotent: deletes existing stats before recomputing.
   */
  async recomputeRoundPlayerStats(demoId: string): Promise<{
    success: boolean;
    recordsCreated: number;
    durationMs: number;
  }> {
    const startTime = Date.now();

    // Verify demo exists and is completed
    const demo = await this.prisma.demo.findUnique({
      where: { id: demoId },
      select: { id: true, status: true },
    });

    if (!demo) {
      throw new NotFoundException(`Demo ${demoId} not found`);
    }

    if (demo.status !== DemoStatus.COMPLETED) {
      throw new Error(
        `Demo ${demoId} is not completed (status: ${demo.status})`,
      );
    }

    // Get rounds
    const rounds = await this.prisma.round.findMany({
      where: { demoId },
      select: { id: true, roundNumber: true, startTick: true, endTick: true },
      orderBy: { roundNumber: "asc" },
    });

    // Get events from GameEvent table
    const gameEvents = await this.prisma.gameEvent.findMany({
      where: {
        demoId,
        eventName: { in: ["player_death", "player_hurt", "round_freeze_end"] },
      },
      select: { eventName: true, tick: true, data: true },
    });

    // Transform to DemoEvent format
    const events: DemoEvent[] = gameEvents.map((e) => ({
      event_name: e.eventName,
      tick: e.tick,
      ...(e.data as Record<string, unknown>),
    }));

    // Delete existing RoundPlayerStats for this demo
    const deleteResult = await this.prisma.roundPlayerStats.deleteMany({
      where: {
        round: { demoId },
      },
    });

    if (deleteResult.count > 0) {
      this.logger.log(
        `Deleted ${deleteResult.count} existing RoundPlayerStats for demo ${demoId}`,
      );
    }

    // Recompute
    await this.computeAndInsertRoundPlayerStats(demoId, events, rounds);

    // Count new records
    const newCount = await this.prisma.roundPlayerStats.count({
      where: { round: { demoId } },
    });

    const duration = Date.now() - startTime;

    // Also delete cached analysis so it gets recomputed with fresh data
    await this.prisma.analysis.deleteMany({
      where: { demoId },
    });

    this.logger.log(
      `Recomputed RoundPlayerStats for demo ${demoId}: ${newCount} records in ${duration}ms`,
    );

    return {
      success: true,
      recordsCreated: newCount,
      durationMs: duration,
    };
  }

  // Retry parsing a failed or pending demo
  async retryParsing(id: string) {
    const demo = await this.prisma.demo.findUnique({ where: { id } });
    if (!demo) {
      throw new NotFoundException(`Demo ${id} not found`);
    }

    // Only allow retry for FAILED or PENDING demos
    if (
      demo.status !== DemoStatus.FAILED &&
      demo.status !== DemoStatus.PENDING
    ) {
      return {
        id: demo.id,
        status: demo.status,
        message: `Cannot retry demo in ${demo.status} status`,
      };
    }

    // Reset status and clear error
    await this.prisma.demo.update({
      where: { id },
      data: {
        status: DemoStatus.PARSING,
        parseError: null,
      },
    });

    // Add to parsing queue
    const job = await this.parsingQueue.add(
      "parse",
      {
        demoId: id,
        filePath: demo.storagePath,
        options: {},
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      },
    );

    this.logger.log(`Demo ${id} queued for retry parsing, job: ${job.id}`);

    return {
      id: demo.id,
      status: DemoStatus.PARSING,
      jobId: job.id,
      message: "Demo queued for retry",
    };
  }

  /**
   * Delete a demo and all associated data
   * Only the user who uploaded the demo can delete it
   */
  async deleteDemo(id: string, userId: string) {
    const demo = await this.prisma.demo.findUnique({
      where: { id },
      select: {
        id: true,
        uploadedById: true,
        storagePath: true,
        filename: true,
        status: true,
      },
    });

    if (!demo) {
      throw new NotFoundException(`Demo ${id} not found`);
    }

    // Ownership check: only the uploader can delete
    if (demo.uploadedById && demo.uploadedById !== userId) {
      throw new ForbiddenException("You can only delete demos you uploaded");
    }

    // If demo is currently being parsed, warn but allow deletion
    if (demo.status === DemoStatus.PARSING) {
      this.logger.warn(
        `Deleting demo ${id} while parsing is in progress - job may fail`,
      );
    }

    try {
      // Delete the file from disk first
      if (demo.storagePath && fs.existsSync(demo.storagePath)) {
        await fs.promises.unlink(demo.storagePath);
        this.logger.log(`Deleted demo file: ${demo.storagePath}`);
      }

      // Delete the demo record - Prisma cascade will handle related records:
      // - Round (onDelete: Cascade)
      // - GameEvent (onDelete: Cascade)
      // - MatchPlayerStats (onDelete: Cascade)
      // - PlayerTick (onDelete: Cascade)
      // - Grenade (onDelete: Cascade)
      // - ChatMessage (onDelete: Cascade)
      // - ReplayEvent (onDelete: Cascade)
      // - Kill (onDelete: Cascade)
      await this.prisma.demo.delete({
        where: { id },
      });

      this.logger.log(`Demo ${id} (${demo.filename}) deleted by user ${userId}`);

      return {
        id,
        deleted: true,
        message: "Demo deleted successfully",
      };
    } catch (error) {
      this.logger.error(`Failed to delete demo ${id}: ${error}`);
      throw error;
    }
  }

  // Set parser job ID for tracking (not needed with Prisma but kept for compatibility)
  setParserJobId(id: string, jobId: string) {
    // Could store in demo record if needed
    this.logger.debug(`Parser job ${jobId} assigned to demo ${id}`);
  }
}
