"use client";

/**
 * Rating Card - Detailed HLTV Rating 2.0 display with component breakdown
 *
 * Shows:
 * - Overall rating with tier label
 * - Component breakdown (KAST, KPR, DPR, Impact, ADR)
 * - Contribution visualization
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RatingBadge, getRatingTier } from "./rating-badge";
import { cn } from "@/lib/utils";

interface RatingComponents {
  kast: number;
  kpr: number;
  dpr: number;
  impact: number;
  adr: number;
}

interface RatingContributions {
  kastContribution: number;
  kprContribution: number;
  dprContribution: number;
  impactContribution: number;
  adrContribution: number;
  constant: number;
}

interface RatingCardProps {
  playerName: string;
  rating: number;
  components: RatingComponents;
  contributions: RatingContributions;
  className?: string;
}

/**
 * Component benchmark reference values for visualization
 */
const COMPONENT_BENCHMARKS = {
  kast: { min: 50, max: 85, avg: 70, label: "KAST", unit: "%" },
  kpr: { min: 0.4, max: 1.0, avg: 0.7, label: "Kills/Round", unit: "" },
  dpr: { min: 0.4, max: 0.8, avg: 0.65, label: "Deaths/Round", unit: "" },
  impact: { min: 0.7, max: 1.4, avg: 1.0, label: "Impact", unit: "" },
  adr: { min: 50, max: 100, avg: 75, label: "ADR", unit: "" },
};

function ComponentBar({
  label,
  value,
  benchmark,
  contribution,
  isNegative = false,
}: {
  label: string;
  value: number;
  benchmark: { min: number; max: number; avg: number; unit: string };
  contribution: number;
  isNegative?: boolean;
}) {
  // Normalize value to 0-100 for progress bar
  const normalizedValue = Math.min(
    100,
    Math.max(
      0,
      ((value - benchmark.min) / (benchmark.max - benchmark.min)) * 100,
    ),
  );

  // Determine color based on contribution
  const isPositive = contribution > 0;
  const color = isNegative
    ? isPositive
      ? "text-red-500"
      : "text-green-500"
    : isPositive
      ? "text-green-500"
      : "text-red-500";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-medium">
            {value.toFixed(label === "KAST" || label === "ADR" ? 0 : 2)}
            {benchmark.unit}
          </span>
          <span className={cn("text-xs font-mono", color)}>
            {contribution >= 0 ? "+" : ""}
            {contribution.toFixed(3)}
          </span>
        </div>
      </div>
      <Progress
        value={normalizedValue}
        className={cn(
          "h-1.5",
          isNegative ? "bg-red-500/20" : "bg-green-500/20",
        )}
      />
    </div>
  );
}

export function RatingCard({
  playerName,
  rating,
  components,
  contributions,
  className,
}: RatingCardProps) {
  const tier = getRatingTier(rating);

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{playerName}</CardTitle>
            <CardDescription>HLTV Rating 2.0</CardDescription>
          </div>
          <div className="text-right">
            <RatingBadge rating={rating} size="lg" />
            <p className={cn("text-xs mt-1", tier.textColor)}>{tier.label}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ComponentBar
          label={COMPONENT_BENCHMARKS.kast.label}
          value={components.kast}
          benchmark={COMPONENT_BENCHMARKS.kast}
          contribution={contributions.kastContribution}
        />
        <ComponentBar
          label={COMPONENT_BENCHMARKS.kpr.label}
          value={components.kpr}
          benchmark={COMPONENT_BENCHMARKS.kpr}
          contribution={contributions.kprContribution}
        />
        <ComponentBar
          label={COMPONENT_BENCHMARKS.dpr.label}
          value={components.dpr}
          benchmark={COMPONENT_BENCHMARKS.dpr}
          contribution={contributions.dprContribution}
          isNegative={true}
        />
        <ComponentBar
          label={COMPONENT_BENCHMARKS.impact.label}
          value={components.impact}
          benchmark={COMPONENT_BENCHMARKS.impact}
          contribution={contributions.impactContribution}
        />
        <ComponentBar
          label={COMPONENT_BENCHMARKS.adr.label}
          value={components.adr}
          benchmark={COMPONENT_BENCHMARKS.adr}
          contribution={contributions.adrContribution}
        />

        {/* Formula explanation */}
        <div className="pt-2 border-t text-xs text-muted-foreground">
          <p className="font-mono">
            Rating = {contributions.kastContribution.toFixed(3)} +{" "}
            {contributions.kprContribution.toFixed(3)}{" "}
            {contributions.dprContribution >= 0 ? "+" : ""}
            {contributions.dprContribution.toFixed(3)} +{" "}
            {contributions.impactContribution.toFixed(3)} +{" "}
            {contributions.adrContribution.toFixed(3)} +{" "}
            {contributions.constant.toFixed(3)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export type { RatingComponents, RatingContributions, RatingCardProps };
