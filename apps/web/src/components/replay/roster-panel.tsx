"use client";

/**
 * RosterPanel - Enhanced team roster sidebar for 2D replay
 *
 * Features:
 * - Two team sections with distinct colors (CT blue, T orange)
 * - Team score display in header
 * - Alive/dead player count
 * - Interactive player cards with full stats
 * - Sorted by alive status then name
 * - Collapsible on mobile
 *
 * Design checklist:
 * - Extensible: New player stats can be added to PlayerCard
 * - Scalable: Memoized components prevent re-renders
 * - Exhaustive: Shows all player info (health, armor, weapon, money, equipment)
 * - Performance: React.memo + proper key usage
 * - Gamification: Visual feedback on kills, equipment highlights
 */

import React, { useMemo } from "react";
import { ChevronDown, ChevronUp, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlayerCard } from "./player-card";
import {
  useReplayStore,
  useCurrentFrame,
  type PlayerFrame,
} from "@/stores/replay-store";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface TeamSectionProps {
  teamName: string;
  teamColor: "ct" | "t";
  players: PlayerFrame[];
  score?: number;
  focusedPlayerSteamId: string | null;
  hoveredPlayerSteamId: string | null;
  onFocusPlayer: (steamId: string) => void;
  onHoverPlayer: (steamId: string | null) => void;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const TeamSection = React.memo(function TeamSection({
  teamName,
  teamColor,
  players,
  score,
  focusedPlayerSteamId,
  hoveredPlayerSteamId,
  onFocusPlayer,
  onHoverPlayer,
  isOpen = true,
  onOpenChange,
}: TeamSectionProps) {
  const alivePlayers = players.filter((p) => p.isAlive);
  const totalMoney = players.reduce((sum, p) => sum + (p.money || 0), 0);

  const isCT = teamColor === "ct";
  const colorClasses = isCT
    ? {
        border: "border-blue-500/30",
        bg: "bg-blue-500/5",
        headerBg: "bg-blue-500/10",
        text: "text-blue-400",
        accent: "text-blue-500",
      }
    : {
        border: "border-orange-500/30",
        bg: "bg-orange-500/5",
        headerBg: "bg-orange-500/10",
        text: "text-orange-400",
        accent: "text-orange-500",
      };

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <div
        className={cn(
          "rounded-lg border overflow-hidden",
          colorClasses.border,
          colorClasses.bg
        )}
      >
        {/* Team header */}
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              "w-full flex items-center justify-between px-3 py-2",
              colorClasses.headerBg,
              "hover:bg-opacity-80 transition-colors cursor-pointer"
            )}
          >
            <div className="flex items-center gap-2">
              {/* Team indicator */}
              <div
                className={cn(
                  "w-1 h-6 rounded-full",
                  isCT ? "bg-blue-500" : "bg-orange-500"
                )}
              />

              {/* Team name + score */}
              <div className="flex items-center gap-2">
                <span className={cn("font-semibold text-sm", colorClasses.text)}>
                  {teamName}
                </span>
                {score !== undefined && (
                  <span
                    className={cn(
                      "text-lg font-bold tabular-nums",
                      colorClasses.accent
                    )}
                  >
                    {score}
                  </span>
                )}
              </div>
            </div>

            {/* Stats + collapse icon */}
            <div className="flex items-center gap-3">
              {/* Alive count */}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="w-3 h-3" />
                <span>
                  {alivePlayers.length}/{players.length}
                </span>
              </div>

              {/* Team money */}
              <span className="text-xs font-mono text-muted-foreground">
                ${(totalMoney / 1000).toFixed(1)}k
              </span>

              {/* Collapse indicator */}
              {isOpen ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        {/* Player list */}
        <CollapsibleContent>
          <div className="p-2 space-y-1.5">
            {players.map((player) => (
              <PlayerCard
                key={player.steamId}
                player={player}
                isFocused={focusedPlayerSteamId === player.steamId}
                isHovered={hoveredPlayerSteamId === player.steamId}
                onFocus={onFocusPlayer}
                onHover={onHoverPlayer}
              />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
});

interface RosterPanelProps {
  className?: string;
  compact?: boolean;
}

export function RosterPanel({ className, compact = false }: RosterPanelProps) {
  const [ctOpen, setCtOpen] = React.useState(true);
  const [tOpen, setTOpen] = React.useState(true);

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

  // Loading state
  if (!currentFrame) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="h-48 bg-muted/30 animate-pulse rounded-lg" />
        <div className="h-48 bg-muted/30 animate-pulse rounded-lg" />
      </div>
    );
  }

  // Get team names and scores from metadata
  const ctTeamName = roundMetadata?.ctTeam?.name || "Counter-Terrorists";
  const tTeamName = roundMetadata?.tTeam?.name || "Terrorists";
  const ctScore = roundMetadata?.ctTeam?.score;
  const tScore = roundMetadata?.tTeam?.score;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
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
        isOpen={ctOpen}
        onOpenChange={setCtOpen}
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
        isOpen={tOpen}
        onOpenChange={setTOpen}
      />
    </div>
  );
}

export default RosterPanel;
