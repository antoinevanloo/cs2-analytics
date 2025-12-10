/**
 * Input Types - Raw data structures from database
 *
 * These types represent the data as it comes from Prisma/PostgreSQL.
 * They serve as the contract between the database layer and calculators.
 *
 * @module analysis/types/inputs
 */

/**
 * Kill event as stored in database
 * Used as input for combat and rating calculations
 */
export interface KillInput {
  readonly tick: number;
  readonly roundNumber: number;

  // Attacker info
  readonly attackerSteamId: string | null;
  readonly attackerTeam: number | null;

  // Victim info
  readonly victimSteamId: string;
  readonly victimTeam: number;

  // Kill details
  readonly weapon: string;
  readonly headshot: boolean;
  readonly penetrated: number;
  readonly noscope: boolean;
  readonly thrusmoke: boolean;
  readonly attackerblind: boolean;
  readonly assistedflash: boolean;

  // Computed flags
  readonly distance: number | null;
  readonly isSuicide: boolean;
  readonly isTeamkill: boolean;
  readonly isFirstKill: boolean;
  readonly isTradeKill: boolean;
  readonly tradedWithin: number | null;

  // Assister
  readonly assisterSteamId: string | null;
}

/**
 * Round player stats as stored in database
 * Contains per-round performance data for a player
 */
export interface RoundPlayerStatsInput {
  readonly steamId: string;
  readonly roundNumber: number;
  readonly teamNum: number;

  // Combat stats
  readonly kills: number;
  readonly deaths: number;
  readonly assists: number;
  readonly damage: number;

  // Economy
  readonly equipValue: number;
  readonly moneySpent: number;
  readonly startBalance: number;

  // State
  readonly survived: boolean;
  readonly firstKill: boolean;
  readonly firstDeath: boolean;

  // Clutch
  readonly clutchVs: number | null;
  readonly clutchWon: boolean | null;
}

/**
 * Match player stats aggregated from all rounds
 * Contains match-level performance data
 */
export interface MatchPlayerStatsInput {
  readonly steamId: string;
  readonly playerName: string;
  readonly teamNum: number;
  readonly teamName: string | null;

  // Combat stats
  readonly kills: number;
  readonly deaths: number;
  readonly assists: number;
  readonly damage: number;
  readonly headshotKills: number;

  // Computed
  readonly kd: number;
  readonly adr: number;
  readonly hsp: number;
  readonly rating: number | null;

  // Economy
  readonly totalCashSpent: number;
  readonly avgEquipValue: number;

  // Advanced
  readonly mvps: number;
  readonly score: number;
  readonly firstKills: number;
  readonly firstDeaths: number;
  readonly clutchesWon: number;
  readonly clutchesPlayed: number;

  // Utility
  readonly utilityDamage: number;
  readonly enemiesFlashed: number;
  readonly flashAssists: number;
}

/**
 * Match player input for services
 * Extended version of MatchPlayerStatsInput with optional fields
 */
export interface MatchPlayerInput {
  readonly steamId: string;
  readonly name: string;
  readonly teamNum: number;
  readonly teamName?: string;

  // Combat stats
  readonly kills: number;
  readonly deaths: number;
  readonly assists: number;
  readonly damage: number;
  readonly headshotKills: number;

  // Computed
  readonly kd: number;
  readonly adr: number;
  readonly hsp: number;
  readonly rating?: number;

  // Economy
  readonly totalCashSpent: number;
  readonly avgEquipValue: number;

  // Advanced
  readonly mvps: number;
  readonly score: number;
  readonly firstKills: number;
  readonly firstDeaths: number;
  readonly clutchesWon: number;
  readonly clutchesPlayed: number;

  // Utility
  readonly utilityDamage: number;
  readonly enemiesFlashed: number;
  readonly flashAssists: number;
}

/**
 * Round data from database
 */
export interface RoundInput {
  readonly id: string;
  readonly roundNumber: number;

  // Ticks
  readonly startTick: number;
  readonly freezeEndTick?: number;
  readonly endTick: number;

  // Outcome
  readonly winnerTeam: number;
  readonly winReason: string;
  readonly winReasonCode: number;

  // Scores
  readonly ctScore: number;
  readonly tScore: number;

  // Economy
  readonly ctEquipValue: number;
  readonly tEquipValue: number;
  readonly ctMoneySpent: number;
  readonly tMoneySpent: number;
  readonly roundType: string;

  // Bomb
  readonly bombPlanted: boolean;
  readonly bombPlantTick?: number;
  readonly bombSite?: string;
  readonly bombDefused: boolean;
  readonly bombExploded: boolean;

  // MVP
  readonly mvpSteamId?: string;
  readonly mvpReason?: number;
}

/**
 * Round context for calculations
 */
export interface RoundContext {
  readonly roundNumber: number;
  readonly totalRounds: number;
  readonly startTick: number;
  readonly endTick: number;
  readonly winnerTeam: number; // 2=T, 3=CT
  readonly ctScore: number;
  readonly tScore: number;
}

/**
 * Grenade event from database
 *
 * Note: throwerSteamId/throwerTeam can be null for "end" events
 * (smoke expired, molotov extinguished) - use entityId to link to start event
 */
export interface GrenadeInput {
  readonly tick: number;
  readonly type: string;
  readonly roundNumber: number;

  // Event lifecycle: "throw", "start" (detonate), or "end" (expired)
  readonly event?: string | undefined;

  // Entity ID for linking throw → start → end events
  readonly entityId?: number | null | undefined;

  // Position (detonation for start/end, throw position for throw events)
  readonly x: number;
  readonly y: number;
  readonly z: number;

  // Throw position (for trajectory visualization)
  // Only populated for detonation events when throw event is linked
  readonly throwX?: number | null | undefined;
  readonly throwY?: number | null | undefined;
  readonly throwZ?: number | null | undefined;
  readonly throwTick?: number | null | undefined;

  // Thrower direction at throw time (for trajectory visualization)
  readonly throwYaw?: number | null | undefined;
  readonly throwPitch?: number | null | undefined;

  // Thrower (null for "end" events)
  readonly throwerSteamId: string | null;
  readonly throwerTeam: number | null;

  // Effectiveness (flash)
  readonly enemiesBlinded: number;
  readonly teammatesBlinded: number;
  readonly totalBlindDuration: number;

  // Effectiveness (HE/molotov)
  readonly damageDealt: number;
  readonly enemiesDamaged: number;
}
