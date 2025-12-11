"use client";

/**
 * StandardHeader - Header for standard (coach) view mode
 *
 * Layout (wireframe reference - Layout B):
 * [◀R13▶] │ Round Timer │ CT 8 █ vs █ 5 T │           [Toggles] [⚙]
 *
 * Features:
 * - Round selector with prev/next navigation
 * - Round timer display
 * - Team scores with colors
 * - Quick overlay toggles
 * - Settings button
 * - Height: 52px
 *
 * Coach-specific:
 * - More visible team names
 * - Round win reason badge
 * - Quick toggle buttons always visible
 */

import React, { useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Settings,
  Skull,
  Target,
  MessageSquare,
  Heart,
  Eye,
  Clock,
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useReplayStore,
  useCurrentFrame,
  ViewMode,
  VIEW_MODE_LABELS,
} from "@/stores/replay-store";

interface StandardHeaderProps {
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
  /** Current round time formatted */
  roundTime?: string;
  /** Winner of current round */
  winnerTeam?: number;
  /** Round win reason */
  winReason?: string;
  /** Callback when round changes */
  onRoundChange: (round: number) => void;
  /** Additional class names */
  className?: string;
}

/**
 * QuickToggles - Inline toggle buttons for overlays
 */
const QuickToggles = React.memo(function QuickToggles() {
  const {
    showKillLines,
    showGrenades,
    showPlayerNames,
    showHealthBars,
    showTrails,
    toggleKillLines,
    toggleGrenades,
    togglePlayerNames,
    toggleHealthBars,
    toggleTrails,
    resetViewport,
  } = useReplayStore();

  return (
    <TooltipProvider>
      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={showKillLines ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={toggleKillLines}
            >
              <Skull className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Kill lines (K)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={showGrenades ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={toggleGrenades}
            >
              <Target className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Grenades (G)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={showPlayerNames ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={togglePlayerNames}
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Names (N)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={showHealthBars ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={toggleHealthBars}
            >
              <Heart className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Health (H)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={resetViewport}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reset view (R)</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
});

/**
 * Settings popover with view mode selector
 */
const SettingsPopover = React.memo(function SettingsPopover() {
  const [open, setOpen] = React.useState(false);

  const {
    viewMode,
    showTrajectories,
    showTrails,
    setViewMode,
    toggleTrajectories,
    toggleTrails,
  } = useReplayStore();

  const viewModes: ViewMode[] = ["compact", "standard", "analyse", "focus"];

  const handleViewModeChange = useCallback((value: ViewMode) => {
    setViewMode(value);
    // Close popover after mode change to ensure clean transition
    setOpen(false);
  }, [setViewMode]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings className="h-4 w-4" />
          <span className="sr-only">Settings</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56">
        <div className="space-y-4">
          {/* View Mode */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              View Mode
            </Label>
            <Select
              value={viewMode}
              onValueChange={handleViewModeChange}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {viewModes.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {VIEW_MODE_LABELS[mode]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Additional Toggles */}
          <div className="space-y-3">
            <Label className="text-xs font-medium text-muted-foreground">
              Advanced
            </Label>

            <div className="flex items-center justify-between">
              <Label htmlFor="trajectories" className="text-sm">
                Trajectories
              </Label>
              <Switch
                id="trajectories"
                checked={showTrajectories}
                onCheckedChange={toggleTrajectories}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="trails" className="text-sm">
                Player Trails
              </Label>
              <Switch
                id="trails"
                checked={showTrails}
                onCheckedChange={toggleTrails}
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
});

/**
 * StandardHeader - Main component
 */
export const StandardHeader = React.memo(function StandardHeader({
  roundNumber,
  totalRounds,
  ctScore,
  tScore,
  ctName,
  tName,
  roundTime,
  winnerTeam,
  winReason,
  onRoundChange,
  className,
}: StandardHeaderProps) {
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
        "flex items-center h-[52px] px-3 bg-card border-b border-border gap-3",
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
          <SelectTrigger className="h-8 w-auto min-w-[70px] px-2 text-sm font-medium">
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

      {/* Round timer */}
      {roundTime && (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span className="font-mono tabular-nums">{roundTime}</span>
        </div>
      )}

      {/* Separator */}
      <div className="h-6 w-px bg-border" />

      {/* Scores */}
      <div className="flex items-center gap-2">
        {/* CT */}
        <div className="flex items-center gap-1.5">
          {ctName && (
            <span className="text-xs text-ct font-medium hidden md:inline truncate max-w-[80px]">
              {ctName}
            </span>
          )}
          <span className="bg-ct text-white font-bold px-2.5 py-1 rounded text-sm tabular-nums min-w-[32px] text-center">
            {ctScore}
          </span>
        </div>

        <span className="text-muted-foreground text-xs">vs</span>

        {/* T */}
        <div className="flex items-center gap-1.5">
          <span className="bg-t text-white font-bold px-2.5 py-1 rounded text-sm tabular-nums min-w-[32px] text-center">
            {tScore}
          </span>
          {tName && (
            <span className="text-xs text-t font-medium hidden md:inline truncate max-w-[80px]">
              {tName}
            </span>
          )}
        </div>
      </div>

      {/* Win reason badge (if round ended) */}
      {winReason && (
        <>
          <div className="h-6 w-px bg-border hidden sm:block" />
          <span
            className={cn(
              "hidden sm:inline text-[10px] font-medium px-2 py-0.5 rounded",
              winnerTeam === 3
                ? "bg-ct/20 text-ct"
                : winnerTeam === 2
                  ? "bg-t/20 text-t"
                  : "bg-muted text-muted-foreground"
            )}
          >
            {winReason}
          </span>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Quick toggles - hidden on small screens */}
      <div className="hidden lg:flex">
        <QuickToggles />
      </div>

      {/* Settings */}
      <SettingsPopover />
    </header>
  );
});

export default StandardHeader;
