/**
 * Stats Aggregation Calculator - Core statistical functions
 *
 * Pure functions for aggregating numerical data across multiple matches.
 * Handles weighted averages, standard deviations, percentiles, and trends.
 *
 * @module analysis/calculators/aggregation/stats
 */

// =============================================================================
// BASIC STATISTICS
// =============================================================================

/**
 * Calculate arithmetic mean
 */
export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate weighted mean
 * Useful for rating calculations where rounds matter more than matches
 */
export function weightedMean(
  values: readonly number[],
  weights: readonly number[],
): number {
  if (values.length === 0 || values.length !== weights.length) return 0;

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight === 0) return 0;

  const weightedSum = values.reduce(
    (sum, v, i) => sum + v * (weights[i] ?? 0),
    0,
  );
  return weightedSum / totalWeight;
}

/**
 * Calculate standard deviation
 */
export function standardDeviation(values: readonly number[]): number {
  if (values.length < 2) return 0;

  const avg = mean(values);
  const squaredDiffs = values.map((v) => Math.pow(v - avg, 2));
  const variance =
    squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1);

  return Math.sqrt(variance);
}

/**
 * Calculate coefficient of variation (CV)
 * Normalized measure of dispersion
 */
export function coefficientOfVariation(values: readonly number[]): number {
  const avg = mean(values);
  if (avg === 0) return 0;
  return standardDeviation(values) / avg;
}

/**
 * Calculate median
 */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 !== 0) {
    return sorted[mid]!;
  }

  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Calculate percentile value
 * @param values Array of values
 * @param percentile Percentile to calculate (0-100)
 */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  if (p <= 0) return Math.min(...values);
  if (p >= 100) return Math.max(...values);

  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) return sorted[lower]!;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

/**
 * Calculate percentile rank of a value within a dataset
 * Returns 0-100 indicating what percentage of values are below the given value
 */
export function percentileRank(
  values: readonly number[],
  value: number,
): number {
  if (values.length === 0) return 50;

  const belowCount = values.filter((v) => v < value).length;
  const equalCount = values.filter((v) => v === value).length;

  // Use midpoint method for tied values
  return ((belowCount + equalCount / 2) / values.length) * 100;
}

// =============================================================================
// RATE & RATIO CALCULATIONS
// =============================================================================

/**
 * Calculate rate safely (handles division by zero)
 */
export function safeRate(
  numerator: number,
  denominator: number,
  scale = 1,
): number {
  if (denominator === 0) return 0;
  return (numerator / denominator) * scale;
}

/**
 * Calculate percentage safely
 */
export function safePercentage(numerator: number, denominator: number): number {
  return safeRate(numerator, denominator, 100);
}

/**
 * Calculate K/D ratio with floor
 */
export function calculateKD(kills: number, deaths: number): number {
  if (deaths === 0) return kills > 0 ? kills : 0;
  return Number((kills / deaths).toFixed(2));
}

/**
 * Calculate ADR (Average Damage per Round)
 */
export function calculateADR(totalDamage: number, rounds: number): number {
  if (rounds === 0) return 0;
  return Number((totalDamage / rounds).toFixed(1));
}

// =============================================================================
// TREND ANALYSIS
// =============================================================================

/**
 * Linear regression for trend analysis
 * Returns slope, intercept, and R-squared
 */
export function linearRegression(values: readonly number[]): {
  slope: number;
  intercept: number;
  rSquared: number;
} {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0, rSquared: 0 };

  // X values are indices (0, 1, 2, ...)
  const xMean = (n - 1) / 2;
  const yMean = mean(values);

  let numerator = 0;
  let denominator = 0;
  let ssTotal = 0;

  for (let i = 0; i < n; i++) {
    const xDiff = i - xMean;
    const yDiff = (values[i] ?? 0) - yMean;
    numerator += xDiff * yDiff;
    denominator += xDiff * xDiff;
    ssTotal += yDiff * yDiff;
  }

  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;

  // Calculate R-squared
  let ssResidual = 0;
  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * i;
    ssResidual += Math.pow((values[i] ?? 0) - predicted, 2);
  }

  const rSquared = ssTotal === 0 ? 0 : 1 - ssResidual / ssTotal;

  return {
    slope: Number(slope.toFixed(4)),
    intercept: Number(intercept.toFixed(4)),
    rSquared: Number(Math.max(0, rSquared).toFixed(4)),
  };
}

/**
 * Determine trend direction from values
 */
export function determineTrend(
  values: readonly number[],
  threshold = 0.01,
): "improving" | "stable" | "declining" {
  if (values.length < 3) return "stable";

  const { slope, rSquared } = linearRegression(values);

  // Only consider trend significant if R-squared is decent
  if (rSquared < 0.1) return "stable";

  if (slope > threshold) return "improving";
  if (slope < -threshold) return "declining";
  return "stable";
}

/**
 * Calculate moving average
 */
export function movingAverage(
  values: readonly number[],
  window: number,
): number[] {
  if (values.length < window) return [mean(values)];

  const result: number[] = [];
  for (let i = window - 1; i < values.length; i++) {
    const windowValues = values.slice(i - window + 1, i + 1);
    result.push(mean(windowValues));
  }

  return result;
}

/**
 * Exponential moving average (more weight to recent values)
 */
export function exponentialMovingAverage(
  values: readonly number[],
  alpha = 0.3,
): number[] {
  if (values.length === 0) return [];

  const result: number[] = [values[0]!];

  for (let i = 1; i < values.length; i++) {
    const ema = alpha * (values[i] ?? 0) + (1 - alpha) * (result[i - 1] ?? 0);
    result.push(ema);
  }

  return result;
}

// =============================================================================
// DISTRIBUTION ANALYSIS
// =============================================================================

/**
 * Bucket values into distribution ranges
 */
export function createDistribution(
  values: readonly number[],
  buckets: readonly { min: number; max: number; label: string }[],
): Record<string, number> {
  const distribution: Record<string, number> = {};

  for (const bucket of buckets) {
    distribution[bucket.label] = 0;
  }

  for (const value of values) {
    for (const bucket of buckets) {
      if (value >= bucket.min && value < bucket.max) {
        const current = distribution[bucket.label] ?? 0;
        distribution[bucket.label] = current + 1;
        break;
      }
    }
  }

  return distribution;
}

/**
 * Rating distribution buckets
 */
export const RATING_BUCKETS = [
  { min: 0, max: 0.8, label: "below080" },
  { min: 0.8, max: 1.0, label: "from080to100" },
  { min: 1.0, max: 1.2, label: "from100to120" },
  { min: 1.2, max: 1.4, label: "from120to140" },
  { min: 1.4, max: Infinity, label: "above140" },
] as const;

// =============================================================================
// STREAK ANALYSIS
// =============================================================================

/**
 * Calculate current and longest streaks
 */
export function calculateStreaks(results: readonly boolean[]): {
  currentStreak: number;
  longestStreak: number;
  type: "win" | "loss" | "none";
} {
  if (results.length === 0) {
    return { currentStreak: 0, longestStreak: 0, type: "none" };
  }

  let currentStreak = 0;
  let longestStreak = 0;
  let previousValue: boolean | null = null;

  for (const result of results) {
    if (previousValue === null || result === previousValue) {
      currentStreak++;
    } else {
      currentStreak = 1;
    }
    longestStreak = Math.max(longestStreak, currentStreak);
    previousValue = result;
  }

  const lastResult = results[results.length - 1];
  const type = lastResult ? "win" : "loss";

  // Reset current streak count based on last value
  let finalCurrentStreak = 0;
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i] === lastResult) {
      finalCurrentStreak++;
    } else {
      break;
    }
  }

  return { currentStreak: finalCurrentStreak, longestStreak, type };
}

/**
 * Calculate rating streak (consecutive games above/below average)
 */
export function calculateRatingStreak(
  ratings: readonly number[],
  average: number,
): { aboveAvg: number; belowAvg: number } {
  if (ratings.length === 0) {
    return { aboveAvg: 0, belowAvg: 0 };
  }

  let aboveAvg = 0;
  let belowAvg = 0;

  // Count from most recent
  for (let i = ratings.length - 1; i >= 0; i--) {
    const rating = ratings[i] ?? 0;
    if (rating >= average) {
      if (belowAvg === 0) aboveAvg++;
      else break;
    } else {
      if (aboveAvg === 0) belowAvg++;
      else break;
    }
  }

  return { aboveAvg, belowAvg };
}

// =============================================================================
// CONSISTENCY METRICS
// =============================================================================

/**
 * Calculate consistency score (inverse of CV, normalized to 0-100)
 */
export function calculateConsistency(values: readonly number[]): number {
  if (values.length < 3) return 100;

  const cv = coefficientOfVariation(values);

  // CV of 0 = 100% consistent, CV of 0.5 = ~0% consistent
  const consistency = Math.max(0, 100 * (1 - cv * 2));
  return Number(consistency.toFixed(1));
}

/**
 * Calculate floor and ceiling (10th and 90th percentiles)
 */
export function calculateFloorCeiling(values: readonly number[]): {
  floor: number;
  ceiling: number;
  range: number;
} {
  const floor = percentile(values, 10);
  const ceiling = percentile(values, 90);

  return {
    floor: Number(floor.toFixed(2)),
    ceiling: Number(ceiling.toFixed(2)),
    range: Number((ceiling - floor).toFixed(2)),
  };
}

// =============================================================================
// FORM ANALYSIS
// =============================================================================

import type { FormIndicator } from "../../types/aggregation.types";
import { FORM_CONFIG } from "../../../aggregation/aggregation.config";

/**
 * Determine current form indicator
 */
export function determineForm(
  recentRatings: readonly number[],
  lifetimeAvg: number,
): FormIndicator {
  const { STREAK } = FORM_CONFIG;
  if (recentRatings.length < STREAK.HOT_COLD_SAMPLE_SIZE) return "unknown";

  const recentAvg = mean(recentRatings);
  const last3Avg = mean(recentRatings.slice(-STREAK.HOT_COLD_SAMPLE_SIZE));

  const vsLifetime = recentAvg / lifetimeAvg;
  const last3VsRecent = last3Avg / recentAvg;

  const { STATUS_THRESHOLDS } = FORM_CONFIG;

  // On fire: significantly above lifetime AND trending up
  if (
    vsLifetime >= STATUS_THRESHOLDS.ON_FIRE.ratingMultiplier &&
    last3VsRecent >= STATUS_THRESHOLDS.ON_FIRE.trendMultiplier
  ) {
    return "on_fire";
  }

  // Hot: above lifetime
  if (vsLifetime >= STATUS_THRESHOLDS.HOT.ratingMultiplier) return "hot";

  // Warm: slightly above
  if (vsLifetime >= STATUS_THRESHOLDS.WARM.ratingMultiplier) return "warm";

  // Ice cold: significantly below AND trending down
  if (
    vsLifetime <= STATUS_THRESHOLDS.ICE_COLD.ratingMultiplier &&
    last3VsRecent <= STATUS_THRESHOLDS.ICE_COLD.trendMultiplier
  ) {
    return "ice_cold";
  }

  // Cold: below lifetime
  if (vsLifetime <= STATUS_THRESHOLDS.COLD.ratingMultiplier) return "cold";

  return "average";
}

// =============================================================================
// AGGREGATION HELPERS
// =============================================================================

/**
 * Sum values from an array of objects
 */
export function sumBy<T>(
  items: readonly T[],
  selector: (item: T) => number,
): number {
  return items.reduce((sum, item) => sum + selector(item), 0);
}

/**
 * Average values from an array of objects
 */
export function avgBy<T>(
  items: readonly T[],
  selector: (item: T) => number,
): number {
  if (items.length === 0) return 0;
  return sumBy(items, selector) / items.length;
}

/**
 * Group items by a key
 */
export function groupBy<T, K extends string>(
  items: readonly T[],
  keySelector: (item: T) => K,
): Record<K, T[]> {
  const groups = {} as Record<K, T[]>;

  for (const item of items) {
    const key = keySelector(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
  }

  return groups;
}

/**
 * Count occurrences of a condition
 */
export function countWhere<T>(
  items: readonly T[],
  predicate: (item: T) => boolean,
): number {
  return items.filter(predicate).length;
}
