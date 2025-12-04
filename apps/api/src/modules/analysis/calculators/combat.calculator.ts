/**
 * Combat Calculator - Pure functions for combat statistics
 *
 * Calculates fundamental combat metrics:
 * - Kills, Deaths, Assists
 * - K/D ratio
 * - ADR (Average Damage per Round)
 * - Headshot percentage
 * - Kills/Deaths per round
 *
 * All functions are pure: same input always produces same output.
 * No side effects, no database access.
 *
 * @module analysis/calculators/combat
 */

import type {
  KillInput,
  RoundPlayerStatsInput,
  MatchPlayerStatsInput,
} from "../types/inputs.types";
import type {
  CombatMetrics,
  WeaponCombatMetrics,
  CombatBySide,
  CombatByRoundType,
  SpecialKillsMetrics,
  KillDistanceMetrics,
  KillDistanceRange,
  DistanceRangeStats,
  MultiKillMetrics,
  FirstBloodMetrics,
  WeaponFirstKillStats,
} from "../types/combat.types";
import { ECONOMY_THRESHOLDS } from "../types/constants";

/**
 * Calculate combat metrics from round stats
 *
 * @param roundStats - Array of per-round stats for a player
 * @returns Combat metrics
 *
 * @example
 * ```typescript
 * const combat = calculateCombatMetrics(playerRoundStats);
 * console.log(`ADR: ${combat.adr}, K/D: ${combat.kd}`);
 * ```
 */
export function calculateCombatMetrics(
  roundStats: readonly RoundPlayerStatsInput[]
): CombatMetrics {
  if (roundStats.length === 0) {
    return createEmptyCombatMetrics();
  }

  const totalKills = sumField(roundStats, "kills");
  const totalDeaths = sumField(roundStats, "deaths");
  const totalAssists = sumField(roundStats, "assists");
  const totalDamage = sumField(roundStats, "damage");
  const roundsPlayed = roundStats.length;

  // K/D uses max(deaths, 1) to avoid division by zero
  const kd = safeDiv(totalKills, Math.max(totalDeaths, 1));
  const kdDiff = totalKills - totalDeaths;

  // Per-round metrics
  const kpr = safeDiv(totalKills, roundsPlayed);
  const dpr = safeDiv(totalDeaths, roundsPlayed);
  const apr = safeDiv(totalAssists, roundsPlayed);
  const adr = safeDiv(totalDamage, roundsPlayed);

  // Note: headshot kills need to come from kill data, not round stats
  // This will be enriched when we have kill data
  const headshotKills = 0;
  const hsPercent = 0;

  return {
    kills: totalKills,
    deaths: totalDeaths,
    assists: totalAssists,
    kd: round2(kd),
    kdDiff,
    adr: round2(adr),
    hsPercent: round2(hsPercent),
    headshotKills,
    totalDamage,
    roundsPlayed,
    kpr: round4(kpr),
    dpr: round4(dpr),
    apr: round4(apr),
  };
}

/**
 * Calculate combat metrics from match stats with kill data
 *
 * This version includes headshot data from kill events.
 *
 * @param matchStats - Match-level player stats
 * @param kills - Kill events where player was attacker
 * @param roundsPlayed - Total rounds in the match
 * @returns Combat metrics with headshot data
 */
export function calculateCombatMetricsFromMatch(
  matchStats: MatchPlayerStatsInput,
  kills: readonly KillInput[],
  roundsPlayed: number
): CombatMetrics {
  const playerKills = kills.filter(
    (k) => k.attackerSteamId === matchStats.steamId
  );
  const headshotKills = playerKills.filter((k) => k.headshot).length;
  const hsPercent =
    matchStats.kills > 0 ? (headshotKills / matchStats.kills) * 100 : 0;

  // K/D uses max(deaths, 1) to avoid division by zero
  const kd = safeDiv(matchStats.kills, Math.max(matchStats.deaths, 1));
  const kdDiff = matchStats.kills - matchStats.deaths;

  // Per-round metrics
  const kpr = safeDiv(matchStats.kills, roundsPlayed);
  const dpr = safeDiv(matchStats.deaths, roundsPlayed);
  const apr = safeDiv(matchStats.assists, roundsPlayed);
  const adr = safeDiv(matchStats.damage, roundsPlayed);

  return {
    kills: matchStats.kills,
    deaths: matchStats.deaths,
    assists: matchStats.assists,
    kd: round2(kd),
    kdDiff,
    adr: round2(adr),
    hsPercent: round2(hsPercent),
    headshotKills,
    totalDamage: matchStats.damage,
    roundsPlayed,
    kpr: round4(kpr),
    dpr: round4(dpr),
    apr: round4(apr),
  };
}

/**
 * Calculate weapon-specific combat statistics
 *
 * @param kills - All kills by the player
 * @param deaths - All deaths of the player (for weapon held at death)
 * @returns Array of weapon stats sorted by kills
 */
export function calculateWeaponStats(
  kills: readonly KillInput[]
): readonly WeaponCombatMetrics[] {
  if (kills.length === 0) {
    return [];
  }

  // Group kills by weapon
  const weaponMap = new Map<
    string,
    {
      kills: number;
      headshotKills: number;
      damage: number;
    }
  >();

  for (const kill of kills) {
    const weapon = normalizeWeaponName(kill.weapon);
    const existing = weaponMap.get(weapon) || {
      kills: 0,
      headshotKills: 0,
      damage: 0,
    };

    existing.kills++;
    if (kill.headshot) {
      existing.headshotKills++;
    }
    // Note: damage per kill is not available in kill events
    // We estimate based on kill (assume 100 damage for kill)
    existing.damage += 100;

    weaponMap.set(weapon, existing);
  }

  const totalKills = kills.length;

  // Convert to array and sort by kills
  const weaponStats: WeaponCombatMetrics[] = [];

  for (const [weapon, stats] of weaponMap) {
    weaponStats.push({
      weapon,
      kills: stats.kills,
      deaths: 0, // Would need death data with weapon held
      headshotKills: stats.headshotKills,
      hsPercent: round2(safeDiv(stats.headshotKills * 100, stats.kills)),
      damage: stats.damage,
      killShare: round2(safeDiv(stats.kills * 100, totalKills)),
    });
  }

  // Sort by kills descending
  weaponStats.sort((a, b) => b.kills - a.kills);

  return weaponStats;
}

/**
 * Calculate combat metrics by side (T vs CT)
 *
 * @param roundStats - Round stats including side information
 * @param sideByRound - Map of round number to side (2=T, 3=CT)
 * @returns Combat metrics split by side
 */
export function calculateCombatBySide(
  roundStats: readonly RoundPlayerStatsInput[],
  sideByRound: ReadonlyMap<number, number>
): CombatBySide {
  const ctRounds = roundStats.filter(
    (r) => sideByRound.get(r.roundNumber) === 3
  );
  const tRounds = roundStats.filter(
    (r) => sideByRound.get(r.roundNumber) === 2
  );

  return {
    ct: calculateCombatMetrics(ctRounds),
    t: calculateCombatMetrics(tRounds),
  };
}

/**
 * Calculate combat metrics by round type (eco, force, full buy)
 *
 * @param roundStats - Round stats including equipment value
 * @returns Combat metrics split by round type
 */
export function calculateCombatByRoundType(
  roundStats: readonly RoundPlayerStatsInput[]
): CombatByRoundType {
  const pistolRounds = roundStats.filter(
    (r) => r.roundNumber === 1 || r.roundNumber === 13
  );
  const ecoRounds = roundStats.filter(
    (r) =>
      !isPistolRound(r.roundNumber) &&
      r.equipValue < ECONOMY_THRESHOLDS.ECO
  );
  const forceRounds = roundStats.filter(
    (r) =>
      !isPistolRound(r.roundNumber) &&
      r.equipValue >= ECONOMY_THRESHOLDS.ECO &&
      r.equipValue < ECONOMY_THRESHOLDS.FULL_BUY
  );
  const fullBuyRounds = roundStats.filter(
    (r) =>
      !isPistolRound(r.roundNumber) &&
      r.equipValue >= ECONOMY_THRESHOLDS.FULL_BUY
  );

  return {
    pistol: calculateCombatMetrics(pistolRounds),
    eco: calculateCombatMetrics(ecoRounds),
    forceBuy: calculateCombatMetrics(forceRounds),
    fullBuy: calculateCombatMetrics(fullBuyRounds),
  };
}

/**
 * Calculate multi-kill rounds
 *
 * @param roundStats - Round stats for a player
 * @returns Count of rounds with 2, 3, 4, 5 kills
 */
export function calculateMultiKillRounds(
  roundStats: readonly RoundPlayerStatsInput[]
): {
  twoK: number;
  threeK: number;
  fourK: number;
  fiveK: number;
} {
  let twoK = 0;
  let threeK = 0;
  let fourK = 0;
  let fiveK = 0;

  for (const round of roundStats) {
    if (round.kills === 2) twoK++;
    else if (round.kills === 3) threeK++;
    else if (round.kills === 4) fourK++;
    else if (round.kills >= 5) fiveK++;
  }

  return { twoK, threeK, fourK, fiveK };
}

/**
 * Calculate special kills metrics
 *
 * Analyzes impressive/skill-expressive kills:
 * - Wallbangs (penetration)
 * - No-scopes (sniper without scope)
 * - Through smoke
 * - Blind kills (attacker flashed)
 * - Flash-assisted (victim flashed)
 *
 * @param kills - All kills by the player
 * @returns Special kills breakdown
 */
export function calculateSpecialKills(
  kills: readonly KillInput[]
): SpecialKillsMetrics {
  if (kills.length === 0) {
    return createEmptySpecialKills();
  }

  const totalKills = kills.length;

  // Count each special kill type
  const wallbangs = kills.filter((k) => k.penetrated > 0).length;
  const noscopes = kills.filter((k) => k.noscope).length;
  const throughSmoke = kills.filter((k) => k.thrusmoke).length;
  const whileBlind = kills.filter((k) => k.attackerblind).length;
  const flashAssisted = kills.filter((k) => k.assistedflash).length;

  // Count sniper kills for noscope percentage
  const sniperWeapons = ["awp", "ssg08", "g3sg1", "scar20"];
  const sniperKills = kills.filter((k) =>
    sniperWeapons.includes(k.weapon.toLowerCase().replace("weapon_", ""))
  ).length;

  // Calculate total special kills (some kills may be multiple types)
  // We count unique kills that have at least one special attribute
  const specialKillsSet = new Set<number>();
  kills.forEach((k, idx) => {
    if (
      k.penetrated > 0 ||
      k.noscope ||
      k.thrusmoke ||
      k.attackerblind ||
      k.assistedflash
    ) {
      specialKillsSet.add(idx);
    }
  });
  const totalSpecialKills = specialKillsSet.size;

  return {
    wallbangs,
    wallbangPercent: round2(safeDiv(wallbangs * 100, totalKills)),
    noscopes,
    noscopePercent: round2(safeDiv(noscopes * 100, Math.max(sniperKills, 1))),
    throughSmoke,
    throughSmokePercent: round2(safeDiv(throughSmoke * 100, totalKills)),
    whileBlind,
    whileBlindPercent: round2(safeDiv(whileBlind * 100, totalKills)),
    flashAssisted,
    flashAssistedPercent: round2(safeDiv(flashAssisted * 100, totalKills)),
    airborne: 0, // Requires position data
    totalSpecialKills,
    specialKillsPercent: round2(safeDiv(totalSpecialKills * 100, totalKills)),
  };
}

/**
 * Distance thresholds in game units
 * CS2 uses Source 2 units where ~52 units = 1 meter
 */
const DISTANCE_THRESHOLDS = {
  CLOSE: 500, // ~0-10m (pistol/entry range)
  MEDIUM: 1500, // ~10-29m (rifle range)
  LONG: 3000, // ~29-58m (AWP range)
  // > 3000 = extreme
} as const;

/**
 * Calculate kill distance metrics
 *
 * Analyzes kills by engagement distance to understand playstyle:
 * - Close: Entry fraggers, aggressive
 * - Medium: Standard rifle play
 * - Long: AWPers, passive angles
 * - Extreme: Cross-map shots
 *
 * @param kills - All kills by the player
 * @returns Distance breakdown and statistics
 */
export function calculateKillDistance(
  kills: readonly KillInput[]
): KillDistanceMetrics {
  if (kills.length === 0) {
    return createEmptyKillDistance();
  }

  // Separate kills by distance range
  const closeKills: KillInput[] = [];
  const mediumKills: KillInput[] = [];
  const longKills: KillInput[] = [];
  const extremeKills: KillInput[] = [];

  const distances: number[] = [];

  for (const kill of kills) {
    // Handle null distance (default to medium range if unknown)
    const distance = kill.distance ?? 1000;
    distances.push(distance);

    if (distance < DISTANCE_THRESHOLDS.CLOSE) {
      closeKills.push(kill);
    } else if (distance < DISTANCE_THRESHOLDS.MEDIUM) {
      mediumKills.push(kill);
    } else if (distance < DISTANCE_THRESHOLDS.LONG) {
      longKills.push(kill);
    } else {
      extremeKills.push(kill);
    }
  }

  const totalKills = kills.length;

  // Calculate stats for each range
  const close = calculateRangeStats(closeKills, totalKills);
  const medium = calculateRangeStats(mediumKills, totalKills);
  const long = calculateRangeStats(longKills, totalKills);
  const extreme = calculateRangeStats(extremeKills, totalKills);

  // Calculate overall statistics
  const avgDistance = round2(
    distances.reduce((sum, d) => sum + d, 0) / totalKills
  );

  // Median
  const sorted = [...distances].sort((a, b) => a - b);
  const medianDistance =
    totalKills % 2 === 0
      ? round2((sorted[totalKills / 2 - 1]! + sorted[totalKills / 2]!) / 2)
      : round2(sorted[Math.floor(totalKills / 2)]!);

  // Determine preferred range (highest kill percentage)
  const ranges: { range: KillDistanceRange; percent: number }[] = [
    { range: "close", percent: close.percent },
    { range: "medium", percent: medium.percent },
    { range: "long", percent: long.percent },
    { range: "extreme", percent: extreme.percent },
  ];
  const preferredRange = ranges.reduce((max, r) =>
    r.percent > max.percent ? r : max
  ).range;

  // Calculate variance (spread in distance preferences)
  const mean = avgDistance;
  const variance =
    distances.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / totalKills;
  const distanceVariance = round2(Math.sqrt(variance));

  return {
    close,
    medium,
    long,
    extreme,
    avgDistance,
    medianDistance,
    preferredRange,
    distanceVariance,
  };
}

/**
 * Calculate statistics for a distance range
 */
function calculateRangeStats(
  kills: readonly KillInput[],
  totalKills: number
): DistanceRangeStats {
  const count = kills.length;
  const headshots = kills.filter((k) => k.headshot).length;

  return {
    kills: count,
    percent: round2(safeDiv(count * 100, totalKills)),
    hsPercent: round2(safeDiv(headshots * 100, Math.max(count, 1))),
    avgDamage: 100, // Kills are assumed to be 100 damage
  };
}

/**
 * Calculate enriched multi-kill metrics
 *
 * Provides comprehensive multi-kill analysis with impact scoring.
 *
 * @param roundStats - Round stats for a player
 * @returns Detailed multi-kill breakdown
 */
export function calculateMultiKillMetrics(
  roundStats: readonly RoundPlayerStatsInput[]
): MultiKillMetrics {
  const basic = calculateMultiKillRounds(roundStats);

  const totalMultiKillRounds =
    basic.twoK + basic.threeK + basic.fourK + basic.fiveK;

  const roundsPlayed = roundStats.length;
  const multiKillPercent = round2(
    safeDiv(totalMultiKillRounds * 100, roundsPlayed)
  );

  // Calculate average kills in multi-kill rounds
  const totalKillsInMulti =
    basic.twoK * 2 + basic.threeK * 3 + basic.fourK * 4 + basic.fiveK * 5;
  const avgKillsInMultiRounds =
    totalMultiKillRounds > 0
      ? round2(totalKillsInMulti / totalMultiKillRounds)
      : 0;

  // Impact score: weighted sum of multi-kills
  // Weights based on relative difficulty/impact
  const impactScore = round2(
    basic.twoK * 1.0 + basic.threeK * 2.5 + basic.fourK * 5.0 + basic.fiveK * 10.0
  );

  return {
    twoK: basic.twoK,
    threeK: basic.threeK,
    fourK: basic.fourK,
    fiveK: basic.fiveK,
    totalMultiKillRounds,
    multiKillPercent,
    avgKillsInMultiRounds,
    impactScore,
  };
}

/**
 * Calculate first blood (opening kill) metrics
 *
 * Detailed analysis of first kills/deaths and their impact.
 *
 * @param steamId - Player's Steam ID
 * @param kills - All kills in the match
 * @param roundStats - Player's round stats
 * @param roundWinners - Map of round number to winning team
 * @param playerTeam - Player's team number
 * @returns First blood analysis
 */
export function calculateFirstBloodMetrics(
  steamId: string,
  kills: readonly KillInput[],
  roundStats: readonly RoundPlayerStatsInput[],
  roundWinners?: ReadonlyMap<number, number>,
  playerTeam?: number
): FirstBloodMetrics {
  const roundsPlayed = roundStats.length;

  if (roundsPlayed === 0) {
    return createEmptyFirstBlood();
  }

  // Group kills by round and find first kills
  const killsByRound = new Map<number, KillInput[]>();
  for (const kill of kills) {
    const existing = killsByRound.get(kill.roundNumber) || [];
    existing.push(kill);
    killsByRound.set(kill.roundNumber, existing);
  }

  let firstKills = 0;
  let firstDeaths = 0;
  let roundsWonAfterFK = 0;
  let roundsWonAfterFD = 0;
  const firstKillWeaponMap = new Map<string, number>();

  // Analyze each round
  for (const [roundNumber, roundKills] of killsByRound) {
    // Sort by tick to find first kill
    const sortedKills = [...roundKills].sort((a, b) => a.tick - b.tick);
    const firstKill = sortedKills[0];

    if (!firstKill) continue;

    const didGetFirstKill = firstKill.attackerSteamId === steamId;
    const didDieFirst = firstKill.victimSteamId === steamId;

    if (didGetFirstKill) {
      firstKills++;
      const weapon = normalizeWeaponName(firstKill.weapon);
      firstKillWeaponMap.set(weapon, (firstKillWeaponMap.get(weapon) || 0) + 1);

      // Check if round was won
      if (roundWinners && playerTeam) {
        if (roundWinners.get(roundNumber) === playerTeam) {
          roundsWonAfterFK++;
        }
      }
    }

    if (didDieFirst) {
      firstDeaths++;

      // Check if round was won despite first death
      if (roundWinners && playerTeam) {
        if (roundWinners.get(roundNumber) === playerTeam) {
          roundsWonAfterFD++;
        }
      }
    }
  }

  // Build weapon breakdown
  const firstKillWeapons: WeaponFirstKillStats[] = [];
  for (const [weapon, count] of firstKillWeaponMap) {
    firstKillWeapons.push({
      weapon,
      firstKills: count,
      percent: round2(safeDiv(count * 100, Math.max(firstKills, 1))),
    });
  }
  firstKillWeapons.sort((a, b) => b.firstKills - a.firstKills);

  return {
    firstKills,
    firstDeaths,
    fkDiff: firstKills - firstDeaths,
    firstKillRate: round2(safeDiv(firstKills * 100, roundsPlayed)),
    firstDeathRate: round2(safeDiv(firstDeaths * 100, roundsPlayed)),
    firstKillWeapons,
    roundWinRateAfterFK: round2(
      safeDiv(roundsWonAfterFK * 100, Math.max(firstKills, 1))
    ),
    roundWinRateAfterFD: round2(
      safeDiv(roundsWonAfterFD * 100, Math.max(firstDeaths, 1))
    ),
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create empty combat metrics
 */
function createEmptyCombatMetrics(): CombatMetrics {
  return {
    kills: 0,
    deaths: 0,
    assists: 0,
    kd: 0,
    kdDiff: 0,
    adr: 0,
    hsPercent: 0,
    headshotKills: 0,
    totalDamage: 0,
    roundsPlayed: 0,
    kpr: 0,
    dpr: 0,
    apr: 0,
  };
}

/**
 * Create empty special kills metrics
 */
function createEmptySpecialKills(): SpecialKillsMetrics {
  return {
    wallbangs: 0,
    wallbangPercent: 0,
    noscopes: 0,
    noscopePercent: 0,
    throughSmoke: 0,
    throughSmokePercent: 0,
    whileBlind: 0,
    whileBlindPercent: 0,
    flashAssisted: 0,
    flashAssistedPercent: 0,
    airborne: 0,
    totalSpecialKills: 0,
    specialKillsPercent: 0,
  };
}

/**
 * Create empty kill distance metrics
 */
function createEmptyKillDistance(): KillDistanceMetrics {
  const emptyRange: DistanceRangeStats = {
    kills: 0,
    percent: 0,
    hsPercent: 0,
    avgDamage: 0,
  };

  return {
    close: emptyRange,
    medium: emptyRange,
    long: emptyRange,
    extreme: emptyRange,
    avgDistance: 0,
    medianDistance: 0,
    preferredRange: "medium",
    distanceVariance: 0,
  };
}

/**
 * Create empty first blood metrics
 */
function createEmptyFirstBlood(): FirstBloodMetrics {
  return {
    firstKills: 0,
    firstDeaths: 0,
    fkDiff: 0,
    firstKillRate: 0,
    firstDeathRate: 0,
    firstKillWeapons: [],
    roundWinRateAfterFK: 0,
    roundWinRateAfterFD: 0,
  };
}

/**
 * Sum a numeric field across an array of objects
 */
function sumField(
  items: readonly RoundPlayerStatsInput[],
  field: keyof RoundPlayerStatsInput
): number {
  return items.reduce((sum, item) => {
    const value = item[field];
    return sum + (typeof value === "number" ? value : 0);
  }, 0);
}

/**
 * Safe division that returns 0 for division by zero
 */
function safeDiv(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Round to 2 decimal places
 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Round to 4 decimal places (for KPR, DPR)
 */
function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * Check if round is a pistol round
 */
function isPistolRound(roundNumber: number): boolean {
  return roundNumber === 1 || roundNumber === 13;
}

/**
 * Normalize weapon names for grouping
 *
 * Handles variations in weapon naming from different sources.
 */
function normalizeWeaponName(weapon: string): string {
  const normalized = weapon.toLowerCase().replace("weapon_", "");

  // Map common variations
  const weaponMap: Record<string, string> = {
    ak47: "AK-47",
    m4a1: "M4A1-S",
    m4a1_silencer: "M4A1-S",
    m4a4: "M4A4",
    awp: "AWP",
    deagle: "Desert Eagle",
    desert_eagle: "Desert Eagle",
    glock: "Glock-18",
    glock18: "Glock-18",
    usp: "USP-S",
    usp_silencer: "USP-S",
    p2000: "P2000",
    fiveseven: "Five-SeveN",
    tec9: "Tec-9",
    p250: "P250",
    cz75a: "CZ75-Auto",
    cz75: "CZ75-Auto",
    knife: "Knife",
    knife_t: "Knife",
    knife_default_ct: "Knife",
    hegrenade: "HE Grenade",
    molotov: "Molotov",
    incgrenade: "Incendiary",
    inferno: "Molotov/Incendiary",
  };

  return weaponMap[normalized] || weapon;
}
