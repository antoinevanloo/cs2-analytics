"use client";

/**
 * Step Guided Tour - Interactive feature tour
 *
 * Introduces key features with a guided walkthrough.
 *
 * @module components/onboarding/step-guided-tour
 */

import { useState } from "react";
import { useOnboarding } from "@/hooks/use-onboarding";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  ArrowLeft,
  BarChart3,
  Play,
  Users,
  TrendingUp,
  Check,
  SkipForward,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  image?: string;
  features: string[];
}

// ============================================================================
// Data
// ============================================================================

const TOUR_STEPS: TourStep[] = [
  {
    id: "dashboard",
    title: "Personalized Dashboard",
    description:
      "Your dashboard is customized based on your role. See the metrics that matter most to you at a glance.",
    icon: BarChart3,
    features: [
      "Role-specific layout and widgets",
      "Quick access to recent matches",
      "Performance trends over time",
      "Customizable metric cards",
    ],
  },
  {
    id: "replay",
    title: "2D Replay Viewer",
    description:
      "Analyze any round with our interactive 2D replay. See player positions, utility, and key moments.",
    icon: Play,
    features: [
      "Frame-by-frame playback control",
      "Player position tracking",
      "Utility and grenade visualization",
      "Export clips as GIF or video",
    ],
  },
  {
    id: "analysis",
    title: "Deep Performance Analysis",
    description:
      "Go beyond basic stats. Understand your impact with advanced metrics like KAST, ADR, and trade efficiency.",
    icon: TrendingUp,
    features: [
      "HLTV 2.0 rating breakdown",
      "Strength and weakness identification",
      "Map-specific performance",
      "Role-based comparisons",
    ],
  },
  {
    id: "team",
    title: "Team & Opponent Insights",
    description:
      "For coaches and scouts: analyze team dynamics and prepare for opponents with detailed scouting reports.",
    icon: Users,
    features: [
      "Team health overview",
      "Player development tracking",
      "Opponent tendency analysis",
      "Strategy pattern detection",
    ],
  },
];

// ============================================================================
// Component
// ============================================================================

export function StepGuidedTour() {
  const { markTourAsCompleted, completeOnboarding } = useOnboarding();
  const [currentTourStep, setCurrentTourStep] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);

  const currentStep = TOUR_STEPS[currentTourStep];
  const isLastStep = currentTourStep === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentTourStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentTourStep((prev) => Math.max(0, prev - 1));
  };

  const handleSkip = async () => {
    await handleComplete();
  };

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      await markTourAsCompleted();
      await completeOnboarding();
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
    } finally {
      setIsCompleting(false);
    }
  };

  if (!currentStep) return null;

  const Icon = currentStep.icon;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="mb-6 text-center">
        <h2 className="mb-2 text-2xl font-bold">Quick Tour</h2>
        <p className="text-muted-foreground">
          Learn about the key features of CS2 Analytics
        </p>
      </div>

      {/* Tour step indicators */}
      <div className="mb-6 flex justify-center gap-2">
        {TOUR_STEPS.map((step, index) => (
          <button
            key={step.id}
            onClick={() => setCurrentTourStep(index)}
            className={cn(
              "h-2 w-8 rounded-full transition-colors",
              index === currentTourStep
                ? "bg-primary"
                : index < currentTourStep
                  ? "bg-primary/50"
                  : "bg-muted",
            )}
            aria-label={`Go to step ${index + 1}`}
          />
        ))}
      </div>

      {/* Current tour step */}
      <div className="mb-8 rounded-xl border bg-card p-6">
        {/* Icon and title */}
        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            <Icon className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-bold">{currentStep.title}</h3>
            <p className="text-sm text-muted-foreground">
              Step {currentTourStep + 1} of {TOUR_STEPS.length}
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="mb-4 text-muted-foreground">{currentStep.description}</p>

        {/* Features list */}
        <div className="rounded-lg bg-muted/50 p-4">
          <h4 className="mb-3 text-sm font-medium">Key Features:</h4>
          <ul className="space-y-2">
            {currentStep.features.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 shrink-0 text-primary" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {currentTourStep > 0 && (
            <Button variant="outline" onClick={handlePrevious}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>
          )}
          <Button variant="ghost" onClick={handleSkip} disabled={isCompleting}>
            <SkipForward className="mr-2 h-4 w-4" />
            Skip Tour
          </Button>
        </div>

        <Button onClick={handleNext} disabled={isCompleting} className="gap-2">
          {isCompleting ? (
            "Completing..."
          ) : isLastStep ? (
            <>
              <Check className="h-4 w-4" />
              Complete Setup
            </>
          ) : (
            <>
              Next
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
