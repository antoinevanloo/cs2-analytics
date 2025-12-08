"use client";

/**
 * ReplayTimeline - Scrubber bar with event markers
 *
 * Features:
 * - Draggable progress bar
 * - Event markers (kills, bomb events)
 * - Round time display
 * - Tick information
 */

import React, { useCallback, useRef, useState } from "react";
import {
  useReplayStore,
  usePlaybackProgress,
  type ReplayEvent,
} from "@/stores/replay-store";
import { cn } from "@/lib/utils";

// Event marker colors
const EVENT_COLORS: Record<string, string> = {
  KILL: "#ff4444",
  BOMB_PLANT: "#ffaa00",
  BOMB_DEFUSE: "#44ff44",
  BOMB_EXPLODE: "#ff0000",
};

interface EventMarkerProps {
  event: ReplayEvent;
  startTick: number;
  endTick: number;
}

const EventMarker = React.memo(function EventMarker({
  event,
  startTick,
  endTick,
}: EventMarkerProps) {
  const totalTicks = endTick - startTick;
  const eventPosition = ((event.tick - startTick) / totalTicks) * 100;
  const color = EVENT_COLORS[event.type] || "#888888";

  // Don't render markers outside the round
  if (eventPosition < 0 || eventPosition > 100) return null;

  return (
    <div
      className="absolute top-0 w-1 h-full opacity-70 hover:opacity-100 cursor-pointer transition-opacity"
      style={{
        left: `${eventPosition}%`,
        backgroundColor: color,
      }}
      title={`${event.type} at tick ${event.tick}`}
    />
  );
});

export function ReplayTimeline() {
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);

  const { current, total, percentage } = usePlaybackProgress();
  const {
    roundMetadata,
    events,
    currentTick,
    tickRate,
    sampleInterval,
    seek,
    pause,
  } = useReplayStore();

  const startTick = roundMetadata?.startTick ?? 0;
  const endTick = roundMetadata?.endTick ?? 0;
  const totalTicks = endTick - startTick;

  // Format time from tick
  const formatTime = useCallback(
    (tick: number) => {
      const seconds = (tick - startTick) / tickRate;
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.floor(seconds % 60);
      return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
    },
    [startTick, tickRate],
  );

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

  // Handle drag start
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

  // Handle hover
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!progressBarRef.current || isDragging) return;

      const rect = progressBarRef.current.getBoundingClientRect();
      const position = (e.clientX - rect.left) / rect.width;
      setHoverPosition(Math.max(0, Math.min(1, position)));
    },
    [isDragging],
  );

  const handleMouseLeave = useCallback(() => {
    if (!isDragging) {
      setHoverPosition(null);
    }
  }, [isDragging]);

  // Calculate hover tick
  const hoverTick =
    hoverPosition !== null
      ? Math.floor(startTick + hoverPosition * totalTicks)
      : null;

  // Current time display
  const currentTime = formatTime(currentTick);
  const totalTime = formatTime(endTick);

  return (
    <div className="w-full space-y-2">
      {/* Time display */}
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>{currentTime}</span>
        <span className="text-xs">
          Tick {currentTick} | Frame {current + 1}/{total}
        </span>
        <span>{totalTime}</span>
      </div>

      {/* Progress bar */}
      <div
        ref={progressBarRef}
        className={cn(
          "relative h-3 bg-secondary rounded-full cursor-pointer",
          "transition-all hover:h-4",
          isDragging && "h-4",
        )}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Event markers */}
        <div className="absolute inset-0 overflow-hidden rounded-full">
          {events
            .filter((e) => e.type === "KILL" || e.type.startsWith("BOMB"))
            .map((event, index) => (
              <EventMarker
                key={`${event.id}-${event.tick}-${index}`}
                event={event}
                startTick={startTick}
                endTick={endTick}
              />
            ))}
        </div>

        {/* Progress fill */}
        <div
          className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />

        {/* Scrubber handle */}
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 -translate-x-1/2",
            "w-4 h-4 bg-primary rounded-full border-2 border-background",
            "transition-transform",
            isDragging && "scale-125",
          )}
          style={{ left: `${percentage}%` }}
        />

        {/* Hover preview */}
        {hoverPosition !== null && hoverTick !== null && (
          <div
            className="absolute bottom-full mb-2 -translate-x-1/2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-md whitespace-nowrap"
            style={{ left: `${hoverPosition * 100}%` }}
          >
            {formatTime(hoverTick)} (tick {hoverTick})
          </div>
        )}
      </div>

      {/* Round info */}
      {roundMetadata && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            Round {roundMetadata.roundNumber} | {roundMetadata.ctTeam.name} vs{" "}
            {roundMetadata.tTeam.name}
          </span>
          <span>
            Winner: {roundMetadata.winnerTeam === 3 ? "CT" : "T"} (
            {roundMetadata.winReason})
          </span>
        </div>
      )}
    </div>
  );
}

export default ReplayTimeline;
