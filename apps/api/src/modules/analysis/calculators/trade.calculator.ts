/**
 * Trade Calculator - Trade kill analysis
 *
 * A trade occurs when a teammate kills the enemy who killed you
 * within a short time window.
 *
 * Trade success rate is a key indicator of team coordination:
 * - Pro teams: > 60%
 * - Good teams: 50-60%
 * - Average: 40-50%
 * - Poor coordination: < 40%
 *
 * @module analysis/calculators/trade
 */

import type { KillInput, RoundInput } from "../types/inputs.types";
import type {
  TradeMetrics,
  TradeEvent,
  TradeChainMetrics,
  TradeChainEvent,
  TradeChainKill,
  TradeChainLengthBreakdown,
  ChainLengthStats,
  TradeTimingMetrics,
  TradeTimingPhase,
  TradeEffectivenessMetrics,
  TradeRelationship,
  ExtendedTradeMetrics,
  TradeSkillLabel,
} from "../types/trade.types";
import { TRADE_THRESHOLD_TICKS, TICK_RATES } from "../types/constants";
import { groupBy } from "../utils/performance";

/**
 * Input for trade calculation
 */
export interface TradeCalculationInput {
  /** Player's Steam ID */
  readonly steamId: string;

  /** All kills in the match */
  readonly allKills: readonly KillInput[];

  /** Demo tick rate (default 64) */
  readonly tickRate?: number;

  /** Player names lookup (steamId -> name) */
  readonly playerNames?: ReadonlyMap<string, string>;
}

/**
 * Calculate trade metrics for a player
 *
 * @param input - Player data and match kills
 * @returns Trade metrics
 */
export function calculateTrades(input: TradeCalculationInput): TradeMetrics {
  const { steamId, allKills, tickRate = 64, playerNames } = input;

  if (allKills.length === 0) {
    return createEmptyTradeMetrics();
  }

  // Scale threshold based on tick rate
  const tradeThreshold = Math.round(
    (TRADE_THRESHOLD_TICKS / TICK_RATES.MATCHMAKING) * tickRate,
  );

  // Group kills by round for efficient processing
  const killsByRound = groupBy(allKills, (k) => k.roundNumber);

  const trades: TradeEvent[] = [];
  let tradesGiven = 0;
  let tradesReceived = 0;
  let tradeOpportunities = 0;
  let totalTradeTimeTicks = 0;

  // Process each round
  for (const [, roundKills] of killsByRound) {
    // Sort kills by tick
    const sortedKills = [...roundKills].sort((a, b) => a.tick - b.tick);

    // Find player's deaths and trade opportunities
    for (let i = 0; i < sortedKills.length; i++) {
      const kill = sortedKills[i];
      if (!kill) continue;

      // Check if this is a death of our player
      if (kill.victimSteamId === steamId && kill.attackerSteamId) {
        // This is an opportunity for player to be traded
        const killerSteamId = kill.attackerSteamId;

        // Look for a teammate killing the killer
        const tradeKill = sortedKills.find((k, j) => {
          if (j <= i) return false; // Must be after death
          if (k.victimSteamId !== killerSteamId) return false;
          if (k.tick - kill.tick > tradeThreshold) return false;
          if (k.attackerSteamId === steamId) return false; // Can't trade yourself
          return true;
        });

        if (tradeKill && tradeKill.attackerSteamId) {
          tradesReceived++;
          totalTradeTimeTicks += tradeKill.tick - kill.tick;

          trades.push({
            roundNumber: kill.roundNumber,
            tick: tradeKill.tick,
            originalKillTick: kill.tick,
            tradedPlayerSteamId: steamId,
            tradedPlayerName: playerNames?.get(steamId) ?? "Unknown",
            traderSteamId: tradeKill.attackerSteamId,
            traderName:
              playerNames?.get(tradeKill.attackerSteamId) ?? "Unknown",
            enemySteamId: killerSteamId,
            enemyName: playerNames?.get(killerSteamId) ?? "Unknown",
            tradeTimeTicks: tradeKill.tick - kill.tick,
            tradeTimeSeconds: (tradeKill.tick - kill.tick) / tickRate,
            weapon: tradeKill.weapon,
            headshot: tradeKill.headshot,
          });
        }
      }

      // Check if our player traded a teammate
      if (kill.attackerSteamId === steamId) {
        // Find if this was trading a teammate's death
        const tradedDeath = sortedKills.find((k, j) => {
          if (j >= i) return false; // Must be before this kill
          if (k.attackerSteamId !== kill.victimSteamId) return false; // Victim must have killed the teammate
          if (kill.tick - k.tick > tradeThreshold) return false;
          if (k.victimSteamId === steamId) return false; // Don't count our own death
          return true;
        });

        if (tradedDeath) {
          tradesGiven++;
        }
      }
    }

    // Count trade opportunities (teammate deaths where enemy was killable)
    for (const kill of sortedKills) {
      if (
        kill.victimSteamId !== steamId &&
        kill.attackerSteamId &&
        kill.attackerSteamId !== steamId
      ) {
        // A teammate died - was there an opportunity to trade?
        // Simplified: count all teammate deaths where enemy lived a bit
        const enemyDied = sortedKills.find(
          (k) =>
            k.victimSteamId === kill.attackerSteamId &&
            k.tick > kill.tick &&
            k.tick - kill.tick <= tradeThreshold,
        );

        // It's an opportunity if we could have made the trade
        // (i.e., player was alive and could have killed the enemy)
        tradeOpportunities++;
        if (enemyDied) {
          // Someone traded it
        }
      }
    }
  }

  const avgTradeTimeTicks =
    tradesReceived > 0 ? totalTradeTimeTicks / tradesReceived : 0;

  return {
    tradesGiven,
    tradesReceived,
    tradeSuccessRate: round2(
      tradeOpportunities > 0 ? (tradesGiven / tradeOpportunities) * 100 : 0,
    ),
    tradeOpportunities,
    avgTradeTimeTicks: round2(avgTradeTimeTicks),
    avgTradeTimeSeconds: round2(avgTradeTimeTicks / tickRate),
    trades,
  };
}

/**
 * Calculate team trade statistics
 */
export function calculateTeamTrades(
  teamSteamIds: readonly string[],
  allKills: readonly KillInput[],
  tickRate: number = 64,
  playerNames?: ReadonlyMap<string, string>,
): {
  totalTradesGiven: number;
  totalTradesReceived: number;
  tradeSuccessRate: number;
  avgTradeTime: number;
  playerTrades: Map<string, TradeMetrics>;
} {
  const playerTrades = new Map<string, TradeMetrics>();

  let totalTradesGiven = 0;
  let totalOpportunities = 0;
  let totalTradeTime = 0;
  let tradeCount = 0;

  for (const steamId of teamSteamIds) {
    const tradeInput: TradeCalculationInput = {
      steamId,
      allKills,
      tickRate,
    };
    if (playerNames) {
      (
        tradeInput as { playerNames?: ReadonlyMap<string, string> }
      ).playerNames = playerNames;
    }
    const trades = calculateTrades(tradeInput);

    playerTrades.set(steamId, trades);

    totalTradesGiven += trades.tradesGiven;
    totalOpportunities += trades.tradeOpportunities;
    totalTradeTime += trades.avgTradeTimeTicks * trades.tradesReceived;
    tradeCount += trades.tradesReceived;
  }

  return {
    totalTradesGiven,
    totalTradesReceived: tradeCount,
    tradeSuccessRate: round2(
      totalOpportunities > 0
        ? (totalTradesGiven / totalOpportunities) * 100
        : 0,
    ),
    avgTradeTime: round2(
      tradeCount > 0 ? totalTradeTime / tradeCount / tickRate : 0,
    ),
    playerTrades,
  };
}

/**
 * Identify trade relationships (who trades whom)
 */
export function analyzeTradeRelationships(
  teamSteamIds: readonly string[],
  allKills: readonly KillInput[],
  tickRate: number = 64,
): Map<string, Map<string, number>> {
  const relationships = new Map<string, Map<string, number>>();

  // Initialize
  for (const steamId of teamSteamIds) {
    relationships.set(steamId, new Map());
  }

  const tradeThreshold = Math.round(
    (TRADE_THRESHOLD_TICKS / TICK_RATES.MATCHMAKING) * tickRate,
  );

  const killsByRound = groupBy(allKills, (k) => k.roundNumber);

  for (const [, roundKills] of killsByRound) {
    const sortedKills = [...roundKills].sort((a, b) => a.tick - b.tick);

    for (let i = 0; i < sortedKills.length; i++) {
      const death = sortedKills[i];
      if (!death) continue;

      // Check if a teammate died
      if (teamSteamIds.includes(death.victimSteamId) && death.attackerSteamId) {
        // Look for trade
        for (let j = i + 1; j < sortedKills.length; j++) {
          const tradeKill = sortedKills[j];
          if (!tradeKill) continue;

          if (tradeKill.tick - death.tick > tradeThreshold) break;

          if (
            tradeKill.victimSteamId === death.attackerSteamId &&
            tradeKill.attackerSteamId &&
            teamSteamIds.includes(tradeKill.attackerSteamId)
          ) {
            // Found a trade
            const traderMap = relationships.get(tradeKill.attackerSteamId);
            if (traderMap) {
              const current = traderMap.get(death.victimSteamId) || 0;
              traderMap.set(death.victimSteamId, current + 1);
            }
            break;
          }
        }
      }
    }
  }

  return relationships;
}

// ============================================================================
// TRADE CHAIN ANALYSIS
// ============================================================================

/**
 * Trade chain threshold - time window for kills to be part of same chain
 * 640 ticks = 10 seconds at 64 tick rate (more lenient than single trade)
 */
const CHAIN_THRESHOLD_TICKS = 640;

/**
 * Calculate trade chain metrics
 *
 * A trade chain is a sequence of trades where each kill trades the previous:
 * - Player A kills Player 1
 * - Player B kills Player A (trade 1)
 * - Player 2 kills Player B (trade 2)
 * - Player C kills Player 2 (trade 3)
 *
 * @param allKills - All kills in the match
 * @param playerTeam - Team number of the player (for win/loss calculation)
 * @param tickRate - Demo tick rate
 * @returns Trade chain metrics
 */
export function calculateTradeChains(
  allKills: readonly KillInput[],
  playerTeam: number,
  tickRate: number = 64,
): TradeChainMetrics {
  if (allKills.length === 0) {
    return createEmptyTradeChainMetrics();
  }

  const chainThreshold = Math.round(
    (CHAIN_THRESHOLD_TICKS / TICK_RATES.MATCHMAKING) * tickRate,
  );

  const killsByRound = groupBy(allKills, (k) => k.roundNumber);
  const chains: TradeChainEvent[] = [];

  for (const [roundNumber, roundKills] of killsByRound) {
    const sortedKills = [...roundKills].sort((a, b) => a.tick - b.tick);
    const chainEvents = findChainsInRound(
      sortedKills,
      roundNumber,
      chainThreshold,
      tickRate,
    );
    chains.push(...chainEvents);
  }

  // Calculate aggregate metrics
  const totalChains = chains.length;
  const avgChainLength =
    totalChains > 0
      ? round2(chains.reduce((sum, c) => sum + c.length, 0) / totalChains)
      : 0;
  const longestChain =
    totalChains > 0 ? Math.max(...chains.map((c) => c.length)) : 0;

  // Count chains won by player's team
  const chainsWon = chains.filter((c) => c.winnerTeam === playerTeam).length;
  const chainWinRate = round2(
    totalChains > 0 ? (chainsWon / totalChains) * 100 : 0,
  );

  // Breakdown by chain length
  const byLength = calculateChainLengthBreakdown(chains, playerTeam);

  return {
    totalChains,
    avgChainLength,
    longestChain,
    chainsWon,
    chainWinRate,
    chains,
    byLength,
  };
}

/**
 * Find trade chains within a single round
 */
function findChainsInRound(
  kills: readonly KillInput[],
  roundNumber: number,
  chainThreshold: number,
  tickRate: number,
): TradeChainEvent[] {
  const chains: TradeChainEvent[] = [];
  const usedKillIndices = new Set<number>();

  for (let i = 0; i < kills.length; i++) {
    if (usedKillIndices.has(i)) continue;

    const firstKill = kills[i];
    if (!firstKill) continue;

    // Start building a chain from this kill
    const chainKills: TradeChainKill[] = [];
    let currentKillIndex = i;
    let currentKill = firstKill;
    let lastVictimSteamId = currentKill.victimSteamId;

    // Add the first kill
    chainKills.push(createChainKill(currentKill, 0, false));
    usedKillIndices.add(currentKillIndex);

    // Look for subsequent trades
    while (true) {
      let foundTrade = false;

      for (let j = currentKillIndex + 1; j < kills.length; j++) {
        if (usedKillIndices.has(j)) continue;

        const nextKill = kills[j];
        if (!nextKill || !nextKill.attackerSteamId) continue;

        // Check if this is within the time window
        if (nextKill.tick - currentKill.tick > chainThreshold) break;

        // Check if this is a trade (killing the person who just killed)
        if (nextKill.attackerSteamId === lastVictimSteamId) {
          // This is a trade - the victim from last kill is now getting revenge
          const timeSincePrevious =
            (nextKill.tick - currentKill.tick) / tickRate;
          chainKills.push(createChainKill(nextKill, timeSincePrevious, true));
          usedKillIndices.add(j);

          currentKillIndex = j;
          currentKill = nextKill;
          lastVictimSteamId = nextKill.victimSteamId;
          foundTrade = true;
          break;
        }
      }

      if (!foundTrade) break;
    }

    // Only count as a chain if there was at least one trade (2+ kills)
    if (chainKills.length >= 2) {
      const startTick = chainKills[0]?.tick ?? 0;
      const endTick = chainKills[chainKills.length - 1]?.tick ?? 0;

      // Calculate winner based on net kills
      const teamKills = new Map<number, number>();
      for (const kill of chainKills) {
        const team = kill.attackerTeam;
        teamKills.set(team, (teamKills.get(team) ?? 0) + 1);
      }

      let winnerTeam = 0;
      let maxKills = 0;
      for (const [team, count] of teamKills) {
        if (count > maxKills) {
          maxKills = count;
          winnerTeam = team;
        }
      }

      // Calculate net advantage (positive = more enemy deaths for team 2/CT perspective)
      const team2Kills = teamKills.get(2) ?? 0;
      const team3Kills = teamKills.get(3) ?? 0;
      const netAdvantage = team3Kills - team2Kills;

      chains.push({
        roundNumber,
        startTick,
        endTick,
        durationSeconds: round2((endTick - startTick) / tickRate),
        length: chainKills.length,
        kills: chainKills,
        winnerTeam,
        netAdvantage,
      });
    }
  }

  return chains;
}

/**
 * Create a chain kill object from a kill input
 */
function createChainKill(
  kill: KillInput,
  timeSincePrevious: number,
  isTrade: boolean,
): TradeChainKill {
  return {
    tick: kill.tick,
    attackerSteamId: kill.attackerSteamId ?? "",
    attackerName: "Unknown", // Player names not available in KillInput
    attackerTeam: kill.attackerTeam ?? 0,
    victimSteamId: kill.victimSteamId,
    victimName: "Unknown", // Player names not available in KillInput
    victimTeam: kill.victimTeam,
    weapon: kill.weapon,
    isTrade,
    timeSincePrevious: round2(timeSincePrevious),
  };
}

/**
 * Calculate breakdown of chains by length
 */
function calculateChainLengthBreakdown(
  chains: readonly TradeChainEvent[],
  playerTeam: number,
): TradeChainLengthBreakdown {
  const length2 = chains.filter((c) => c.length === 2);
  const length3 = chains.filter((c) => c.length === 3);
  const length4 = chains.filter((c) => c.length === 4);
  const length5Plus = chains.filter((c) => c.length >= 5);

  return {
    length2: calculateChainLengthStats(length2, playerTeam),
    length3: calculateChainLengthStats(length3, playerTeam),
    length4: calculateChainLengthStats(length4, playerTeam),
    length5Plus: calculateChainLengthStats(length5Plus, playerTeam),
  };
}

/**
 * Calculate statistics for chains of a specific length
 */
function calculateChainLengthStats(
  chains: readonly TradeChainEvent[],
  playerTeam: number,
): ChainLengthStats {
  const count = chains.length;
  const won = chains.filter((c) => c.winnerTeam === playerTeam).length;
  const winRate = round2(count > 0 ? (won / count) * 100 : 0);
  const avgDuration =
    count > 0
      ? round2(chains.reduce((sum, c) => sum + c.durationSeconds, 0) / count)
      : 0;

  return { count, won, winRate, avgDuration };
}

// ============================================================================
// TRADE TIMING ANALYSIS
// ============================================================================

/**
 * Timing thresholds (in seconds from round start)
 */
const TIMING_THRESHOLDS = {
  EARLY: 20, // First 20 seconds = entry phase
  MID: 60, // 20-60 seconds = mid-round
  LATE: 120, // 60+ seconds = late round
} as const;

/**
 * Calculate trade timing metrics
 *
 * Analyzes when trades happen during the round.
 *
 * @param trades - Trade events to analyze
 * @param rounds - Round data for context (bomb plant, etc.)
 * @param tickRate - Demo tick rate
 * @returns Trade timing metrics
 */
export function calculateTradeTimingMetrics(
  trades: readonly TradeEvent[],
  rounds: readonly RoundInput[],
  tickRate: number = 64,
): TradeTimingMetrics {
  if (trades.length === 0) {
    return createEmptyTradeTimingMetrics();
  }

  const roundStartTicks = new Map<number, number>();
  const roundBombPlantTicks = new Map<number, number>();

  for (const round of rounds) {
    roundStartTicks.set(
      round.roundNumber,
      round.freezeEndTick ?? round.startTick,
    );
    if (round.bombPlantTick !== undefined && round.bombPlantTick !== null) {
      roundBombPlantTicks.set(round.roundNumber, round.bombPlantTick);
    }
  }

  const entryTrades: TradeEvent[] = [];
  const midRoundTrades: TradeEvent[] = [];
  const lateRoundTrades: TradeEvent[] = [];
  const postPlantTrades: TradeEvent[] = [];
  const retakeTrades: TradeEvent[] = [];

  for (const trade of trades) {
    const roundStart = roundStartTicks.get(trade.roundNumber) ?? 0;
    const secondsIntoRound = (trade.tick - roundStart) / tickRate;

    const bombPlantTick = roundBombPlantTicks.get(trade.roundNumber);
    const isPostPlant =
      bombPlantTick !== undefined && trade.tick > bombPlantTick;

    // Categorize by timing
    if (secondsIntoRound <= TIMING_THRESHOLDS.EARLY) {
      entryTrades.push(trade);
    } else if (secondsIntoRound <= TIMING_THRESHOLDS.MID) {
      midRoundTrades.push(trade);
    } else {
      lateRoundTrades.push(trade);
    }

    // Track post-plant trades
    if (isPostPlant) {
      postPlantTrades.push(trade);
      // Retake trades are CT post-plant trades (simplified detection)
      // In a full implementation, we'd check if CT is retaking site
      retakeTrades.push(trade);
    }
  }

  const totalTrades = trades.length;
  const allTradeTimes = trades.map((t) => t.tradeTimeSeconds);
  const avgReactionTime = round2(
    allTradeTimes.reduce((sum, t) => sum + t, 0) / totalTrades,
  );
  const fastestTradeTime = Math.min(...allTradeTimes);

  return {
    entryTrades: createTradeTimingPhase(entryTrades, totalTrades),
    midRoundTrades: createTradeTimingPhase(midRoundTrades, totalTrades),
    lateRoundTrades: createTradeTimingPhase(lateRoundTrades, totalTrades),
    postPlantTrades: createTradeTimingPhase(postPlantTrades, totalTrades),
    retakeTrades: createTradeTimingPhase(retakeTrades, totalTrades),
    avgReactionTime,
    fastestTradeTime: round2(fastestTradeTime),
  };
}

/**
 * Create trade timing phase statistics
 */
function createTradeTimingPhase(
  trades: readonly TradeEvent[],
  totalTrades: number,
): TradeTimingPhase {
  const count = trades.length;
  const percent = round2(totalTrades > 0 ? (count / totalTrades) * 100 : 0);
  const avgTradeTime =
    count > 0
      ? round2(trades.reduce((sum, t) => sum + t.tradeTimeSeconds, 0) / count)
      : 0;

  return {
    trades: count,
    percent,
    successRate: 100, // All trades in this list are successful (they happened)
    avgTradeTime,
  };
}

// ============================================================================
// TRADE EFFECTIVENESS ANALYSIS
// ============================================================================

/**
 * Calculate trade effectiveness metrics
 *
 * Measures how impactful trades are for winning rounds.
 *
 * @param trades - Trade events to analyze
 * @param roundWinners - Map of round number to winning team
 * @param playerTeam - Player's team number
 * @returns Trade effectiveness metrics
 */
export function calculateTradeEffectiveness(
  trades: readonly TradeEvent[],
  roundWinners: ReadonlyMap<number, number>,
  playerTeam: number,
): TradeEffectivenessMetrics {
  if (trades.length === 0) {
    return createEmptyTradeEffectivenessMetrics();
  }

  let tradesLeadingToWin = 0;
  let tradesInWonRounds = 0;
  let tradesInLostRounds = 0;

  for (const trade of trades) {
    const winner = roundWinners.get(trade.roundNumber);
    if (winner === playerTeam) {
      tradesInWonRounds++;
      // Simplified: count all trades in won rounds as contributing
      tradesLeadingToWin++;
    } else {
      tradesInLostRounds++;
    }
  }

  const tradeWinImpact = round2(
    trades.length > 0 ? (tradesLeadingToWin / trades.length) * 100 : 0,
  );

  // Average man advantage is 0 for trades (even exchange) unless it's a chain
  // This is a simplified calculation
  const avgManAdvantageCreated = 0;

  // Trade value score combines win impact and trade success
  const tradeValueScore = round2(
    tradeWinImpact * 0.8 + (tradesInWonRounds > tradesInLostRounds ? 20 : 0),
  );

  return {
    tradesLeadingToWin,
    tradeWinImpact,
    tradesInWonRounds,
    tradesInLostRounds,
    avgManAdvantageCreated,
    tradeValueScore,
  };
}

// ============================================================================
// TRADE RELATIONSHIPS
// ============================================================================

/**
 * Calculate detailed trade relationships between players
 *
 * Shows how often pairs of players trade each other.
 *
 * @param teamSteamIds - Steam IDs of team members
 * @param allKills - All kills in the match
 * @param playerNames - Map of steam ID to player name
 * @param tickRate - Demo tick rate
 * @returns Array of trade relationships
 */
export function calculateTradeRelationships(
  teamSteamIds: readonly string[],
  allKills: readonly KillInput[],
  playerNames: ReadonlyMap<string, string>,
  tickRate: number = 64,
): TradeRelationship[] {
  const relationships: TradeRelationship[] = [];
  const relationshipMap = analyzeTradeRelationships(
    teamSteamIds,
    allKills,
    tickRate,
  );

  // Create relationship objects for each pair
  for (let i = 0; i < teamSteamIds.length; i++) {
    for (let j = i + 1; j < teamSteamIds.length; j++) {
      const player1 = teamSteamIds[i];
      const player2 = teamSteamIds[j];

      if (!player1 || !player2) continue;

      const player1TradesPlayer2 =
        relationshipMap.get(player1)?.get(player2) ?? 0;
      const player2TradesPlayer1 =
        relationshipMap.get(player2)?.get(player1) ?? 0;
      const totalTrades = player1TradesPlayer2 + player2TradesPlayer1;

      if (totalTrades > 0) {
        // Synergy score: higher when trades are balanced between both players
        const balance =
          Math.min(player1TradesPlayer2, player2TradesPlayer1) /
          Math.max(player1TradesPlayer2, player2TradesPlayer1, 1);
        const synergyScore = round2(totalTrades * (0.5 + balance * 0.5));

        relationships.push({
          player1SteamId: player1,
          player1Name: playerNames.get(player1) ?? "Unknown",
          player2SteamId: player2,
          player2Name: playerNames.get(player2) ?? "Unknown",
          player1TradedPlayer2: player1TradesPlayer2,
          player2TradedPlayer1: player2TradesPlayer1,
          totalTrades,
          synergyScore,
        });
      }
    }
  }

  // Sort by total trades descending
  return relationships.sort((a, b) => b.totalTrades - a.totalTrades);
}

// ============================================================================
// EXTENDED TRADE METRICS
// ============================================================================

/**
 * Calculate extended trade metrics
 *
 * Combines all trade analysis into a comprehensive profile.
 *
 * @param input - Trade calculation input
 * @param rounds - Round data for timing analysis
 * @param roundWinners - Map of round number to winning team
 * @param teamSteamIds - Steam IDs of team members
 * @param playerTeam - Player's team number
 * @returns Extended trade metrics
 */
export function calculateExtendedTradeMetrics(
  input: TradeCalculationInput,
  rounds: readonly RoundInput[],
  roundWinners: ReadonlyMap<number, number>,
  teamSteamIds: readonly string[],
  playerTeam: number,
): ExtendedTradeMetrics {
  const { allKills, tickRate = 64, playerNames } = input;

  // Calculate core metrics
  const core = calculateTrades(input);

  // Calculate chain metrics
  const chains = calculateTradeChains(allKills, playerTeam, tickRate);

  // Calculate timing metrics
  const timing = calculateTradeTimingMetrics(core.trades, rounds, tickRate);

  // Calculate effectiveness metrics
  const effectiveness = calculateTradeEffectiveness(
    core.trades,
    roundWinners,
    playerTeam,
  );

  // Calculate relationships
  const relationships = playerNames
    ? calculateTradeRelationships(teamSteamIds, allKills, playerNames, tickRate)
    : [];

  // Calculate overall score
  const overallScore = calculateTradeOverallScore(
    core,
    chains,
    timing,
    effectiveness,
  );

  // Determine skill label
  const skillLabel = getTradeSkillLabel(overallScore);

  return {
    core,
    chains,
    timing,
    effectiveness,
    relationships,
    overallScore,
    skillLabel,
  };
}

/**
 * Calculate overall trade score (0-100)
 */
function calculateTradeOverallScore(
  core: TradeMetrics,
  chains: TradeChainMetrics,
  timing: TradeTimingMetrics,
  effectiveness: TradeEffectivenessMetrics,
): number {
  // Weight different components
  const successRateScore = core.tradeSuccessRate * 0.3;
  const reactionTimeScore = Math.max(
    0,
    ((5 - timing.avgReactionTime) / 5) * 30,
  ); // Max 30 points for fast trades
  const chainScore = Math.min(chains.chainWinRate, 100) * 0.2;
  const effectivenessScore = effectiveness.tradeWinImpact * 0.2;

  const totalScore =
    successRateScore + reactionTimeScore + chainScore + effectivenessScore;
  return round2(Math.min(100, Math.max(0, totalScore)));
}

/**
 * Get trade skill label based on score
 */
function getTradeSkillLabel(score: number): TradeSkillLabel {
  if (score >= 80) return "Elite";
  if (score >= 65) return "Excellent";
  if (score >= 50) return "Good";
  if (score >= 35) return "Average";
  if (score >= 20) return "Below Average";
  return "Poor";
}

// ============================================================================
// HELPERS
// ============================================================================

function createEmptyTradeMetrics(): TradeMetrics {
  return {
    tradesGiven: 0,
    tradesReceived: 0,
    tradeSuccessRate: 0,
    tradeOpportunities: 0,
    avgTradeTimeTicks: 0,
    avgTradeTimeSeconds: 0,
    trades: [],
  };
}

function createEmptyTradeChainMetrics(): TradeChainMetrics {
  return {
    totalChains: 0,
    avgChainLength: 0,
    longestChain: 0,
    chainsWon: 0,
    chainWinRate: 0,
    chains: [],
    byLength: {
      length2: { count: 0, won: 0, winRate: 0, avgDuration: 0 },
      length3: { count: 0, won: 0, winRate: 0, avgDuration: 0 },
      length4: { count: 0, won: 0, winRate: 0, avgDuration: 0 },
      length5Plus: { count: 0, won: 0, winRate: 0, avgDuration: 0 },
    },
  };
}

function createEmptyTradeTimingMetrics(): TradeTimingMetrics {
  return {
    entryTrades: { trades: 0, percent: 0, successRate: 0, avgTradeTime: 0 },
    midRoundTrades: { trades: 0, percent: 0, successRate: 0, avgTradeTime: 0 },
    lateRoundTrades: { trades: 0, percent: 0, successRate: 0, avgTradeTime: 0 },
    postPlantTrades: { trades: 0, percent: 0, successRate: 0, avgTradeTime: 0 },
    retakeTrades: { trades: 0, percent: 0, successRate: 0, avgTradeTime: 0 },
    avgReactionTime: 0,
    fastestTradeTime: 0,
  };
}

function createEmptyTradeEffectivenessMetrics(): TradeEffectivenessMetrics {
  return {
    tradesLeadingToWin: 0,
    tradeWinImpact: 0,
    tradesInWonRounds: 0,
    tradesInLostRounds: 0,
    avgManAdvantageCreated: 0,
    tradeValueScore: 0,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
