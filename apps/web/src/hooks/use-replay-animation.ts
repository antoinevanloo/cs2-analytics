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
  const animationStateRef = useRef<AnimationState>({
    lastTimestamp: 0,
    accumulatedTime: 0,
    animationFrameId: null,
  });

  const {
    playbackState,
    playbackSpeed,
    frames,
    currentFrameIndex,
    tickRate,
    sampleInterval,
    nextFrame,
  } = useReplayStore();

  // Calculate the time between frames based on tick rate and sample interval
  // At 64 tick rate with sample interval of 8, we have 8 frames per second
  // We need to advance one frame every (1000 / (tickRate / sampleInterval)) ms
  const msPerFrame = useCallback(() => {
    const framesPerSecond = tickRate / sampleInterval;
    return 1000 / framesPerSecond / playbackSpeed;
  }, [tickRate, sampleInterval, playbackSpeed]);

  // Animation loop
  const animate = useCallback(
    (timestamp: number) => {
      const state = animationStateRef.current;

      // Initialize timestamp on first frame
      if (state.lastTimestamp === 0) {
        state.lastTimestamp = timestamp;
      }

      // Calculate delta time
      const deltaTime = timestamp - state.lastTimestamp;
      state.lastTimestamp = timestamp;

      // Accumulate time
      state.accumulatedTime += deltaTime;

      // Calculate frame duration based on playback speed
      const frameDuration = msPerFrame();

      // Advance frames based on accumulated time
      while (state.accumulatedTime >= frameDuration) {
        nextFrame();
        state.accumulatedTime -= frameDuration;
      }

      // Schedule next frame if still playing
      state.animationFrameId = requestAnimationFrame(animate);
    },
    [msPerFrame, nextFrame]
  );

  // Start/stop animation based on playback state
  useEffect(() => {
    const state = animationStateRef.current;

    if (playbackState === "playing" && frames.length > 0) {
      // Reset timing state when starting
      state.lastTimestamp = 0;
      state.accumulatedTime = 0;

      // Start animation loop
      state.animationFrameId = requestAnimationFrame(animate);
    } else {
      // Stop animation loop
      if (state.animationFrameId !== null) {
        cancelAnimationFrame(state.animationFrameId);
        state.animationFrameId = null;
      }
    }

    // Cleanup on unmount
    return () => {
      if (state.animationFrameId !== null) {
        cancelAnimationFrame(state.animationFrameId);
        state.animationFrameId = null;
      }
    };
  }, [playbackState, frames.length, animate]);

  // Return animation state for debugging
  return {
    isAnimating: animationStateRef.current.animationFrameId !== null,
    targetFps: TARGET_FPS,
    effectiveFps: tickRate / sampleInterval * playbackSpeed,
  };
}

/**
 * Hook for smooth frame interpolation between tick frames
 * Provides sub-frame positions for smoother visual animation
 */
export function useFrameInterpolation() {
  const interpolationRef = useRef({
    previousFrame: null as ReturnType<typeof useReplayStore.getState>["frames"][0] | null,
    currentFrame: null as ReturnType<typeof useReplayStore.getState>["frames"][0] | null,
    interpolationFactor: 0,
  });

  const { frames, currentFrameIndex, playbackState, playbackSpeed, tickRate, sampleInterval } =
    useReplayStore();

  // Update interpolation state
  useEffect(() => {
    const currentFrame = frames[currentFrameIndex];
    const previousFrame = currentFrameIndex > 0 ? frames[currentFrameIndex - 1] : null;

    interpolationRef.current.previousFrame = previousFrame ?? null;
    interpolationRef.current.currentFrame = currentFrame ?? null;
    interpolationRef.current.interpolationFactor = 0;
  }, [frames, currentFrameIndex]);

  // Interpolation animation (runs at display refresh rate)
  useEffect(() => {
    let animationFrameId: number | null = null;
    let lastTimestamp = 0;

    const animate = (timestamp: number) => {
      if (lastTimestamp === 0) {
        lastTimestamp = timestamp;
      }

      const deltaTime = timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      // Calculate interpolation factor
      const msPerFrame = (1000 / (tickRate / sampleInterval)) / playbackSpeed;
      interpolationRef.current.interpolationFactor = Math.min(
        1,
        interpolationRef.current.interpolationFactor + deltaTime / msPerFrame
      );

      if (playbackState === "playing") {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    if (playbackState === "playing") {
      animationFrameId = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [playbackState, playbackSpeed, tickRate, sampleInterval]);

  // Interpolate player positions
  const getInterpolatedPositions = useCallback(() => {
    const { previousFrame, currentFrame, interpolationFactor } = interpolationRef.current;

    if (!currentFrame) return null;
    if (!previousFrame) return currentFrame.players;

    // Linear interpolation between frames
    return currentFrame.players.map((player) => {
      const prevPlayer = previousFrame.players.find((p) => p.steamId === player.steamId);

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
