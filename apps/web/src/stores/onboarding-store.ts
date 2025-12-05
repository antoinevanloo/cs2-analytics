/**
 * Onboarding state management with Zustand
 *
 * Manages transient onboarding state including:
 * - Import progress and status
 * - First insight data
 * - Connected accounts status
 * - Step navigation
 *
 * Note: Persistent onboarding state (step, completedAt) is in preferences-store
 *
 * @module stores/onboarding-store
 */

import { create } from "zustand";

// ============================================================================
// Types (matching backend DTOs)
// ============================================================================

export enum OnboardingStep {
  WELCOME = 0,
  CONNECT_ACCOUNTS = 1,
  SELECT_ROLE = 2,
  IMPORT_MATCHES = 3,
  FIRST_INSIGHT = 4,
  GUIDED_TOUR = 5,
  COMPLETED = 6,
}

export enum ImportSource {
  FACEIT = "FACEIT",
  STEAM = "STEAM",
  MANUAL = "MANUAL",
}

export enum ImportStatus {
  IDLE = "IDLE",
  QUEUED = "QUEUED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

export interface ImportProgress {
  jobId: string;
  status: ImportStatus;
  source: ImportSource;
  progress: number;
  matchesImported: number;
  matchesTotal: number;
  currentMatch: {
    id: string;
    map: string;
    date: string;
  } | null;
  error: string | null;
  estimatedTimeRemaining: number | null;
}

export interface FirstInsight {
  rating: {
    value: number;
    label: string;
    percentile: number;
  };
  topStrength: {
    metric: string;
    label: string;
    value: number;
    insight: string;
  };
  mainWeakness: {
    metric: string;
    label: string;
    value: number;
    insight: string;
    improvementTip: string;
  };
  matchesAnalyzed: number;
  nextStep: {
    title: string;
    description: string;
    actionUrl: string;
  };
}

export interface ConnectedAccounts {
  steam: boolean;
  faceit: boolean;
}

export interface OnboardingStatus {
  currentStep: OnboardingStep;
  isCompleted: boolean;
  completedAt: string | null;
  completedSteps: number[];
  connectedAccounts: ConnectedAccounts;
  selectedRole: string | null;
  importStatus: {
    status: ImportStatus;
    source: ImportSource | null;
    progress: number;
    matchesImported: number;
    matchesTotal: number;
  } | null;
}

// ============================================================================
// Store State
// ============================================================================

interface OnboardingState {
  // Status from backend
  status: OnboardingStatus | null;

  // Import progress (polled during import)
  importProgress: ImportProgress | null;

  // First insight data
  firstInsight: FirstInsight | null;

  // Loading states
  isLoadingStatus: boolean;
  isLoadingInsight: boolean;
  isStartingImport: boolean;

  // Error states
  statusError: string | null;
  importError: string | null;
  insightError: string | null;

  // Polling state
  isPollingImport: boolean;

  // Actions
  setStatus: (status: OnboardingStatus | null) => void;
  setImportProgress: (progress: ImportProgress | null) => void;
  setFirstInsight: (insight: FirstInsight | null) => void;

  setLoadingStatus: (loading: boolean) => void;
  setLoadingInsight: (loading: boolean) => void;
  setStartingImport: (loading: boolean) => void;

  setStatusError: (error: string | null) => void;
  setImportError: (error: string | null) => void;
  setInsightError: (error: string | null) => void;

  setPollingImport: (polling: boolean) => void;

  // Navigation helpers
  goToStep: (step: OnboardingStep) => void;
  nextStep: () => void;
  previousStep: () => void;

  // Reset
  reset: () => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useOnboardingStore = create<OnboardingState>()((set, get) => ({
  // Initial state
  status: null,
  importProgress: null,
  firstInsight: null,

  isLoadingStatus: false,
  isLoadingInsight: false,
  isStartingImport: false,

  statusError: null,
  importError: null,
  insightError: null,

  isPollingImport: false,

  // Setters
  setStatus: (status) => set({ status, statusError: null }),
  setImportProgress: (importProgress) => set({ importProgress }),
  setFirstInsight: (firstInsight) => set({ firstInsight, insightError: null }),

  setLoadingStatus: (isLoadingStatus) => set({ isLoadingStatus }),
  setLoadingInsight: (isLoadingInsight) => set({ isLoadingInsight }),
  setStartingImport: (isStartingImport) => set({ isStartingImport }),

  setStatusError: (statusError) => set({ statusError, isLoadingStatus: false }),
  setImportError: (importError) =>
    set({ importError, isStartingImport: false }),
  setInsightError: (insightError) =>
    set({ insightError, isLoadingInsight: false }),

  setPollingImport: (isPollingImport) => set({ isPollingImport }),

  // Navigation
  goToStep: (step) => {
    const { status } = get();
    if (status) {
      set({
        status: {
          ...status,
          currentStep: step,
        },
      });
    }
  },

  nextStep: () => {
    const { status } = get();
    if (status && status.currentStep < OnboardingStep.COMPLETED) {
      set({
        status: {
          ...status,
          currentStep: status.currentStep + 1,
          completedSteps: [...status.completedSteps, status.currentStep],
        },
      });
    }
  },

  previousStep: () => {
    const { status } = get();
    if (status && status.currentStep > OnboardingStep.WELCOME) {
      set({
        status: {
          ...status,
          currentStep: status.currentStep - 1,
        },
      });
    }
  },

  // Reset
  reset: () =>
    set({
      status: null,
      importProgress: null,
      firstInsight: null,
      isLoadingStatus: false,
      isLoadingInsight: false,
      isStartingImport: false,
      statusError: null,
      importError: null,
      insightError: null,
      isPollingImport: false,
    }),
}));

// ============================================================================
// Selectors
// ============================================================================

export const selectStatus = (state: OnboardingState) => state.status;
export const selectCurrentStep = (state: OnboardingState) =>
  state.status?.currentStep ?? OnboardingStep.WELCOME;
export const selectIsCompleted = (state: OnboardingState) =>
  state.status?.isCompleted ?? false;
export const selectConnectedAccounts = (state: OnboardingState) =>
  state.status?.connectedAccounts ?? { steam: false, faceit: false };
export const selectImportProgress = (state: OnboardingState) =>
  state.importProgress;
export const selectFirstInsight = (state: OnboardingState) =>
  state.firstInsight;
export const selectIsLoading = (state: OnboardingState) =>
  state.isLoadingStatus || state.isLoadingInsight || state.isStartingImport;

// ============================================================================
// Step metadata
// ============================================================================

export const STEP_METADATA: Record<
  OnboardingStep,
  {
    title: string;
    description: string;
    canSkip: boolean;
  }
> = {
  [OnboardingStep.WELCOME]: {
    title: "Welcome",
    description: "Welcome to CS2 Analytics",
    canSkip: false,
  },
  [OnboardingStep.CONNECT_ACCOUNTS]: {
    title: "Connect Accounts",
    description: "Link your Steam and FACEIT accounts",
    canSkip: true,
  },
  [OnboardingStep.SELECT_ROLE]: {
    title: "Select Role",
    description: "Choose how you want to use CS2 Analytics",
    canSkip: false,
  },
  [OnboardingStep.IMPORT_MATCHES]: {
    title: "Import Matches",
    description: "Import your recent matches for analysis",
    canSkip: true,
  },
  [OnboardingStep.FIRST_INSIGHT]: {
    title: "Your First Insight",
    description: "See your personalized performance analysis",
    canSkip: false,
  },
  [OnboardingStep.GUIDED_TOUR]: {
    title: "Guided Tour",
    description: "Learn how to use CS2 Analytics",
    canSkip: true,
  },
  [OnboardingStep.COMPLETED]: {
    title: "Ready to Go",
    description: "You're all set!",
    canSkip: false,
  },
};
