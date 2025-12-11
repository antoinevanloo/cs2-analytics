"use client";

/**
 * ReplayViewerV2Wrapper - Entry point for V2 replay viewer
 *
 * Wraps the viewer with view mode switching capability.
 * Supports:
 * - compact: Joueur persona (default) - maximized canvas with floating overlays
 * - standard: Coach persona - sidebar with full player cards
 * - analyse: Analyste persona - grid layout with side panel and multi-layer timeline
 * - focus: Recruteur persona - detailed player stats with visual tracking
 */

import React from "react";
import { cn } from "@/lib/utils";
import { useReplayStore, type ViewMode } from "@/stores/replay-store";
import { ReplayViewerCompact } from "./replay-viewer-compact";
import { ReplayViewerStandard } from "./replay-viewer-standard";
import { ReplayViewerAnalyse } from "./replay-viewer-analyse";
import { ReplayViewerFocus } from "./replay-viewer-focus";

interface ReplayViewerV2WrapperProps {
  /** Demo ID to load */
  demoId: string;
  /** Initial round number */
  initialRoundNumber?: number;
  /** Map name (for radar image) */
  mapName?: string;
  /** Callback when back is requested */
  onBack?: () => void;
  /** Additional class names */
  className?: string;
}

/**
 * ReplayViewerV2Wrapper - Routes to appropriate viewer based on viewMode
 */
export function ReplayViewerV2Wrapper({
  demoId,
  initialRoundNumber = 1,
  mapName,
  onBack,
  className,
}: ReplayViewerV2WrapperProps) {
  const viewMode = useReplayStore((state) => state.viewMode);

  // Debug: log view mode changes
  console.log("[ReplayViewerV2Wrapper] viewMode:", viewMode);

  // Render based on view mode
  // Key prop forces remount when switching modes to ensure clean state
  switch (viewMode) {
    case "compact":
      return (
        <ReplayViewerCompact
          key="compact"
          demoId={demoId}
          initialRoundNumber={initialRoundNumber}
          mapName={mapName}
          className={className}
        />
      );

    case "standard":
      return (
        <ReplayViewerStandard
          key="standard"
          demoId={demoId}
          initialRoundNumber={initialRoundNumber}
          mapName={mapName}
          className={className}
        />
      );

    case "analyse":
      return (
        <ReplayViewerAnalyse
          key="analyse"
          demoId={demoId}
          initialRoundNumber={initialRoundNumber}
          mapName={mapName}
          className={className}
        />
      );

    case "focus":
      return (
        <ReplayViewerFocus
          key="focus"
          demoId={demoId}
          initialRoundNumber={initialRoundNumber}
          mapName={mapName}
          className={className}
        />
      );

    default:
      // Default to compact mode
      return (
        <ReplayViewerCompact
          key="default-compact"
          demoId={demoId}
          initialRoundNumber={initialRoundNumber}
          mapName={mapName}
          className={className}
        />
      );
  }
}

export default ReplayViewerV2Wrapper;
