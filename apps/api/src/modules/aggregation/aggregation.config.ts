/**
 * Aggregation Configuration
 *
 * Centralized configuration for all aggregation-related constants.
 * This file is the SINGLE SOURCE OF TRUTH for all aggregation settings.
 *
 * @module aggregation/config
 */

// =============================================================================
// TIME WINDOWS - Single source of truth
// =============================================================================

/**
 * Time window definitions for aggregation periods.
 * Used across all aggregation services and calculators.
 */
export const TIME_WINDOWS = {
  all_time: {
    id: "all_time",
    label: "All Time",
    description: "Complete player/team history",
    matchLimit: null,
    days: null,
  },
  last_90d: {
    id: "last_90d",
    label: "Last 90 Days",
    description: "Rolling 3-month window",
    matchLimit: null,
    days: 90,
  },
  last_30d: {
    id: "last_30d",
    label: "Last 30 Days",
    description: "Rolling 1-month window",
    matchLimit: null,
    days: 30,
  },
  last_7d: {
    id: "last_7d",
    label: "Last 7 Days",
    description: "Rolling 1-week window",
    matchLimit: null,
    days: 7,
  },
  last_10_matches: {
    id: "last_10_matches",
    label: "Last 10 Matches",
    description: "Most recent 10 games",
    matchLimit: 10,
    days: null,
  },
  last_20_matches: {
    id: "last_20_matches",
    label: "Last 20 Matches",
    description: "Most recent 20 games",
    matchLimit: 20,
    days: null,
  },
} as const;

export type TimeWindowKey = keyof typeof TIME_WINDOWS;
export type TimeWindowConfig = (typeof TIME_WINDOWS)[TimeWindowKey];

// =============================================================================
// CACHE CONFIGURATION
// =============================================================================

export const CACHE_CONFIG = {
  /** Time-to-live for player profile cache (in milliseconds) */
  PLAYER_PROFILE_TTL_MS: 6 * 60 * 60 * 1000, // 6 hours

  /** Time-to-live for team profile cache (in milliseconds) */
  TEAM_PROFILE_TTL_MS: 6 * 60 * 60 * 1000, // 6 hours

  /** Minimum matches required for peer stats comparison */
  MIN_MATCHES_FOR_PEER_STATS: 10,

  /** Batch size for loading multiple player profiles */
  PLAYER_BATCH_SIZE: 5,
} as const;

// =============================================================================
// JOB QUEUE CONFIGURATION
// =============================================================================

export const JOB_QUEUE_CONFIG = {
  /** Queue name for aggregation jobs */
  QUEUE_NAME: "demo-aggregation",

  /** Number of concurrent workers */
  CONCURRENCY: 3,

  /** Maximum time a job can run before being considered stalled (ms) */
  LOCK_DURATION_MS: 300_000, // 5 minutes

  /** Maximum stalled count before job is failed */
  MAX_STALLED_COUNT: 2,

  /** Delay before first retry on job failure (ms) */
  RETRY_BACKOFF_MS: 5_000, // 5 seconds

  /** Maximum number of retry attempts */
  MAX_RETRY_ATTEMPTS: 3,

  /** How long completed jobs are kept (seconds) */
  COMPLETED_JOB_RETENTION_S: 43_200, // 12 hours

  /** How long failed jobs are kept (seconds) */
  FAILED_JOB_RETENTION_S: 259_200, // 3 days
} as const;

// =============================================================================
// ROLE DETECTION CONFIGURATION
// =============================================================================

export const ROLE_DETECTION_CONFIG = {
  /**
   * Score thresholds for role assignment
   */
  THRESHOLDS: {
    /** Minimum score to be assigned a primary role */
    MIN_PRIMARY_ROLE_SCORE: 40,

    /** Secondary role must be at least this percentage of primary score */
    SECONDARY_ROLE_MIN_PERCENTAGE: 0.5, // 50%
  },

  /**
   * Weights for entry role scoring
   * Higher weights = more important for role determination
   */
  ENTRY_WEIGHTS: {
    openingDuelRate: 0.4,
    openingKillSuccess: 0.3,
    tradedRate: 0.15,
    firstContact: 0.15,
  },

  /**
   * Weights for AWPer role scoring
   */
  AWPER_WEIGHTS: {
    awpKillsPerMatch: 0.4,
    awpRoundParticipation: 0.3,
    longRangeKills: 0.2,
    holdingAngles: 0.1,
  },

  /**
   * Weights for support role scoring
   */
  SUPPORT_WEIGHTS: {
    flashAssistsPerRound: 0.35,
    tradeKillRate: 0.25,
    utilityDamage: 0.2,
    lowOpeningDuelRate: 0.2,
  },

  /**
   * Weights for lurker role scoring
   */
  LURKER_WEIGHTS: {
    lateRoundKills: 0.35,
    soloKills: 0.25,
    clutchParticipation: 0.2,
    loneSurvivor: 0.2,
  },

  /**
   * Weights for anchor role scoring
   */
  ANCHOR_WEIGHTS: {
    ctHoldKills: 0.35,
    retakeParticipation: 0.25,
    survivalRate: 0.2,
    siteDefenseSuccess: 0.2,
  },

  /**
   * Score normalization multipliers (to bring scores into 0-100 range)
   */
  SCORE_MULTIPLIERS: {
    entry: 150,
    awper: 200,
    support: 150,
    lurker: 200,
    anchor: 250,
  },

  /**
   * Thresholds for opening duel categorization
   */
  OPENING_DUEL_THRESHOLDS: {
    /** High opening duel participation (entry/awper indicator) */
    HIGH_PARTICIPATION: 0.5, // 50%
    /** Low opening duel participation (support indicator) */
    LOW_PARTICIPATION: 0.3, // 30%
  },
} as const;

// =============================================================================
// AIM STYLE CONFIGURATION
// =============================================================================

export const AIM_STYLE_CONFIG = {
  /**
   * Headshot percentage thresholds for aim style determination
   */
  HEADSHOT_THRESHOLDS: {
    /** HS% above this = headhunter style */
    HEADHUNTER: 60,
    /** HS% above this = precision style */
    PRECISION: 50,
    /** HS% above this = mixed style, below = spray transfer */
    MIXED: 35,
  },
} as const;

// =============================================================================
// FORM ANALYSIS CONFIGURATION
// =============================================================================

export const FORM_CONFIG = {
  /**
   * Form status multipliers relative to lifetime rating
   * A multiplier of 1.15 means recent rating is 15% above lifetime average
   */
  STATUS_THRESHOLDS: {
    /** "On fire" - exceptional recent form */
    ON_FIRE: {
      ratingMultiplier: 1.15,
      trendMultiplier: 1.05,
    },
    /** "Hot" - above average form */
    HOT: {
      ratingMultiplier: 1.1,
    },
    /** "Warm" - slightly above average */
    WARM: {
      ratingMultiplier: 1.02,
    },
    /** "Ice cold" - significantly below average */
    ICE_COLD: {
      ratingMultiplier: 0.85,
      trendMultiplier: 0.95,
    },
    /** "Cold" - below average */
    COLD: {
      ratingMultiplier: 0.9,
    },
    /** "Average" - default state */
    AVERAGE: {
      ratingMultiplier: 1.0,
    },
  },

  /**
   * Streak detection settings
   */
  STREAK: {
    /** Number of recent games to analyze for hot/cold detection */
    HOT_COLD_SAMPLE_SIZE: 3,
    /** Rating threshold for "hot streak" */
    HOT_RATING_THRESHOLD: 1.1,
    /** Rating threshold for "cold streak" */
    COLD_RATING_THRESHOLD: 0.9,
  },

  /**
   * Recent form analysis settings
   */
  RECENT_FORM: {
    /** Number of matches considered "recent" */
    MATCH_COUNT: 10,
    /** Rating threshold for a "bad game" (bounce-back analysis) */
    BAD_GAME_THRESHOLD: 0.8,
    /** Rating threshold for successful bounce-back */
    BOUNCE_BACK_THRESHOLD: 1.0,
  },
} as const;

// =============================================================================
// SKILL TIER CONFIGURATION
// =============================================================================

export const SKILL_TIER_CONFIG = {
  /**
   * Percentile thresholds for skill tier assignment
   * Players above the percentile get the tier
   */
  PERCENTILES: {
    S: 99,
    "A+": 95,
    A: 85,
    "B+": 70,
    B: 50,
    "C+": 30,
    C: 15,
    D: 0,
  },

  /**
   * Tier order for comparisons (higher index = higher tier)
   */
  TIER_ORDER: ["D", "C", "C+", "B", "B+", "A", "A+", "S"] as const,
} as const;

export type SkillTier = keyof typeof SKILL_TIER_CONFIG.PERCENTILES;

// =============================================================================
// COMBAT STATISTICS CONFIGURATION
// =============================================================================

export const COMBAT_CONFIG = {
  /**
   * Multi-kill definitions
   */
  MULTI_KILLS: {
    DOUBLE: 2,
    TRIPLE: 3,
    QUAD: 4,
    ACE: 5,
  },

  /**
   * Trade timing window (seconds)
   */
  TRADE_WINDOW_SECONDS: 5,

  /**
   * Clutch situation definitions (1vX)
   */
  CLUTCH_SITUATIONS: [1, 2, 3, 4, 5] as const,
} as const;

// =============================================================================
// ECONOMY CONFIGURATION
// =============================================================================

export const ECONOMY_CONFIG = {
  /**
   * Round economic value approximation (for clutch value calculation)
   */
  ROUND_WIN_VALUE: 3000,

  /**
   * Buy type thresholds (equipment value)
   */
  BUY_TYPE_THRESHOLDS: {
    /** Full buy threshold */
    FULL_BUY: 20000,
    /** Force buy range */
    FORCE_BUY_MIN: 10000,
    FORCE_BUY_MAX: 20000,
    /** Eco threshold */
    ECO_MAX: 10000,
  },

  /**
   * Default round type distribution for approximations
   * Used when exact data is unavailable
   */
  DEFAULT_ROUND_DISTRIBUTION: {
    pistol: 0.067, // ~2 rounds per 30
    eco: 0.15,
    force: 0.2,
    fullBuy: 0.5,
    antiEco: 0.083, // ~2.5 rounds per 30
  },

  /**
   * Expected win rates by round type (for quality estimation)
   */
  EXPECTED_WIN_RATES: {
    pistol: 0.5,
    eco: 0.15,
    force: 0.35,
    fullBuy: 0.55,
    antiEco: 0.85,
  },
} as const;

// =============================================================================
// UTILITY CONFIGURATION
// =============================================================================

export const UTILITY_CONFIG = {
  /**
   * Standard smoke duration (seconds)
   */
  SMOKE_DURATION_SECONDS: 18,

  /**
   * Flash effectiveness thresholds (seconds of blind time)
   */
  FLASH_EFFECTIVENESS: {
    EFFECTIVE_MIN: 2.0,
    TEAM_FLASH_THRESHOLD: 1.0,
  },

  /**
   * Utility damage expectations per round (for rating)
   */
  UTILITY_DAMAGE_BENCHMARKS: {
    EXCELLENT: 15,
    GOOD: 10,
    AVERAGE: 5,
    POOR: 2,
  },
} as const;

// =============================================================================
// CONSISTENCY CONFIGURATION
// =============================================================================

export const CONSISTENCY_CONFIG = {
  /**
   * Consistency score interpretation
   * Higher score = more consistent performance
   */
  RATING_VARIANCE_THRESHOLDS: {
    /** Very consistent (low variance) */
    VERY_CONSISTENT: 0.15,
    /** Consistent */
    CONSISTENT: 0.25,
    /** Moderate */
    MODERATE: 0.35,
    /** Inconsistent */
    INCONSISTENT: 0.45,
    /** Very inconsistent (high variance) */
    VERY_INCONSISTENT: 0.55,
  },
} as const;

// =============================================================================
// TEAM ANALYSIS CONFIGURATION
// =============================================================================

export const TEAM_CONFIG = {
  /**
   * Minimum players required for roster analysis
   */
  MIN_ROSTER_SIZE: 2,

  /**
   * Maximum players allowed for roster analysis
   */
  MAX_ROSTER_SIZE: 5,

  /**
   * Minimum players on same team to count as "playing together"
   */
  MIN_SAME_TEAM_COUNT: 3,

  /**
   * Close game definition (score difference)
   */
  CLOSE_GAME_THRESHOLD: 3,

  /**
   * Comeback definition (max rounds down before winning)
   */
  COMEBACK_THRESHOLD: 5,

  /**
   * Mental fortitude baseline (neutral score)
   */
  MENTAL_FORTITUDE_BASELINE: 50,

  /**
   * Trade efficiency estimation (percentage of deaths that are tradeable)
   */
  TRADEABLE_DEATH_PERCENTAGE: 0.6,
} as const;

// =============================================================================
// MAP CONFIGURATION
// =============================================================================

export const MAP_CONFIG = {
  /**
   * Standard competitive map pool
   */
  ACTIVE_DUTY_MAPS: [
    "de_ancient",
    "de_anubis",
    "de_dust2",
    "de_inferno",
    "de_mirage",
    "de_nuke",
    "de_vertigo",
  ] as const,

  /**
   * Default round distribution per half (MR12)
   */
  ROUNDS_PER_HALF: 12,

  /**
   * Overtime rounds per half
   */
  OVERTIME_ROUNDS_PER_HALF: 3,

  /**
   * Pistol rounds per game
   */
  PISTOL_ROUNDS_PER_GAME: 2,

  /**
   * Minimum rounds for map statistics to be meaningful
   */
  MIN_ROUNDS_FOR_STATS: 10,
} as const;

// =============================================================================
// PERCENTILE METRICS CONFIGURATION
// =============================================================================

export const PERCENTILE_METRICS = {
  /**
   * Metrics to calculate percentiles for
   */
  PLAYER_METRICS: [
    "rating",
    "kast",
    "adr",
    "kd",
    "hsPercent",
    "openingSuccessRate",
    "clutchSuccessRate",
    "impact",
    "utilityDamage",
  ] as const,

  /**
   * Default percentile values when calculation fails
   */
  DEFAULT_PERCENTILE: 50,
} as const;

// =============================================================================
// PEAK PERFORMANCE CONFIGURATION
// =============================================================================

export const PEAK_PERFORMANCE_CONFIG = {
  /**
   * Achievement thresholds
   */
  ACHIEVEMENTS: {
    /** Minimum kills for "40 bomb" achievement */
    FORTY_BOMB_KILLS: 40,
    /** Minimum rating for "rating 2+" achievement */
    RATING_2_PLUS: 2.0,
    /** Ace = 5 kills in a round */
    ACE_KILLS: 5,
    /** 4K = 4 kills in a round */
    QUAD_KILLS: 4,
  },
} as const;

// =============================================================================
// EXPORT HELPER FUNCTIONS
// =============================================================================

/**
 * Get time window configuration by key
 */
export function getTimeWindowConfig(key: TimeWindowKey): TimeWindowConfig {
  return TIME_WINDOWS[key];
}

/**
 * Get all time window keys
 */
export function getTimeWindowKeys(): TimeWindowKey[] {
  return Object.keys(TIME_WINDOWS) as TimeWindowKey[];
}

/**
 * Check if a time window is match-limited (vs date-limited)
 */
export function isMatchLimitedWindow(key: TimeWindowKey): boolean {
  return TIME_WINDOWS[key].matchLimit !== null;
}

/**
 * Get the appropriate filter for a time window
 */
export function getTimeWindowFilter(key: TimeWindowKey): {
  matchLimit?: number;
  dateFilter?: Date;
} {
  const config = TIME_WINDOWS[key];

  if (config.matchLimit !== null) {
    return { matchLimit: config.matchLimit };
  }

  if (config.days !== null) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - config.days);
    return { dateFilter: startDate };
  }

  return {};
}

/**
 * Determine skill tier from percentile
 */
export function getSkillTierFromPercentile(percentile: number): SkillTier {
  const { PERCENTILES } = SKILL_TIER_CONFIG;

  if (percentile >= PERCENTILES.S) return "S";
  if (percentile >= PERCENTILES["A+"]) return "A+";
  if (percentile >= PERCENTILES.A) return "A";
  if (percentile >= PERCENTILES["B+"]) return "B+";
  if (percentile >= PERCENTILES.B) return "B";
  if (percentile >= PERCENTILES["C+"]) return "C+";
  if (percentile >= PERCENTILES.C) return "C";
  return "D";
}

/**
 * Determine form status from rating comparison
 */
export function getFormStatus(
  recentRating: number,
  lifetimeRating: number,
  trendDirection: number
): "on_fire" | "hot" | "warm" | "average" | "cold" | "ice_cold" {
  const { STATUS_THRESHOLDS } = FORM_CONFIG;
  const ratio = recentRating / lifetimeRating;

  if (
    ratio >= STATUS_THRESHOLDS.ON_FIRE.ratingMultiplier &&
    trendDirection >= STATUS_THRESHOLDS.ON_FIRE.trendMultiplier - 1
  ) {
    return "on_fire";
  }

  if (ratio >= STATUS_THRESHOLDS.HOT.ratingMultiplier) {
    return "hot";
  }

  if (ratio >= STATUS_THRESHOLDS.WARM.ratingMultiplier) {
    return "warm";
  }

  if (
    ratio <= STATUS_THRESHOLDS.ICE_COLD.ratingMultiplier &&
    trendDirection <= STATUS_THRESHOLDS.ICE_COLD.trendMultiplier - 1
  ) {
    return "ice_cold";
  }

  if (ratio <= STATUS_THRESHOLDS.COLD.ratingMultiplier) {
    return "cold";
  }

  return "average";
}
