/**
 * Team Profile Aggregation Calculator
 *
 * Pure functions for aggregating team statistics across multiple matches.
 * Analyzes team synergy, map pool, and situational performance.
 *
 * @module analysis/calculators/aggregation/team-profile
 */

import type {
  AggregatedTeamProfile,
  TeamIdentity,
  TeamRoster,
  RosterPlayer,
  RosterChange,
  TeamPerformance,
  TeamMapPool,
  TeamMapStats,
  TeamSynergy,
  PlayerPairSynergy,
  TeamSituationalStats,
  TeamEconomyStats,
  TeamCoordination,
  AggregationPeriod,
  AggregationMetadata,
  PlayerRole,
} from "../../types/aggregation.types";

import {
  mean,
  safeRate,
  safePercentage,
  sumBy,
  avgBy,
  groupBy,
  countWhere,
  standardDeviation,
} from "./stats.calculator";

// =============================================================================
// INPUT TYPES
// =============================================================================

/**
 * Match data for a team (input to aggregation)
 */
export interface TeamMatchData {
  readonly demoId: string;
  readonly playedAt: Date;
  readonly mapName: string;
  readonly won: boolean;
  readonly draw: boolean;
  readonly score: number;
  readonly opponentScore: number;
  readonly opponent: string | null;

  /** Round breakdown */
  readonly totalRounds: number;
  readonly roundsWon: number;
  readonly ctRounds: number;
  readonly ctRoundsWon: number;
  readonly tRounds: number;
  readonly tRoundsWon: number;

  /** Situational rounds */
  readonly pistolRoundsPlayed: number;
  readonly pistolRoundsWon: number;
  readonly ecoRoundsPlayed: number;
  readonly ecoRoundsWon: number;
  readonly antiEcoRoundsPlayed: number;
  readonly antiEcoRoundsWon: number;
  readonly forceRoundsPlayed: number;
  readonly forceRoundsWon: number;
  readonly fullBuyRoundsPlayed: number;
  readonly fullBuyRoundsWon: number;

  /** Team combat */
  readonly totalKills: number;
  readonly totalDeaths: number;
  readonly totalDamage: number;
  readonly firstKills: number;
  readonly firstDeaths: number;

  /** Economy */
  readonly avgEquipValue: number;
  readonly totalSpent: number;

  /** Players in this match */
  readonly players: readonly TeamMatchPlayer[];

  /** Match context */
  readonly isOvertime: boolean;
  readonly wasCloseGame: boolean; // Within 3 rounds
  readonly camebackFrom5Down: boolean;
}

/**
 * Player data within a team match
 */
export interface TeamMatchPlayer {
  readonly steamId: string;
  readonly name: string;
  readonly rating: number;
  readonly kills: number;
  readonly deaths: number;
  readonly assists: number;
  readonly adr: number;
  readonly tradeKills: number;
  readonly flashAssists: number;
}

// =============================================================================
// ROSTER ANALYSIS
// =============================================================================

/**
 * Analyze team roster from match history
 */
export function analyzeRoster(
  matches: readonly TeamMatchData[],
  currentRoster: readonly { steamId: string; name: string; role: PlayerRole; joinedAt: Date }[]
): TeamRoster {
  // Get all unique players across matches
  const playerAppearances = new Map<string, { name: string; firstSeen: Date; lastSeen: Date; matches: number }>();

  for (const match of matches) {
    for (const player of match.players) {
      const existing = playerAppearances.get(player.steamId);
      if (existing) {
        existing.lastSeen = match.playedAt > existing.lastSeen ? match.playedAt : existing.lastSeen;
        existing.firstSeen = match.playedAt < existing.firstSeen ? match.playedAt : existing.firstSeen;
        existing.matches++;
      } else {
        playerAppearances.set(player.steamId, {
          name: player.name,
          firstSeen: match.playedAt,
          lastSeen: match.playedAt,
          matches: 1,
        });
      }
    }
  }

  // Build current roster entries
  const current: RosterPlayer[] = currentRoster.map((p) => ({
    steamId: p.steamId,
    name: p.name,
    role: p.role,
    joinedAt: p.joinedAt,
    matchesWithTeam: playerAppearances.get(p.steamId)?.matches ?? 0,
  }));

  // Calculate average tenure
  const tenures = current.map((p) => {
    const appearance = playerAppearances.get(p.steamId);
    if (!appearance) return 0;
    return (Date.now() - p.joinedAt.getTime()) / (1000 * 60 * 60 * 24);
  });
  const avgTenure = mean(tenures);

  // Calculate stability (inverse of roster changes)
  const matchesSorted = [...matches].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
  let rosterChanges = 0;
  let previousPlayers = new Set<string>();

  for (const match of matchesSorted) {
    const currentPlayers = new Set(match.players.map((p) => p.steamId));

    if (previousPlayers.size > 0) {
      // Count players who left or joined
      for (const p of previousPlayers) {
        if (!currentPlayers.has(p)) rosterChanges++;
      }
      for (const p of currentPlayers) {
        if (!previousPlayers.has(p)) rosterChanges++;
      }
    }

    previousPlayers = currentPlayers;
  }

  const changesPerMatch = safeRate(rosterChanges, matches.length);
  const stability = Math.max(0, 100 - changesPerMatch * 20);

  // Detect roster changes (simplified)
  const changes: RosterChange[] = [];

  return {
    current,
    avgTenure: Math.round(avgTenure),
    stability: Math.round(stability),
    changes,
  };
}

// =============================================================================
// TEAM PERFORMANCE
// =============================================================================

/**
 * Calculate team performance metrics
 */
export function calculateTeamPerformance(
  matches: readonly TeamMatchData[]
): TeamPerformance {
  const wins = countWhere(matches, (m) => m.won);
  const losses = countWhere(matches, (m) => !m.won && !m.draw);
  const draws = countWhere(matches, (m) => m.draw);

  const roundsWon = sumBy(matches, (m) => m.roundsWon);
  const roundsLost = sumBy(matches, (m) => m.totalRounds - m.roundsWon);

  // Calculate average team rating
  const teamRatings = matches.map((m) => mean(m.players.map((p) => p.rating)));
  const avgTeamRating = mean(teamRatings);

  // Calculate combined ADR
  const totalDamage = sumBy(matches, (m) => m.totalDamage);
  const totalRounds = sumBy(matches, (m) => m.totalRounds);
  const combinedAdr = safeRate(totalDamage, totalRounds);

  // Find best player
  const playerStats = new Map<string, { name: string; ratings: number[]; matches: number }>();

  for (const match of matches) {
    for (const player of match.players) {
      const existing = playerStats.get(player.steamId);
      if (existing) {
        existing.ratings.push(player.rating);
        existing.matches++;
      } else {
        playerStats.set(player.steamId, {
          name: player.name,
          ratings: [player.rating],
          matches: 1,
        });
      }
    }
  }

  let bestPlayer = { steamId: "", name: "", avgRating: 0 };
  let mostConsistent = { steamId: "", name: "", consistency: 0 };

  for (const [steamId, stats] of playerStats) {
    if (stats.matches < 3) continue; // Need minimum matches

    const avgRating = mean(stats.ratings);
    if (avgRating > bestPlayer.avgRating) {
      bestPlayer = { steamId, name: stats.name, avgRating: Number(avgRating.toFixed(2)) };
    }

    const consistency = 100 - standardDeviation(stats.ratings) * 100;
    if (consistency > mostConsistent.consistency) {
      mostConsistent = { steamId, name: stats.name, consistency: Number(consistency.toFixed(1)) };
    }
  }

  return {
    record: {
      wins,
      losses,
      draws,
      winRate: safePercentage(wins, matches.length),
    },
    rounds: {
      won: roundsWon,
      lost: roundsLost,
      winRate: safePercentage(roundsWon, roundsWon + roundsLost),
    },
    avgTeamRating: Number(avgTeamRating.toFixed(2)),
    combinedAdr: Number(combinedAdr.toFixed(1)),
    bestPlayer,
    mostConsistent,
  };
}

// =============================================================================
// MAP POOL ANALYSIS
// =============================================================================

/**
 * Analyze team map pool
 */
export function analyzeMapPool(matches: readonly TeamMatchData[]): TeamMapPool {
  const mapGroups = groupBy(matches, (m) => m.mapName);

  const maps: TeamMapStats[] = [];

  for (const [mapName, mapMatches] of Object.entries(mapGroups)) {
    const wins = countWhere(mapMatches, (m) => m.won);
    const winRate = safePercentage(wins, mapMatches.length);

    const roundDiffs = mapMatches.map((m) => m.roundsWon - (m.totalRounds - m.roundsWon));
    const avgRoundDiff = mean(roundDiffs);

    const ctRoundsWon = sumBy(mapMatches, (m) => m.ctRoundsWon);
    const ctRoundsPlayed = sumBy(mapMatches, (m) => m.ctRounds);
    const tRoundsWon = sumBy(mapMatches, (m) => m.tRoundsWon);
    const tRoundsPlayed = sumBy(mapMatches, (m) => m.tRounds);

    // Determine preference level
    let preference: TeamMapStats["preference"];
    if (winRate >= 65 && mapMatches.length >= 5) {
      preference = "strong";
    } else if (winRate >= 55 || (winRate >= 50 && mapMatches.length >= 10)) {
      preference = "comfortable";
    } else if (winRate >= 45) {
      preference = "developing";
    } else if (winRate >= 35) {
      preference = "weak";
    } else {
      preference = "avoid";
    }

    maps.push({
      mapName,
      matchesPlayed: mapMatches.length,
      winRate: Number(winRate.toFixed(1)),
      avgRoundDiff: Number(avgRoundDiff.toFixed(1)),
      ctWinRate: safePercentage(ctRoundsWon, ctRoundsPlayed),
      tWinRate: safePercentage(tRoundsWon, tRoundsPlayed),
      preference,
    });
  }

  // Sort by win rate
  maps.sort((a, b) => b.winRate - a.winRate);

  // Recommended picks (top 3 strong/comfortable maps)
  const recommendedPicks = maps
    .filter((m) => m.preference === "strong" || m.preference === "comfortable")
    .slice(0, 3)
    .map((m) => m.mapName);

  // Recommended bans (weak/avoid maps)
  const recommendedBans = maps
    .filter((m) => m.preference === "weak" || m.preference === "avoid")
    .map((m) => m.mapName);

  // Map pool depth
  const viableMaps = maps.filter(
    (m) => m.matchesPlayed >= 3 && (m.preference === "strong" || m.preference === "comfortable")
  ).length;

  return {
    maps,
    recommendedPicks,
    recommendedBans,
    depth: viableMaps,
  };
}

// =============================================================================
// TEAM SYNERGY
// =============================================================================

/**
 * Calculate team synergy metrics
 */
export function calculateTeamSynergy(matches: readonly TeamMatchData[]): TeamSynergy {
  const _totalRounds = sumBy(matches, (m) => m.totalRounds);
  void _totalRounds; // Available for future metrics

  // Calculate trade efficiency
  const totalTradeKills = sumBy(matches, (m) => sumBy(m.players, (p) => p.tradeKills));
  const totalDeaths = sumBy(matches, (m) => m.totalDeaths);
  const tradeEfficiency = safePercentage(totalTradeKills, totalDeaths * 0.6); // ~60% of deaths are tradeable

  // Calculate flash assist rate
  const totalFlashAssists = sumBy(matches, (m) => sumBy(m.players, (p) => p.flashAssists));
  const totalKills = sumBy(matches, (m) => m.totalKills);
  const flashAssistRate = safePercentage(totalFlashAssists, totalKills);

  // Calculate player pair synergies
  const pairStats = new Map<string, {
    player1: { steamId: string; name: string };
    player2: { steamId: string; name: string };
    trades: number;
    flashAssists: number;
    combinedKills: number;
    matches: number;
  }>();

  for (const match of matches) {
    const players = match.players;

    // Create all unique pairs
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const p1 = players[i];
        const p2 = players[j];

        // Skip if either player is undefined
        if (!p1 || !p2) continue;

        // Sort by steamId for consistent key
        const [first, second] = p1.steamId < p2.steamId ? [p1, p2] : [p2, p1];
        const pairKey = `${first.steamId}-${second.steamId}`;

        const existing = pairStats.get(pairKey);
        if (existing) {
          existing.trades += p1.tradeKills + p2.tradeKills;
          existing.flashAssists += p1.flashAssists + p2.flashAssists;
          existing.combinedKills += p1.kills + p2.kills;
          existing.matches++;
        } else {
          pairStats.set(pairKey, {
            player1: { steamId: first.steamId, name: first.name },
            player2: { steamId: second.steamId, name: second.name },
            trades: p1.tradeKills + p2.tradeKills,
            flashAssists: p1.flashAssists + p2.flashAssists,
            combinedKills: p1.kills + p2.kills,
            matches: 1,
          });
        }
      }
    }
  }

  // Convert to array and calculate synergy scores
  const playerPairs: PlayerPairSynergy[] = [];

  for (const [, stats] of pairStats) {
    if (stats.matches < 3) continue; // Need minimum matches

    const tradingFrequency = safeRate(stats.trades, stats.matches);
    const flashAssistRatePerMatch = safeRate(stats.flashAssists, stats.matches);

    // Synergy score combines trading and flash assists
    const synergyScore = Math.min(100, tradingFrequency * 20 + flashAssistRatePerMatch * 30);

    playerPairs.push({
      player1: stats.player1,
      player2: stats.player2,
      synergyScore: Number(synergyScore.toFixed(1)),
      tradingFrequency: Number(tradingFrequency.toFixed(2)),
      flashAssistRate: Number(flashAssistRatePerMatch.toFixed(2)),
      combinedKillsInSameRound: Math.round(stats.combinedKills / stats.matches),
    });
  }

  // Sort by synergy score
  playerPairs.sort((a, b) => b.synergyScore - a.synergyScore);

  // Calculate overall synergy
  const avgSynergy = playerPairs.length > 0 ? mean(playerPairs.map((p) => p.synergyScore)) : 50;

  return {
    overallScore: Number(avgSynergy.toFixed(1)),
    tradeEfficiency: Number(tradeEfficiency.toFixed(1)),
    flashAssistRate: Number(flashAssistRate.toFixed(1)),
    crossfireSuccess: 0, // Requires position data
    playerPairs: playerPairs.slice(0, 10), // Top 10 pairs
    entrySupport: {
      successRate: 0, // Requires detailed entry data
      avgTimeBetweenEntryAndSupport: 0,
    },
  };
}

// =============================================================================
// SITUATIONAL STATS
// =============================================================================

/**
 * Calculate situational performance
 */
export function calculateSituationalStats(
  matches: readonly TeamMatchData[]
): TeamSituationalStats {
  // Pistol rounds
  const pistolPlayed = sumBy(matches, (m) => m.pistolRoundsPlayed);
  const pistolWon = sumBy(matches, (m) => m.pistolRoundsWon);

  // CT pistols are in first round of each half
  // This is an approximation - proper calculation needs round-level data
  const ctPistolRate = 50; // Placeholder
  const tPistolRate = 50; // Placeholder

  // Anti-eco rounds
  const antiEcoPlayed = sumBy(matches, (m) => m.antiEcoRoundsPlayed);
  const antiEcoWon = sumBy(matches, (m) => m.antiEcoRoundsWon);

  // Force buy rounds
  const forcePlayed = sumBy(matches, (m) => m.forceRoundsPlayed);
  const forceWon = sumBy(matches, (m) => m.forceRoundsWon);

  // Close games
  const closeGames = matches.filter((m) => m.wasCloseGame);
  const closeGamesWon = countWhere(closeGames, (m) => m.won);

  // Overtime games (available for future metrics)
  const _overtimeGames = matches.filter((m) => m.isOvertime);
  void _overtimeGames;

  // Mental fortitude = performance in close games vs overall
  const overallWinRate = safePercentage(countWhere(matches, (m) => m.won), matches.length);
  const closeWinRate = safePercentage(closeGamesWon, closeGames.length);
  const mentalFortitude = 50 + (closeWinRate - overallWinRate); // 50 is neutral

  // Comebacks
  const from5Down = matches.filter((m) => m.camebackFrom5Down);

  return {
    pistolRounds: {
      played: pistolPlayed,
      won: pistolWon,
      winRate: safePercentage(pistolWon, pistolPlayed),
      ctWinRate: ctPistolRate,
      tWinRate: tPistolRate,
    },
    antiEco: {
      played: antiEcoPlayed,
      won: antiEcoWon,
      winRate: safePercentage(antiEcoWon, antiEcoPlayed),
      avgKillsGained: 0, // Requires round-level data
    },
    forceBuy: {
      played: forcePlayed,
      won: forceWon,
      winRate: safePercentage(forceWon, forcePlayed),
    },
    closeGames: {
      played: closeGames.length,
      won: closeGamesWon,
      winRate: safePercentage(closeGamesWon, closeGames.length),
      mentalFortitude: Number(Math.max(0, Math.min(100, mentalFortitude)).toFixed(1)),
    },
    comebacks: {
      from5RoundsDown: {
        attempts: from5Down.length,
        successes: countWhere(from5Down, (m) => m.won),
      },
      from10RoundsDown: {
        attempts: 0, // Would need more detailed data
        successes: 0,
      },
    },
  };
}

// =============================================================================
// TEAM ECONOMY
// =============================================================================

/**
 * Calculate team economy stats
 */
export function calculateTeamEconomy(matches: readonly TeamMatchData[]): TeamEconomyStats {
  const avgEquipValue = avgBy(matches, (m) => m.avgEquipValue);

  // Buy coordination - how often the team buys together
  // This is simplified - proper calculation needs per-player economy data
  const buyCoordination = 75; // Placeholder

  return {
    avgEquipValue: Number(avgEquipValue.toFixed(0)),
    buyCoordination,
    decisionMaking: {
      correctEcos: 0, // Requires detailed economy analysis
      correctForces: 0,
      correctFullBuys: 0,
    },
    saveSuccess: 0, // Requires save attempt tracking
  };
}

// =============================================================================
// TEAM COORDINATION
// =============================================================================

/**
 * Calculate team coordination metrics
 */
export function calculateTeamCoordination(
  _matches: readonly TeamMatchData[]
): TeamCoordination {
  // These metrics require detailed tick-level and position data
  // Returning reasonable defaults
  // _matches parameter is for future use when we have position data

  return {
    executeTiming: 50, // Placeholder
    defaultToExecute: 50, // Placeholder
    rotateCoordination: 50, // Placeholder
    clutchSupport: 50, // Placeholder
  };
}

// =============================================================================
// MAIN TEAM AGGREGATION
// =============================================================================

/**
 * Create complete aggregated team profile
 */
export function aggregateTeamProfile(
  identity: TeamIdentity,
  matches: readonly TeamMatchData[],
  currentRoster: readonly { steamId: string; name: string; role: PlayerRole; joinedAt: Date }[],
  windowId: "all_time" | "last_90d" | "last_30d" | "last_7d" | "last_10_matches" | "last_20_matches" = "all_time"
): AggregatedTeamProfile {
  const startTime = Date.now();

  if (matches.length === 0) {
    throw new Error("Cannot aggregate team profile with no matches");
  }

  const sortedMatches = [...matches].sort(
    (a, b) => a.playedAt.getTime() - b.playedAt.getTime()
  );

  const firstMatch = sortedMatches[0]!;
  const lastMatch = sortedMatches[sortedMatches.length - 1]!;

  const period: AggregationPeriod = {
    window: windowId,
    firstMatch: firstMatch.playedAt,
    lastMatch: lastMatch.playedAt,
    matchCount: matches.length,
    roundCount: sumBy(matches, (m) => m.totalRounds),
    daysSpan: Math.ceil(
      (lastMatch.playedAt.getTime() - firstMatch.playedAt.getTime()) /
        (1000 * 60 * 60 * 24)
    ),
  };

  const metadata: AggregationMetadata = {
    computedAt: new Date(),
    version: "1.0.0",
    dataQuality: 100,
    matchesIncluded: matches.length,
    matchesExcluded: { count: 0, reasons: [] },
    computationTime: Date.now() - startTime,
    warnings: [],
  };

  return {
    identity,
    roster: analyzeRoster(matches, currentRoster),
    period,
    performance: calculateTeamPerformance(matches),
    mapPool: analyzeMapPool(matches),
    synergy: calculateTeamSynergy(matches),
    situations: calculateSituationalStats(matches),
    economy: calculateTeamEconomy(matches),
    coordination: calculateTeamCoordination(matches),
    metadata,
  };
}
