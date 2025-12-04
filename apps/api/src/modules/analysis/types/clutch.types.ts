/**
 * Clutch Types - 1vX situation analysis
 *
 * A clutch is when a player is the last alive on their team
 * facing one or more opponents.
 *
 * Clutch ability is a sign of mental strength and individual skill.
 *
 * @module analysis/types/clutch
 */

/**
 * Clutch Metrics
 *
 * Statistics for 1vX situations.
 *
 * Clutch success rates by situation (pro averages):
 * - 1v1: ~50%
 * - 1v2: ~25%
 * - 1v3: ~10%
 * - 1v4: ~5%
 * - 1v5: ~2%
 */
export interface ClutchMetrics {
  /** Total clutch situations */
  readonly total: number;

  /** Clutches won */
  readonly won: number;

  /** Clutches lost */
  readonly lost: number;

  /**
   * Overall clutch success rate (0-100)
   * Formula: (won / total) * 100
   */
  readonly successRate: number;

  /** Kills made during clutch situations */
  readonly clutchKills: number;

  /** Breakdown by situation type (1v1, 1v2, etc.) */
  readonly breakdown: ClutchBreakdown;

  /** Detailed clutch events */
  readonly clutches: readonly ClutchEvent[];

  /** Side-specific clutch stats */
  readonly bySide: ClutchBySide;
}

/**
 * Clutch breakdown by X in 1vX
 */
export interface ClutchBreakdown {
  /** 1v1 situations */
  readonly "1v1": ClutchSituation;

  /** 1v2 situations */
  readonly "1v2": ClutchSituation;

  /** 1v3 situations */
  readonly "1v3": ClutchSituation;

  /** 1v4 situations */
  readonly "1v4": ClutchSituation;

  /** 1v5 situations */
  readonly "1v5": ClutchSituation;
}

/**
 * Stats for a specific clutch situation type
 */
export interface ClutchSituation {
  /** Number of attempts in this situation */
  readonly attempts: number;

  /** Number of wins in this situation */
  readonly wins: number;

  /** Success rate for this situation (0-100) */
  readonly successRate: number;

  /** Expected success rate (based on pro data) */
  readonly expectedRate: number;

  /** Performance vs expected (positive = better than expected) */
  readonly vsExpected: number;
}

/**
 * Individual clutch event
 */
export interface ClutchEvent {
  /** Round number */
  readonly roundNumber: number;

  /** Player steam ID */
  readonly playerSteamId: string;

  /** Player name */
  readonly playerName: string;

  /** Player's team */
  readonly team: number;

  /** Number of opponents at clutch start */
  readonly opponentsAtStart: number;

  /** Whether the clutch was won */
  readonly won: boolean;

  /** Kills made during the clutch */
  readonly killsMade: number;

  /** Tick when clutch situation started */
  readonly startTick: number;

  /** Tick when clutch ended */
  readonly endTick: number;

  /** Duration of clutch in seconds */
  readonly durationSeconds: number;

  /** How the clutch ended */
  readonly endReason: ClutchEndReason;

  /** Enemies killed during the clutch */
  readonly enemiesKilled: readonly ClutchKill[];

  /** Weapons used during clutch */
  readonly weaponsUsed: readonly string[];
}

/**
 * How a clutch situation ended
 */
export type ClutchEndReason =
  | "won_elimination" // Killed all enemies
  | "won_bomb_explode" // Bomb exploded (T-side win)
  | "won_bomb_defuse" // Bomb defused (CT-side win)
  | "won_time" // Time ran out (CT-side win)
  | "lost_death" // Player died
  | "lost_bomb_explode" // Bomb exploded (CT-side loss)
  | "lost_bomb_defuse" // Bomb defused (T-side loss)
  | "lost_time"; // Time ran out (T-side loss)

/**
 * Kill made during a clutch
 */
export interface ClutchKill {
  /** Tick of the kill */
  readonly tick: number;

  /** Victim steam ID */
  readonly victimSteamId: string;

  /** Victim name */
  readonly victimName: string;

  /** Weapon used */
  readonly weapon: string;

  /** Was it a headshot */
  readonly headshot: boolean;

  /** Remaining opponents after this kill */
  readonly remainingOpponents: number;
}

/**
 * Clutch stats by side
 */
export interface ClutchBySide {
  /** CT-side clutches */
  readonly ct: SideClutchStats;

  /** T-side clutches */
  readonly t: SideClutchStats;
}

/**
 * Clutch stats for one side
 */
export interface SideClutchStats {
  readonly total: number;
  readonly won: number;
  readonly successRate: number;
  readonly clutchKills: number;
}

/**
 * Team clutch statistics
 */
export interface TeamClutchMetrics {
  /** Team number */
  readonly teamNumber: number;

  /** Team name */
  readonly teamName: string;

  /** Total clutch situations for the team */
  readonly totalSituations: number;

  /** Total clutches won by the team */
  readonly won: number;

  /** Team clutch success rate */
  readonly successRate: number;

  /** Best clutcher on the team */
  readonly topClutcher: {
    readonly steamId: string;
    readonly name: string;
    readonly won: number;
    readonly total: number;
    readonly successRate: number;
  };

  /** All players ranked by clutch performance */
  readonly playerRankings: readonly PlayerClutchRanking[];
}

/**
 * Player clutch ranking
 */
export interface PlayerClutchRanking {
  readonly steamId: string;
  readonly name: string;
  readonly total: number;
  readonly won: number;
  readonly successRate: number;
  readonly clutchKills: number;
}

/**
 * Expected clutch success rates
 *
 * Based on professional CS data.
 * Used for comparing player performance to expected values.
 */
export const EXPECTED_CLUTCH_RATES = {
  "1v1": 0.5,
  "1v2": 0.25,
  "1v3": 0.1,
  "1v4": 0.05,
  "1v5": 0.02,
} as const;
