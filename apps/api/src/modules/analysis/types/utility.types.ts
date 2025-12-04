/**
 * Utility Types - Grenade usage analysis
 *
 * Utility usage is a key differentiator between skill levels.
 * Good utility usage can:
 * - Create advantages (flashes, smokes)
 * - Deal damage (HE, molotov)
 * - Gather information (decoy through smoke)
 *
 * @module analysis/types/utility
 */

/**
 * Utility Metrics
 *
 * Complete grenade usage statistics.
 */
export interface UtilityMetrics {
  /** Flash grenade statistics */
  readonly flash: FlashMetrics;

  /** HE grenade statistics */
  readonly heGrenade: HEGrenadeMetrics;

  /** Molotov/Incendiary statistics */
  readonly molotov: MolotovMetrics;

  /** Smoke grenade statistics */
  readonly smoke: SmokeMetrics;

  /** Decoy statistics */
  readonly decoy: DecoyMetrics;

  /** Total utility damage (HE + Molotov) */
  readonly totalUtilityDamage: number;

  /** Utility damage per round */
  readonly utilityDamagePerRound: number;

  /** Total grenades thrown */
  readonly totalGrenadesThrown: number;

  /** Grenades per round */
  readonly grenadesPerRound: number;
}

/**
 * Flash grenade metrics
 *
 * Flashes are one of the most skill-expressive utilities.
 * Good flash usage creates significant advantages.
 */
export interface FlashMetrics {
  /** Total flashes thrown */
  readonly thrown: number;

  /** Total enemies blinded */
  readonly enemiesBlinded: number;

  /** Total teammates blinded (should minimize) */
  readonly teammatesBlinded: number;

  /** Total blind duration inflicted on enemies (seconds) */
  readonly totalEnemyBlindDuration: number;

  /** Average blind duration per enemy flash */
  readonly avgBlindDuration: number;

  /** Flash assists (teammate killed blinded enemy) */
  readonly flashAssists: number;

  /**
   * Effectiveness rate (0-100)
   * Formula: (flashes that blinded enemies / thrown) * 100
   */
  readonly effectivenessRate: number;

  /**
   * Enemy/Teammate blind ratio
   * Higher = better (more enemies blinded than teammates)
   */
  readonly enemyTeammateRatio: number;

  /** Enemies blinded per flash */
  readonly enemiesPerFlash: number;
}

/**
 * HE grenade metrics
 */
export interface HEGrenadeMetrics {
  /** Total HE grenades thrown */
  readonly thrown: number;

  /** Total damage dealt */
  readonly damage: number;

  /** Kills with HE grenades */
  readonly kills: number;

  /** Enemies damaged */
  readonly enemiesDamaged: number;

  /** Average damage per HE grenade */
  readonly avgDamage: number;

  /** HE grenades that dealt damage / total thrown */
  readonly hitRate: number;
}

/**
 * Molotov/Incendiary metrics
 */
export interface MolotovMetrics {
  /** Total molotovs/incendiaries thrown */
  readonly thrown: number;

  /** Total damage dealt */
  readonly damage: number;

  /** Kills with molotov/incendiary */
  readonly kills: number;

  /** Enemies damaged */
  readonly enemiesDamaged: number;

  /** Average damage per molotov */
  readonly avgDamage: number;

  /** Total burn time inflicted (seconds) */
  readonly totalBurnTime: number;
}

/**
 * Smoke grenade metrics
 */
export interface SmokeMetrics {
  /** Total smokes thrown */
  readonly thrown: number;

  /** Smokes per round */
  readonly perRound: number;

  // Future enhancements:
  // - Smoke effectiveness (did it block sightlines)
  // - Time enemies delayed
  // - Kills through smoke prevented
}

/**
 * Decoy metrics
 */
export interface DecoyMetrics {
  /** Total decoys thrown */
  readonly thrown: number;

  // Decoys are rarely impactful but can be tracked
}

/**
 * Individual grenade event
 */
export interface GrenadeEvent {
  /** Round number */
  readonly roundNumber: number;

  /** Tick when grenade was thrown/detonated */
  readonly tick: number;

  /** Grenade type */
  readonly type: GrenadeType;

  /** Thrower steam ID */
  readonly throwerSteamId: string;

  /** Thrower name */
  readonly throwerName: string;

  /** Thrower team */
  readonly throwerTeam: number;

  /** Position where grenade landed/detonated */
  readonly position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };

  /** Damage dealt (if applicable) */
  readonly damage: number;

  /** Enemies affected */
  readonly enemiesAffected: number;

  /** Teammates affected */
  readonly teammatesAffected: number;
}

/**
 * Grenade type enum
 */
export type GrenadeType =
  | "flashbang"
  | "hegrenade"
  | "smokegrenade"
  | "molotov"
  | "incendiary"
  | "decoy";

/**
 * Player utility comparison
 *
 * Used for comparing utility usage between players.
 */
export interface PlayerUtilityComparison {
  readonly steamId: string;
  readonly name: string;

  /** Flash effectiveness score (0-100) */
  readonly flashScore: number;

  /** Damage utility score (0-100) */
  readonly damageScore: number;

  /** Overall utility score (0-100) */
  readonly overallScore: number;

  /** Utility damage per round */
  readonly utilityDPR: number;

  /** Rank among team */
  readonly teamRank: number;
}

/**
 * Team utility statistics
 */
export interface TeamUtilityMetrics {
  /** Team number */
  readonly teamNumber: number;

  /** Team name */
  readonly teamName: string;

  /** Total utility damage dealt */
  readonly totalUtilityDamage: number;

  /** Utility damage per round */
  readonly utilityDPR: number;

  /** Flash statistics */
  readonly flash: {
    readonly totalThrown: number;
    readonly totalEnemiesBlinded: number;
    readonly effectivenessRate: number;
  };

  /** Best utility player */
  readonly topUtilityPlayer: {
    readonly steamId: string;
    readonly name: string;
    readonly utilityDamage: number;
  };

  /** Player rankings by utility effectiveness */
  readonly playerRankings: readonly PlayerUtilityComparison[];
}

// ============================================================================
// ADVANCED UTILITY METRICS
// ============================================================================

/**
 * Flash-assisted kills analysis
 *
 * Correlates flash usage with kills to measure flash impact.
 */
export interface FlashAssistedKillsMetrics {
  /** Total kills where victim was flashed by teammate */
  readonly flashAssistedKills: number;

  /** Percentage of kills that were flash-assisted */
  readonly flashAssistedPercent: number;

  /** Kills secured after throwing own flash */
  readonly killsAfterOwnFlash: number;

  /** Average time between flash and kill (seconds) */
  readonly avgTimeToKillAfterFlash: number;

  /** Flash-to-kill conversion rate */
  readonly flashToKillConversion: number;

  /** Top flash partners (teammates who flash for this player) */
  readonly topFlashPartners: readonly FlashPartnerStats[];
}

/**
 * Flash partner statistics
 */
export interface FlashPartnerStats {
  /** Partner's Steam ID */
  readonly steamId: string;

  /** Partner's name */
  readonly name: string;

  /** Kills assisted by this partner's flashes */
  readonly assistedKills: number;

  /** Total flashes thrown that assisted */
  readonly flashesThrown: number;

  /** Conversion rate (kills / flashes) */
  readonly conversionRate: number;
}

/**
 * Smoke kills analysis
 *
 * Tracks kills through smoke - indicator of game sense or luck.
 */
export interface SmokeKillsMetrics {
  /** Kills made through smoke */
  readonly throughSmokeKills: number;

  /** Percentage of kills that were through smoke */
  readonly throughSmokePercent: number;

  /** Deaths while in smoke */
  readonly deathsInSmoke: number;

  /** Smoke K/D (through smoke kills vs deaths in smoke) */
  readonly smokeKD: number;

  /** Weapons most used for smoke kills */
  readonly smokeKillWeapons: readonly SmokeKillWeaponStats[];

  /** Average distance for through-smoke kills */
  readonly avgSmokeKillDistance: number;
}

/**
 * Smoke kill weapon breakdown
 */
export interface SmokeKillWeaponStats {
  readonly weapon: string;
  readonly kills: number;
  readonly percent: number;
}

/**
 * Utility timing analysis
 *
 * When utility is used during rounds.
 */
export interface UtilityTimingMetrics {
  /** Early round utility (first 20 seconds) */
  readonly earlyRound: UtilityTimingPhase;

  /** Mid round utility (20-60 seconds) */
  readonly midRound: UtilityTimingPhase;

  /** Late round utility (60+ seconds) */
  readonly lateRound: UtilityTimingPhase;

  /** Post-plant utility usage */
  readonly postPlant: UtilityTimingPhase;

  /** Retake utility usage */
  readonly retake: UtilityTimingPhase;

  /** Average time to first utility usage (seconds into round) */
  readonly avgFirstUtilityTime: number;
}

/**
 * Utility usage in a specific phase
 */
export interface UtilityTimingPhase {
  /** Grenades thrown in this phase */
  readonly grenadesThrown: number;

  /** Percentage of total grenades */
  readonly percent: number;

  /** Flash effectiveness in this phase */
  readonly flashEffectiveness: number;

  /** Damage dealt in this phase */
  readonly damage: number;
}

/**
 * Utility waste analysis
 *
 * Tracks ineffective utility usage.
 */
export interface UtilityWasteMetrics {
  /** Flashes that hit no enemies */
  readonly wastedFlashes: number;

  /** Wasted flash percentage */
  readonly wastedFlashPercent: number;

  /** Team flashes (flashed teammates) */
  readonly teamFlashes: number;

  /** Team flash percentage */
  readonly teamFlashPercent: number;

  /** HE grenades that dealt no damage */
  readonly wastedHEs: number;

  /** Wasted HE percentage */
  readonly wastedHEPercent: number;

  /** Molotovs that dealt no damage */
  readonly wastedMolotovs: number;

  /** Wasted molotov percentage */
  readonly wastedMolotovPercent: number;

  /** Total utility value wasted ($) */
  readonly totalWastedValue: number;

  /** Waste score (0-100, lower is better) */
  readonly wasteScore: number;
}

/**
 * Utility economy analysis
 *
 * Economic impact of utility purchases.
 */
export interface UtilityEconomyMetrics {
  /** Total spent on utility */
  readonly totalUtilitySpent: number;

  /** Average utility spend per round */
  readonly avgUtilitySpendPerRound: number;

  /** Utility as percentage of total equipment */
  readonly utilitySpendPercent: number;

  /** Damage per dollar spent on utility */
  readonly damagePerDollar: number;

  /** Estimated value generated (kills assisted * estimated kill value) */
  readonly valueGenerated: number;

  /** ROI (value generated / spent) */
  readonly utilityROI: number;

  /** Rounds with full utility (4 grenades) */
  readonly fullUtilityRounds: number;

  /** Percentage of buy rounds with full utility */
  readonly fullUtilityPercent: number;
}

/**
 * Extended utility metrics
 *
 * Comprehensive utility profile.
 */
export interface ExtendedUtilityMetrics {
  /** Core utility metrics */
  readonly core: UtilityMetrics;

  /** Flash-assisted kills analysis */
  readonly flashAssisted: FlashAssistedKillsMetrics;

  /** Through-smoke kills analysis */
  readonly smokeKills: SmokeKillsMetrics;

  /** Utility timing breakdown */
  readonly timing: UtilityTimingMetrics;

  /** Utility waste analysis */
  readonly waste: UtilityWasteMetrics;

  /** Utility economy analysis */
  readonly economy: UtilityEconomyMetrics;

  /** Overall utility score (0-100) */
  readonly overallScore: number;

  /** Utility skill label */
  readonly skillLabel: UtilitySkillLabel;
}

/**
 * Utility skill labels
 */
export type UtilitySkillLabel =
  | "Elite"
  | "Excellent"
  | "Good"
  | "Average"
  | "Below Average"
  | "Poor";
