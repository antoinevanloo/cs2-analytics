"use client";

/**
 * ReplayViewerV2Wrapper - Entry point for V2 replay viewer
 *
 * Wraps the compact viewer with view mode switching capability.
 * Currently supports:
 * - compact: Joueur persona (default)
 * - standard: Coach persona (uses ReplayViewerEnhanced)
 *
 * Future modes (planned):
 * - analyse: Analyste persona
 * - focus: Recruteur persona
 */

import React from "react";
import { cn } from "@/lib/utils";
import { useReplayStore, type ViewMode } from "@/stores/replay-store";
import { ReplayViewerCompact } from "./replay-viewer-compact";
import { ReplayViewerEnhanced } from "./replay-viewer-enhanced";

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

  // Render based on view mode
  switch (viewMode) {
    case "compact":
      return (
        <ReplayViewerCompact
          demoId={demoId}
          initialRoundNumber={initialRoundNumber}
          mapName={mapName}
          className={className}
        />
      );

    case "standard":
    case "analyse":
    case "focus":
      // Fallback to enhanced viewer for modes not yet implemented
      return (
        <ReplayViewerEnhanced
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
          demoId={demoId}
          initialRoundNumber={initialRoundNumber}
          mapName={mapName}
          className={className}
        />
      );
  }
}

export default ReplayViewerV2Wrapper;
