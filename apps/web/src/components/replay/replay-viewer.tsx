"use client";

/**
 * ReplayViewer - Main container for 2D replay visualization
 *
 * Features:
 * - Responsive canvas sizing
 * - Loading states
 * - Error handling
 * - Player list sidebar
 * - Round selector
 */

import React, { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { useReplayStore, useReplayLoaded } from "@/stores/replay-store";
import { useReplay, useRoundsMetadata } from "@/hooks/use-replay";
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
import { cn } from "@/lib/utils";

interface ReplayViewerProps {
  demoId: string;
  initialRoundNumber?: number;
  mapName?: string;
  className?: string;
}

export function ReplayViewer({
  demoId,
  initialRoundNumber = 1,
  mapName,
  className,
}: ReplayViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [selectedRound, setSelectedRound] = useState(initialRoundNumber);

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

  // Unavailable state
  if (!isAvailable) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Replay Unavailable</AlertTitle>
          <AlertDescription>
            Tick data is not available for this demo. The demo may need to be
            re-parsed with tick extraction enabled.
          </AlertDescription>
        </Alert>
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
