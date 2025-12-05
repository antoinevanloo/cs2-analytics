/**
 * Hook for managing user preferences with API sync
 *
 * Provides:
 * - Automatic fetching and caching of preferences
 * - Optimistic updates with API sync
 * - Role switching with persistence
 * - Onboarding state management
 *
 * @module hooks/use-preferences
 */

import { useCallback, useEffect, useRef } from "react";
import {
  usePreferencesStore,
  type PreferredRole,
  type UserPreferences,
} from "@/stores/preferences-store";
import { useAuthStore } from "@/stores/auth-store";
import { userApi, type UpdatePreferencesDto } from "@/lib/api";

// Debounce time for preference updates (ms)
const SAVE_DEBOUNCE_MS = 1000;

// Sync interval for preferences (5 minutes)
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

interface UsePreferencesReturn {
  // Data
  preferences: UserPreferences | null;
  preferredRole: PreferredRole;

  // Status
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Actions
  fetchPreferences: () => Promise<void>;
  updatePreferences: (updates: UpdatePreferencesDto) => Promise<void>;
  setPreferredRole: (role: PreferredRole) => Promise<void>;

  // Onboarding
  isOnboardingComplete: boolean;
  onboardingStep: number;
  completeOnboardingStep: (step: number) => Promise<void>;
  markWelcomeSeen: () => Promise<void>;
  markTourCompleted: () => Promise<void>;
}

export function usePreferences(): UsePreferencesReturn {
  const { isAuthenticated } = useAuthStore();
  const store = usePreferencesStore();

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdatesRef = useRef<UpdatePreferencesDto>({});

  // Fetch preferences from API
  const fetchPreferences = useCallback(async () => {
    if (!isAuthenticated) return;

    store.setLoading(true);
    store.setError(null);

    try {
      const prefs = await userApi.getPreferences();
      store.setPreferences({
        preferredRole: prefs.preferredRole,
        dashboardLayout: prefs.dashboardLayout as UserPreferences["dashboardLayout"],
        favoriteMetrics: prefs.favoriteMetrics,
        defaultTimeRange: prefs.defaultTimeRange,
        emailNotifications: prefs.emailNotifications,
        weeklyDigest: prefs.weeklyDigest,
        onboardingStep: prefs.onboardingStep,
        onboardingCompletedAt: prefs.onboardingCompletedAt,
        hasSeenWelcome: prefs.hasSeenWelcome,
        hasCompletedTour: prefs.hasCompletedTour,
        faceitAutoImport: prefs.faceitAutoImport,
        faceitImportInterval: prefs.faceitImportInterval,
        theme: prefs.theme as "light" | "dark" | "system",
        compactMode: prefs.compactMode,
        showAdvancedStats: prefs.showAdvancedStats,
        profileVisibility: prefs.profileVisibility,
        shareStats: prefs.shareStats,
      });
      store.markSynced();
    } catch (error) {
      store.setError(
        error instanceof Error ? error.message : "Failed to fetch preferences",
      );
    } finally {
      store.setLoading(false);
    }
  }, [isAuthenticated, store]);

  // Debounced save to API
  const saveToApi = useCallback(async () => {
    if (Object.keys(pendingUpdatesRef.current).length === 0) return;

    store.setSaving(true);

    try {
      await userApi.updatePreferences(pendingUpdatesRef.current);
      pendingUpdatesRef.current = {};
      store.markSynced();
    } catch (error) {
      store.setError(
        error instanceof Error ? error.message : "Failed to save preferences",
      );
    } finally {
      store.setSaving(false);
    }
  }, [store]);

  // Update preferences with debounced API sync
  const updatePreferences = useCallback(
    async (updates: UpdatePreferencesDto) => {
      // Optimistic update in store
      store.updatePreferences(updates as Partial<UserPreferences>);

      // Accumulate pending updates
      pendingUpdatesRef.current = {
        ...pendingUpdatesRef.current,
        ...updates,
      };

      // Debounce API call
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(saveToApi, SAVE_DEBOUNCE_MS);
    },
    [store, saveToApi],
  );

  // Set preferred role
  const setPreferredRole = useCallback(
    async (role: PreferredRole) => {
      await updatePreferences({ preferredRole: role });
    },
    [updatePreferences],
  );

  // Complete onboarding step
  const completeOnboardingStep = useCallback(
    async (step: number) => {
      store.setOnboardingStep(step);
      try {
        await userApi.updateOnboarding(step, false);
      } catch (error) {
        store.setError(
          error instanceof Error ? error.message : "Failed to update onboarding",
        );
      }
    },
    [store],
  );

  // Mark welcome as seen
  const markWelcomeSeen = useCallback(async () => {
    store.markWelcomeSeen();
    try {
      await userApi.markWelcomeSeen();
    } catch (error) {
      store.setError(
        error instanceof Error ? error.message : "Failed to mark welcome seen",
      );
    }
  }, [store]);

  // Mark tour as completed
  const markTourCompleted = useCallback(async () => {
    store.markTourCompleted();
    store.completeOnboarding();
    try {
      await userApi.markTourCompleted();
    } catch (error) {
      store.setError(
        error instanceof Error ? error.message : "Failed to mark tour completed",
      );
    }
  }, [store]);

  // Initial fetch on mount (if authenticated)
  useEffect(() => {
    if (isAuthenticated && !store.preferences) {
      fetchPreferences();
    }
  }, [isAuthenticated, store.preferences, fetchPreferences]);

  // Periodic sync
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      fetchPreferences();
    }, SYNC_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isAuthenticated, fetchPreferences]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        // Flush pending updates
        saveToApi();
      }
    };
  }, [saveToApi]);

  return {
    preferences: store.preferences,
    preferredRole: store.preferences?.preferredRole ?? "PLAYER",
    isLoading: store.isLoading,
    isSaving: store.isSaving,
    error: store.error,
    fetchPreferences,
    updatePreferences,
    setPreferredRole,
    isOnboardingComplete: store.preferences?.onboardingCompletedAt !== null,
    onboardingStep: store.preferences?.onboardingStep ?? 0,
    completeOnboardingStep,
    markWelcomeSeen,
    markTourCompleted,
  };
}

/**
 * Hook for fetching dashboard data
 */
export function useDashboard(role?: PreferredRole, timeRange?: string) {
  const { preferredRole } = usePreferences();
  const effectiveRole = role ?? preferredRole;

  // Use SWR or React Query pattern in production
  // For now, simple implementation
  const fetchDashboard = useCallback(async () => {
    return userApi.getDashboard(effectiveRole, { timeRange });
  }, [effectiveRole, timeRange]);

  return {
    fetchDashboard,
    role: effectiveRole,
  };
}
