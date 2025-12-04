/**
 * Rating Calculator - HLTV Rating 2.0 implementation
 *
 * This is the industry standard rating system for Counter-Strike.
 *
 * HLTV Rating 2.0 Formula:
 * Rating = 0.0073*KAST + 0.3591*KPR - 0.5329*DPR + 0.2372*Impact + 0.0032*ADR + 0.1587
 *
 * Components:
 * - KAST: Kill/Assist/Survived/Traded percentage (0-100)
 * - KPR: Kills per round
 * - DPR: Deaths per round
 * - Impact: Impact rating (~1.0 average)
 * - ADR: Average damage per round
 *
 * Benchmarks:
 * - Average = 1.00
 * - Good = 1.10+
 * - Excellent = 1.15+
 * - Elite = 1.20+
 * - GOAT level = 1.30+
 *
 * Reference: https://www.hltv.org/news/20695/introducing-rating-20
 *
 * @module analysis/calculators/rating
 */

import type { KillInput, RoundPlayerStatsInput } from "../types/inputs.types";
import type {
  HLTVRating2,
  RatingComponents,
  RatingContributions,
  RatingBenchmarks,
} from "../types/rating.types";
import {
  HLTV_RATING_COEFFICIENTS,
  RATING_BENCHMARKS,
} from "../types/constants";
import { calculateKAST, type KASTCalculationInput } from "./kast.calculator";
import {
  calculateImpact,
  type ImpactCalculationInput,
} from "./impact.calculator";
import { calculateCombatMetrics } from "./combat.calculator";

/**
 * Input required for full Rating calculation
 */
export interface RatingCalculationInput {
  /** Player's Steam ID */
  readonly steamId: string;

  /** Per-round stats for the player */
  readonly roundStats: readonly RoundPlayerStatsInput[];

  /** All kills in the match (for KAST trade detection and impact) */
  readonly allKills: readonly KillInput[];

  /** Total rounds in the match */
  readonly totalRounds: number;

  /** Optional: Demo tick rate (default 64) */
  readonly tickRate?: number;

  /** Optional: Reference skill level for benchmarking */
  readonly skillLevel?: "faceit_10" | "faceit_8_9" | "faceit_5_7" | "faceit_1_4" | "pro";
}

/**
 * Calculate HLTV Rating 2.0 for a player
 *
 * This is the main entry point for rating calculation.
 * It orchestrates all sub-calculators and combines results.
 *
 * @param input - Player data and match context
 * @returns Complete HLTV Rating 2.0 with all components
 *
 * @example
 * ```typescript
 * const rating = calculateRating({
 *   steamId: "76561198...",
 *   roundStats: playerRoundStats,
 *   allKills: matchKills,
 *   totalRounds: 30,
 * });
 * console.log(`Rating: ${rating.rating}`);
 * ```
 */
export function calculateRating(input: RatingCalculationInput): HLTVRating2 {
  const {
    steamId,
    roundStats,
    allKills,
    totalRounds,
    tickRate = 64,
    skillLevel,
  } = input;

  if (roundStats.length === 0 || totalRounds === 0) {
    return createEmptyRating();
  }

  // Calculate KAST
  const kastInput: KASTCalculationInput = {
    steamId,
    roundStats,
    allKills,
    tickRate,
  };
  const kastMetrics = calculateKAST(kastInput);

  // Calculate Impact
  const impactInput: ImpactCalculationInput = {
    steamId,
    roundStats,
    allKills,
    totalRounds,
  };
  const impactMetrics = calculateImpact(impactInput);

  // Calculate Combat metrics for KPR, DPR, ADR
  const combatMetrics = calculateCombatMetrics(roundStats);

  // Build rating components
  const components: RatingComponents = {
    kast: kastMetrics.kast,
    kpr: combatMetrics.kpr,
    dpr: combatMetrics.dpr,
    impact: impactMetrics.impact,
    adr: combatMetrics.adr,
  };

  // Calculate individual contributions
  const contributions = calculateContributions(components);

  // Sum all contributions for final rating
  const rating =
    contributions.kastContribution +
    contributions.kprContribution +
    contributions.dprContribution +
    contributions.impactContribution +
    contributions.adrContribution +
    contributions.constant;

  // Get benchmarks based on skill level
  const benchmarks = calculateBenchmarks(rating, skillLevel);

  return {
    rating: round3(rating),
    components,
    contributions,
    benchmarks,
  };
}

/**
 * Calculate the contribution of each component to the rating
 *
 * This shows exactly how much each metric affects the final rating.
 * Sum of all contributions = final rating.
 *
 * @param components - Rating input components
 * @returns Weighted contributions
 */
export function calculateContributions(
  components: RatingComponents
): RatingContributions {
  return {
    kastContribution: round4(
      HLTV_RATING_COEFFICIENTS.KAST * components.kast
    ),
    kprContribution: round4(
      HLTV_RATING_COEFFICIENTS.KPR * components.kpr
    ),
    dprContribution: round4(
      HLTV_RATING_COEFFICIENTS.DPR * components.dpr // Note: coefficient is negative
    ),
    impactContribution: round4(
      HLTV_RATING_COEFFICIENTS.IMPACT * components.impact
    ),
    adrContribution: round4(
      HLTV_RATING_COEFFICIENTS.ADR * components.adr
    ),
    constant: HLTV_RATING_COEFFICIENTS.CONSTANT,
  };
}

/**
 * Calculate rating benchmarks and label
 *
 * @param rating - Calculated rating
 * @param skillLevel - Reference skill level
 * @returns Benchmark comparison
 */
function calculateBenchmarks(
  rating: number,
  skillLevel?: string
): RatingBenchmarks {
  // Get expected rating for skill level
  let averageForRank: number | null = null;
  if (skillLevel) {
    switch (skillLevel) {
      case "pro":
        averageForRank = RATING_BENCHMARKS.AVERAGE_PRO;
        break;
      case "faceit_10":
        averageForRank = RATING_BENCHMARKS.FACEIT_10;
        break;
      case "faceit_8_9":
        averageForRank = RATING_BENCHMARKS.FACEIT_8_9;
        break;
      case "faceit_5_7":
        averageForRank = RATING_BENCHMARKS.FACEIT_5_7;
        break;
      case "faceit_1_4":
        averageForRank = RATING_BENCHMARKS.FACEIT_1_4;
        break;
    }
  }

  // Calculate percentile (simplified - would need population data for accuracy)
  const percentile = estimatePercentile(rating);

  // Get descriptive label
  const label = getRatingLabel(rating);

  return {
    averageForRank,
    percentile,
    label,
  };
}

/**
 * Get a descriptive label for a rating
 *
 * @param rating - HLTV Rating 2.0 value
 * @returns Descriptive label
 */
export function getRatingLabel(rating: number): string {
  if (rating >= 1.30) return "GOAT Level";
  if (rating >= 1.25) return "Elite";
  if (rating >= 1.20) return "Excellent";
  if (rating >= 1.15) return "Very Good";
  if (rating >= 1.10) return "Good";
  if (rating >= 1.05) return "Above Average";
  if (rating >= 0.95) return "Average";
  if (rating >= 0.90) return "Below Average";
  if (rating >= 0.85) return "Poor";
  return "Very Poor";
}

/**
 * Estimate percentile based on rating
 *
 * This is a rough estimate based on typical distributions.
 * For accurate percentiles, you'd need actual population data.
 *
 * @param rating - HLTV Rating 2.0 value
 * @returns Estimated percentile (0-100)
 */
function estimatePercentile(rating: number): number {
  // Approximate distribution based on typical CS2 population
  // Rating distribution is roughly normal centered at 1.0
  if (rating >= 1.40) return 99;
  if (rating >= 1.30) return 98;
  if (rating >= 1.25) return 95;
  if (rating >= 1.20) return 90;
  if (rating >= 1.15) return 85;
  if (rating >= 1.10) return 75;
  if (rating >= 1.05) return 65;
  if (rating >= 1.00) return 50;
  if (rating >= 0.95) return 40;
  if (rating >= 0.90) return 30;
  if (rating >= 0.85) return 20;
  if (rating >= 0.80) return 10;
  return 5;
}

/**
 * Calculate rating from pre-computed components
 *
 * Use this when you've already calculated KAST, Impact, etc.
 * Avoids redundant calculations.
 *
 * @param components - Pre-calculated components
 * @param skillLevel - Optional skill level for benchmarks
 * @returns HLTV Rating 2.0
 */
export function calculateRatingFromComponents(
  components: RatingComponents,
  skillLevel?: string
): HLTVRating2 {
  const contributions = calculateContributions(components);

  const rating =
    contributions.kastContribution +
    contributions.kprContribution +
    contributions.dprContribution +
    contributions.impactContribution +
    contributions.adrContribution +
    contributions.constant;

  const benchmarks = calculateBenchmarks(rating, skillLevel);

  return {
    rating: round3(rating),
    components,
    contributions,
    benchmarks,
  };
}

/**
 * Simulate rating with modified components
 *
 * Useful for "what-if" analysis:
 * "What would my rating be if I improved my ADR?"
 *
 * @param baseComponents - Current components
 * @param modifications - Values to modify
 * @returns New rating with modifications
 */
export function simulateRating(
  baseComponents: RatingComponents,
  modifications: Partial<RatingComponents>
): { newRating: number; change: number; originalRating: number } {
  const originalRating = calculateRatingFromComponents(baseComponents).rating;

  const modifiedComponents: RatingComponents = {
    ...baseComponents,
    ...modifications,
  };

  const newRating = calculateRatingFromComponents(modifiedComponents).rating;

  return {
    newRating: round3(newRating),
    change: round3(newRating - originalRating),
    originalRating: round3(originalRating),
  };
}

/**
 * Analyze which component has the most room for improvement
 *
 * @param components - Current components
 * @param targetRating - Desired rating
 * @returns Analysis of improvement potential
 */
export function analyzeImprovementPotential(
  components: RatingComponents,
  targetRating: number = 1.1
): {
  component: string;
  currentValue: number;
  targetValue: number;
  improvementNeeded: number;
  feasibility: "easy" | "moderate" | "hard";
}[] {
  const currentRating = calculateRatingFromComponents(components).rating;
  const ratingGap = targetRating - currentRating;

  if (ratingGap <= 0) {
    return [];
  }

  // Analyze each component
  const improvements = [
    {
      component: "KAST",
      currentValue: components.kast,
      coefficient: HLTV_RATING_COEFFICIENTS.KAST,
      max: 100,
    },
    {
      component: "KPR",
      currentValue: components.kpr,
      coefficient: HLTV_RATING_COEFFICIENTS.KPR,
      max: 2.0, // Practical maximum
    },
    {
      component: "ADR",
      currentValue: components.adr,
      coefficient: HLTV_RATING_COEFFICIENTS.ADR,
      max: 150, // Practical maximum
    },
    {
      component: "Impact",
      currentValue: components.impact,
      coefficient: HLTV_RATING_COEFFICIENTS.IMPACT,
      max: 1.5, // Practical maximum
    },
  ];

  return improvements.map((imp) => {
    // How much would this component need to improve to close the rating gap?
    const targetChange = ratingGap / imp.coefficient;
    const targetValue = Math.min(imp.currentValue + targetChange, imp.max);
    const improvementNeeded = targetValue - imp.currentValue;
    const improvementPercent =
      (improvementNeeded / imp.currentValue) * 100;

    // Assess feasibility
    let feasibility: "easy" | "moderate" | "hard";
    if (improvementPercent < 10) {
      feasibility = "easy";
    } else if (improvementPercent < 25) {
      feasibility = "moderate";
    } else {
      feasibility = "hard";
    }

    return {
      component: imp.component,
      currentValue: round2(imp.currentValue),
      targetValue: round2(targetValue),
      improvementNeeded: round2(improvementNeeded),
      feasibility,
    };
  });
}

/**
 * Calculate team average rating
 *
 * @param playerRatings - Array of player ratings
 * @returns Team average rating
 */
export function calculateTeamRating(playerRatings: readonly HLTVRating2[]): number {
  if (playerRatings.length === 0) return 0;

  const totalRating = playerRatings.reduce((sum, p) => sum + p.rating, 0);
  return round3(totalRating / playerRatings.length);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create empty rating
 */
function createEmptyRating(): HLTVRating2 {
  return {
    rating: 0,
    components: {
      kast: 0,
      kpr: 0,
      dpr: 0,
      impact: 0,
      adr: 0,
    },
    contributions: {
      kastContribution: 0,
      kprContribution: 0,
      dprContribution: 0,
      impactContribution: 0,
      adrContribution: 0,
      constant: HLTV_RATING_COEFFICIENTS.CONSTANT,
    },
    benchmarks: {
      averageForRank: null,
      percentile: null,
      label: "N/A",
    },
  };
}

/**
 * Round to 2 decimal places
 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Round to 3 decimal places
 */
function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Round to 4 decimal places
 */
function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
