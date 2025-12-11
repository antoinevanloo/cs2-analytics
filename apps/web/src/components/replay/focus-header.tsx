"use client";

/**
 * FocusHeader - Header for focus (recruteur) view mode
 *
 * Layout (wireframe reference - Layout D):
 * ┌────────────────────────────────────────────────────────────────────────┐
 * │ [◀] [R13 ▾] │ Focus: PlayerName │ CT 8 : 5 T │                  [⚙]   │
 * └────────────────────────────────────────────────────────────────────────┘
 *
 * Features:
 * - Round selector with navigation
 * - Focus player indicator (highlighted)
 * - Team scores
 * - Settings button
 *
 * Recruteur-specific:
 * - Prominent focus player display
 * - Quick switch between players
 */

import React, { useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Settings,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  useReplayStore,
  VIEW_MODE_LABELS,
  type ViewMode,
  type PlayerFrame,
} from "@/stores/replay-store";

interface FocusHeaderProps {
  /** Current round number */
  roundNumber: number;
  /** Total rounds available */
  totalRounds: number;
  /** CT team score */
  ctScore: number;
  /** T team score */
  tScore: number;
  /** Focused player name */
  focusedPlayerName?: string;
  /** Focused player team */
  focusedPlayerTeam?: number;
  /** Callback when round changes */
  onRoundChange?: (round: number) => void;
  /** Callback to clear focus */
  onClearFocus?: () => void;
  /** Additional class names */
  className?: string;
}

/**
 * FocusHeader - Main component
 */
export const FocusHeader = React.memo(function FocusHeader({
  roundNumber,
  totalRounds,
  ctScore,
  tScore,
  focusedPlayerName,
  focusedPlayerTeam,
  onRoundChange,
  onClearFocus,
  className,
}: FocusHeaderProps) {
  const { viewMode, setViewMode } = useReplayStore();

  // Round navigation
  const handlePrevRound = useCallback(() => {
    if (roundNumber > 1) {
      onRoundChange?.(roundNumber - 1);
    }
  }, [roundNumber, onRoundChange]);

  const handleNextRound = useCallback(() => {
    if (roundNumber < totalRounds) {
      onRoundChange?.(roundNumber + 1);
    }
  }, [roundNumber, totalRounds, onRoundChange]);

  const handleRoundSelect = useCallback(
    (value: string) => {
      onRoundChange?.(parseInt(value, 10));
    },
    [onRoundChange]
  );

  const handleViewModeChange = useCallback(
    (value: string) => {
      setViewMode(value as ViewMode);
    },
    [setViewMode]
  );

  return (
    <header
      className={cn(
        "h-12 bg-card border-b border-border",
        "flex items-center justify-between px-3 gap-3",
        "shrink-0",
        className
      )}
    >
      {/* Left: Round selector */}
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

        <Select value={roundNumber.toString()} onValueChange={handleRoundSelect}>
          <SelectTrigger className="w-16 h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: totalRounds }, (_, i) => (
              <SelectItem key={i + 1} value={(i + 1).toString()}>
                R{i + 1}
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

      {/* Center: Focus player indicator */}
      <div className="flex items-center gap-2">
        {focusedPlayerName ? (
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full",
              "bg-accent/20 border border-accent/50"
            )}
          >
            <User className="h-3.5 w-3.5 text-accent" />
            <span className="text-sm font-medium text-accent">
              Focus:
            </span>
            <span
              className={cn(
                "text-sm font-semibold",
                focusedPlayerTeam === 3 ? "text-ct" : "text-t"
              )}
            >
              {focusedPlayerName}
            </span>
            {onClearFocus && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 ml-1 hover:bg-accent/30"
                onClick={onClearFocus}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Click a player to focus
            </span>
          </div>
        )}
      </div>

      {/* Right: Scores + Settings */}
      <div className="flex items-center gap-3">
        {/* Scores */}
        <div className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 bg-ct text-white text-xs font-bold rounded">
            {ctScore}
          </span>
          <span className="text-xs text-muted-foreground">:</span>
          <span className="px-2 py-0.5 bg-t text-white text-xs font-bold rounded">
            {tScore}
          </span>
        </div>

        {/* Settings */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Settings className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56" align="end">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  View Mode
                </label>
                <Select value={viewMode} onValueChange={handleViewModeChange}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(VIEW_MODE_LABELS) as [ViewMode, string][]).map(
                      ([mode, label]) => (
                        <SelectItem key={mode} value={mode}>
                          {label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
});

export default FocusHeader;
