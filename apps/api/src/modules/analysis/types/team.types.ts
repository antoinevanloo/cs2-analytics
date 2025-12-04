/**
 * Team Types - Team-level analysis
 *
 * Team metrics aggregate individual performances and
 * measure team coordination and strategy execution.
 *
 * @module analysis/types/team
 */

import type { TeamTradeMetrics } from "./trade.types";
import type { TeamOpeningMetrics } from "./opening.types";
import type { TeamClutchMetrics } from "./clutch.types";
import type { TeamUtilityMetrics } from "./utility.types";
import type { TeamEconomyMetrics } from "./economy.types";
import type { PlayerSummary } from "./player.types";

/**
 * Complete team metrics for a match
 */
export interface TeamMatchMetrics {
  /** Team identification */
  readonly teamNumber: number; // 2=T starting, 3=CT starting
  readonly teamName: string;

  /** Final score */
  readonly score: number;
  readonly opponentScore: number;
  readonly won: boolean;

  /** Aggregate combat stats */
  readonly combat: TeamCombatMetrics;

  /** Team coordination metrics */
  readonly trades: TeamTradeMetrics;
  readonly openings: TeamOpeningMetrics;
  readonly clutches: TeamClutchMetrics;

  /** Support metrics */
  readonly utility: TeamUtilityMetrics;
  readonly economy: TeamEconomyMetrics;

  /** Player rankings */
  readonly players: readonly PlayerSummary[];

  /** MVP and top performers */
  readonly mvp: string | null;
  readonly topFragger: string;
  readonly topRating: string;
  readonly topKAST: string;
  readonly topADR: string;

  /** Round-by-round team performance */
  readonly roundPerformance: readonly TeamRoundPerformance[];

  /** Side-specific performance */
  readonly bySide: TeamSidePerformance;
}

/**
 * Team aggregate combat statistics
 */
export interface TeamCombatMetrics {
  /** Total kills */
  readonly totalKills: number;

  /** Total deaths */
  readonly totalDeaths: number;

  /** Total assists */
  readonly totalAssists: number;

  /** Total damage */
  readonly totalDamage: number;

  /** Team K/D */
  readonly kd: number;

  /** Team ADR (average per player per round) */
  readonly teamAdr: number;

  /** Average player rating */
  readonly avgRating: number;

  /** Average KAST */
  readonly avgKast: number;

  /** Average headshot percentage */
  readonly avgHsPercent: number;
}

/**
 * Team performance for a single round
 */
export interface TeamRoundPerformance {
  /** Round number */
  readonly roundNumber: number;

  /** Side this round */
  readonly side: "T" | "CT";

  /** Did team win */
  readonly won: boolean;

  /** Win reason if won */
  readonly winReason: string | null;

  /** Team equipment value */
  readonly equipValue: number;

  /** Round type */
  readonly roundType: "pistol" | "eco" | "force" | "full_buy";

  /** Kills this round */
  readonly kills: number;

  /** Deaths this round */
  readonly deaths: number;

  /** Damage this round */
  readonly damage: number;

  /** First kill of round */
  readonly gotFirstKill: boolean;

  /** Bomb planted (if T side) */
  readonly bombPlanted: boolean | null;

  /** Bomb defused (if CT side) */
  readonly bombDefused: boolean | null;
}

/**
 * Team performance by side
 */
export interface TeamSidePerformance {
  /** CT-side performance */
  readonly ct: SideStats;

  /** T-side performance */
  readonly t: SideStats;
}

/**
 * Stats for one side
 */
export interface SideStats {
  /** Rounds played on this side */
  readonly roundsPlayed: number;

  /** Rounds won */
  readonly roundsWon: number;

  /** Win rate on this side */
  readonly winRate: number;

  /** Total kills */
  readonly kills: number;

  /** Total deaths */
  readonly deaths: number;

  /** ADR on this side */
  readonly adr: number;

  /** First kill win rate */
  readonly firstKillWinRate: number;

  /** Pistol round won */
  readonly pistolWon: boolean;
}

/**
 * Team comparison
 */
export interface TeamComparison {
  /** Team 1 stats */
  readonly team1: TeamComparisonEntry;

  /** Team 2 stats */
  readonly team2: TeamComparisonEntry;

  /** Key matchup differences */
  readonly keyDifferences: readonly KeyDifference[];

  /** Round-by-round score */
  readonly roundByRound: readonly RoundScore[];
}

/**
 * Team entry in comparison
 */
export interface TeamComparisonEntry {
  readonly teamNumber: number;
  readonly teamName: string;
  readonly score: number;

  /** Averages */
  readonly avgRating: number;
  readonly avgKast: number;
  readonly teamAdr: number;

  /** Coordination */
  readonly tradeSuccessRate: number;
  readonly openingWinRate: number;
  readonly clutchSuccessRate: number;

  /** Economy */
  readonly avgEquipValue: number;
  readonly ecoWinRate: number;
}

/**
 * Key difference between teams
 */
export interface KeyDifference {
  /** Category of difference */
  readonly category: string;

  /** Team with advantage */
  readonly advantageTeam: number;

  /** Value for team 1 */
  readonly team1Value: number;

  /** Value for team 2 */
  readonly team2Value: number;

  /** Difference */
  readonly difference: number;

  /** Impact level */
  readonly impact: "high" | "medium" | "low";
}

/**
 * Round score entry
 */
export interface RoundScore {
  readonly roundNumber: number;
  readonly team1Score: number;
  readonly team2Score: number;
  readonly team1RoundWon: boolean;
  readonly winReason: string;
}

/**
 * Match overview
 *
 * High-level summary of the entire match.
 */
export interface MatchOverview {
  /** Match identification */
  readonly demoId: string;
  readonly mapName: string;
  readonly playedAt: Date | null;

  /** Final score */
  readonly finalScore: {
    readonly team1: number;
    readonly team2: number;
  };

  /** Teams */
  readonly team1: TeamMatchMetrics;
  readonly team2: TeamMatchMetrics;

  /** Match statistics */
  readonly stats: MatchStats;

  /** Key moments */
  readonly keyMoments: readonly KeyMoment[];

  /** MVP of the match */
  readonly matchMvp: {
    readonly steamId: string;
    readonly name: string;
    readonly rating: number;
    readonly team: number;
  };
}

/**
 * Overall match statistics
 */
export interface MatchStats {
  /** Total rounds */
  readonly totalRounds: number;

  /** Overtime rounds */
  readonly overtimeRounds: number;

  /** Total kills */
  readonly totalKills: number;

  /** Total damage */
  readonly totalDamage: number;

  /** Headshot percentage */
  readonly avgHsPercent: number;

  /** Average round duration (seconds) */
  readonly avgRoundDuration: number;

  /** Longest round */
  readonly longestRound: {
    readonly roundNumber: number;
    readonly durationSeconds: number;
  };

  /** Most kills in a round */
  readonly mostKillsRound: {
    readonly roundNumber: number;
    readonly kills: number;
  };
}

/**
 * Key moment in the match
 *
 * Highlights significant events that affected the outcome.
 */
export interface KeyMoment {
  /** Round number */
  readonly roundNumber: number;

  /** Type of moment */
  readonly type: KeyMomentType;

  /** Description */
  readonly description: string;

  /** Impact on match (score swing potential) */
  readonly impact: "game_changing" | "significant" | "notable";

  /** Players involved */
  readonly players: readonly {
    readonly steamId: string;
    readonly name: string;
    readonly role: string;
  }[];
}

/**
 * Types of key moments
 */
export type KeyMomentType =
  | "ace" // 5 kills in one round
  | "clutch_1v3_plus" // Clutch vs 3 or more
  | "eco_win" // Won eco round
  | "comeback_round" // Round that started a comeback
  | "match_point_save" // Saved match point
  | "pistol_win" // Won pistol round
  | "streak_break" // Broke opponent's win streak
  | "flawless_round"; // Won round with no deaths
