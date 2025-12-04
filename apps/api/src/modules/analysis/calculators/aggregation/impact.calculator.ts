/**
 * Impact Calculator
 *
 * Calculates player impact rating based on round-winning contributions.
 * Impact measures how much a player influences round outcomes beyond raw kills.
 *
 * Impact factors:
 * - Opening kills (first blood)
 * - Multi-kills (2K, 3K, 4K, 5K)
 * - Clutch wins
 * - Trade kills (supporting teammates)
 * - Entry success rate
 *
 * Scale: 0.0 - 2.0+ (average player ~1.0)
 *
 * @module analysis/calculators/aggregation/impact
 */

import { safeRate } from "./stats.calculator";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Data needed to calculate impact for a match
 */
export interface ImpactInput {
  /** Total kills in the match */
  readonly kills: number;
  /** Total deaths in the match */
  readonly deaths: number;
  /** Rounds played */
  readonly roundsPlayed: number;
  /** Rounds won by player's team */
  readonly roundsWon: number;
  /** Opening kills (first blood) */
  readonly openingKills: number;
  /** Opening deaths */
  readonly openingDeaths: number;
  /** Double kills (2K rounds) */
  readonly doubleKills: number;
  /** Triple kills (3K rounds) */
  readonly tripleKills: number;
  /** Quad kills (4K rounds) */
  readonly quadKills: number;
  /** Aces (5K rounds) */
  readonly aces: number;
  /** 1vX clutch wins */
  readonly clutchWins: number;
  /** Trade kills */
  readonly tradeKills: number;
}

/**
 * Impact calculation result
 */
export interface ImpactResult {
  /** Overall impact rating (0.0 - 2.0+) */
  readonly impact: number;
  /** Impact tier classification */
  readonly tier: "elite" | "high" | "average" | "low";
  /** Breakdown of impact components */
  readonly breakdown: {
    /** Points from opening kills */
    readonly openingImpact: number;
    /** Points from multi-kills */
    readonly multiKillImpact: number;
    /** Points from clutches */
    readonly clutchImpact: number;
    /** Points from trades */
    readonly tradeImpact: number;
    /** Base impact from kills per round */
    readonly baseImpact: number;
  };
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Impact calculation weights
 * These determine how much each action contributes to impact
 */
const IMPACT_WEIGHTS = {
  /** Weight for opening kills */
  OPENING_KILL: 0.15,
  /** Penalty for opening deaths */
  OPENING_DEATH: -0.08,
  /** Weight for double kills */
  DOUBLE_KILL: 0.1,
  /** Weight for triple kills */
  TRIPLE_KILL: 0.2,
  /** Weight for quad kills */
  QUAD_KILL: 0.35,
  /** Weight for aces */
  ACE: 0.5,
  /** Weight for clutch wins */
  CLUTCH_WIN: 0.25,
  /** Weight for trade kills */
  TRADE_KILL: 0.05,
  /** Base multiplier for kills per round */
  KILLS_PER_ROUND_MULTIPLIER: 1.2,
} as const;

/**
 * Impact tier thresholds
 */
const IMPACT_TIERS = {
  ELITE: 1.3,
  HIGH: 1.1,
  AVERAGE: 0.9,
  // Below AVERAGE = low
} as const;

// =============================================================================
// CALCULATOR
// =============================================================================

/**
 * Calculate impact rating for a match
 *
 * @param input - Match data for impact calculation
 * @returns Impact rating and breakdown
 */
export function calculateImpact(input: ImpactInput): ImpactResult {
  const {
    kills,
    roundsPlayed,
    openingKills,
    openingDeaths,
    doubleKills,
    tripleKills,
    quadKills,
    aces,
    clutchWins,
    tradeKills,
  } = input;

  // Avoid division by zero
  if (roundsPlayed === 0) {
    return {
      impact: 0,
      tier: "low",
      breakdown: {
        openingImpact: 0,
        multiKillImpact: 0,
        clutchImpact: 0,
        tradeImpact: 0,
        baseImpact: 0,
      },
    };
  }

  // Base impact from kills per round
  const killsPerRound = safeRate(kills, roundsPlayed);
  const baseImpact = killsPerRound * IMPACT_WEIGHTS.KILLS_PER_ROUND_MULTIPLIER;

  // Opening impact (kills - deaths penalty)
  const openingImpact =
    openingKills * IMPACT_WEIGHTS.OPENING_KILL +
    openingDeaths * IMPACT_WEIGHTS.OPENING_DEATH;

  // Multi-kill impact
  const multiKillImpact =
    doubleKills * IMPACT_WEIGHTS.DOUBLE_KILL +
    tripleKills * IMPACT_WEIGHTS.TRIPLE_KILL +
    quadKills * IMPACT_WEIGHTS.QUAD_KILL +
    aces * IMPACT_WEIGHTS.ACE;

  // Clutch impact
  const clutchImpact = clutchWins * IMPACT_WEIGHTS.CLUTCH_WIN;

  // Trade impact
  const tradeImpact = tradeKills * IMPACT_WEIGHTS.TRADE_KILL;

  // Total impact (normalized per round for consistency)
  const rawImpact =
    baseImpact +
    safeRate(openingImpact, roundsPlayed) * 10 +
    safeRate(multiKillImpact, roundsPlayed) * 10 +
    safeRate(clutchImpact, roundsPlayed) * 10 +
    safeRate(tradeImpact, roundsPlayed) * 10;

  // Normalize to ~1.0 average
  const impact = Number(rawImpact.toFixed(2));

  // Determine tier
  const tier = getImpactTier(impact);

  return {
    impact,
    tier,
    breakdown: {
      openingImpact: Number(openingImpact.toFixed(3)),
      multiKillImpact: Number(multiKillImpact.toFixed(3)),
      clutchImpact: Number(clutchImpact.toFixed(3)),
      tradeImpact: Number(tradeImpact.toFixed(3)),
      baseImpact: Number(baseImpact.toFixed(3)),
    },
  };
}

/**
 * Calculate aggregate impact across multiple matches
 *
 * @param inputs - Array of match data
 * @returns Weighted average impact
 */
export function calculateAggregateImpact(
  inputs: readonly ImpactInput[],
): ImpactResult {
  if (inputs.length === 0) {
    return {
      impact: 0,
      tier: "low",
      breakdown: {
        openingImpact: 0,
        multiKillImpact: 0,
        clutchImpact: 0,
        tradeImpact: 0,
        baseImpact: 0,
      },
    };
  }

  // Aggregate all inputs into one
  const aggregated: ImpactInput = {
    kills: inputs.reduce((sum, i) => sum + i.kills, 0),
    deaths: inputs.reduce((sum, i) => sum + i.deaths, 0),
    roundsPlayed: inputs.reduce((sum, i) => sum + i.roundsPlayed, 0),
    roundsWon: inputs.reduce((sum, i) => sum + i.roundsWon, 0),
    openingKills: inputs.reduce((sum, i) => sum + i.openingKills, 0),
    openingDeaths: inputs.reduce((sum, i) => sum + i.openingDeaths, 0),
    doubleKills: inputs.reduce((sum, i) => sum + i.doubleKills, 0),
    tripleKills: inputs.reduce((sum, i) => sum + i.tripleKills, 0),
    quadKills: inputs.reduce((sum, i) => sum + i.quadKills, 0),
    aces: inputs.reduce((sum, i) => sum + i.aces, 0),
    clutchWins: inputs.reduce((sum, i) => sum + i.clutchWins, 0),
    tradeKills: inputs.reduce((sum, i) => sum + i.tradeKills, 0),
  };

  return calculateImpact(aggregated);
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Determine impact tier from rating
 */
export function getImpactTier(
  impact: number,
): "elite" | "high" | "average" | "low" {
  if (impact >= IMPACT_TIERS.ELITE) return "elite";
  if (impact >= IMPACT_TIERS.HIGH) return "high";
  if (impact >= IMPACT_TIERS.AVERAGE) return "average";
  return "low";
}

/**
 * Compare impact to peer average
 */
export function compareImpact(
  playerImpact: number,
  peerImpact: number,
): {
  difference: number;
  percentDiff: number;
  assessment: "above" | "average" | "below";
} {
  const difference = playerImpact - peerImpact;
  const percentDiff = peerImpact > 0 ? (difference / peerImpact) * 100 : 0;

  let assessment: "above" | "average" | "below";
  if (percentDiff > 10) assessment = "above";
  else if (percentDiff < -10) assessment = "below";
  else assessment = "average";

  return {
    difference: Number(difference.toFixed(2)),
    percentDiff: Number(percentDiff.toFixed(1)),
    assessment,
  };
}
