"use client";

/**
 * Scout Dashboard
 *
 * Opponent analysis focused dashboard showing:
 * - Recent opponents with map pools
 * - Map meta statistics
 * - Player watchlist
 *
 * @module components/dashboard/scout/scout-dashboard
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
import { RatingBadge } from "@/components/rating/rating-badge";
import { type DashboardData, type ScoutDashboardData } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Map,
  Users,
  Eye,
  ArrowRight,
  Trophy,
  Calendar,
  Percent,
  Search,
  Bookmark,
  User,
} from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface ScoutDashboardProps {
  data: DashboardData;
  className?: string;
}

// ============================================================================
// Map Icons/Colors
// ============================================================================

const MAP_COLORS: Record<string, string> = {
  de_mirage: "bg-amber-500",
  de_inferno: "bg-orange-500",
  de_nuke: "bg-blue-500",
  de_overpass: "bg-green-500",
  de_ancient: "bg-emerald-500",
  de_anubis: "bg-yellow-500",
  de_vertigo: "bg-cyan-500",
  default: "bg-gray-500",
};

function MapBadge({ map }: { map: string }) {
  const mapName = map.replace("de_", "").charAt(0).toUpperCase() + map.replace("de_", "").slice(1);
  const color = MAP_COLORS[map] || MAP_COLORS.default;

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white",
        color,
      )}
    >
      {mapName}
    </span>
  );
}

// ============================================================================
// Recent Opponents Card
// ============================================================================

function RecentOpponentsCard({
  opponents,
}: {
  opponents: ScoutDashboardData["recentOpponents"];
}) {
  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader className="pb-2">
        <CardDescription>Team Intelligence</CardDescription>
        <CardTitle className="flex items-center justify-between">
          <span>Recent Opponents</span>
          <Button variant="ghost" size="sm" className="gap-1">
            View all
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {opponents.length > 0 ? (
          <div className="space-y-4">
            {opponents.slice(0, 4).map((opponent, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{opponent.teamName}</p>
                    <div className="flex items-center gap-1 mt-1">
                      {opponent.mapPool.slice(0, 3).map((map) => (
                        <MapBadge key={map} map={map} />
                      ))}
                      {opponent.mapPool.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{opponent.mapPool.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-sm">
                    <Trophy className="h-4 w-4 text-muted-foreground" />
                    <span
                      className={cn(
                        "font-medium",
                        opponent.winRate >= 0.5 ? "text-green-500" : "text-red-500",
                      )}
                    >
                      {(opponent.winRate * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(opponent.lastPlayed).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              No recent opponents found. Play more matches to track opponents.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Map Meta Card
// ============================================================================

function MapMetaCard({ mapMeta }: { mapMeta: ScoutDashboardData["mapMeta"] }) {
  const maps = Object.entries(mapMeta).sort(
    ([, a], [, b]) => b.pickRate - a.pickRate,
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>Current Meta</CardDescription>
        <CardTitle className="flex items-center justify-between">
          <span>Map Pool</span>
          <Map className="h-5 w-5 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {maps.length > 0 ? (
          <div className="space-y-3">
            {maps.slice(0, 5).map(([map, stats]) => (
              <div key={map} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <MapBadge map={map} />
                    <span className="text-muted-foreground">{stats.avgScore}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Percent className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">
                      {(stats.pickRate * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
                <Progress value={stats.pickRate * 100} className="h-1.5" />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No map data available
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Watchlist Card
// ============================================================================

function WatchlistCard({
  watchlist,
}: {
  watchlist: ScoutDashboardData["watchlist"];
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>Players to watch</CardDescription>
        <CardTitle className="flex items-center justify-between">
          <span>Watchlist</span>
          <Eye className="h-5 w-5 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {watchlist.length > 0 ? (
          <div className="space-y-2">
            {watchlist.slice(0, 5).map((player) => (
              <div
                key={player.steamId}
                className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{player.name}</p>
                    <p className="text-xs text-muted-foreground">{player.team}</p>
                  </div>
                </div>
                <RatingBadge rating={player.rating} size="sm" />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <Bookmark className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Add players to your watchlist
            </p>
            <Button variant="outline" size="sm" className="mt-2">
              Browse players
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Quick Actions Card
// ============================================================================

function QuickActionsCard() {
  return (
    <Card className="col-span-full bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardHeader className="pb-2">
        <CardDescription>Scout Tools</CardDescription>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Search className="h-4 w-4" />
            Search Teams
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <User className="h-4 w-4" />
            Find Players
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Map className="h-4 w-4" />
            Map Analysis
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Eye className="h-4 w-4" />
            Watch VOD
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ScoutDashboard({ data, className }: ScoutDashboardProps) {
  // Type guard for scout dashboard data
  const scoutData = data.data as ScoutDashboardData;

  return (
    <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-4", className)}>
      {/* Recent opponents - spans 2 columns */}
      <RecentOpponentsCard opponents={scoutData.recentOpponents} />

      {/* Map meta */}
      <MapMetaCard mapMeta={scoutData.mapMeta} />

      {/* Watchlist */}
      <WatchlistCard watchlist={scoutData.watchlist} />

      {/* Quick actions - spans full width */}
      <QuickActionsCard />
    </div>
  );
}
