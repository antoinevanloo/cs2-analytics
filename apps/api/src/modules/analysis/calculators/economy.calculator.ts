/**
 * Economy Calculator - Economic performance analysis
 *
 * Analyzes economic decisions and performance:
 * - Equipment value management
 * - Performance by round type (eco, force, full buy)
 * - Value efficiency (damage per dollar spent)
 * - Anti-eco performance
 *
 * Good economy management is crucial for team success.
 *
 * @module analysis/calculators/economy
 */

import type { RoundPlayerStatsInput } from "../types/inputs.types";
import type {
  EconomyMetrics,
  EcoRoundStats,
  ForceRoundStats,
  FullBuyStats,
  AntiEcoStats,
  RoundEconomySnapshot,
  RoundEconomyType,
} from "../types/economy.types";
import { ECONOMY_THRESHOLDS } from "../types/constants";

/**
 * Input for economy calculation
 */
export interface EconomyCalculationInput {
  /** Player's Steam ID */
  readonly steamId: string;

  /** Per-round stats for the player */
  readonly roundStats: readonly RoundPlayerStatsInput[];

  /** Total rounds played */
  readonly totalRounds: number;

  /** Optional: opponent equipment values by round */
  readonly opponentEquipByRound?: ReadonlyMap<number, number>;

  /** Optional: round winners */
  readonly roundWinners?: ReadonlyMap<number, number>;

  /** Player's team number (2=T, 3=CT) */
  readonly teamNumber?: number;
}

/**
 * Calculate economy metrics for a player
 *
 * @param input - Player data and round information
 * @returns Economy metrics
 */
export function calculateEconomy(input: EconomyCalculationInput): EconomyMetrics {
  const {
    roundStats,
    totalRounds,
    opponentEquipByRound,
    roundWinners,
    teamNumber,
  } = input;

  if (roundStats.length === 0 || totalRounds === 0) {
    return createEmptyEconomyMetrics();
  }

  // Classify rounds
  const ecoRounds: RoundPlayerStatsInput[] = [];
  const forceRounds: RoundPlayerStatsInput[] = [];
  const fullBuyRounds: RoundPlayerStatsInput[] = [];
  const antiEcoRounds: RoundPlayerStatsInput[] = [];

  let totalEquipValue = 0;
  let totalSpent = 0;

  for (const round of roundStats) {
    totalEquipValue += round.equipValue;
    totalSpent += round.moneySpent;

    const roundType = classifyRoundType(round.roundNumber, round.equipValue);

    switch (roundType) {
      case "eco":
        ecoRounds.push(round);
        break;
      case "force":
        forceRounds.push(round);
        break;
      case "full_buy":
        fullBuyRounds.push(round);
        break;
      case "pistol":
        // Pistol rounds are their own category, not counted in eco/force/full
        break;
    }

    // Check if this was an anti-eco round
    if (opponentEquipByRound) {
      const opponentEquip = opponentEquipByRound.get(round.roundNumber) || 0;
      if (opponentEquip < ECONOMY_THRESHOLDS.ECO && round.equipValue >= ECONOMY_THRESHOLDS.FULL_BUY) {
        antiEcoRounds.push(round);
      }
    }
  }

  // Calculate stats for each category
  const eco = calculateRoundTypeStats(ecoRounds, roundWinners, teamNumber);
  const forceBuy = calculateForceStats(forceRounds, roundWinners, teamNumber);
  const fullBuy = calculateFullBuyStats(fullBuyRounds, roundWinners, teamNumber);
  const antiEco = calculateAntiEcoStats(antiEcoRounds, roundWinners, teamNumber);

  // Calculate overall metrics
  const avgEquipValue = totalEquipValue / roundStats.length;
  const avgSpentPerRound = totalSpent / roundStats.length;

  // Value efficiency: damage per $1000 spent
  const totalDamage = roundStats.reduce((sum, r) => sum + r.damage, 0);
  const valueEfficiency = totalSpent > 0 ? (totalDamage / totalSpent) * 1000 : 0;

  // Kill efficiency: kills per $1000 spent
  const totalKills = roundStats.reduce((sum, r) => sum + r.kills, 0);
  const killEfficiency = totalSpent > 0 ? (totalKills / totalSpent) * 1000 : 0;

  return {
    avgEquipValue: round2(avgEquipValue),
    totalSpent,
    avgSpentPerRound: round2(avgSpentPerRound),
    valueEfficiency: round2(valueEfficiency),
    killEfficiency: round4(killEfficiency),
    eco,
    forceBuy,
    fullBuy,
    antiEco,
  };
}

/**
 * Classify round type based on equipment value
 */
export function classifyRoundType(
  roundNumber: number,
  equipValue: number
): RoundEconomyType {
  // Pistol rounds
  if (roundNumber === 1 || roundNumber === 13) {
    return "pistol";
  }

  if (equipValue < ECONOMY_THRESHOLDS.ECO) {
    return "eco";
  }

  if (equipValue < ECONOMY_THRESHOLDS.FULL_BUY) {
    return "force";
  }

  return "full_buy";
}

/**
 * Calculate stats for eco rounds
 */
function calculateRoundTypeStats(
  rounds: readonly RoundPlayerStatsInput[],
  roundWinners?: ReadonlyMap<number, number>,
  teamNumber?: number
): EcoRoundStats {
  if (rounds.length === 0) {
    return createEmptyRoundStats();
  }

  let kills = 0;
  let deaths = 0;
  let damage = 0;
  let roundsWon = 0;

  for (const round of rounds) {
    kills += round.kills;
    deaths += round.deaths;
    damage += round.damage;

    if (roundWinners && teamNumber) {
      const winner = roundWinners.get(round.roundNumber);
      if (winner === teamNumber) {
        roundsWon++;
      }
    }
  }

  const roundsPlayed = rounds.length;
  const kd = deaths > 0 ? kills / deaths : kills;
  const adr = damage / roundsPlayed;
  const winRate = (roundsWon / roundsPlayed) * 100;

  return {
    roundsPlayed,
    kills,
    deaths,
    damage,
    kd: round2(kd),
    adr: round2(adr),
    roundsWon,
    winRate: round2(winRate),
  };
}

/**
 * Calculate stats for force buy rounds
 */
function calculateForceStats(
  rounds: readonly RoundPlayerStatsInput[],
  roundWinners?: ReadonlyMap<number, number>,
  teamNumber?: number
): ForceRoundStats {
  return calculateRoundTypeStats(rounds, roundWinners, teamNumber);
}

/**
 * Calculate stats for full buy rounds
 */
function calculateFullBuyStats(
  rounds: readonly RoundPlayerStatsInput[],
  roundWinners?: ReadonlyMap<number, number>,
  teamNumber?: number
): FullBuyStats {
  return calculateRoundTypeStats(rounds, roundWinners, teamNumber);
}

/**
 * Calculate anti-eco stats
 */
function calculateAntiEcoStats(
  rounds: readonly RoundPlayerStatsInput[],
  roundWinners?: ReadonlyMap<number, number>,
  teamNumber?: number
): AntiEcoStats {
  return calculateRoundTypeStats(rounds, roundWinners, teamNumber);
}

/**
 * Build round-by-round economy snapshots
 */
export function buildEconomyTimeline(
  roundStats: readonly RoundPlayerStatsInput[],
  teamEquipByRound?: ReadonlyMap<number, number>,
  opponentEquipByRound?: ReadonlyMap<number, number>
): RoundEconomySnapshot[] {
  return roundStats.map((round) => {
    const teamEquip = teamEquipByRound?.get(round.roundNumber) ?? round.equipValue * 5;
    const opponentEquip = opponentEquipByRound?.get(round.roundNumber) ?? 0;

    return {
      roundNumber: round.roundNumber,
      equipValue: round.equipValue,
      moneySpent: round.moneySpent,
      startBalance: round.startBalance,
      endBalance: round.startBalance - round.moneySpent,
      roundType: classifyRoundType(round.roundNumber, round.equipValue),
      teamEquipValue: teamEquip,
      opponentEquipValue: opponentEquip,
      economicAdvantage: teamEquip - opponentEquip,
    };
  });
}

/**
 * Calculate team economy statistics
 */
export function calculateTeamEconomy(
  playerEconomies: readonly {
    steamId: string;
    economy: EconomyMetrics;
  }[]
): {
  avgTeamEquipValue: number;
  totalTeamSpent: number;
  ecoWinRate: number;
  forceWinRate: number;
  fullBuyWinRate: number;
  antiEcoWinRate: number;
  economyScore: number;
} {
  if (playerEconomies.length === 0) {
    return {
      avgTeamEquipValue: 0,
      totalTeamSpent: 0,
      ecoWinRate: 0,
      forceWinRate: 0,
      fullBuyWinRate: 0,
      antiEcoWinRate: 0,
      economyScore: 0,
    };
  }

  let totalEquip = 0;
  let totalSpent = 0;
  let ecoWins = 0, ecoTotal = 0;
  let forceWins = 0, forceTotal = 0;
  let fullBuyWins = 0, fullBuyTotal = 0;
  let antiEcoWins = 0, antiEcoTotal = 0;

  for (const player of playerEconomies) {
    const { economy } = player;

    totalEquip += economy.avgEquipValue;
    totalSpent += economy.totalSpent;

    ecoWins += economy.eco.roundsWon;
    ecoTotal += economy.eco.roundsPlayed;

    forceWins += economy.forceBuy.roundsWon;
    forceTotal += economy.forceBuy.roundsPlayed;

    fullBuyWins += economy.fullBuy.roundsWon;
    fullBuyTotal += economy.fullBuy.roundsPlayed;

    antiEcoWins += economy.antiEco.roundsWon;
    antiEcoTotal += economy.antiEco.roundsPlayed;
  }

  const numPlayers = playerEconomies.length;
  const ecoWinRate = ecoTotal > 0 ? (ecoWins / ecoTotal / numPlayers) * 100 : 0;
  const forceWinRate = forceTotal > 0 ? (forceWins / forceTotal / numPlayers) * 100 : 0;
  const fullBuyWinRate = fullBuyTotal > 0 ? (fullBuyWins / fullBuyTotal / numPlayers) * 100 : 0;
  const antiEcoWinRate = antiEcoTotal > 0 ? (antiEcoWins / antiEcoTotal / numPlayers) * 100 : 0;

  // Economy score: weighted combination
  // - Anti-eco win rate should be high (weight: 0.3)
  // - Full buy win rate is most important (weight: 0.4)
  // - Force buy wins are bonus (weight: 0.2)
  // - Eco wins are rare bonus (weight: 0.1)
  const economyScore =
    ecoWinRate * 0.1 +
    forceWinRate * 0.2 +
    fullBuyWinRate * 0.4 +
    Math.min(antiEcoWinRate, 90) * 0.3; // Cap anti-eco to not over-weight

  return {
    avgTeamEquipValue: round2(totalEquip / numPlayers),
    totalTeamSpent: totalSpent,
    ecoWinRate: round2(ecoWinRate),
    forceWinRate: round2(forceWinRate),
    fullBuyWinRate: round2(fullBuyWinRate),
    antiEcoWinRate: round2(antiEcoWinRate),
    economyScore: round2(economyScore),
  };
}

/**
 * Identify economic mismatches
 */
export function identifyEconomicMismatches(
  teamEquipByRound: ReadonlyMap<number, number>,
  opponentEquipByRound: ReadonlyMap<number, number>,
  roundWinners: ReadonlyMap<number, number>,
  teamNumber: number,
  thresholdDiff: number = 5000
): {
  roundNumber: number;
  advantageTeam: number;
  equipDifference: number;
  advantageTeamWon: boolean;
  upset: boolean;
}[] {
  const mismatches: {
    roundNumber: number;
    advantageTeam: number;
    equipDifference: number;
    advantageTeamWon: boolean;
    upset: boolean;
  }[] = [];

  for (const [roundNumber, teamEquip] of teamEquipByRound) {
    const opponentEquip = opponentEquipByRound.get(roundNumber) || 0;
    const diff = Math.abs(teamEquip - opponentEquip);

    if (diff >= thresholdDiff) {
      const advantageTeam = teamEquip > opponentEquip ? teamNumber : (teamNumber === 2 ? 3 : 2);
      const winner = roundWinners.get(roundNumber);
      const advantageTeamWon = winner === advantageTeam;
      const upset = !advantageTeamWon;

      mismatches.push({
        roundNumber,
        advantageTeam,
        equipDifference: diff,
        advantageTeamWon,
        upset,
      });
    }
  }

  return mismatches;
}

/**
 * Get economy label based on value efficiency
 */
export function getEconomyLabel(valueEfficiency: number): string {
  if (valueEfficiency >= 30) return "Elite";
  if (valueEfficiency >= 25) return "Excellent";
  if (valueEfficiency >= 20) return "Good";
  if (valueEfficiency >= 15) return "Average";
  if (valueEfficiency >= 10) return "Below Average";
  return "Poor";
}

// ============================================================================
// HELPERS
// ============================================================================

function createEmptyEconomyMetrics(): EconomyMetrics {
  const emptyStats = createEmptyRoundStats();

  return {
    avgEquipValue: 0,
    totalSpent: 0,
    avgSpentPerRound: 0,
    valueEfficiency: 0,
    killEfficiency: 0,
    eco: emptyStats,
    forceBuy: emptyStats,
    fullBuy: emptyStats,
    antiEco: emptyStats,
  };
}

function createEmptyRoundStats(): EcoRoundStats {
  return {
    roundsPlayed: 0,
    kills: 0,
    deaths: 0,
    damage: 0,
    kd: 0,
    adr: 0,
    roundsWon: 0,
    winRate: 0,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
