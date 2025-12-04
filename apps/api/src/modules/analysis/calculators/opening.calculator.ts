/**
 * Opening Duel Calculator - First engagement analysis
 *
 * Opening duels are the first kills of each round.
 * They strongly correlate with round wins:
 * - Teams that get the first kill win ~65% of rounds
 * - Opening duel specialists are highly valuable
 *
 * This calculator provides comprehensive opening duel analysis
 * beyond what's in the impact calculator.
 *
 * @module analysis/calculators/opening
 */

import type { KillInput } from "../types/inputs.types";
import type {
  OpeningDuelMetrics,
  OpeningsBySide,
  OpeningRoundCorrelation,
  OpeningDuelEvent,
  OpeningMatchup,
} from "../types/opening.types";
import { groupBy } from "../utils/performance";

/**
 * Input for opening duel calculation
 */
export interface OpeningCalculationInput {
  /** Player's Steam ID */
  readonly steamId: string;

  /** All kills in the match */
  readonly allKills: readonly KillInput[];

  /** Total rounds in the match */
  readonly totalRounds: number;

  /** Demo tick rate (default 64) */
  readonly tickRate?: number;

  /** Round winners (roundNumber -> winning team) */
  readonly roundWinners?: ReadonlyMap<number, number>;

  /** Player's team by round (roundNumber -> team) */
  readonly playerTeamByRound?: ReadonlyMap<number, number>;

  /** Round start ticks (for timing calculations) */
  readonly roundStartTicks?: ReadonlyMap<number, number>;

  /** Player names lookup */
  readonly playerNames?: ReadonlyMap<string, string>;
}

/**
 * Calculate comprehensive opening duel metrics
 *
 * @param input - Player data and match context
 * @returns Opening duel metrics
 */
export function calculateOpeningDuels(
  input: OpeningCalculationInput
): OpeningDuelMetrics {
  const {
    steamId,
    allKills,
    totalRounds,
    tickRate = 64,
    roundWinners,
    playerTeamByRound,
    roundStartTicks,
    playerNames,
  } = input;

  if (allKills.length === 0 || totalRounds === 0) {
    return createEmptyOpeningMetrics();
  }

  // Group kills by round
  const killsByRound = groupBy(allKills, (k) => k.roundNumber);

  // Track opening duels
  const duels: OpeningDuelEvent[] = [];
  let wins = 0;
  let losses = 0;

  // Side-specific tracking
  const ctStats = { wins: 0, losses: 0 };
  const tStats = { wins: 0, losses: 0 };

  // Round correlation tracking
  let roundsWonAfterOpeningWin = 0;
  let roundsLostAfterOpeningWin = 0;
  let roundsWonAfterOpeningLoss = 0;
  let roundsLostAfterOpeningLoss = 0;

  // Matchup tracking
  const matchups = new Map<string, { wins: number; losses: number }>();

  // Process each round
  for (const [roundNumber, roundKills] of killsByRound) {
    if (roundKills.length === 0) continue;

    // Sort by tick to find first kill
    roundKills.sort((a, b) => a.tick - b.tick);
    const firstKill = roundKills[0];
    if (!firstKill) continue;

    const isWin = firstKill.attackerSteamId === steamId;
    const isLoss = firstKill.victimSteamId === steamId;

    if (!isWin && !isLoss) continue; // Player not involved in opening

    // Determine opponent
    const opponentSteamId = isWin
      ? firstKill.victimSteamId
      : firstKill.attackerSteamId;

    // Update matchup tracking
    if (opponentSteamId) {
      const matchup = matchups.get(opponentSteamId) || { wins: 0, losses: 0 };
      if (isWin) matchup.wins++;
      else matchup.losses++;
      matchups.set(opponentSteamId, matchup);
    }

    // Update totals
    if (isWin) {
      wins++;
    } else {
      losses++;
    }

    // Update side stats
    const playerTeam = playerTeamByRound?.get(roundNumber);
    if (playerTeam === 3) {
      // CT
      if (isWin) ctStats.wins++;
      else ctStats.losses++;
    } else if (playerTeam === 2) {
      // T
      if (isWin) tStats.wins++;
      else tStats.losses++;
    }

    // Update round correlation
    const roundWinner = roundWinners?.get(roundNumber);
    if (roundWinner !== undefined && playerTeam !== undefined) {
      const playerWonRound = roundWinner === playerTeam;

      if (isWin) {
        if (playerWonRound) roundsWonAfterOpeningWin++;
        else roundsLostAfterOpeningWin++;
      } else {
        if (playerWonRound) roundsWonAfterOpeningLoss++;
        else roundsLostAfterOpeningLoss++;
      }
    }

    // Calculate time into round
    const roundStart = roundStartTicks?.get(roundNumber) || 0;
    const timeIntoRoundTicks = firstKill.tick - roundStart;
    const timeIntoRoundSeconds = timeIntoRoundTicks / tickRate;

    // Build duel event
    duels.push({
      roundNumber,
      tick: firstKill.tick,
      winner: {
        steamId: isWin ? steamId : (firstKill.attackerSteamId || "unknown"),
        name: isWin
          ? (playerNames?.get(steamId) || "Unknown")
          : (playerNames?.get(firstKill.attackerSteamId || "") || "Unknown"),
        team: isWin ? (playerTeam || 0) : (firstKill.attackerTeam || 0),
      },
      loser: {
        steamId: isWin ? firstKill.victimSteamId : steamId,
        name: isWin
          ? (playerNames?.get(firstKill.victimSteamId) || "Unknown")
          : (playerNames?.get(steamId) || "Unknown"),
        team: isWin ? (firstKill.victimTeam || 0) : (playerTeam || 0),
      },
      weapon: firstKill.weapon,
      headshot: firstKill.headshot,
      roundWinner: roundWinners?.get(roundNumber) || 0,
      timeIntoRound: round2(timeIntoRoundSeconds),
    });
  }

  const total = wins + losses;
  const winRate = total > 0 ? (wins / total) * 100 : 0;

  // Calculate rating impact
  const ratingImpact = totalRounds > 0
    ? (wins * 0.15 + losses * -0.1) / totalRounds
    : 0;

  // Build side stats
  const bySide = buildSideStats(ctStats, tStats);

  // Build round correlation
  const roundCorrelation = buildRoundCorrelation(
    roundsWonAfterOpeningWin,
    roundsLostAfterOpeningWin,
    roundsWonAfterOpeningLoss,
    roundsLostAfterOpeningLoss
  );

  return {
    total,
    wins,
    losses,
    winRate: round2(winRate),
    ratingImpact: round3(ratingImpact),
    bySide,
    roundCorrelation,
    duels,
  };
}

/**
 * Analyze opening matchups against specific opponents
 */
export function analyzeOpeningMatchups(
  steamId: string,
  allKills: readonly KillInput[],
  playerNames?: ReadonlyMap<string, string>
): OpeningMatchup[] {
  const killsByRound = groupBy(allKills, (k) => k.roundNumber);
  const matchups = new Map<
    string,
    { wins: number; losses: number; positions: Set<string> }
  >();

  for (const [, roundKills] of killsByRound) {
    if (roundKills.length === 0) continue;

    roundKills.sort((a, b) => a.tick - b.tick);
    const firstKill = roundKills[0];
    if (!firstKill) continue;

    const isWin = firstKill.attackerSteamId === steamId;
    const isLoss = firstKill.victimSteamId === steamId;

    if (!isWin && !isLoss) continue;

    const opponentSteamId = isWin
      ? firstKill.victimSteamId
      : firstKill.attackerSteamId;

    if (!opponentSteamId) continue;

    const matchup = matchups.get(opponentSteamId) || {
      wins: 0,
      losses: 0,
      positions: new Set<string>(),
    };

    if (isWin) matchup.wins++;
    else matchup.losses++;

    // Track position if available (would need position data)
    matchups.set(opponentSteamId, matchup);
  }

  const results: OpeningMatchup[] = [];

  for (const [opponentSteamId, data] of matchups) {
    const total = data.wins + data.losses;
    if (total < 2) continue; // Need at least 2 encounters

    results.push({
      opponentSteamId,
      opponentName: playerNames?.get(opponentSteamId) || "Unknown",
      wins: data.wins,
      losses: data.losses,
      winRate: round2((data.wins / total) * 100),
      commonPositions: [...data.positions],
    });
  }

  // Sort by total encounters
  results.sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses));

  return results;
}

/**
 * Calculate team opening statistics
 */
export function calculateTeamOpenings(
  playerOpenings: readonly {
    steamId: string;
    name: string;
    openings: OpeningDuelMetrics;
  }[]
): {
  totalWins: number;
  totalLosses: number;
  winRate: number;
  roundWinRateAfterOpening: number;
  primaryEntry: { steamId: string; name: string; openingAttempts: number; winRate: number } | null;
} {
  if (playerOpenings.length === 0) {
    return {
      totalWins: 0,
      totalLosses: 0,
      winRate: 0,
      roundWinRateAfterOpening: 0,
      primaryEntry: null,
    };
  }

  let totalWins = 0;
  let totalLosses = 0;
  let roundsWonAfterOpening = 0;
  let totalOpeningRounds = 0;
  let primaryEntry: { steamId: string; name: string; openingAttempts: number; winRate: number } | null = null;

  for (const player of playerOpenings) {
    totalWins += player.openings.wins;
    totalLosses += player.openings.losses;

    const { roundCorrelation } = player.openings;
    roundsWonAfterOpening +=
      roundCorrelation.roundsWonAfterOpeningWin +
      roundCorrelation.roundsWonAfterOpeningLoss;
    totalOpeningRounds +=
      roundCorrelation.roundsWonAfterOpeningWin +
      roundCorrelation.roundsLostAfterOpeningWin +
      roundCorrelation.roundsWonAfterOpeningLoss +
      roundCorrelation.roundsLostAfterOpeningLoss;

    // Track primary entry fragger
    const attempts = player.openings.total;
    if (!primaryEntry || attempts > primaryEntry.openingAttempts) {
      primaryEntry = {
        steamId: player.steamId,
        name: player.name,
        openingAttempts: attempts,
        winRate: player.openings.winRate,
      };
    }
  }

  const total = totalWins + totalLosses;
  const winRate = total > 0 ? (totalWins / total) * 100 : 0;
  const roundWinRateAfterOpening =
    totalOpeningRounds > 0 ? (roundsWonAfterOpening / totalOpeningRounds) * 100 : 0;

  return {
    totalWins,
    totalLosses,
    winRate: round2(winRate),
    roundWinRateAfterOpening: round2(roundWinRateAfterOpening),
    primaryEntry,
  };
}

/**
 * Get opening duel label
 */
export function getOpeningLabel(winRate: number): string {
  if (winRate >= 60) return "Elite Entry";
  if (winRate >= 55) return "Excellent";
  if (winRate >= 50) return "Good";
  if (winRate >= 45) return "Average";
  if (winRate >= 40) return "Below Average";
  return "Passive Player";
}

// ============================================================================
// HELPERS
// ============================================================================

function buildSideStats(
  ctStats: { wins: number; losses: number },
  tStats: { wins: number; losses: number }
): OpeningsBySide {
  const ctTotal = ctStats.wins + ctStats.losses;
  const tTotal = tStats.wins + tStats.losses;

  return {
    ct: {
      wins: ctStats.wins,
      losses: ctStats.losses,
      winRate: round2(ctTotal > 0 ? (ctStats.wins / ctTotal) * 100 : 0),
      total: ctTotal,
    },
    t: {
      wins: tStats.wins,
      losses: tStats.losses,
      winRate: round2(tTotal > 0 ? (tStats.wins / tTotal) * 100 : 0),
      total: tTotal,
    },
  };
}

function buildRoundCorrelation(
  wonAfterWin: number,
  lostAfterWin: number,
  wonAfterLoss: number,
  lostAfterLoss: number
): OpeningRoundCorrelation {
  const totalAfterWin = wonAfterWin + lostAfterWin;
  const totalAfterLoss = wonAfterLoss + lostAfterLoss;

  return {
    roundsWonAfterOpeningWin: wonAfterWin,
    roundsLostAfterOpeningWin: lostAfterWin,
    winRateAfterOpeningWin: round2(
      totalAfterWin > 0 ? (wonAfterWin / totalAfterWin) * 100 : 0
    ),
    roundsWonAfterOpeningLoss: wonAfterLoss,
    roundsLostAfterOpeningLoss: lostAfterLoss,
    winRateAfterOpeningLoss: round2(
      totalAfterLoss > 0 ? (wonAfterLoss / totalAfterLoss) * 100 : 0
    ),
  };
}

function createEmptyOpeningMetrics(): OpeningDuelMetrics {
  return {
    total: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    ratingImpact: 0,
    bySide: {
      ct: { wins: 0, losses: 0, winRate: 0, total: 0 },
      t: { wins: 0, losses: 0, winRate: 0, total: 0 },
    },
    roundCorrelation: {
      roundsWonAfterOpeningWin: 0,
      roundsLostAfterOpeningWin: 0,
      winRateAfterOpeningWin: 0,
      roundsWonAfterOpeningLoss: 0,
      roundsLostAfterOpeningLoss: 0,
      winRateAfterOpeningLoss: 0,
    },
    duels: [],
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
