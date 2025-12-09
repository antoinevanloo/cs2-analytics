"use client";

/**
 * ReplayViewerEnhanced - Improved 2D replay visualization with gamified UX
 *
 * ## Design Checklist
 * ✓ Extensibility: Modular components, easy to add new features
 * ✓ Scalability: Memoized components, efficient re-renders
 * ✓ Exhaustivity: All player/event info visible
 * ✓ Performance: 60fps canvas, optimized React rendering
 * ✓ Stability: Error handling, loading states
 * ✓ Resilience: Graceful degradation, retry mechanisms
 * ✓ Gamification: Kill feed, visual feedback, progression feel
 * ✓ Paramètrable: All display elements configurable
 * ✓ Mobile-ready: Responsive layout for 13" screens and below
 *
 * ## Personas supported
 * - Gamer: Quick round navigation, kill feed, intuitive controls
 * - Analyst: Full player stats visible, timeline with events
 * - Coach/Recruiter: Team economy overview, round-by-round analysis
 *
 * ## Responsive breakpoints
 * - xl (1280px+): Full layout with sidebar
 * - lg (1024px): Compact sidebar
 * - md (768px): No sidebar, collapsible roster below
 * - sm (640px): Minimal UI, essential info only
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Users,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useReplayStore, useReplayLoaded, getRadarImageUrl } from "@/stores/replay-store";
import { useReplay, useRoundsMetadata } from "@/hooks/use-replay";
import { useAuthStore } from "@/stores/auth-store";
import { useReplayAnimation } from "@/hooks/use-replay-animation";
import { ReplayCanvas } from "./replay-canvas";
import { ReplayControls } from "./replay-controls";
import { EnhancedTimeline } from "./enhanced-timeline";
import { RosterPanel } from "./roster-panel";
import { KillFeed } from "./kill-feed";
import { RoundHeader } from "./round-header";
import { SettingsPanel } from "./settings-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface ReplayViewerEnhancedProps {
  demoId: string;
  initialRoundNumber?: number;
  mapName?: string;
  className?: string;
}

type ReparseStatus = "idle" | "loading" | "parsing" | "success" | "error";

// Custom hook to detect screen size
function useScreenSize() {
  const [screenSize, setScreenSize] = useState<"sm" | "md" | "lg" | "xl">("xl");

  useEffect(() => {
    const updateSize = () => {
      const width = window.innerWidth;
      if (width < 768) setScreenSize("sm");
      else if (width < 1024) setScreenSize("md");
      else if (width < 1280) setScreenSize("lg");
      else setScreenSize("xl");
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  return screenSize;
}

export function ReplayViewerEnhanced({
  demoId,
  initialRoundNumber = 1,
  mapName,
  className,
}: ReplayViewerEnhancedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 500, height: 500 });
  const [selectedRound, setSelectedRound] = useState(initialRoundNumber);
  const [rosterOpen, setRosterOpen] = useState(false);
  const screenSize = useScreenSize();

  // Re-parse state
  const [reparseStatus, setReparseStatus] = useState<ReparseStatus>("idle");
  const [reparseError, setReparseError] = useState<string | null>(null);

  const { playbackState, error, mapConfig } = useReplayStore();
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

  // Resize observer for responsive canvas
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;

        // Calculate available space based on screen size
        let sidebarWidth = 0;
        if (screenSize === "xl") sidebarWidth = 280;
        else if (screenSize === "lg") sidebarWidth = 240;

        const availableWidth = width - sidebarWidth - 32; // 32px for padding
        const availableHeight = height - 200; // Reserve for header/controls

        // Canvas should be square and fit in available space
        const size = Math.min(availableWidth, availableHeight, 800);
        setCanvasSize({
          width: Math.max(300, size),
          height: Math.max(300, size)
        });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [screenSize]);

  // Handle round change
  const handleRoundChange = (value: string) => {
    setSelectedRound(parseInt(value, 10));
  };

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

  // Loading state
  if (isCheckingAvailability || isLoadingRounds) {
    return (
      <div className={cn("flex items-center justify-center h-full min-h-[500px]", className)}>
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
      <div className={cn("flex items-center justify-center h-full p-4", className)}>
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 space-y-4 text-center">
            {reparseStatus === "success" ? (
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
            ) : reparseStatus === "parsing" ? (
              <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
            ) : (
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
            )}

            <h2 className="text-xl font-semibold">
              {reparseStatus === "parsing"
                ? "Re-parsing in Progress..."
                : reparseStatus === "success"
                  ? "Re-parse Complete!"
                  : "2D Replay Not Available"}
            </h2>

            {reparseStatus === "parsing" ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Extracting tick data for smooth 2D replay visualization.
                </p>
                <Progress value={undefined} className="h-2" />
              </>
            ) : reparseStatus === "success" ? (
              <p className="text-sm text-muted-foreground">
                Loading replay...
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  This demo needs tick data extraction for 2D replay.
                </p>

                {reparseError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{reparseError}</AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={handleReparse}
                  disabled={reparseStatus === "loading"}
                  size="lg"
                  className="w-full"
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
          <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </Alert>
      </div>
    );
  }

  // Determine if we should show sidebar or collapsible roster
  const showSidebar = screenSize === "xl" || screenSize === "lg";

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col h-full bg-background",
        // Responsive min-height
        screenSize === "sm" ? "min-h-[500px]" : "min-h-[600px]",
        className
      )}
    >
      {/* Top bar: Round selector + Settings - Compact on small screens */}
      <div className="flex items-center justify-between px-2 sm:px-4 py-2 border-b bg-card/50">
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Round selector */}
          <Select value={selectedRound.toString()} onValueChange={handleRoundChange}>
            <SelectTrigger className="w-24 sm:w-32 h-8 text-xs sm:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rounds?.map((round) => (
                <SelectItem key={round.roundNumber} value={round.roundNumber.toString()}>
                  R{round.roundNumber} ({round.ctScore}-{round.tScore})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Settings - Only popover, no duplicate controls */}
        <SettingsPanel variant="popover" />
      </div>

      {/* Round header - Simplified on small screens */}
      {screenSize !== "sm" && (
        <div className="px-2 sm:px-4 py-2 border-b bg-gradient-to-b from-card/80 to-transparent">
          <RoundHeader />
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col xl:flex-row gap-2 sm:gap-4 p-2 sm:p-4 overflow-hidden">
        {/* Left sidebar: Roster - Only on large screens */}
        {showSidebar && (
          <div className={cn(
            "flex-shrink-0 overflow-y-auto",
            screenSize === "xl" ? "w-72" : "w-60"
          )}>
            <RosterPanel />
          </div>
        )}

        {/* Center: Canvas + Timeline + Controls */}
        <div className="flex-1 flex flex-col gap-2 sm:gap-3 min-w-0">
          {/* Canvas container with kill feed overlay */}
          <div className="relative flex-1 flex items-center justify-center bg-black/20 rounded-lg sm:rounded-xl overflow-hidden min-h-[300px]">
            {isLoading ? (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-muted-foreground text-sm">Loading frames...</span>
              </div>
            ) : (
              <>
                <ReplayCanvas
                  width={canvasSize.width}
                  height={canvasSize.height}
                  radarImageUrl={mapConfig?.mapName ? getRadarImageUrl(mapConfig.mapName) : undefined}
                />
                {/* Kill feed overlay */}
                <KillFeed position={screenSize === "sm" ? "top-left" : "top-right"} />
              </>
            )}
          </div>

          {/* Timeline - Compact on mobile */}
          <Card className="flex-shrink-0">
            <CardContent className="p-2 sm:p-4">
              <EnhancedTimeline />
            </CardContent>
          </Card>

          {/* Playback controls */}
          <div className="flex justify-center flex-shrink-0">
            <ReplayControls />
          </div>
        </div>
      </div>

      {/* Collapsible roster for smaller screens */}
      {!showSidebar && (
        <Collapsible open={rosterOpen} onOpenChange={setRosterOpen}>
          <div className="border-t bg-card/50">
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between px-4 py-2 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Players</span>
                </div>
                {rosterOpen ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-2 pb-2 max-h-64 overflow-y-auto">
                <RosterPanel compact />
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}
    </div>
  );
}

export default ReplayViewerEnhanced;
