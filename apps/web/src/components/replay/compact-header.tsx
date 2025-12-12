"use client";

/**
 * CompactHeader - Minimal header for compact (player) view mode
 *
 * Layout (wireframe reference):
 * [◀] R13 │ CT 8 vs 5 T │                    [⚙] [☰]
 *
 * Features:
 * - Round selector dropdown
 * - Score display (CT vs T)
 * - Settings button (popover)
 * - Compact: 48px height
 *
 * Extensibility: Props for all customization
 * Performance: React.memo, minimal re-renders
 * Mobile: Responsive, touch-friendly
 */

import React, { useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsPanel } from "./settings-panel";

interface CompactHeaderProps {
  /** Current round number */
  roundNumber: number;
  /** Total rounds available */
  totalRounds: number;
  /** CT team score */
  ctScore: number;
  /** T team score */
  tScore: number;
  /** CT team name */
  ctName?: string;
  /** T team name */
  tName?: string;
  /** Callback when round changes */
  onRoundChange: (round: number) => void;
  /** Additional class names */
  className?: string;
}

/**
 * Score display component - CT vs T
 */
const ScoreDisplay = React.memo(function ScoreDisplay({
  ctScore,
  tScore,
  ctName,
  tName,
}: {
  ctScore: number;
  tScore: number;
  ctName?: string;
  tName?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {/* CT side */}
      {ctName && (
        <span className="hidden sm:inline text-xs text-ct font-medium truncate max-w-[80px]">
          {ctName}
        </span>
      )}
      <span className="bg-ct/20 text-ct font-bold px-2 py-0.5 rounded text-sm tabular-nums">
        {ctScore}
      </span>

      {/* Separator */}
      <span className="text-muted-foreground text-xs">vs</span>

      {/* T side */}
      <span className="bg-t/20 text-t font-bold px-2 py-0.5 rounded text-sm tabular-nums">
        {tScore}
      </span>
      {tName && (
        <span className="hidden sm:inline text-xs text-t font-medium truncate max-w-[80px]">
          {tName}
        </span>
      )}
    </div>
  );
});

/**
 * CompactHeader - Main component
 */
export const CompactHeader = React.memo(function CompactHeader({
  roundNumber,
  totalRounds,
  ctScore,
  tScore,
  ctName,
  tName,
  onRoundChange,
  className,
}: CompactHeaderProps) {
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

  return (
    <header
      className={cn(
        "flex items-center justify-between h-12 px-3 bg-card border-b border-border",
        "shrink-0", // Don't shrink in flex container
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
          <span className="sr-only">Previous round</span>
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
          <span className="sr-only">Next round</span>
        </Button>
      </div>

      {/* Center: Score */}
      <ScoreDisplay
        ctScore={ctScore}
        tScore={tScore}
        ctName={ctName}
        tName={tName}
      />

      {/* Right: Settings */}
      <div className="flex items-center gap-1">
        <SettingsPanel variant="popover" showViewModeSelector compact className="h-8 w-8" />
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">More options</span>
        </Button>
      </div>
    </header>
  );
});

export default CompactHeader;
