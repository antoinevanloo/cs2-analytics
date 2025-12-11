"use client";

/**
 * FloatingRoster - Floating overlay roster for compact view mode
 *
 * Layout (wireframe reference):
 * ┌──────────────┐
 * │ CT (3 alive) │
 * │ ▓▓▓▓▓▓▓▓     │  ← Mini player rows (24px)
 * │ ▓▓▓▓▓▓▓▓     │
 * │              │
 * │ T (2 alive)  │
 * │ ▓▓▓▓▓▓▓▓     │
 * └──────────────┘
 *
 * Features:
 * - Semi-transparent background (opacity: 0.9)
 * - Compact player rows (24px height)
 * - Dead players grayed out (opacity: 0.4)
 * - Click to focus player on canvas
 * - Hover highlight
 *
 * Extensibility: Configurable width, opacity, position
 * Performance: React.memo, minimal re-renders
 * Mobile: Collapses to icon on small screens
 */

import React, { useMemo, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Users } from "lucide-react";
import { useReplayStore, useCurrentFrame, type PlayerFrame } from "@/stores/replay-store";

interface MiniPlayerRowProps {
  player: PlayerFrame;
  isFocused: boolean;
  isHovered: boolean;
  onFocus: (steamId: string) => void;
  onHover: (steamId: string | null) => void;
}

/**
 * MiniPlayerRow - Ultra-compact player display (24px height)
 */
const MiniPlayerRow = React.memo(function MiniPlayerRow({
  player,
  isFocused,
  isHovered,
  onFocus,
  onHover,
}: MiniPlayerRowProps) {
  const isCT = player.team === 3;
  const isDead = !player.isAlive;

  // Calculate HP bar width
  const hpPercent = Math.max(0, Math.min(100, player.health));

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-1.5 h-6 rounded cursor-pointer transition-all",
        "hover:bg-white/10",
        isDead && "opacity-40",
        isFocused && "ring-1 ring-white/50 bg-white/10",
        isHovered && !isFocused && "bg-white/5"
      )}
      onClick={() => onFocus(player.steamId)}
      onMouseEnter={() => onHover(player.steamId)}
      onMouseLeave={() => onHover(null)}
    >
      {/* HP bar mini */}
      <div className="w-8 h-1.5 bg-background/50 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full transition-all",
            hpPercent > 50 ? "bg-green-500" : hpPercent > 25 ? "bg-yellow-500" : "bg-red-500"
          )}
          style={{ width: `${hpPercent}%` }}
        />
      </div>

      {/* Player name */}
      <span className={cn(
        "flex-1 text-[10px] font-medium truncate",
        isDead && "line-through"
      )}>
        {player.name || player.steamId.slice(-6)}
      </span>

      {/* Weapon icon (simplified as text) */}
      {player.activeWeapon && !isDead && (
        <span className="text-[9px] text-muted-foreground truncate max-w-[40px]">
          {player.activeWeapon
            .replace("weapon_", "")
            .replace("_silencer", "-s")
            .toUpperCase()
            .slice(0, 6)}
        </span>
      )}

      {/* Dead indicator */}
      {isDead && (
        <span className="text-[9px] text-red-500">✕</span>
      )}
    </div>
  );
});

interface FloatingTeamSectionProps {
  teamLabel: string;
  teamColor: "ct" | "t";
  players: PlayerFrame[];
  alivePlayers: number;
  focusedPlayerSteamId: string | null;
  hoveredPlayerSteamId: string | null;
  onFocusPlayer: (steamId: string) => void;
  onHoverPlayer: (steamId: string | null) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

/**
 * FloatingTeamSection - Team header + player list
 */
const FloatingTeamSection = React.memo(function FloatingTeamSection({
  teamLabel,
  teamColor,
  players,
  alivePlayers,
  focusedPlayerSteamId,
  hoveredPlayerSteamId,
  onFocusPlayer,
  onHoverPlayer,
  isCollapsed,
  onToggleCollapse,
}: FloatingTeamSectionProps) {
  const isCT = teamColor === "ct";

  return (
    <div className="space-y-0.5">
      {/* Team header */}
      <button
        className={cn(
          "w-full flex items-center justify-between text-[11px] font-medium py-0.5 px-1 rounded",
          "hover:bg-white/5 transition-colors",
          isCT ? "text-ct" : "text-t"
        )}
        onClick={onToggleCollapse}
      >
        <span>{teamLabel}</span>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">
            ({alivePlayers} alive)
          </span>
          {isCollapsed ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronUp className="w-3 h-3" />
          )}
        </div>
      </button>

      {/* Player list */}
      {!isCollapsed && (
        <div className="space-y-0.5">
          {players.map((player) => (
            <MiniPlayerRow
              key={player.steamId}
              player={player}
              isFocused={focusedPlayerSteamId === player.steamId}
              isHovered={hoveredPlayerSteamId === player.steamId}
              onFocus={onFocusPlayer}
              onHover={onHoverPlayer}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export interface FloatingRosterProps {
  /** Additional class names */
  className?: string;
  /** Width of the roster panel */
  width?: number;
  /** Opacity of the background (0-1) */
  opacity?: number;
  /** Whether to show on mobile */
  showOnMobile?: boolean;
}

/**
 * FloatingRoster - Main component
 */
export const FloatingRoster = React.memo(function FloatingRoster({
  className,
  width = 200,
  opacity = 0.9,
  showOnMobile = false,
}: FloatingRosterProps) {
  const [ctCollapsed, setCtCollapsed] = useState(false);
  const [tCollapsed, setTCollapsed] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const currentFrame = useCurrentFrame();
  const {
    roundMetadata,
    focusedPlayerSteamId,
    hoveredPlayerSteamId,
    focusPlayer,
    hoverPlayer,
  } = useReplayStore();

  // Sort players: alive first, then by name
  const sortPlayers = useCallback((players: PlayerFrame[]) =>
    [...players].sort((a, b) => {
      if (a.isAlive !== b.isAlive) return a.isAlive ? -1 : 1;
      return (a.name || "").localeCompare(b.name || "");
    }), []);

  // Memoize player lists and counts
  const { ctPlayers, tPlayers, ctAlive, tAlive } = useMemo(() => {
    if (!currentFrame) {
      return { ctPlayers: [], tPlayers: [], ctAlive: 0, tAlive: 0 };
    }

    const ct = currentFrame.players.filter((p) => p.team === 3);
    const t = currentFrame.players.filter((p) => p.team === 2);

    return {
      ctPlayers: sortPlayers(ct),
      tPlayers: sortPlayers(t),
      ctAlive: ct.filter((p) => p.isAlive).length,
      tAlive: t.filter((p) => p.isAlive).length,
    };
  }, [currentFrame, sortPlayers]);

  // Team names
  const ctTeamName = roundMetadata?.ctTeam?.name || "CT";
  const tTeamName = roundMetadata?.tTeam?.name || "T";

  // Loading/no data state
  if (!currentFrame) {
    return null;
  }

  // Minimized state - just show icon
  if (isMinimized) {
    return (
      <button
        className={cn(
          "absolute top-2 left-2 p-2 rounded-lg",
          "bg-card/90 border border-border",
          "hover:bg-card transition-colors",
          !showOnMobile && "hidden sm:block",
          className
        )}
        onClick={() => setIsMinimized(false)}
        style={{ opacity }}
      >
        <Users className="w-4 h-4" />
        <span className="sr-only">Show roster</span>
      </button>
    );
  }

  return (
    <div
      className={cn(
        "absolute top-2 left-2 rounded-lg p-2",
        "bg-card/90 border border-border backdrop-blur-sm",
        "shadow-lg",
        !showOnMobile && "hidden sm:block",
        className
      )}
      style={{ width, opacity }}
    >
      {/* Minimize button */}
      <button
        className="absolute top-1 right-1 p-0.5 rounded hover:bg-white/10 transition-colors"
        onClick={() => setIsMinimized(true)}
      >
        <ChevronUp className="w-3 h-3" />
        <span className="sr-only">Minimize roster</span>
      </button>

      <div className="space-y-2 pt-1">
        {/* CT Team */}
        <FloatingTeamSection
          teamLabel={ctTeamName}
          teamColor="ct"
          players={ctPlayers}
          alivePlayers={ctAlive}
          focusedPlayerSteamId={focusedPlayerSteamId}
          hoveredPlayerSteamId={hoveredPlayerSteamId}
          onFocusPlayer={focusPlayer}
          onHoverPlayer={hoverPlayer}
          isCollapsed={ctCollapsed}
          onToggleCollapse={() => setCtCollapsed(!ctCollapsed)}
        />

        {/* Separator */}
        <div className="h-px bg-border" />

        {/* T Team */}
        <FloatingTeamSection
          teamLabel={tTeamName}
          teamColor="t"
          players={tPlayers}
          alivePlayers={tAlive}
          focusedPlayerSteamId={focusedPlayerSteamId}
          hoveredPlayerSteamId={hoveredPlayerSteamId}
          onFocusPlayer={focusPlayer}
          onHoverPlayer={hoverPlayer}
          isCollapsed={tCollapsed}
          onToggleCollapse={() => setTCollapsed(!tCollapsed)}
        />
      </div>
    </div>
  );
});

export default FloatingRoster;
