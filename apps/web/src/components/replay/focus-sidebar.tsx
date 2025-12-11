"use client";

/**
 * FocusSidebar - Sidebar for focus (recruteur) view mode
 *
 * Layout (wireframe reference - Layout D):
 * ┌──────────────────────────────┐
 * │ Counter-Terrorists           │
 * ├──────────────────────────────┤
 * │ ████████████████████████████ │ ← Highlighted player card
 * │ █  s1mple          AWP     █ │
 * │ █ ┌────┬────┬────┐         █ │
 * │ █ │ 23 │  8 │2.87│         █ │
 * │ █ │Kill│Dead│K/D │         █ │
 * │ █ ├────┼────┼────┤         █ │
 * │ █ │ 87%│142 │1.8 │         █ │
 * │ █ │HS% │ADR │Rat │         █ │
 * │ █ └────┴────┴────┘         █ │
 * │ ████████████████████████████ │
 * ├──────────────────────────────┤
 * │ [b1t       ] [AK-47]         │ ← Regular player card
 * │ [electroNic] [M4A1-S]        │
 * ├──────────────────────────────┤
 * │ Terrorists                   │
 * ├──────────────────────────────┤
 * │ [NiKo      ] [DEAD]          │ ← Dead player (strikethrough)
 * │ [m0NESY    ] [AWP ]          │
 * └──────────────────────────────┘
 *
 * Features:
 * - Player cards with detailed stats for focused player
 * - 3x2 stats grid: Kills, Deaths, K/D, HS%, ADR, Rating
 * - Team sections with alive/dead indicators
 * - Click to focus on a different player
 *
 * Width: 280px
 */

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Skull, Shield, Target, Crosshair } from "lucide-react";
import {
  useReplayStore,
  useCurrentFrame,
  type PlayerFrame,
  type ReplayEvent,
  isKillEvent,
} from "@/stores/replay-store";
import { CS2WeaponIcon } from "./cs2-weapon-icons";

interface PlayerStats {
  kills: number;
  deaths: number;
  assists: number;
  kd: number;
  headshots: number;
  hsPercent: number;
  adr: number;
  rating: number;
}

interface FocusSidebarProps {
  /** Additional class names */
  className?: string;
}

/**
 * Calculate player stats from events
 */
function calculatePlayerStats(
  steamId: string,
  events: ReplayEvent[],
  allPlayers: PlayerFrame[]
): PlayerStats {
  const kills = events.filter(
    (e) => isKillEvent(e) && e.attackerSteamId === steamId
  ).length;

  const deaths = events.filter(
    (e) => isKillEvent(e) && e.victimSteamId === steamId
  ).length;

  const headshots = events.filter(
    (e) => isKillEvent(e) && e.attackerSteamId === steamId && e.headshot
  ).length;

  const hsPercent = kills > 0 ? Math.round((headshots / kills) * 100) : 0;
  const kd = deaths > 0 ? kills / deaths : kills;

  // Simplified ADR calculation (would need damage data for accuracy)
  // Using kills * ~80 as rough estimate
  const adr = kills * 80;

  // Simplified rating (HLTV 2.0 style)
  // Real formula is complex - this is a rough approximation
  const rating = kills > 0 || deaths > 0
    ? Math.min(2.5, Math.max(0, (kills * 0.7 + 0.3 * (kills - deaths)) / Math.max(1, deaths * 0.7)))
    : 1.0;

  return {
    kills,
    deaths,
    assists: 0, // Would need assist data
    kd: Math.round(kd * 100) / 100,
    headshots,
    hsPercent,
    adr,
    rating: Math.round(rating * 100) / 100,
  };
}

/**
 * FocusedPlayerCard - Expanded card for focused player
 */
const FocusedPlayerCard = React.memo(function FocusedPlayerCard({
  player,
  stats,
  onFocus,
}: {
  player: PlayerFrame;
  stats: PlayerStats;
  onFocus: (steamId: string | null) => void;
}) {
  return (
    <div
      className={cn(
        "bg-accent rounded-lg p-3 cursor-pointer",
        "border-2 border-accent",
        "transition-all duration-200"
      )}
      onClick={() => onFocus(null)} // Click to unfocus
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-accent-foreground text-sm">
          {player.name || "Unknown"}
        </span>
        {player.activeWeapon && (
          <div className="flex items-center gap-1 bg-black/20 px-2 py-0.5 rounded">
            <CS2WeaponIcon weapon={player.activeWeapon} size={14} />
            <span className="text-[10px] text-accent-foreground/80">
              {player.activeWeapon.replace("weapon_", "").toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-1.5">
        <StatBox label="Kills" value={stats.kills} />
        <StatBox label="Deaths" value={stats.deaths} />
        <StatBox label="K/D" value={stats.kd.toFixed(2)} />
        <StatBox label="HS%" value={`${stats.hsPercent}%`} />
        <StatBox label="ADR" value={stats.adr} />
        <StatBox label="Rating" value={stats.rating.toFixed(2)} />
      </div>

      {/* Health/Armor bar if alive */}
      {player.isAlive && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1">
            <div className="h-1.5 bg-black/20 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  player.health > 50 ? "bg-green-500" : player.health > 25 ? "bg-yellow-500" : "bg-red-500"
                )}
                style={{ width: `${player.health}%` }}
              />
            </div>
          </div>
          <span className="text-[10px] text-accent-foreground/70">{player.health}HP</span>
          {player.armor > 0 && (
            <>
              <Shield className="h-3 w-3 text-accent-foreground/50" />
              <span className="text-[10px] text-accent-foreground/70">{player.armor}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
});

/**
 * StatBox - Single stat display
 */
const StatBox = React.memo(function StatBox({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-black/20 rounded p-1.5 text-center">
      <div className="text-sm font-bold text-accent-foreground">{value}</div>
      <div className="text-[9px] text-accent-foreground/60">{label}</div>
    </div>
  );
});

/**
 * CompactPlayerCard - Small card for non-focused players
 */
const CompactPlayerCard = React.memo(function CompactPlayerCard({
  player,
  stats,
  isFocused,
  onFocus,
}: {
  player: PlayerFrame;
  stats: PlayerStats;
  isFocused: boolean;
  onFocus: (steamId: string) => void;
}) {
  const teamColor = player.team === 3 ? "ct" : "t";

  return (
    <div
      className={cn(
        "flex items-center gap-2 p-2 rounded cursor-pointer",
        "border-l-3 transition-all duration-150",
        player.team === 3 ? "border-l-ct" : "border-l-t",
        player.isAlive ? "bg-secondary/50 hover:bg-secondary" : "bg-secondary/20 opacity-60",
        isFocused && "ring-2 ring-accent"
      )}
      onClick={() => onFocus(player.steamId)}
    >
      {/* Player name */}
      <span
        className={cn(
          "flex-1 text-xs font-medium truncate",
          !player.isAlive && "line-through text-muted-foreground"
        )}
      >
        {player.name || "Unknown"}
      </span>

      {/* Quick stats */}
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <span>{stats.kills}/{stats.deaths}</span>
      </div>

      {/* Weapon or death indicator */}
      {player.isAlive ? (
        player.activeWeapon && (
          <CS2WeaponIcon
            weapon={player.activeWeapon}
            size={14}
            className="text-muted-foreground"
          />
        )
      ) : (
        <span className="text-[10px] text-red-400 font-medium">DEAD</span>
      )}
    </div>
  );
});

/**
 * FocusSidebar - Main component
 */
export const FocusSidebar = React.memo(function FocusSidebar({
  className,
}: FocusSidebarProps) {
  const currentFrame = useCurrentFrame();
  const { events, focusedPlayerSteamId, focusPlayer } = useReplayStore();

  // Separate players by team
  const { ctPlayers, tPlayers } = useMemo(() => {
    if (!currentFrame) return { ctPlayers: [], tPlayers: [] };

    const ct = currentFrame.players
      .filter((p) => p.team === 3)
      .sort((a, b) => (b.isAlive ? 1 : 0) - (a.isAlive ? 1 : 0));
    const t = currentFrame.players
      .filter((p) => p.team === 2)
      .sort((a, b) => (b.isAlive ? 1 : 0) - (a.isAlive ? 1 : 0));

    return { ctPlayers: ct, tPlayers: t };
  }, [currentFrame]);

  // Calculate stats for all players
  const playerStats = useMemo(() => {
    if (!currentFrame) return new Map<string, PlayerStats>();

    const stats = new Map<string, PlayerStats>();
    currentFrame.players.forEach((player) => {
      stats.set(
        player.steamId,
        calculatePlayerStats(player.steamId, events, currentFrame.players)
      );
    });
    return stats;
  }, [currentFrame, events]);

  // Get focused player
  const focusedPlayer = useMemo(() => {
    if (!focusedPlayerSteamId || !currentFrame) return null;
    return currentFrame.players.find((p) => p.steamId === focusedPlayerSteamId) || null;
  }, [focusedPlayerSteamId, currentFrame]);

  // CT alive count
  const ctAlive = ctPlayers.filter((p) => p.isAlive).length;
  const tAlive = tPlayers.filter((p) => p.isAlive).length;

  if (!currentFrame) {
    return (
      <aside className={cn("w-[280px] bg-card border-r border-border p-3", className)}>
        <div className="text-center text-muted-foreground text-sm">
          Loading players...
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "w-[280px] bg-card border-r border-border",
        "flex flex-col overflow-hidden",
        "shrink-0",
        className
      )}
    >
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {/* CT Team */}
        <div>
          <div className="flex items-center justify-between px-2 py-1 mb-1">
            <span className="text-xs font-semibold text-ct">
              Counter-Terrorists
            </span>
            <span className="text-[10px] text-muted-foreground">
              {ctAlive}/{ctPlayers.length} alive
            </span>
          </div>

          <div className="space-y-1">
            {ctPlayers.map((player) => {
              const stats = playerStats.get(player.steamId);
              const isFocused = player.steamId === focusedPlayerSteamId;

              if (isFocused && focusedPlayer && stats) {
                return (
                  <FocusedPlayerCard
                    key={player.steamId}
                    player={focusedPlayer}
                    stats={stats}
                    onFocus={focusPlayer}
                  />
                );
              }

              return (
                <CompactPlayerCard
                  key={player.steamId}
                  player={player}
                  stats={stats || { kills: 0, deaths: 0, assists: 0, kd: 0, headshots: 0, hsPercent: 0, adr: 0, rating: 1 }}
                  isFocused={isFocused}
                  onFocus={focusPlayer}
                />
              );
            })}
          </div>
        </div>

        {/* T Team */}
        <div>
          <div className="flex items-center justify-between px-2 py-1 mb-1">
            <span className="text-xs font-semibold text-t">
              Terrorists
            </span>
            <span className="text-[10px] text-muted-foreground">
              {tAlive}/{tPlayers.length} alive
            </span>
          </div>

          <div className="space-y-1">
            {tPlayers.map((player) => {
              const stats = playerStats.get(player.steamId);
              const isFocused = player.steamId === focusedPlayerSteamId;

              if (isFocused && focusedPlayer && stats) {
                return (
                  <FocusedPlayerCard
                    key={player.steamId}
                    player={focusedPlayer}
                    stats={stats}
                    onFocus={focusPlayer}
                  />
                );
              }

              return (
                <CompactPlayerCard
                  key={player.steamId}
                  player={player}
                  stats={stats || { kills: 0, deaths: 0, assists: 0, kd: 0, headshots: 0, hsPercent: 0, adr: 0, rating: 1 }}
                  isFocused={isFocused}
                  onFocus={focusPlayer}
                />
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
});

export default FocusSidebar;
