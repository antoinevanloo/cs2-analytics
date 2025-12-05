"use client";

/**
 * Step First Insight - Show user's first analytics insight
 *
 * Displays the "ah-ha" moment with rating and main weakness.
 *
 * @module components/onboarding/step-first-insight
 */

import { useEffect } from "react";
import { useOnboarding } from "@/hooks/use-onboarding";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Loader2,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  Target,
  AlertCircle,
} from "lucide-react";

// ============================================================================
// Component
// ============================================================================

export function StepFirstInsight() {
  const {
    firstInsight,
    isLoadingInsight,
    insightError,
    fetchFirstInsight,
    nextStep,
  } = useOnboarding();

  // Fetch insight on mount
  useEffect(() => {
    if (!firstInsight) {
      fetchFirstInsight();
    }
  }, [firstInsight, fetchFirstInsight]);

  // Loading state
  if (isLoadingInsight) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
        <h2 className="mb-2 text-xl font-bold">Analyzing Your Performance</h2>
        <p className="text-muted-foreground">
          Crunching the numbers from your matches...
        </p>
      </div>
    );
  }

  // Error state
  if (insightError) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
        <h2 className="mb-2 text-xl font-bold">Unable to Generate Insights</h2>
        <p className="mb-6 text-muted-foreground">{insightError}</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => fetchFirstInsight()}>
            Try Again
          </Button>
          <Button onClick={nextStep}>
            Continue Anyway
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // No insight yet
  if (!firstInsight) {
    return null;
  }

  // Get rating color
  const getRatingColor = (value: number) => {
    if (value >= 1.15) return "text-green-500";
    if (value >= 1.0) return "text-yellow-500";
    if (value >= 0.85) return "text-orange-500";
    return "text-red-500";
  };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="mb-8 text-center">
        <h2 className="mb-2 text-2xl font-bold">Your First Insight</h2>
        <p className="text-muted-foreground">
          Based on {firstInsight.matchesAnalyzed} analyzed matches
        </p>
      </div>

      {/* Rating card */}
      <div className="mb-6 rounded-xl border bg-gradient-to-br from-card to-card/50 p-6 text-center">
        <p className="mb-2 text-sm font-medium text-muted-foreground">
          Your HLTV 2.0 Rating
        </p>
        <div
          className={cn(
            "mb-2 text-5xl font-bold tabular-nums",
            getRatingColor(firstInsight.rating.value),
          )}
        >
          {firstInsight.rating.value.toFixed(2)}
        </div>
        <p className="text-sm text-muted-foreground">
          {firstInsight.rating.label} -{" "}
          <span className="font-medium">
            Top {100 - firstInsight.rating.percentile}%
          </span>{" "}
          of players
        </p>
      </div>

      {/* Strength and Weakness */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        {/* Top Strength */}
        <div className="rounded-lg border bg-green-500/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20">
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
            <span className="text-sm font-medium text-green-600 dark:text-green-400">
              Top Strength
            </span>
          </div>
          <h3 className="mb-1 font-semibold">
            {firstInsight.topStrength.label}
          </h3>
          <p className="mb-2 text-2xl font-bold text-green-600 dark:text-green-400">
            {typeof firstInsight.topStrength.value === "number"
              ? firstInsight.topStrength.value.toFixed(1)
              : firstInsight.topStrength.value}
          </p>
          <p className="text-sm text-muted-foreground">
            {firstInsight.topStrength.insight}
          </p>
        </div>

        {/* Main Weakness */}
        <div className="rounded-lg border bg-orange-500/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/20">
              <TrendingDown className="h-4 w-4 text-orange-500" />
            </div>
            <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
              Area to Improve
            </span>
          </div>
          <h3 className="mb-1 font-semibold">
            {firstInsight.mainWeakness.label}
          </h3>
          <p className="mb-2 text-2xl font-bold text-orange-600 dark:text-orange-400">
            {typeof firstInsight.mainWeakness.value === "number"
              ? firstInsight.mainWeakness.value.toFixed(1)
              : firstInsight.mainWeakness.value}
          </p>
          <p className="text-sm text-muted-foreground">
            {firstInsight.mainWeakness.insight}
          </p>
        </div>
      </div>

      {/* Improvement tip */}
      <div className="mb-8 rounded-lg border bg-primary/5 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          <span className="font-medium">Quick Tip</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {firstInsight.mainWeakness.improvementTip}
        </p>
      </div>

      {/* Next step preview */}
      <div className="mb-6 rounded-lg border bg-muted/50 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <span className="font-medium">What's Next</span>
        </div>
        <h4 className="font-medium">{firstInsight.nextStep.title}</h4>
        <p className="text-sm text-muted-foreground">
          {firstInsight.nextStep.description}
        </p>
      </div>

      {/* Navigation */}
      <div className="flex justify-end">
        <Button onClick={nextStep} className="gap-2">
          Continue to Tour
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
