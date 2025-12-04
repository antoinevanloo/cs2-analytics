/**
 * Combat Types - Core combat performance metrics
 *
 * These types define the fundamental combat statistics:
 * - Kills, Deaths, Assists
 * - K/D ratio
 * - ADR (Average Damage per Round)
 * - Headshot percentage
 *
 * @module analysis/types/combat
 */

/**
 * Combat Statistics
 *
 * Core combat performance metrics that form the foundation
 * of player evaluation. These are the most commonly referenced stats.
 */
export interface CombatMetrics {
  /** Total kills */
  readonly kills: number;

  /** Total deaths */
  readonly deaths: number;

  /** Total assists */
  readonly assists: number;

  /**
   * Kill/Death ratio
   * Formula: kills / max(deaths, 1)
   * Note: We use max(deaths, 1) to avoid division by zero
   */
  readonly kd: number;

  /**
   * Kill/Death difference
   * Formula: kills - deaths
   * Positive = more kills than deaths
   */
  readonly kdDiff: number;

  /**
   * Average Damage per Round
   * Formula: totalDamage / roundsPlayed
   * Pro average: ~75-85 ADR
   */
  readonly adr: number;

  /**
   * Headshot percentage (0-100)
   * Formula: (headshotKills / kills) * 100
   * Note: Only counts kills, not damage
   */
  readonly hsPercent: number;

  /** Number of kills that were headshots */
  readonly headshotKills: number;

  /** Total damage dealt across all rounds */
  readonly totalDamage: number;

  /** Rounds played (denominator for per-round calculations) */
  readonly roundsPlayed: number;

  /** Kills per round (used in rating calculation) */
  readonly kpr: number;

  /** Deaths per round (used in rating calculation) */
  readonly dpr: number;

  /** Assists per round */
  readonly apr: number;
}

/**
 * Weapon-specific combat statistics
 *
 * Breakdown of combat performance by weapon category.
 * Useful for identifying player strengths and playstyle.
 */
export interface WeaponCombatMetrics {
  /** Weapon name or category */
  readonly weapon: string;

  /** Kills with this weapon */
  readonly kills: number;

  /** Deaths while holding this weapon */
  readonly deaths: number;

  /** Headshot kills with this weapon */
  readonly headshotKills: number;

  /** Headshot percentage for this weapon */
  readonly hsPercent: number;

  /** Damage dealt with this weapon */
  readonly damage: number;

  /** Percentage of total kills with this weapon */
  readonly killShare: number;
}

/**
 * Combat metrics by round type
 *
 * Performance breakdown by economic situation.
 */
export interface CombatByRoundType {
  /** Performance in pistol rounds */
  readonly pistol: CombatMetrics;

  /** Performance in eco rounds */
  readonly eco: CombatMetrics;

  /** Performance in force buy rounds */
  readonly forceBuy: CombatMetrics;

  /** Performance in full buy rounds */
  readonly fullBuy: CombatMetrics;
}

/**
 * Combat metrics by side
 *
 * T-side vs CT-side performance comparison.
 */
export interface CombatBySide {
  /** Counter-Terrorist side performance */
  readonly ct: CombatMetrics;

  /** Terrorist side performance */
  readonly t: CombatMetrics;
}

/**
 * Special kills metrics
 *
 * Tracks impressive or skill-expressive kills:
 * - Wallbangs (penetration kills)
 * - No-scope kills (sniper without scope)
 * - Through smoke kills
 * - Blind kills (attacker was flashed)
 * - Flash-assisted kills (victim was flashed by teammate)
 */
export interface SpecialKillsMetrics {
  /**
   * Wallbang kills (penetration > 0)
   * Kills through walls, doors, or other surfaces
   */
  readonly wallbangs: number;

  /** Wallbang percentage of total kills */
  readonly wallbangPercent: number;

  /**
   * No-scope kills
   * Sniper rifle kills without using the scope
   */
  readonly noscopes: number;

  /** No-scope percentage of sniper kills */
  readonly noscopePercent: number;

  /**
   * Through smoke kills
   * Kills where the bullet traveled through smoke
   */
  readonly throughSmoke: number;

  /** Through smoke percentage of total kills */
  readonly throughSmokePercent: number;

  /**
   * Blind kills
   * Kills made while the attacker was flashed
   */
  readonly whileBlind: number;

  /** Blind kill percentage of total kills */
  readonly whileBlindPercent: number;

  /**
   * Flash-assisted kills
   * Kills where the victim was flashed by a teammate
   */
  readonly flashAssisted: number;

  /** Flash-assisted percentage of total kills */
  readonly flashAssistedPercent: number;

  /**
   * Airborne kills (killed enemy mid-air or while jumping)
   * Note: Requires position data to detect
   */
  readonly airborne: number;

  /** Total special kills (sum of all special types) */
  readonly totalSpecialKills: number;

  /** Special kills as percentage of total kills */
  readonly specialKillsPercent: number;
}

/**
 * Kill distance classification
 */
export type KillDistanceRange = "close" | "medium" | "long" | "extreme";

/**
 * Kill distance breakdown
 *
 * Analyzes kills by distance to understand playstyle:
 * - Close range: Entry fraggers, aggressive players
 * - Long range: AWPers, passive players
 */
export interface KillDistanceMetrics {
  /**
   * Close range kills (0-500 units, ~0-5m)
   * Typical for entry frags, pistol rounds
   */
  readonly close: DistanceRangeStats;

  /**
   * Medium range kills (500-1500 units, ~5-15m)
   * Standard rifle engagement range
   */
  readonly medium: DistanceRangeStats;

  /**
   * Long range kills (1500-3000 units, ~15-30m)
   * AWP territory, long angles
   */
  readonly long: DistanceRangeStats;

  /**
   * Extreme range kills (3000+ units, ~30m+)
   * Cross-map shots, rare
   */
  readonly extreme: DistanceRangeStats;

  /** Average kill distance in units */
  readonly avgDistance: number;

  /** Median kill distance in units */
  readonly medianDistance: number;

  /** Preferred engagement range based on kill distribution */
  readonly preferredRange: KillDistanceRange;

  /** Distance consistency (lower = more versatile) */
  readonly distanceVariance: number;
}

/**
 * Statistics for a specific distance range
 */
export interface DistanceRangeStats {
  /** Kills in this range */
  readonly kills: number;

  /** Percentage of total kills */
  readonly percent: number;

  /** Headshot percentage in this range */
  readonly hsPercent: number;

  /** Average damage per kill in this range */
  readonly avgDamage: number;
}

/**
 * Multi-kill round statistics
 *
 * Tracks rounds with multiple kills - indicator of impact.
 */
export interface MultiKillMetrics {
  /** 2-kill rounds */
  readonly twoK: number;

  /** 3-kill rounds */
  readonly threeK: number;

  /** 4-kill rounds */
  readonly fourK: number;

  /** 5-kill rounds (aces) */
  readonly fiveK: number;

  /** Total multi-kill rounds (2K+) */
  readonly totalMultiKillRounds: number;

  /** Multi-kill round percentage */
  readonly multiKillPercent: number;

  /** Average kills in multi-kill rounds */
  readonly avgKillsInMultiRounds: number;

  /** Impact score from multi-kills */
  readonly impactScore: number;
}

/**
 * First blood (opening kill) statistics
 *
 * First kills have significant round impact.
 * Tracked separately from opening duels for detailed analysis.
 */
export interface FirstBloodMetrics {
  /** First kills secured */
  readonly firstKills: number;

  /** First deaths suffered */
  readonly firstDeaths: number;

  /** First kill/death difference */
  readonly fkDiff: number;

  /**
   * First kill rate (0-100)
   * Percentage of rounds where player got first kill
   */
  readonly firstKillRate: number;

  /**
   * First death rate (0-100)
   * Percentage of rounds where player died first
   */
  readonly firstDeathRate: number;

  /** First kill weapons breakdown */
  readonly firstKillWeapons: readonly WeaponFirstKillStats[];

  /** First kill success rate (rounds won after first kill) */
  readonly roundWinRateAfterFK: number;

  /** First death recovery rate (rounds won after first death) */
  readonly roundWinRateAfterFD: number;
}

/**
 * First kill weapon statistics
 */
export interface WeaponFirstKillStats {
  readonly weapon: string;
  readonly firstKills: number;
  readonly percent: number;
}

/**
 * Damage breakdown by body part
 *
 * Understanding where damage lands can indicate aim quality.
 * Note: Requires detailed damage events with hitgroup data.
 */
export interface DamageDistributionMetrics {
  /** Head damage dealt */
  readonly headDamage: number;

  /** Head damage percentage */
  readonly headPercent: number;

  /** Chest/body damage dealt */
  readonly bodyDamage: number;

  /** Body damage percentage */
  readonly bodyPercent: number;

  /** Leg damage dealt */
  readonly legDamage: number;

  /** Leg damage percentage */
  readonly legPercent: number;

  /** Arm damage dealt */
  readonly armDamage: number;

  /** Arm damage percentage */
  readonly armPercent: number;

  /** Total damage dealt */
  readonly totalDamage: number;

  /** Damage efficiency (head+body / total) - higher = better aim */
  readonly damageEfficiency: number;
}

/**
 * Extended combat analysis
 *
 * Comprehensive combat profile including all breakdowns.
 */
export interface ExtendedCombatMetrics {
  /** Overall combat stats */
  readonly overall: CombatMetrics;

  /** By weapon breakdown */
  readonly byWeapon: readonly WeaponCombatMetrics[];

  /** By round type breakdown */
  readonly byRoundType: CombatByRoundType;

  /** By side breakdown */
  readonly bySide: CombatBySide;

  /** Top weapons by kills */
  readonly topWeapons: readonly string[];

  /** Special kills analysis */
  readonly specialKills: SpecialKillsMetrics;

  /** Kill distance analysis */
  readonly killDistance: KillDistanceMetrics;

  /** Multi-kill rounds */
  readonly multiKills: MultiKillMetrics;

  /** First blood statistics */
  readonly firstBlood: FirstBloodMetrics;
}

/**
 * Combat skill indicators
 *
 * Derived metrics that indicate specific skills.
 */
export interface CombatSkillIndicators {
  /** Aim quality (based on HS%, damage efficiency) */
  readonly aimQuality: SkillRating;

  /** Aggression level (based on first kills, entry attempts) */
  readonly aggression: SkillRating;

  /** Consistency (based on variance in performance) */
  readonly consistency: SkillRating;

  /** Clutch ability */
  readonly clutchAbility: SkillRating;

  /** Trade awareness */
  readonly tradeAwareness: SkillRating;

  /** Overall combat skill */
  readonly overall: SkillRating;
}

/**
 * Skill rating with score and label
 */
export interface SkillRating {
  /** Numeric score (0-100) */
  readonly score: number;

  /** Descriptive label */
  readonly label: SkillLabel;

  /** Percentile rank (0-100) */
  readonly percentile: number;
}

/**
 * Skill level labels
 */
export type SkillLabel =
  | "Elite"
  | "Excellent"
  | "Good"
  | "Average"
  | "Below Average"
  | "Poor";
