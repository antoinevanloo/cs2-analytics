"use client";

/**
 * ReplayPlayerList - Sidebar showing player list with stats
 *
 * Features:
 * - Players grouped by team
 * - Live health/armor display
 * - Equipment indicators
 * - Click to focus player
 */

import React from "react";
import { Heart, Shield, Target, Bomb } from "lucide-react";
import {
  useReplayStore,
  useCurrentFrame,
  type PlayerFrame,
} from "@/stores/replay-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PlayerRowProps {
  player: PlayerFrame;
  isFocused: boolean;
  isHovered: boolean;
  onFocus: (steamId: string) => void;
  onHover: (steamId: string | null) => void;
}

const PlayerRow = React.memo(function PlayerRow({
  player,
  isFocused,
  isHovered,
  onFocus,
  onHover,
}: PlayerRowProps) {
  const isCT = player.team === 3;

  return (
    <div
      className={cn(
        "flex items-center gap-2 p-2 rounded cursor-pointer transition-colors",
        isFocused && "bg-primary/20 ring-1 ring-primary",
        isHovered && !isFocused && "bg-muted",
        !player.isAlive && "opacity-50"
      )}
      onClick={() => onFocus(isFocused ? "" : player.steamId)}
      onMouseEnter={() => onHover(player.steamId)}
      onMouseLeave={() => onHover(null)}
    >
      {/* Team indicator */}
      <div
        className={cn(
          "w-2 h-8 rounded-full",
          isCT ? "bg-blue-500" : "bg-orange-500",
          !player.isAlive && "bg-gray-500"
        )}
      />

      {/* Player info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className={cn("font-medium truncate", !player.isAlive && "line-through")}>
            {player.name || player.steamId.slice(-8)}
          </span>
          {player.hasBomb && (
            <Bomb className="h-3 w-3 text-red-500 flex-shrink-0" />
          )}
        </div>

        {/* Health and armor */}
        {player.isAlive && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Heart className="h-3 w-3 text-red-500" />
              <span>{player.health}</span>
            </div>
            <div className="flex items-center gap-1">
              <Shield className="h-3 w-3 text-blue-500" />
              <span>{player.armor}</span>
            </div>
            {player.hasDefuseKit && isCT && (
              <span className="text-green-500 font-medium">Kit</span>
            )}
          </div>
        )}

        {/* Weapon */}
        {player.isAlive && player.activeWeapon && (
          <div className="text-xs text-muted-foreground truncate">
            {player.activeWeapon.replace("weapon_", "")}
          </div>
        )}
      </div>

      {/* Money */}
      <div className="text-sm text-muted-foreground font-mono">
        ${player.money}
      </div>
    </div>
  );
});

export function ReplayPlayerList() {
  const currentFrame = useCurrentFrame();
  const { focusedPlayerSteamId, hoveredPlayerSteamId, focusPlayer, hoverPlayer } =
    useReplayStore();

  if (!currentFrame) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Players</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No player data available
        </CardContent>
      </Card>
    );
  }

  // Group players by team
  const ctPlayers = currentFrame.players.filter((p) => p.team === 3);
  const tPlayers = currentFrame.players.filter((p) => p.team === 2);

  // Sort by alive status, then by name
  const sortPlayers = (players: PlayerFrame[]) =>
    [...players].sort((a, b) => {
      if (a.isAlive !== b.isAlive) return a.isAlive ? -1 : 1;
      return (a.name || "").localeCompare(b.name || "");
    });

  const sortedCT = sortPlayers(ctPlayers);
  const sortedT = sortPlayers(tPlayers);

  // Count alive players
  const ctAlive = ctPlayers.filter((p) => p.isAlive).length;
  const tAlive = tPlayers.filter((p) => p.isAlive).length;

  return (
    <div className="space-y-4">
      {/* CT Team */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="text-blue-500">Counter-Terrorists</span>
            <span className="text-xs text-muted-foreground">
              {ctAlive}/{ctPlayers.length} alive
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {sortedCT.map((player) => (
            <PlayerRow
              key={player.steamId}
              player={player}
              isFocused={focusedPlayerSteamId === player.steamId}
              isHovered={hoveredPlayerSteamId === player.steamId}
              onFocus={focusPlayer}
              onHover={hoverPlayer}
            />
          ))}
        </CardContent>
      </Card>

      {/* T Team */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="text-orange-500">Terrorists</span>
            <span className="text-xs text-muted-foreground">
              {tAlive}/{tPlayers.length} alive
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {sortedT.map((player) => (
            <PlayerRow
              key={player.steamId}
              player={player}
              isFocused={focusedPlayerSteamId === player.steamId}
              isHovered={hoveredPlayerSteamId === player.steamId}
              onFocus={focusPlayer}
              onHover={hoverPlayer}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default ReplayPlayerList;
