"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { playersApi, ratingsApi, type PlayerProfile } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RatingBadge } from "@/components/rating/rating-badge";
import { RatingTrend } from "@/components/rating/rating-trend";
import {
  ArrowLeft,
  User,
  Trophy,
  Target,
  Skull,
  TrendingUp,
  TrendingDown,
  Calendar,
  Map,
  Loader2,
  AlertCircle,
  Crosshair,
  Shield,
  Flame,
} from "lucide-react";

export default function PlayerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const steamId = params.id as string;

  const {
    data: player,
    isLoading,
    error,
  } = useQuery<PlayerProfile>({
    queryKey: ["player", steamId],
    queryFn: () => playersApi.get(steamId),
    enabled: !!steamId,
  });

  const { data: ratingHistory } = useQuery({
    queryKey: ["player-rating-history", steamId],
    queryFn: () => ratingsApi.getRatingHistory(steamId, { limit: 20 }),
    enabled: !!steamId,
  });

  const { data: matches } = useQuery({
    queryKey: ["player-matches", steamId],
    queryFn: () => playersApi.getMatches(steamId, { limit: 10 }),
    enabled: !!steamId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading player...</p>
        </div>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <h2 className="text-xl font-semibold">Player not found</h2>
          <p className="text-muted-foreground">
            The player you're looking for doesn't exist in our database.
          </p>
          <Button onClick={() => router.push("/players")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Players
          </Button>
        </div>
      </div>
    );
  }

  const stats = player.stats || {};
  const avgRating = ratingHistory?.statistics?.avgRating ?? stats.rating ?? 1.0;
  const trend = ratingHistory?.statistics?.trend ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/players")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          {/* Player Avatar & Info */}
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              {player.avatarUrl ? (
                <img
                  src={player.avatarUrl}
                  alt={player.name}
                  className="w-full h-full rounded-xl object-cover"
                />
              ) : (
                <User className="h-10 w-10 text-primary" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{player.name}</h1>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {player.team && (
                  <span className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    {player.team}
                  </span>
                )}
                <span>{player.matchCount} matches analyzed</span>
              </div>
            </div>
          </div>
        </div>

        <RatingBadge rating={avgRating} size="xl" showLabel />
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard
          icon={Target}
          label="K/D Ratio"
          value={
            stats.deaths > 0
              ? (stats.kills / stats.deaths).toFixed(2)
              : stats.kills?.toString() ?? "0"
          }
          color="text-green-500"
        />
        <StatCard
          icon={Flame}
          label="ADR"
          value={stats.adr?.toFixed(1) ?? "0"}
          color="text-orange-500"
        />
        <StatCard
          icon={Crosshair}
          label="HS%"
          value={`${stats.headshotPercentage?.toFixed(0) ?? 0}%`}
          color="text-blue-500"
        />
        <StatCard
          icon={Trophy}
          label="Clutches"
          value={stats.clutchesWon?.toString() ?? "0"}
          color="text-purple-500"
        />
        <StatCard
          icon={Skull}
          label="First Kills"
          value={stats.firstKills?.toString() ?? "0"}
          color="text-red-500"
        />
        <StatCard
          icon={trend >= 0 ? TrendingUp : TrendingDown}
          label="Trend"
          value={`${trend >= 0 ? "+" : ""}${(trend * 100).toFixed(1)}%`}
          color={trend >= 0 ? "text-green-500" : "text-red-500"}
        />
      </div>

      {/* Rating History & Recent Matches */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rating History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Rating History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ratingHistory?.history && ratingHistory.history.length > 0 && ratingHistory?.statistics ? (
              <RatingTrend
                history={ratingHistory.history}
                statistics={ratingHistory.statistics}
                height={200}
              />
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No rating history available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Matches */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Recent Matches
            </CardTitle>
          </CardHeader>
          <CardContent>
            {matches && Array.isArray(matches) && matches.length > 0 ? (
              <div className="space-y-2">
                {matches.slice(0, 8).map((match: any, idx: number) => (
                  <Link
                    key={idx}
                    href={`/demos/${match.demoId}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-1 h-8 rounded-full ${
                          match.won ? "bg-green-500" : "bg-red-500"
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <Map className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{match.mapName}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(match.playedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {match.kills}/{match.deaths}/{match.assists}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {match.adr?.toFixed(0)} ADR
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No matches found
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <PerformanceMetric
              label="Total Kills"
              value={stats.kills ?? 0}
              icon={Target}
            />
            <PerformanceMetric
              label="Total Deaths"
              value={stats.deaths ?? 0}
              icon={Skull}
            />
            <PerformanceMetric
              label="Total Assists"
              value={stats.assists ?? 0}
              icon={Shield}
            />
            <PerformanceMetric
              label="Matches Played"
              value={player.matchCount ?? 0}
              icon={Calendar}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function PerformanceMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: any;
}) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <p className="text-2xl font-bold">{value.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
