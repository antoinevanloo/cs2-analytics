/**
 * Utility Calculator - Grenade usage analysis
 *
 * Analyzes effectiveness of utility usage:
 * - Flash grenades: enemies blinded, blind duration, flash assists
 * - HE grenades: damage dealt, enemies damaged
 * - Molotov/Incendiary: damage, area denial time
 * - Smoke grenades: usage patterns
 *
 * Utility usage is a key differentiator between skill levels.
 * Pro players average ~15-20 utility damage per round.
 *
 * @module analysis/calculators/utility
 */

import type { GrenadeInput, KillInput } from "../types/inputs.types";
import type {
  UtilityMetrics,
  FlashMetrics,
  HEGrenadeMetrics,
  MolotovMetrics,
  SmokeMetrics,
  DecoyMetrics,
  PlayerUtilityComparison,
  SmokeKillsMetrics,
  SmokeKillWeaponStats,
  UtilityWasteMetrics,
} from "../types/utility.types";
import { groupBy } from "../utils/performance";

/**
 * Input for utility calculation
 */
export interface UtilityCalculationInput {
  /** Player's Steam ID */
  readonly steamId: string;

  /** All grenades in the match */
  readonly allGrenades: readonly GrenadeInput[];

  /** Total rounds played */
  readonly totalRounds: number;

  /** Flash assists from match stats (if available) */
  readonly flashAssists?: number;
}

/**
 * Calculate utility metrics for a player
 *
 * @param input - Player data and grenade events
 * @returns Utility metrics
 */
export function calculateUtility(input: UtilityCalculationInput): UtilityMetrics {
  const { steamId, allGrenades, totalRounds, flashAssists = 0 } = input;

  if (allGrenades.length === 0 || totalRounds === 0) {
    return createEmptyUtilityMetrics();
  }

  // Filter grenades thrown by this player
  const playerGrenades = allGrenades.filter(
    (g) => g.throwerSteamId === steamId
  );

  if (playerGrenades.length === 0) {
    return createEmptyUtilityMetrics();
  }

  // Group by type
  const grenadesByType = groupBy(playerGrenades, (g) => g.type.toLowerCase());

  // Calculate each type
  const flash = calculateFlashMetrics(
    grenadesByType.get("flashbang") || [],
    flashAssists
  );
  const heGrenade = calculateHEMetrics(grenadesByType.get("hegrenade") || []);
  const molotov = calculateMolotovMetrics([
    ...(grenadesByType.get("molotov") || []),
    ...(grenadesByType.get("incendiary") || []),
  ]);
  const smoke = calculateSmokeMetrics(
    grenadesByType.get("smoke") || grenadesByType.get("smokegrenade") || [],
    totalRounds
  );
  const decoy = calculateDecoyMetrics(grenadesByType.get("decoy") || []);

  // Calculate totals
  const totalUtilityDamage = heGrenade.damage + molotov.damage;
  const totalGrenadesThrown = playerGrenades.length;

  return {
    flash,
    heGrenade,
    molotov,
    smoke,
    decoy,
    totalUtilityDamage,
    utilityDamagePerRound: round2(totalUtilityDamage / totalRounds),
    totalGrenadesThrown,
    grenadesPerRound: round2(totalGrenadesThrown / totalRounds),
  };
}

/**
 * Calculate flash grenade metrics
 */
function calculateFlashMetrics(
  flashes: readonly GrenadeInput[],
  flashAssists: number
): FlashMetrics {
  if (flashes.length === 0) {
    return {
      thrown: 0,
      enemiesBlinded: 0,
      teammatesBlinded: 0,
      totalEnemyBlindDuration: 0,
      avgBlindDuration: 0,
      flashAssists: 0,
      effectivenessRate: 0,
      enemyTeammateRatio: 0,
      enemiesPerFlash: 0,
    };
  }

  let enemiesBlinded = 0;
  let teammatesBlinded = 0;
  let totalBlindDuration = 0;
  let effectiveFlashes = 0;

  for (const flash of flashes) {
    enemiesBlinded += flash.enemiesBlinded;
    teammatesBlinded += flash.teammatesBlinded;
    totalBlindDuration += flash.totalBlindDuration;

    if (flash.enemiesBlinded > 0) {
      effectiveFlashes++;
    }
  }

  const thrown = flashes.length;
  const avgBlindDuration =
    enemiesBlinded > 0 ? totalBlindDuration / enemiesBlinded : 0;

  return {
    thrown,
    enemiesBlinded,
    teammatesBlinded,
    totalEnemyBlindDuration: round2(totalBlindDuration),
    avgBlindDuration: round2(avgBlindDuration),
    flashAssists,
    effectivenessRate: round2((effectiveFlashes / thrown) * 100),
    enemyTeammateRatio:
      teammatesBlinded > 0
        ? round2(enemiesBlinded / teammatesBlinded)
        : enemiesBlinded,
    enemiesPerFlash: round2(enemiesBlinded / thrown),
  };
}

/**
 * Calculate HE grenade metrics
 */
function calculateHEMetrics(hes: readonly GrenadeInput[]): HEGrenadeMetrics {
  if (hes.length === 0) {
    return {
      thrown: 0,
      damage: 0,
      kills: 0,
      enemiesDamaged: 0,
      avgDamage: 0,
      hitRate: 0,
    };
  }

  let totalDamage = 0;
  let enemiesDamaged = 0;
  let effectiveHEs = 0;

  for (const he of hes) {
    totalDamage += he.damageDealt;
    enemiesDamaged += he.enemiesDamaged;

    if (he.damageDealt > 0) {
      effectiveHEs++;
    }
  }

  const thrown = hes.length;

  return {
    thrown,
    damage: totalDamage,
    kills: 0, // Would need to cross-reference with kills
    enemiesDamaged,
    avgDamage: round2(totalDamage / thrown),
    hitRate: round2((effectiveHEs / thrown) * 100),
  };
}

/**
 * Calculate Molotov/Incendiary metrics
 */
function calculateMolotovMetrics(
  molotovs: readonly GrenadeInput[]
): MolotovMetrics {
  if (molotovs.length === 0) {
    return {
      thrown: 0,
      damage: 0,
      kills: 0,
      enemiesDamaged: 0,
      avgDamage: 0,
      totalBurnTime: 0,
    };
  }

  let totalDamage = 0;
  let enemiesDamaged = 0;

  for (const molotov of molotovs) {
    totalDamage += molotov.damageDealt;
    enemiesDamaged += molotov.enemiesDamaged;
  }

  const thrown = molotovs.length;

  return {
    thrown,
    damage: totalDamage,
    kills: 0, // Would need to cross-reference with kills
    enemiesDamaged,
    avgDamage: round2(totalDamage / thrown),
    totalBurnTime: 0, // Would need more detailed data
  };
}

/**
 * Calculate smoke grenade metrics
 */
function calculateSmokeMetrics(
  smokes: readonly GrenadeInput[],
  totalRounds: number
): SmokeMetrics {
  return {
    thrown: smokes.length,
    perRound: round2(smokes.length / totalRounds),
  };
}

/**
 * Calculate decoy metrics
 */
function calculateDecoyMetrics(decoys: readonly GrenadeInput[]): DecoyMetrics {
  return {
    thrown: decoys.length,
  };
}

/**
 * Calculate team utility statistics
 */
export function calculateTeamUtility(
  playerUtilities: readonly {
    steamId: string;
    name: string;
    utility: UtilityMetrics;
  }[]
): {
  totalUtilityDamage: number;
  utilityDPR: number;
  avgFlashEffectiveness: number;
  topUtilityPlayer: { steamId: string; name: string; utilityDamage: number } | null;
  playerRankings: PlayerUtilityComparison[];
} {
  if (playerUtilities.length === 0) {
    return {
      totalUtilityDamage: 0,
      utilityDPR: 0,
      avgFlashEffectiveness: 0,
      topUtilityPlayer: null,
      playerRankings: [],
    };
  }

  let totalDamage = 0;
  let totalDPR = 0;
  let totalFlashEffectiveness = 0;
  let topPlayer: { steamId: string; name: string; utilityDamage: number } | null = null;

  const rankings: PlayerUtilityComparison[] = [];

  for (const player of playerUtilities) {
    const { utility } = player;

    totalDamage += utility.totalUtilityDamage;
    totalDPR += utility.utilityDamagePerRound;
    totalFlashEffectiveness += utility.flash.effectivenessRate;

    if (!topPlayer || utility.totalUtilityDamage > topPlayer.utilityDamage) {
      topPlayer = {
        steamId: player.steamId,
        name: player.name,
        utilityDamage: utility.totalUtilityDamage,
      };
    }

    // Calculate player scores
    const flashScore = Math.min(100, utility.flash.effectivenessRate * 1.5);
    const damageScore = Math.min(100, utility.utilityDamagePerRound * 5);
    const overallScore = (flashScore + damageScore) / 2;

    rankings.push({
      steamId: player.steamId,
      name: player.name,
      flashScore: round2(flashScore),
      damageScore: round2(damageScore),
      overallScore: round2(overallScore),
      utilityDPR: utility.utilityDamagePerRound,
      teamRank: 0,
    });
  }

  // Sort and assign ranks
  rankings.sort((a, b) => b.overallScore - a.overallScore);
  const rankedResults = rankings.map((r, i) => ({
    ...r,
    teamRank: i + 1,
  }));

  return {
    totalUtilityDamage: totalDamage,
    utilityDPR: round2(totalDPR / playerUtilities.length),
    avgFlashEffectiveness: round2(totalFlashEffectiveness / playerUtilities.length),
    topUtilityPlayer: topPlayer,
    playerRankings: rankedResults,
  };
}

/**
 * Analyze utility usage by round type
 */
export function analyzeUtilityByRoundType(
  grenades: readonly GrenadeInput[],
  roundTypes: ReadonlyMap<number, "pistol" | "eco" | "force" | "full_buy">
): {
  pistol: { thrown: number; damage: number };
  eco: { thrown: number; damage: number };
  force: { thrown: number; damage: number };
  fullBuy: { thrown: number; damage: number };
} {
  const result = {
    pistol: { thrown: 0, damage: 0 },
    eco: { thrown: 0, damage: 0 },
    force: { thrown: 0, damage: 0 },
    fullBuy: { thrown: 0, damage: 0 },
  };

  for (const grenade of grenades) {
    const roundType = roundTypes.get(grenade.roundNumber);
    if (!roundType) continue;

    switch (roundType) {
      case "pistol":
        result.pistol.thrown++;
        result.pistol.damage += grenade.damageDealt;
        break;
      case "eco":
        result.eco.thrown++;
        result.eco.damage += grenade.damageDealt;
        break;
      case "force":
        result.force.thrown++;
        result.force.damage += grenade.damageDealt;
        break;
      case "full_buy":
        result.fullBuy.thrown++;
        result.fullBuy.damage += grenade.damageDealt;
        break;
    }
  }

  return result;
}

/**
 * Get utility usage label
 */
export function getUtilityLabel(utilityDPR: number): string {
  if (utilityDPR >= 20) return "Elite";
  if (utilityDPR >= 15) return "Excellent";
  if (utilityDPR >= 10) return "Good";
  if (utilityDPR >= 5) return "Average";
  if (utilityDPR >= 2) return "Below Average";
  return "Poor";
}

// ============================================================================
// ADVANCED UTILITY METRICS
// ============================================================================

/**
 * Calculate smoke kills metrics
 *
 * Analyzes kills made through smoke - can indicate:
 * - Good game sense (knowing enemy positions)
 * - Pre-aiming common spots
 * - Luck
 *
 * @param kills - All kills by the player
 * @param deaths - All deaths of the player
 * @returns Smoke kills analysis
 */
export function calculateSmokeKillsMetrics(
  kills: readonly KillInput[],
  deaths: readonly KillInput[]
): SmokeKillsMetrics {
  if (kills.length === 0) {
    return createEmptySmokeKillsMetrics();
  }

  const throughSmokeKills = kills.filter((k) => k.thrusmoke);
  const deathsInSmoke = deaths.filter((d) => d.thrusmoke).length;

  // Group smoke kills by weapon
  const weaponMap = new Map<string, number>();
  for (const kill of throughSmokeKills) {
    const weapon = normalizeWeaponName(kill.weapon);
    weaponMap.set(weapon, (weaponMap.get(weapon) || 0) + 1);
  }

  const smokeKillWeapons: SmokeKillWeaponStats[] = [];
  const totalSmokeKills = throughSmokeKills.length;

  for (const [weapon, count] of weaponMap) {
    smokeKillWeapons.push({
      weapon,
      kills: count,
      percent: round2((count / Math.max(totalSmokeKills, 1)) * 100),
    });
  }
  smokeKillWeapons.sort((a, b) => b.kills - a.kills);

  // Calculate average distance for smoke kills
  const distances = throughSmokeKills.map((k) => k.distance ?? 1000);
  const avgSmokeKillDistance =
    distances.length > 0
      ? round2(distances.reduce((sum, d) => sum + d, 0) / distances.length)
      : 0;

  return {
    throughSmokeKills: totalSmokeKills,
    throughSmokePercent: round2((totalSmokeKills / kills.length) * 100),
    deathsInSmoke,
    smokeKD: round2(totalSmokeKills / Math.max(deathsInSmoke, 1)),
    smokeKillWeapons,
    avgSmokeKillDistance,
  };
}

/**
 * Calculate utility waste metrics
 *
 * Tracks ineffective utility usage to identify improvement areas.
 *
 * @param grenades - All grenades thrown by the player
 * @returns Waste analysis
 */
export function calculateUtilityWasteMetrics(
  grenades: readonly GrenadeInput[]
): UtilityWasteMetrics {
  if (grenades.length === 0) {
    return createEmptyUtilityWasteMetrics();
  }

  // Group by type
  const flashes = grenades.filter((g) => g.type.toLowerCase() === "flashbang");
  const hes = grenades.filter((g) => g.type.toLowerCase() === "hegrenade");
  const molotovs = grenades.filter(
    (g) =>
      g.type.toLowerCase() === "molotov" || g.type.toLowerCase() === "incendiary"
  );

  // Count wasted grenades
  const wastedFlashes = flashes.filter((f) => f.enemiesBlinded === 0).length;
  const teamFlashes = flashes.filter((f) => f.teammatesBlinded > 0 && f.enemiesBlinded === 0).length;
  const wastedHEs = hes.filter((h) => h.damageDealt === 0).length;
  const wastedMolotovs = molotovs.filter((m) => m.damageDealt === 0).length;

  // Calculate percentages
  const wastedFlashPercent =
    flashes.length > 0 ? round2((wastedFlashes / flashes.length) * 100) : 0;
  const teamFlashPercent =
    flashes.length > 0 ? round2((teamFlashes / flashes.length) * 100) : 0;
  const wastedHEPercent =
    hes.length > 0 ? round2((wastedHEs / hes.length) * 100) : 0;
  const wastedMolotovPercent =
    molotovs.length > 0 ? round2((wastedMolotovs / molotovs.length) * 100) : 0;

  // Calculate wasted value (approximate grenade costs)
  const GRENADE_COSTS = {
    flashbang: 200,
    hegrenade: 300,
    molotov: 400,
    incendiary: 600,
    smokegrenade: 300,
    decoy: 50,
  };

  let totalWastedValue = 0;
  totalWastedValue += wastedFlashes * GRENADE_COSTS.flashbang;
  totalWastedValue += wastedHEs * GRENADE_COSTS.hegrenade;
  totalWastedValue += wastedMolotovs * GRENADE_COSTS.molotov;

  // Calculate waste score (0-100, lower is better)
  // Weighted: flashes most important, then HEs, then molotovs
  const wasteScore = round2(
    wastedFlashPercent * 0.5 +
    wastedHEPercent * 0.3 +
    wastedMolotovPercent * 0.2 +
    teamFlashPercent * 0.3
  );

  return {
    wastedFlashes,
    wastedFlashPercent,
    teamFlashes,
    teamFlashPercent,
    wastedHEs,
    wastedHEPercent,
    wastedMolotovs,
    wastedMolotovPercent,
    totalWastedValue,
    wasteScore: Math.min(100, wasteScore),
  };
}

/**
 * Calculate overall utility score
 *
 * Combines multiple utility metrics into a single score.
 *
 * @param metrics - Base utility metrics
 * @param waste - Waste metrics
 * @returns Score 0-100
 */
export function calculateUtilityScore(
  metrics: UtilityMetrics,
  waste: UtilityWasteMetrics
): { score: number; label: string } {
  // Components:
  // - Flash effectiveness (40%)
  // - Utility DPR vs average (30%)
  // - Low waste (30%)

  const flashScore = Math.min(100, metrics.flash.effectivenessRate * 1.5);

  // DPR score (15 = 100 points, scaled)
  const dprScore = Math.min(100, (metrics.utilityDamagePerRound / 15) * 100);

  // Waste score (inverted - lower waste = higher score)
  const wasteScore = 100 - waste.wasteScore;

  const overall = round2(
    flashScore * 0.4 + dprScore * 0.3 + wasteScore * 0.3
  );

  const label = getUtilityLabel(metrics.utilityDamagePerRound);

  return { score: overall, label };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Normalize weapon name for grouping
 */
function normalizeWeaponName(weapon: string): string {
  const normalized = weapon.toLowerCase().replace("weapon_", "");

  const weaponMap: Record<string, string> = {
    ak47: "AK-47",
    m4a1: "M4A1-S",
    m4a1_silencer: "M4A1-S",
    m4a4: "M4A4",
    awp: "AWP",
    deagle: "Desert Eagle",
    desert_eagle: "Desert Eagle",
  };

  return weaponMap[normalized] || weapon;
}

function createEmptySmokeKillsMetrics(): SmokeKillsMetrics {
  return {
    throughSmokeKills: 0,
    throughSmokePercent: 0,
    deathsInSmoke: 0,
    smokeKD: 0,
    smokeKillWeapons: [],
    avgSmokeKillDistance: 0,
  };
}

function createEmptyUtilityWasteMetrics(): UtilityWasteMetrics {
  return {
    wastedFlashes: 0,
    wastedFlashPercent: 0,
    teamFlashes: 0,
    teamFlashPercent: 0,
    wastedHEs: 0,
    wastedHEPercent: 0,
    wastedMolotovs: 0,
    wastedMolotovPercent: 0,
    totalWastedValue: 0,
    wasteScore: 0,
  };
}

function createEmptyUtilityMetrics(): UtilityMetrics {
  return {
    flash: {
      thrown: 0,
      enemiesBlinded: 0,
      teammatesBlinded: 0,
      totalEnemyBlindDuration: 0,
      avgBlindDuration: 0,
      flashAssists: 0,
      effectivenessRate: 0,
      enemyTeammateRatio: 0,
      enemiesPerFlash: 0,
    },
    heGrenade: {
      thrown: 0,
      damage: 0,
      kills: 0,
      enemiesDamaged: 0,
      avgDamage: 0,
      hitRate: 0,
    },
    molotov: {
      thrown: 0,
      damage: 0,
      kills: 0,
      enemiesDamaged: 0,
      avgDamage: 0,
      totalBurnTime: 0,
    },
    smoke: {
      thrown: 0,
      perRound: 0,
    },
    decoy: {
      thrown: 0,
    },
    totalUtilityDamage: 0,
    utilityDamagePerRound: 0,
    totalGrenadesThrown: 0,
    grenadesPerRound: 0,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
