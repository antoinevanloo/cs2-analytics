"use client";

/**
 * KillFeed - Real-time kill notification overlay
 *
 * Features:
 * - Shows recent kills in CS2 style
 * - Animated entry/exit
 * - Weapon icons with headshot indicator
 * - Team color coding
 * - Auto-dismiss after configurable duration
 * - Configurable position (top-right like CS2)
 *
 * Design:
 * - Matches CS2 in-game killfeed aesthetic
 * - Gamification: immediate visual feedback on kills
 * - Performance: only renders active kills
 */

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { CS2WeaponIcon } from "./cs2-weapon-icons";
import { useReplayStore, isKillEvent, type ReplayEvent, type KillEvent } from "@/stores/replay-store";

interface KillFeedEntryProps {
  kill: KillEvent;
  isNew: boolean;
}

const KillFeedEntry = React.memo(function KillFeedEntry({
  kill,
  isNew,
}: KillFeedEntryProps) {
  // Use typed properties directly from KillEvent
  const attackerName = kill.attackerName || "Unknown";
  const victimName = kill.victimName || "Unknown";
  const weapon = (kill.weapon || "knife").replace("weapon_", "");
  const headshot = kill.headshot;
  const wallbang = kill.wallbang;
  const noscope = kill.noscope;
  const thrusmoke = kill.thrusmoke;

  // Team detection: CT = 3, T = 2 (not available directly, use name-based fallback for now)
  // TODO: Add attackerTeam/victimTeam to KillEvent type when available from API
  const attackerColor = "text-white";
  const victimColor = "text-red-400";

  // Special kill badges
  const badges: string[] = [];
  if (headshot) badges.push("HS");
  if (wallbang) badges.push("WB");
  if (noscope) badges.push("NS");
  if (thrusmoke) badges.push("TS");
  // Note: attackerBlind not currently in KillEvent type from API

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-md",
        "bg-black/70 backdrop-blur-sm border border-white/10",
        "transition-all duration-300",
        isNew ? "animate-in slide-in-from-right-5 fade-in" : "opacity-70"
      )}
    >
      {/* Attacker */}
      <span className={cn("font-medium text-sm truncate max-w-[100px]", attackerColor)}>
        {attackerName}
      </span>

      {/* Kill indicator with weapon */}
      <div className="flex items-center gap-1">
        {/* Special kill badges */}
        {badges.length > 0 && (
          <div className="flex items-center gap-0.5">
            {badges.map((badge) => (
              <span
                key={badge}
                className={cn(
                  "text-[9px] font-bold px-1 rounded",
                  badge === "HS"
                    ? "bg-red-500/80 text-white"
                    : "bg-yellow-500/80 text-black"
                )}
              >
                {badge}
              </span>
            ))}
          </div>
        )}

        {/* Weapon icon */}
        <div className="flex items-center">
          <CS2WeaponIcon
            weapon={weapon}
            size="sm"
            color="rgba(255,255,255,0.9)"
            className="mx-1"
          />
        </div>
      </div>

      {/* Victim */}
      <span className={cn("font-medium text-sm truncate max-w-[100px]", victimColor)}>
        {victimName}
      </span>

      {/* Skull indicator */}
      <span className="text-red-500 text-xs">☠</span>
    </div>
  );
});

interface KillFeedProps {
  className?: string;
  maxEntries?: number;
  displayDuration?: number; // in ticks
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
}

export function KillFeed({
  className,
  maxEntries = 5,
  displayDuration = 64 * 5, // 5 seconds at 64 tick
  position = "top-right",
}: KillFeedProps) {
  const { events, currentTick, showKillLines } = useReplayStore();

  // Filter and sort recent kills (type-safe with KillEvent)
  const recentKills = useMemo((): KillEvent[] => {
    if (!events || !showKillLines) return [];

    return events
      .filter((event): event is KillEvent => {
        if (!isKillEvent(event)) return false;
        // Show kills from past displayDuration ticks
        const ticksSince = currentTick - event.tick;
        return ticksSince >= 0 && ticksSince <= displayDuration;
      })
      .sort((a, b) => b.tick - a.tick) // Most recent first
      .slice(0, maxEntries);
  }, [events, currentTick, displayDuration, maxEntries, showKillLines]);

  // Position classes
  const positionClasses = {
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4",
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
  };

  // Don't render if no kills or killfeed disabled
  if (recentKills.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute z-20 flex flex-col gap-1",
        positionClasses[position],
        className
      )}
    >
      {recentKills.map((kill, index) => {
        const ticksSince = currentTick - kill.tick;
        const isNew = ticksSince < 32; // ~0.5 second at 64 tick

        return (
          <KillFeedEntry
            key={`${kill.id}-${kill.tick}`}
            kill={kill}
            isNew={isNew}
          />
        );
      })}
    </div>
  );
}

export default KillFeed;
