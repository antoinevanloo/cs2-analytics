/**
 * KAST Calculator - Kill/Assist/Survived/Traded percentage
 *
 * KAST is one of the most important metrics in CS2 analytics.
 * It measures consistency by tracking the percentage of rounds
 * where a player had a positive contribution.
 *
 * A round is KAST-positive if ANY of the following is true:
 * - K: Player got at least one kill
 * - A: Player got at least one assist
 * - S: Player survived the round
 * - T: Player was traded (teammate killed their killer within threshold)
 *
 * Pro players typically have KAST > 70%
 * Elite players often exceed 75%
 * Below 65% indicates inconsistency
 *
 * @module analysis/calculators/kast
 */

import type {
  KillInput,
  RoundPlayerStatsInput,
} from "../types/inputs.types";
import type { KASTMetrics } from "../types/rating.types";
import { TRADE_THRESHOLD_TICKS } from "../types/constants";

/**
 * Input required for KAST calculation
 */
export interface KASTCalculationInput {
  /** Player's Steam ID */
  readonly steamId: string;

  /** Per-round stats for the player */
  readonly roundStats: readonly RoundPlayerStatsInput[];

  /** All kills in the match (needed for trade detection) */
  readonly allKills: readonly KillInput[];

  /** Tick rate of the demo (for time-based calculations) */
  readonly tickRate?: number;
}

/**
 * Calculate KAST metrics for a player
 *
 * @param input - Player data and match context
 * @returns KAST metrics with full breakdown
 *
 * @example
 * ```typescript
 * const kast = calculateKAST({
 *   steamId: "76561198...",
 *   roundStats: playerRoundStats,
 *   allKills: matchKills,
 * });
 * console.log(`KAST: ${kast.kast}%`);
 * ```
 */
export function calculateKAST(input: KASTCalculationInput): KASTMetrics {
  const { steamId, roundStats, allKills, tickRate = 64 } = input;

  if (roundStats.length === 0) {
    return createEmptyKASTMetrics();
  }

  // Detect traded rounds
  const tradedRounds = detectTradedRounds(steamId, allKills, tickRate);

  // Categorize each round
  const killRounds: number[] = [];
  const assistRounds: number[] = [];
  const survivalRounds: number[] = [];
  const tradedRoundsList: number[] = [];
  const zeroImpactRounds: number[] = [];

  // Track unique KAST-positive rounds
  const kastPositiveRounds = new Set<number>();

  for (const round of roundStats) {
    const roundNum = round.roundNumber;
    let hasKAST = false;

    // K - Kill
    if (round.kills > 0) {
      killRounds.push(roundNum);
      hasKAST = true;
    }

    // A - Assist
    if (round.assists > 0) {
      assistRounds.push(roundNum);
      hasKAST = true;
    }

    // S - Survived
    if (round.survived) {
      survivalRounds.push(roundNum);
      hasKAST = true;
    }

    // T - Traded
    if (tradedRounds.has(roundNum)) {
      tradedRoundsList.push(roundNum);
      hasKAST = true;
    }

    if (hasKAST) {
      kastPositiveRounds.add(roundNum);
    } else {
      zeroImpactRounds.push(roundNum);
    }
  }

  const totalRounds = roundStats.length;
  const kastPercentage = (kastPositiveRounds.size / totalRounds) * 100;

  return {
    kast: round2(kastPercentage),
    roundsWithKill: killRounds.length,
    roundsWithAssist: assistRounds.length,
    roundsWithSurvival: survivalRounds.length,
    roundsWithTrade: tradedRoundsList.length,
    totalRounds,
    breakdown: {
      killRounds,
      assistRounds,
      survivalRounds,
      tradedRounds: tradedRoundsList,
      zeroImpactRounds,
    },
  };
}

/**
 * Detect rounds where the player was traded
 *
 * A trade occurs when:
 * 1. Player died
 * 2. A teammate killed the player's killer
 * 3. Within the trade threshold (default 5 seconds)
 *
 * @param steamId - Player's Steam ID
 * @param allKills - All kills in the match
 * @param tickRate - Demo tick rate
 * @returns Set of round numbers where player was traded
 */
export function detectTradedRounds(
  steamId: string,
  allKills: readonly KillInput[],
  tickRate: number = 64
): Set<number> {
  const tradedRounds = new Set<number>();

  // Scale threshold based on tick rate
  // Base threshold is for 64 tick (5 seconds = 320 ticks)
  const tradeThreshold = Math.round(
    (TRADE_THRESHOLD_TICKS / 64) * tickRate
  );

  // Find all deaths of this player
  const playerDeaths = allKills.filter((k) => k.victimSteamId === steamId);

  for (const death of playerDeaths) {
    const killerSteamId = death.attackerSteamId;

    // Skip suicides or team kills
    if (!killerSteamId) continue;

    // Look for a teammate killing the killer within threshold
    const tradeKill = allKills.find((k) => {
      // Must be same round
      if (k.roundNumber !== death.roundNumber) return false;

      // Must kill the original killer
      if (k.victimSteamId !== killerSteamId) return false;

      // Must be after the death
      if (k.tick <= death.tick) return false;

      // Must be within threshold
      if (k.tick - death.tick > tradeThreshold) return false;

      // Must be a teammate (different from the dead player and killer)
      if (k.attackerSteamId === steamId) return false;
      if (k.attackerSteamId === killerSteamId) return false;

      return true;
    });

    if (tradeKill) {
      tradedRounds.add(death.roundNumber);
    }
  }

  return tradedRounds;
}

/**
 * Calculate KAST contribution for a specific round
 *
 * Useful for round-by-round analysis.
 *
 * @param roundStats - Stats for a single round
 * @param wasTraded - Whether player was traded this round
 * @returns Object indicating which KAST components were satisfied
 */
export function calculateRoundKAST(
  roundStats: RoundPlayerStatsInput,
  wasTraded: boolean
): {
  hasKill: boolean;
  hasAssist: boolean;
  hasSurvival: boolean;
  wasTraded: boolean;
  isKASTPositive: boolean;
} {
  const hasKill = roundStats.kills > 0;
  const hasAssist = roundStats.assists > 0;
  const hasSurvival = roundStats.survived;

  return {
    hasKill,
    hasAssist,
    hasSurvival,
    wasTraded,
    isKASTPositive: hasKill || hasAssist || hasSurvival || wasTraded,
  };
}

/**
 * Calculate team KAST average
 *
 * @param playerKASTs - KAST metrics for each team member
 * @returns Team average KAST percentage
 */
export function calculateTeamKAST(
  playerKASTs: readonly KASTMetrics[]
): number {
  if (playerKASTs.length === 0) return 0;

  const totalKAST = playerKASTs.reduce((sum, p) => sum + p.kast, 0);
  return round2(totalKAST / playerKASTs.length);
}

/**
 * Get KAST rating label
 *
 * @param kast - KAST percentage
 * @returns Descriptive label
 */
export function getKASTLabel(kast: number): string {
  if (kast >= 80) return "Elite";
  if (kast >= 75) return "Excellent";
  if (kast >= 70) return "Good";
  if (kast >= 65) return "Average";
  if (kast >= 60) return "Below Average";
  return "Poor";
}

/**
 * Compare KAST to expected value for skill level
 *
 * @param kast - Actual KAST percentage
 * @param expectedKAST - Expected KAST for skill level
 * @returns Comparison result
 */
export function compareKAST(
  kast: number,
  expectedKAST: number
): {
  difference: number;
  percentDifference: number;
  assessment: "above" | "at" | "below";
} {
  const difference = kast - expectedKAST;
  const percentDifference = (difference / expectedKAST) * 100;

  let assessment: "above" | "at" | "below";
  if (difference > 2) {
    assessment = "above";
  } else if (difference < -2) {
    assessment = "below";
  } else {
    assessment = "at";
  }

  return {
    difference: round2(difference),
    percentDifference: round2(percentDifference),
    assessment,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create empty KAST metrics
 */
function createEmptyKASTMetrics(): KASTMetrics {
  return {
    kast: 0,
    roundsWithKill: 0,
    roundsWithAssist: 0,
    roundsWithSurvival: 0,
    roundsWithTrade: 0,
    totalRounds: 0,
    breakdown: {
      killRounds: [],
      assistRounds: [],
      survivalRounds: [],
      tradedRounds: [],
      zeroImpactRounds: [],
    },
  };
}

/**
 * Round to 2 decimal places
 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
