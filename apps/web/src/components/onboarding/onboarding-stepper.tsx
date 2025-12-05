"use client";

/**
 * Onboarding Stepper - Visual progress indicator
 *
 * Displays the current progress through the onboarding flow
 * with step numbers and labels.
 *
 * @module components/onboarding/onboarding-stepper
 */

import { cn } from "@/lib/utils";
import { OnboardingStep, STEP_METADATA } from "@/stores/onboarding-store";
import { Check } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface OnboardingStepperProps {
  currentStep: OnboardingStep;
  completedSteps: number[];
}

// ============================================================================
// Constants
// ============================================================================

// Steps to show in the stepper (exclude WELCOME and COMPLETED)
const VISIBLE_STEPS = [
  OnboardingStep.CONNECT_ACCOUNTS,
  OnboardingStep.SELECT_ROLE,
  OnboardingStep.IMPORT_MATCHES,
  OnboardingStep.FIRST_INSIGHT,
  OnboardingStep.GUIDED_TOUR,
];

// ============================================================================
// Component
// ============================================================================

export function OnboardingStepper({
  currentStep,
  completedSteps,
}: OnboardingStepperProps) {
  // Don't show stepper on welcome or completed steps
  if (
    currentStep === OnboardingStep.WELCOME ||
    currentStep === OnboardingStep.COMPLETED
  ) {
    return null;
  }

  return (
    <div className="flex items-center justify-center gap-2">
      {VISIBLE_STEPS.map((step, index) => {
        const isCompleted = completedSteps.includes(step);
        const isCurrent = step === currentStep;
        const isPast = step < currentStep;

        return (
          <div key={step} className="flex items-center">
            {/* Step indicator */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
                  isCompleted || isPast
                    ? "border-primary bg-primary text-primary-foreground"
                    : isCurrent
                      ? "border-primary bg-background text-primary"
                      : "border-muted bg-muted text-muted-foreground",
                )}
              >
                {isCompleted || isPast ? (
                  <Check className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={cn(
                  "mt-1 hidden text-xs sm:block",
                  isCurrent
                    ? "font-medium text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {STEP_METADATA[step].title}
              </span>
            </div>

            {/* Connector line */}
            {index < VISIBLE_STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-2 h-0.5 w-8 sm:w-12",
                  isPast ? "bg-primary" : "bg-muted",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
