"use client";

/**
 * useReplayKeyboard - Centralized keyboard shortcuts for 2D Replay
 *
 * Shortcuts:
 * - Space: Play/Pause
 * - Arrow keys: Frame stepping
 * - Shift+Arrow: 10s skip
 * - Ctrl+Arrow: 5s skip
 * - 1-5: Speed presets
 * - K/G/J/N/H/T/F/R: Overlay toggles (F = Fire zones)
 * - [ / ]: Previous/Next round
 *
 * Usage:
 * Just call useReplayKeyboard() in any replay viewer component.
 * The hook handles all keyboard events automatically.
 */

import { useEffect, useCallback } from "react";
import { useReplayStore, type PlaybackSpeed } from "@/stores/replay-store";

interface UseReplayKeyboardOptions {
  /** Callback when previous round is requested */
  onPreviousRound?: () => void;
  /** Callback when next round is requested */
  onNextRound?: () => void;
  /** Whether keyboard shortcuts are enabled (default: true) */
  enabled?: boolean;
}

export function useReplayKeyboard(options: UseReplayKeyboardOptions = {}) {
  const { onPreviousRound, onNextRound, enabled = true } = options;

  const {
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
    toggleInfernoZones,
    resetViewport,
  } = useReplayStore();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      switch (e.code) {
        // Playback controls
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

        // Speed presets
        case "Digit1":
          e.preventDefault();
          setPlaybackSpeed(0.25 as PlaybackSpeed);
          break;
        case "Digit2":
          e.preventDefault();
          setPlaybackSpeed(0.5 as PlaybackSpeed);
          break;
        case "Digit3":
          e.preventDefault();
          setPlaybackSpeed(1 as PlaybackSpeed);
          break;
        case "Digit4":
          e.preventDefault();
          setPlaybackSpeed(2 as PlaybackSpeed);
          break;
        case "Digit5":
          e.preventDefault();
          setPlaybackSpeed(4 as PlaybackSpeed);
          break;

        // Overlay toggles
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
        case "KeyF":
          e.preventDefault();
          toggleInfernoZones();
          break;
        case "KeyR":
          e.preventDefault();
          resetViewport();
          break;

        // Round navigation
        case "BracketLeft":
          e.preventDefault();
          onPreviousRound?.();
          break;
        case "BracketRight":
          e.preventDefault();
          onNextRound?.();
          break;
      }
    },
    [
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
      toggleInfernoZones,
      resetViewport,
      onPreviousRound,
      onNextRound,
    ]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, handleKeyDown]);
}

export default useReplayKeyboard;
