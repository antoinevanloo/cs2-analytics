/**
 * Re-export Prisma types for use across the application.
 */

export type {
  User,
  Team,
  TeamMember,
  Player,
  Demo,
  Round,
  MatchPlayerStats,
  RoundPlayerStats,
  Kill,
  Grenade,
  Analysis,
  SteamProfile,
  FaceitProfile,
  EseaProfile,
} from "@prisma/client";

export {
  Plan,
  TeamRole,
  StorageType,
  GameMode,
  DemoStatus,
  RoundType,
  GrenadeType,
  AnalysisType,
  AnalysisStatus,
} from "@prisma/client";

// Utility types for common query patterns

export type DemoWithRelations = {
  id: string;
  filename: string;
  mapName: string;
  team1Name: string;
  team2Name: string;
  team1Score: number;
  team2Score: number;
  durationSeconds: number;
  playedAt: Date | null;
  status: string;
  rounds?: {
    id: string;
    roundNumber: number;
    winnerTeam: number;
  }[];
  playerStats?: {
    id: string;
    steamId: string;
    playerName: string;
    kills: number;
    deaths: number;
    assists: number;
  }[];
};

export type PlayerWithStats = {
  id: string;
  steamId: string;
  name: string;
  avatar: string | null;
  totalMatches: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  totalDamage: number;
  kd?: number;
  adr?: number;
};

export type RoundWithDetails = {
  id: string;
  roundNumber: number;
  winnerTeam: number;
  winReason: string;
  roundType: string;
  bombPlanted: boolean;
  bombSite: string | null;
  kills?: {
    attackerName: string | null;
    victimName: string;
    weapon: string;
    headshot: boolean;
  }[];
  playerStats?: {
    steamId: string;
    kills: number;
    deaths: number;
    damage: number;
    survived: boolean;
  }[];
};

// Query filter types

export interface DemoFilters {
  mapName?: string;
  gameMode?: string;
  status?: string;
  playerId?: string;
  teamId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface PlayerFilters {
  name?: string;
  steamId?: string;
  minMatches?: number;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  orderBy?: string;
  order?: "asc" | "desc";
}
