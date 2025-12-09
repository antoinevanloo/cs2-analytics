"use client";

/**
 * RoundHeader - Match score header with team names and round timer
 *
 * Features:
 * - Team names with colors
 * - Current score display
 * - Round timer (MM:SS format)
 * - Round number indicator
 * - Bomb status indicator
 * - Half indicator (1st/2nd)
 *
 * Design:
 * - Matches CS2 HUD aesthetic
 * - Responsive: stacks on mobile
 * - Clear visual hierarchy
 */

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Clock, Bomb as BombIcon } from "lucide-react";
import {
  useReplayStore,
  useCurrentFrame,
} from "@/stores/replay-store";

interface TeamScoreProps {
  name: string;
  score: number;
  side: "ct" | "t";
  isWinner?: boolean;
  alivePlayers?: number;
  totalPlayers?: number;
}

const TeamScore = React.memo(function TeamScore({
  name,
  score,
  side,
  isWinner,
  alivePlayers,
  totalPlayers,
}: TeamScoreProps) {
  const isCT = side === "ct";

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2 rounded-lg",
        "transition-all duration-300",
        isCT ? "bg-blue-500/10 border border-blue-500/30" : "bg-orange-500/10 border border-orange-500/30",
        isWinner && (isCT ? "ring-2 ring-blue-500/50" : "ring-2 ring-orange-500/50")
      )}
    >
      {/* Team color bar */}
      <div
        className={cn(
          "w-1 h-10 rounded-full",
          isCT ? "bg-blue-500" : "bg-orange-500"
        )}
      />

      {/* Team info */}
      <div className={cn("flex flex-col", isCT ? "items-start" : "items-end")}>
        <span
          className={cn(
            "text-sm font-medium truncate max-w-[120px]",
            isCT ? "text-blue-400" : "text-orange-400"
          )}
        >
          {name}
        </span>

        {/* Alive indicator */}
        {alivePlayers !== undefined && totalPlayers !== undefined && (
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPlayers }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  i < alivePlayers
                    ? isCT
                      ? "bg-blue-500"
                      : "bg-orange-500"
                    : "bg-muted"
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Score */}
      <span
        className={cn(
          "text-3xl font-bold tabular-nums",
          isCT ? "text-blue-400" : "text-orange-400"
        )}
      >
        {score}
      </span>
    </div>
  );
});

interface RoundHeaderProps {
  className?: string;
}

export function RoundHeader({ className }: RoundHeaderProps) {
  const currentFrame = useCurrentFrame();
  const {
    roundMetadata,
    currentTick,
    tickRate,
    events,
  } = useReplayStore();

  // Calculate round time
  const roundTime = useMemo(() => {
    if (!roundMetadata) return "0:00";

    const startTick = roundMetadata.startTick;
    const elapsed = (currentTick - startTick) / tickRate;
    const minutes = Math.floor(elapsed / 60);
    const seconds = Math.floor(elapsed % 60);

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, [roundMetadata, currentTick, tickRate]);

  // Check bomb status
  const bombStatus = useMemo(() => {
    if (!events) return null;

    const bombEvents = events
      .filter((e) => e.type.startsWith("BOMB") && e.tick <= currentTick)
      .sort((a, b) => b.tick - a.tick);

    if (bombEvents.length === 0) return null;

    const latestBomb = bombEvents[0];
    if (latestBomb.type === "BOMB_PLANT") {
      // Check if bomb was defused or exploded after plant
      const afterPlant = events.find(
        (e) =>
          (e.type === "BOMB_DEFUSE" || e.type === "BOMB_EXPLODE") &&
          e.tick > latestBomb.tick &&
          e.tick <= currentTick
      );
      if (!afterPlant) return "planted";
    }
    if (latestBomb.type === "BOMB_DEFUSE") return "defused";
    if (latestBomb.type === "BOMB_EXPLODE") return "exploded";

    return null;
  }, [events, currentTick]);

  // Get alive counts
  const { ctAlive, tAlive, ctTotal, tTotal } = useMemo(() => {
    if (!currentFrame) {
      return { ctAlive: 0, tAlive: 0, ctTotal: 5, tTotal: 5 };
    }

    const ct = currentFrame.players.filter((p) => p.team === 3);
    const t = currentFrame.players.filter((p) => p.team === 2);

    return {
      ctAlive: ct.filter((p) => p.isAlive).length,
      tAlive: t.filter((p) => p.isAlive).length,
      ctTotal: ct.length,
      tTotal: t.length,
    };
  }, [currentFrame]);

  // Determine winner
  const isCtWinner = roundMetadata?.winnerTeam === 3;
  const isTWinner = roundMetadata?.winnerTeam === 2;

  // Team names
  const ctName = roundMetadata?.ctTeam?.name || "Counter-Terrorists";
  const tName = roundMetadata?.tTeam?.name || "Terrorists";
  const ctScore = roundMetadata?.ctTeam?.score ?? 0;
  const tScore = roundMetadata?.tTeam?.score ?? 0;

  // Determine half
  const roundNumber = roundMetadata?.roundNumber ?? 1;
  const half = roundNumber <= 12 ? 1 : 2;

  return (
    <div className={cn("flex items-center justify-center gap-4", className)}>
      {/* CT Team */}
      <TeamScore
        name={ctName}
        score={ctScore}
        side="ct"
        isWinner={isCtWinner}
        alivePlayers={ctAlive}
        totalPlayers={ctTotal}
      />

      {/* Center section: Timer + Round */}
      <div className="flex flex-col items-center gap-1 px-4">
        {/* Round timer */}
        <div
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg",
            "bg-background/80 border border-border",
            bombStatus === "planted" && "bg-red-500/20 border-red-500/50 animate-pulse"
          )}
        >
          {bombStatus === "planted" ? (
            <BombIcon className="w-4 h-4 text-red-500" />
          ) : (
            <Clock className="w-4 h-4 text-muted-foreground" />
          )}
          <span
            className={cn(
              "text-2xl font-bold tabular-nums font-mono",
              bombStatus === "planted" ? "text-red-500" : "text-foreground"
            )}
          >
            {roundTime}
          </span>
        </div>

        {/* Round info */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Round {roundNumber}</span>
          <span className="text-muted-foreground/50">•</span>
          <span>{half === 1 ? "1st Half" : "2nd Half"}</span>

          {/* Bomb status badge */}
          {bombStatus && (
            <>
              <span className="text-muted-foreground/50">•</span>
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-medium uppercase",
                  bombStatus === "planted"
                    ? "bg-red-500/20 text-red-400"
                    : bombStatus === "defused"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-orange-500/20 text-orange-400"
                )}
              >
                {bombStatus}
              </span>
            </>
          )}
        </div>
      </div>

      {/* T Team */}
      <TeamScore
        name={tName}
        score={tScore}
        side="t"
        isWinner={isTWinner}
        alivePlayers={tAlive}
        totalPlayers={tTotal}
      />
    </div>
  );
}

export default RoundHeader;
