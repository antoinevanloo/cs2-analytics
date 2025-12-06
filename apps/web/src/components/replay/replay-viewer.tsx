"use client";

/**
 * ReplayViewer - Main container for 2D replay visualization
 *
 * Features:
 * - Responsive canvas sizing
 * - Loading states with clear feedback
 * - Error handling with actionable recovery
 * - Re-parse support for demos without tick data
 * - Player list sidebar
 * - Round selector
 *
 * UX Considerations:
 * - Clear feedback during loading/parsing states
 * - Actionable buttons for recovery (retry, re-parse)
 * - Mobile-responsive layout
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, AlertCircle, RefreshCw, Sparkles, CheckCircle2 } from "lucide-react";
import { useReplayStore, useReplayLoaded } from "@/stores/replay-store";
import { useReplay, useRoundsMetadata } from "@/hooks/use-replay";
import { useAuthStore } from "@/stores/auth-store";
import { useReplayAnimation } from "@/hooks/use-replay-animation";
import { ReplayCanvas } from "./replay-canvas";
import { ReplayControls } from "./replay-controls";
import { ReplayTimeline } from "./replay-timeline";
import { ReplayPlayerList } from "./replay-player-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// API base URL from environment (matches use-replay.ts)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface ReplayViewerProps {
  demoId: string;
  initialRoundNumber?: number;
  mapName?: string;
  className?: string;
}

// Re-parse status type
type ReparseStatus = "idle" | "loading" | "parsing" | "success" | "error";

export function ReplayViewer({
  demoId,
  initialRoundNumber = 1,
  mapName,
  className,
}: ReplayViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [selectedRound, setSelectedRound] = useState(initialRoundNumber);

  // Re-parse state
  const [reparseStatus, setReparseStatus] = useState<ReparseStatus>("idle");
  const [reparseError, setReparseError] = useState<string | null>(null);

  const { playbackState, error } = useReplayStore();
  const isLoaded = useReplayLoaded();

  // Start animation loop when playing
  useReplayAnimation();

  // Fetch rounds metadata for round selector
  const { data: rounds, isLoading: isLoadingRounds } =
    useRoundsMetadata(demoId);

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

  // Resize observer for responsive canvas
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        // Maintain aspect ratio (radar images are typically 1024x1024)
        const size = Math.min(width, height - 100); // Leave room for controls
        setCanvasSize({ width: size, height: size });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Handle round change
  const handleRoundChange = (value: string) => {
    setSelectedRound(parseInt(value, 10));
  };

  // Handle re-parse request
  const handleReparse = useCallback(async () => {
    setReparseStatus("loading");
    setReparseError(null);

    try {
      // Get auth token using the same method as other API calls
      const token = await useAuthStore.getState().getValidAccessToken();
      const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await fetch(`${API_BASE_URL}/v1/demos/${demoId}/reparse`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        credentials: "include",
        body: JSON.stringify({}), // Use default 'replay' profile
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Request failed" }));
        throw new Error(errorData.message || `Re-parse failed: ${response.status}`);
      }

      setReparseStatus("parsing");

      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          // Get fresh token for each poll request
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
              // Refetch replay data after a short delay
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
          // Ignore polling errors, continue trying
        }
      }, 3000); // Poll every 3 seconds

      // Clear interval after 5 minutes (timeout)
      setTimeout(() => {
        clearInterval(pollInterval);
      }, 5 * 60 * 1000);

    } catch (err) {
      setReparseStatus("error");
      setReparseError(err instanceof Error ? err.message : "An error occurred");
    }
  }, [demoId, refetch]);

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
                <p className="text-xs text-center text-muted-foreground">
                  You can leave this page - we&apos;ll notify you when it&apos;s ready.
                </p>
              </>
            ) : reparseStatus === "success" ? (
              <p className="text-sm text-muted-foreground text-center">
                Tick data extracted successfully! Loading replay...
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground text-center">
                  This demo was parsed without tick data, which is needed for the
                  2D replay viewer. Click below to extract tick data.
                </p>

                {reparseError && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{reparseError}</AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-col gap-2">
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

                  <p className="text-xs text-center text-muted-foreground">
                    This will extract position data for all players at ~16fps.
                    Takes about 1-3 minutes depending on match length.
                  </p>
                </div>
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
        "flex flex-col lg:flex-row gap-4 w-full h-full min-h-[600px]",
        className,
      )}
    >
      {/* Main content area */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Round selector */}
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">Round:</span>
          <Select
            value={selectedRound.toString()}
            onValueChange={handleRoundChange}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rounds?.map((round) => (
                <SelectItem
                  key={round.roundNumber}
                  value={round.roundNumber.toString()}
                >
                  Round {round.roundNumber} ({round.ctScore}-{round.tScore})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading round...
            </div>
          )}
        </div>

        {/* Canvas */}
        <Card className="flex-1 overflow-hidden">
          <CardContent className="p-0 flex items-center justify-center bg-background/50">
            {isLoading ? (
              <div className="flex flex-col items-center gap-4 py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-muted-foreground">
                  Loading replay frames...
                </span>
              </div>
            ) : (
              <ReplayCanvas
                width={canvasSize.width}
                height={canvasSize.height}
              />
            )}
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardContent className="p-4">
            <ReplayTimeline />
          </CardContent>
        </Card>

        {/* Controls */}
        <div className="flex justify-center">
          <ReplayControls />
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-full lg:w-64 flex flex-col gap-4">
        <ReplayPlayerList />
      </div>
    </div>
  );
}

export default ReplayViewer;
