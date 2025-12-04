/**
 * Player Profile Aggregation Calculator
 *
 * Pure functions for aggregating player statistics across multiple matches.
 * Takes match-level data and produces comprehensive player profiles.
 *
 * @module analysis/calculators/aggregation/player-profile
 */

import type {
  AggregatedPlayerProfile,
  AggregatedCoreStats,
  AggregatedCombatStats,
  AggregatedPerformanceStats,
  AggregatedTradeStats,
  AggregatedOpeningStats,
  AggregatedClutchStats,
  AggregatedUtilityStats,
  AggregatedEconomyStats,
  SideSpecificCombat,
  BuyTypePerformance,
  AggregatedClutchByOpponent,
  MatchRatingEntry,
  ConsistencyMetrics,
  PeakPerformances,
  MatchPeak,
  Achievement,
  AchievementType,
  PlayerFormAnalysis,
  TrendAnalysis,
  PlayerPercentiles,
  SkillTier,
  AggregationPeriod,
  PlayerIdentity,
  AggregationMetadata,
} from "../../types/aggregation.types";

import {
  mean,
  weightedMean,
  standardDeviation,
  safeRate,
  safePercentage,
  calculateKD,
  calculateADR,
  calculateConsistency,
  calculateFloorCeiling,
  linearRegression,
  determineTrend,
  determineForm,
  createDistribution,
  RATING_BUCKETS,
  calculateStreaks,
  calculateRatingStreak,
  sumBy,
  avgBy,
  countWhere,
  percentileRank,
} from "./stats.calculator";

// =============================================================================
// INPUT TYPES (Raw data from database/analysis)
// =============================================================================

/**
 * Match data for a single player (input to aggregation)
 */
export interface PlayerMatchData {
  readonly demoId: string;
  readonly playedAt: Date;
  readonly mapName: string;
  readonly won: boolean;
  readonly draw: boolean;

  /** Basic stats */
  readonly kills: number;
  readonly deaths: number;
  readonly assists: number;
  readonly damage: number;
  readonly headshotKills: number;
  readonly mvps: number;
  readonly roundsPlayed: number;
  readonly roundsWon: number;

  /** Rating metrics */
  readonly rating: number;
  readonly kast: number;
  readonly impact: number;

  /** Side breakdown */
  readonly ctRounds: number;
  readonly ctKills: number;
  readonly ctDeaths: number;
  readonly ctDamage: number;
  readonly ctRoundsWon: number;
  readonly tRounds: number;
  readonly tKills: number;
  readonly tDeaths: number;
  readonly tDamage: number;
  readonly tRoundsWon: number;

  /** Multi-kills */
  readonly doubleKills: number;
  readonly tripleKills: number;
  readonly quadKills: number;
  readonly aces: number;

  /** Special kills */
  readonly wallbangKills: number;
  readonly noscopeKills: number;
  readonly throughSmokeKills: number;
  readonly blindKills: number;

  /** Trades */
  readonly tradeKills: number;
  readonly timesTraded: number;
  readonly tradeOpportunities: number;

  /** Openings */
  readonly openingKills: number;
  readonly openingDeaths: number;
  readonly openingAttempts: number;

  /** Clutches */
  readonly clutchAttempts: number;
  readonly clutchWins: number;
  readonly clutchVs1Attempts: number;
  readonly clutchVs1Wins: number;
  readonly clutchVs2Attempts: number;
  readonly clutchVs2Wins: number;
  readonly clutchVs3Attempts: number;
  readonly clutchVs3Wins: number;
  readonly clutchVs4Attempts: number;
  readonly clutchVs4Wins: number;
  readonly clutchVs5Attempts: number;
  readonly clutchVs5Wins: number;

  /** Utility */
  readonly flashesThrown: number;
  readonly enemiesFlashed: number;
  readonly flashAssists: number;
  readonly heGrenadesThrown: number;
  readonly heDamage: number;
  readonly smokesThrown: number;
  readonly molotovsThrown: number;
  readonly molotovDamage: number;
  readonly utilityDamage: number;

  /** Economy */
  readonly avgEquipValue: number;
  readonly totalSpent: number;
  readonly pistolRounds: number;
  readonly pistolRoundsWon: number;
  readonly ecoRounds: number;
  readonly ecoRoundsWon: number;
  readonly forceRounds: number;
  readonly forceRoundsWon: number;
  readonly fullBuyRounds: number;
  readonly fullBuyRoundsWon: number;

  /** AWP usage */
  readonly awpRounds: number;
  readonly awpKills: number;
}

// =============================================================================
// CORE STATS AGGREGATION
// =============================================================================

/**
 * Aggregate core statistics
 */
export function aggregateCoreStats(
  matches: readonly PlayerMatchData[],
): AggregatedCoreStats {
  const totalKills = sumBy(matches, (m) => m.kills);
  const totalDeaths = sumBy(matches, (m) => m.deaths);
  const totalAssists = sumBy(matches, (m) => m.assists);
  const totalDamage = sumBy(matches, (m) => m.damage);
  const headshotKills = sumBy(matches, (m) => m.headshotKills);
  const totalMvps = sumBy(matches, (m) => m.mvps);
  const totalRounds = sumBy(matches, (m) => m.roundsPlayed);
  const roundWins = sumBy(matches, (m) => m.roundsWon);

  const matchWins = countWhere(matches, (m) => m.won);
  const matchLosses = countWhere(matches, (m) => !m.won && !m.draw);
  const matchDraws = countWhere(matches, (m) => m.draw);

  return {
    totalKills,
    totalDeaths,
    totalAssists,
    totalDamage,
    headshotKills,
    totalMvps,
    matchWins,
    matchLosses,
    matchDraws,
    roundWins,
    roundLosses: totalRounds - roundWins,
    averages: {
      killsPerMatch: safeRate(totalKills, matches.length),
      deathsPerMatch: safeRate(totalDeaths, matches.length),
      assistsPerMatch: safeRate(totalAssists, matches.length),
      killsPerRound: safeRate(totalKills, totalRounds),
      deathsPerRound: safeRate(totalDeaths, totalRounds),
      damagePerRound: calculateADR(totalDamage, totalRounds),
      headshotPercentage: safePercentage(headshotKills, totalKills),
    },
  };
}

// =============================================================================
// COMBAT STATS AGGREGATION
// =============================================================================

/**
 * Aggregate combat statistics
 */
export function aggregateCombatStats(
  matches: readonly PlayerMatchData[],
): AggregatedCombatStats {
  const totalKills = sumBy(matches, (m) => m.kills);
  const totalDeaths = sumBy(matches, (m) => m.deaths);
  const totalDamage = sumBy(matches, (m) => m.damage);
  const totalRounds = sumBy(matches, (m) => m.roundsPlayed);
  const headshotKills = sumBy(matches, (m) => m.headshotKills);

  const multiKills = {
    doubleKills: sumBy(matches, (m) => m.doubleKills),
    tripleKills: sumBy(matches, (m) => m.tripleKills),
    quadKills: sumBy(matches, (m) => m.quadKills),
    aces: sumBy(matches, (m) => m.aces),
    multiKillRounds:
      sumBy(matches, (m) => m.doubleKills) +
      sumBy(matches, (m) => m.tripleKills) +
      sumBy(matches, (m) => m.quadKills) +
      sumBy(matches, (m) => m.aces),
    multiKillRate: 0,
  };
  multiKills.multiKillRate = safePercentage(
    multiKills.multiKillRounds,
    totalRounds,
  );

  const ctRounds = sumBy(matches, (m) => m.ctRounds);
  const ctKills = sumBy(matches, (m) => m.ctKills);
  const ctDeaths = sumBy(matches, (m) => m.ctDeaths);
  const ctDamage = sumBy(matches, (m) => m.ctDamage);
  const ctRoundsWon = sumBy(matches, (m) => m.ctRoundsWon);

  const tRounds = sumBy(matches, (m) => m.tRounds);
  const tKills = sumBy(matches, (m) => m.tKills);
  const tDeaths = sumBy(matches, (m) => m.tDeaths);
  const tDamage = sumBy(matches, (m) => m.tDamage);
  const tRoundsWon = sumBy(matches, (m) => m.tRoundsWon);

  return {
    kdRatio: calculateKD(totalKills, totalDeaths),
    kdDiff: totalKills - totalDeaths,
    adr: calculateADR(totalDamage, totalRounds),
    hsPercent: safePercentage(headshotKills, totalKills),
    multiKills,
    killTypes: {
      wallbangKills: sumBy(matches, (m) => m.wallbangKills),
      noscopeKills: sumBy(matches, (m) => m.noscopeKills),
      throughSmokeKills: sumBy(matches, (m) => m.throughSmokeKills),
      blindKills: sumBy(matches, (m) => m.blindKills),
      airborneKills: 0, // Not tracked in basic data
    },
    distance: {
      avgKillDistance: 0, // Requires kill-level data
      shortRange: 0,
      mediumRange: 0,
      longRange: 0,
    },
    bySide: {
      ct: aggregateSideCombat(
        ctRounds,
        ctKills,
        ctDeaths,
        ctDamage,
        ctRoundsWon,
      ),
      t: aggregateSideCombat(tRounds, tKills, tDeaths, tDamage, tRoundsWon),
    },
  };
}

function aggregateSideCombat(
  rounds: number,
  kills: number,
  deaths: number,
  damage: number,
  roundsWon: number,
): SideSpecificCombat {
  return {
    roundsPlayed: rounds,
    kills,
    deaths,
    adr: calculateADR(damage, rounds),
    kdRatio: calculateKD(kills, deaths),
    survivalRate: safePercentage(rounds - deaths, rounds),
    winRate: safePercentage(roundsWon, rounds),
  };
}

// =============================================================================
// PERFORMANCE STATS AGGREGATION
// =============================================================================

/**
 * Aggregate performance/rating statistics
 */
export function aggregatePerformanceStats(
  matches: readonly PlayerMatchData[],
): AggregatedPerformanceStats {
  const ratings = matches.map((m) => m.rating);
  const kasts = matches.map((m) => m.kast);
  const impacts = matches.map((m) => m.impact);
  const rounds = matches.map((m) => m.roundsPlayed);

  // Weighted by rounds played
  const avgRating = weightedMean(ratings, rounds);
  const avgKast = weightedMean(kasts, rounds);
  const avgImpact = weightedMean(impacts, rounds);

  const distribution = createDistribution(ratings, RATING_BUCKETS);

  // Create rating history (last 20 matches)
  const recentMatches = [...matches]
    .sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime())
    .slice(0, 20);

  const ratingHistory: MatchRatingEntry[] = recentMatches.map((m) => ({
    demoId: m.demoId,
    playedAt: m.playedAt,
    map: m.mapName,
    rating: m.rating,
    kast: m.kast,
    won: m.won,
  }));

  return {
    avgRating: Number(avgRating.toFixed(2)),
    ratingStdDev: Number(standardDeviation(ratings).toFixed(2)),
    avgKast: Number(avgKast.toFixed(1)),
    kastStdDev: Number(standardDeviation(kasts).toFixed(1)),
    avgImpact: Number(avgImpact.toFixed(2)),
    ratingDistribution: {
      below080: distribution.below080 ?? 0,
      from080to100: distribution.from080to100 ?? 0,
      from100to120: distribution.from100to120 ?? 0,
      from120to140: distribution.from120to140 ?? 0,
      above140: distribution.above140 ?? 0,
    },
    ratingHistory,
  };
}

// =============================================================================
// TRADE STATS AGGREGATION
// =============================================================================

/**
 * Aggregate trade statistics
 */
export function aggregateTradeStats(
  matches: readonly PlayerMatchData[],
): AggregatedTradeStats {
  const tradeKills = sumBy(matches, (m) => m.tradeKills);
  const timesTraded = sumBy(matches, (m) => m.timesTraded);
  const opportunities = sumBy(matches, (m) => m.tradeOpportunities);

  return {
    tradeKills,
    timesTraded,
    tradeSuccessRate: safePercentage(tradeKills, opportunities),
    avgTradeTime: 0, // Requires tick-level data
    entryTrades: {
      attempts: 0, // Requires detailed trade data
      successes: 0,
      successRate: 0,
    },
    postPlantTrades: {
      kills: 0, // Requires situational data
      deaths: 0,
    },
  };
}

// =============================================================================
// OPENING STATS AGGREGATION
// =============================================================================

/**
 * Aggregate opening duel statistics
 */
export function aggregateOpeningStats(
  matches: readonly PlayerMatchData[],
): AggregatedOpeningStats {
  const totalDuels = sumBy(matches, (m) => m.openingAttempts);
  const openingKills = sumBy(matches, (m) => m.openingKills);
  const openingDeaths = sumBy(matches, (m) => m.openingDeaths);
  const totalRounds = sumBy(matches, (m) => m.roundsPlayed);

  // Calculate round win rates after opening outcomes (unused but kept for future use)
  const _roundsAfterOpeningKill = sumBy(
    matches,
    (m) => m.openingKills * 0.7, // Approximation: 70% win rate after opening kill
  );
  const _roundsAfterOpeningDeath = sumBy(
    matches,
    (m) => m.openingDeaths * 0.35, // Approximation: 35% win rate after opening death
  );
  void _roundsAfterOpeningKill;
  void _roundsAfterOpeningDeath;

  return {
    totalDuels,
    openingKills,
    openingDeaths,
    successRate: safePercentage(openingKills, totalDuels),
    attemptRate: safePercentage(totalDuels, totalRounds),
    bySide: {
      ct: {
        duels: 0, // Requires side-specific opening data
        wins: 0,
        successRate: 0,
      },
      t: {
        duels: 0,
        wins: 0,
        successRate: 0,
      },
    },
    impact: {
      roundWinRateAfterOpeningKill: 70, // Placeholder - calculated from actual data
      roundWinRateAfterOpeningDeath: 35,
      roundWinRateDifference: 35,
    },
  };
}

// =============================================================================
// CLUTCH STATS AGGREGATION
// =============================================================================

/**
 * Aggregate clutch statistics
 */
export function aggregateClutchStats(
  matches: readonly PlayerMatchData[],
): AggregatedClutchStats {
  const totalClutches = sumBy(matches, (m) => m.clutchAttempts);
  const clutchesWon = sumBy(matches, (m) => m.clutchWins);
  const totalRounds = sumBy(matches, (m) => m.roundsPlayed);

  const makeClutchBreakdown = (
    attempts: number,
    wins: number,
  ): AggregatedClutchByOpponent => ({
    attempts,
    wins,
    successRate: safePercentage(wins, attempts),
    roundsWonValue: wins * 3000, // Economic value approximation
  });

  return {
    totalClutches,
    clutchesWon,
    successRate: safePercentage(clutchesWon, totalClutches),
    clutchAttemptRate: safePercentage(totalClutches, totalRounds),
    byOpponents: {
      vs1: makeClutchBreakdown(
        sumBy(matches, (m) => m.clutchVs1Attempts),
        sumBy(matches, (m) => m.clutchVs1Wins),
      ),
      vs2: makeClutchBreakdown(
        sumBy(matches, (m) => m.clutchVs2Attempts),
        sumBy(matches, (m) => m.clutchVs2Wins),
      ),
      vs3: makeClutchBreakdown(
        sumBy(matches, (m) => m.clutchVs3Attempts),
        sumBy(matches, (m) => m.clutchVs3Wins),
      ),
      vs4: makeClutchBreakdown(
        sumBy(matches, (m) => m.clutchVs4Attempts),
        sumBy(matches, (m) => m.clutchVs4Wins),
      ),
      vs5: makeClutchBreakdown(
        sumBy(matches, (m) => m.clutchVs5Attempts),
        sumBy(matches, (m) => m.clutchVs5Wins),
      ),
    },
    bySide: {
      ct: { attempts: 0, wins: 0, successRate: 0 }, // Requires side-specific data
      t: { attempts: 0, wins: 0, successRate: 0 },
    },
    pressure: {
      clutchesInCloseGames: 0, // Requires match context
      clutchesInOvertimes: 0,
      matchPointClutches: 0,
    },
  };
}

// =============================================================================
// UTILITY STATS AGGREGATION
// =============================================================================

/**
 * Aggregate utility statistics
 */
export function aggregateUtilityStats(
  matches: readonly PlayerMatchData[],
): AggregatedUtilityStats {
  const totalRounds = sumBy(matches, (m) => m.roundsPlayed);
  const flashesThrown = sumBy(matches, (m) => m.flashesThrown);
  const enemiesFlashed = sumBy(matches, (m) => m.enemiesFlashed);
  const heDamage = sumBy(matches, (m) => m.heDamage);
  const molotovDamage = sumBy(matches, (m) => m.molotovDamage);
  const utilityDamage = sumBy(matches, (m) => m.utilityDamage);

  return {
    flash: {
      thrown: flashesThrown,
      enemiesBlinded: enemiesFlashed,
      avgBlindDuration: 0, // Requires tick-level data
      flashAssists: sumBy(matches, (m) => m.flashAssists),
      flashKills: 0, // Requires kill-level data
      selfFlashes: 0,
      teamFlashes: 0,
      blindEfficiency: safeRate(enemiesFlashed, flashesThrown),
    },
    heGrenade: {
      thrown: sumBy(matches, (m) => m.heGrenadesThrown),
      totalDamage: heDamage,
      enemiesHit: 0, // Requires grenade-level data
      avgDamagePerGrenade: safeRate(
        heDamage,
        sumBy(matches, (m) => m.heGrenadesThrown),
      ),
      kills: 0,
    },
    smoke: {
      thrown: sumBy(matches, (m) => m.smokesThrown),
      effectiveSmokes: 0, // Requires position data
      avgDuration: 18, // Standard smoke duration
    },
    molotov: {
      thrown: sumBy(matches, (m) => m.molotovsThrown),
      totalDamage: molotovDamage,
      enemiesHit: 0,
      avgDamagePerMolotov: safeRate(
        molotovDamage,
        sumBy(matches, (m) => m.molotovsThrown),
      ),
      kills: 0,
      areadenied: 0,
    },
    overall: {
      utilityDamagePerRound: safeRate(utilityDamage, totalRounds),
      utilityCostEfficiency: 0, // Requires economic data
      grenadeAccuracy: 0, // Requires effectiveness data
    },
  };
}

// =============================================================================
// ECONOMY STATS AGGREGATION
// =============================================================================

/**
 * Aggregate economy statistics
 */
export function aggregateEconomyStats(
  matches: readonly PlayerMatchData[],
): AggregatedEconomyStats {
  const totalSpent = sumBy(matches, (m) => m.totalSpent);
  const totalKills = sumBy(matches, (m) => m.kills);
  const totalDamage = sumBy(matches, (m) => m.damage);

  const makeBuyTypePerf = (
    rounds: number,
    roundsWon: number,
    _matchData: readonly PlayerMatchData[],
  ): BuyTypePerformance => ({
    roundsPlayed: rounds,
    kills: 0, // Would need per-round data
    deaths: 0,
    adr: 0,
    rating: 0,
    winRate: safePercentage(roundsWon, rounds),
    survivalRate: 0,
  });

  return {
    totalSpent,
    avgEquipValue: avgBy(matches, (m) => m.avgEquipValue),
    byBuyType: {
      pistol: makeBuyTypePerf(
        sumBy(matches, (m) => m.pistolRounds),
        sumBy(matches, (m) => m.pistolRoundsWon),
        matches,
      ),
      eco: makeBuyTypePerf(
        sumBy(matches, (m) => m.ecoRounds),
        sumBy(matches, (m) => m.ecoRoundsWon),
        matches,
      ),
      forceBuy: makeBuyTypePerf(
        sumBy(matches, (m) => m.forceRounds),
        sumBy(matches, (m) => m.forceRoundsWon),
        matches,
      ),
      fullBuy: makeBuyTypePerf(
        sumBy(matches, (m) => m.fullBuyRounds),
        sumBy(matches, (m) => m.fullBuyRoundsWon),
        matches,
      ),
    },
    saves: {
      saveAttempts: 0, // Requires end-of-round data
      successfulSaves: 0,
      avgSavedValue: 0,
      saveSuccessRate: 0,
    },
    exitFrags: {
      kills: 0, // Requires situational data
      valueGenerated: 0,
    },
    costPerKill: safeRate(totalSpent, totalKills),
    damagePerDollar: safeRate(totalDamage, totalSpent, 1000), // Per $1000
  };
}

// =============================================================================
// CONSISTENCY METRICS
// =============================================================================

/**
 * Calculate consistency metrics
 */
export function calculateConsistencyMetrics(
  matches: readonly PlayerMatchData[],
): ConsistencyMetrics {
  const ratings = matches.map((m) => m.rating);
  const kasts = matches.map((m) => m.kast);
  const adrs = matches.map((m) => calculateADR(m.damage, m.roundsPlayed));

  const floorCeiling = calculateFloorCeiling(ratings);
  const badGameRate = safePercentage(
    countWhere(matches, (m) => m.rating < 0.8),
    matches.length,
  );

  return {
    ratingConsistency: calculateConsistency(ratings),
    kastConsistency: calculateConsistency(kasts),
    adrConsistency: calculateConsistency(adrs),
    floorCeiling: {
      ...floorCeiling,
      reliableMinimum: Number((floorCeiling.floor * 1.05).toFixed(2)),
    },
    variance: {
      overall: Number(standardDeviation(ratings).toFixed(3)),
      byMap: 0, // Requires map-level breakdown
      bySide: 0,
      byEconomy: 0,
      residual: 0,
    },
    badGameRate: Number(badGameRate.toFixed(1)),
  };
}

// =============================================================================
// FORM ANALYSIS
// =============================================================================

/**
 * Calculate player form analysis
 */
export function calculateFormAnalysis(
  matches: readonly PlayerMatchData[],
): PlayerFormAnalysis {
  const sortedMatches = [...matches].sort(
    (a, b) => b.playedAt.getTime() - a.playedAt.getTime(),
  );

  const allRatings = sortedMatches.map((m) => m.rating);
  const recentRatings = allRatings.slice(0, 10);
  const lifetimeAvg = mean(allRatings);
  const recentAvg = mean(recentRatings);

  const current = determineForm(recentRatings, lifetimeAvg);

  // Calculate trend
  const regression = linearRegression(recentRatings.reverse()); // Oldest to newest
  const trend: TrendAnalysis = {
    direction: determineTrend(recentRatings),
    slope: regression.slope,
    confidence: regression.rSquared,
    prediction:
      regression.rSquared > 0.3
        ? Number(
            (
              regression.intercept +
              regression.slope * recentRatings.length
            ).toFixed(2),
          )
        : null,
  };

  // Calculate streaks
  const winResults = sortedMatches.map((m) => m.won);
  const { currentStreak: currentWinStreak, longestStreak: longestWinStreak } =
    calculateStreaks(winResults.map((w) => w === true));
  const { currentStreak: currentLossStreak, longestStreak: longestLossStreak } =
    calculateStreaks(winResults.map((w) => w === false));

  const ratingStreaks = calculateRatingStreak(allRatings, lifetimeAvg);

  // Hot/cold streak detection
  const last3Above11 = recentRatings.slice(0, 3).every((r) => r > 1.1);
  const last3Below09 = recentRatings.slice(0, 3).every((r) => r < 0.9);

  // Bounce back rate
  const badGames = sortedMatches.filter((m) => m.rating < 0.8);
  const bounceBacks = badGames.filter((badGame) => {
    const nextGameIndex = sortedMatches.indexOf(badGame) - 1;
    if (nextGameIndex < 0) return false;
    const nextGame = sortedMatches[nextGameIndex];
    return nextGame ? nextGame.rating >= 1.0 : false;
  }).length;

  return {
    current,
    trend,
    streaks: {
      currentWinStreak,
      currentLossStreak,
      currentRatingStreak: Math.max(
        ratingStreaks.aboveAvg,
        ratingStreaks.belowAvg,
      ),
      longestWinStreak,
      longestLossStreak,
    },
    vsAverage: {
      recentRating: Number(recentAvg.toFixed(2)),
      lifetimeRating: Number(lifetimeAvg.toFixed(2)),
      difference: Number((recentAvg - lifetimeAvg).toFixed(2)),
      isAboveAverage: recentAvg > lifetimeAvg,
    },
    momentum: {
      hotStreak: last3Above11,
      coldStreak: last3Below09,
      bounceBackRate: safePercentage(bounceBacks, badGames.length),
    },
  };
}

// =============================================================================
// PEAK PERFORMANCES
// =============================================================================

/**
 * Calculate peak performances
 */
export function calculatePeakPerformances(
  matches: readonly PlayerMatchData[],
): PeakPerformances {
  if (matches.length === 0) {
    const emptyPeak: MatchPeak = {
      value: 0,
      demoId: "",
      map: "",
      playedAt: new Date(),
      opponent: null,
    };
    return {
      highestRating: emptyPeak,
      highestKills: emptyPeak,
      highestAdr: emptyPeak,
      mostClutches: emptyPeak,
      mostOpeningKills: emptyPeak,
      mostMultiKills: emptyPeak,
      achievements: [],
    };
  }

  const createPeak = (match: PlayerMatchData, value: number): MatchPeak => ({
    value,
    demoId: match.demoId,
    map: match.mapName,
    playedAt: match.playedAt,
    opponent: null,
  });

  // These are guaranteed non-null because we return early if matches is empty
  const byRating = [...matches].sort((a, b) => b.rating - a.rating)[0]!;
  const byKills = [...matches].sort((a, b) => b.kills - a.kills)[0]!;
  const byAdr = [...matches].sort(
    (a, b) =>
      calculateADR(b.damage, b.roundsPlayed) -
      calculateADR(a.damage, a.roundsPlayed),
  )[0]!;
  const byClutches = [...matches].sort(
    (a, b) => b.clutchWins - a.clutchWins,
  )[0]!;
  const byOpenings = [...matches].sort(
    (a, b) => b.openingKills - a.openingKills,
  )[0]!;
  const byMultiKills = [...matches].sort(
    (a, b) =>
      b.doubleKills +
      b.tripleKills +
      b.quadKills +
      b.aces -
      (a.doubleKills + a.tripleKills + a.quadKills + a.aces),
  )[0]!;

  // Calculate achievements
  const achievements: Achievement[] = [];

  const aceCount = sumBy(matches, (m) => m.aces);
  if (aceCount > 0) {
    const lastAce = matches.find((m) => m.aces > 0);
    achievements.push({
      type: "ace" as AchievementType,
      count: aceCount,
      lastAchieved: lastAce?.playedAt ?? new Date(),
    });
  }

  const quadCount = sumBy(matches, (m) => m.quadKills);
  if (quadCount > 0) {
    const lastQuad = matches.find((m) => m.quadKills > 0);
    achievements.push({
      type: "4k" as AchievementType,
      count: quadCount,
      lastAchieved: lastQuad?.playedAt ?? new Date(),
    });
  }

  const clutch1v5 = sumBy(matches, (m) => m.clutchVs5Wins);
  if (clutch1v5 > 0) {
    achievements.push({
      type: "clutch_1v5" as AchievementType,
      count: clutch1v5,
      lastAchieved:
        matches.find((m) => m.clutchVs5Wins > 0)?.playedAt ?? new Date(),
    });
  }

  const rating2Plus = countWhere(matches, (m) => m.rating >= 2.0);
  if (rating2Plus > 0) {
    achievements.push({
      type: "rating_2_plus" as AchievementType,
      count: rating2Plus,
      lastAchieved:
        matches.find((m) => m.rating >= 2.0)?.playedAt ?? new Date(),
    });
  }

  const fortyBombs = countWhere(matches, (m) => m.kills >= 40);
  if (fortyBombs > 0) {
    achievements.push({
      type: "40_bomb" as AchievementType,
      count: fortyBombs,
      lastAchieved: matches.find((m) => m.kills >= 40)?.playedAt ?? new Date(),
    });
  }

  return {
    highestRating: createPeak(byRating, byRating.rating),
    highestKills: createPeak(byKills, byKills.kills),
    highestAdr: createPeak(
      byAdr,
      calculateADR(byAdr.damage, byAdr.roundsPlayed),
    ),
    mostClutches: createPeak(byClutches, byClutches.clutchWins),
    mostOpeningKills: createPeak(byOpenings, byOpenings.openingKills),
    mostMultiKills: createPeak(
      byMultiKills,
      byMultiKills.doubleKills +
        byMultiKills.tripleKills +
        byMultiKills.quadKills +
        byMultiKills.aces,
    ),
    achievements,
  };
}

// =============================================================================
// PERCENTILE CALCULATION
// =============================================================================

/**
 * Calculate player percentiles against peer group
 */
export function calculatePercentiles(
  playerStats: {
    rating: number;
    kast: number;
    adr: number;
    kd: number;
    hsPercent: number;
    openingSuccessRate: number;
    clutchSuccessRate: number;
    impact: number;
    utilityDamage: number;
  },
  peerStats: readonly (typeof playerStats)[],
): PlayerPercentiles {
  const calcPercentile = (
    value: number,
    getter: (s: typeof playerStats) => number,
  ): number => {
    const peerValues = peerStats.map(getter);
    return Number(percentileRank(peerValues, value).toFixed(0));
  };

  const percentiles = {
    rating: calcPercentile(playerStats.rating, (s) => s.rating),
    kast: calcPercentile(playerStats.kast, (s) => s.kast),
    adr: calcPercentile(playerStats.adr, (s) => s.adr),
    kd: calcPercentile(playerStats.kd, (s) => s.kd),
    hsPercent: calcPercentile(playerStats.hsPercent, (s) => s.hsPercent),
    openingSuccessRate: calcPercentile(
      playerStats.openingSuccessRate,
      (s) => s.openingSuccessRate,
    ),
    clutchSuccessRate: calcPercentile(
      playerStats.clutchSuccessRate,
      (s) => s.clutchSuccessRate,
    ),
    impact: calcPercentile(playerStats.impact, (s) => s.impact),
    utilityDamage: calcPercentile(
      playerStats.utilityDamage,
      (s) => s.utilityDamage,
    ),
  };

  // Weighted average for overall percentile
  const weights = {
    rating: 0.25,
    kast: 0.15,
    adr: 0.15,
    kd: 0.1,
    hsPercent: 0.05,
    openingSuccessRate: 0.1,
    clutchSuccessRate: 0.05,
    impact: 0.1,
    utilityDamage: 0.05,
  };

  const overallPercentile =
    percentiles.rating * weights.rating +
    percentiles.kast * weights.kast +
    percentiles.adr * weights.adr +
    percentiles.kd * weights.kd +
    percentiles.hsPercent * weights.hsPercent +
    percentiles.openingSuccessRate * weights.openingSuccessRate +
    percentiles.clutchSuccessRate * weights.clutchSuccessRate +
    percentiles.impact * weights.impact +
    percentiles.utilityDamage * weights.utilityDamage;

  const tier = determineTier(overallPercentile);

  return {
    sampleSize: peerStats.length,
    peerGroup: "all",
    percentiles,
    overallPercentile: Number(overallPercentile.toFixed(0)),
    tier,
  };
}

/**
 * Determine skill tier from percentile
 */
function determineTier(percentile: number): SkillTier {
  if (percentile >= 99) return "S";
  if (percentile >= 95) return "A+";
  if (percentile >= 85) return "A";
  if (percentile >= 70) return "B+";
  if (percentile >= 50) return "B";
  if (percentile >= 30) return "C+";
  if (percentile >= 15) return "C";
  return "D";
}

// =============================================================================
// MAIN AGGREGATION FUNCTION
// =============================================================================

/**
 * Create complete aggregated player profile
 */
export function aggregatePlayerProfile(
  identity: PlayerIdentity,
  matches: readonly PlayerMatchData[],
  peerStats: readonly {
    rating: number;
    kast: number;
    adr: number;
    kd: number;
    hsPercent: number;
    openingSuccessRate: number;
    clutchSuccessRate: number;
    impact: number;
    utilityDamage: number;
  }[],
  windowId:
    | "all_time"
    | "last_90d"
    | "last_30d"
    | "last_7d"
    | "last_10_matches"
    | "last_20_matches" = "all_time",
): Omit<AggregatedPlayerProfile, "byMap" | "weapons" | "role"> {
  const startTime = Date.now();

  if (matches.length === 0) {
    throw new Error("Cannot aggregate profile with no matches");
  }

  const sortedMatches = [...matches].sort(
    (a, b) => a.playedAt.getTime() - b.playedAt.getTime(),
  );

  const coreStats = aggregateCoreStats(matches);
  const combat = aggregateCombatStats(matches);
  const performance = aggregatePerformanceStats(matches);
  const openings = aggregateOpeningStats(matches);
  const clutches = aggregateClutchStats(matches);

  // Build player stats for percentile calculation
  const playerStats = {
    rating: performance.avgRating,
    kast: performance.avgKast,
    adr: combat.adr,
    kd: combat.kdRatio,
    hsPercent: combat.hsPercent,
    openingSuccessRate: openings.successRate,
    clutchSuccessRate: clutches.successRate,
    impact: performance.avgImpact,
    utilityDamage: aggregateUtilityStats(matches).overall.utilityDamagePerRound,
  };

  // Safe access after length validation earlier in the function
  const firstMatch = sortedMatches[0]!;
  const lastMatch = sortedMatches[sortedMatches.length - 1]!;

  const period: AggregationPeriod = {
    window: windowId,
    firstMatch: firstMatch.playedAt,
    lastMatch: lastMatch.playedAt,
    matchCount: matches.length,
    roundCount: sumBy(matches, (m) => m.roundsPlayed),
    daysSpan: Math.ceil(
      (lastMatch.playedAt.getTime() - firstMatch.playedAt.getTime()) /
        (1000 * 60 * 60 * 24),
    ),
  };

  const metadata: AggregationMetadata = {
    computedAt: new Date(),
    version: "1.0.0",
    dataQuality: 100, // Assume complete data
    matchesIncluded: matches.length,
    matchesExcluded: { count: 0, reasons: [] },
    computationTime: Date.now() - startTime,
    warnings: [],
  };

  return {
    identity,
    period,
    coreStats,
    combat,
    performance,
    trades: aggregateTradeStats(matches),
    openings,
    clutches,
    utility: aggregateUtilityStats(matches),
    economy: aggregateEconomyStats(matches),
    form: calculateFormAnalysis(matches),
    percentiles: calculatePercentiles(playerStats, peerStats),
    consistency: calculateConsistencyMetrics(matches),
    peaks: calculatePeakPerformances(matches),
    metadata,
  };
}
