/**
 * Transformer Interface - Contract for all demo data transformers
 *
 * Architecture Goals:
 * - Extensibility: Add new transformers without modifying existing code
 * - Testability: Each transformer is isolated and injectable
 * - Performance: Priority-based execution order for dependencies
 * - Resilience: Each transformer handles its own errors gracefully
 *
 * Usage:
 * 1. Implement Transformer interface
 * 2. Register in TransformerModule providers
 * 3. Orchestrator auto-discovers and executes by priority
 */

// Types are self-contained, no external imports needed

// =============================================================================
// INPUT TYPES - Data coming from parser
// =============================================================================

export interface DemoEvent {
  event_name?: string;
  tick?: number;
  round?: number;
  [key: string]: unknown;
}

export interface RoundInfo {
  id: string;
  roundNumber: number;
  startTick: number;
  endTick: number;
  freezeEndTick?: number | null;
  winnerTeam?: number;
  winReason?: string;
}

export interface PlayerInfo {
  steamId: string;
  playerName: string;
  teamNum: number;
  teamName?: string | null;
}

export interface DemoInfo {
  id: string;
  mapName: string;
  tickRate: number;
  totalTicks: number;
}

// =============================================================================
// CONTEXT - Shared data passed to all transformers
// =============================================================================

export interface TransformContext {
  /** Demo identifier */
  demoId: string;

  /** Demo metadata */
  demo: DemoInfo;

  /** Raw events from parser */
  events: DemoEvent[];

  /** Rounds with tick boundaries */
  rounds: RoundInfo[];

  /** Player information */
  players: PlayerInfo[];

  /** Optional configuration overrides */
  options?: TransformOptions;
}

export interface TransformOptions {
  /** Skip specific transformers by name */
  skip?: string[];

  /** Only run specific transformers */
  only?: string[];

  /** Enable verbose logging */
  verbose?: boolean;

  /** Batch size for database operations (default: 500) */
  batchSize?: number;

  /** Trade detection threshold in ticks (default: 320 = 5 seconds at 64 tick) */
  tradeThresholdTicks?: number;

  /** Clutch detection: minimum enemies to count as clutch (default: 1) */
  clutchMinEnemies?: number;
}

// =============================================================================
// RESULT - Output from each transformer
// =============================================================================

export interface TransformResult {
  /** Transformer name */
  transformer: string;

  /** Success status */
  success: boolean;

  /** Number of records created/modified */
  recordsCreated: number;

  /** Processing time in milliseconds */
  processingTimeMs: number;

  /** Additional metrics specific to transformer */
  metrics?: Record<string, number>;

  /** Errors encountered (non-fatal) */
  warnings?: string[];

  /** Fatal error message if success=false */
  error?: string;
}

// =============================================================================
// TRANSFORMER CONTRACT
// =============================================================================

/**
 * Base transformer interface
 *
 * All transformers must implement this contract.
 * Priority determines execution order (lower = runs first).
 *
 * Dependencies:
 * - KillExtractor (priority: 10) must run before TradeDetector (priority: 20)
 * - RoundStatsComputer (priority: 15) must run before ClutchDetector (priority: 25)
 */
export interface Transformer {
  /** Unique identifier for this transformer */
  readonly name: string;

  /** Execution priority (lower = runs first) */
  readonly priority: number;

  /** Human-readable description */
  readonly description: string;

  /**
   * Execute the transformation
   *
   * @param ctx - Transform context with demo data
   * @returns Result with success status and metrics
   *
   * Implementation notes:
   * - Must be idempotent (safe to re-run)
   * - Should use batch operations for performance
   * - Should log progress for visibility
   * - Must handle missing data gracefully
   */
  transform(ctx: TransformContext): Promise<TransformResult>;

  /**
   * Check if this transformer should run
   *
   * @param ctx - Transform context
   * @returns true if transformer should execute
   *
   * Use cases:
   * - Skip if required data is missing
   * - Skip if already processed (idempotency check)
   */
  shouldRun?(ctx: TransformContext): Promise<boolean>;

  /**
   * Cleanup/rollback on failure
   *
   * @param ctx - Transform context
   * @param error - Error that caused failure
   *
   * Optional: implement for atomic operations
   */
  rollback?(ctx: TransformContext, error: Error): Promise<void>;
}

// =============================================================================
// ORCHESTRATOR RESULT
// =============================================================================

export interface OrchestrationResult {
  /** Overall success (all transformers succeeded) */
  success: boolean;

  /** Total processing time */
  totalTimeMs: number;

  /** Results from each transformer */
  results: TransformResult[];

  /** Transformers that were skipped */
  skipped: string[];

  /** Summary metrics */
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    recordsCreated: number;
  };
}

// =============================================================================
// HELPER TYPES FOR EXTRACTORS
// =============================================================================

/** Player death event structure from demoparser2 */
export interface PlayerDeathEvent extends DemoEvent {
  event_name: "player_death";
  attacker_steamid?: string;
  attacker_name?: string;
  attacker_team?: number;
  attacker_X?: number;
  attacker_Y?: number;
  attacker_Z?: number;
  user_steamid?: string;
  user_name?: string;
  user_team?: number;
  user_X?: number;
  user_Y?: number;
  user_Z?: number;
  assister_steamid?: string;
  assister_name?: string;
  weapon?: string;
  headshot?: boolean;
  penetrated?: number;
  noscope?: boolean;
  thrusmoke?: boolean;
  attackerblind?: boolean;
  assistedflash?: boolean;
  distance?: number;
}

/** Player hurt event structure */
export interface PlayerHurtEvent extends DemoEvent {
  event_name: "player_hurt";
  attacker_steamid?: string;
  user_steamid?: string;
  dmg_health?: number;
  dmg_armor?: number;
  weapon?: string;
  hitgroup?: number;
}

/** Kill data for database insertion */
export interface KillData {
  demoId: string;
  roundId: string;
  tick: number;
  attackerSteamId: string | null;
  attackerName: string | null;
  attackerTeam: number | null;
  attackerX: number | null;
  attackerY: number | null;
  attackerZ: number | null;
  victimSteamId: string;
  victimName: string;
  victimTeam: number;
  victimX: number;
  victimY: number;
  victimZ: number;
  assisterSteamId: string | null;
  assisterName: string | null;
  weapon: string;
  headshot: boolean;
  penetrated: number;
  noscope: boolean;
  thrusmoke: boolean;
  attackerblind: boolean;
  assistedflash: boolean;
  distance: number | null;
  isSuicide: boolean;
  isTeamkill: boolean;
  isFirstKill: boolean;
  isTradeKill: boolean;
  tradedWithin: number | null;
}

/** Round player stats for database insertion */
export interface RoundPlayerStatsData {
  roundId: string;
  steamId: string;
  teamNum: number;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  equipValue: number;
  moneySpent: number;
  startBalance: number;
  survived: boolean;
  firstKill: boolean;
  firstDeath: boolean;
  clutchVs: number | null;
  clutchWon: boolean | null;
}

// =============================================================================
// INJECTION TOKENS
// =============================================================================

export const TRANSFORMER_TOKEN = Symbol("TRANSFORMER");
export const TRANSFORMER_REGISTRY_TOKEN = Symbol("TRANSFORMER_REGISTRY");
