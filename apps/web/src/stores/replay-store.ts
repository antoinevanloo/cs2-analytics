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
// Enhanced with velocity, isWalking, weaponAmmo, flashAlpha for richer replay visualization
export interface PlayerFrame {
  steamId: string;
  name?: string;

  // Position (radar coordinates 0-1024)
  x: number;
  y: number;
  z: number;

  // Velocity (game units per second) - enables smooth interpolation
  // Typical values: 0-250 (walking), 250-450 (running), >450 (falling/jumping)
  velocityX: number;
  velocityY: number;
  velocityZ: number;

  // View direction
  yaw: number;   // Horizontal angle (0-360)
  pitch: number; // Vertical angle (-90 to 90)

  // Player state
  health: number;  // 0-100
  armor: number;   // 0-100
  isAlive: boolean;
  isDucking: boolean;
  isWalking: boolean; // Shift-walking (slower, silent movement)
  isScoped: boolean;
  isDefusing: boolean;
  isPlanting: boolean;

  // Team & equipment
  team: number; // 2 = T, 3 = CT
  activeWeapon?: string;
  weaponAmmo?: number | null; // Current magazine ammo (null if unknown/melee)
  hasDefuseKit: boolean;
  hasBomb: boolean;
  hasHelmet: boolean; // Kevlar + helmet (vs kevlar only)
  money: number;

  // Full inventory (array of weapon names)
  // e.g. ["weapon_ak47", "weapon_deagle", "weapon_flashbang", "weapon_smokegrenade"]
  inventory?: string[];

  // Flash effects
  flashDuration: number;    // Remaining flash duration in seconds
  flashAlpha: number;       // Flash intensity 0-255 (0=none, 255=full blind)
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
  // Bomb events (including BEGIN for duration tracking)
  | "BOMB_PLANT"
  | "BOMB_DEFUSE"
  | "BOMB_EXPLODE"
  | "BOMB_BEGIN_PLANT"
  | "BOMB_BEGIN_DEFUSE"
  | "GRENADE"
  // Granular grenade types from API
  | "SMOKE_START"
  | "SMOKE_END"
  | "MOLOTOV_START"
  | "MOLOTOV_END"
  | "HE_EXPLODE"
  | "FLASH_EFFECT"
  | "DECOY_START"
  | "GRENADE_THROW";

// Base replay event with common fields
export interface ReplayEventBase {
  id: string;
  type: ReplayEventType;
  tick: number;
  time: number;
  x: number;
  y: number;
  z: number;
  endX?: number;
  endY?: number;
  endZ?: number;
}

// Kill event with all kill-specific fields
export interface KillEvent extends ReplayEventBase {
  type: "KILL";
  attackerSteamId?: string;
  attackerName?: string;
  victimSteamId: string;
  victimName: string;
  weapon: string;
  headshot: boolean;
  noscope: boolean;
  thrusmoke: boolean;
  wallbang: boolean;
}

// Bomb events (including BEGIN events for duration tracking)
export interface BombEvent extends ReplayEventBase {
  type: "BOMB_PLANT" | "BOMB_DEFUSE" | "BOMB_EXPLODE" | "BOMB_BEGIN_PLANT" | "BOMB_BEGIN_DEFUSE";
  playerSteamId?: string;
  playerName?: string;
  site?: string;
  hasKit?: boolean; // For defuse events: whether player has defuse kit
}

// Grenade events
export interface GrenadeReplayEvent extends ReplayEventBase {
  type: "SMOKE_START" | "SMOKE_END" | "MOLOTOV_START" | "MOLOTOV_END" | "HE_EXPLODE" | "FLASH_EFFECT" | "DECOY_START" | "GRENADE_THROW" | "GRENADE";
  throwerSteamId?: string;
  grenadeType?: string;
  radius?: number;
  duration?: number;
}

// Union type for all replay events
export type ReplayEvent = KillEvent | BombEvent | GrenadeReplayEvent | ReplayEventBase;

// Type guard for kill events
export function isKillEvent(event: ReplayEvent): event is KillEvent {
  return event.type === "KILL";
}

// Type guard for bomb events
export function isBombEvent(event: ReplayEvent): event is BombEvent {
  return (
    event.type === "BOMB_PLANT" ||
    event.type === "BOMB_DEFUSE" ||
    event.type === "BOMB_EXPLODE" ||
    event.type === "BOMB_BEGIN_PLANT" ||
    event.type === "BOMB_BEGIN_DEFUSE"
  );
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
    "DECOY_START",
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

/**
 * Generate radar image URL from map name
 * Images are served statically from /radars/
 */
export function getRadarImageUrl(mapName: string, level?: "lower" | "upper"): string {
  const normalizedName = mapName.toLowerCase().replace(/\.bsp$/, "");
  const suffix = level === "lower" ? "_lower" : "";
  return `/radars/${normalizedName}${suffix}.png`;
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

// View mode for different personas
// - compact: Joueur (canvas maximisé, overlays flottants)
// - standard: Coach (sidebar visible, layout équilibré)
// - analyse: Analyste (timeline multi-couches, panel contextuel)
// - focus: Recruteur (stats joueur détaillées, highlight visuel)
export type ViewMode = 'compact' | 'standard' | 'analyse' | 'focus';
export const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  compact: 'Joueur',
  standard: 'Coach',
  analyse: 'Analyste',
  focus: 'Recruteur',
};

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

  // View mode (persona-based layouts)
  viewMode: ViewMode;

  // Show/hide overlays
  showKillLines: boolean;
  showGrenades: boolean;
  showTrajectories: boolean; // Grenade throw→detonate trajectories (separate from effects)
  showPlayerNames: boolean;
  showHealthBars: boolean;
  showTrails: boolean;

  // Trail settings
  trailLength: number; // Number of frames to show in trail (default: 30 = ~4 seconds)

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

  setViewMode: (mode: ViewMode) => void;

  toggleKillLines: () => void;
  toggleGrenades: () => void;
  toggleTrajectories: () => void;
  togglePlayerNames: () => void;
  toggleHealthBars: () => void;
  toggleTrails: () => void;
  setTrailLength: (length: number) => void;

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
  viewMode: "compact" as ViewMode, // Default to player view (compact mode)
  showKillLines: true,
  showGrenades: true,
  showTrajectories: true, // Grenade throw→detonate arc lines
  showPlayerNames: true,
  showHealthBars: true,
  showTrails: false, // Off by default - can be performance intensive
  trailLength: 30, // ~4 seconds at 8 tick sample interval (30 * 8 / 64 = 3.75s)
  error: null,
};

// Debug: Log all state changes in development
const debugSet = (
  set: (partial: Partial<ReplayState> | ((state: ReplayState) => Partial<ReplayState>)) => void,
  partial: Partial<ReplayState> | ((state: ReplayState) => Partial<ReplayState>),
  actionName: string,
) => {
  if (typeof partial === "function") {
    set(partial);
  } else {
    if (partial.playbackState !== undefined) {
      console.log(`[Store:${actionName}] playbackState ->`, partial.playbackState);
    }
    set(partial);
  }
};

export const useReplayStore = create<ReplayState>()(
  subscribeWithSelector((set, get) => {
    const trackedSet = (partial: Partial<ReplayState> | ((state: ReplayState) => Partial<ReplayState>), actionName = "unknown") => {
      debugSet(set, partial, actionName);
    };

    return {
    ...initialState,

    loadReplay: async (demoId: string, roundNumber: number) => {
      trackedSet({
        demoId,
        roundNumber,
        playbackState: "loading",
        error: null,
        frames: [],
        events: [],
        currentFrameIndex: 0,
        currentTick: 0,
      }, "loadReplay");

      // Note: Actual data loading is handled by the use-replay hook
      // This just sets up the initial state
    },

    setFrames: (frames: TickFrame[]) => {
      const firstFrame = frames[0];
      const currentState = get().playbackState;
      // Don't reset playbackState if already playing/paused - only set when loading new data
      const shouldResetState = currentState === "loading" || currentState === "idle";
      const newState = shouldResetState
        ? (frames.length > 0 ? "ready" : "idle")
        : currentState;
      console.log(`[Store:setFrames] frames=${frames.length}, currentState=${currentState}, shouldReset=${shouldResetState}`);
      if (shouldResetState) {
        trackedSet({
          frames,
          currentTick: firstFrame?.tick ?? 0,
          playbackState: newState,
        }, "setFrames");
      } else {
        set({
          frames,
          currentTick: firstFrame?.tick ?? 0,
        });
      }
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
      console.log(`[Store:play] t=${Date.now()}, called, state=${playbackState}, frames=${frames.length}, frameIdx=${currentFrameIndex}`);
      console.trace(`[Store:play] call stack`);
      if (playbackState === "loading" || frames.length === 0) {
        console.log(`[Store:play] blocked - loading or no frames`);
        return;
      }

      // If at end, restart from beginning
      if (currentFrameIndex >= frames.length - 1) {
        console.log(`[Store:play] at end, restarting from beginning`);
        set({ currentFrameIndex: 0, currentTick: frames[0]?.tick ?? 0 });
      }

      trackedSet({ playbackState: "playing" }, "play");
    },

    pause: () => {
      console.log(`[Store:pause] t=${Date.now()}, called`);
      console.trace(`[Store:pause] call stack`);
      trackedSet({ playbackState: "paused" }, "pause");
    },

    togglePlay: () => {
      const { playbackState } = get();
      console.log(`[Store:togglePlay] t=${Date.now()}, current state=${playbackState}`);
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
        console.log(`[Store:nextFrame] reached end at frame ${currentFrameIndex}/${frames.length}`);
        trackedSet({ playbackState: "ended" }, "nextFrame:ended");
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

    setViewMode: (mode: ViewMode) => {
      console.log("[Store:setViewMode] Setting viewMode to:", mode);
      set({ viewMode: mode });
    },

    toggleKillLines: () => {
      set((state) => ({ showKillLines: !state.showKillLines }));
    },

    toggleGrenades: () => {
      set((state) => ({ showGrenades: !state.showGrenades }));
    },

    toggleTrajectories: () => {
      set((state) => ({ showTrajectories: !state.showTrajectories }));
    },

    togglePlayerNames: () => {
      set((state) => ({ showPlayerNames: !state.showPlayerNames }));
    },

    toggleHealthBars: () => {
      set((state) => ({ showHealthBars: !state.showHealthBars }));
    },

    toggleTrails: () => {
      set((state) => ({ showTrails: !state.showTrails }));
    },

    setTrailLength: (length: number) => {
      // Clamp between 10 (~1.25s) and 80 (~10s)
      const clampedLength = Math.max(10, Math.min(80, length));
      set({ trailLength: clampedLength });
    },

    reset: () => {
      // Preserve viewMode when resetting - it's a UI preference, not replay data
      const currentViewMode = get().viewMode;
      set({ ...initialState, viewMode: currentViewMode });
    },

    setError: (error: string | null) => {
      if (error) {
        console.log(`[Store:setError] error="${error}", resetting to idle`);
        trackedSet({ error, playbackState: "idle" }, "setError");
      } else {
        set({ error });
      }
    },
  };
  }),
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
