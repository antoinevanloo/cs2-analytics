/**
 * Impact Calculator - Measures player influence on round outcomes
 *
 * Impact rating quantifies how much a player's actions affected rounds.
 * It considers:
 * - Multi-kill rounds (2k, 3k, 4k, 5k)
 * - Opening duels (first kills of rounds)
 * - Clutch situations
 *
 * Base Formula: Impact = 2.13*KPR + 0.42*APR - 0.41
 *
 * Additional bonuses are added for:
 * - Multi-kills: 2k=+0.1, 3k=+0.2, 4k=+0.35, 5k=+0.5
 * - Opening wins: +0.15 per opening kill
 * - Opening losses: -0.10 per opening death
 *
 * Average impact = 1.0
 * Elite players typically have > 1.2
 *
 * @module analysis/calculators/impact
 */

import type {
  KillInput,
  RoundPlayerStatsInput,
} from "../types/inputs.types";
import type {
  ImpactMetrics,
  MultiKillStats,
  OpeningSummary,
} from "../types/rating.types";
import { IMPACT_WEIGHTS } from "../types/constants";

/**
 * Input required for Impact calculation
 */
export interface ImpactCalculationInput {
  /** Player's Steam ID */
  readonly steamId: string;

  /** Per-round stats for the player */
  readonly roundStats: readonly RoundPlayerStatsInput[];

  /** All kills in the match */
  readonly allKills: readonly KillInput[];

  /** Total rounds in the match */
  readonly totalRounds: number;
}

/**
 * Calculate Impact rating for a player
 *
 * @param input - Player data and match context
 * @returns Impact metrics with full breakdown
 *
 * @example
 * ```typescript
 * const impact = calculateImpact({
 *   steamId: "76561198...",
 *   roundStats: playerRoundStats,
 *   allKills: matchKills,
 *   totalRounds: 30,
 * });
 * console.log(`Impact: ${impact.impact}`);
 * ```
 */
export function calculateImpact(input: ImpactCalculationInput): ImpactMetrics {
  const { steamId, roundStats, allKills, totalRounds } = input;

  if (roundStats.length === 0 || totalRounds === 0) {
    return createEmptyImpactMetrics();
  }

  // Calculate base metrics
  const totalKills = roundStats.reduce((sum, r) => sum + r.kills, 0);
  const totalAssists = roundStats.reduce((sum, r) => sum + r.assists, 0);

  const kpr = totalKills / totalRounds;
  const apr = totalAssists / totalRounds;

  // Base impact from KPR and APR
  const baseImpact =
    IMPACT_WEIGHTS.KPR_MULTIPLIER * kpr +
    IMPACT_WEIGHTS.APR_MULTIPLIER * apr +
    IMPACT_WEIGHTS.CONSTANT;

  // Calculate multi-kill bonus
  const multiKills = calculateMultiKills(roundStats);
  const multiKillImpact = calculateMultiKillImpact(multiKills, totalRounds);

  // Calculate opening duel impact
  const openings = calculateOpenings(steamId, allKills);
  const openingImpact = calculateOpeningImpact(openings, totalRounds);

  // Calculate clutch impact (simplified - full version in clutch calculator)
  const clutchImpact = calculateClutchImpact(roundStats, totalRounds);

  // Total impact is sum of all components
  const totalImpact = baseImpact + multiKillImpact + openingImpact + clutchImpact;

  return {
    impact: round3(totalImpact),
    multiKillImpact: round3(multiKillImpact),
    openingImpact: round3(openingImpact),
    clutchImpact: round3(clutchImpact),
    multiKills,
    openings,
  };
}

/**
 * Calculate multi-kill round statistics
 *
 * @param roundStats - Per-round stats
 * @returns Multi-kill counts
 */
export function calculateMultiKills(
  roundStats: readonly RoundPlayerStatsInput[]
): MultiKillStats {
  let twoK = 0;
  let threeK = 0;
  let fourK = 0;
  let fiveK = 0;

  for (const round of roundStats) {
    switch (round.kills) {
      case 2:
        twoK++;
        break;
      case 3:
        threeK++;
        break;
      case 4:
        fourK++;
        break;
      case 5:
        fiveK++;
        break;
      default:
        // 0, 1, or 6+ kills - no multi-kill category
        break;
    }
  }

  return {
    twoK,
    threeK,
    fourK,
    fiveK,
    total: twoK + threeK + fourK + fiveK,
  };
}

/**
 * Calculate impact contribution from multi-kills
 *
 * Multi-kills are weighted based on difficulty:
 * - 2k: +0.10 per round
 * - 3k: +0.20 per round
 * - 4k: +0.35 per round
 * - 5k: +0.50 per round
 *
 * Normalized by total rounds to get per-round impact.
 */
function calculateMultiKillImpact(
  multiKills: MultiKillStats,
  totalRounds: number
): number {
  if (totalRounds === 0) return 0;

  const rawImpact =
    multiKills.twoK * IMPACT_WEIGHTS.MULTI_KILL.TWO_K +
    multiKills.threeK * IMPACT_WEIGHTS.MULTI_KILL.THREE_K +
    multiKills.fourK * IMPACT_WEIGHTS.MULTI_KILL.FOUR_K +
    multiKills.fiveK * IMPACT_WEIGHTS.MULTI_KILL.FIVE_K;

  return rawImpact / totalRounds;
}

/**
 * Calculate opening duel statistics
 *
 * An opening duel is the first kill of a round.
 * We track:
 * - Wins: Player got the first kill
 * - Losses: Player was the first death
 *
 * @param steamId - Player's Steam ID
 * @param allKills - All kills in the match
 * @returns Opening duel statistics
 */
export function calculateOpenings(
  steamId: string,
  allKills: readonly KillInput[]
): OpeningSummary {
  // Group kills by round
  const killsByRound = new Map<number, KillInput[]>();

  for (const kill of allKills) {
    const roundKills = killsByRound.get(kill.roundNumber) || [];
    roundKills.push(kill);
    killsByRound.set(kill.roundNumber, roundKills);
  }

  let wins = 0;
  let losses = 0;

  // Check each round for opening kills
  for (const [, roundKills] of killsByRound) {
    if (roundKills.length === 0) continue;

    // Sort by tick to find first kill
    roundKills.sort((a, b) => a.tick - b.tick);
    const firstKill = roundKills[0];

    // Check if player was involved (firstKill is guaranteed to exist since length > 0)
    if (firstKill && firstKill.attackerSteamId === steamId) {
      wins++;
    } else if (firstKill && firstKill.victimSteamId === steamId) {
      losses++;
    }
  }

  const attempts = wins + losses;
  const winRate = attempts > 0 ? (wins / attempts) * 100 : 0;

  return {
    attempts,
    wins,
    losses,
    winRate: round2(winRate),
  };
}

/**
 * Calculate impact contribution from opening duels
 *
 * Opening kills add positive impact.
 * Opening deaths add negative impact.
 * Normalized by total rounds.
 */
function calculateOpeningImpact(
  openings: OpeningSummary,
  totalRounds: number
): number {
  if (totalRounds === 0) return 0;

  const rawImpact =
    openings.wins * IMPACT_WEIGHTS.OPENING.WIN +
    openings.losses * IMPACT_WEIGHTS.OPENING.LOSS;

  return rawImpact / totalRounds;
}

/**
 * Calculate impact contribution from clutches
 *
 * This is a simplified version. Full clutch analysis in clutch.calculator.ts
 *
 * @param roundStats - Per-round stats with clutch info
 * @param totalRounds - Total rounds
 * @returns Clutch impact contribution
 */
function calculateClutchImpact(
  roundStats: readonly RoundPlayerStatsInput[],
  totalRounds: number
): number {
  if (totalRounds === 0) return 0;

  let clutchImpact = 0;

  for (const round of roundStats) {
    if (round.clutchWon === true && round.clutchVs) {
      // Clutch win adds impact based on opponents
      // 1v1 = 0.1, 1v2 = 0.2, 1v3 = 0.3, etc.
      clutchImpact += round.clutchVs * 0.1;
    }
  }

  return clutchImpact / totalRounds;
}

/**
 * Get Impact rating label
 *
 * @param impact - Impact rating value
 * @returns Descriptive label
 */
export function getImpactLabel(impact: number): string {
  if (impact >= 1.3) return "Elite";
  if (impact >= 1.2) return "Excellent";
  if (impact >= 1.1) return "Good";
  if (impact >= 1.0) return "Average";
  if (impact >= 0.9) return "Below Average";
  return "Low Impact";
}

/**
 * Analyze impact breakdown
 *
 * Shows where a player's impact comes from.
 *
 * @param impact - Impact metrics
 * @returns Analysis of impact sources
 */
export function analyzeImpactSources(
  impact: ImpactMetrics
): {
  primarySource: string;
  breakdown: { source: string; contribution: number }[];
} {
  const sources = [
    { source: "Multi-kills", contribution: impact.multiKillImpact },
    { source: "Opening duels", contribution: impact.openingImpact },
    { source: "Clutches", contribution: impact.clutchImpact },
  ];

  // Sort by absolute contribution
  sources.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  // sources array always has 3 elements, but TypeScript requires safety check
  const primarySource = sources[0]?.source ?? "Unknown";

  return {
    primarySource,
    breakdown: sources,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create empty Impact metrics
 */
function createEmptyImpactMetrics(): ImpactMetrics {
  return {
    impact: 0,
    multiKillImpact: 0,
    openingImpact: 0,
    clutchImpact: 0,
    multiKills: {
      twoK: 0,
      threeK: 0,
      fourK: 0,
      fiveK: 0,
      total: 0,
    },
    openings: {
      attempts: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
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
