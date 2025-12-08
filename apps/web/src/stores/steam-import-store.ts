/**
 * Steam Import State Management with Zustand
 *
 * Handles Steam match import configuration, sync status, and match list.
 *
 * @module stores/steam-import-store
 */

import { create } from "zustand";
import { steamImportApi } from "@/lib/api";
import type {
  SteamSyncConfig,
  SteamMatch,
  SyncStatusResponse,
  SteamMatchListResponse,
  SetupImportDto,
} from "@/lib/api";

// ============================================================================
// Types
// ============================================================================

type SteamSyncStatus =
  | "INACTIVE"
  | "ACTIVE"
  | "SYNCING"
  | "ERROR"
  | "RATE_LIMITED";

type MatchDownloadStatus =
  | "PENDING"
  | "URL_FETCHED"
  | "DOWNLOADING"
  | "DOWNLOADED"
  | "PARSING"
  | "COMPLETED"
  | "FAILED"
  | "EXPIRED"
  | "UNAVAILABLE";

interface SteamImportState {
  // Configuration
  isConfigured: boolean;
  config: SteamSyncConfig | null;

  // Sync state
  syncStatus: SteamSyncStatus;
  lastSyncAt: Date | null;
  lastSyncError: string | null;
  isSyncing: boolean;

  // Matches
  matches: SteamMatch[];
  matchesLoading: boolean;
  matchesPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };

  // UI state
  isLoading: boolean;
  error: string | null;

  // Actions
  setupImport: (dto: SetupImportDto) => Promise<void>;
  updateConfig: (config: Partial<SetupImportDto>) => Promise<void>;
  disconnect: () => Promise<void>;
  triggerSync: () => Promise<{ jobId: string }>;
  refreshStatus: () => Promise<void>;
  loadMatches: (page?: number, status?: MatchDownloadStatus) => Promise<void>;
  triggerDownload: (matchId: string) => Promise<void>;
  removeMatch: (matchId: string) => Promise<void>;
  refreshMatchInfo: (matchId: string) => Promise<boolean>;
  refreshAllPendingInfo: () => Promise<{ total: number; updated: number; failed: number }>;
  clearError: () => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useSteamImportStore = create<SteamImportState>((set, get) => ({
  // Initial state
  isConfigured: false,
  config: null,
  syncStatus: "INACTIVE",
  lastSyncAt: null,
  lastSyncError: null,
  isSyncing: false,
  matches: [],
  matchesLoading: false,
  matchesPagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  },
  isLoading: false,
  error: null,

  // ============================================================================
  // Configuration Actions
  // ============================================================================

  setupImport: async (dto: SetupImportDto) => {
    set({ isLoading: true, error: null });
    try {
      const config = await steamImportApi.setup(dto);
      set({
        isConfigured: true,
        config,
        syncStatus: config.status as SteamSyncStatus,
        lastSyncAt: config.lastSyncAt ? new Date(config.lastSyncAt) : null,
        lastSyncError: config.lastSyncError,
        isLoading: false,
      });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to setup import",
        isLoading: false,
      });
      throw error;
    }
  },

  updateConfig: async (updates: Partial<SetupImportDto>) => {
    set({ isLoading: true, error: null });
    try {
      const config = await steamImportApi.updateConfig(updates);
      set({
        config,
        isLoading: false,
      });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to update config",
        isLoading: false,
      });
      throw error;
    }
  },

  disconnect: async () => {
    set({ isLoading: true, error: null });
    try {
      await steamImportApi.disconnect();
      set({
        isConfigured: false,
        config: null,
        syncStatus: "INACTIVE",
        lastSyncAt: null,
        lastSyncError: null,
        matches: [],
        matchesPagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
        isLoading: false,
      });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to disconnect",
        isLoading: false,
      });
      throw error;
    }
  },

  // ============================================================================
  // Sync Actions
  // ============================================================================

  triggerSync: async () => {
    set({ isSyncing: true, error: null });
    try {
      const result = await steamImportApi.triggerSync();
      set({ syncStatus: "SYNCING" });
      return result;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to trigger sync",
        isSyncing: false,
      });
      throw error;
    }
  },

  refreshStatus: async () => {
    try {
      const status: SyncStatusResponse = await steamImportApi.getStatus();
      set({
        isConfigured: status.isConfigured,
        config: status.config,
        syncStatus: status.config?.status as SteamSyncStatus || "INACTIVE",
        lastSyncAt: status.config?.lastSyncAt
          ? new Date(status.config.lastSyncAt)
          : null,
        lastSyncError: status.config?.lastSyncError || null,
        isSyncing: status.config?.status === "SYNCING",
      });

      // If we were syncing and now we're not, reload matches
      if (
        get().isSyncing &&
        status.config?.status !== "SYNCING"
      ) {
        set({ isSyncing: false });
        await get().loadMatches();
      }
    } catch (error) {
      console.error("Failed to refresh status:", error);
    }
  },

  // ============================================================================
  // Match Actions
  // ============================================================================

  loadMatches: async (page = 1, status?: MatchDownloadStatus) => {
    set({ matchesLoading: true });
    try {
      const response: SteamMatchListResponse = await steamImportApi.listMatches({
        page,
        limit: get().matchesPagination.limit,
        status,
      });
      set({
        matches: response.matches,
        matchesPagination: response.pagination,
        matchesLoading: false,
      });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to load matches",
        matchesLoading: false,
      });
    }
  },

  triggerDownload: async (matchId: string) => {
    try {
      await steamImportApi.triggerDownload(matchId);

      // Update match status locally
      set((state) => ({
        matches: state.matches.map((m) =>
          m.id === matchId ? { ...m, downloadStatus: "PENDING" as const } : m,
        ),
      }));
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "Failed to trigger download",
      });
      throw error;
    }
  },

  removeMatch: async (matchId: string) => {
    try {
      await steamImportApi.removeMatch(matchId);

      // Remove from local state
      set((state) => ({
        matches: state.matches.filter((m) => m.id !== matchId),
        matchesPagination: {
          ...state.matchesPagination,
          total: state.matchesPagination.total - 1,
        },
      }));
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to remove match",
      });
      throw error;
    }
  },

  refreshMatchInfo: async (matchId: string) => {
    try {
      const result = await steamImportApi.refreshMatchInfo(matchId);
      if (result.updated) {
        // Reload matches to get updated info
        await get().loadMatches(get().matchesPagination.page);
      }
      return result.updated;
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to refresh match info",
      });
      throw error;
    }
  },

  refreshAllPendingInfo: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await steamImportApi.refreshAllPendingInfo();
      // Reload matches to show updated info
      await get().loadMatches(get().matchesPagination.page);
      set({ isLoading: false });
      return result;
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : "Failed to refresh match info",
        isLoading: false,
      });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
