/**
 * Economy Types - Economic analysis
 *
 * Economy management is crucial in CS2:
 * - Knowing when to save vs force
 * - Managing team economy
 * - Punishing opponent's eco rounds
 *
 * @module analysis/types/economy
 */

/**
 * Economy Metrics
 *
 * Individual player economic performance.
 */
export interface EconomyMetrics {
  /** Average equipment value across all rounds */
  readonly avgEquipValue: number;

  /** Total cash spent in the match */
  readonly totalSpent: number;

  /** Average money spent per round */
  readonly avgSpentPerRound: number;

  /**
   * Value efficiency
   * Formula: (damage dealt / money spent) * 1000
   * Higher = better value for money
   */
  readonly valueEfficiency: number;

  /** Kill efficiency (kills per $1000 spent) */
  readonly killEfficiency: number;

  /** Eco round statistics */
  readonly eco: EcoRoundStats;

  /** Force buy statistics */
  readonly forceBuy: ForceRoundStats;

  /** Full buy statistics */
  readonly fullBuy: FullBuyStats;

  /** Anti-eco statistics (when opponents are on eco) */
  readonly antiEco: AntiEcoStats;
}

/**
 * Eco round performance
 *
 * Eco rounds are when equipment value < $2000.
 * Good eco round performance can swing matches.
 */
export interface EcoRoundStats {
  /** Number of eco rounds played */
  readonly roundsPlayed: number;

  /** Kills during eco rounds */
  readonly kills: number;

  /** Deaths during eco rounds */
  readonly deaths: number;

  /** Damage dealt during eco rounds */
  readonly damage: number;

  /** K/D ratio during eco rounds */
  readonly kd: number;

  /** ADR during eco rounds */
  readonly adr: number;

  /** Rounds won while on eco */
  readonly roundsWon: number;

  /** Eco round win rate */
  readonly winRate: number;
}

/**
 * Force buy round performance
 *
 * Force buys are between eco and full buy ($2000-$4000).
 */
export interface ForceRoundStats {
  /** Number of force buy rounds played */
  readonly roundsPlayed: number;

  /** Kills during force rounds */
  readonly kills: number;

  /** Deaths during force rounds */
  readonly deaths: number;

  /** Damage dealt during force rounds */
  readonly damage: number;

  /** K/D ratio during force rounds */
  readonly kd: number;

  /** ADR during force rounds */
  readonly adr: number;

  /** Rounds won on force buy */
  readonly roundsWon: number;

  /** Force buy win rate */
  readonly winRate: number;
}

/**
 * Full buy round performance
 *
 * Full buys are when equipment value >= $4000.
 */
export interface FullBuyStats {
  /** Number of full buy rounds played */
  readonly roundsPlayed: number;

  /** Kills during full buy rounds */
  readonly kills: number;

  /** Deaths during full buy rounds */
  readonly deaths: number;

  /** Damage dealt during full buy rounds */
  readonly damage: number;

  /** K/D ratio during full buy rounds */
  readonly kd: number;

  /** ADR during full buy rounds */
  readonly adr: number;

  /** Rounds won on full buy */
  readonly roundsWon: number;

  /** Full buy win rate */
  readonly winRate: number;
}

/**
 * Anti-eco performance
 *
 * Performance against opponents on eco rounds.
 * Should have high K/D and damage in these rounds.
 */
export interface AntiEcoStats {
  /** Number of anti-eco rounds played */
  readonly roundsPlayed: number;

  /** Kills during anti-eco rounds */
  readonly kills: number;

  /** Deaths during anti-eco rounds (should be low) */
  readonly deaths: number;

  /** Damage dealt during anti-eco rounds */
  readonly damage: number;

  /** K/D ratio (should be high) */
  readonly kd: number;

  /** ADR during anti-eco rounds */
  readonly adr: number;

  /** Rounds won vs eco */
  readonly roundsWon: number;

  /** Anti-eco win rate (should be high) */
  readonly winRate: number;
}

/**
 * Round economy snapshot
 *
 * Economic state at a specific round.
 */
export interface RoundEconomySnapshot {
  /** Round number */
  readonly roundNumber: number;

  /** Player's equipment value */
  readonly equipValue: number;

  /** Money spent this round */
  readonly moneySpent: number;

  /** Starting balance */
  readonly startBalance: number;

  /** Ending balance */
  readonly endBalance: number;

  /** Round type classification */
  readonly roundType: RoundEconomyType;

  /** Team total equipment value */
  readonly teamEquipValue: number;

  /** Opponent team equipment value */
  readonly opponentEquipValue: number;

  /** Economic advantage (team - opponent) */
  readonly economicAdvantage: number;
}

/**
 * Round economy classification
 */
export type RoundEconomyType =
  | "pistol"
  | "eco"
  | "force"
  | "full_buy"
  | "half_buy";

/**
 * Team economy statistics
 */
export interface TeamEconomyMetrics {
  /** Team number */
  readonly teamNumber: number;

  /** Team name */
  readonly teamName: string;

  /** Average team equipment value */
  readonly avgTeamEquipValue: number;

  /** Total team spending */
  readonly totalTeamSpent: number;

  /** Eco round win rate */
  readonly ecoWinRate: number;

  /** Force buy win rate */
  readonly forceWinRate: number;

  /** Full buy win rate */
  readonly fullBuyWinRate: number;

  /** Anti-eco win rate (should be high) */
  readonly antiEcoWinRate: number;

  /** Economy management score (0-100) */
  readonly economyScore: number;

  /** Round-by-round economy */
  readonly roundEconomy: readonly RoundTeamEconomy[];
}

/**
 * Team economy for a specific round
 */
export interface RoundTeamEconomy {
  /** Round number */
  readonly roundNumber: number;

  /** Total team equipment value */
  readonly teamEquipValue: number;

  /** Round type for the team */
  readonly roundType: RoundEconomyType;

  /** Did the team win this round */
  readonly won: boolean;

  /** Loss bonus streak count */
  readonly lossBonus: number;
}

/**
 * Economy comparison between teams
 */
export interface EconomyComparison {
  /** Team 1 economy */
  readonly team1: TeamEconomyMetrics;

  /** Team 2 economy */
  readonly team2: TeamEconomyMetrics;

  /** Rounds with significant economic advantage (>$5000) */
  readonly economicMismatches: readonly EconomicMismatch[];
}

/**
 * Round with significant economic mismatch
 */
export interface EconomicMismatch {
  /** Round number */
  readonly roundNumber: number;

  /** Team with advantage */
  readonly advantageTeam: number;

  /** Equipment value difference */
  readonly equipDifference: number;

  /** Did the advantaged team win */
  readonly advantageTeamWon: boolean;

  /** Was it an upset (disadvantaged team won) */
  readonly upset: boolean;
}
