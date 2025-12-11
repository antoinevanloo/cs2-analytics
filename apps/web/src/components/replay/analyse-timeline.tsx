"use client";

/**
 * AnalyseTimeline - Multi-layer timeline for analyse (analyst) view mode
 *
 * Layout (wireframe reference - Layout C):
 * ┌─────────────────────────────────────────────────────────────┐
 * │ Main     │═══════════●══════════════════════════════════│   │
 * │ Kills    │    ●      ●         ●    ●                   │   │
 * │ Bombs    │               ◆                    ◇         │   │
 * │ Grenades │  ○ ○    ○ ○ ○    ○ ○        ○ ○   ○ ○ ○      │   │
 * │──────────┼───────────────────────────────────────────────│   │
 * │ [◀][▶▶][▶] │ 1x │ 0:32 / 1:45                            │   │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Features:
 * - Main scrubber timeline
 * - Kill event track
 * - Bomb event track
 * - Grenade event track
 * - Playback controls
 * - Speed selector
 * - Time display
 *
 * Analyst-specific:
 * - Multi-track visualization
 * - Event markers clickable to jump
 * - Event density view
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
  isKillEvent,
  isBombEvent,
  isGrenadeEvent,
} from "@/stores/replay-store";

// Track types
type TrackType = "kills" | "bombs" | "grenades";

interface TrackConfig {
  id: TrackType;
  label: string;
  color: string;
  filter: (event: ReplayEvent) => boolean;
}

const TRACKS: TrackConfig[] = [
  {
    id: "kills",
    label: "Kills",
    color: "#ef4444", // red
    filter: isKillEvent,
  },
  {
    id: "bombs",
    label: "Bombs",
    color: "#f59e0b", // amber
    filter: isBombEvent,
  },
  {
    id: "grenades",
    label: "Grenades",
    color: "#22c55e", // green
    filter: (e) => isGrenadeEvent(e.type),
  },
];

interface EventMarkerProps {
  event: ReplayEvent;
  startTick: number;
  endTick: number;
  color: string;
  onClick?: () => void;
}

/**
 * EventMarker - Marker on a track
 */
const EventMarker = React.memo(function EventMarker({
  event,
  startTick,
  endTick,
  color,
  onClick,
}: EventMarkerProps) {
  const totalTicks = endTick - startTick;
  if (totalTicks === 0) return null;

  const position = ((event.tick - startTick) / totalTicks) * 100;
  if (position < 0 || position > 100) return null;

  return (
    <div
      className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full cursor-pointer hover:scale-150 transition-transform z-10"
      style={{
        left: `${position}%`,
        backgroundColor: color,
        marginLeft: "-4px",
      }}
      onClick={onClick}
      title={`${event.type} at tick ${event.tick}`}
    />
  );
});

interface TrackRowProps {
  config: TrackConfig;
  events: ReplayEvent[];
  startTick: number;
  endTick: number;
  onEventClick: (tick: number) => void;
}

/**
 * TrackRow - Single event track
 */
const TrackRow = React.memo(function TrackRow({
  config,
  events,
  startTick,
  endTick,
  onEventClick,
}: TrackRowProps) {
  const trackEvents = events.filter(config.filter);

  return (
    <div className="flex items-center gap-2 h-5">
      <span
        className="w-16 text-[10px] font-medium truncate"
        style={{ color: config.color }}
      >
        {config.label}
      </span>
      <div className="flex-1 h-3 bg-muted/30 rounded relative">
        {trackEvents.map((event, index) => (
          <EventMarker
            key={`${event.id}-${index}`}
            event={event}
            startTick={startTick}
            endTick={endTick}
            color={config.color}
            onClick={() => onEventClick(event.tick)}
          />
        ))}
      </div>
    </div>
  );
});

interface AnalyseTimelineProps {
  /** Additional class names */
  className?: string;
}

/**
 * AnalyseTimeline - Main component
 */
export const AnalyseTimeline = React.memo(function AnalyseTimeline({
  className,
}: AnalyseTimelineProps) {
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
    seekToTick,
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

  // Current and total time
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

  // Handle click on main timeline
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

  // Handle event click (jump to tick)
  const handleEventClick = useCallback(
    (tick: number) => {
      seekToTick(tick);
    },
    [seekToTick]
  );

  // Handle speed change
  const handleSpeedChange = useCallback(
    (value: string) => {
      setPlaybackSpeed(parseFloat(value) as PlaybackSpeed);
    },
    [setPlaybackSpeed]
  );

  return (
    <TooltipProvider>
      <div
        className={cn(
          "bg-card border-t border-border p-3",
          "shrink-0",
          className
        )}
      >
        {/* Multi-layer tracks */}
        <div className="space-y-1 mb-3">
          {/* Main scrubber */}
          <div className="flex items-center gap-2 h-6">
            <span className="w-16 text-[10px] font-medium text-muted-foreground">
              Main
            </span>
            <div
              ref={progressBarRef}
              className={cn(
                "flex-1 h-5 bg-secondary/50 rounded cursor-pointer relative",
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
          </div>

          {/* Event tracks */}
          {TRACKS.map((track) => (
            <TrackRow
              key={track.id}
              config={track}
              events={events}
              startTick={startTick}
              endTick={endTick}
              onEventClick={handleEventClick}
            />
          ))}
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-3 pt-2 border-t border-border">
          {/* Playback controls */}
          <div className="flex items-center gap-0.5">
            {/* Frame step back */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={previousFrame}
                  disabled={isDisabled}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
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
                  className="h-7 w-7"
                  onClick={() => skipBackward(5)}
                  disabled={isDisabled}
                >
                  <SkipBack className="h-3.5 w-3.5" />
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
                  className="h-8 w-8"
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
                  className="h-7 w-7"
                  onClick={() => skipForward(5)}
                  disabled={isDisabled}
                >
                  <SkipForward className="h-3.5 w-3.5" />
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
                  className="h-7 w-7"
                  onClick={nextFrame}
                  disabled={isDisabled}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Next frame</TooltipContent>
            </Tooltip>
          </div>

          {/* Speed selector */}
          <Select
            value={playbackSpeed.toString()}
            onValueChange={handleSpeedChange}
            disabled={isDisabled}
          >
            <SelectTrigger className="w-14 h-7 text-xs">
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

          {/* Time display */}
          <div className="flex-1 text-right">
            <span className="text-sm font-mono text-muted-foreground">
              {currentTime} / {totalTime}
            </span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
});

export default AnalyseTimeline;