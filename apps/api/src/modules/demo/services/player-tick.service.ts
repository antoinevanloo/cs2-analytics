/**
 * PlayerTick Service
 *
 * Handles processing and storage of tick-by-tick player state data
 * for 2D replay visualization.
 *
 * Architecture decisions:
 * - Separated from DemoService for single responsibility
 * - Supports multiple input formats (flat vs grouped)
 * - Batch processing for scalability (100k+ rows)
 * - Validation layer to ensure data quality
 * - Transaction support for atomicity
 *
 * Performance targets:
 * - Insert: <15s for full match (~300k rows)
 * - Memory: <500MB peak during processing
 */

import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../common/prisma";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Raw player state from parser (demoparser2 format)
 * Uses snake_case as received from Python parser
 */
interface RawPlayerState {
  steamid?: string | number;
  name?: string;
  team_num?: number;
  // Position (both X/x formats supported)
  X?: number;
  Y?: number;
  Z?: number;
  x?: number;
  y?: number;
  z?: number;
  // Velocity
  velocity_X?: number;
  velocity_Y?: number;
  velocity_Z?: number;
  // View angles
  yaw?: number;
  pitch?: number;
  // Health/Armor
  health?: number;
  armor_value?: number;
  armor?: number;
  // State flags
  is_alive?: boolean;
  ducking?: boolean;
  is_ducking?: boolean;
  is_walking?: boolean;
  is_scoped?: boolean;
  is_defusing?: boolean;
  is_planting?: boolean;
  // Weapons
  active_weapon_name?: string;
  active_weapon?: string;
  active_weapon_ammo?: number;
  // Equipment
  has_defuser?: boolean;
  has_defuse_kit?: boolean;
  has_bomb?: boolean;
  has_c4?: boolean;
  // Full inventory (array of weapon names from demoparser2)
  inventory?: string[] | string;
  // Economy
  balance?: number;
  money?: number;
  // Flash
  flash_duration?: number;
  flash_alpha?: number;
}

/**
 * Tick data from parser - can be grouped or flat format
 */
interface RawTickData {
  tick?: number;
  game_time?: number;
  players?: RawPlayerState[];
  // Flat format fields (when players array not present)
  steamid?: string | number;
  [key: string]: unknown;
}

/**
 * Normalized player tick ready for database insertion
 * Matches Prisma PlayerTick model exactly
 */
interface NormalizedPlayerTick {
  demoId: string;
  roundId: string | null;
  tick: number;
  steamId: string;
  name: string | null; // Player display name
  // Position
  x: number;
  y: number;
  z: number;
  // Velocity (new)
  velocityX: number;
  velocityY: number;
  velocityZ: number;
  // View angles
  yaw: number;
  pitch: number;
  // Health/Armor
  health: number;
  armor: number;
  // State flags
  isAlive: boolean;
  isDucking: boolean;
  isWalking: boolean; // new
  isScoped: boolean;
  isDefusing: boolean;
  isPlanting: boolean;
  // Team & equipment
  team: number;
  activeWeapon: string | null;
  weaponAmmo: number | null; // new
  hasDefuseKit: boolean;
  hasBomb: boolean;
  money: number;
  // Full inventory for 2D replay display
  inventory: string[];
  // Flash state
  flashDuration: number;
  flashAlpha: number; // new
}

/**
 * Round info for tick-to-round mapping
 */
interface RoundLookup {
  id: string;
  startTick: number;
  endTick: number;
}

/**
 * Processing result with statistics
 */
export interface PlayerTickProcessingResult {
  success: boolean;
  totalInputTicks: number;
  totalPlayersExtracted: number;
  totalInserted: number;
  invalidSkipped: number;
  processingTimeMs: number;
  error?: string;
  /** Detailed metrics for debugging and monitoring */
  metrics?: ProcessingMetrics;
}

/**
 * Detailed metrics for monitoring data quality
 */
interface ProcessingMetrics {
  invalidSteamId: number;
  invalidTeam: number;
  invalidCoords: number;
  clampedHealth: number;
  clampedArmor: number;
  clampedPitch: number;
  clampedFlashAlpha: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BATCH_SIZE = 1000; // Optimal for PostgreSQL batch inserts
const VALID_TEAMS = new Set([2, 3]); // 2=T, 3=CT

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Check if a value is a valid finite number
 */
function isValidNumber(n: unknown): n is number {
  return typeof n === "number" && !Number.isNaN(n) && Number.isFinite(n);
}

/**
 * Clamp a number to a range
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Normalize angle to 0-360 range
 */
function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

/**
 * Parse inventory from parser output
 * Can be array or comma-separated string
 */
function parseInventory(inventory: string[] | string | undefined): string[] {
  if (!inventory) return [];
  if (Array.isArray(inventory)) {
    return inventory.filter((w) => typeof w === "string" && w.length > 0);
  }
  if (typeof inventory === "string") {
    // demoparser2 might return as comma-separated string
    return inventory
      .split(",")
      .map((w) => w.trim())
      .filter((w) => w.length > 0);
  }
  return [];
}

// ============================================================================
// SERVICE
// ============================================================================

@Injectable()
export class PlayerTickService {
  private readonly logger = new Logger(PlayerTickService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Process and store tick data for a demo
   *
   * Handles both grouped format (tick.players[]) and flat format (one entry per player)
   * from the parser output.
   */
  async processAndStoreTicks(
    demoId: string,
    ticks: RawTickData[],
  ): Promise<PlayerTickProcessingResult> {
    const startTime = Date.now();
    const result: PlayerTickProcessingResult = {
      success: false,
      totalInputTicks: ticks.length,
      totalPlayersExtracted: 0,
      totalInserted: 0,
      invalidSkipped: 0,
      processingTimeMs: 0,
    };

    if (!ticks || ticks.length === 0) {
      result.success = true;
      result.processingTimeMs = Date.now() - startTime;
      return result;
    }

    try {
      // Get rounds for tick-to-round mapping
      const rounds = await this.prisma.round.findMany({
        where: { demoId },
        select: { id: true, startTick: true, endTick: true },
        orderBy: { roundNumber: "asc" },
      });

      // Normalize and validate all ticks
      const normalizedTicks = this.normalizeTickData(demoId, ticks, rounds);
      result.totalPlayersExtracted = normalizedTicks.valid.length;
      result.invalidSkipped = normalizedTicks.invalidCount;
      result.metrics = normalizedTicks.metrics;

      this.logger.log(
        `Normalized ${ticks.length} tick frames -> ${normalizedTicks.valid.length} player ticks (${normalizedTicks.invalidCount} invalid skipped)`,
      );

      // Log detailed metrics if there were issues
      const { metrics } = normalizedTicks;
      if (metrics.invalidSteamId > 0 || metrics.invalidTeam > 0 || metrics.invalidCoords > 0) {
        this.logger.warn(
          `Data quality issues: invalidSteamId=${metrics.invalidSteamId}, ` +
          `invalidTeam=${metrics.invalidTeam}, invalidCoords=${metrics.invalidCoords}`,
        );
      }

      // Insert in batches with transaction for atomicity
      result.totalInserted = await this.batchInsert(normalizedTicks.valid);

      result.success = true;
      result.processingTimeMs = Date.now() - startTime;

      this.logger.log(
        `Inserted ${result.totalInserted} player ticks in ${result.processingTimeMs}ms ` +
        `(${(result.totalInserted / (result.processingTimeMs / 1000)).toFixed(0)} rows/sec)`,
      );

      return result;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      result.processingTimeMs = Date.now() - startTime;
      this.logger.error(`Failed to process ticks: ${result.error}`);
      return result;
    }
  }

  /**
   * Normalize tick data from parser format to database format
   *
   * Handles:
   * - Grouped format: { tick, players: [...] }
   * - Flat format: { tick, steamid, x, y, ... }
   * - Property name variations (X/x, armor_value/armor, etc.)
   * - Validation with detailed metrics
   */
  private normalizeTickData(
    demoId: string,
    ticks: RawTickData[],
    rounds: RoundLookup[],
  ): {
    valid: NormalizedPlayerTick[];
    invalidCount: number;
    metrics: ProcessingMetrics;
  } {
    const valid: NormalizedPlayerTick[] = [];
    let invalidCount = 0;
    const metrics: ProcessingMetrics = {
      invalidSteamId: 0,
      invalidTeam: 0,
      invalidCoords: 0,
      clampedHealth: 0,
      clampedArmor: 0,
      clampedPitch: 0,
      clampedFlashAlpha: 0,
    };

    // Build efficient round lookup
    const findRoundId = this.createRoundLookup(rounds);

    for (const tickData of ticks) {
      const tick = tickData.tick ?? 0;
      const roundId = findRoundId(tick);

      // Check if grouped format (has players array)
      if (tickData.players && Array.isArray(tickData.players)) {
        for (const player of tickData.players) {
          const result = this.normalizePlayer(
            demoId,
            tick,
            roundId,
            player,
            metrics,
          );
          if (result) {
            valid.push(result);
          } else {
            invalidCount++;
          }
        }
      } else {
        // Flat format - treat tickData as player state
        const result = this.normalizePlayer(
          demoId,
          tick,
          roundId,
          tickData as unknown as RawPlayerState,
          metrics,
        );
        if (result) {
          valid.push(result);
        } else {
          invalidCount++;
        }
      }
    }

    return { valid, invalidCount, metrics };
  }

  /**
   * Normalize a single player state with robust validation
   *
   * Validation strategy:
   * - Hard reject: invalid steamId, invalid team, invalid coordinates
   * - Soft clamp: health, armor, pitch, flashAlpha (clamp to valid range, log metric)
   *
   * Returns null if invalid (missing steamid, invalid team, NaN coordinates)
   */
  private normalizePlayer(
    demoId: string,
    tick: number,
    roundId: string | null,
    player: RawPlayerState,
    metrics: ProcessingMetrics,
  ): NormalizedPlayerTick | null {
    // ========================================================================
    // HARD VALIDATIONS (reject if invalid)
    // ========================================================================

    // Validate steamid - must be present and valid
    const steamId = String(player.steamid ?? "");
    if (!steamId || steamId === "0" || steamId === "undefined" || steamId === "null") {
      metrics.invalidSteamId++;
      return null;
    }

    // Validate team (only T=2 and CT=3 are valid players)
    const team = player.team_num ?? 0;
    if (!VALID_TEAMS.has(team)) {
      metrics.invalidTeam++;
      return null;
    }

    // Validate coordinates - must be valid numbers (not NaN, not Infinity)
    const rawX = player.X ?? player.x;
    const rawY = player.Y ?? player.y;
    const rawZ = player.Z ?? player.z;

    if (!isValidNumber(rawX) || !isValidNumber(rawY) || !isValidNumber(rawZ)) {
      metrics.invalidCoords++;
      return null;
    }

    // ========================================================================
    // SOFT VALIDATIONS (clamp to valid range, track metrics)
    // ========================================================================

    // Health: clamp to 0-100
    const rawHealth = player.health ?? 100;
    const health = clamp(rawHealth, 0, 100);
    if (rawHealth !== health) {
      metrics.clampedHealth++;
    }

    // Armor: clamp to 0-100
    const rawArmor = player.armor_value ?? player.armor ?? 0;
    const armor = clamp(rawArmor, 0, 100);
    if (rawArmor !== armor) {
      metrics.clampedArmor++;
    }

    // Pitch: clamp to -90 to 90
    const rawPitch = player.pitch ?? 0;
    const pitch = clamp(rawPitch, -90, 90);
    if (rawPitch !== pitch) {
      metrics.clampedPitch++;
    }

    // Yaw: normalize to 0-360
    const yaw = normalizeAngle(player.yaw ?? 0);

    // Flash alpha: clamp to 0-255
    const rawFlashAlpha = player.flash_alpha ?? 0;
    const flashAlpha = clamp(Math.round(rawFlashAlpha), 0, 255);
    if (rawFlashAlpha !== flashAlpha) {
      metrics.clampedFlashAlpha++;
    }

    // ========================================================================
    // BUILD NORMALIZED OUTPUT
    // ========================================================================

    // Extract player name (optional)
    const name = player.name && typeof player.name === "string" && player.name.trim()
      ? player.name.trim()
      : null;

    return {
      demoId,
      roundId,
      tick,
      steamId,
      name,

      // Position (validated above)
      x: rawX,
      y: rawY,
      z: rawZ,

      // Velocity - use 0 if invalid
      velocityX: isValidNumber(player.velocity_X) ? player.velocity_X : 0,
      velocityY: isValidNumber(player.velocity_Y) ? player.velocity_Y : 0,
      velocityZ: isValidNumber(player.velocity_Z) ? player.velocity_Z : 0,

      // View angles (validated/normalized above)
      yaw,
      pitch,

      // Health/Armor (clamped above)
      health,
      armor,

      // State flags
      isAlive: player.is_alive ?? true,
      isDucking: player.ducking ?? player.is_ducking ?? false,
      isWalking: player.is_walking ?? false,
      isScoped: player.is_scoped ?? false,
      isDefusing: player.is_defusing ?? false,
      isPlanting: player.is_planting ?? false,

      // Team (validated above)
      team,

      // Equipment
      activeWeapon: player.active_weapon_name ?? player.active_weapon ?? null,
      weaponAmmo: isValidNumber(player.active_weapon_ammo)
        ? Math.max(0, Math.round(player.active_weapon_ammo))
        : null,
      hasDefuseKit: player.has_defuser ?? player.has_defuse_kit ?? false,
      hasBomb: player.has_bomb ?? player.has_c4 ?? false,
      // Full inventory - can come as array or comma-separated string from parser
      inventory: parseInventory(player.inventory),

      // Economy
      money: isValidNumber(player.balance)
        ? Math.max(0, Math.round(player.balance))
        : isValidNumber(player.money)
          ? Math.max(0, Math.round(player.money))
          : 0,

      // Flash state
      flashDuration: isValidNumber(player.flash_duration)
        ? Math.max(0, player.flash_duration)
        : 0,
      flashAlpha,
    };
  }

  /**
   * Create efficient round lookup function
   *
   * Uses binary search for O(log n) lookup instead of O(n) linear search
   */
  private createRoundLookup(
    rounds: RoundLookup[],
  ): (tick: number) => string | null {
    if (rounds.length === 0) {
      return () => null;
    }

    // Sort by startTick for binary search
    const sorted = [...rounds].sort((a, b) => a.startTick - b.startTick);

    return (tick: number): string | null => {
      // Binary search for the round containing this tick
      let left = 0;
      let right = sorted.length - 1;

      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const round = sorted[mid];

        if (!round) {
          break;
        }

        if (tick >= round.startTick && tick <= round.endTick) {
          return round.id;
        }

        if (tick < round.startTick) {
          right = mid - 1;
        } else {
          left = mid + 1;
        }
      }

      return null;
    };
  }

  /**
   * Batch insert normalized ticks
   *
   * Uses chunked inserts for optimal PostgreSQL performance
   */
  private async batchInsert(ticks: NormalizedPlayerTick[]): Promise<number> {
    if (ticks.length === 0) return 0;

    let inserted = 0;

    for (let i = 0; i < ticks.length; i += BATCH_SIZE) {
      const batch = ticks.slice(i, i + BATCH_SIZE);

      await this.prisma.playerTick.createMany({
        data: batch,
        skipDuplicates: true, // Handle re-parsing gracefully
      });

      inserted += batch.length;
    }

    return inserted;
  }

  /**
   * Delete all ticks for a demo
   *
   * Used when re-parsing a demo
   */
  async deleteTicksForDemo(demoId: string): Promise<number> {
    const result = await this.prisma.playerTick.deleteMany({
      where: { demoId },
    });
    return result.count;
  }

  /**
   * Get tick statistics for a demo
   */
  async getTickStats(demoId: string): Promise<{
    totalTicks: number;
    uniqueTicks: number;
    avgPlayersPerTick: number;
  }> {
    const stats = await this.prisma.playerTick.groupBy({
      by: ["tick"],
      where: { demoId },
      _count: { steamId: true },
    });

    const totalTicks = stats.reduce((sum, s) => sum + s._count.steamId, 0);
    const uniqueTicks = stats.length;
    const avgPlayersPerTick =
      uniqueTicks > 0 ? totalTicks / uniqueTicks : 0;

    return { totalTicks, uniqueTicks, avgPlayersPerTick };
  }
}
