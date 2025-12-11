"use client";

/**
 * FocusBottomBar - Bottom bar for focus (recruteur) view mode
 *
 * Layout (wireframe reference - Layout D):
 * ┌────────────────────────────────────────────────────────────────────────┐
 * │ [◀][▶▶][▶] │══════════════●══════════════════│ 0:32 / 1:45 │ 1x │     │
 * └────────────────────────────────────────────────────────────────────────┘
 *
 * Features:
 * - Playback controls (frame step, skip, play/pause)
 * - Timeline with progress indicator
 * - Time display (current / total)
 * - Speed selector
 *
 * Height: 60px
 */

import React, { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
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
  isKillEvent,
} from "@/stores/replay-store";

interface FocusBottomBarProps {
  /** Additional class names */
  className?: string;
}

/**
 * FocusBottomBar - Main component
 */
export const FocusBottomBar = React.memo(function FocusBottomBar({
  className,
}: FocusBottomBarProps) {
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
    focusedPlayerSteamId,
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
      const seconds = Math.max(0, (tick - startTick) / tickRate);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.floor(seconds % 60);
      return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
    },
    [startTick, tickRate]
  );

  const currentTime = formatTime(currentTick);
  const totalTime = formatTime(endTick);

  // Calculate frame index from position
  const getFrameIndexFromPosition = useCallback(
    (clientX: number) => {
      if (!progressBarRef.current || total === 0) return 0;

      const rect = progressBarRef.current.getBoundingClientRect();
      const position = (clientX - rect.left) / rect.width;
      const clampedPosition = Math.max(0, Math.min(1, position));
      return Math.floor(clampedPosition * (total - 1));
    },
    [total]
  );

  // Handle click on timeline
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const frameIndex = getFrameIndexFromPosition(e.clientX);
      seek(frameIndex);
    },
    [getFrameIndexFromPosition, seek]
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
    [getFrameIndexFromPosition, seek, pause]
  );

  // Handle speed change
  const handleSpeedChange = useCallback(
    (value: string) => {
      setPlaybackSpeed(parseFloat(value) as PlaybackSpeed);
    },
    [setPlaybackSpeed]
  );

  // Get kills for focused player to mark on timeline
  const focusedPlayerKills = React.useMemo(() => {
    if (!focusedPlayerSteamId) return [];
    return events.filter(
      (e) => isKillEvent(e) && e.attackerSteamId === focusedPlayerSteamId
    );
  }, [events, focusedPlayerSteamId]);

  const focusedPlayerDeaths = React.useMemo(() => {
    if (!focusedPlayerSteamId) return [];
    return events.filter(
      (e) => isKillEvent(e) && e.victimSteamId === focusedPlayerSteamId
    );
  }, [events, focusedPlayerSteamId]);

  return (
    <TooltipProvider>
      <div
        className={cn(
          "h-[60px] bg-card border-t border-border",
          "flex items-center gap-3 px-4",
          "shrink-0",
          className
        )}
      >
        {/* Playback controls */}
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
            <TooltipContent>Previous frame</TooltipContent>
          </Tooltip>

          {/* Skip back */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => skipBackward(5)}
                disabled={isDisabled}
              >
                <SkipBack className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>-5s</TooltipContent>
          </Tooltip>

          {/* Play/Pause */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="icon"
                className="h-9 w-9"
                onClick={togglePlay}
                disabled={isDisabled}
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4 ml-0.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isPlaying ? "Pause" : "Play"}</TooltipContent>
          </Tooltip>

          {/* Skip forward */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => skipForward(5)}
                disabled={isDisabled}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>+5s</TooltipContent>
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
            <TooltipContent>Next frame</TooltipContent>
          </Tooltip>
        </div>

        {/* Timeline */}
        <div
          ref={progressBarRef}
          className={cn(
            "flex-1 h-6 bg-secondary/50 rounded cursor-pointer relative",
            "hover:bg-secondary/70 transition-colors",
            isDragging && "bg-secondary/70"
          )}
          onClick={handleClick}
          onMouseDown={handleMouseDown}
        >
          {/* Progress fill */}
          <div
            className="absolute top-0 left-0 h-full bg-primary/30 rounded-l"
            style={{ width: `${percentage}%` }}
          />

          {/* Focused player kills markers */}
          {focusedPlayerKills.map((kill, index) => {
            const totalTicks = endTick - startTick;
            if (totalTicks === 0) return null;
            const position = ((kill.tick - startTick) / totalTicks) * 100;
            if (position < 0 || position > 100) return null;

            return (
              <div
                key={`kill-${index}`}
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-green-500 rounded-full z-10"
                style={{ left: `${position}%`, marginLeft: "-4px" }}
                title={`Kill at ${formatTime(kill.tick)}`}
              />
            );
          })}

          {/* Focused player deaths markers */}
          {focusedPlayerDeaths.map((death, index) => {
            const totalTicks = endTick - startTick;
            if (totalTicks === 0) return null;
            const position = ((death.tick - startTick) / totalTicks) * 100;
            if (position < 0 || position > 100) return null;

            return (
              <div
                key={`death-${index}`}
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-red-500 rounded-full z-10"
                style={{ left: `${position}%`, marginLeft: "-4px" }}
                title={`Death at ${formatTime(death.tick)}`}
              />
            );
          })}

          {/* Scrubber handle */}
          <div
            className={cn(
              "absolute top-1/2 -translate-y-1/2",
              "w-3 h-3 bg-primary rounded-full border-2 border-background",
              "shadow-md transition-transform z-20",
              isDragging && "scale-125"
            )}
            style={{ left: `${percentage}%`, marginLeft: "-6px" }}
          />
        </div>

        {/* Time display */}
        <div className="text-sm font-mono text-muted-foreground whitespace-nowrap">
          {currentTime} / {totalTime}
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
      </div>
    </TooltipProvider>
  );
});

export default FocusBottomBar;
