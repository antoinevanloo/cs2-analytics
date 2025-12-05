/**
 * Onboarding hook - API integration and orchestration
 *
 * Provides a unified interface for onboarding operations:
 * - Fetching and updating onboarding status
 * - Managing import progress with polling
 * - Fetching first insight
 * - Step navigation
 *
 * @module hooks/use-onboarding
 */

import { useCallback, useEffect, useRef } from "react";
import { useAuthStore } from "../stores/auth-store";
import { usePreferencesStore } from "../stores/preferences-store";
import {
  useOnboardingStore,
  OnboardingStep,
  ImportSource,
  ImportStatus,
  type OnboardingStatus,
  type ImportProgress,
  type FirstInsight,
} from "../stores/onboarding-store";

// ============================================================================
// Configuration
// ============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const IMPORT_POLL_INTERVAL = 2000; // 2 seconds

// ============================================================================
// API Types
// ============================================================================

interface ApiError {
  message: string;
  statusCode: number;
}

// ============================================================================
// Hook
// ============================================================================

export function useOnboarding() {
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auth store for tokens
  const { getAccessToken, isAuthenticated } = useAuthStore();

  // Preferences store for persistent state
  const {
    setOnboardingStep: setPreferencesStep,
    completeOnboarding: completePreferencesOnboarding,
    markWelcomeSeen,
    markTourCompleted,
    preferences,
  } = usePreferencesStore();

  // Onboarding store for transient state
  const {
    status,
    importProgress,
    firstInsight,
    isLoadingStatus,
    isLoadingInsight,
    isStartingImport,
    isPollingImport,
    statusError,
    importError,
    insightError,
    setStatus,
    setImportProgress,
    setFirstInsight,
    setLoadingStatus,
    setLoadingInsight,
    setStartingImport,
    setStatusError,
    setImportError,
    setInsightError,
    setPollingImport,
    goToStep,
    nextStep,
    previousStep,
    reset,
  } = useOnboardingStore();

  // ===========================================================================
  // API Helpers
  // ===========================================================================

  const apiRequest = useCallback(
    async <T>(
      endpoint: string,
      options: RequestInit = {},
    ): Promise<T> => {
      const token = getAccessToken();
      if (!token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error: ApiError = await response.json().catch(() => ({
          message: "An error occurred",
          statusCode: response.status,
        }));
        throw new Error(error.message);
      }

      return response.json();
    },
    [getAccessToken],
  );

  // ===========================================================================
  // Fetch Status
  // ===========================================================================

  const fetchStatus = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoadingStatus(true);
    try {
      const data = await apiRequest<OnboardingStatus>("/v1/onboarding/status");
      setStatus(data);
      // Sync with preferences store
      setPreferencesStep(data.currentStep);
    } catch (error) {
      setStatusError(
        error instanceof Error ? error.message : "Failed to fetch status",
      );
    }
  }, [isAuthenticated, apiRequest, setStatus, setLoadingStatus, setStatusError, setPreferencesStep]);

  // ===========================================================================
  // Update Step
  // ===========================================================================

  const updateStep = useCallback(
    async (step: OnboardingStep, data?: Record<string, unknown>) => {
      try {
        const response = await apiRequest<OnboardingStatus>(
          "/v1/onboarding/step",
          {
            method: "POST",
            body: JSON.stringify({ step, data }),
          },
        );
        setStatus(response);
        setPreferencesStep(step);
        return response;
      } catch (error) {
        setStatusError(
          error instanceof Error ? error.message : "Failed to update step",
        );
        throw error;
      }
    },
    [apiRequest, setStatus, setStatusError, setPreferencesStep],
  );

  // ===========================================================================
  // Select Role
  // ===========================================================================

  const selectRole = useCallback(
    async (role: string, focusAreas?: string[]) => {
      try {
        const response = await apiRequest<OnboardingStatus>(
          "/v1/onboarding/role",
          {
            method: "POST",
            body: JSON.stringify({ role, focusAreas }),
          },
        );
        setStatus(response);
        return response;
      } catch (error) {
        setStatusError(
          error instanceof Error ? error.message : "Failed to select role",
        );
        throw error;
      }
    },
    [apiRequest, setStatus, setStatusError],
  );

  // ===========================================================================
  // Import Management
  // ===========================================================================

  const startImport = useCallback(
    async (
      source: ImportSource,
      matchCount = 10,
      enableAutoImport = false,
    ) => {
      setStartingImport(true);
      setImportError(null);

      try {
        const response = await apiRequest<ImportProgress>(
          "/v1/onboarding/import/start",
          {
            method: "POST",
            body: JSON.stringify({ source, matchCount, enableAutoImport }),
          },
        );
        setImportProgress(response);
        setStartingImport(false);

        // Start polling
        startImportPolling();

        return response;
      } catch (error) {
        setImportError(
          error instanceof Error ? error.message : "Failed to start import",
        );
        setStartingImport(false);
        throw error;
      }
    },
    [apiRequest, setImportProgress, setStartingImport, setImportError],
  );

  const fetchImportProgress = useCallback(async () => {
    try {
      const response = await apiRequest<ImportProgress | null>(
        "/v1/onboarding/import/progress",
      );
      setImportProgress(response);
      return response;
    } catch (error) {
      // Silently handle polling errors
      console.warn("Failed to fetch import progress:", error);
      return null;
    }
  }, [apiRequest, setImportProgress]);

  const startImportPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    setPollingImport(true);

    pollIntervalRef.current = setInterval(async () => {
      const progress = await fetchImportProgress();

      // Stop polling if import is complete or failed
      if (
        progress &&
        (progress.status === ImportStatus.COMPLETED ||
          progress.status === ImportStatus.FAILED ||
          progress.status === ImportStatus.CANCELLED)
      ) {
        stopImportPolling();

        // Auto-advance to next step on completion
        if (progress.status === ImportStatus.COMPLETED) {
          nextStep();
        }
      }
    }, IMPORT_POLL_INTERVAL);
  }, [fetchImportProgress, setPollingImport, nextStep]);

  const stopImportPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setPollingImport(false);
  }, [setPollingImport]);

  const skipImport = useCallback(
    async (reason?: string) => {
      try {
        const response = await apiRequest<OnboardingStatus>(
          "/v1/onboarding/import/skip",
          {
            method: "POST",
            body: JSON.stringify({ reason }),
          },
        );
        setStatus(response);
        stopImportPolling();
        return response;
      } catch (error) {
        setImportError(
          error instanceof Error ? error.message : "Failed to skip import",
        );
        throw error;
      }
    },
    [apiRequest, setStatus, setImportError, stopImportPolling],
  );

  const cancelImport = useCallback(async () => {
    try {
      await apiRequest<{ success: boolean }>("/v1/onboarding/import/cancel", {
        method: "POST",
      });
      stopImportPolling();
      setImportProgress(null);
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "Failed to cancel import",
      );
      throw error;
    }
  }, [apiRequest, setImportProgress, setImportError, stopImportPolling]);

  // ===========================================================================
  // First Insight
  // ===========================================================================

  const fetchFirstInsight = useCallback(async () => {
    setLoadingInsight(true);
    try {
      const data = await apiRequest<FirstInsight>("/v1/onboarding/first-insight");
      setFirstInsight(data);
      return data;
    } catch (error) {
      setInsightError(
        error instanceof Error ? error.message : "Failed to fetch insight",
      );
      throw error;
    }
  }, [apiRequest, setFirstInsight, setLoadingInsight, setInsightError]);

  // ===========================================================================
  // Complete Onboarding
  // ===========================================================================

  const completeOnboarding = useCallback(async () => {
    try {
      const response = await apiRequest<{
        success: boolean;
        redirectUrl: string;
        summary: {
          accountsConnected: string[];
          matchesImported: number;
          selectedRole: string;
          insightGenerated: boolean;
        };
      }>("/v1/onboarding/complete", {
        method: "POST",
      });

      // Update local state
      completePreferencesOnboarding();
      goToStep(OnboardingStep.COMPLETED);

      return response;
    } catch (error) {
      setStatusError(
        error instanceof Error ? error.message : "Failed to complete onboarding",
      );
      throw error;
    }
  }, [apiRequest, completePreferencesOnboarding, goToStep, setStatusError]);

  // ===========================================================================
  // Quick Actions
  // ===========================================================================

  const markWelcomeAsSeen = useCallback(async () => {
    try {
      await apiRequest<{ success: boolean }>("/v1/onboarding/welcome-seen", {
        method: "POST",
      });
      markWelcomeSeen();
    } catch (error) {
      console.warn("Failed to mark welcome as seen:", error);
    }
  }, [apiRequest, markWelcomeSeen]);

  const markTourAsCompleted = useCallback(async () => {
    try {
      await apiRequest<{ success: boolean }>("/v1/onboarding/tour-completed", {
        method: "POST",
      });
      markTourCompleted();
    } catch (error) {
      console.warn("Failed to mark tour as completed:", error);
    }
  }, [apiRequest, markTourCompleted]);

  // ===========================================================================
  // Effects
  // ===========================================================================

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Resume polling if import is in progress
  useEffect(() => {
    if (
      importProgress &&
      (importProgress.status === ImportStatus.IN_PROGRESS ||
        importProgress.status === ImportStatus.QUEUED) &&
      !isPollingImport
    ) {
      startImportPolling();
    }
  }, [importProgress, isPollingImport, startImportPolling]);

  // ===========================================================================
  // Return
  // ===========================================================================

  return {
    // State
    status,
    importProgress,
    firstInsight,
    currentStep: status?.currentStep ?? OnboardingStep.WELCOME,
    isCompleted: status?.isCompleted ?? false,
    connectedAccounts: status?.connectedAccounts ?? { steam: false, faceit: false },

    // Loading states
    isLoading: isLoadingStatus,
    isLoadingInsight,
    isStartingImport,
    isPollingImport,

    // Errors
    error: statusError || importError || insightError,
    statusError,
    importError,
    insightError,

    // Actions
    fetchStatus,
    updateStep,
    selectRole,

    // Import
    startImport,
    fetchImportProgress,
    skipImport,
    cancelImport,

    // Insight
    fetchFirstInsight,

    // Navigation
    goToStep,
    nextStep,
    previousStep,

    // Completion
    completeOnboarding,
    markWelcomeAsSeen,
    markTourAsCompleted,

    // Reset
    reset,

    // Preferences (for persistence)
    hasSeenWelcome: preferences?.hasSeenWelcome ?? false,
    hasCompletedTour: preferences?.hasCompletedTour ?? false,
  };
}

// ============================================================================
// Exports
// ============================================================================

export type { OnboardingStatus, ImportProgress, FirstInsight };
export { OnboardingStep, ImportSource, ImportStatus };
