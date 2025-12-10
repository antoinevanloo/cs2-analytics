"use client";

/**
 * ReplayControls - Playback control buttons and speed selector
 *
 * Features:
 * - Play/Pause toggle
 * - Frame stepping (forward/backward)
 * - Skip forward/backward (5s, 10s)
 * - Playback speed selector
 * - Overlay toggles (hidden on small screens - use Settings popover instead)
 *
 * Responsive behavior:
 * - sm (<640px): Play controls + speed only
 * - md+ (640px+): Full controls with overlay toggles
 *
 * Keyboard shortcuts handled here:
 * - Space: Play/Pause
 * - Arrow keys: Frame stepping
 * - Shift+Arrow: 10s skip
 * - 1-5: Speed presets
 * - K/G/N/H/R: Overlay toggles
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Eye,
  Target,
  Skull,
  MessageSquare,
  Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useReplayStore,
  useIsPlaying,
  PLAYBACK_SPEEDS,
  type PlaybackSpeed,
} from "@/stores/replay-store";
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

interface ReplayControlsProps {
  className?: string;
}

export function ReplayControls({ className }: ReplayControlsProps) {
  const isPlaying = useIsPlaying();
  const [showOverlayToggles, setShowOverlayToggles] = useState(true);

  // Auto-detect if we should show overlay toggles based on screen width
  useEffect(() => {
    const updateShowOverlays = () => {
      setShowOverlayToggles(window.innerWidth >= 640);
    };

    updateShowOverlays();
    window.addEventListener("resize", updateShowOverlays);
    return () => window.removeEventListener("resize", updateShowOverlays);
  }, []);

  const {
    playbackState,
    playbackSpeed,
    showKillLines,
    showGrenades,
    showPlayerNames,
    showHealthBars,
    showTrails,
    togglePlay,
    nextFrame,
    previousFrame,
    skipForward,
    skipBackward,
    setPlaybackSpeed,
    toggleKillLines,
    toggleGrenades,
    toggleTrajectories,
    togglePlayerNames,
    toggleHealthBars,
    toggleTrails,
    resetViewport,
  } = useReplayStore();

  const isDisabled = playbackState === "loading" || playbackState === "idle";

  // Handle speed change
  const handleSpeedChange = useCallback(
    (value: string) => {
      setPlaybackSpeed(parseFloat(value) as PlaybackSpeed);
    },
    [setPlaybackSpeed],
  );

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.code) {
        case "Space":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (e.shiftKey) {
            skipBackward(10);
          } else if (e.ctrlKey || e.metaKey) {
            skipBackward(5);
          } else {
            previousFrame();
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (e.shiftKey) {
            skipForward(10);
          } else if (e.ctrlKey || e.metaKey) {
            skipForward(5);
          } else {
            nextFrame();
          }
          break;
        case "Digit1":
          e.preventDefault();
          setPlaybackSpeed(0.25);
          break;
        case "Digit2":
          e.preventDefault();
          setPlaybackSpeed(0.5);
          break;
        case "Digit3":
          e.preventDefault();
          setPlaybackSpeed(1);
          break;
        case "Digit4":
          e.preventDefault();
          setPlaybackSpeed(2);
          break;
        case "Digit5":
          e.preventDefault();
          setPlaybackSpeed(4);
          break;
        case "KeyK":
          e.preventDefault();
          toggleKillLines();
          break;
        case "KeyG":
          e.preventDefault();
          toggleGrenades();
          break;
        case "KeyJ":
          e.preventDefault();
          toggleTrajectories();
          break;
        case "KeyN":
          e.preventDefault();
          togglePlayerNames();
          break;
        case "KeyH":
          e.preventDefault();
          toggleHealthBars();
          break;
        case "KeyT":
          e.preventDefault();
          toggleTrails();
          break;
        case "KeyR":
          e.preventDefault();
          resetViewport();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    togglePlay,
    nextFrame,
    previousFrame,
    skipForward,
    skipBackward,
    setPlaybackSpeed,
    toggleKillLines,
    toggleGrenades,
    toggleTrajectories,
    togglePlayerNames,
    toggleHealthBars,
    toggleTrails,
    resetViewport,
  ]);

  return (
    <TooltipProvider>
      <div className={cn(
        "flex items-center gap-2 sm:gap-4 p-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border rounded-lg",
        className
      )}>
        {/* Playback controls */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => skipBackward(10)}
                disabled={isDisabled}
              >
                <SkipBack className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Skip back 10s (Shift+←)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={previousFrame}
                disabled={isDisabled}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Previous frame (←)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="icon"
                onClick={togglePlay}
                disabled={isDisabled}
                className="h-10 w-10"
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5 ml-0.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isPlaying ? "Pause" : "Play"} (Space)
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={nextFrame}
                disabled={isDisabled}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Next frame (→)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => skipForward(10)}
                disabled={isDisabled}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Skip forward 10s (Shift+→)</TooltipContent>
          </Tooltip>
        </div>

        {/* Speed selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Speed:</span>
          <Select
            value={playbackSpeed.toString()}
            onValueChange={handleSpeedChange}
            disabled={isDisabled}
          >
            <SelectTrigger className="w-20 h-8">
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

        {/* Overlay toggles - hidden on small screens (use Settings popover) */}
        {showOverlayToggles && (
          <>
            {/* Divider */}
            <div className="h-6 w-px bg-border" />

            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showKillLines ? "secondary" : "ghost"}
                    size="icon"
                    onClick={toggleKillLines}
                    disabled={isDisabled}
                  >
                    <Skull className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle kill lines (K)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showGrenades ? "secondary" : "ghost"}
                    size="icon"
                    onClick={toggleGrenades}
                    disabled={isDisabled}
                  >
                    <Target className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle grenades (G)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showPlayerNames ? "secondary" : "ghost"}
                    size="icon"
                    onClick={togglePlayerNames}
                    disabled={isDisabled}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle player names (N)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showHealthBars ? "secondary" : "ghost"}
                    size="icon"
                    onClick={toggleHealthBars}
                    disabled={isDisabled}
                  >
                    <Heart className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle health bars (H)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={resetViewport}
                    disabled={isDisabled}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset zoom (R)</TooltipContent>
              </Tooltip>
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}

export default ReplayControls;
