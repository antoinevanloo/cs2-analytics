"use client";

/**
 * ReplayViewerAnalyse - Analyse layout for "Analyste" persona
 *
 * Layout (wireframe reference - Layout C: Mode Analyse):
 * ┌────────────────────────────────────────────────────────────────────────┐
 * │ [◀R13▶] │ CT 8 vs 5 T │ [Filter ▾] [Player ▾] │                [⚙]    │ ← 48px
 * ├───────────────────────────────────────────────┬────────────────────────┤
 * │                                               │ [Stats][Events][Notes] │
 * │                                               ├────────────────────────┤
 * │              CANVAS (flex-1)                  │                        │
 * │                                               │    Panel Content       │
 * │                                               │       (300px)          │
 * │                                               │                        │
 * ├───────────────────────────────────────────────┴────────────────────────┤
 * │ Main  │════●══════════════════════════════════════════════════════│    │
 * │ Kills │  ●   ●       ●    ●                                       │    │
 * │ Bombs │          ◆                    ◇                           │    │
 * │ Nades │ ○ ○  ○ ○    ○ ○      ○ ○   ○ ○ ○                         │    │
 * │ [◀][▶▶][▶] │ 1x │ 0:32 / 1:45                                     │    │
 * └────────────────────────────────────────────────────────────────────────┘
 *
 * Features:
 * - Grid layout with canvas and side panel
 * - Header with filters (event type, player)
 * - Tabbed side panel (Stats, Events, Notes)
 * - Multi-layer timeline with event tracks
 * - Kill feed overlay on canvas
 *
 * Analyst-specific:
 * - Event filtering and highlighting
 * - Detailed statistics
 * - Multi-track timeline for pattern analysis
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, AlertCircle, RefreshCw, Sparkles, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReplayStore, useReplayLoaded, useCurrentFrame, getRadarImageUrl } from "@/stores/replay-store";
import { useReplay, useRoundsMetadata } from "@/hooks/use-replay";
import { useAuthStore } from "@/stores/auth-store";
import { useReplayAnimation } from "@/hooks/use-replay-animation";
import { useReplayKeyboard } from "@/hooks/use-replay-keyboard";

// Components
import { ReplayCanvas } from "./replay-canvas";
import { AnalyseHeader, type EventFilter } from "./analyse-header";
import { AnalysePanel } from "./analyse-panel";
import { AnalyseTimeline } from "./analyse-timeline";
import { KillFeed } from "./kill-feed";

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

// API base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface ReplayViewerAnalyseProps {
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
 * ReplayViewerAnalyse - Main component
 */
export function ReplayViewerAnalyse({
  demoId,
  initialRoundNumber = 1,
  mapName,
  className,
}: ReplayViewerAnalyseProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 600 });
  const [selectedRound, setSelectedRound] = useState(initialRoundNumber);

  // Filter states
  const [eventFilter, setEventFilter] = useState<EventFilter>("all");
  const [playerFilter, setPlayerFilter] = useState<string | null>(null);

  // Re-parse state
  const [reparseStatus, setReparseStatus] = useState<ReparseStatus>("idle");
  const [reparseError, setReparseError] = useState<string | null>(null);

  const { playbackState, error, mapConfig, roundMetadata, currentTick, tickRate, frames } = useReplayStore();
  const currentFrame = useCurrentFrame();
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
    sampleInterval: 8,
    enabled: !!demoId,
  });

  // Responsive canvas sizing
  useEffect(() => {
    const canvasContainer = canvasContainerRef.current;
    if (!canvasContainer) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
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

  // Get scores and team info
  const ctScore = roundMetadata?.ctTeam?.score ?? 0;
  const tScore = roundMetadata?.tTeam?.score ?? 0;
  const totalRounds = rounds?.length ?? 30;

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

  // Skip loading states if data is already in store
  const hasDataInStore = frames.length > 0 && playbackState !== "idle";

  // Loading state
  if (!hasDataInStore && (isCheckingAvailability || isLoadingRounds)) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-muted-foreground">Loading replay data...</span>
        </div>
      </div>
    );
  }

  // Unavailable state
  if (!hasDataInStore && !isAvailable) {
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
                  Extracting tick data for analysis.
                </p>
                <Progress value={undefined} className="h-2" />
              </>
            ) : reparseStatus === "success" ? (
              <p className="text-sm text-muted-foreground text-center">
                Tick data extracted! Loading...
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground text-center">
                  Enable 2D replay for analysis features.
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
                      Starting...
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
        "grid h-full w-full bg-background",
        "grid-rows-[48px_1fr_auto]",
        "grid-cols-[1fr_300px]",
        className
      )}
    >
      {/* Header - spans full width */}
      <AnalyseHeader
        className="col-span-2"
        roundNumber={selectedRound}
        totalRounds={totalRounds}
        ctScore={ctScore}
        tScore={tScore}
        players={currentFrame?.players}
        eventFilter={eventFilter}
        playerFilter={playerFilter}
        onRoundChange={handleRoundChange}
        onEventFilterChange={setEventFilter}
        onPlayerFilterChange={setPlayerFilter}
      />

      {/* Canvas area */}
      <div
        ref={canvasContainerRef}
        className="relative overflow-hidden bg-background/50"
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
          maxEntries={5}
          displayDuration={64 * 4}
        />
      </div>

      {/* Side panel */}
      <AnalysePanel className="row-span-1" />

      {/* Multi-layer timeline - spans full width */}
      <AnalyseTimeline className="col-span-2" />
    </div>
  );
}

export default ReplayViewerAnalyse;