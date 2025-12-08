/**
 * Steam Import Types
 *
 * Type definitions for Steam match import functionality.
 */

import {
  SteamSyncStatus,
  MatchDownloadStatus,
  MatchResult,
  GameMode,
} from "@prisma/client";

// ============================================================================
// Share Code Types
// ============================================================================

export interface ShareCodeData {
  matchId: bigint;
  outcomeId: bigint;
  token: number;
}

// ============================================================================
// Steam API Types
// ============================================================================

export interface SteamMatchHistoryResponse {
  result: {
    nextcode: string; // "n/a" if no more matches
  };
}

// ============================================================================
// Game Coordinator Types
// ============================================================================

export interface GCMatchInfo {
  map: string;
  duration: number;
  matchTime: Date;
  team1Score: number;
  team2Score: number;
  gameMode: GameMode;
  serverIp?: string;
}

export interface GCDemoUrlResponse {
  success: boolean;
  demoUrl?: string;
  expiresAt?: Date;
  matchInfo?: GCMatchInfo;
  error?: string;
}

// ============================================================================
// Service Types
// ============================================================================

export interface SyncResult {
  success: boolean;
  newMatchesFound: number;
  shareCodes: string[];
  error?: string;
}

export interface DownloadResult {
  success: boolean;
  demoId?: string;
  filePath?: string;
  fileSize?: number;
  fileHash?: string;
  error?: string;
}

// ============================================================================
// Job Types (BullMQ)
// ============================================================================

export interface SyncMatchesJobData {
  userId: string;
  syncId: string;
  force?: boolean;
}

export interface DownloadDemoJobData {
  steamMatchId: string;
  userId: string;
  priority?: "high" | "normal" | "low";
}

export interface RefreshUrlJobData {
  steamMatchId: string;
}

// ============================================================================
// DTO Response Types
// ============================================================================

export interface SteamSyncConfigResponse {
  id: string;
  steamId: string;
  status: SteamSyncStatus;
  lastSyncAt: Date | null;
  lastSyncError: string | null;
  totalMatchesSynced: number;
  importPremier: boolean;
  importCompetitive: boolean;
  autoDownloadDemos: boolean;
  createdAt: Date;
}

export interface SteamMatchResponse {
  id: string;
  shareCode: string;
  mapName: string | null;
  matchTime: Date | null;
  matchDuration: number | null;
  gameMode: GameMode;
  team1Score: number | null;
  team2Score: number | null;
  matchResult: MatchResult | null;
  downloadStatus: MatchDownloadStatus;
  demoId: string | null;
  createdAt: Date;
  // Progress tracking for gamification UX
  downloadProgress: number;        // 0-100 percentage
  downloadedBytes: string | null;  // BigInt as string
  totalBytes: string | null;       // BigInt as string
  currentStep: string | null;      // FETCHING_URL, DOWNLOADING, DECOMPRESSING, PARSING
}

export interface SteamMatchListResponse {
  matches: SteamMatchResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SyncStatusResponse {
  config: SteamSyncConfigResponse | null;
  isConfigured: boolean;
  canSync: boolean;
  recentMatches: SteamMatchResponse[];
}
