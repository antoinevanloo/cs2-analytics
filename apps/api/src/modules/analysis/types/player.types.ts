/**
 * Player Types - Aggregated player metrics
 *
 * Combines all individual metrics into comprehensive player profiles.
 * Used for match summaries and player comparisons.
 *
 * @module analysis/types/player
 */

import type { HLTVRating2, KASTMetrics, ImpactMetrics } from "./rating.types";
import type { CombatMetrics, ExtendedCombatMetrics } from "./combat.types";
import type { TradeMetrics } from "./trade.types";
import type { OpeningDuelMetrics } from "./opening.types";
import type { ClutchMetrics } from "./clutch.types";
import type { UtilityMetrics } from "./utility.types";
import type { EconomyMetrics } from "./economy.types";

/**
 * Complete player metrics for a match
 *
 * This is the main output type that combines all metrics
 * into a comprehensive player profile for a single match.
 */
export interface PlayerMatchMetrics {
  /** Player identification */
  readonly steamId: string;
  readonly playerName: string;
  readonly team: number; // 2=T, 3=CT at match start
  readonly teamName: string;

  /** HLTV Rating 2.0 - primary performance metric */
  readonly rating: HLTVRating2;

  /** KAST - consistency metric */
  readonly kast: KASTMetrics;

  /** Impact - round influence metric */
  readonly impact: ImpactMetrics;

  /** Combat statistics */
  readonly combat: CombatMetrics;

  /** Trade statistics */
  readonly trades: TradeMetrics;

  /** Opening duel statistics */
  readonly openingDuels: OpeningDuelMetrics;

  /** Clutch statistics */
  readonly clutches: ClutchMetrics;

  /** Utility statistics */
  readonly utility: UtilityMetrics;

  /** Economy statistics */
  readonly economy: EconomyMetrics;

  /** Round-by-round performance */
  readonly roundPerformance: readonly RoundPerformance[];

  /** Analysis metadata */
  readonly metadata: PlayerAnalysisMetadata;
}

/**
 * Per-round performance snapshot
 *
 * Allows for timeline analysis and identifying
 * performance patterns throughout the match.
 */
export interface RoundPerformance {
  /** Round number */
  readonly roundNumber: number;

  /** Side played this round */
  readonly side: "T" | "CT";

  /** Kills this round */
  readonly kills: number;

  /** Deaths this round (0 or 1) */
  readonly deaths: number;

  /** Assists this round */
  readonly assists: number;

  /** Damage dealt this round */
  readonly damage: number;

  /** Did player survive */
  readonly survived: boolean;

  /** Equipment value */
  readonly equipValue: number;

  /** Was the player traded if they died */
  readonly wasTraded: boolean;

  /**
   * Had impact this round
   * True if kill, assist, or clutch attempt
   */
  readonly hadImpact: boolean;

  /** Was this an opening duel round for the player */
  readonly openingDuel: "win" | "loss" | null;

  /** Clutch situation this round */
  readonly clutch: {
    readonly vsOpponents: number;
    readonly won: boolean;
  } | null;

  /** Round result for player's team */
  readonly teamWon: boolean;
}

/**
 * Metadata about the player analysis
 */
export interface PlayerAnalysisMetadata {
  /** Rounds analyzed */
  readonly roundsAnalyzed: number;

  /** Rounds with complete data */
  readonly completeDataRounds: number;

  /** Data quality score (0-100) */
  readonly dataQuality: number;

  /** Any warnings during analysis */
  readonly warnings: readonly string[];

  /** Analysis timestamp */
  readonly analyzedAt: Date;

  /** Analysis version */
  readonly version: string;
}

/**
 * Simplified player summary
 *
 * Used for leaderboards and quick comparisons.
 */
export interface PlayerSummary {
  readonly steamId: string;
  readonly playerName: string;
  readonly team: number;

  /** Key metrics only */
  readonly rating: number;
  readonly kast: number;
  readonly kills: number;
  readonly deaths: number;
  readonly assists: number;
  readonly adr: number;
  readonly hsPercent: number;

  /** Match performance indicators */
  readonly mvp: boolean;
  readonly topFragger: boolean;
  readonly topRating: boolean;
}

/**
 * Player comparison result
 *
 * Compares two players across all metrics.
 */
export interface PlayerComparison {
  readonly player1: PlayerComparisonEntry;
  readonly player2: PlayerComparisonEntry;

  /** Which player is better in each category */
  readonly advantages: ComparisonAdvantages;

  /** Overall winner (or null if tie) */
  readonly overallBetter: string | null;
}

/**
 * Single player entry in a comparison
 */
export interface PlayerComparisonEntry {
  readonly steamId: string;
  readonly playerName: string;
  readonly rating: number;
  readonly kast: number;
  readonly adr: number;
  readonly kd: number;
  readonly impact: number;
  readonly openingWinRate: number;
  readonly clutchSuccessRate: number;
  readonly tradeSuccessRate: number;
}

/**
 * Which player has the advantage in each category
 */
export interface ComparisonAdvantages {
  readonly rating: string | null;
  readonly kast: string | null;
  readonly adr: string | null;
  readonly kd: string | null;
  readonly impact: string | null;
  readonly openings: string | null;
  readonly clutches: string | null;
  readonly trades: string | null;
}

/**
 * Player career/historical metrics
 *
 * Aggregated stats across multiple matches.
 */
export interface PlayerCareerMetrics {
  readonly steamId: string;
  readonly playerName: string;

  /** Total matches analyzed */
  readonly matchesPlayed: number;

  /** Total rounds analyzed */
  readonly roundsPlayed: number;

  /** Average metrics */
  readonly averages: {
    readonly rating: number;
    readonly kast: number;
    readonly adr: number;
    readonly kd: number;
    readonly hsPercent: number;
  };

  /** Best performances */
  readonly peaks: {
    readonly highestRating: number;
    readonly highestKills: number;
    readonly highestAdr: number;
    readonly mostClutches: number;
  };

  /** Per-map breakdown */
  readonly byMap: readonly MapPerformance[];

  /** Recent form (last N matches) */
  readonly recentForm: {
    readonly matches: number;
    readonly avgRating: number;
    readonly trend: "improving" | "stable" | "declining";
  };
}

/**
 * Performance on a specific map
 */
export interface MapPerformance {
  readonly mapName: string;
  readonly matchesPlayed: number;
  readonly avgRating: number;
  readonly avgKast: number;
  readonly avgAdr: number;
  readonly winRate: number;
}

/**
 * Player extended metrics
 *
 * Full detailed breakdown for in-depth analysis.
 */
export interface PlayerExtendedMetrics extends PlayerMatchMetrics {
  /** Extended combat breakdown */
  readonly extendedCombat: ExtendedCombatMetrics;

  /** Per-half performance */
  readonly byHalf: {
    readonly firstHalf: HalfPerformance;
    readonly secondHalf: HalfPerformance;
  };

  /** Momentum analysis */
  readonly momentum: MomentumAnalysis;
}

/**
 * Performance in one half
 */
export interface HalfPerformance {
  readonly side: "T" | "CT";
  readonly roundsPlayed: number;
  readonly kills: number;
  readonly deaths: number;
  readonly adr: number;
  readonly rating: number;
}

/**
 * Momentum analysis
 *
 * Identifies hot/cold streaks in performance.
 */
export interface MomentumAnalysis {
  /** Longest kill streak (consecutive rounds with kills) */
  readonly longestKillStreak: number;

  /** Longest death streak (consecutive deaths) */
  readonly longestDeathStreak: number;

  /** Hot rounds (2+ kills) */
  readonly hotRounds: readonly number[];

  /** Cold rounds (death with 0 impact) */
  readonly coldRounds: readonly number[];

  /** Performance trend through match */
  readonly trend:
    | "started_strong"
    | "finished_strong"
    | "consistent"
    | "inconsistent";
}
