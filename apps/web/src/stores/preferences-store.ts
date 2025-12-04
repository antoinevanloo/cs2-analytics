/**
 * User Preferences state management with Zustand
 *
 * Manages user preferences including:
 * - Preferred role (PLAYER, COACH, SCOUT, ANALYST, CREATOR)
 * - Dashboard customization
 * - Notification settings
 * - UI preferences
 *
 * @module stores/preferences-store
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// ============================================================================
// Types
// ============================================================================

export type PreferredRole =
  | "PLAYER"
  | "COACH"
  | "SCOUT"
  | "ANALYST"
  | "CREATOR";

export type ProfileVisibility = "PUBLIC" | "FRIENDS" | "PRIVATE";

export interface DashboardLayout {
  widgets: DashboardWidget[];
  columns?: number;
}

export interface DashboardWidget {
  id: string;
  type: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  config?: Record<string, unknown>;
}

export interface UserPreferences {
  // Role preference
  preferredRole: PreferredRole;

  // Dashboard customization
  dashboardLayout: DashboardLayout | null;
  favoriteMetrics: string[];
  defaultTimeRange: string;

  // Notifications
  emailNotifications: boolean;
  weeklyDigest: boolean;

  // Onboarding state
  onboardingStep: number;
  onboardingCompletedAt: string | null;
  hasSeenWelcome: boolean;
  hasCompletedTour: boolean;

  // Integration settings
  faceitAutoImport: boolean;
  faceitImportInterval: number;

  // UI preferences
  theme: "light" | "dark" | "system";
  compactMode: boolean;
  showAdvancedStats: boolean;

  // Privacy
  profileVisibility: ProfileVisibility;
  shareStats: boolean;
}

interface PreferencesState {
  // Preferences data
  preferences: UserPreferences | null;

  // Status
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  lastSyncedAt: number | null;

  // Actions
  setPreferences: (preferences: UserPreferences | null) => void;
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  setLoading: (isLoading: boolean) => void;
  setSaving: (isSaving: boolean) => void;
  setError: (error: string | null) => void;
  markSynced: () => void;

  // Role management
  setPreferredRole: (role: PreferredRole) => void;

  // Onboarding
  setOnboardingStep: (step: number) => void;
  completeOnboarding: () => void;
  markWelcomeSeen: () => void;
  markTourCompleted: () => void;

  // UI preferences
  setTheme: (theme: "light" | "dark" | "system") => void;
  toggleCompactMode: () => void;
  toggleAdvancedStats: () => void;

  // Reset
  reset: () => void;
}

// ============================================================================
// Default preferences
// ============================================================================

const DEFAULT_PREFERENCES: UserPreferences = {
  preferredRole: "PLAYER",
  dashboardLayout: null,
  favoriteMetrics: ["rating", "adr", "kast"],
  defaultTimeRange: "30d",
  emailNotifications: true,
  weeklyDigest: true,
  onboardingStep: 0,
  onboardingCompletedAt: null,
  hasSeenWelcome: false,
  hasCompletedTour: false,
  faceitAutoImport: false,
  faceitImportInterval: 24,
  theme: "system",
  compactMode: false,
  showAdvancedStats: false,
  profileVisibility: "FRIENDS",
  shareStats: true,
};

// ============================================================================
// Store Implementation
// ============================================================================

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      // Initial state
      preferences: null,
      isLoading: false,
      isSaving: false,
      error: null,
      lastSyncedAt: null,

      // Setters
      setPreferences: (preferences) =>
        set({
          preferences,
          error: null,
        }),

      updatePreferences: (updates) =>
        set((state) => ({
          preferences: state.preferences
            ? { ...state.preferences, ...updates }
            : { ...DEFAULT_PREFERENCES, ...updates },
        })),

      setLoading: (isLoading) => set({ isLoading }),
      setSaving: (isSaving) => set({ isSaving }),
      setError: (error) => set({ error }),
      markSynced: () => set({ lastSyncedAt: Date.now() }),

      // Role management
      setPreferredRole: (role) => {
        const { preferences } = get();
        set({
          preferences: preferences
            ? { ...preferences, preferredRole: role }
            : { ...DEFAULT_PREFERENCES, preferredRole: role },
        });
      },

      // Onboarding
      setOnboardingStep: (step) => {
        const { preferences } = get();
        set({
          preferences: preferences
            ? { ...preferences, onboardingStep: step }
            : { ...DEFAULT_PREFERENCES, onboardingStep: step },
        });
      },

      completeOnboarding: () => {
        const { preferences } = get();
        set({
          preferences: preferences
            ? {
                ...preferences,
                onboardingCompletedAt: new Date().toISOString(),
              }
            : {
                ...DEFAULT_PREFERENCES,
                onboardingCompletedAt: new Date().toISOString(),
              },
        });
      },

      markWelcomeSeen: () => {
        const { preferences } = get();
        set({
          preferences: preferences
            ? { ...preferences, hasSeenWelcome: true }
            : { ...DEFAULT_PREFERENCES, hasSeenWelcome: true },
        });
      },

      markTourCompleted: () => {
        const { preferences } = get();
        set({
          preferences: preferences
            ? { ...preferences, hasCompletedTour: true }
            : { ...DEFAULT_PREFERENCES, hasCompletedTour: true },
        });
      },

      // UI preferences
      setTheme: (theme) => {
        const { preferences } = get();
        set({
          preferences: preferences
            ? { ...preferences, theme }
            : { ...DEFAULT_PREFERENCES, theme },
        });
      },

      toggleCompactMode: () => {
        const { preferences } = get();
        const current = preferences?.compactMode ?? false;
        set({
          preferences: preferences
            ? { ...preferences, compactMode: !current }
            : { ...DEFAULT_PREFERENCES, compactMode: !current },
        });
      },

      toggleAdvancedStats: () => {
        const { preferences } = get();
        const current = preferences?.showAdvancedStats ?? false;
        set({
          preferences: preferences
            ? { ...preferences, showAdvancedStats: !current }
            : { ...DEFAULT_PREFERENCES, showAdvancedStats: !current },
        });
      },

      // Reset
      reset: () =>
        set({
          preferences: null,
          isLoading: false,
          isSaving: false,
          error: null,
          lastSyncedAt: null,
        }),
    }),
    {
      name: "cs2-preferences-storage",
      storage: createJSONStorage(() => localStorage),
      // Only persist preferences and lastSyncedAt
      partialize: (state) => ({
        preferences: state.preferences,
        lastSyncedAt: state.lastSyncedAt,
      }),
    },
  ),
);

// ============================================================================
// Selectors (for performance optimization)
// ============================================================================

export const selectPreferences = (state: PreferencesState) => state.preferences;
export const selectPreferredRole = (state: PreferencesState) =>
  state.preferences?.preferredRole ?? "PLAYER";
export const selectIsOnboardingComplete = (state: PreferencesState) =>
  state.preferences?.onboardingCompletedAt !== null;
export const selectOnboardingStep = (state: PreferencesState) =>
  state.preferences?.onboardingStep ?? 0;
export const selectTheme = (state: PreferencesState) =>
  state.preferences?.theme ?? "system";
export const selectIsLoading = (state: PreferencesState) => state.isLoading;
export const selectIsSaving = (state: PreferencesState) => state.isSaving;

// ============================================================================
// Role metadata
// ============================================================================

export const ROLE_METADATA: Record<
  PreferredRole,
  {
    label: string;
    description: string;
    icon: string;
    focusAreas: string[];
  }
> = {
  PLAYER: {
    label: "Player",
    description: "Focus on personal improvement and individual performance",
    icon: "User",
    focusAreas: ["Rating", "ADR", "KAST", "Impact", "Consistency"],
  },
  COACH: {
    label: "Coach",
    description: "Team management and player development",
    icon: "Users",
    focusAreas: ["Team Health", "Player Progress", "Strategy Execution"],
  },
  SCOUT: {
    label: "Scout",
    description: "Opponent analysis and meta tracking",
    icon: "Search",
    focusAreas: ["Opponent Tendencies", "Map Meta", "Player Profiles"],
  },
  ANALYST: {
    label: "Analyst",
    description: "Deep statistical analysis and insights",
    icon: "BarChart",
    focusAreas: ["Advanced Metrics", "Trends", "Statistical Models"],
  },
  CREATOR: {
    label: "Creator",
    description: "Content creation and highlight discovery",
    icon: "Video",
    focusAreas: ["Highlight Moments", "Replay Export", "Visual Content"],
  },
};
