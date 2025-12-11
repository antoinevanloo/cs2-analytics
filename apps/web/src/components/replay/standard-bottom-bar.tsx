"use client";

/**
 * StandardBottomBar - Timeline and controls for standard (coach) view mode
 *
 * Layout (wireframe reference - Layout B):
 * │ 0:32 │════════●════════════│ -1:13 │ [◀][▶▶][▶] │ 1x │ [K][G][N][H] │
 *
 * Features:
 * - Timeline with progress bar and event markers
 * - Time display (current / remaining)
 * - Playback controls (frame step, skip, play/pause)
 * - Speed selector
 * - Quick overlay toggles (kill lines, grenades, names, health)
 * - Height: 64px
 *
 * Coach-specific:
 * - Frame-by-frame controls always visible
 * - More prominent timeline
 * - Overlay toggles inline
 */

import React, { useCallback, useRef, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Skull,
  Target,
  MessageSquare,
  Heart,
  Eye,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useReplayStore,
  usePlaybackProgress,
  useIsPlaying,
  PLAYBACK_SPEEDS,
  type PlaybackSpeed,
  type ReplayEvent,
} from "@/stores/replay-store";

// Event marker colors
const EVENT_COLORS: Record<string, string> = {
  KILL: "#ef4444",
  BOMB_PLANT: "#f59e0b",
  BOMB_DEFUSE: "#22c55e",
  BOMB_EXPLODE: "#ef4444",
};

interface EventMarkerProps {
  event: ReplayEvent;
  startTick: number;
  endTick: number;
}

/**
 * EventMarker - Small dot on timeline for events
 */
const EventMarker = React.memo(function EventMarker({
  event,
  startTick,
  endTick,
}: EventMarkerProps) {
  const totalTicks = endTick - startTick;
  const eventPosition = ((event.tick - startTick) / totalTicks) * 100;
  const color = EVENT_COLORS[event.type] || "#888888";

  if (eventPosition < 0 || eventPosition > 100) return null;

  return (
    <div
      className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full hover:scale-150 transition-transform cursor-pointer z-10"
      style={{
        left: `${eventPosition}%`,
        backgroundColor: color,
        marginLeft: "-4px",
      }}
      title={`${event.type} at tick ${event.tick}`}
    />
  );
});

/**
 * QuickToggles - Overlay toggle buttons
 */
const QuickToggles = React.memo(function QuickToggles() {
  const {
    showKillLines,
    showGrenades,
    showPlayerNames,
    showHealthBars,
    toggleKillLines,
    toggleGrenades,
    togglePlayerNames,
    toggleHealthBars,
    resetViewport,
  } = useReplayStore();

  return (
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
  );
});

export interface StandardBottomBarProps {
  /** Additional class names */
  className?: string;
}

/**
 * StandardBottomBar - Main component
 */
export const StandardBottomBar = React.memo(function StandardBottomBar({
  className,
}: StandardBottomBarProps) {
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const isPlaying = useIsPlaying();
  const { current, total, percentage } = usePlaybackProgress();

  const {
    playbackState,
    roundMetadata,
    events,
    currentTick,
    tickRate,
    playbackSpeed,
    seek,
    pause,
    togglePlay,
    nextFrame,
    previousFrame,
    skipForward,
    skipBackward,
    setPlaybackSpeed,
  } = useReplayStore();

  const isDisabled = playbackState === "loading" || playbackState === "idle";

  const startTick = roundMetadata?.startTick ?? 0;
  const endTick = roundMetadata?.endTick ?? 0;

  // Format time from tick
  const formatTime = useCallback(
    (tick: number) => {
      const seconds = (tick - startTick) / tickRate;
      const minutes = Math.floor(Math.abs(seconds) / 60);
      const remainingSeconds = Math.floor(Math.abs(seconds) % 60);
      return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
    },
    [startTick, tickRate],
  );

  // Current and remaining time
  const currentTime = formatTime(currentTick);
  const remainingTime = useMemo(() => {
    const remaining = (endTick - currentTick) / tickRate;
    const minutes = Math.floor(Math.max(0, remaining) / 60);
    const seconds = Math.floor(Math.max(0, remaining) % 60);
    return `-${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, [currentTick, endTick, tickRate]);

  // Filter events for timeline markers
  const timelineEvents = useMemo(() => {
    if (!events) return [];
    return events.filter(
      (e) => e.type === "KILL" || e.type.startsWith("BOMB")
    );
  }, [events]);

  // Calculate frame index from position
  const getFrameIndexFromPosition = useCallback(
    (clientX: number) => {
      if (!progressBarRef.current || total === 0) return 0;

      const rect = progressBarRef.current.getBoundingClientRect();
      const position = (clientX - rect.left) / rect.width;
      const clampedPosition = Math.max(0, Math.min(1, position));
      return Math.floor(clampedPosition * (total - 1));
    },
    [total],
  );

  // Handle click on timeline
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const frameIndex = getFrameIndexFromPosition(e.clientX);
      seek(frameIndex);
    },
    [getFrameIndexFromPosition, seek],
  );

  // Handle drag
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      pause();

      const frameIndex = getFrameIndexFromPosition(e.clientX);
      seek(frameIndex);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const newFrameIndex = getFrameIndexFromPosition(moveEvent.clientX);
        seek(newFrameIndex);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [getFrameIndexFromPosition, seek, pause],
  );

  // Handle touch events for mobile
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return;

      setIsDragging(true);
      pause();

      const touch = e.touches[0];
      const frameIndex = getFrameIndexFromPosition(touch.clientX);
      seek(frameIndex);

      const handleTouchMove = (moveEvent: TouchEvent) => {
        if (moveEvent.touches.length !== 1) return;
        const moveTouch = moveEvent.touches[0];
        const newFrameIndex = getFrameIndexFromPosition(moveTouch.clientX);
        seek(newFrameIndex);
      };

      const handleTouchEnd = () => {
        setIsDragging(false);
        document.removeEventListener("touchmove", handleTouchMove);
        document.removeEventListener("touchend", handleTouchEnd);
      };

      document.addEventListener("touchmove", handleTouchMove, { passive: true });
      document.addEventListener("touchend", handleTouchEnd);
    },
    [getFrameIndexFromPosition, seek, pause],
  );

  // Handle speed change
  const handleSpeedChange = useCallback(
    (value: string) => {
      setPlaybackSpeed(parseFloat(value) as PlaybackSpeed);
    },
    [setPlaybackSpeed],
  );

  return (
    <TooltipProvider>
      <div
        className={cn(
          "flex items-center gap-2 h-16 px-3 bg-card border-t border-border",
          "shrink-0",
          className
        )}
      >
        {/* Current time */}
        <span className="text-sm font-mono text-muted-foreground w-12 text-right tabular-nums">
          {currentTime}
        </span>

        {/* Timeline bar */}
        <div
          ref={progressBarRef}
          className={cn(
            "relative flex-1 h-6 bg-secondary/50 rounded cursor-pointer",
            "hover:bg-secondary/70 transition-colors",
            isDragging && "bg-secondary/70"
          )}
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          {/* Progress fill */}
          <div
            className="absolute top-0 left-0 h-full bg-primary/30 rounded-l"
            style={{ width: `${percentage}%` }}
          />

          {/* Event markers */}
          {timelineEvents.map((event, index) => (
            <EventMarker
              key={`${event.id}-${event.tick}-${index}`}
              event={event}
              startTick={startTick}
              endTick={endTick}
            />
          ))}

          {/* Scrubber handle */}
          <div
            className={cn(
              "absolute top-1/2 -translate-y-1/2",
              "w-4 h-4 bg-primary rounded-full border-2 border-background",
              "shadow-md transition-transform z-20",
              isDragging && "scale-125"
            )}
            style={{ left: `${percentage}%`, marginLeft: "-8px" }}
          />
        </div>

        {/* Remaining time */}
        <span className="text-sm font-mono text-muted-foreground w-12 tabular-nums">
          {remainingTime}
        </span>

        {/* Separator */}
        <div className="h-8 w-px bg-border" />

        {/* Controls */}
        <div className="flex items-center gap-0.5">
          {/* Frame step back */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={previousFrame}
                disabled={isDisabled}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Previous frame (,)</TooltipContent>
          </Tooltip>

          {/* Skip back */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => skipBackward(10)}
                disabled={isDisabled}
              >
                <SkipBack className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Skip back 10s (J)</TooltipContent>
          </Tooltip>

          {/* Play/Pause */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="icon"
                className="h-10 w-10"
                onClick={togglePlay}
                disabled={isDisabled}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5 ml-0.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isPlaying ? "Pause (Space)" : "Play (Space)"}
            </TooltipContent>
          </Tooltip>

          {/* Skip forward */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => skipForward(10)}
                disabled={isDisabled}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Skip forward 10s (L)</TooltipContent>
          </Tooltip>

          {/* Frame step forward */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={nextFrame}
                disabled={isDisabled}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Next frame (.)</TooltipContent>
          </Tooltip>
        </div>

        {/* Speed selector */}
        <Select
          value={playbackSpeed.toString()}
          onValueChange={handleSpeedChange}
          disabled={isDisabled}
        >
          <SelectTrigger className="w-16 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PLAYBACK_SPEEDS.map((speed) => (
              <SelectItem key={speed} value={speed.toString()}>
                {speed}x
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Separator */}
        <div className="h-8 w-px bg-border hidden md:block" />

        {/* Quick toggles - hidden on small screens */}
        <div className="hidden md:flex">
          <QuickToggles />
        </div>
      </div>
    </TooltipProvider>
  );
});

export default StandardBottomBar;
