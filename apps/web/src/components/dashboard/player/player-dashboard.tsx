"use client";

/**
 * Player Dashboard
 *
 * Personal improvement focused dashboard showing:
 * - Current rating with trend
 * - Strengths (what you're good at)
 * - Weaknesses (areas to improve)
 * - Next actionable step
 *
 * @module components/dashboard/player/player-dashboard
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RatingBadge, getRatingTier } from "@/components/rating/rating-badge";
import { type DashboardData, type PlayerDashboardData } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Trophy,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface PlayerDashboardProps {
  data: DashboardData;
  className?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

function TrendIndicator({ value }: { value: number }) {
  const isPositive = value >= 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;

  return (
    <div
      className={cn(
        "flex items-center gap-1 text-sm",
        isPositive ? "text-green-500" : "text-red-500",
      )}
    >
      <Icon className="h-4 w-4" />
      <span>
        {isPositive ? "+" : ""}
        {(value * 100).toFixed(1)}%
      </span>
    </div>
  );
}

// ============================================================================
// Rating Card
// ============================================================================

function RatingOverviewCard({
  rating,
  recentMatches,
}: {
  rating: PlayerDashboardData["rating"];
  recentMatches: number;
}) {
  const tier = getRatingTier(rating.current);

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader className="pb-2">
        <CardDescription>Current Performance</CardDescription>
        <CardTitle className="flex items-center justify-between">
          <span>Your Rating</span>
          <Trophy className="h-5 w-5 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-baseline gap-3">
              <RatingBadge rating={rating.current} size="xl" />
              <TrendIndicator value={rating.trend} />
            </div>
            <p className={cn("text-sm font-medium", tier.textColor)}>
              {rating.label}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{recentMatches}</p>
            <p className="text-sm text-muted-foreground">recent matches</p>
          </div>
        </div>

        {/* Rating progress to next tier */}
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Progress to {tier.label}
            </span>
            <span className="font-medium">
              {Math.round(((rating.current - 0.5) / 1.5) * 100)}%
            </span>
          </div>
          <Progress
            value={((rating.current - 0.5) / 1.5) * 100}
            className="h-2"
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Strengths Card
// ============================================================================

function StrengthsCard({ strengths }: { strengths: string[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>Keep it up!</CardDescription>
        <CardTitle className="flex items-center justify-between">
          <span>Your Strengths</span>
          <Zap className="h-5 w-5 text-green-500" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {strengths.length > 0 ? (
            strengths.slice(0, 4).map((strength, index) => (
              <li key={index} className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span className="text-sm">{strength}</span>
              </li>
            ))
          ) : (
            <li className="text-sm text-muted-foreground">
              Play more matches to discover your strengths
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Weaknesses Card
// ============================================================================

function WeaknessesCard({ weaknesses }: { weaknesses: string[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>Focus areas</CardDescription>
        <CardTitle className="flex items-center justify-between">
          <span>To Improve</span>
          <AlertTriangle className="h-5 w-5 text-amber-500" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {weaknesses.length > 0 ? (
            weaknesses.slice(0, 4).map((weakness, index) => (
              <li key={index} className="flex items-start gap-2">
                <Target className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <span className="text-sm">{weakness}</span>
              </li>
            ))
          ) : (
            <li className="text-sm text-muted-foreground">
              No specific weaknesses identified yet
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Next Step Card
// ============================================================================

function NextStepCard({
  nextStep,
}: {
  nextStep: PlayerDashboardData["nextStep"];
}) {
  return (
    <Card className="col-span-full bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardHeader className="pb-2">
        <CardDescription>Recommended action</CardDescription>
        <CardTitle>{nextStep.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          {nextStep.description}
        </p>
        <Button asChild className="gap-2">
          <a href={nextStep.actionUrl}>
            Get started
            <ArrowRight className="h-4 w-4" />
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PlayerDashboard({ data, className }: PlayerDashboardProps) {
  // Type guard for player dashboard data
  const playerData = data.data as PlayerDashboardData;

  return (
    <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-4", className)}>
      {/* Rating overview - spans 2 columns */}
      <RatingOverviewCard
        rating={playerData.rating}
        recentMatches={playerData.recentMatches}
      />

      {/* Strengths */}
      <StrengthsCard strengths={playerData.strengths} />

      {/* Weaknesses */}
      <WeaknessesCard weaknesses={playerData.weaknesses} />

      {/* Next actionable step - spans full width */}
      <NextStepCard nextStep={playerData.nextStep} />
    </div>
  );
}
