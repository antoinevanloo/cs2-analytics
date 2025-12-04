/**
 * Replay Service
 *
 * Provides 2D replay data with:
 * - Efficient tick data retrieval with streaming
 * - Coordinate conversion for radar display
 * - Event aggregation and filtering
 * - Performance optimizations for large datasets
 *
 * @module replay
 */

import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../common/prisma";
import { RedisService } from "../../common/redis/redis.service";
import type {
  RoundReplayData,
  RoundMetadata,
  MapRadarConfig,
  TickFrame,
  PlayerFrame,
  ReplayEvent,
  GetRoundReplayOptions,
} from "./types/replay.types";

// Default tick sampling interval (8 ticks at 64 tick = 8 frames/second)
const DEFAULT_SAMPLE_INTERVAL = 8;

// Cache TTLs
const CACHE_TTL = {
  ROUND_METADATA: 60 * 60 * 1000, // 1 hour
  MAP_METADATA: 24 * 60 * 60 * 1000, // 24 hours
  ROUND_REPLAY: 30 * 60 * 1000, // 30 minutes
};

// Batch sizes for database queries
const BATCH_SIZE = {
  TICKS: 5000,
  EVENTS: 1000,
};

@Injectable()
export class ReplayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Get all rounds metadata for a demo
   */
  async getDemoRoundsMetadata(demoId: string): Promise<RoundMetadata[]> {
    const cacheKey = `replay:rounds:${demoId}`;
    const cached = await this.redis.get<RoundMetadata[]>(cacheKey);
    if (cached) return cached;

    const demo = await this.prisma.demo.findUnique({
      where: { id: demoId },
      include: {
        rounds: {
          orderBy: { roundNumber: "asc" },
          select: {
            roundNumber: true,
            startTick: true,
            endTick: true,
            winnerTeam: true,
            winReason: true,
            ctScore: true,
            tScore: true,
            bombPlanted: true,
            bombSite: true,
          },
        },
      },
    });

    if (!demo) {
      throw new NotFoundException(`Demo ${demoId} not found`);
    }

    const tickRate = demo.tickRate;
    const metadata: RoundMetadata[] = demo.rounds.map((r) => {
      const meta: RoundMetadata = {
        roundNumber: r.roundNumber,
        startTick: r.startTick,
        endTick: r.endTick,
        duration: (r.endTick - r.startTick) / tickRate,
        winnerTeam: r.winnerTeam,
        winReason: r.winReason,
        ctScore: r.ctScore,
        tScore: r.tScore,
        bombPlanted: r.bombPlanted,
      };
      if (r.bombSite) meta.bombSite = r.bombSite;
      return meta;
    });

    await this.redis.set(cacheKey, metadata, CACHE_TTL.ROUND_METADATA);
    return metadata;
  }

  /**
   * Get map radar configuration
   */
  async getMapMetadata(mapName: string): Promise<MapRadarConfig | null> {
    const cacheKey = `replay:map:${mapName}`;
    const cached = await this.redis.get<MapRadarConfig>(cacheKey);
    if (cached) return cached;

    const map = await this.prisma.mapMetadata.findUnique({
      where: { mapName },
    });

    if (!map) return null;

    const config: MapRadarConfig = {
      mapName: map.mapName,
      posX: map.posX,
      posY: map.posY,
      scale: map.scale,
      radarWidth: map.radarWidth,
      radarHeight: map.radarHeight,
      hasLowerLevel: map.hasLowerLevel,
    };

    if (map.displayName) config.displayName = map.displayName;
    if (map.lowerPosX !== null) config.lowerPosX = map.lowerPosX;
    if (map.lowerPosY !== null) config.lowerPosY = map.lowerPosY;
    if (map.lowerScale !== null) config.lowerScale = map.lowerScale;
    if (map.splitAltitude !== null) config.splitAltitude = map.splitAltitude;

    await this.redis.set(cacheKey, config, CACHE_TTL.MAP_METADATA);
    return config;
  }

  /**
   * Get complete replay data for a round
   */
  async getRoundReplay(
    demoId: string,
    roundNumber: number,
    options: GetRoundReplayOptions = {},
  ): Promise<RoundReplayData> {
    const { includeEvents = true, sampleInterval = DEFAULT_SAMPLE_INTERVAL } =
      options;

    // Get round info
    const round = await this.prisma.round.findUnique({
      where: {
        demoId_roundNumber: { demoId, roundNumber },
      },
      include: {
        demo: {
          select: {
            tickRate: true,
            mapName: true,
            team1Name: true,
            team2Name: true,
          },
        },
        playerStats: {
          select: {
            steamId: true,
            teamNum: true,
          },
        },
      },
    });

    if (!round) {
      throw new NotFoundException(
        `Round ${roundNumber} not found in demo ${demoId}`,
      );
    }

    // Get map config for coordinate conversion
    const mapConfig = await this.getMapMetadata(round.demo.mapName);

    // Get tick data
    const frames = await this.getTickFrames(
      demoId,
      round.id,
      round.startTick,
      round.endTick,
      round.demo.tickRate,
      sampleInterval,
      mapConfig,
    );

    // Get events if requested
    let events: ReplayEvent[] = [];
    if (includeEvents) {
      events = await this.getRoundEvents(demoId, round.id, mapConfig);
    }

    // Organize players by team
    const ctPlayers = round.playerStats
      .filter((p) => p.teamNum === 3)
      .map((p) => p.steamId);
    const tPlayers = round.playerStats
      .filter((p) => p.teamNum === 2)
      .map((p) => p.steamId);

    return {
      demoId,
      roundNumber,
      startTick: round.startTick,
      endTick: round.endTick,
      winnerTeam: round.winnerTeam,
      winReason: round.winReason,
      ctTeam: {
        name: round.demo.team1Name,
        players: ctPlayers,
        score: round.ctScore,
      },
      tTeam: {
        name: round.demo.team2Name,
        players: tPlayers,
        score: round.tScore,
      },
      tickRate: round.demo.tickRate,
      sampleInterval,
      frames,
      events,
    };
  }

  /**
   * Stream replay data for a round (generator for NDJSON)
   */
  async *streamRoundReplay(
    demoId: string,
    roundNumber: number,
    options: { sampleInterval?: number; batchSize?: number } = {},
  ): AsyncGenerator<TickFrame | ReplayEvent | { type: string; data: unknown }> {
    const { sampleInterval = DEFAULT_SAMPLE_INTERVAL, batchSize = 100 } =
      options;

    // Get round info
    const round = await this.prisma.round.findUnique({
      where: {
        demoId_roundNumber: { demoId, roundNumber },
      },
      include: {
        demo: {
          select: {
            tickRate: true,
            mapName: true,
          },
        },
      },
    });

    if (!round) {
      throw new NotFoundException(
        `Round ${roundNumber} not found in demo ${demoId}`,
      );
    }

    const mapConfig = await this.getMapMetadata(round.demo.mapName);

    // Yield metadata first
    yield {
      type: "metadata",
      data: {
        demoId,
        roundNumber,
        startTick: round.startTick,
        endTick: round.endTick,
        tickRate: round.demo.tickRate,
        sampleInterval,
        map: mapConfig,
      },
    };

    // Stream frames in batches
    let offset = 0;
    let framesStreamed = 0;

    while (true) {
      const ticks = await this.prisma.playerTick.findMany({
        where: {
          demoId,
          roundId: round.id,
          tick: {
            gte: round.startTick,
            lte: round.endTick,
          },
        },
        orderBy: { tick: "asc" },
        skip: offset,
        take: batchSize * 10, // Get more ticks, then sample
      });

      if (ticks.length === 0) break;

      // Group by tick and sample
      const tickGroups = this.groupTicksByTick(ticks);
      const sampledTicks = this.sampleTicks(tickGroups, sampleInterval);

      for (const [tick, players] of sampledTicks) {
        const frame = this.buildTickFrame(
          tick,
          players,
          round.startTick,
          round.demo.tickRate,
          mapConfig,
        );
        yield frame;
        framesStreamed++;
      }

      offset += batchSize * 10;
      if (ticks.length < batchSize * 10) break;
    }

    // Stream events
    const events = await this.getRoundEvents(demoId, round.id, mapConfig);
    for (const event of events) {
      yield event;
    }

    // Yield end marker
    yield {
      type: "end",
      data: {
        framesStreamed,
        eventsStreamed: events.length,
      },
    };
  }

  /**
   * Check if tick data exists for a demo
   */
  async hasTickData(demoId: string): Promise<boolean> {
    const count = await this.prisma.playerTick.count({
      where: { demoId },
      take: 1,
    });
    return count > 0;
  }

  // ============================================================================
  // COORDINATE CONVERSION
  // ============================================================================

  /**
   * Convert game coordinates to radar coordinates (0-1024)
   */
  convertToRadarCoords(
    gameX: number,
    gameY: number,
    gameZ: number,
    mapConfig: MapRadarConfig | null,
  ): { x: number; y: number; level: "upper" | "lower" } {
    if (!mapConfig) {
      // Return normalized coordinates if no map config
      return { x: gameX, y: gameY, level: "upper" };
    }

    // Check for multi-level maps
    let posX = mapConfig.posX;
    let posY = mapConfig.posY;
    let scale = mapConfig.scale;
    let level: "upper" | "lower" = "upper";

    if (
      mapConfig.hasLowerLevel &&
      mapConfig.splitAltitude !== undefined &&
      gameZ < mapConfig.splitAltitude
    ) {
      posX = mapConfig.lowerPosX ?? posX;
      posY = mapConfig.lowerPosY ?? posY;
      scale = mapConfig.lowerScale ?? scale;
      level = "lower";
    }

    // Apply transformation
    // Formula: radarCoord = (gameCoord - pos) / scale
    const radarX = (gameX - posX) / scale;
    const radarY = (posY - gameY) / scale; // Y is inverted

    // Clamp to radar bounds
    return {
      x: Math.max(0, Math.min(mapConfig.radarWidth, radarX)),
      y: Math.max(0, Math.min(mapConfig.radarHeight, radarY)),
      level,
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Get tick frames for a round
   */
  private async getTickFrames(
    demoId: string,
    roundId: string,
    startTick: number,
    endTick: number,
    tickRate: number,
    sampleInterval: number,
    mapConfig: MapRadarConfig | null,
  ): Promise<TickFrame[]> {
    const frames: TickFrame[] = [];
    let cursor: string | undefined;

    while (true) {
      const ticks = await this.prisma.playerTick.findMany({
        where: {
          demoId,
          roundId,
          tick: { gte: startTick, lte: endTick },
        },
        orderBy: { tick: "asc" },
        take: BATCH_SIZE.TICKS,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      if (ticks.length === 0) break;

      // Group by tick
      const tickGroups = this.groupTicksByTick(ticks);

      // Sample and convert
      const sampledTicks = this.sampleTicks(tickGroups, sampleInterval);

      for (const [tick, players] of sampledTicks) {
        frames.push(
          this.buildTickFrame(tick, players, startTick, tickRate, mapConfig),
        );
      }

      const lastTick = ticks[ticks.length - 1];
      if (!lastTick || ticks.length < BATCH_SIZE.TICKS) break;
      cursor = lastTick.id;
    }

    return frames;
  }

  /**
   * Group player ticks by tick number
   */
  private groupTicksByTick(
    ticks: Array<{
      tick: number;
      steamId: string;
      x: number;
      y: number;
      z: number;
      yaw: number;
      pitch: number;
      health: number;
      armor: number;
      isAlive: boolean;
      isDucking: boolean;
      isScoped: boolean;
      isDefusing: boolean;
      isPlanting: boolean;
      team: number;
      activeWeapon: string | null;
      hasDefuseKit: boolean;
      hasBomb: boolean;
      money: number;
      flashDuration: number;
    }>,
  ): Map<number, typeof ticks> {
    const groups = new Map<number, typeof ticks>();

    for (const tick of ticks) {
      const existing = groups.get(tick.tick);
      if (existing) {
        existing.push(tick);
      } else {
        groups.set(tick.tick, [tick]);
      }
    }

    return groups;
  }

  /**
   * Sample ticks at specified interval
   */
  private sampleTicks<T>(
    tickGroups: Map<number, T[]>,
    sampleInterval: number,
  ): Map<number, T[]> {
    const sampled = new Map<number, T[]>();
    const sortedTicks = Array.from(tickGroups.keys()).sort((a, b) => a - b);

    let lastSampledTick = -sampleInterval;

    for (const tick of sortedTicks) {
      if (tick - lastSampledTick >= sampleInterval) {
        const data = tickGroups.get(tick);
        if (data) {
          sampled.set(tick, data);
        }
        lastSampledTick = tick;
      }
    }

    return sampled;
  }

  /**
   * Build a tick frame from player data
   */
  private buildTickFrame(
    tick: number,
    players: Array<{
      steamId: string;
      x: number;
      y: number;
      z: number;
      yaw: number;
      pitch: number;
      health: number;
      armor: number;
      isAlive: boolean;
      isDucking: boolean;
      isScoped: boolean;
      isDefusing: boolean;
      isPlanting: boolean;
      team: number;
      activeWeapon: string | null;
      hasDefuseKit: boolean;
      hasBomb: boolean;
      money: number;
      flashDuration: number;
    }>,
    startTick: number,
    tickRate: number,
    mapConfig: MapRadarConfig | null,
  ): TickFrame {
    const playerFrames: PlayerFrame[] = players.map((p) => {
      const coords = this.convertToRadarCoords(p.x, p.y, p.z, mapConfig);

      const frame: PlayerFrame = {
        steamId: p.steamId,
        x: coords.x,
        y: coords.y,
        z: p.z,
        yaw: p.yaw,
        pitch: p.pitch,
        health: p.health,
        armor: p.armor,
        isAlive: p.isAlive,
        isDucking: p.isDucking,
        isScoped: p.isScoped,
        isDefusing: p.isDefusing,
        isPlanting: p.isPlanting,
        team: p.team,
        hasDefuseKit: p.hasDefuseKit,
        hasBomb: p.hasBomb,
        money: p.money,
        flashDuration: p.flashDuration,
      };

      if (p.activeWeapon) frame.activeWeapon = p.activeWeapon;

      return frame;
    });

    return {
      tick,
      time: (tick - startTick) / tickRate,
      players: playerFrames,
    };
  }

  /**
   * Get events for a round
   */
  private async getRoundEvents(
    demoId: string,
    roundId: string,
    mapConfig: MapRadarConfig | null,
  ): Promise<ReplayEvent[]> {
    // Get kills
    const kills = await this.prisma.kill.findMany({
      where: { demoId, roundId },
      orderBy: { tick: "asc" },
    });

    // Get grenades
    const grenades = await this.prisma.grenade.findMany({
      where: { demoId, roundId },
      orderBy: { tick: "asc" },
    });

    // Get replay events if available
    const replayEvents = await this.prisma.replayEvent.findMany({
      where: { demoId, roundId },
      orderBy: { tick: "asc" },
    });

    const events: ReplayEvent[] = [];

    // Convert kills
    for (const kill of kills) {
      const coords = this.convertToRadarCoords(
        kill.victimX,
        kill.victimY,
        kill.victimZ,
        mapConfig,
      );

      events.push({
        type: "KILL",
        tick: kill.tick,
        time: 0, // Will be calculated by client
        x: coords.x,
        y: coords.y,
        z: kill.victimZ,
        attackerSteamId: kill.attackerSteamId ?? undefined,
        attackerName: kill.attackerName ?? undefined,
        victimSteamId: kill.victimSteamId,
        victimName: kill.victimName,
        weapon: kill.weapon,
        headshot: kill.headshot,
        noscope: kill.noscope,
        thrusmoke: kill.thrusmoke,
        wallbang: kill.penetrated > 0,
      });
    }

    // Convert grenades
    for (const nade of grenades) {
      const coords = this.convertToRadarCoords(nade.x, nade.y, nade.z, mapConfig);

      const eventType = this.mapGrenadeType(nade.type);
      if (eventType) {
        events.push({
          type: eventType,
          tick: nade.tick,
          time: 0,
          x: coords.x,
          y: coords.y,
          z: nade.z,
          throwerSteamId: nade.throwerSteamId,
          grenadeType: nade.type,
        });
      }
    }

    // Add replay events
    for (const event of replayEvents) {
      const coords = this.convertToRadarCoords(event.x, event.y, event.z, mapConfig);

      events.push({
        type: event.type as ReplayEvent["type"],
        tick: event.tick,
        time: 0,
        x: coords.x,
        y: coords.y,
        z: event.z,
        ...(event.data as object),
      });
    }

    // Sort all events by tick
    return events.sort((a, b) => a.tick - b.tick);
  }

  /**
   * Map grenade type to replay event type
   */
  private mapGrenadeType(
    type: string,
  ): "SMOKE_START" | "FLASH_EFFECT" | "HE_EXPLODE" | "MOLOTOV_START" | null {
    switch (type) {
      case "SMOKE":
        return "SMOKE_START";
      case "FLASHBANG":
        return "FLASH_EFFECT";
      case "HEGRENADE":
        return "HE_EXPLODE";
      case "MOLOTOV":
      case "INCENDIARY":
        return "MOLOTOV_START";
      default:
        return null;
    }
  }
}
