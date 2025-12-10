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
import { TransformerOrchestrator, type DemoEvent } from "./transformers";

// Re-export DemoEvent for backwards compatibility with demo.processor
export type { DemoEvent } from "./transformers";

// Interfaces for parser data
export interface DemoGrenade {
  type?: string;
  tick?: number;
  X?: number;
  Y?: number;
  Z?: number;
  thrower_steamid?: string;
  thrower_name?: string;
  thrower_team?: number;
  // Event lifecycle: "throw", "start"/"detonate", "end"/"expired"
  event?: string;
  // Entity ID for linking events
  entity_id?: number;
  // Throw direction (for GRENADE_THROW events)
  yaw?: number;
  pitch?: number;
  // Effectiveness stats (flash)
  enemies_blinded?: number;
  teammates_blinded?: number;
  total_blind_duration?: number;
  // Effectiveness stats (HE/molotov)
  total_damage?: number;
  enemies_damaged?: number;
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

// Note: DemoEvent is imported from './transformers' module

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
    private transformerOrchestrator: TransformerOrchestrator,
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

      // Get rounds for tick-to-round mapping (used by grenades)
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

      // Insert grenades with trajectory linking
      if (data.grenades?.length) {
        // Separate throw events from detonate events for trajectory linking
        const throwEvents = data.grenades.filter(g => g.event === "throw");
        const detonateEvents = data.grenades.filter(g => g.event !== "throw");

        // Index ALL throw events by type + steamId, keeping array of throws sorted by tick
        const throwIndex = new Map<string, Array<typeof throwEvents[number]>>();
        for (const t of throwEvents) {
          const key = `${t.type}_${t.thrower_steamid}`;
          const existing = throwIndex.get(key) || [];
          existing.push(t);
          throwIndex.set(key, existing);
        }
        // Sort each array by tick (ascending)
        for (const throws of throwIndex.values()) {
          throws.sort((a, b) => (a.tick || 0) - (b.tick || 0));
        }

        // Track used throws to prevent double-matching
        const usedThrows = new Set<number>();

        // Find matching throw for a detonate event
        // Finds the closest unused throw BEFORE the detonate (within 400 ticks)
        const findMatchingThrow = (g: typeof detonateEvents[number]) => {
          const key = `${g.type}_${g.thrower_steamid}`;
          const throws = throwIndex.get(key);
          if (!throws || throws.length === 0) return null;

          const detonateTick = g.tick || 0;
          let bestMatch: typeof throwEvents[number] | null = null;
          let bestDiff = Infinity;

          // Find closest unused throw before detonate
          for (const t of throws) {
            const throwTick = t.tick || 0;
            const tickDiff = detonateTick - throwTick;

            // Must be before detonate and within 400 ticks (~6 seconds)
            if (tickDiff > 0 && tickDiff < 400 && !usedThrows.has(throwTick)) {
              if (tickDiff < bestDiff) {
                bestDiff = tickDiff;
                bestMatch = t;
              }
            }
          }

          // Mark as used
          if (bestMatch) {
            usedThrows.add(bestMatch.tick || 0);
          }

          return bestMatch;
        };

        // Insert detonate/expired events with trajectory data
        for (const g of detonateEvents) {
          const round = findRoundForTick(g.tick || 0);
          const roundId = round?.id;
          if (roundId) {
            // Find matching throw event for trajectory
            const throwEvent = g.event === "start" || g.event === "detonate" || !g.event
              ? findMatchingThrow(g)
              : null;

            await this.prisma.grenade.create({
              data: {
                demoId: id,
                roundId,
                type: this.mapGrenadeType(g.type || "smoke"),
                event: g.event || "start",
                entityId: g.entity_id || null,
                tick: g.tick || 0,
                x: g.X || 0,
                y: g.Y || 0,
                z: g.Z || 0,
                // Trajectory data (from linked throw event)
                throwX: throwEvent?.X ?? null,
                throwY: throwEvent?.Y ?? null,
                throwZ: throwEvent?.Z ?? null,
                throwTick: throwEvent?.tick ?? null,
                throwYaw: throwEvent?.yaw ?? null,
                throwPitch: throwEvent?.pitch ?? null,
                // Thrower info (null for end events)
                throwerSteamId: g.thrower_steamid || null,
                throwerName: g.thrower_name || null,
                throwerTeam: g.thrower_team || null,
                // Effectiveness stats
                enemiesBlinded: g.enemies_blinded || 0,
                teammatesBlinded: g.teammates_blinded || 0,
                totalBlindDuration: g.total_blind_duration || 0,
                damageDealt: g.total_damage || 0,
                enemiesDamaged: g.enemies_damaged || 0,
              },
            });
          }
        }

        // Also insert throw events for standalone trajectory visualization
        for (const g of throwEvents) {
          const round = findRoundForTick(g.tick || 0);
          const roundId = round?.id;
          if (roundId) {
            await this.prisma.grenade.create({
              data: {
                demoId: id,
                roundId,
                type: this.mapGrenadeType(g.type || "smoke"),
                event: "throw",
                tick: g.tick || 0,
                x: g.X || 0,
                y: g.Y || 0,
                z: g.Z || 0,
                throwYaw: g.yaw ?? null,
                throwPitch: g.pitch ?? null,
                throwerSteamId: g.thrower_steamid || null,
                throwerName: g.thrower_name || null,
                throwerTeam: g.thrower_team || null,
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

      // =========================================================================
      // RUN TRANSFORMERS (modular data transformations)
      // =========================================================================
      // Transformers handle: Kill extraction, RoundPlayerStats, Trades, Clutches, ReplayEvents
      // Each transformer is isolated, testable, and extensible
      const transformResult = await this.transformerOrchestrator.execute(
        id,
        data.events || [],
      );

      if (!transformResult.success) {
        this.logger.warn(
          `Some transformers failed for demo ${id}: ` +
            transformResult.results
              .filter((r) => !r.success)
              .map((r) => `${r.transformer}: ${r.error}`)
              .join(", "),
        );
      } else {
        this.logger.log(
          `Transformers completed for demo ${id}: ` +
            `${transformResult.summary.recordsCreated} records in ${transformResult.totalTimeMs}ms`,
        );
      }

      this.logger.log(
        `Demo ${id} marked as completed with ${data.events?.length || 0} events, ${data.rounds?.length || 0} rounds, ${data.players?.length || 0} players, ${data.grenades?.length || 0} grenades, ${data.chat_messages?.length || 0} chat messages, ${data.ticks?.length || 0} ticks`,
      );

      // Update linked SteamMatch status to COMPLETED (for Steam import gamification flow)
      const linkedSteamMatch = await this.prisma.steamMatch.findUnique({
        where: { demoId: id },
      });
      if (linkedSteamMatch) {
        await this.prisma.steamMatch.update({
          where: { id: linkedSteamMatch.id },
          data: {
            downloadStatus: "COMPLETED",
            currentStep: null,
          },
        });
        this.logger.log(`SteamMatch ${linkedSteamMatch.id} marked as COMPLETED`);
      }
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
  // ROUND PLAYER STATS RECOMPUTATION
  // ===========================================================================

  /**
   * Recompute stats for an existing demo using transformer orchestrator
   *
   * Use this to fix demos that were parsed before transformer system
   * was implemented or to re-run specific transformers after algorithm updates.
   *
   * Delegates to TransformerOrchestrator.rerun() for modular, testable execution.
   *
   * @param demoId - Demo ID to recompute
   * @param transformerNames - Optional specific transformers to rerun (defaults to all stats transformers)
   */
  async recomputeRoundPlayerStats(
    demoId: string,
    transformerNames?: string[],
  ): Promise<{
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

    // Default to stats-related transformers if none specified
    const transformersToRun = transformerNames ?? [
      "RoundStatsComputer",
      "TradeDetector",
      "ClutchDetector",
    ];

    this.logger.log(
      `Recomputing stats for demo ${demoId} with transformers: ${transformersToRun.join(", ")}`,
    );

    // Use orchestrator rerun - it fetches events from DB and runs specified transformers
    const result = await this.transformerOrchestrator.rerun(
      demoId,
      transformersToRun,
    );

    const duration = Date.now() - startTime;

    if (!result.success) {
      this.logger.warn(
        `Recompute failed for demo ${demoId}: ` +
          result.results
            .filter((r) => !r.success)
            .map((r) => `${r.transformer}: ${r.error}`)
            .join(", "),
      );
    }

    // Also delete cached analysis so it gets recomputed with fresh data
    await this.prisma.analysis.deleteMany({
      where: { demoId },
    });

    this.logger.log(
      `Recomputed stats for demo ${demoId}: ${result.summary.recordsCreated} records in ${duration}ms`,
    );

    return {
      success: result.success,
      recordsCreated: result.summary.recordsCreated,
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
