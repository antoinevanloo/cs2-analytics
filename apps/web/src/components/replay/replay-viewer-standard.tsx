"use client";

/**
 * ReplayViewerStandard - Standard layout for "Coach" persona
 *
 * Layout (wireframe reference - Layout B: Mode Standard):
 * ┌────────────────────────────────────────────────────────────────────────┐
 * │ [◀R13▶] │ Round Timer │ CT 8 █ vs █ 5 T │           [Toggles] [⚙]    │ ← 52px
 * ├──────────┬─────────────────────────────────────────────────────────────┤
 * │ CT Team  │                                                             │
 * │ ▓▓▓▓▓▓▓▓ │                                                             │
 * │ ▓▓▓▓▓▓▓▓ │                                                             │
 * │ ▓▓▓▓▓▓▓▓ │                   CANVAS (85%)                              │
 * │ ▓▓▓▓▓▓▓▓ │                                                             │
 * │ ▓▓▓▓▓▓▓▓ │                                                             │
 * │ T Team   │                                                             │
 * │ ▓▓▓▓▓▓▓▓ │                                                             │
 * │ (220px)  │                                                             │
 * ├──────────┴─────────────────────────────────────────────────────────────┤
 * │ 0:32 │════●═════════│ -1:13 │ [◀][▶▶][▶] │ 1x │ [K][G][N][H]          │ ← 64px
 * └────────────────────────────────────────────────────────────────────────┘
 *
 * Features:
 * - Fixed sidebar with full player cards (220px)
 * - Canvas takes remaining space
 * - Header with round selector, timer, scores
 * - Bottom bar with timeline, controls, toggles
 * - Kill feed overlay on canvas
 *
 * Coach-specific:
 * - All player details always visible
 * - Team money and utility totals
 * - Frame-by-frame controls
 * - Quick toggle buttons
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, AlertCircle, RefreshCw, Sparkles, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReplayStore, useReplayLoaded, getRadarImageUrl } from "@/stores/replay-store";
import { useReplay, useRoundsMetadata } from "@/hooks/use-replay";
import { useAuthStore } from "@/stores/auth-store";
import { useReplayAnimation } from "@/hooks/use-replay-animation";
import { useReplayKeyboard } from "@/hooks/use-replay-keyboard";

// Components
import { ReplayCanvas } from "./replay-canvas";
import { StandardHeader } from "./standard-header";
import { StandardSidebar } from "./standard-sidebar";
import { StandardBottomBar } from "./standard-bottom-bar";
import { KillFeed } from "./kill-feed";

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

// API base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface ReplayViewerStandardProps {
  /** Demo ID to load */
  demoId: string;
  /** Initial round to display */
  initialRoundNumber?: number;
  /** Map name (for radar image) */
  mapName?: string;
  /** Additional class names */
  className?: string;
}

// Re-parse status type
type ReparseStatus = "idle" | "loading" | "parsing" | "success" | "error";

/**
 * ReplayViewerStandard - Main component
 */
export function ReplayViewerStandard({
  demoId,
  initialRoundNumber = 1,
  mapName,
  className,
}: ReplayViewerStandardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 600 });
  const [selectedRound, setSelectedRound] = useState(initialRoundNumber);

  // Re-parse state
  const [reparseStatus, setReparseStatus] = useState<ReparseStatus>("idle");
  const [reparseError, setReparseError] = useState<string | null>(null);

  const { playbackState, error, mapConfig, roundMetadata, currentTick, tickRate, frames } = useReplayStore();
  const isLoaded = useReplayLoaded();

  // Start animation loop when playing
  useReplayAnimation();

  // Fetch rounds metadata for round selector
  const { data: rounds, isLoading: isLoadingRounds } = useRoundsMetadata(demoId);

  // Fetch replay data
  const {
    isAvailable,
    isCheckingAvailability,
    isLoading,
    isError,
    error: fetchError,
    refetch,
  } = useReplay({
    demoId,
    roundNumber: selectedRound,
    mapName,
    sampleInterval: 8, // 8 ticks = ~8fps at 64 tick rate
    enabled: !!demoId,
  });

  // Debug log
  console.log("[ReplayViewerStandard] state:", {
    playbackState,
    hasFrames: frames.length > 0,
    isCheckingAvailability,
    isLoading,
    isAvailable,
    isLoaded,
  });

  // Responsive canvas sizing
  useEffect(() => {
    const canvasContainer = canvasContainerRef.current;
    if (!canvasContainer) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        // Use all available space, maintain square aspect ratio
        const size = Math.min(width, height);
        setCanvasSize({ width: size, height: size });
      }
    });

    resizeObserver.observe(canvasContainer);
    return () => resizeObserver.disconnect();
  }, []);

  // Handle round change
  const handleRoundChange = useCallback((round: number) => {
    setSelectedRound(round);
  }, []);

  // Handle re-parse request
  const handleReparse = useCallback(async () => {
    setReparseStatus("loading");
    setReparseError(null);

    try {
      const token = await useAuthStore.getState().getValidAccessToken();
      const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await fetch(`${API_BASE_URL}/v1/demos/${demoId}/reparse`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        credentials: "include",
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Request failed" }));
        throw new Error(errorData.message || `Re-parse failed: ${response.status}`);
      }

      setReparseStatus("parsing");

      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const pollToken = await useAuthStore.getState().getValidAccessToken();
          const pollHeaders: Record<string, string> = pollToken ? { Authorization: `Bearer ${pollToken}` } : {};

          const statusResponse = await fetch(`${API_BASE_URL}/v1/demos/${demoId}/status`, {
            headers: pollHeaders,
            credentials: "include",
          });

          if (statusResponse.ok) {
            const status = await statusResponse.json();

            if (status.status === "COMPLETED" || status.status === "PARSED") {
              clearInterval(pollInterval);
              setReparseStatus("success");
              setTimeout(() => {
                refetch();
                setReparseStatus("idle");
              }, 1500);
            } else if (status.status === "FAILED") {
              clearInterval(pollInterval);
              setReparseStatus("error");
              setReparseError(status.error || "Re-parsing failed");
            }
          }
        } catch {
          // Ignore polling errors
        }
      }, 3000);

      setTimeout(() => {
        clearInterval(pollInterval);
      }, 5 * 60 * 1000);

    } catch (err) {
      setReparseStatus("error");
      setReparseError(err instanceof Error ? err.message : "An error occurred");
    }
  }, [demoId, refetch]);

  // Calculate round time for header
  const roundTime = React.useMemo(() => {
    if (!roundMetadata || tickRate === 0) return undefined;
    const startTick = roundMetadata.startTick ?? 0;
    const seconds = Math.max(0, (currentTick - startTick) / tickRate);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }, [roundMetadata, currentTick, tickRate]);

  // Get scores and team names
  const ctScore = roundMetadata?.ctTeam?.score ?? 0;
  const tScore = roundMetadata?.tTeam?.score ?? 0;
  const ctName = roundMetadata?.ctTeam?.name;
  const tName = roundMetadata?.tTeam?.name;
  const totalRounds = rounds?.length ?? 30;
  const winnerTeam = roundMetadata?.winnerTeam;
  const winReason = roundMetadata?.winReason;

  // Keyboard shortcuts
  const handlePreviousRound = useCallback(() => {
    if (selectedRound > 1) {
      setSelectedRound(selectedRound - 1);
    }
  }, [selectedRound]);

  const handleNextRound = useCallback(() => {
    if (selectedRound < totalRounds) {
      setSelectedRound(selectedRound + 1);
    }
  }, [selectedRound, totalRounds]);

  useReplayKeyboard({
    onPreviousRound: handlePreviousRound,
    onNextRound: handleNextRound,
  });

  // Loading state
  if (isCheckingAvailability || isLoadingRounds) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-muted-foreground">Loading replay data...</span>
        </div>
      </div>
    );
  }

  // Unavailable state - show re-parse option
  if (!isAvailable) {
    return (
      <div className={cn("flex items-center justify-center h-full p-4", className)}>
        <Card className="max-w-md w-full">
          <CardHeader className="text-center pb-2">
            {reparseStatus === "success" ? (
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-2" />
            ) : reparseStatus === "parsing" ? (
              <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin mb-2" />
            ) : (
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            )}
            <CardTitle className="text-xl">
              {reparseStatus === "parsing"
                ? "Re-parsing in Progress..."
                : reparseStatus === "success"
                  ? "Re-parse Complete!"
                  : "2D Replay Not Available"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {reparseStatus === "parsing" ? (
              <>
                <p className="text-sm text-muted-foreground text-center">
                  Extracting tick data for smooth 2D replay visualization.
                  This usually takes 1-3 minutes.
                </p>
                <Progress value={undefined} className="h-2" />
              </>
            ) : reparseStatus === "success" ? (
              <p className="text-sm text-muted-foreground text-center">
                Tick data extracted successfully! Loading replay...
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground text-center">
                  This demo was parsed without tick data. Click below to enable 2D replay.
                </p>

                {reparseError && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{reparseError}</AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={handleReparse}
                  disabled={reparseStatus === "loading"}
                  className="w-full"
                  size="lg"
                >
                  {reparseStatus === "loading" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting re-parse...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Enable 2D Replay
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (isError || error) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Replay</AlertTitle>
          <AlertDescription>
            {fetchError?.message || error || "An unexpected error occurred"}
          </AlertDescription>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => refetch()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </Alert>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col h-full w-full bg-background",
        className
      )}
    >
      {/* Header - 52px */}
      <StandardHeader
        roundNumber={selectedRound}
        totalRounds={totalRounds}
        ctScore={ctScore}
        tScore={tScore}
        ctName={ctName}
        tName={tName}
        roundTime={roundTime}
        winnerTeam={winnerTeam}
        winReason={winReason}
        onRoundChange={handleRoundChange}
      />

      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar - 220px (hidden on small screens) */}
        <div className="hidden lg:block">
          <StandardSidebar className="h-full" />
        </div>

        {/* Canvas area */}
        <div
          ref={canvasContainerRef}
          className="flex-1 relative overflow-hidden bg-background/50"
        >
          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-30">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-muted-foreground">Loading round {selectedRound}...</span>
              </div>
            </div>
          )}

          {/* Canvas - centered */}
          <div className="absolute inset-0 flex items-center justify-center p-2">
            <ReplayCanvas
              width={canvasSize.width}
              height={canvasSize.height}
              radarImageUrl={mapConfig?.mapName ? getRadarImageUrl(mapConfig.mapName) : undefined}
            />
          </div>

          {/* Kill Feed - top-right */}
          <KillFeed
            position="top-right"
            maxEntries={6}
            displayDuration={64 * 5} // 5 seconds
          />
        </div>
      </div>

      {/* Bottom bar - 64px */}
      <StandardBottomBar />
    </div>
  );
}

export default ReplayViewerStandard;
