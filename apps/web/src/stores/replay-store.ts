/**
 * Replay Store - Zustand state management for 2D replay viewer
 *
 * Manages:
 * - Current playback state (playing, paused, tick position)
 * - Playback controls (speed, direction)
 * - Selected player focus
 * - Viewport/zoom state
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

// Player frame data for a single tick
export interface PlayerFrame {
  steamId: string;
  name?: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  health: number;
  armor: number;
  isAlive: boolean;
  isDucking: boolean;
  isScoped: boolean;
  isDefusing: boolean;
  isPlanting: boolean;
  team: number; // 2 = T, 3 = CT
  activeWeapon?: string;
  hasDefuseKit: boolean;
  hasBomb: boolean;
  money: number;
  flashDuration: number;
}

// Single tick frame with all players
export interface TickFrame {
  tick: number;
  time: number;
  players: PlayerFrame[];
}

// Replay event types - synchronized with API types
export type ReplayEventType =
  | "KILL"
  | "BOMB_PLANT"
  | "BOMB_DEFUSE"
  | "BOMB_EXPLODE"
  | "GRENADE"
  // Granular grenade types from API
  | "SMOKE_START"
  | "SMOKE_END"
  | "MOLOTOV_START"
  | "MOLOTOV_END"
  | "HE_EXPLODE"
  | "FLASH_EFFECT"
  | "GRENADE_THROW";

// Replay event overlay
export interface ReplayEvent {
  id: string;
  type: ReplayEventType;
  tick: number;
  x: number;
  y: number;
  z: number;
  data: Record<string, unknown>;
  endX?: number;
  endY?: number;
  endZ?: number;
}

// Helper to check if an event is a grenade-related event
export function isGrenadeEvent(type: ReplayEventType): boolean {
  return [
    "GRENADE",
    "SMOKE_START",
    "SMOKE_END",
    "MOLOTOV_START",
    "MOLOTOV_END",
    "HE_EXPLODE",
    "FLASH_EFFECT",
    "GRENADE_THROW",
  ].includes(type);
}

// Map configuration for coordinate conversion
export interface MapConfig {
  mapName: string;
  posX: number;
  posY: number;
  scale: number;
  radarWidth: number;
  radarHeight: number;
  hasLowerLevel: boolean;
  lowerPosX?: number;
  lowerPosY?: number;
  lowerScale?: number;
  splitAltitude?: number;
  displayName?: string;
  radarImageUrl?: string; // URL to radar background image
}

// Generate radar image URL from map name
// CS2 radar images are typically served from a static path or CDN
export function getRadarImageUrl(mapName: string): string {
  // Try local public folder first, then fallback to CDN
  return `/radars/${mapName}_radar.png`;
}

// Round metadata
export interface RoundMetadata {
  roundNumber: number;
  startTick: number;
  endTick: number;
  winnerTeam: number;
  winReason: string;
  ctTeam: {
    name: string;
    players: string[];
    score: number;
  };
  tTeam: {
    name: string;
    players: string[];
    score: number;
  };
}

// Playback state
export type PlaybackState =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "ended";

// Playback speed options
export const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 1.5, 2, 4] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

interface ReplayState {
  // Demo/Round identification
  demoId: string | null;
  roundNumber: number | null;

  // Map configuration
  mapConfig: MapConfig | null;

  // Round metadata
  roundMetadata: RoundMetadata | null;

  // Frame data
  frames: TickFrame[];
  events: ReplayEvent[];

  // Playback state
  playbackState: PlaybackState;
  currentFrameIndex: number;
  currentTick: number;
  playbackSpeed: PlaybackSpeed;

  // Tick rate info
  tickRate: number;
  sampleInterval: number;

  // Player focus
  focusedPlayerSteamId: string | null;
  hoveredPlayerSteamId: string | null;

  // Viewport
  viewportScale: number;
  viewportOffsetX: number;
  viewportOffsetY: number;

  // Show/hide overlays
  showKillLines: boolean;
  showGrenades: boolean;
  showPlayerNames: boolean;
  showHealthBars: boolean;

  // Error state
  error: string | null;

  // Actions
  loadReplay: (demoId: string, roundNumber: number) => Promise<void>;
  setFrames: (frames: TickFrame[]) => void;
  setEvents: (events: ReplayEvent[]) => void;
  setMapConfig: (config: MapConfig) => void;
  setRoundMetadata: (metadata: RoundMetadata) => void;

  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (frameIndex: number) => void;
  seekToTick: (tick: number) => void;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;

  nextFrame: () => void;
  previousFrame: () => void;
  skipForward: (seconds: number) => void;
  skipBackward: (seconds: number) => void;

  focusPlayer: (steamId: string | null) => void;
  hoverPlayer: (steamId: string | null) => void;

  setViewport: (scale: number, offsetX: number, offsetY: number) => void;
  resetViewport: () => void;

  toggleKillLines: () => void;
  toggleGrenades: () => void;
  togglePlayerNames: () => void;
  toggleHealthBars: () => void;

  reset: () => void;
  setError: (error: string | null) => void;
}

const initialState = {
  demoId: null,
  roundNumber: null,
  mapConfig: null,
  roundMetadata: null,
  frames: [],
  events: [],
  playbackState: "idle" as PlaybackState,
  currentFrameIndex: 0,
  currentTick: 0,
  playbackSpeed: 1 as PlaybackSpeed,
  tickRate: 64,
  sampleInterval: 8,
  focusedPlayerSteamId: null,
  hoveredPlayerSteamId: null,
  viewportScale: 1,
  viewportOffsetX: 0,
  viewportOffsetY: 0,
  showKillLines: true,
  showGrenades: true,
  showPlayerNames: true,
  showHealthBars: true,
  error: null,
};

export const useReplayStore = create<ReplayState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    loadReplay: async (demoId: string, roundNumber: number) => {
      set({
        demoId,
        roundNumber,
        playbackState: "loading",
        error: null,
        frames: [],
        events: [],
        currentFrameIndex: 0,
        currentTick: 0,
      });

      // Note: Actual data loading is handled by the use-replay hook
      // This just sets up the initial state
    },

    setFrames: (frames: TickFrame[]) => {
      const firstFrame = frames[0];
      set({
        frames,
        currentTick: firstFrame?.tick ?? 0,
        playbackState: frames.length > 0 ? "ready" : "idle",
      });
    },

    setEvents: (events: ReplayEvent[]) => {
      set({ events });
    },

    setMapConfig: (config: MapConfig) => {
      set({ mapConfig: config });
    },

    setRoundMetadata: (metadata: RoundMetadata) => {
      set({
        roundMetadata: metadata,
        tickRate: 64, // Default, should come from metadata
      });
    },

    play: () => {
      const { playbackState, frames, currentFrameIndex } = get();
      if (playbackState === "loading" || frames.length === 0) return;

      // If at end, restart from beginning
      if (currentFrameIndex >= frames.length - 1) {
        set({ currentFrameIndex: 0, currentTick: frames[0]?.tick ?? 0 });
      }

      set({ playbackState: "playing" });
    },

    pause: () => {
      set({ playbackState: "paused" });
    },

    togglePlay: () => {
      const { playbackState } = get();
      if (playbackState === "playing") {
        get().pause();
      } else {
        get().play();
      }
    },

    seek: (frameIndex: number) => {
      const { frames } = get();
      const clampedIndex = Math.max(0, Math.min(frameIndex, frames.length - 1));
      const frame = frames[clampedIndex];
      set({
        currentFrameIndex: clampedIndex,
        currentTick: frame?.tick ?? 0,
      });
    },

    seekToTick: (tick: number) => {
      const { frames } = get();
      // Binary search for closest frame
      let left = 0;
      let right = frames.length - 1;
      let closestIndex = 0;

      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const midTick = frames[mid]?.tick ?? 0;

        if (midTick === tick) {
          closestIndex = mid;
          break;
        }

        if (midTick < tick) {
          closestIndex = mid;
          left = mid + 1;
        } else {
          right = mid - 1;
        }
      }

      get().seek(closestIndex);
    },

    setPlaybackSpeed: (speed: PlaybackSpeed) => {
      set({ playbackSpeed: speed });
    },

    nextFrame: () => {
      const { currentFrameIndex, frames } = get();
      if (currentFrameIndex < frames.length - 1) {
        get().seek(currentFrameIndex + 1);
      } else {
        set({ playbackState: "ended" });
      }
    },

    previousFrame: () => {
      const { currentFrameIndex } = get();
      if (currentFrameIndex > 0) {
        get().seek(currentFrameIndex - 1);
      }
    },

    skipForward: (seconds: number) => {
      const { currentTick, tickRate, sampleInterval } = get();
      const ticksToSkip = Math.round(seconds * tickRate);
      const targetTick = currentTick + ticksToSkip;
      get().seekToTick(targetTick);
    },

    skipBackward: (seconds: number) => {
      const { currentTick, tickRate } = get();
      const ticksToSkip = Math.round(seconds * tickRate);
      const targetTick = Math.max(0, currentTick - ticksToSkip);
      get().seekToTick(targetTick);
    },

    focusPlayer: (steamId: string | null) => {
      set({ focusedPlayerSteamId: steamId });
    },

    hoverPlayer: (steamId: string | null) => {
      set({ hoveredPlayerSteamId: steamId });
    },

    setViewport: (scale: number, offsetX: number, offsetY: number) => {
      set({
        viewportScale: scale,
        viewportOffsetX: offsetX,
        viewportOffsetY: offsetY,
      });
    },

    resetViewport: () => {
      set({
        viewportScale: 1,
        viewportOffsetX: 0,
        viewportOffsetY: 0,
      });
    },

    toggleKillLines: () => {
      set((state) => ({ showKillLines: !state.showKillLines }));
    },

    toggleGrenades: () => {
      set((state) => ({ showGrenades: !state.showGrenades }));
    },

    togglePlayerNames: () => {
      set((state) => ({ showPlayerNames: !state.showPlayerNames }));
    },

    toggleHealthBars: () => {
      set((state) => ({ showHealthBars: !state.showHealthBars }));
    },

    reset: () => {
      set(initialState);
    },

    setError: (error: string | null) => {
      set({ error, playbackState: error ? "idle" : get().playbackState });
    },
  })),
);

// Selector hooks for performance
export const useCurrentFrame = () =>
  useReplayStore((state) => state.frames[state.currentFrameIndex]);

export const usePlaybackProgress = () =>
  useReplayStore((state) => ({
    current: state.currentFrameIndex,
    total: state.frames.length,
    percentage:
      state.frames.length > 0
        ? (state.currentFrameIndex / (state.frames.length - 1)) * 100
        : 0,
  }));

export const useIsPlaying = () =>
  useReplayStore((state) => state.playbackState === "playing");

export const useReplayLoaded = () =>
  useReplayStore(
    (state) =>
      state.playbackState !== "idle" && state.playbackState !== "loading",
  );
