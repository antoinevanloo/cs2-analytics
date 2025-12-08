/**
 * useReplayAnimation Hook - 60fps animation loop for replay playback
 *
 * Features:
 * - requestAnimationFrame-based animation loop
 * - Frame rate independent timing
 * - Playback speed control
 * - Frame interpolation (optional)
 * - Automatic cleanup on unmount
 */

import { useEffect, useRef, useCallback } from "react";
import { useReplayStore } from "@/stores/replay-store";

// Target frame rate for smooth animation
const TARGET_FPS = 60;
const FRAME_DURATION_MS = 1000 / TARGET_FPS;

interface AnimationState {
  lastTimestamp: number;
  accumulatedTime: number;
  animationFrameId: number | null;
}

export function useReplayAnimation() {
  // Use a single ref to track animation state
  const animationRef = useRef<{
    frameId: number | null;
    lastTime: number;
    accumulator: number;
    cancelled: boolean;  // Flag to stop in-flight callbacks
  }>({
    frameId: null,
    lastTime: 0,
    accumulator: 0,
    cancelled: false,
  });

  // Subscribe to playback state changes
  const playbackState = useReplayStore((s) => s.playbackState);
  const framesLength = useReplayStore((s) => s.frames.length);

  useEffect(() => {
    const anim = animationRef.current;

    console.log(`[Animation] Effect triggered: playbackState=${playbackState}, framesLength=${framesLength}`);

    // Only start if playing and has frames
    if (playbackState !== "playing" || framesLength === 0) {
      // Stop any running animation
      if (anim.frameId !== null) {
        console.log(`[Animation] Stopping animation (state=${playbackState}, frames=${framesLength})`);
        cancelAnimationFrame(anim.frameId);
        anim.frameId = null;
      }
      return;
    }

    console.log(`[Animation] Starting animation loop`);

    // Reset timing and cancelled flag
    anim.lastTime = 0;
    anim.accumulator = 0;
    anim.cancelled = false;

    // Animation loop
    const tick = (currentTime: number) => {
      // Check if we've been cancelled (e.g., by cleanup or StrictMode re-mount)
      if (anim.cancelled) {
        console.log(`[Animation] Tick: cancelled flag is true, stopping`);
        anim.frameId = null;
        return;
      }

      // Get fresh store state each frame
      const store = useReplayStore.getState();

      // Stop if no longer playing
      if (store.playbackState !== "playing") {
        console.log(`[Animation] Tick: playbackState changed to ${store.playbackState}, stopping`);
        anim.frameId = null;
        return;
      }

      // First frame - just record time
      if (anim.lastTime === 0) {
        anim.lastTime = currentTime;
        anim.frameId = requestAnimationFrame(tick);
        return;
      }

      // Calculate delta
      const delta = currentTime - anim.lastTime;
      anim.lastTime = currentTime;
      anim.accumulator += delta;

      // Calculate ms per game frame
      // tickRate=64, sampleInterval=8 → 8 frames/sec → 125ms per frame at 1x speed
      const msPerFrame = (1000 * store.sampleInterval) / store.tickRate / store.playbackSpeed;

      // Advance frames while we have accumulated enough time
      while (anim.accumulator >= msPerFrame) {
        anim.accumulator -= msPerFrame;
        store.nextFrame();

        // Check if ended after advancing
        if (useReplayStore.getState().playbackState !== "playing") {
          anim.frameId = null;
          return;
        }
      }

      // Continue animation
      anim.frameId = requestAnimationFrame(tick);
    };

    // Start animation
    anim.frameId = requestAnimationFrame(tick);

    // Cleanup
    return () => {
      console.log(`[Animation] Cleanup called`);
      anim.cancelled = true;  // Signal in-flight callbacks to stop
      if (anim.frameId !== null) {
        cancelAnimationFrame(anim.frameId);
        anim.frameId = null;
      }
    };
  }, [playbackState, framesLength]);

  // Get values for return
  const tickRate = useReplayStore((s) => s.tickRate);
  const sampleInterval = useReplayStore((s) => s.sampleInterval);
  const playbackSpeed = useReplayStore((s) => s.playbackSpeed);

  return {
    isAnimating: animationRef.current.frameId !== null,
    targetFps: TARGET_FPS,
    effectiveFps: (tickRate / sampleInterval) * playbackSpeed,
  };
}

/**
 * Hook for smooth frame interpolation between tick frames
 * Provides sub-frame positions for smoother visual animation
 */
export function useFrameInterpolation() {
  const interpolationRef = useRef({
    previousFrame: null as
      | ReturnType<typeof useReplayStore.getState>["frames"][0]
      | null,
    currentFrame: null as
      | ReturnType<typeof useReplayStore.getState>["frames"][0]
      | null,
    interpolationFactor: 0,
  });

  // Get reactive values
  const frames = useReplayStore((s) => s.frames);
  const currentFrameIndex = useReplayStore((s) => s.currentFrameIndex);
  const playbackState = useReplayStore((s) => s.playbackState);

  // Update interpolation state when frame changes
  useEffect(() => {
    const currentFrame = frames[currentFrameIndex];
    const previousFrame =
      currentFrameIndex > 0 ? frames[currentFrameIndex - 1] : null;

    interpolationRef.current.previousFrame = previousFrame ?? null;
    interpolationRef.current.currentFrame = currentFrame ?? null;
    interpolationRef.current.interpolationFactor = 0;
  }, [frames, currentFrameIndex]);

  // Interpolation animation (runs at display refresh rate)
  useEffect(() => {
    if (playbackState !== "playing") {
      return;
    }

    let frameId: number | null = null;
    let lastTime = 0;

    const tick = (currentTime: number) => {
      const store = useReplayStore.getState();

      if (store.playbackState !== "playing") {
        return;
      }

      if (lastTime === 0) {
        lastTime = currentTime;
        frameId = requestAnimationFrame(tick);
        return;
      }

      const delta = currentTime - lastTime;
      lastTime = currentTime;

      // Calculate interpolation factor
      const msPerFrame =
        (1000 * store.sampleInterval) / store.tickRate / store.playbackSpeed;
      interpolationRef.current.interpolationFactor = Math.min(
        1,
        interpolationRef.current.interpolationFactor + delta / msPerFrame,
      );

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [playbackState]);

  // Interpolate player positions
  const getInterpolatedPositions = useCallback(() => {
    const { previousFrame, currentFrame, interpolationFactor } =
      interpolationRef.current;

    if (!currentFrame) return null;
    if (!previousFrame) return currentFrame.players;

    // Linear interpolation between frames
    return currentFrame.players.map((player) => {
      const prevPlayer = previousFrame.players.find(
        (p) => p.steamId === player.steamId,
      );

      if (!prevPlayer) return player;

      // Interpolate position
      const t = interpolationFactor;
      return {
        ...player,
        x: prevPlayer.x + (player.x - prevPlayer.x) * t,
        y: prevPlayer.y + (player.y - prevPlayer.y) * t,
        z: prevPlayer.z + (player.z - prevPlayer.z) * t,
        // Interpolate yaw with proper angle wrapping
        yaw: interpolateAngle(prevPlayer.yaw, player.yaw, t),
      };
    });
  }, []);

  return {
    interpolationFactor: interpolationRef.current.interpolationFactor,
    getInterpolatedPositions,
  };
}

// Helper function to interpolate angles with proper wrapping
function interpolateAngle(from: number, to: number, t: number): number {
  // Normalize angles to 0-360
  from = ((from % 360) + 360) % 360;
  to = ((to % 360) + 360) % 360;

  // Find shortest path
  let diff = to - from;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  return from + diff * t;
}

export default useReplayAnimation;
