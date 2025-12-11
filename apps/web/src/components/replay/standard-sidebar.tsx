"use client";

/**
 * StandardSidebar - Sidebar for standard (coach) view mode
 *
 * Layout (wireframe reference - Layout B):
 * ┌─────────────┐
 * │ CT Team     │ ← Header with score
 * │ ▓▓▓▓▓▓▓▓▓▓▓ │ ← Player card
 * │ ▓▓▓▓▓▓▓▓▓▓▓ │
 * │ ▓▓▓▓▓▓▓▓▓▓▓ │
 * │ ▓▓▓▓▓▓▓▓▓▓▓ │
 * │ ▓▓▓▓▓▓▓▓▓▓▓ │
 * ├─────────────┤
 * │ T Team      │
 * │ ▓▓▓▓▓▓▓▓▓▓▓ │
 * │ ▓▓▓▓▓▓▓▓▓▓▓ │
 * │ ▓▓▓▓▓▓▓▓▓▓▓ │
 * │ ▓▓▓▓▓▓▓▓▓▓▓ │
 * │ ▓▓▓▓▓▓▓▓▓▓▓ │
 * └─────────────┘
 *
 * Features:
 * - Fixed 220px width
 * - Full player cards (not compact like floating roster)
 * - Collapsible team sections
 * - Shows all stats (health, armor, money, equipment, weapons)
 * - Scrollable if needed
 *
 * Coach-specific:
 * - All players always visible
 * - Extended information display
 * - Team totals (money, utility)
 */

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Users, DollarSign, Package } from "lucide-react";
import { PlayerCard } from "./player-card";
import {
  useReplayStore,
  useCurrentFrame,
  type PlayerFrame,
} from "@/stores/replay-store";

interface TeamSectionProps {
  teamName: string;
  teamColor: "ct" | "t";
  players: PlayerFrame[];
  score?: number;
  focusedPlayerSteamId: string | null;
  hoveredPlayerSteamId: string | null;
  onFocusPlayer: (steamId: string) => void;
  onHoverPlayer: (steamId: string | null) => void;
}

/**
 * TeamSection - Team roster section with stats summary
 */
const TeamSection = React.memo(function TeamSection({
  teamName,
  teamColor,
  players,
  score,
  focusedPlayerSteamId,
  hoveredPlayerSteamId,
  onFocusPlayer,
  onHoverPlayer,
}: TeamSectionProps) {
  const alivePlayers = players.filter((p) => p.isAlive);
  const totalMoney = players.reduce((sum, p) => sum + (p.money || 0), 0);

  // Count utility (grenades)
  const totalUtility = players.reduce((sum, p) => {
    if (!p.isAlive || !p.inventory) return sum;
    return sum + p.inventory.filter((w) =>
      w.includes("grenade") ||
      w.includes("flash") ||
      w.includes("smoke") ||
      w.includes("molotov") ||
      w.includes("incgrenade") ||
      w.includes("decoy")
    ).length;
  }, 0);

  const isCT = teamColor === "ct";
  const colorClasses = isCT
    ? {
        border: "border-ct/30",
        headerBg: "bg-ct/10",
        text: "text-ct",
        accent: "bg-ct",
      }
    : {
        border: "border-t/30",
        headerBg: "bg-t/10",
        text: "text-t",
        accent: "bg-t",
      };

  return (
    <div className={cn("border-b", colorClasses.border)}>
      {/* Team header */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2",
          colorClasses.headerBg
        )}
      >
        <div className="flex items-center gap-2">
          {/* Team color indicator */}
          <div className={cn("w-1 h-5 rounded-full", colorClasses.accent)} />

          {/* Team name */}
          <span className={cn("font-semibold text-sm truncate max-w-[100px]", colorClasses.text)}>
            {teamName}
          </span>

          {/* Score */}
          {score !== undefined && (
            <span className={cn("text-lg font-bold tabular-nums", colorClasses.text)}>
              {score}
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {/* Alive count */}
          <div className="flex items-center gap-0.5" title="Alive players">
            <Users className="w-3 h-3" />
            <span>{alivePlayers.length}/{players.length}</span>
          </div>

          {/* Team money */}
          <div className="flex items-center gap-0.5" title="Team money">
            <DollarSign className="w-3 h-3" />
            <span className="font-mono">{(totalMoney / 1000).toFixed(1)}k</span>
          </div>

          {/* Utility count */}
          <div className="flex items-center gap-0.5" title="Total utility">
            <Package className="w-3 h-3" />
            <span>{totalUtility}</span>
          </div>
        </div>
      </div>

      {/* Player cards */}
      <div className="p-2 space-y-1.5">
        {players.map((player) => (
          <PlayerCard
            key={player.steamId}
            player={player}
            isFocused={focusedPlayerSteamId === player.steamId}
            isHovered={hoveredPlayerSteamId === player.steamId}
            onFocus={onFocusPlayer}
            onHover={onHoverPlayer}
            compact={false}
          />
        ))}
      </div>
    </div>
  );
});

interface StandardSidebarProps {
  /** Additional class names */
  className?: string;
}

/**
 * StandardSidebar - Main component
 */
export const StandardSidebar = React.memo(function StandardSidebar({
  className,
}: StandardSidebarProps) {
  const currentFrame = useCurrentFrame();
  const {
    roundMetadata,
    focusedPlayerSteamId,
    hoveredPlayerSteamId,
    focusPlayer,
    hoverPlayer,
  } = useReplayStore();

  // Sort players: alive first, then by name
  const sortPlayers = (players: PlayerFrame[]) =>
    [...players].sort((a, b) => {
      if (a.isAlive !== b.isAlive) return a.isAlive ? -1 : 1;
      return (a.name || "").localeCompare(b.name || "");
    });

  // Memoize player lists
  const { ctPlayers, tPlayers } = useMemo(() => {
    if (!currentFrame) {
      return { ctPlayers: [], tPlayers: [] };
    }

    const ct = currentFrame.players.filter((p) => p.team === 3);
    const t = currentFrame.players.filter((p) => p.team === 2);

    return {
      ctPlayers: sortPlayers(ct),
      tPlayers: sortPlayers(t),
    };
  }, [currentFrame]);

  // Get team names and scores from metadata
  const ctTeamName = roundMetadata?.ctTeam?.name || "CT";
  const tTeamName = roundMetadata?.tTeam?.name || "T";
  const ctScore = roundMetadata?.ctTeam?.score;
  const tScore = roundMetadata?.tTeam?.score;

  // Loading state
  if (!currentFrame) {
    return (
      <aside className={cn("w-[220px] bg-card border-r border-border", className)}>
        <div className="p-2 space-y-2">
          <div className="h-40 bg-muted/30 animate-pulse rounded" />
          <div className="h-40 bg-muted/30 animate-pulse rounded" />
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "w-[220px] bg-card border-r border-border flex flex-col",
        "shrink-0",
        className
      )}
    >
      <div className="flex-1 overflow-y-auto">
        {/* CT Team */}
        <TeamSection
          teamName={ctTeamName}
          teamColor="ct"
          players={ctPlayers}
          score={ctScore}
          focusedPlayerSteamId={focusedPlayerSteamId}
          hoveredPlayerSteamId={hoveredPlayerSteamId}
          onFocusPlayer={focusPlayer}
          onHoverPlayer={hoverPlayer}
        />

        {/* T Team */}
        <TeamSection
          teamName={tTeamName}
          teamColor="t"
          players={tPlayers}
          score={tScore}
          focusedPlayerSteamId={focusedPlayerSteamId}
          hoveredPlayerSteamId={hoveredPlayerSteamId}
          onFocusPlayer={focusPlayer}
          onHoverPlayer={hoverPlayer}
        />
      </div>
    </aside>
  );
});

export default StandardSidebar;
