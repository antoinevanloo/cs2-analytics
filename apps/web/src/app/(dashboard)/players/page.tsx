"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { playersApi, PlayerSearchItem } from "@/lib/api";
import { formatKD, formatADR, formatHSP, getTeamColor } from "@/lib/utils";
import { Search, Users, TrendingUp, Target, Crosshair } from "lucide-react";
import Link from "next/link";

export default function PlayersPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["players", searchQuery],
    queryFn: () => playersApi.search({ name: searchQuery || undefined }),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Players</h1>
          <p className="text-muted-foreground">
            View player statistics and performance
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-muted rounded-md px-3 py-2 max-w-md">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search players by name or Steam ID..."
          className="bg-transparent border-none outline-none text-sm flex-1"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          title="Total Players"
          value={data?.total || 0}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          title="Active This Week"
          value={0}
        />
        <StatCard
          icon={<Target className="h-5 w-5" />}
          title="Avg. Rating"
          value="1.05"
        />
        <StatCard
          icon={<Crosshair className="h-5 w-5" />}
          title="Avg. HS%"
          value="48.2%"
        />
      </div>

      {/* Player List */}
      <Card>
        <CardHeader>
          <CardTitle>All Players</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-16 bg-muted animate-pulse rounded-md"
                />
              ))}
            </div>
          ) : data?.players?.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No players found</h3>
              <p className="text-muted-foreground">
                Upload demos to populate player data
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Player</th>
                    <th className="text-right py-3 px-4">Matches</th>
                    <th className="text-right py-3 px-4">K/D</th>
                    <th className="text-right py-3 px-4">ADR</th>
                    <th className="text-right py-3 px-4">HS%</th>
                    <th className="text-right py-3 px-4">Rating</th>
                    <th className="text-right py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {data?.players?.map((player: PlayerSearchItem) => (
                    <tr
                      key={player.steamId}
                      className="border-b hover:bg-muted/50"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                            <Users className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{player.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {player.steamId}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="text-right py-3 px-4">
                        {player.totalMatches || 0}
                      </td>
                      <td className="text-right py-3 px-4">
                        {formatKD(
                          player.totalKills || 0,
                          player.totalDeaths || 0,
                        )}
                      </td>
                      <td className="text-right py-3 px-4">
                        {formatADR(
                          player.totalDamage || 0,
                          player.totalRounds || 1,
                        )}
                      </td>
                      <td className="text-right py-3 px-4">
                        {formatHSP(
                          player.totalHsKills || 0,
                          player.totalKills || 1,
                        )}
                      </td>
                      <td className="text-right py-3 px-4">
                        <span className="font-medium">
                          {player.rating?.toFixed(2) || "-"}
                        </span>
                      </td>
                      <td className="text-right py-3 px-4">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/players/${player.steamId}`}>View</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-md text-primary">
            {icon}
          </div>
          <div>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-sm text-muted-foreground">{title}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
