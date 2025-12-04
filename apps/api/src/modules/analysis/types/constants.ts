/**
 * Analysis Constants - Magic numbers with documentation
 *
 * All configurable values and coefficients are centralized here.
 * Each constant includes documentation explaining its source and purpose.
 *
 * @module analysis/types/constants
 */

/**
 * HLTV Rating 2.0 coefficients
 *
 * These are the official weights used in the HLTV Rating 2.0 formula.
 * Formula: Rating = 0.0073*KAST + 0.3591*KPR - 0.5329*DPR + 0.2372*Impact + 0.0032*ADR + 0.1587
 *
 * Reference: https://www.hltv.org/news/20695/introducing-rating-20
 * Last verified: 2024
 */
export const HLTV_RATING_COEFFICIENTS = {
  /** KAST coefficient: how much KAST% affects rating */
  KAST: 0.0073,

  /** Kills per round coefficient */
  KPR: 0.3591,

  /** Deaths per round coefficient (negative impact) */
  DPR: -0.5329,

  /** Impact rating coefficient */
  IMPACT: 0.2372,

  /** ADR coefficient */
  ADR: 0.0032,

  /** Constant term (baseline) */
  CONSTANT: 0.1587,
} as const;

/**
 * Impact rating calculation weights
 *
 * Impact measures how much a player's actions affected round outcomes.
 * Based on HLTV methodology with multi-kills and opening duels weighted.
 */
export const IMPACT_WEIGHTS = {
  /** Base KPR multiplier for impact */
  KPR_MULTIPLIER: 2.13,

  /** Assists per round multiplier */
  APR_MULTIPLIER: 0.42,

  /** Constant offset */
  CONSTANT: -0.41,

  /** Multi-kill bonuses (added per occurrence) */
  MULTI_KILL: {
    TWO_K: 0.1,
    THREE_K: 0.2,
    FOUR_K: 0.35,
    FIVE_K: 0.5,
  },

  /** Opening duel impact */
  OPENING: {
    WIN: 0.15,
    LOSS: -0.1,
  },
} as const;

/**
 * Trade detection threshold in ticks
 *
 * A kill is considered a "trade" if it happens within this threshold
 * after a teammate's death, killing the teammate's killer.
 *
 * At 64 tick: 320 ticks = 5 seconds
 * At 128 tick: 320 ticks = 2.5 seconds
 *
 * Industry standard is typically 3-5 seconds.
 */
export const TRADE_THRESHOLD_TICKS = 320;

/**
 * Economy thresholds (in dollars)
 *
 * Used to classify round types based on team equipment value.
 */
export const ECONOMY_THRESHOLDS = {
  /** Below this = eco round */
  ECO: 2000,

  /** Below this but above ECO = force buy */
  FORCE_BUY: 4000,

  /** Above FORCE_BUY = full buy */
  FULL_BUY: 4000,

  /** Pistol round typical equipment value */
  PISTOL_MAX: 1000,
} as const;

/**
 * Rating benchmarks by skill level
 *
 * These are approximate HLTV Rating 2.0 values for different skill levels.
 * Used for contextualizing player performance.
 */
export const RATING_BENCHMARKS = {
  /** Elite professional level */
  ELITE_PRO: 1.2,

  /** Good professional level */
  GOOD_PRO: 1.1,

  /** Average professional level */
  AVERAGE_PRO: 1.0,

  /** Below average pro / high semi-pro */
  BELOW_AVERAGE: 0.9,

  /** FACEIT Level 10 average */
  FACEIT_10: 1.05,

  /** FACEIT Level 8-9 average */
  FACEIT_8_9: 0.95,

  /** FACEIT Level 5-7 average */
  FACEIT_5_7: 0.85,

  /** FACEIT Level 1-4 average */
  FACEIT_1_4: 0.75,
} as const;

/**
 * Minimum rounds for reliable statistics
 *
 * Statistics become more reliable with more data.
 * These thresholds indicate when metrics become meaningful.
 */
export const MINIMUM_ROUNDS = {
  /** Minimum for basic stats (K/D, ADR) */
  BASIC_STATS: 5,

  /** Minimum for rating calculation */
  RATING: 10,

  /** Minimum for trend analysis */
  TREND: 30,

  /** Minimum for reliable KAST */
  KAST: 15,
} as const;

/**
 * Clutch situation definitions
 */
export const CLUTCH_DEFINITIONS = {
  /** Maximum opponents for it to be considered a clutch */
  MAX_OPPONENTS: 5,

  /** Minimum opponents for it to be considered a clutch */
  MIN_OPPONENTS: 1,
} as const;

/**
 * Tick rate constants
 */
export const TICK_RATES = {
  /** Standard MM tick rate */
  MATCHMAKING: 64,

  /** FACEIT/ESEA tick rate */
  COMPETITIVE: 128,

  /** Seconds per tick at 64 tick */
  SECONDS_PER_TICK_64: 1 / 64,

  /** Seconds per tick at 128 tick */
  SECONDS_PER_TICK_128: 1 / 128,
} as const;
