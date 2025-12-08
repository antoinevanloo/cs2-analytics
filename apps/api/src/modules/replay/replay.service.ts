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

import { Injectable, NotFoundException, Logger } from "@nestjs/common";

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

  private readonly logger = new Logger(ReplayService.name);

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

    // Get player names for all players in this round
    const playerSteamIds = round.playerStats.map((p) => p.steamId);
    const playerNames = await this.getPlayerNames(playerSteamIds);

    // Get map config for coordinate conversion
    const mapConfig = await this.getMapMetadata(round.demo.mapName);

    // Get tick data with player names
    const frames = await this.getTickFrames(
      demoId,
      round.id,
      round.startTick,
      round.endTick,
      round.demo.tickRate,
      sampleInterval,
      mapConfig,
      playerNames,
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

    // Get round info with player stats
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
        playerStats: {
          select: {
            steamId: true,
          },
        },
      },
    });

    if (!round) {
      throw new NotFoundException(
        `Round ${roundNumber} not found in demo ${demoId}`,
      );
    }

    // Get player names for all players in this round
    const playerSteamIds = round.playerStats.map((p) => p.steamId);
    const playerNames = await this.getPlayerNames(playerSteamIds);

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

    // Get all distinct ticks that exist in the DB for this round
    const distinctTicks = await this.prisma.playerTick.findMany({
      where: {
        demoId,
        roundId: round.id,
        tick: { gte: round.startTick, lte: round.endTick },
      },
      select: { tick: true },
      distinct: ["tick"],
      orderBy: { tick: "asc" },
    });

    const availableTicks = distinctTicks.map((t) => t.tick);

    // Sample the available ticks
    const storedInterval = availableTicks.length > 1
      ? availableTicks[1]! - availableTicks[0]!
      : sampleInterval;
    const skipCount = Math.max(1, Math.round(sampleInterval / storedInterval));

    const sampledTicks: number[] = [];
    for (let i = 0; i < availableTicks.length; i += skipCount) {
      sampledTicks.push(availableTicks[i]!);
    }

    // Stream frames in batches
    let framesStreamed = 0;
    const TICKS_PER_BATCH = batchSize;

    for (let i = 0; i < sampledTicks.length; i += TICKS_PER_BATCH) {
      const batchTicks = sampledTicks.slice(i, i + TICKS_PER_BATCH);

      const ticks = await this.prisma.playerTick.findMany({
        where: {
          demoId,
          roundId: round.id,
          tick: { in: batchTicks },
        },
        orderBy: [{ tick: "asc" }, { steamId: "asc" }],
      });

      if (ticks.length === 0) continue;

      // Group by tick
      const tickGroups = this.groupTicksByTick(ticks);

      for (const tickNum of batchTicks) {
        const players = tickGroups.get(tickNum);
        if (players && players.length > 0) {
          const frame = this.buildTickFrame(
            tickNum,
            players,
            round.startTick,
            round.demo.tickRate,
            mapConfig,
            playerNames,
          );
          yield frame;
          framesStreamed++;
        }
      }
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
   *
   * Enhanced with:
   * - Input validation (NaN, Infinity handling)
   * - Out-of-bounds detection flag
   * - Debug logging for invalid coordinates
   *
   * @returns Object with x, y (clamped to radar bounds), level, and isOutOfBounds flag
   */
  convertToRadarCoords(
    gameX: number,
    gameY: number,
    gameZ: number,
    mapConfig: MapRadarConfig | null,
  ): { x: number; y: number; level: "upper" | "lower"; isOutOfBounds: boolean } {
    // Validate input coordinates
    if (!Number.isFinite(gameX) || !Number.isFinite(gameY)) {
      this.logger.warn(
        `Invalid game coordinates: (${gameX}, ${gameY}, ${gameZ}) - returning origin`,
      );
      return { x: 0, y: 0, level: "upper", isOutOfBounds: true };
    }

    if (!mapConfig) {
      // Return raw coordinates if no map config (client will handle conversion)
      return { x: gameX, y: gameY, level: "upper", isOutOfBounds: false };
    }

    // Check for multi-level maps
    let posX = mapConfig.posX;
    let posY = mapConfig.posY;
    let scale = mapConfig.scale;
    let level: "upper" | "lower" = "upper";

    // Validate scale to avoid division by zero
    if (!Number.isFinite(scale) || scale === 0) {
      this.logger.warn(`Invalid map scale: ${scale} for map ${mapConfig.mapName}`);
      return { x: 0, y: 0, level: "upper", isOutOfBounds: true };
    }

    if (
      mapConfig.hasLowerLevel &&
      mapConfig.splitAltitude !== undefined &&
      Number.isFinite(gameZ) &&
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

    // Check if out of bounds (before clamping)
    const isOutOfBounds =
      radarX < 0 ||
      radarX > mapConfig.radarWidth ||
      radarY < 0 ||
      radarY > mapConfig.radarHeight;

    // Debug log for significantly out-of-bounds coordinates (>10% outside)
    if (isOutOfBounds) {
      const outsideMargin = Math.max(
        Math.abs(Math.min(0, radarX)),
        Math.abs(Math.max(0, radarX - mapConfig.radarWidth)),
        Math.abs(Math.min(0, radarY)),
        Math.abs(Math.max(0, radarY - mapConfig.radarHeight)),
      );
      if (outsideMargin > mapConfig.radarWidth * 0.1) {
        this.logger.debug(
          `Player significantly out of bounds: game(${gameX.toFixed(0)}, ${gameY.toFixed(0)}) -> ` +
          `radar(${radarX.toFixed(0)}, ${radarY.toFixed(0)}) on ${mapConfig.mapName}`,
        );
      }
    }

    // Clamp to radar bounds
    return {
      x: Math.max(0, Math.min(mapConfig.radarWidth, radarX)),
      y: Math.max(0, Math.min(mapConfig.radarHeight, radarY)),
      level,
      isOutOfBounds,
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Get player names by steam IDs
   * Caches results for efficiency
   */
  private async getPlayerNames(steamIds: string[]): Promise<Map<string, string>> {
    if (steamIds.length === 0) return new Map();

    // Try cache first
    const cacheKey = `replay:playernames:${steamIds.sort().join(",")}`;
    const cached = await this.redis.get<Record<string, string>>(cacheKey);
    if (cached) {
      return new Map(Object.entries(cached));
    }

    // Fetch from database
    const players = await this.prisma.player.findMany({
      where: { steamId: { in: steamIds } },
      select: { steamId: true, name: true },
    });

    const nameMap = new Map<string, string>();
    for (const player of players) {
      nameMap.set(player.steamId, player.name);
    }

    // Cache for 1 hour
    await this.redis.set(cacheKey, Object.fromEntries(nameMap), CACHE_TTL.ROUND_METADATA);
    return nameMap;
  }

  /**
   * Get tick frames for a round
   *
   * Fetches all available ticks for the round and applies sampling.
   * This approach handles cases where stored ticks don't align perfectly
   * with calculated sample intervals (e.g., due to parser timing variations).
   */
  private async getTickFrames(
    demoId: string,
    roundId: string,
    startTick: number,
    endTick: number,
    tickRate: number,
    sampleInterval: number,
    mapConfig: MapRadarConfig | null,
    playerNames?: Map<string, string>,
  ): Promise<TickFrame[]> {
    const frames: TickFrame[] = [];

    // First, get all distinct ticks that exist in the DB for this round
    const distinctTicks = await this.prisma.playerTick.findMany({
      where: {
        demoId,
        roundId,
        tick: { gte: startTick, lte: endTick },
      },
      select: { tick: true },
      distinct: ["tick"],
      orderBy: { tick: "asc" },
    });

    const availableTicks = distinctTicks.map((t) => t.tick);
    this.logger.debug(`[getTickFrames] Found ${availableTicks.length} distinct ticks in round`);

    if (availableTicks.length === 0) {
      return frames;
    }

    // Sample the available ticks (take every Nth tick based on sampleInterval)
    // If data was stored at 8-tick intervals and we want 8-tick intervals, take every tick
    // If stored at 8 and we want 16, take every 2nd tick, etc.
    const storedInterval = availableTicks.length > 1
      ? availableTicks[1]! - availableTicks[0]!
      : sampleInterval;
    const skipCount = Math.max(1, Math.round(sampleInterval / storedInterval));

    const sampledTicks: number[] = [];
    for (let i = 0; i < availableTicks.length; i += skipCount) {
      sampledTicks.push(availableTicks[i]!);
    }

    this.logger.debug(
      `[getTickFrames] Stored interval=${storedInterval}, requested=${sampleInterval}, ` +
      `skipCount=${skipCount}, sampling ${sampledTicks.length} of ${availableTicks.length} ticks`
    );

    // Fetch sampled ticks in batches
    const TICKS_PER_BATCH = 500;

    for (let i = 0; i < sampledTicks.length; i += TICKS_PER_BATCH) {
      const batchTicks = sampledTicks.slice(i, i + TICKS_PER_BATCH);

      const ticks = await this.prisma.playerTick.findMany({
        where: {
          demoId,
          roundId,
          tick: { in: batchTicks },
        },
        orderBy: [{ tick: "asc" }, { steamId: "asc" }],
      });

      this.logger.debug(`[getTickFrames] Batch ${i}: fetched ${ticks.length} playerTick rows for ${batchTicks.length} ticks`);

      if (ticks.length === 0) continue;

      // Group by tick
      const tickGroups = this.groupTicksByTick(ticks);

      // Log first tick group to debug
      if (i === 0 && tickGroups.size > 0) {
        const firstTick = Array.from(tickGroups.keys())[0] ?? 0;
        const firstGroup = tickGroups.get(firstTick);
        this.logger.debug(`[getTickFrames] First tick ${firstTick} has ${firstGroup?.length ?? 0} players`);
      }

      // Build frames for each tick
      for (const tickNum of batchTicks) {
        const players = tickGroups.get(tickNum);
        if (players && players.length > 0) {
          frames.push(
            this.buildTickFrame(tickNum, players, startTick, tickRate, mapConfig, playerNames),
          );
        }
      }
    }

    this.logger.debug(`[getTickFrames] Built ${frames.length} frames, first frame has ${frames[0]?.players?.length ?? 0} players`);

    return frames;
  }

  /**
   * Group player ticks by tick number
   *
   * Updated to include new fields: velocity, isWalking, weaponAmmo, flashAlpha
   */
  private groupTicksByTick(
    ticks: Array<{
      tick: number;
      steamId: string;
      x: number;
      y: number;
      z: number;
      velocityX: number;
      velocityY: number;
      velocityZ: number;
      yaw: number;
      pitch: number;
      health: number;
      armor: number;
      isAlive: boolean;
      isDucking: boolean;
      isWalking: boolean;
      isScoped: boolean;
      isDefusing: boolean;
      isPlanting: boolean;
      team: number;
      activeWeapon: string | null;
      weaponAmmo: number | null;
      hasDefuseKit: boolean;
      hasBomb: boolean;
      money: number;
      flashDuration: number;
      flashAlpha: number;
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
   * Build a tick frame from player data
   *
   * Includes all new fields: velocity, isWalking, weaponAmmo, flashAlpha
   */
  private buildTickFrame(
    tick: number,
    players: Array<{
      steamId: string;
      x: number;
      y: number;
      z: number;
      velocityX: number;
      velocityY: number;
      velocityZ: number;
      yaw: number;
      pitch: number;
      health: number;
      armor: number;
      isAlive: boolean;
      isDucking: boolean;
      isWalking: boolean;
      isScoped: boolean;
      isDefusing: boolean;
      isPlanting: boolean;
      team: number;
      activeWeapon: string | null;
      weaponAmmo: number | null;
      hasDefuseKit: boolean;
      hasBomb: boolean;
      money: number;
      flashDuration: number;
      flashAlpha: number;
    }>,
    startTick: number,
    tickRate: number,
    mapConfig: MapRadarConfig | null,
    playerNames?: Map<string, string>,
  ): TickFrame {
    const playerFrames: PlayerFrame[] = players.map((p) => {
      const coords = this.convertToRadarCoords(p.x, p.y, p.z, mapConfig);

      const frame: PlayerFrame = {
        steamId: p.steamId,
        // Radar coordinates (converted from game coords)
        x: coords.x,
        y: coords.y,
        z: p.z,
        // Velocity (game units/sec)
        velocityX: p.velocityX,
        velocityY: p.velocityY,
        velocityZ: p.velocityZ,
        // View angles
        yaw: p.yaw,
        pitch: p.pitch,
        // Health/Armor
        health: p.health,
        armor: p.armor,
        // State flags
        isAlive: p.isAlive,
        isDucking: p.isDucking,
        isWalking: p.isWalking,
        isScoped: p.isScoped,
        isDefusing: p.isDefusing,
        isPlanting: p.isPlanting,
        // Team & equipment
        team: p.team,
        hasDefuseKit: p.hasDefuseKit,
        hasBomb: p.hasBomb,
        money: p.money,
        // Flash state
        flashDuration: p.flashDuration,
        flashAlpha: p.flashAlpha,
      };

      // Add player name if available
      const name = playerNames?.get(p.steamId);
      if (name) frame.name = name;

      // Add optional fields
      if (p.activeWeapon) frame.activeWeapon = p.activeWeapon;
      if (p.weaponAmmo !== null) frame.weaponAmmo = p.weaponAmmo;

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
      const coords = this.convertToRadarCoords(
        nade.x,
        nade.y,
        nade.z,
        mapConfig,
      );

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
      const coords = this.convertToRadarCoords(
        event.x,
        event.y,
        event.z,
        mapConfig,
      );

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
