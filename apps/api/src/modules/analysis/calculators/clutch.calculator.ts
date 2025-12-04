/**
 * Clutch Calculator - 1vX situation analysis
 *
 * A clutch situation occurs when a player is the last alive
 * on their team facing one or more opponents.
 *
 * Expected success rates (pro level):
 * - 1v1: ~50%
 * - 1v2: ~25%
 * - 1v3: ~10%
 * - 1v4: ~5%
 * - 1v5: ~2%
 *
 * @module analysis/calculators/clutch
 */

import type { RoundPlayerStatsInput } from "../types/inputs.types";
import type {
  ClutchMetrics,
  ClutchBreakdown,
  ClutchSituation,
  SideClutchStats,
} from "../types/clutch.types";
import { EXPECTED_CLUTCH_RATES } from "../types/clutch.types";

/**
 * Input for clutch calculation
 */
export interface ClutchCalculationInput {
  /** Player's Steam ID */
  readonly steamId: string;

  /** Per-round stats (must include clutch info) */
  readonly roundStats: readonly RoundPlayerStatsInput[];

  /** Optional: side by round for side-specific stats */
  readonly sideByRound?: ReadonlyMap<number, "T" | "CT">;
}

/**
 * Calculate clutch metrics for a player
 *
 * @param input - Player data with clutch info
 * @returns Clutch metrics
 */
export function calculateClutches(
  input: ClutchCalculationInput,
): ClutchMetrics {
  const { roundStats, sideByRound } = input;

  if (roundStats.length === 0) {
    return createEmptyClutchMetrics();
  }

  // Filter rounds with clutch situations
  const clutchRounds = roundStats.filter(
    (r) => r.clutchVs !== null && r.clutchVs !== undefined && r.clutchVs > 0,
  );

  if (clutchRounds.length === 0) {
    return createEmptyClutchMetrics();
  }

  // Count totals
  let total = 0;
  let won = 0;
  let clutchKills = 0;

  // Breakdown by 1vX (mutable during calculation)
  const breakdownData = {
    "1v1": { attempts: 0, wins: 0 },
    "1v2": { attempts: 0, wins: 0 },
    "1v3": { attempts: 0, wins: 0 },
    "1v4": { attempts: 0, wins: 0 },
    "1v5": { attempts: 0, wins: 0 },
  };

  // Side stats
  const ctStats = { total: 0, won: 0, clutchKills: 0 };
  const tStats = { total: 0, won: 0, clutchKills: 0 };

  for (const round of clutchRounds) {
    if (round.clutchVs === null || round.clutchVs === undefined) continue;

    const vs = round.clutchVs;
    const isWon = round.clutchWon === true;

    total++;
    if (isWon) won++;
    clutchKills += round.kills;

    // Update breakdown
    const key = `1v${vs}` as keyof typeof breakdownData;
    if (breakdownData[key]) {
      breakdownData[key].attempts++;
      if (isWon) breakdownData[key].wins++;
    }

    // Update side stats
    if (sideByRound) {
      const side = sideByRound.get(round.roundNumber);
      if (side === "CT") {
        ctStats.total++;
        if (isWon) ctStats.won++;
        ctStats.clutchKills += round.kills;
      } else if (side === "T") {
        tStats.total++;
        if (isWon) tStats.won++;
        tStats.clutchKills += round.kills;
      }
    }
  }

  // Build final breakdown with calculated rates
  const buildSituation = (
    key: keyof typeof breakdownData,
    opponents: number,
  ): ClutchSituation => {
    const data = breakdownData[key];
    const expectedKey = `1v${opponents}` as keyof typeof EXPECTED_CLUTCH_RATES;
    const expectedRate = EXPECTED_CLUTCH_RATES[expectedKey] ?? 0;
    const successRate =
      data.attempts > 0 ? round2((data.wins / data.attempts) * 100) : 0;
    return {
      attempts: data.attempts,
      wins: data.wins,
      successRate,
      expectedRate,
      vsExpected: round2(successRate - expectedRate * 100),
    };
  };

  return {
    total,
    won,
    lost: total - won,
    successRate: round2(total > 0 ? (won / total) * 100 : 0),
    clutchKills,
    breakdown: {
      "1v1": buildSituation("1v1", 1),
      "1v2": buildSituation("1v2", 2),
      "1v3": buildSituation("1v3", 3),
      "1v4": buildSituation("1v4", 4),
      "1v5": buildSituation("1v5", 5),
    },
    clutches: [], // Full clutch events would need more detailed data
    bySide: {
      ct: createSideClutchStats(ctStats),
      t: createSideClutchStats(tStats),
    },
  };
}

/**
 * Get clutch performance rating
 *
 * Compares actual performance to expected rates.
 *
 * @param clutches - Clutch metrics
 * @returns Performance rating
 */
export function getClutchPerformanceRating(clutches: ClutchMetrics): {
  rating: "elite" | "excellent" | "good" | "average" | "below_average" | "poor";
  score: number;
  description: string;
} {
  if (clutches.total < 3) {
    return {
      rating: "average",
      score: 0,
      description: "Insufficient clutch situations for rating",
    };
  }

  // Calculate weighted score based on difficulty
  let expectedWins = 0;

  for (const situation of Object.values(clutches.breakdown)) {
    expectedWins += situation.attempts * situation.expectedRate;
  }

  // Performance ratio: actual wins vs expected
  const performanceRatio = expectedWins > 0 ? clutches.won / expectedWins : 1;

  // Convert to score (100 = expected, >100 = better than expected)
  const score = round2(performanceRatio * 100);

  let rating:
    | "elite"
    | "excellent"
    | "good"
    | "average"
    | "below_average"
    | "poor";
  let description: string;

  if (score >= 150) {
    rating = "elite";
    description = "Exceptional clutch ability, wins far more than expected";
  } else if (score >= 125) {
    rating = "excellent";
    description = "Excellent clutch ability, consistently overperforms";
  } else if (score >= 110) {
    rating = "good";
    description = "Good clutch ability, performs above average";
  } else if (score >= 90) {
    rating = "average";
    description = "Average clutch ability, meets expectations";
  } else if (score >= 75) {
    rating = "below_average";
    description = "Below average clutch ability, room for improvement";
  } else {
    rating = "poor";
    description = "Struggles in clutch situations";
  }

  return { rating, score, description };
}

/**
 * Calculate team clutch statistics
 */
export function calculateTeamClutches(
  playerStats: readonly {
    steamId: string;
    name: string;
    clutches: ClutchMetrics;
  }[],
): {
  totalSituations: number;
  won: number;
  successRate: number;
  topClutcher: {
    steamId: string;
    name: string;
    won: number;
    successRate: number;
  } | null;
} {
  let totalSituations = 0;
  let totalWon = 0;
  let topClutcher: {
    steamId: string;
    name: string;
    won: number;
    successRate: number;
  } | null = null;

  for (const player of playerStats) {
    totalSituations += player.clutches.total;
    totalWon += player.clutches.won;

    if (
      !topClutcher ||
      player.clutches.won > topClutcher.won ||
      (player.clutches.won === topClutcher.won &&
        player.clutches.successRate > topClutcher.successRate)
    ) {
      topClutcher = {
        steamId: player.steamId,
        name: player.name,
        won: player.clutches.won,
        successRate: player.clutches.successRate,
      };
    }
  }

  return {
    totalSituations,
    won: totalWon,
    successRate: round2(
      totalSituations > 0 ? (totalWon / totalSituations) * 100 : 0,
    ),
    topClutcher,
  };
}

/**
 * Identify clutch highlights (most impressive clutches)
 */
export function identifyClutchHighlights(
  clutches: ClutchMetrics,
  minOpponents: number = 2,
): {
  type: string;
  count: number;
  successRate: number;
  impressiveness: "legendary" | "amazing" | "impressive" | "notable";
}[] {
  const highlights: {
    type: string;
    count: number;
    successRate: number;
    impressiveness: "legendary" | "amazing" | "impressive" | "notable";
  }[] = [];

  const breakdownKeys: (keyof ClutchBreakdown)[] = [
    "1v1",
    "1v2",
    "1v3",
    "1v4",
    "1v5",
  ];

  for (const key of breakdownKeys) {
    const situation = clutches.breakdown[key];
    const opponents = parseInt(key.replace("1v", ""), 10);

    if (opponents >= minOpponents && situation.wins > 0) {
      let impressiveness: "legendary" | "amazing" | "impressive" | "notable";

      if (opponents >= 4) {
        impressiveness = "legendary";
      } else if (opponents === 3) {
        impressiveness = "amazing";
      } else if (situation.successRate > 50) {
        impressiveness = "impressive";
      } else {
        impressiveness = "notable";
      }

      highlights.push({
        type: key,
        count: situation.wins,
        successRate: situation.successRate,
        impressiveness,
      });
    }
  }

  // Sort by impressiveness
  const order = { legendary: 0, amazing: 1, impressive: 2, notable: 3 };
  highlights.sort((a, b) => order[a.impressiveness] - order[b.impressiveness]);

  return highlights;
}

// ============================================================================
// HELPERS
// ============================================================================

function createEmptyClutchMetrics(): ClutchMetrics {
  return {
    total: 0,
    won: 0,
    lost: 0,
    successRate: 0,
    clutchKills: 0,
    breakdown: {
      "1v1": createClutchSituation(1),
      "1v2": createClutchSituation(2),
      "1v3": createClutchSituation(3),
      "1v4": createClutchSituation(4),
      "1v5": createClutchSituation(5),
    },
    clutches: [],
    bySide: {
      ct: { total: 0, won: 0, successRate: 0, clutchKills: 0 },
      t: { total: 0, won: 0, successRate: 0, clutchKills: 0 },
    },
  };
}

function createClutchSituation(opponents: number): ClutchSituation {
  const key = `1v${opponents}` as keyof typeof EXPECTED_CLUTCH_RATES;
  return {
    attempts: 0,
    wins: 0,
    successRate: 0,
    expectedRate: EXPECTED_CLUTCH_RATES[key] ?? 0,
    vsExpected: 0,
  };
}

function createSideClutchStats(stats: {
  total: number;
  won: number;
  clutchKills: number;
}): SideClutchStats {
  return {
    total: stats.total,
    won: stats.won,
    successRate: round2(stats.total > 0 ? (stats.won / stats.total) * 100 : 0),
    clutchKills: stats.clutchKills,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
