/**
 * Replay Types
 *
 * Type definitions for 2D replay visualization.
 *
 * @module replay/types
 */

// ============================================================================
// Player Frame Data
// ============================================================================

/**
 * Single player's state at a specific tick
 *
 * Enhanced with velocity, isWalking, weaponAmmo, flashAlpha for richer replay visualization
 */
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
  team: number; // 2=T, 3=CT
  activeWeapon?: string;
  weaponAmmo?: number | null; // Current magazine ammo (null if unknown/melee)
  hasDefuseKit: boolean;
  hasBomb: boolean;
  money: number;

  // Flash effects
  flashDuration: number;    // Remaining flash duration in seconds
  flashAlpha: number;       // Flash intensity 0-255 (0=none, 255=full blind)
}

/**
 * All players' state at a specific tick
 */
export interface TickFrame {
  tick: number;
  time: number; // Seconds from round start
  players: PlayerFrame[];
}

// ============================================================================
// Replay Events
// ============================================================================

export type ReplayEventType =
  | "KILL"
  | "DAMAGE"
  | "BOMB_PLANT"
  | "BOMB_DEFUSE"
  | "BOMB_EXPLODE"
  | "FLASH_EFFECT"
  | "SMOKE_START"
  | "SMOKE_END"
  | "MOLOTOV_START"
  | "MOLOTOV_END"
  | "HE_EXPLODE"
  | "FOOTSTEP"
  | "SHOT_FIRED"
  | "GRENADE_THROW";

export interface ReplayEventBase {
  type: ReplayEventType;
  tick: number;
  time: number;
  x: number;
  y: number;
  z: number;
}

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

export interface DamageEvent extends ReplayEventBase {
  type: "DAMAGE";
  attackerSteamId?: string;
  victimSteamId: string;
  damage: number;
  weapon: string;
}

export interface BombEvent extends ReplayEventBase {
  type: "BOMB_PLANT" | "BOMB_DEFUSE" | "BOMB_EXPLODE";
  playerSteamId?: string;
  site?: string;
}

export interface GrenadeEvent extends ReplayEventBase {
  type:
    | "SMOKE_START"
    | "SMOKE_END"
    | "MOLOTOV_START"
    | "MOLOTOV_END"
    | "HE_EXPLODE"
    | "FLASH_EFFECT"
    | "GRENADE_THROW";
  throwerSteamId?: string;
  grenadeType?: string;
  radius?: number;
  duration?: number;
  endX?: number;
  endY?: number;
}

export type ReplayEvent =
  | KillEvent
  | DamageEvent
  | BombEvent
  | GrenadeEvent
  | ReplayEventBase;

// ============================================================================
// Round Replay Data
// ============================================================================

/**
 * Complete replay data for a round
 */
export interface RoundReplayData {
  demoId: string;
  roundNumber: number;

  // Round info
  startTick: number;
  endTick: number;
  winnerTeam: number;
  winReason: string;

  // Teams
  ctTeam: {
    name: string;
    players: string[]; // Steam IDs
    score: number;
  };
  tTeam: {
    name: string;
    players: string[]; // Steam IDs
    score: number;
  };

  // Frame data
  tickRate: number;
  sampleInterval: number; // Every N ticks
  frames: TickFrame[];

  // Events
  events: ReplayEvent[];
}

/**
 * Lightweight metadata for round selection
 */
export interface RoundMetadata {
  roundNumber: number;
  startTick: number;
  endTick: number;
  duration: number; // Seconds
  winnerTeam: number;
  winReason: string;
  ctScore: number;
  tScore: number;
  bombPlanted: boolean;
  bombSite?: string;
}

// ============================================================================
// Map Metadata
// ============================================================================

/**
 * Map radar coordinate system
 */
export interface MapRadarConfig {
  mapName: string;
  displayName?: string;

  // Coordinate transformation
  posX: number;
  posY: number;
  scale: number;

  // Radar dimensions
  radarWidth: number;
  radarHeight: number;

  // Multi-level support
  hasLowerLevel: boolean;
  lowerPosX?: number;
  lowerPosY?: number;
  lowerScale?: number;
  splitAltitude?: number;
}

// ============================================================================
// Streaming Types (NDJSON)
// ============================================================================

/**
 * NDJSON stream message types
 */
export type StreamMessageType =
  | "metadata"
  | "frame"
  | "event"
  | "end"
  | "error";

export interface StreamMessage {
  type: StreamMessageType;
  data: unknown;
}

export interface MetadataStreamMessage extends StreamMessage {
  type: "metadata";
  data: {
    demoId: string;
    roundNumber: number;
    startTick: number;
    endTick: number;
    tickRate: number;
    sampleInterval: number;
    totalFrames: number;
    map: MapRadarConfig;
  };
}

export interface FrameStreamMessage extends StreamMessage {
  type: "frame";
  data: TickFrame;
}

export interface EventStreamMessage extends StreamMessage {
  type: "event";
  data: ReplayEvent;
}

export interface EndStreamMessage extends StreamMessage {
  type: "end";
  data: {
    framesStreamed: number;
    eventsStreamed: number;
  };
}

export interface ErrorStreamMessage extends StreamMessage {
  type: "error";
  data: {
    message: string;
    code?: string;
  };
}

// ============================================================================
// Request/Response DTOs
// ============================================================================

export interface GetRoundReplayOptions {
  includeEvents?: boolean;
  sampleInterval?: number; // Override default sampling
  startTick?: number; // Partial replay
  endTick?: number;
}

export interface ReplayStreamOptions {
  sampleInterval?: number;
  includeEvents?: boolean;
  batchSize?: number; // Frames per chunk
}
