"use client";

/**
 * AnalyseHeader - Header for analyse (analyst) view mode
 *
 * Layout (wireframe reference - Layout C):
 * [◀R13▶] │ CT 8 vs 5 T │ [Filter: All Events ▾] [Player ▾] │ [⚙]
 *
 * Features:
 * - Round selector with prev/next navigation
 * - Team scores
 * - Event type filter dropdown
 * - Player filter dropdown
 * - Settings button
 * - Height: 48px
 *
 * Analyst-specific:
 * - Quick event filters
 * - Player focus selector
 * - Export options in settings
 */

import React, { useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsPanel } from "./settings-panel";
import { type PlayerFrame } from "@/stores/replay-store";

// Event filter options
export type EventFilter = "all" | "kills" | "bombs" | "grenades" | "economy";
export const EVENT_FILTER_LABELS: Record<EventFilter, string> = {
  all: "All Events",
  kills: "Kills Only",
  bombs: "Bomb Events",
  grenades: "Grenades",
  economy: "Economy",
};

interface AnalyseHeaderProps {
  /** Current round number */
  roundNumber: number;
  /** Total rounds available */
  totalRounds: number;
  /** CT team score */
  ctScore: number;
  /** T team score */
  tScore: number;
  /** Available players for filter */
  players?: PlayerFrame[];
  /** Current event filter */
  eventFilter?: EventFilter;
  /** Current player filter (steamId or null for all) */
  playerFilter?: string | null;
  /** Callback when round changes */
  onRoundChange: (round: number) => void;
  /** Callback when event filter changes */
  onEventFilterChange?: (filter: EventFilter) => void;
  /** Callback when player filter changes */
  onPlayerFilterChange?: (steamId: string | null) => void;
  /** Additional class names */
  className?: string;
}

/**
 * AnalyseHeader - Main component
 */
export const AnalyseHeader = React.memo(function AnalyseHeader({
  roundNumber,
  totalRounds,
  ctScore,
  tScore,
  players = [],
  eventFilter = "all",
  playerFilter = null,
  onRoundChange,
  onEventFilterChange,
  onPlayerFilterChange,
  className,
}: AnalyseHeaderProps) {
  // Generate round options
  const roundOptions = useMemo(() => {
    return Array.from({ length: totalRounds }, (_, i) => i + 1);
  }, [totalRounds]);

  // Handle round navigation
  const handlePrevRound = useCallback(() => {
    if (roundNumber > 1) {
      onRoundChange(roundNumber - 1);
    }
  }, [roundNumber, onRoundChange]);

  const handleNextRound = useCallback(() => {
    if (roundNumber < totalRounds) {
      onRoundChange(roundNumber + 1);
    }
  }, [roundNumber, totalRounds, onRoundChange]);

  // Unique players for filter
  const uniquePlayers = useMemo(() => {
    const seen = new Set<string>();
    return players.filter((p) => {
      if (seen.has(p.steamId)) return false;
      seen.add(p.steamId);
      return true;
    });
  }, [players]);

  return (
    <header
      className={cn(
        "flex items-center h-12 px-3 bg-card border-b border-border gap-3",
        "shrink-0",
        className
      )}
    >
      {/* Round selector */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handlePrevRound}
          disabled={roundNumber <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Select
          value={String(roundNumber)}
          onValueChange={(value) => onRoundChange(Number(value))}
        >
          <SelectTrigger className="h-7 w-auto min-w-[60px] px-2 text-sm font-medium">
            <SelectValue>R{roundNumber}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {roundOptions.map((round) => (
              <SelectItem key={round} value={String(round)}>
                Round {round}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleNextRound}
          disabled={roundNumber >= totalRounds}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Separator */}
      <div className="h-6 w-px bg-border" />

      {/* Scores */}
      <div className="flex items-center gap-1.5">
        <span className="bg-ct text-white font-bold px-2 py-0.5 rounded text-sm tabular-nums min-w-[28px] text-center">
          {ctScore}
        </span>
        <span className="text-muted-foreground text-xs">vs</span>
        <span className="bg-t text-white font-bold px-2 py-0.5 rounded text-sm tabular-nums min-w-[28px] text-center">
          {tScore}
        </span>
      </div>

      {/* Separator */}
      <div className="h-6 w-px bg-border" />

      {/* Event Filter */}
      <div className="flex items-center gap-1.5">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <Select
          value={eventFilter}
          onValueChange={(value) => onEventFilterChange?.(value as EventFilter)}
        >
          <SelectTrigger className="h-7 w-auto min-w-[100px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(EVENT_FILTER_LABELS) as EventFilter[]).map((filter) => (
              <SelectItem key={filter} value={filter}>
                {EVENT_FILTER_LABELS[filter]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Player Filter */}
      {uniquePlayers.length > 0 && (
        <div className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          <Select
            value={playerFilter || "all"}
            onValueChange={(value) =>
              onPlayerFilterChange?.(value === "all" ? null : value)
            }
          >
            <SelectTrigger className="h-7 w-auto min-w-[100px] text-xs">
              <SelectValue placeholder="All Players" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Players</SelectItem>
              {uniquePlayers.map((player) => (
                <SelectItem key={player.steamId} value={player.steamId}>
                  <span className={cn(
                    player.team === 3 ? "text-ct" : "text-t"
                  )}>
                    {player.name || player.steamId}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Settings */}
      <SettingsPanel variant="popover" showViewModeSelector compact className="h-8 w-8" />
    </header>
  );
});

export default AnalyseHeader;