"use client";

/**
 * EnhancedTimeline - Advanced timeline with event markers and round navigation
 *
 * Features:
 * - Visual round markers (like CS Demo Manager)
 * - Event type indicators with colors:
 *   - Kills (red dots)
 *   - Bomb events (yellow for plant, green for defuse)
 *   - Grenades (orange dots)
 * - Hover preview showing event details
 * - Click to jump to specific events
 * - Current time and remaining time display
 *
 * Design checklist:
 * - Extensible: New event types easily added
 * - Performance: Memoized markers, efficient rendering
 * - Gamification: Visual event highlights, dopamine on kills
 * - Mobile-ready: Touch-friendly controls
 */

import React, { useCallback, useRef, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  useReplayStore,
  usePlaybackProgress,
  isGrenadeEvent,
  isKillEvent,
  isBombEvent,
  type ReplayEvent,
  type ReplayEventType,
  type KillEvent,
  type BombEvent,
} from "@/stores/replay-store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Event type configuration
interface EventTypeConfig {
  color: string;
  bgColor: string;
  label: string;
  icon: string;
  priority: number; // Higher = rendered on top
}

const EVENT_CONFIG: Record<string, EventTypeConfig> = {
  KILL: {
    color: "#ef4444",
    bgColor: "bg-red-500",
    label: "Kill",
    icon: "☠",
    priority: 10,
  },
  BOMB_PLANT: {
    color: "#f59e0b",
    bgColor: "bg-amber-500",
    label: "Bomb Planted",
    icon: "💣",
    priority: 9,
  },
  BOMB_BEGIN_PLANT: {
    color: "#d97706",
    bgColor: "bg-amber-600",
    label: "Planting...",
    icon: "⏳",
    priority: 7,
  },
  BOMB_DEFUSE: {
    color: "#22c55e",
    bgColor: "bg-green-500",
    label: "Bomb Defused",
    icon: "✓",
    priority: 9,
  },
  BOMB_BEGIN_DEFUSE: {
    color: "#16a34a",
    bgColor: "bg-green-600",
    label: "Defusing...",
    icon: "⏳",
    priority: 7,
  },
  BOMB_EXPLODE: {
    color: "#dc2626",
    bgColor: "bg-red-600",
    label: "Bomb Exploded",
    icon: "💥",
    priority: 9,
  },
  SMOKE_START: {
    color: "#9ca3af",
    bgColor: "bg-gray-400",
    label: "Smoke",
    icon: "💨",
    priority: 5,
  },
  SMOKE_END: {
    color: "#6b7280",
    bgColor: "bg-gray-500",
    label: "Smoke Expired",
    icon: "💨",
    priority: 3,
  },
  MOLOTOV_START: {
    color: "#f97316",
    bgColor: "bg-orange-500",
    label: "Molotov",
    icon: "🔥",
    priority: 5,
  },
  MOLOTOV_END: {
    color: "#ea580c",
    bgColor: "bg-orange-600",
    label: "Fire Out",
    icon: "🔥",
    priority: 3,
  },
  HE_EXPLODE: {
    color: "#ef4444",
    bgColor: "bg-red-500",
    label: "HE Grenade",
    icon: "💥",
    priority: 5,
  },
  FLASH_EFFECT: {
    color: "#fde047",
    bgColor: "bg-yellow-300",
    label: "Flashbang",
    icon: "⚡",
    priority: 5,
  },
  GRENADE_THROW: {
    color: "#a3a3a3",
    bgColor: "bg-neutral-400",
    label: "Grenade Thrown",
    icon: "🎯",
    priority: 4,
  },
  GRENADE: {
    color: "#f97316",
    bgColor: "bg-orange-500",
    label: "Grenade",
    icon: "○",
    priority: 4,
  },
  DECOY_START: {
    color: "#22c55e",
    bgColor: "bg-green-500",
    label: "Decoy",
    icon: "📢",
    priority: 3,
  },
};

// Weapon category icons for kill events
const WEAPON_CATEGORY_ICONS: Record<string, string> = {
  // Pistols
  glock: "🔫",
  usp_silencer: "🔫",
  hkp2000: "🔫",
  p250: "🔫",
  elite: "🔫",
  fiveseven: "🔫",
  tec9: "🔫",
  cz75a: "🔫",
  deagle: "🦅",
  revolver: "🎰",

  // SMGs
  mac10: "⚡",
  mp9: "⚡",
  mp7: "⚡",
  mp5sd: "⚡",
  ump45: "⚡",
  p90: "⚡",
  bizon: "⚡",

  // Rifles
  famas: "🎯",
  galilar: "🎯",
  ak47: "💀",
  m4a1: "🎯",
  m4a1_silencer: "🎯",
  sg556: "🔭",
  aug: "🔭",

  // Snipers
  ssg08: "🎯",
  awp: "⚡",
  g3sg1: "🔭",
  scar20: "🔭",

  // Shotguns
  nova: "💨",
  xm1014: "💨",
  sawedoff: "💨",
  mag7: "💨",

  // Machine guns
  m249: "🔥",
  negev: "🔥",

  // Other
  knife: "🔪",
  taser: "⚡",
  hegrenade: "💥",
  molotov: "🔥",
  incgrenade: "🔥",
  inferno: "🔥",
};

/**
 * Get weapon icon from weapon name
 */
function getWeaponIcon(weapon: string): string {
  const normalized = weapon.replace("weapon_", "").toLowerCase();
  return WEAPON_CATEGORY_ICONS[normalized] || "☠";
}

// Get config for event type with fallback
function getEventConfig(type: ReplayEventType | string): EventTypeConfig {
  return (
    EVENT_CONFIG[type] || {
      color: "#6b7280",
      bgColor: "bg-gray-500",
      label: type,
      icon: "•",
      priority: 1,
    }
  );
}

interface TimelineMarkerProps {
  event: ReplayEvent;
  position: number; // 0-100 percentage
  onSeek: (tick: number) => void;
}

const TimelineMarker = React.memo(function TimelineMarker({
  event,
  position,
  onSeek,
}: TimelineMarkerProps) {
  const config = getEventConfig(event.type);

  // Determine if this is a kill event for special rendering
  const killEvent = isKillEvent(event) ? event : null;
  const isHeadshot = killEvent?.headshot ?? false;
  const isSpecialKill = killEvent?.noscope || killEvent?.thrusmoke || killEvent?.wallbang;

  // Get event details for tooltip
  const getEventDetails = (): React.ReactNode => {
    if (killEvent) {
      const attacker = killEvent.attackerName || "Unknown";
      const victim = killEvent.victimName || "Unknown";
      const weapon = (killEvent.weapon || "").replace("weapon_", "");
      const badges: string[] = [];
      if (killEvent.headshot) badges.push("🎯 HS");
      if (killEvent.noscope) badges.push("🚫 Noscope");
      if (killEvent.thrusmoke) badges.push("💨 Thru smoke");
      if (killEvent.wallbang) badges.push("🧱 Wallbang");

      return (
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <span className="text-red-400">{attacker}</span>
            <span className="text-muted-foreground">→</span>
            <span className="text-blue-400">{victim}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-1.5 py-0.5 bg-muted rounded">{weapon}</span>
            {badges.map((badge, i) => (
              <span key={i} className="text-yellow-400">{badge}</span>
            ))}
          </div>
        </div>
      );
    }

    if (isBombEvent(event)) {
      const player = event.playerName || "Unknown";
      const site = event.site ? ` at ${event.site}` : "";
      if (event.type === "BOMB_PLANT") {
        return `${player} planted the bomb${site}`;
      }
      if (event.type === "BOMB_DEFUSE") {
        return `${player} defused the bomb`;
      }
      if (event.type === "BOMB_BEGIN_PLANT") {
        return `${player} started planting${site}`;
      }
      if (event.type === "BOMB_BEGIN_DEFUSE") {
        return `${player} started defusing`;
      }
      return "Bomb exploded";
    }

    return config.label;
  };

  // Determine marker style based on event type
  const getMarkerStyle = (): { width: string; height: string; borderRadius: string } => {
    if (killEvent) {
      // Kills are larger, headshots even larger
      return {
        width: isHeadshot ? "10px" : "8px",
        height: isHeadshot ? "10px" : "8px",
        borderRadius: "50%",
      };
    }
    if (event.type.startsWith("BOMB")) {
      // Bomb events are square-ish
      return { width: "8px", height: "8px", borderRadius: "2px" };
    }
    // Default: small circle
    return { width: "6px", height: "6px", borderRadius: "50%" };
  };

  const markerStyle = getMarkerStyle();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={cn(
              "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-pointer",
              "transition-all duration-150 hover:scale-150 hover:z-20",
              "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
              // Headshot kills get a pulsing animation
              isHeadshot && "animate-pulse"
            )}
            style={{
              left: `${position}%`,
              zIndex: config.priority + (isHeadshot ? 5 : 0) + (isSpecialKill ? 3 : 0),
            }}
            onClick={() => onSeek(event.tick)}
          >
            <div
              className={cn(
                "opacity-90 hover:opacity-100",
                config.bgColor,
                // Special kills get a ring
                isSpecialKill && "ring-2 ring-yellow-400 ring-offset-1 ring-offset-background"
              )}
              style={markerStyle}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">
                {killEvent ? getWeaponIcon(killEvent.weapon || "") : config.icon}
              </span>
              <span className="font-medium">{config.label}</span>
            </div>
            <div className="text-xs text-muted-foreground">{getEventDetails()}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

interface EnhancedTimelineProps {
  className?: string;
  showEventMarkers?: boolean;
}

export function EnhancedTimeline({
  className,
  showEventMarkers = true,
}: EnhancedTimelineProps) {
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverPosition, setHoverPosition] = useState<number | null>(null);

  const { current, total, percentage } = usePlaybackProgress();
  const {
    roundMetadata,
    events,
    currentTick,
    tickRate,
    showKillLines,
    showGrenades,
    seek,
    seekToTick,
    pause,
  } = useReplayStore();

  const startTick = roundMetadata?.startTick ?? 0;
  const endTick = roundMetadata?.endTick ?? 0;
  const totalTicks = endTick - startTick;

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

  // Filter and process events for timeline
  const timelineEvents = useMemo(() => {
    if (!events || !showEventMarkers) return [];

    return events
      .filter((event) => {
        // Always show kills and bomb events
        if (event.type === "KILL") return showKillLines;
        if (event.type.startsWith("BOMB")) return true;
        // Show grenades if enabled
        if (isGrenadeEvent(event.type)) return showGrenades;
        return false;
      })
      .map((event) => ({
        ...event,
        position: totalTicks > 0 ? ((event.tick - startTick) / totalTicks) * 100 : 0,
      }))
      .filter((event) => event.position >= 0 && event.position <= 100);
  }, [events, showEventMarkers, showKillLines, showGrenades, startTick, totalTicks]);

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
    [getFrameIndexFromPosition, seek, pause]
  );

  // Handle hover
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!progressBarRef.current || isDragging) return;

      const rect = progressBarRef.current.getBoundingClientRect();
      const position = (e.clientX - rect.left) / rect.width;
      setHoverPosition(Math.max(0, Math.min(1, position)));
    },
    [isDragging]
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

  // Current and total time display
  const currentTime = formatTime(currentTick);
  const totalTime = formatTime(endTick);
  const remainingSeconds = Math.max(0, (endTick - currentTick) / tickRate);
  const remainingTime = `-${Math.floor(remainingSeconds / 60)}:${Math.floor(remainingSeconds % 60)
    .toString()
    .padStart(2, "0")}`;

  // Count events by type for legend
  const eventCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    timelineEvents.forEach((event) => {
      const type = event.type === "KILL" ? "KILL" : event.type.startsWith("BOMB") ? "BOMB" : "GRENADE";
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  }, [timelineEvents]);

  return (
    <div className={cn("w-full space-y-2", className)}>
      {/* Time display row */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-mono tabular-nums text-foreground">{currentTime}</span>

        {/* Event legend */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {eventCounts.KILL && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span>{eventCounts.KILL} kills</span>
            </div>
          )}
          {eventCounts.BOMB && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span>bomb</span>
            </div>
          )}
          {eventCounts.GRENADE && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              <span>{eventCounts.GRENADE} nades</span>
            </div>
          )}
        </div>

        <span className="font-mono tabular-nums text-muted-foreground">
          {remainingTime}
        </span>
      </div>

      {/* Progress bar with event markers */}
      <div
        ref={progressBarRef}
        className={cn(
          "relative h-6 bg-secondary/50 rounded-lg cursor-pointer overflow-visible",
          "border border-border/50",
          "transition-all hover:h-7",
          isDragging && "h-7"
        )}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Background track */}
        <div className="absolute inset-0 rounded-lg overflow-hidden">
          {/* Gradient background showing progress */}
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary/80 to-primary/60 transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Event markers */}
        <div className="absolute inset-y-1 left-0 right-0">
          {timelineEvents.map((event, index) => (
            <TimelineMarker
              key={`${event.id}-${event.tick}-${index}`}
              event={event}
              position={event.position}
              onSeek={seekToTick}
            />
          ))}
        </div>

        {/* Scrubber handle */}
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 -translate-x-1/2",
            "w-4 h-4 bg-primary rounded-full",
            "border-2 border-background shadow-lg",
            "transition-transform z-20",
            isDragging && "scale-125"
          )}
          style={{ left: `${percentage}%` }}
        />

        {/* Hover preview */}
        {hoverPosition !== null && hoverTick !== null && !isDragging && (
          <div
            className="absolute bottom-full mb-2 -translate-x-1/2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md shadow-md whitespace-nowrap z-30 border"
            style={{ left: `${hoverPosition * 100}%` }}
          >
            {formatTime(hoverTick)}
          </div>
        )}
      </div>

      {/* Frame/tick info row */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Frame {current + 1}/{total}
        </span>

        {/* Round info */}
        {roundMetadata && (
          <span>
            Round {roundMetadata.roundNumber} •{" "}
            {roundMetadata.winnerTeam === 3 ? "CT" : "T"} win ({roundMetadata.winReason})
          </span>
        )}

        <span>Tick {currentTick}</span>
      </div>
    </div>
  );
}

export default EnhancedTimeline;
