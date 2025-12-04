/**
 * KAST Calculator
 *
 * Calculates KAST (Kill, Assist, Survived, Traded) percentage.
 * KAST measures consistency - what percentage of rounds a player contributed.
 *
 * A round counts as KAST if player:
 * - K: Got at least 1 kill
 * - A: Got at least 1 assist (including flash assists)
 * - S: Survived the round
 * - T: Died but was traded within 5 seconds
 *
 * @module analysis/calculators/aggregation/kast
 */

import { safePercentage } from "./stats.calculator";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Per-round data needed for KAST calculation
 */
export interface RoundKastData {
  readonly roundId: string;
  readonly kills: number;
  readonly assists: number;
  readonly survived: boolean;
  readonly wasTraded: boolean;
}

/**
 * KAST calculation result
 */
export interface KastResult {
  /** KAST percentage (0-100) */
  readonly kast: number;
  /** Breakdown of contribution types */
  readonly breakdown: {
    readonly killRounds: number;
    readonly assistRounds: number;
    readonly surviveRounds: number;
    readonly tradedRounds: number;
    readonly totalRounds: number;
    /** Rounds with any contribution */
    readonly contributingRounds: number;
  };
}

// =============================================================================
// CALCULATOR
// =============================================================================

/**
 * Calculate KAST from round-level data
 *
 * @param rounds - Array of round data with KAST components
 * @returns KAST percentage and breakdown
 */
export function calculateKast(rounds: readonly RoundKastData[]): KastResult {
  if (rounds.length === 0) {
    return {
      kast: 0,
      breakdown: {
        killRounds: 0,
        assistRounds: 0,
        surviveRounds: 0,
        tradedRounds: 0,
        totalRounds: 0,
        contributingRounds: 0,
      },
    };
  }

  let killRounds = 0;
  let assistRounds = 0;
  let surviveRounds = 0;
  let tradedRounds = 0;
  let contributingRounds = 0;

  for (const round of rounds) {
    const hasKill = round.kills > 0;
    const hasAssist = round.assists > 0;
    const survived = round.survived;
    const wasTraded = round.wasTraded;

    // Count each type
    if (hasKill) killRounds++;
    if (hasAssist) assistRounds++;
    if (survived) surviveRounds++;
    if (wasTraded) tradedRounds++;

    // A round counts as KAST if ANY of the conditions are met
    if (hasKill || hasAssist || survived || wasTraded) {
      contributingRounds++;
    }
  }

  return {
    kast: Number(safePercentage(contributingRounds, rounds.length).toFixed(1)),
    breakdown: {
      killRounds,
      assistRounds,
      surviveRounds,
      tradedRounds,
      totalRounds: rounds.length,
      contributingRounds,
    },
  };
}

/**
 * Calculate KAST for multiple matches
 *
 * @param matchRounds - Map of match ID to round data
 * @returns Map of match ID to KAST result
 */
export function calculateKastByMatch(
  matchRounds: ReadonlyMap<string, readonly RoundKastData[]>
): Map<string, KastResult> {
  const results = new Map<string, KastResult>();

  for (const [matchId, rounds] of matchRounds) {
    results.set(matchId, calculateKast(rounds));
  }

  return results;
}

/**
 * Calculate aggregate KAST across all rounds (not per-match average)
 *
 * @param allRounds - All rounds across all matches
 * @returns Single KAST result for all rounds combined
 */
export function calculateAggregateKast(
  allRounds: readonly RoundKastData[]
): KastResult {
  return calculateKast(allRounds);
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Determine KAST tier based on percentage
 */
export function getKastTier(kast: number): "elite" | "good" | "average" | "poor" {
  if (kast >= 75) return "elite";
  if (kast >= 70) return "good";
  if (kast >= 65) return "average";
  return "poor";
}

/**
 * Compare two KAST values and return relative performance
 */
export function compareKast(
  playerKast: number,
  peerKast: number
): "above" | "average" | "below" {
  const diff = playerKast - peerKast;
  if (diff > 3) return "above";
  if (diff < -3) return "below";
  return "average";
}
