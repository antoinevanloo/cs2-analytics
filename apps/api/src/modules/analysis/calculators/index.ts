/**
 * Calculators - Barrel exports
 *
 * Pure functions for calculating CS2 analytics metrics.
 * All calculators are stateless and side-effect free.
 *
 * For production use, prefer `calculateAllMetrics` from unified.calculator
 * which optimizes performance through single-pass computation.
 *
 * Usage:
 * ```typescript
 * // Optimized single-pass calculation (recommended)
 * import { calculateAllMetrics } from './calculators';
 *
 * // Individual calculators (for specific needs)
 * import {
 *   calculateRating,
 *   calculateKAST,
 *   calculateImpact,
 *   calculateCombatMetrics
 * } from './calculators';
 * ```
 *
 * @module analysis/calculators
 */

// ============================================================================
// UNIFIED CALCULATOR (RECOMMENDED FOR PRODUCTION)
// ============================================================================
export {
  calculateAllMetrics,
  type UnifiedCalculationInput,
} from "./unified.calculator";

// ============================================================================
// INDIVIDUAL CALCULATORS
// ============================================================================

// Combat metrics (K/D, ADR, HS%)
export {
  calculateCombatMetrics,
  calculateCombatMetricsFromMatch,
  calculateWeaponStats,
  calculateCombatBySide,
  calculateCombatByRoundType,
  calculateMultiKillRounds,
  // Advanced combat metrics
  calculateSpecialKills,
  calculateKillDistance,
  calculateMultiKillMetrics,
  calculateFirstBloodMetrics,
} from "./combat.calculator";

// KAST metrics
export {
  calculateKAST,
  detectTradedRounds,
  calculateRoundKAST,
  calculateTeamKAST,
  getKASTLabel,
  compareKAST,
  type KASTCalculationInput,
} from "./kast.calculator";

// Impact metrics
export {
  calculateImpact,
  calculateMultiKills,
  calculateOpenings,
  getImpactLabel,
  analyzeImpactSources,
  type ImpactCalculationInput,
} from "./impact.calculator";

// HLTV Rating 2.0
export {
  calculateRating,
  calculateContributions,
  calculateRatingFromComponents,
  simulateRating,
  analyzeImprovementPotential,
  calculateTeamRating,
  getRatingLabel,
  type RatingCalculationInput,
} from "./rating.calculator";

// Trade metrics
export {
  calculateTrades,
  calculateTeamTrades,
  analyzeTradeRelationships,
  // Advanced trade metrics
  calculateTradeChains,
  calculateTradeTimingMetrics,
  calculateTradeEffectiveness,
  calculateTradeRelationships,
  calculateExtendedTradeMetrics,
  type TradeCalculationInput,
} from "./trade.calculator";

// Clutch metrics
export {
  calculateClutches,
  getClutchPerformanceRating,
  calculateTeamClutches,
  identifyClutchHighlights,
  type ClutchCalculationInput,
} from "./clutch.calculator";

// Utility metrics (grenades)
export {
  calculateUtility,
  calculateTeamUtility,
  analyzeUtilityByRoundType,
  getUtilityLabel,
  // Advanced utility metrics
  calculateSmokeKillsMetrics,
  calculateUtilityWasteMetrics,
  calculateUtilityScore,
  type UtilityCalculationInput,
} from "./utility.calculator";

// Economy metrics
export {
  calculateEconomy,
  classifyRoundType,
  buildEconomyTimeline,
  calculateTeamEconomy,
  identifyEconomicMismatches,
  getEconomyLabel,
  type EconomyCalculationInput,
} from "./economy.calculator";

// Opening duel metrics
export {
  calculateOpeningDuels,
  analyzeOpeningMatchups,
  calculateTeamOpenings,
  getOpeningLabel,
  type OpeningCalculationInput,
} from "./opening.calculator";
