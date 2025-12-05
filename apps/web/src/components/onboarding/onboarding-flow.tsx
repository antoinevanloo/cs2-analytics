"use client";

/**
 * Onboarding Flow - Main stepper container
 *
 * Manages the onboarding flow navigation and renders the appropriate
 * step component based on the current step.
 *
 * @module components/onboarding/onboarding-flow
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useOnboarding } from "@/hooks/use-onboarding";
import { OnboardingStep, STEP_METADATA } from "@/stores/onboarding-store";
import { StepWelcome } from "./step-welcome";
import { StepConnect } from "./step-connect";
import { StepRole } from "./step-role";
import { StepImport } from "./step-import";
import { StepFirstInsight } from "./step-first-insight";
import { StepGuidedTour } from "./step-guided-tour";
import { StepComplete } from "./step-complete";
import { OnboardingStepper } from "./onboarding-stepper";

// ============================================================================
// Component
// ============================================================================

export function OnboardingFlow() {
  const router = useRouter();
  const {
    status,
    currentStep,
    isCompleted,
    isLoading,
    error,
    fetchStatus,
  } = useOnboarding();

  // Fetch status on mount
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Redirect to dashboard if onboarding is complete
  useEffect(() => {
    if (isCompleted) {
      router.push("/dashboard");
    }
  }, [isCompleted, router]);

  // Loading state
  if (isLoading && !status) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !status) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="text-4xl">:(</div>
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => fetchStatus()}
            className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Render step component
  const renderStep = () => {
    switch (currentStep) {
      case OnboardingStep.WELCOME:
        return <StepWelcome />;
      case OnboardingStep.CONNECT_ACCOUNTS:
        return <StepConnect />;
      case OnboardingStep.SELECT_ROLE:
        return <StepRole />;
      case OnboardingStep.IMPORT_MATCHES:
        return <StepImport />;
      case OnboardingStep.FIRST_INSIGHT:
        return <StepFirstInsight />;
      case OnboardingStep.GUIDED_TOUR:
        return <StepGuidedTour />;
      case OnboardingStep.COMPLETED:
        return <StepComplete />;
      default:
        return <StepWelcome />;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header with stepper */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
                CS2
              </div>
              <div>
                <h1 className="text-lg font-semibold">CS2 Analytics</h1>
                <p className="text-sm text-muted-foreground">
                  {STEP_METADATA[currentStep].title}
                </p>
              </div>
            </div>

            {/* Skip button for skippable steps */}
            {STEP_METADATA[currentStep].canSkip && (
              <button
                className="text-sm text-muted-foreground hover:text-foreground"
                onClick={() => {
                  // Handle skip logic
                }}
              >
                Skip for now
              </button>
            )}
          </div>

          {/* Stepper indicator */}
          <div className="mt-6">
            <OnboardingStepper
              currentStep={currentStep}
              completedSteps={status?.completedSteps ?? []}
            />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          <div
            className={cn(
              "mx-auto max-w-2xl",
              currentStep === OnboardingStep.FIRST_INSIGHT && "max-w-3xl",
              currentStep === OnboardingStep.GUIDED_TOUR && "max-w-4xl",
            )}
          >
            {renderStep()}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card py-4">
        <div className="container mx-auto px-4">
          <p className="text-center text-xs text-muted-foreground">
            Step {currentStep + 1} of {Object.keys(OnboardingStep).length / 2}
          </p>
        </div>
      </footer>
    </div>
  );
}
