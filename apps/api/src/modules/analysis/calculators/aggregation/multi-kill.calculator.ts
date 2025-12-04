/**
 * Multi-Kill Calculator
 *
 * Calculates multi-kill statistics from kill events.
 * Multi-kills are consecutive kills within the same round.
 *
 * Types:
 * - Double Kill (2K): 2 kills in a round
 * - Triple Kill (3K): 3 kills in a round
 * - Quad Kill (4K): 4 kills in a round
 * - Ace (5K): 5 kills in a round (entire enemy team)
 *
 * Also tracks special kill types:
 * - Wallbang: Kill through penetrable surface
 * - Noscope: AWP/Scout kill without scoping
 * - Through Smoke: Kill while smoke is active
 * - Blind Kill: Kill while flashbanged
 *
 * @module analysis/calculators/aggregation/multi-kill
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Kill event data for multi-kill analysis
 */
export interface KillEventData {
  readonly roundId: string;
  readonly tick: number;
  readonly attackerSteamId: string | null;
  readonly victimSteamId: string;
  readonly headshot: boolean;
  readonly penetrated: number; // > 0 = wallbang
  readonly noscope: boolean;
  readonly thrusmoke: boolean;
  readonly attackerblind: boolean;
  readonly weapon: string;
  readonly isTradeKill: boolean;
}

/**
 * Multi-kill statistics result
 */
export interface MultiKillStats {
  /** Number of 2-kill rounds */
  readonly doubleKills: number;
  /** Number of 3-kill rounds */
  readonly tripleKills: number;
  /** Number of 4-kill rounds */
  readonly quadKills: number;
  /** Number of 5-kill rounds (aces) */
  readonly aces: number;
  /** Total multi-kill rounds */
  readonly totalMultiKillRounds: number;
}

/**
 * Special kill statistics result
 */
export interface SpecialKillStats {
  /** Kills through penetrable surfaces */
  readonly wallbangKills: number;
  /** AWP/Scout kills without scoping */
  readonly noscopeKills: number;
  /** Kills while smoke is active nearby */
  readonly throughSmokeKills: number;
  /** Kills while flashbanged */
  readonly blindKills: number;
}

/**
 * Trade kill statistics
 */
export interface TradeKillStats {
  /** Kills that avenged a teammate within trade window */
  readonly tradeKills: number;
  /** Times player was traded after dying */
  readonly timesTraded: number;
  /** Deaths that could have been traded */
  readonly tradeOpportunities: number;
  /** Trade success rate (trades / opportunities) */
  readonly tradeRate: number;
}

/**
 * Complete kill analysis result
 */
export interface KillAnalysisResult {
  readonly multiKills: MultiKillStats;
  readonly specialKills: SpecialKillStats;
  readonly tradeKills: TradeKillStats;
}

// =============================================================================
// CALCULATORS
// =============================================================================

/**
 * Calculate multi-kill statistics for a player
 *
 * @param kills - Kill events where player was attacker
 * @param playerSteamId - Steam ID of the player to analyze
 * @returns Multi-kill breakdown
 */
export function calculateMultiKills(
  kills: readonly KillEventData[],
  playerSteamId: string
): MultiKillStats {
  // Filter to player's kills
  const playerKills = kills.filter((k) => k.attackerSteamId === playerSteamId);

  // Group kills by round
  const killsByRound = new Map<string, number>();
  for (const kill of playerKills) {
    const count = killsByRound.get(kill.roundId) ?? 0;
    killsByRound.set(kill.roundId, count + 1);
  }

  // Count multi-kill types
  let doubleKills = 0;
  let tripleKills = 0;
  let quadKills = 0;
  let aces = 0;

  for (const [, count] of killsByRound) {
    if (count === 2) doubleKills++;
    else if (count === 3) tripleKills++;
    else if (count === 4) quadKills++;
    else if (count >= 5) aces++;
  }

  return {
    doubleKills,
    tripleKills,
    quadKills,
    aces,
    totalMultiKillRounds: doubleKills + tripleKills + quadKills + aces,
  };
}

/**
 * Calculate special kill statistics for a player
 *
 * @param kills - Kill events where player was attacker
 * @param playerSteamId - Steam ID of the player to analyze
 * @returns Special kill breakdown
 */
export function calculateSpecialKills(
  kills: readonly KillEventData[],
  playerSteamId: string
): SpecialKillStats {
  const playerKills = kills.filter((k) => k.attackerSteamId === playerSteamId);

  let wallbangKills = 0;
  let noscopeKills = 0;
  let throughSmokeKills = 0;
  let blindKills = 0;

  for (const kill of playerKills) {
    if (kill.penetrated > 0) wallbangKills++;
    if (kill.noscope) noscopeKills++;
    if (kill.thrusmoke) throughSmokeKills++;
    if (kill.attackerblind) blindKills++;
  }

  return {
    wallbangKills,
    noscopeKills,
    throughSmokeKills,
    blindKills,
  };
}

/**
 * Calculate trade kill statistics for a player
 *
 * @param kills - All kill events in the match
 * @param playerSteamId - Steam ID of the player to analyze
 * @param deaths - Number of deaths for trade opportunity calculation
 * @returns Trade kill statistics
 */
export function calculateTradeKills(
  kills: readonly KillEventData[],
  playerSteamId: string,
  deaths: number
): TradeKillStats {
  // Count trade kills (kills where isTradeKill is true and player is attacker)
  const tradeKills = kills.filter(
    (k) => k.attackerSteamId === playerSteamId && k.isTradeKill
  ).length;

  // Count times player was traded (killed, then their killer was killed within trade window)
  // This is marked as isTradeKill on the subsequent kill
  const timesTraded = kills.filter(
    (k) => k.victimSteamId === playerSteamId && k.isTradeKill
  ).length;

  // Trade opportunities = deaths (could have been traded)
  // Note: Not all deaths are tradeable (last alive, etc.)
  // Using 60% of deaths as realistic trade opportunities
  const tradeOpportunities = Math.round(deaths * 0.6);

  const tradeRate =
    tradeOpportunities > 0
      ? Number(((timesTraded / tradeOpportunities) * 100).toFixed(1))
      : 0;

  return {
    tradeKills,
    timesTraded,
    tradeOpportunities,
    tradeRate,
  };
}

/**
 * Calculate complete kill analysis for a player
 *
 * @param kills - All kill events in the match/demo
 * @param playerSteamId - Steam ID of the player to analyze
 * @param deaths - Total deaths for trade calculation
 * @returns Complete kill analysis
 */
export function analyzeKills(
  kills: readonly KillEventData[],
  playerSteamId: string,
  deaths: number
): KillAnalysisResult {
  return {
    multiKills: calculateMultiKills(kills, playerSteamId),
    specialKills: calculateSpecialKills(kills, playerSteamId),
    tradeKills: calculateTradeKills(kills, playerSteamId, deaths),
  };
}

// =============================================================================
// AGGREGATION HELPERS
// =============================================================================

/**
 * Aggregate multi-kill stats across multiple matches
 */
export function aggregateMultiKills(
  stats: readonly MultiKillStats[]
): MultiKillStats {
  return {
    doubleKills: stats.reduce((sum, s) => sum + s.doubleKills, 0),
    tripleKills: stats.reduce((sum, s) => sum + s.tripleKills, 0),
    quadKills: stats.reduce((sum, s) => sum + s.quadKills, 0),
    aces: stats.reduce((sum, s) => sum + s.aces, 0),
    totalMultiKillRounds: stats.reduce((sum, s) => sum + s.totalMultiKillRounds, 0),
  };
}

/**
 * Aggregate special kill stats across multiple matches
 */
export function aggregateSpecialKills(
  stats: readonly SpecialKillStats[]
): SpecialKillStats {
  return {
    wallbangKills: stats.reduce((sum, s) => sum + s.wallbangKills, 0),
    noscopeKills: stats.reduce((sum, s) => sum + s.noscopeKills, 0),
    throughSmokeKills: stats.reduce((sum, s) => sum + s.throughSmokeKills, 0),
    blindKills: stats.reduce((sum, s) => sum + s.blindKills, 0),
  };
}

/**
 * Aggregate trade kill stats across multiple matches
 */
export function aggregateTradeKills(
  stats: readonly TradeKillStats[]
): TradeKillStats {
  const totalTradeKills = stats.reduce((sum, s) => sum + s.tradeKills, 0);
  const totalTimesTraded = stats.reduce((sum, s) => sum + s.timesTraded, 0);
  const totalOpportunities = stats.reduce((sum, s) => sum + s.tradeOpportunities, 0);

  return {
    tradeKills: totalTradeKills,
    timesTraded: totalTimesTraded,
    tradeOpportunities: totalOpportunities,
    tradeRate:
      totalOpportunities > 0
        ? Number(((totalTimesTraded / totalOpportunities) * 100).toFixed(1))
        : 0,
  };
}
