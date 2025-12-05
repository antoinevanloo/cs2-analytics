"use client";

/**
 * Dashboard Router
 *
 * Routes to the appropriate role-based dashboard based on user preferences.
 * Handles loading states, error states, and role switching.
 *
 * @module components/dashboard/dashboard-router
 */

import { useCallback, useEffect, useState } from "react";
import { usePreferences } from "@/hooks/use-preferences";
import { type PreferredRole } from "@/stores/preferences-store";
import { userApi, type DashboardData } from "@/lib/api";
import { DashboardSwitcher } from "./dashboard-switcher";
import { PlayerDashboard } from "./player/player-dashboard";
import { CoachDashboard } from "./coach/coach-dashboard";
import { ScoutDashboard } from "./scout/scout-dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

// ============================================================================
// Types
// ============================================================================

interface DashboardRouterProps {
  className?: string;
  initialRole?: PreferredRole;
}

// ============================================================================
// Loading State Component
// ============================================================================

function DashboardSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="h-32">
          <CardContent className="p-6">
            <div className="h-4 bg-muted rounded w-1/2 mb-2" />
            <div className="h-8 bg-muted rounded w-3/4" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
// Error State Component
// ============================================================================

function DashboardError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-semibold mb-2">Failed to load dashboard</h3>
        <p className="text-muted-foreground text-center mb-4 max-w-md">
          {message}
        </p>
        <Button variant="outline" onClick={onRetry} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DashboardRouter({
  className,
  initialRole,
}: DashboardRouterProps) {
  const {
    preferredRole,
    setPreferredRole,
    isLoading: isPreferencesLoading,
    isSaving,
  } = usePreferences();

  const [activeRole, setActiveRole] = useState<PreferredRole>(
    initialRole ?? preferredRole,
  );
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync with preferences when they change
  useEffect(() => {
    if (!initialRole && preferredRole !== activeRole) {
      setActiveRole(preferredRole);
    }
  }, [preferredRole, initialRole, activeRole]);

  // Fetch dashboard data
  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await userApi.getDashboard(activeRole);
      setDashboardData(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load dashboard data",
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeRole]);

  // Fetch on mount and role change
  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Handle role change
  const handleRoleChange = useCallback(
    async (role: PreferredRole) => {
      setActiveRole(role);
      // Persist to preferences
      await setPreferredRole(role);
    },
    [setPreferredRole],
  );

  // Render appropriate dashboard based on role
  const renderDashboard = () => {
    if (isLoading || isPreferencesLoading) {
      return <DashboardSkeleton />;
    }

    if (error) {
      return <DashboardError message={error} onRetry={fetchDashboard} />;
    }

    if (!dashboardData) {
      return <DashboardSkeleton />;
    }

    switch (activeRole) {
      case "PLAYER":
        return <PlayerDashboard data={dashboardData} />;
      case "COACH":
        return <CoachDashboard data={dashboardData} />;
      case "SCOUT":
        return <ScoutDashboard data={dashboardData} />;
      case "ANALYST":
        // TODO: Implement AnalystDashboard
        return <PlayerDashboard data={dashboardData} />;
      case "CREATOR":
        // TODO: Implement CreatorDashboard
        return <PlayerDashboard data={dashboardData} />;
      default:
        return <PlayerDashboard data={dashboardData} />;
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Your personalized CS2 analytics overview
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isSaving && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving...
            </span>
          )}
          <DashboardSwitcher
            currentRole={activeRole}
            onRoleChange={handleRoleChange}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Dashboard content */}
      {renderDashboard()}
    </div>
  );
}

// ============================================================================
// Export
// ============================================================================

export { DashboardSwitcher } from "./dashboard-switcher";
