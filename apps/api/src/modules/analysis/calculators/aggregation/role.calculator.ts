/**
 * Role Analysis Calculator
 *
 * Pure functions for detecting player roles from aggregated statistics.
 * Uses multiple signals to determine primary and secondary roles.
 *
 * Roles:
 * - Entry: First contact, high opening duel rate
 * - AWPer: Primary sniper, AWP-centric
 * - Support: Flash assists, trades, utility damage
 * - Lurker: Late round kills, solo plays
 * - IGL: Hard to detect (requires comms analysis)
 * - Anchor: Site holds, retakes, clutches (CT-sided)
 *
 * @module analysis/calculators/aggregation/role
 */

import type {
  PlayerRoleAnalysis,
  PlayerRole,
  RoleIndicators,
  PlaystyleMetrics,
} from "../../types/aggregation.types";

import {
  ROLE_DETECTION_CONFIG,
  AIM_STYLE_CONFIG,
} from "../../../aggregation/aggregation.config";

// =============================================================================
// INPUT TYPES
// =============================================================================

/**
 * Stats needed for role detection
 */
export interface RoleDetectionInput {
  // Opening metrics
  readonly openingDuelRate: number; // % of rounds with opening duel attempt
  readonly openingSuccessRate: number;
  readonly firstContactRate: number; // % of rounds where player was first to engage

  // AWP metrics
  readonly awpUsageRate: number; // % of rounds with AWP
  readonly awpKillsPerRound: number;
  readonly awpKillShare: number; // % of total kills with AWP

  // Support metrics
  readonly flashAssistsPerRound: number;
  readonly tradeKillRate: number; // Trade kills / team deaths that could be traded
  readonly utilityDamagePerRound: number;
  readonly smokesPerRound: number;

  // Lurker metrics
  readonly lateRoundKillRate: number; // Kills in last 30% of round
  readonly soloKillRate: number; // Kills with no teammate nearby
  readonly clutchAttemptRate: number;

  // Anchor metrics (CT-specific)
  readonly ctSurvivalRate: number;
  readonly retakeParticipationRate: number;
  readonly clutchSuccessRate: number;

  // General
  readonly avgTimeAlive: number; // Normalized 0-1
  readonly killsPerRound: number;
  readonly deathsPerRound: number;
  readonly adr: number;
}

// =============================================================================
// ROLE SCORING
// =============================================================================

/**
 * Calculate entry role score (0-100)
 */
export function calculateEntryScore(input: RoleDetectionInput): number {
  const weights = {
    openingDuelRate: 0.35,
    openingSuccessRate: 0.2,
    firstContactRate: 0.25,
    avgTimeAlivePenalty: 0.2, // Lower time alive = more entry-like
  };

  const openingDuelScore = Math.min(100, input.openingDuelRate * 200); // 50% rate = 100
  const openingSuccessScore = input.openingSuccessRate;
  const firstContactScore = Math.min(100, input.firstContactRate * 200);
  const timeAliveScore = (1 - input.avgTimeAlive) * 100; // Inverse - entries die early

  return (
    openingDuelScore * weights.openingDuelRate +
    openingSuccessScore * weights.openingSuccessRate +
    firstContactScore * weights.firstContactRate +
    timeAliveScore * weights.avgTimeAlivePenalty
  );
}

/**
 * Calculate AWPer role score (0-100)
 */
export function calculateAwperScore(input: RoleDetectionInput): number {
  const weights = {
    awpUsageRate: 0.4,
    awpKillShare: 0.35,
    awpKillsPerRound: 0.25,
  };

  const usageScore = Math.min(100, input.awpUsageRate * 150); // 66% rate = 100
  const killShareScore = Math.min(100, input.awpKillShare * 200); // 50% of kills = 100
  const killsScore = Math.min(100, input.awpKillsPerRound * 200); // 0.5 kills/round = 100

  return (
    usageScore * weights.awpUsageRate +
    killShareScore * weights.awpKillShare +
    killsScore * weights.awpKillsPerRound
  );
}

/**
 * Calculate support role score (0-100)
 */
export function calculateSupportScore(input: RoleDetectionInput): number {
  const weights = {
    flashAssists: 0.3,
    tradeKills: 0.25,
    utilityDamage: 0.25,
    smokes: 0.2,
  };

  const flashScore = Math.min(100, input.flashAssistsPerRound * 250); // 0.4/round = 100
  const tradeScore = Math.min(100, input.tradeKillRate * 150); // 66% trade rate = 100
  const utilityScore = Math.min(100, input.utilityDamagePerRound * 5); // 20 dmg/round = 100
  const smokeScore = Math.min(100, input.smokesPerRound * 100); // 1 smoke/round = 100

  return (
    flashScore * weights.flashAssists +
    tradeScore * weights.tradeKills +
    utilityScore * weights.utilityDamage +
    smokeScore * weights.smokes
  );
}

/**
 * Calculate lurker role score (0-100)
 */
export function calculateLurkerScore(input: RoleDetectionInput): number {
  const weights = {
    lateRoundKills: 0.35,
    soloKills: 0.35,
    clutchAttempts: 0.15,
    survivalBonus: 0.15,
  };

  const lateKillScore = Math.min(100, input.lateRoundKillRate * 200); // 50% late = 100
  const soloScore = Math.min(100, input.soloKillRate * 200); // 50% solo = 100
  const clutchScore = Math.min(100, input.clutchAttemptRate * 250); // 40% = 100
  const survivalScore = input.avgTimeAlive * 100; // Higher = more lurker-like

  return (
    lateKillScore * weights.lateRoundKills +
    soloScore * weights.soloKills +
    clutchScore * weights.clutchAttempts +
    survivalScore * weights.survivalBonus
  );
}

/**
 * Calculate anchor role score (0-100)
 */
export function calculateAnchorScore(input: RoleDetectionInput): number {
  const weights = {
    ctSurvival: 0.3,
    retakes: 0.3,
    clutches: 0.4,
  };

  const survivalScore = input.ctSurvivalRate;
  const retakeScore = Math.min(100, input.retakeParticipationRate * 150);
  const clutchScore = Math.min(100, input.clutchSuccessRate * 2.5); // 40% success = 100

  return (
    survivalScore * weights.ctSurvival +
    retakeScore * weights.retakes +
    clutchScore * weights.clutches
  );
}

// =============================================================================
// PLAYSTYLE DETECTION
// =============================================================================

/**
 * Calculate aggression score (0-100)
 */
export function calculateAggression(input: RoleDetectionInput): number {
  // High opening duels + high first contact + low survival time = aggressive
  const openingFactor = input.openingDuelRate * 100;
  const contactFactor = input.firstContactRate * 100;
  const survivalFactor = (1 - input.avgTimeAlive) * 100;
  const kdFactor = Math.min(100, (input.killsPerRound / input.deathsPerRound) * 50);

  return Math.min(
    100,
    openingFactor * 0.3 + contactFactor * 0.3 + survivalFactor * 0.2 + kdFactor * 0.2
  );
}

/**
 * Calculate positioning score (0-100)
 */
export function calculatePositioning(input: RoleDetectionInput): number {
  // Good positioning = high survival + good ADR + trade kills (means good positioning for trades)
  const survivalFactor = input.avgTimeAlive * 100;
  const adrFactor = Math.min(100, (input.adr / 100) * 100);
  const tradeFactor = input.tradeKillRate * 100;

  return survivalFactor * 0.4 + adrFactor * 0.3 + tradeFactor * 0.3;
}

/**
 * Calculate utility usage score (0-100)
 */
export function calculateUtilityUsage(input: RoleDetectionInput): number {
  const flashFactor = Math.min(100, input.flashAssistsPerRound * 200);
  const smokeFactor = Math.min(100, input.smokesPerRound * 100);
  const damageFactor = Math.min(100, input.utilityDamagePerRound * 4);

  return flashFactor * 0.4 + smokeFactor * 0.3 + damageFactor * 0.3;
}

/**
 * Calculate team play score (0-100)
 */
export function calculateTeamPlay(input: RoleDetectionInput): number {
  // High flash assists + high trade kills + medium opening (not always going first)
  const flashFactor = Math.min(100, input.flashAssistsPerRound * 250);
  const tradeFactor = input.tradeKillRate * 100;
  const supportOpeningFactor = input.openingDuelRate < 0.3 ? 80 : 40; // Not always first

  return flashFactor * 0.4 + tradeFactor * 0.4 + supportOpeningFactor * 0.2;
}

/**
 * Calculate clutch ability score (0-100)
 */
export function calculateClutchAbility(input: RoleDetectionInput): number {
  // Clutch attempts + clutch success + survival
  const attemptFactor = Math.min(100, input.clutchAttemptRate * 300);
  const successFactor = input.clutchSuccessRate * 1.5;
  const survivalFactor = input.avgTimeAlive * 100;

  return attemptFactor * 0.3 + successFactor * 0.5 + survivalFactor * 0.2;
}

/**
 * Determine aim style from headshot percentage
 */
export function determineAimStyle(hsPercent: number): "spray" | "burst" | "tap" | "mixed" {
  const { HEADSHOT_THRESHOLDS } = AIM_STYLE_CONFIG;

  if (hsPercent > HEADSHOT_THRESHOLDS.HEADHUNTER) return "tap";
  if (hsPercent > HEADSHOT_THRESHOLDS.PRECISION) return "burst";
  if (hsPercent < HEADSHOT_THRESHOLDS.MIXED) return "spray";
  return "mixed";
}

// =============================================================================
// MAIN ROLE DETECTION
// =============================================================================

/**
 * Detect player role from aggregated statistics
 */
export function detectPlayerRole(
  input: RoleDetectionInput,
  hsPercent: number
): PlayerRoleAnalysis {
  // Calculate all role scores
  const entryScore = calculateEntryScore(input);
  const awperScore = calculateAwperScore(input);
  const supportScore = calculateSupportScore(input);
  const lurkerScore = calculateLurkerScore(input);
  const anchorScore = calculateAnchorScore(input);
  const iglScore = 0; // Cannot detect without comms data

  const scores: Record<PlayerRole, number> = {
    entry: entryScore,
    awper: awperScore,
    support: supportScore,
    lurker: lurkerScore,
    anchor: anchorScore,
    igl: iglScore,
    hybrid: 0,
  };

  // Determine primary role
  let primaryRole: PlayerRole = "hybrid";
  let maxScore = 0;

  for (const [role, score] of Object.entries(scores) as [PlayerRole, number][]) {
    if (role !== "hybrid" && role !== "igl" && score > maxScore) {
      maxScore = score;
      primaryRole = role;
    }
  }

  // Determine secondary role (second highest, must be at least 50% of primary)
  let secondaryRole: PlayerRole | null = null;
  let secondMaxScore = 0;

  for (const [role, score] of Object.entries(scores) as [PlayerRole, number][]) {
    if (role !== primaryRole && role !== "hybrid" && role !== "igl" && score > secondMaxScore) {
      secondMaxScore = score;
      secondaryRole = role;
    }
  }

  // Only assign secondary if it's significant
  const { MIN_PRIMARY_ROLE_SCORE, SECONDARY_ROLE_MIN_PERCENTAGE } = ROLE_DETECTION_CONFIG.THRESHOLDS;
  if (secondMaxScore < maxScore * SECONDARY_ROLE_MIN_PERCENTAGE || secondMaxScore < MIN_PRIMARY_ROLE_SCORE * 0.75) {
    secondaryRole = null;
  }

  // If no clear primary role (all scores low), mark as hybrid
  if (maxScore < MIN_PRIMARY_ROLE_SCORE) {
    primaryRole = "hybrid";
  }

  // Calculate confidence (how clear is the primary role)
  const scoreDiff = maxScore - secondMaxScore;
  const confidence = Math.min(100, 50 + scoreDiff);

  // Build role indicators
  const indicators: RoleIndicators = {
    entry: {
      openingDuelRate: input.openingDuelRate,
      firstContactRate: input.firstContactRate,
      avgTimeAlive: input.avgTimeAlive,
      flashesForTeammates: 0, // Not tracked in basic input
    },
    awper: {
      awpUsageRate: input.awpUsageRate,
      awpKillRate: input.awpKillShare,
      holdingPositionRate: 0, // Requires position data
    },
    support: {
      flashAssists: input.flashAssistsPerRound,
      tradeKills: input.tradeKillRate,
      utilityDamage: input.utilityDamagePerRound,
      refragRate: input.tradeKillRate,
    },
    lurker: {
      lateRoundKills: input.lateRoundKillRate,
      soloKillRate: input.soloKillRate,
      behindEnemyKills: 0, // Requires position data
      avgDistanceFromTeam: null,
    },
    anchor: {
      siteHoldSuccess: 0, // Requires detailed CT data
      retakeParticipation: input.retakeParticipationRate,
      clutchRate: input.clutchAttemptRate,
    },
  };

  // Build playstyle metrics
  const playstyle: PlaystyleMetrics = {
    aggression: Math.round(calculateAggression(input)),
    positioning: Math.round(calculatePositioning(input)),
    aimStyle: determineAimStyle(hsPercent),
    utilityUsage: Math.round(calculateUtilityUsage(input)),
    teamPlay: Math.round(calculateTeamPlay(input)),
    clutchAbility: Math.round(calculateClutchAbility(input)),
  };

  return {
    primaryRole,
    secondaryRole,
    confidence: Math.round(confidence),
    breakdown: {
      entryFragger: Math.round(entryScore),
      awper: Math.round(awperScore),
      support: Math.round(supportScore),
      lurker: Math.round(lurkerScore),
      igl: 0,
      anchor: Math.round(anchorScore),
    },
    indicators,
    playstyle,
  };
}

// =============================================================================
// HELPER: Convert Match Data to Role Detection Input
// =============================================================================

import type { PlayerMatchData } from "./player-profile.calculator";
import { sumBy, safeRate, safePercentage } from "./stats.calculator";

/**
 * Convert aggregated match data to role detection input
 */
export function createRoleDetectionInput(matches: readonly PlayerMatchData[]): RoleDetectionInput {
  const totalRounds = sumBy(matches, (m) => m.roundsPlayed);
  const totalKills = sumBy(matches, (m) => m.kills);
  const totalDeaths = sumBy(matches, (m) => m.deaths);
  const totalDamage = sumBy(matches, (m) => m.damage);

  const openingAttempts = sumBy(matches, (m) => m.openingAttempts);
  const openingKills = sumBy(matches, (m) => m.openingKills);
  const awpRounds = sumBy(matches, (m) => m.awpRounds);
  const awpKills = sumBy(matches, (m) => m.awpKills);

  const flashAssists = sumBy(matches, (m) => m.flashAssists);
  const tradeKills = sumBy(matches, (m) => m.tradeKills);
  const tradeOpps = sumBy(matches, (m) => m.tradeOpportunities);
  const utilityDamage = sumBy(matches, (m) => m.utilityDamage);
  const smokes = sumBy(matches, (m) => m.smokesThrown);

  const clutchAttempts = sumBy(matches, (m) => m.clutchAttempts);
  const clutchWins = sumBy(matches, (m) => m.clutchWins);

  const ctRounds = sumBy(matches, (m) => m.ctRounds);
  const ctDeaths = sumBy(matches, (m) => m.ctDeaths);

  return {
    // Opening metrics
    openingDuelRate: safeRate(openingAttempts, totalRounds),
    openingSuccessRate: safePercentage(openingKills, openingAttempts),
    firstContactRate: safeRate(openingAttempts, totalRounds), // Approximation

    // AWP metrics
    awpUsageRate: safeRate(awpRounds, totalRounds),
    awpKillsPerRound: safeRate(awpKills, awpRounds || 1),
    awpKillShare: safePercentage(awpKills, totalKills),

    // Support metrics
    flashAssistsPerRound: safeRate(flashAssists, totalRounds),
    tradeKillRate: safePercentage(tradeKills, tradeOpps || 1),
    utilityDamagePerRound: safeRate(utilityDamage, totalRounds),
    smokesPerRound: safeRate(smokes, totalRounds),

    // Lurker metrics (approximations without detailed round data)
    lateRoundKillRate: 0.2, // Placeholder - needs round-level data
    soloKillRate: 0.3, // Placeholder - needs position data
    clutchAttemptRate: safeRate(clutchAttempts, totalRounds),

    // Anchor metrics
    ctSurvivalRate: safePercentage(ctRounds - ctDeaths, ctRounds),
    retakeParticipationRate: 0.5, // Placeholder - needs detailed CT data
    clutchSuccessRate: safePercentage(clutchWins, clutchAttempts),

    // General
    avgTimeAlive: 0.6, // Placeholder - needs tick-level survival data
    killsPerRound: safeRate(totalKills, totalRounds),
    deathsPerRound: safeRate(totalDeaths, totalRounds),
    adr: safeRate(totalDamage, totalRounds),
  };
}
