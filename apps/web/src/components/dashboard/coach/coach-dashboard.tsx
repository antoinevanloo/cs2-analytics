"use client";

/**
 * Coach Dashboard
 *
 * Team management focused dashboard showing:
 * - Team health overview (overall rating, trend)
 * - Player tiles with individual ratings
 * - Alerts for players needing attention
 *
 * @module components/dashboard/coach/coach-dashboard
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
import { type DashboardData, type CoachDashboardData } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Users,
  AlertCircle,
  Info,
  AlertTriangle,
  User,
  ArrowRight,
  Activity,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface CoachDashboardProps {
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
      <span>{isPositive ? "+" : ""}{(value * 100).toFixed(1)}%</span>
    </div>
  );
}

// ============================================================================
// Team Health Card
// ============================================================================

function TeamHealthCard({
  teamHealth,
}: {
  teamHealth: CoachDashboardData["teamHealth"];
}) {
  const tier = getRatingTier(teamHealth.overallRating);

  // Calculate health percentage (0.5-2.0 range mapped to 0-100%)
  const healthPercent = Math.min(
    100,
    Math.max(0, ((teamHealth.overallRating - 0.5) / 1.5) * 100),
  );

  // Determine health status
  const healthStatus =
    teamHealth.overallRating >= 1.1
      ? { label: "Excellent", color: "text-green-500" }
      : teamHealth.overallRating >= 1.0
        ? { label: "Good", color: "text-emerald-500" }
        : teamHealth.overallRating >= 0.9
          ? { label: "Average", color: "text-yellow-500" }
          : { label: "Needs Attention", color: "text-red-500" };

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader className="pb-2">
        <CardDescription>Team Overview</CardDescription>
        <CardTitle className="flex items-center justify-between">
          <span>Team Health</span>
          <Activity className="h-5 w-5 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <div className="space-y-1">
            <div className="flex items-baseline gap-3">
              <RatingBadge rating={teamHealth.overallRating} size="xl" />
              <TrendIndicator value={teamHealth.trend} />
            </div>
            <p className={cn("text-sm font-medium", healthStatus.color)}>
              {healthStatus.label}
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 text-3xl font-bold">
              <Users className="h-6 w-6 text-muted-foreground" />
              {teamHealth.playerCount}
            </div>
            <p className="text-sm text-muted-foreground">active players</p>
          </div>
        </div>

        {/* Health bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Team Rating</span>
            <span className={cn("font-medium", tier.textColor)}>{tier.label}</span>
          </div>
          <Progress value={healthPercent} className="h-3" />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Player Tiles
// ============================================================================

function PlayerTile({
  player,
}: {
  player: CoachDashboardData["playerTiles"][0];
}) {
  const tier = getRatingTier(player.rating);
  const isImproving = player.trend > 0;

  return (
    <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
              {player.avatar ? (
                <img
                  src={player.avatar}
                  alt={player.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <User className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            {/* Trend indicator dot */}
            <div
              className={cn(
                "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
                isImproving ? "bg-green-500" : "bg-red-500",
              )}
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{player.name}</p>
            <div className="flex items-center gap-2">
              <RatingBadge rating={player.rating} size="sm" />
              <span className={cn("text-xs", tier.textColor)}>{tier.label}</span>
            </div>
          </div>

          {/* Trend */}
          <TrendIndicator value={player.trend} />
        </div>
      </CardContent>
    </Card>
  );
}

function PlayerTilesCard({
  players,
}: {
  players: CoachDashboardData["playerTiles"];
}) {
  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader className="pb-2">
        <CardDescription>Individual Performance</CardDescription>
        <CardTitle className="flex items-center justify-between">
          <span>Players</span>
          <Button variant="ghost" size="sm" className="gap-1">
            View all
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {players.length > 0 ? (
            players.slice(0, 6).map((player) => (
              <PlayerTile key={player.steamId} player={player} />
            ))
          ) : (
            <p className="text-sm text-muted-foreground col-span-full text-center py-8">
              No players tracked yet. Add team members to see their performance.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Alerts Card
// ============================================================================

const ALERT_ICONS = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
};

const ALERT_STYLES = {
  info: "bg-blue-500/10 border-blue-500/20 text-blue-600",
  warning: "bg-amber-500/10 border-amber-500/20 text-amber-600",
  error: "bg-red-500/10 border-red-500/20 text-red-600",
};

function AlertsCard({ alerts }: { alerts: CoachDashboardData["alerts"] }) {
  return (
    <Card className="col-span-full">
      <CardHeader className="pb-2">
        <CardDescription>Action Items</CardDescription>
        <CardTitle className="flex items-center justify-between">
          <span>Team Alerts</span>
          {alerts.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              {alerts.length} active
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length > 0 ? (
          <div className="space-y-2">
            {alerts.slice(0, 5).map((alert, index) => {
              const Icon = ALERT_ICONS[alert.severity];
              const style = ALERT_STYLES[alert.severity];

              return (
                <div
                  key={index}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border",
                    style,
                  )}
                >
                  <Icon className="h-5 w-5 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{alert.type}</p>
                    <p className="text-sm opacity-80">{alert.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
              <Activity className="h-6 w-6 text-green-500" />
            </div>
            <p className="font-medium">All systems healthy</p>
            <p className="text-sm text-muted-foreground">
              No alerts requiring your attention
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CoachDashboard({ data, className }: CoachDashboardProps) {
  // Type guard for coach dashboard data
  const coachData = data.data as CoachDashboardData;

  return (
    <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-4", className)}>
      {/* Team health overview */}
      <TeamHealthCard teamHealth={coachData.teamHealth} />

      {/* Player tiles */}
      <PlayerTilesCard players={coachData.playerTiles} />

      {/* Alerts */}
      <AlertsCard alerts={coachData.alerts} />
    </div>
  );
}
