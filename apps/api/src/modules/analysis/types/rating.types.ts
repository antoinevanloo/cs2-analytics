/**
 * Rating Types - HLTV Rating 2.0, KAST, and Impact
 *
 * These are the most important metrics for player evaluation.
 * All formulas are documented for transparency and explainability.
 *
 * @module analysis/types/rating
 */

/**
 * KAST Metrics
 *
 * Kill/Assist/Survived/Traded - percentage of rounds with positive contribution.
 *
 * Formula: (Rounds with K or A or S or T) / Total Rounds * 100
 *
 * This is one of the most important metrics as it shows consistency.
 * - Pro players typically have KAST > 70%
 * - Elite players often exceed 75%
 * - Below 65% indicates inconsistency
 *
 * A round counts as KAST-positive if ANY of the following is true:
 * - Player got at least one kill
 * - Player got at least one assist
 * - Player survived the round
 * - Player was traded (teammate killed the player's killer within threshold)
 */
export interface KASTMetrics {
  /**
   * KAST percentage (0-100)
   * Main metric - percentage of rounds with positive contribution
   */
  readonly kast: number;

  /** Number of rounds where player got at least one kill */
  readonly roundsWithKill: number;

  /** Number of rounds where player got at least one assist */
  readonly roundsWithAssist: number;

  /** Number of rounds where player survived */
  readonly roundsWithSurvival: number;

  /**
   * Number of rounds where player was traded
   * A trade occurs when a teammate kills the enemy who killed the player
   * within the trade threshold (typically 5 seconds)
   */
  readonly roundsWithTrade: number;

  /** Total rounds analyzed */
  readonly totalRounds: number;

  /**
   * Detailed breakdown for explainability
   * Lists which rounds contributed to each category
   */
  readonly breakdown: KASTBreakdown;
}

/**
 * KAST breakdown by category
 * Allows users to see exactly which rounds contributed to KAST
 */
export interface KASTBreakdown {
  /** Round numbers where player got a kill */
  readonly killRounds: readonly number[];

  /** Round numbers where player got an assist */
  readonly assistRounds: readonly number[];

  /** Round numbers where player survived */
  readonly survivalRounds: readonly number[];

  /** Round numbers where player was traded */
  readonly tradedRounds: readonly number[];

  /**
   * Rounds that were NOT KAST-positive
   * These are rounds where the player had zero impact
   */
  readonly zeroImpactRounds: readonly number[];
}

/**
 * Impact Metrics
 *
 * Measures the impact of a player's actions on round outcomes.
 *
 * Base Formula: Impact = 2.13*KPR + 0.42*APR - 0.41
 *
 * Additional factors:
 * - Multi-kills bonus (2k, 3k, 4k, 5k)
 * - Opening duel performance
 * - Clutch performance
 *
 * Average impact = 1.0
 * Elite players > 1.2
 */
export interface ImpactMetrics {
  /**
   * Overall impact rating
   * Average is ~1.0, elite players exceed 1.2
   */
  readonly impact: number;

  /**
   * Impact from multi-kill rounds
   * Multi-kills are weighted: 2k=0.1, 3k=0.2, 4k=0.35, 5k=0.5
   */
  readonly multiKillImpact: number;

  /**
   * Impact from opening duels
   * Opening wins add impact, opening losses subtract
   */
  readonly openingImpact: number;

  /**
   * Impact from clutch situations
   * Winning clutches adds significant impact
   */
  readonly clutchImpact: number;

  /** Multi-kill statistics */
  readonly multiKills: MultiKillStats;

  /** Opening duel summary */
  readonly openings: OpeningSummary;
}

/**
 * Multi-kill round counts
 */
export interface MultiKillStats {
  /** Rounds with exactly 2 kills */
  readonly twoK: number;

  /** Rounds with exactly 3 kills */
  readonly threeK: number;

  /** Rounds with exactly 4 kills */
  readonly fourK: number;

  /** Rounds with 5 kills (ace) */
  readonly fiveK: number;

  /** Total multi-kill rounds */
  readonly total: number;
}

/**
 * Opening duel summary for impact calculation
 */
export interface OpeningSummary {
  /** Total opening duels participated in */
  readonly attempts: number;

  /** Opening duels won (got the first kill) */
  readonly wins: number;

  /** Opening duels lost (died first) */
  readonly losses: number;

  /** Opening duel win rate (0-100) */
  readonly winRate: number;
}

/**
 * HLTV Rating 2.0
 *
 * The industry standard for CS player evaluation.
 *
 * Formula:
 * Rating = 0.0073*KAST + 0.3591*KPR - 0.5329*DPR + 0.2372*Impact + 0.0032*ADR + 0.1587
 *
 * Where:
 * - KAST: Kill/Assist/Survived/Traded percentage (0-100)
 * - KPR: Kills per round
 * - DPR: Deaths per round
 * - Impact: Impact rating
 * - ADR: Average Damage per Round
 *
 * Average rating = 1.0
 * Top 20 players typically > 1.15
 * Elite players > 1.20
 *
 * Reference: https://www.hltv.org/news/20695/introducing-rating-20
 */
export interface HLTVRating2 {
  /**
   * Final HLTV 2.0 rating
   * Average = 1.0, elite > 1.2
   */
  readonly rating: number;

  /**
   * All input components for transparency
   * Users can verify the calculation
   */
  readonly components: RatingComponents;

  /**
   * Individual contributions to the final rating
   * Shows how much each component affects the rating
   */
  readonly contributions: RatingContributions;

  /**
   * Comparison benchmarks
   * Contextualizes the rating against population
   */
  readonly benchmarks: RatingBenchmarks;
}

/**
 * Input components for rating calculation
 */
export interface RatingComponents {
  /** KAST percentage (0-100) */
  readonly kast: number;

  /** Kills per round */
  readonly kpr: number;

  /** Deaths per round */
  readonly dpr: number;

  /** Impact rating */
  readonly impact: number;

  /** Average damage per round */
  readonly adr: number;
}

/**
 * Weighted contributions to final rating
 *
 * Each value shows how much that component contributed to the final rating.
 * Sum of all contributions = final rating
 */
export interface RatingContributions {
  /** KAST contribution: 0.0073 * KAST */
  readonly kastContribution: number;

  /** KPR contribution: 0.3591 * KPR */
  readonly kprContribution: number;

  /** DPR contribution: -0.5329 * DPR (negative impact) */
  readonly dprContribution: number;

  /** Impact contribution: 0.2372 * Impact */
  readonly impactContribution: number;

  /** ADR contribution: 0.0032 * ADR */
  readonly adrContribution: number;

  /** Constant term: 0.1587 */
  readonly constant: number;
}

/**
 * Rating benchmarks for context
 */
export interface RatingBenchmarks {
  /**
   * Average rating for players at similar skill level
   * Based on FACEIT level, rank, or league
   */
  readonly averageForRank: number | null;

  /**
   * Percentile among all analyzed players
   * e.g., 90 = better than 90% of players
   */
  readonly percentile: number | null;

  /**
   * Descriptive label for the rating
   * e.g., "Elite", "Above Average", "Average", "Below Average"
   */
  readonly label: string;
}

/**
 * Rating trend over time
 *
 * Used for tracking player improvement or decline
 */
export interface RatingTrend {
  /** Current rating */
  readonly current: number;

  /** Rating from previous period */
  readonly previous: number;

  /** Change in rating */
  readonly change: number;

  /** Percentage change */
  readonly changePercent: number;

  /** Trend direction */
  readonly trend: "improving" | "stable" | "declining";

  /** Number of matches in current period */
  readonly matchCount: number;
}
