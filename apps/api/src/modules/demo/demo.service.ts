/**
 * Demo Service - Business logic for demo management with Prisma persistence
 *
 * Features:
 * - Stream-based file upload (memory-efficient)
 * - Hash calculation during write
 * - Batch database operations for performance
 */

import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../common/prisma";
import { DemoStatus, GameMode, GrenadeType, Prisma } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import type { Readable } from "stream";
import { writeStreamWithHash } from "../../common/streaming";
import type { ParseOptionsDto } from "./dto/demo.dto";

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

@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);
  private readonly demoStoragePath: string;
  constructor(
    @InjectQueue("demo-parsing") private parsingQueue: Queue,
    private configService: ConfigService,
    private prisma: PrismaService
  ) {
    this.demoStoragePath = this.configService.get("DEMO_STORAGE_PATH", "/tmp/demos");

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
  }) {
    const id = crypto.randomUUID();
    const filePath = path.join(this.demoStoragePath, `${id}.dem`);

    // Write stream to disk while calculating hash
    // This is memory-efficient: only chunks are in memory at any time
    const { fileSize, fileHash } = await writeStreamWithHash(
      data.fileStream,
      filePath
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

  async queueForParsing(id: string, options: ParseOptionsDto) {
    const demo = await this.prisma.demo.findUnique({ where: { id } });
    if (!demo) {
      throw new NotFoundException(`Demo ${id} not found`);
    }

    await this.prisma.demo.update({
      where: { id },
      data: { status: DemoStatus.PARSING },
    });

    // Add to parsing queue
    const job = await this.parsingQueue.add(
      "parse",
      {
        demoId: id,
        filePath: demo.storagePath,
        options,
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      }
    );

    this.logger.log(`Demo ${id} queued for parsing, job: ${job.id}`);

    return {
      id,
      status: "parsing",
      jobId: job.id,
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
    };
  }

  async getDemo(id: string) {
    const demo = await this.prisma.demo.findUnique({ where: { id } });
    if (!demo) {
      throw new NotFoundException(`Demo ${id} not found`);
    }

    return {
      id: demo.id,
      filename: demo.filename,
      fileSize: demo.fileSize,
      status: demo.status,
      uploadedAt: demo.createdAt,
      parsedAt: demo.parsedAt,
      metadata: {
        map_name: demo.mapName,
        server_name: demo.serverName,
        tick_rate: demo.tickRate,
        duration_seconds: demo.durationSeconds,
        total_ticks: demo.totalTicks,
        team1_name: demo.team1Name,
        team2_name: demo.team2Name,
        team1_score: demo.team1Score,
        team2_score: demo.team2Score,
        game_mode: demo.gameMode,
      },
    };
  }

  async getDemoEvents(
    id: string,
    filters: { eventType?: string; round?: number }
  ) {
    const demo = await this.prisma.demo.findUnique({ where: { id } });
    if (!demo) {
      throw new NotFoundException(`Demo ${id} not found`);
    }

    if (demo.status !== DemoStatus.COMPLETED && demo.status !== DemoStatus.PARSED) {
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

    if (demo.status !== DemoStatus.COMPLETED && demo.status !== DemoStatus.PARSED) {
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

    if (demo.status !== DemoStatus.COMPLETED && demo.status !== DemoStatus.PARSED) {
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
    options: { startTick?: number; endTick?: number; interval?: number }
  ) {
    const demo = await this.prisma.demo.findUnique({ where: { id } });
    if (!demo) {
      throw new NotFoundException(`Demo ${id} not found`);
    }

    if (demo.status !== DemoStatus.COMPLETED && demo.status !== DemoStatus.PARSED) {
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

    if (demo.status !== DemoStatus.COMPLETED && demo.status !== DemoStatus.PARSED) {
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

    if (demo.status !== DemoStatus.COMPLETED && demo.status !== DemoStatus.PARSED) {
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

  async listDemos(options: { page: number; limit: number; map?: string }) {
    const where: Prisma.DemoWhereInput = {};
    if (options.map) {
      where.mapName = options.map;
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
    }
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

      // Insert grenades
      if (data.grenades?.length) {
        // Get round mappings for grenades
        const rounds = await this.prisma.round.findMany({
          where: { demoId: id },
          select: { id: true, startTick: true, endTick: true },
        });

        const findRoundId = (tick: number) => {
          const round = rounds.find(
            (r) => tick >= r.startTick && tick <= r.endTick
          );
          return round?.id;
        };

        for (const g of data.grenades) {
          const roundId = findRoundId(g.tick || 0);
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

      this.logger.log(
        `Demo ${id} marked as completed with ${data.events?.length || 0} events, ${data.rounds?.length || 0} rounds, ${data.players?.length || 0} players, ${data.grenades?.length || 0} grenades, ${data.chat_messages?.length || 0} chat messages`
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

  // Retry parsing a failed or pending demo
  async retryParsing(id: string) {
    const demo = await this.prisma.demo.findUnique({ where: { id } });
    if (!demo) {
      throw new NotFoundException(`Demo ${id} not found`);
    }

    // Only allow retry for FAILED or PENDING demos
    if (demo.status !== DemoStatus.FAILED && demo.status !== DemoStatus.PENDING) {
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
      }
    );

    this.logger.log(`Demo ${id} queued for retry parsing, job: ${job.id}`);

    return {
      id: demo.id,
      status: DemoStatus.PARSING,
      jobId: job.id,
      message: "Demo queued for retry",
    };
  }

  // Set parser job ID for tracking (not needed with Prisma but kept for compatibility)
  setParserJobId(id: string, jobId: string) {
    // Could store in demo record if needed
    this.logger.debug(`Parser job ${jobId} assigned to demo ${id}`);
  }
}
