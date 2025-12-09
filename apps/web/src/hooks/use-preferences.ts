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
import { useShallow } from "zustand/react/shallow";

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

  // Use useShallow to prevent infinite re-renders - only re-render when values actually change
  const {
    preferences,
    isLoading,
    isSaving,
    error,
    setPreferences,
    updatePreferences: storeUpdatePreferences,
    setLoading,
    setSaving,
    setError,
    markSynced,
    setOnboardingStep,
    markWelcomeSeen: storeMarkWelcomeSeen,
    markTourCompleted: storeMarkTourCompleted,
    completeOnboarding: storeCompleteOnboarding,
  } = usePreferencesStore(
    useShallow((state) => ({
      preferences: state.preferences,
      isLoading: state.isLoading,
      isSaving: state.isSaving,
      error: state.error,
      setPreferences: state.setPreferences,
      updatePreferences: state.updatePreferences,
      setLoading: state.setLoading,
      setSaving: state.setSaving,
      setError: state.setError,
      markSynced: state.markSynced,
      setOnboardingStep: state.setOnboardingStep,
      markWelcomeSeen: state.markWelcomeSeen,
      markTourCompleted: state.markTourCompleted,
      completeOnboarding: state.completeOnboarding,
    })),
  );

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdatesRef = useRef<UpdatePreferencesDto>({});

  // Fetch preferences from API
  const fetchPreferences = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);

    try {
      const prefs = await userApi.getPreferences();
      setPreferences({
        preferredRole: prefs.preferredRole,
        dashboardLayout:
          prefs.dashboardLayout as UserPreferences["dashboardLayout"],
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
      markSynced();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch preferences",
      );
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, setLoading, setError, setPreferences, markSynced]);

  // Debounced save to API
  const saveToApi = useCallback(async () => {
    if (Object.keys(pendingUpdatesRef.current).length === 0) return;

    setSaving(true);

    try {
      await userApi.updatePreferences(pendingUpdatesRef.current);
      pendingUpdatesRef.current = {};
      markSynced();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save preferences",
      );
    } finally {
      setSaving(false);
    }
  }, [setSaving, markSynced, setError]);

  // Update preferences with debounced API sync
  const updatePreferences = useCallback(
    async (updates: UpdatePreferencesDto) => {
      // Optimistic update in store
      storeUpdatePreferences(updates as Partial<UserPreferences>);

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
    [storeUpdatePreferences, saveToApi],
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
      setOnboardingStep(step);
      try {
        await userApi.updateOnboarding(step, false);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to update onboarding",
        );
      }
    },
    [setOnboardingStep, setError],
  );

  // Mark welcome as seen
  const markWelcomeSeen = useCallback(async () => {
    storeMarkWelcomeSeen();
    try {
      await userApi.markWelcomeSeen();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to mark welcome seen",
      );
    }
  }, [storeMarkWelcomeSeen, setError]);

  // Mark tour as completed
  const markTourCompleted = useCallback(async () => {
    storeMarkTourCompleted();
    storeCompleteOnboarding();
    try {
      await userApi.markTourCompleted();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to mark tour completed",
      );
    }
  }, [storeMarkTourCompleted, storeCompleteOnboarding, setError]);

  // Initial fetch on mount (if authenticated)
  useEffect(() => {
    if (isAuthenticated && !preferences) {
      fetchPreferences();
    }
  }, [isAuthenticated, preferences, fetchPreferences]);

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
    preferences,
    preferredRole: preferences?.preferredRole ?? "PLAYER",
    isLoading,
    isSaving,
    error,
    fetchPreferences,
    updatePreferences,
    setPreferredRole,
    isOnboardingComplete: preferences?.onboardingCompletedAt !== null,
    onboardingStep: preferences?.onboardingStep ?? 0,
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
