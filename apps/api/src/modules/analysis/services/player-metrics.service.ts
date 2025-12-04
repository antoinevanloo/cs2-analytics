/**
 * Player Metrics Service - Individual Player Analysis
 *
 * Calculates comprehensive metrics for individual players:
 * - Combat metrics (K/D, ADR, HS%)
 * - HLTV Rating 2.0
 * - KAST %
 * - Trade analysis
 * - Clutch analysis
 * - Utility usage
 * - Economy performance
 * - Opening duels
 *
 * Uses pure calculator functions with data from MetricsDataService.
 *
 * @module analysis/services/player-metrics
 */

import { Injectable, Logger } from "@nestjs/common";
import { MetricsDataService, type DemoMatchData, type PlayerMatchData } from "./metrics-data.service";

// Import calculators
import {
  calculateCombatMetrics,
  calculateKAST,
  calculateImpact,
  calculateRating,
  calculateTrades,
  calculateClutches,
  calculateUtility,
  calculateEconomy,
  calculateOpeningDuels,
  getRatingLabel,
  getKASTLabel,
  getClutchPerformanceRating,
  getUtilityLabel,
  getEconomyLabel,
  getOpeningLabel,
  // Advanced metrics
  calculateSpecialKills,
  calculateKillDistance,
  calculateMultiKillMetrics,
  calculateTradeChains,
  calculateSmokeKillsMetrics,
  calculateUtilityWasteMetrics,
} from "../calculators";

// Import types
import type {
  CombatMetrics,
  SpecialKillsMetrics,
  KillDistanceMetrics,
  MultiKillMetrics
} from "../types/combat.types";
import type { HLTVRating2, KASTMetrics, ImpactMetrics } from "../types/rating.types";
import type { TradeMetrics, TradeChainMetrics } from "../types/trade.types";
import type { ClutchMetrics } from "../types/clutch.types";
import type { UtilityMetrics, SmokeKillsMetrics, UtilityWasteMetrics } from "../types/utility.types";
import type { EconomyMetrics } from "../types/economy.types";
import type { OpeningDuelMetrics } from "../types/opening.types";

/**
 * Complete player metrics for a single match
 */
export interface PlayerMatchMetricsResult {
  /** Player identification */
  readonly steamId: string;
  readonly name: string;
  readonly teamNum: number;

  /** Combat performance */
  readonly combat: CombatMetrics;

  /** HLTV Rating 2.0 */
  readonly rating: HLTVRating2;
  readonly ratingLabel: string;

  /** KAST % */
  readonly kast: KASTMetrics;
  readonly kastLabel: string;

  /** Impact rating */
  readonly impact: ImpactMetrics;

  /** Trade performance */
  readonly trades: TradeMetrics;

  /** Clutch performance */
  readonly clutches: ClutchMetrics;
  readonly clutchPerformance: {
    rating: string;
    score: number;
    description: string;
  };

  /** Utility usage */
  readonly utility: UtilityMetrics;
  readonly utilityLabel: string;

  /** Economy performance */
  readonly economy: EconomyMetrics;
  readonly economyLabel: string;

  /** Opening duels */
  readonly openings: OpeningDuelMetrics;
  readonly openingsLabel: string;

  // =========================================================================
  // ADVANCED METRICS (Phase 2)
  // =========================================================================

  /** Special kills (wallbangs, noscopes, through smoke, blind kills) */
  readonly specialKills: SpecialKillsMetrics;

  /** Kill distance breakdown (close/medium/long/extreme range) */
  readonly killDistance: KillDistanceMetrics;

  /** Multi-kill rounds (2K, 3K, 4K, 5K) */
  readonly multiKills: MultiKillMetrics;

  /** Trade chain analysis */
  readonly tradeChains: TradeChainMetrics;

  /** Smoke kills analysis */
  readonly smokeKills: SmokeKillsMetrics;

  /** Utility waste analysis */
  readonly utilityWaste: UtilityWasteMetrics;

  /** Summary scores */
  readonly summary: {
    readonly overallRating: number;
    readonly combatScore: number;
    readonly impactScore: number;
    readonly supportScore: number;
    readonly consistencyScore: number;
  };
}

/**
 * Player comparison result
 */
export interface PlayerComparisonResult {
  readonly players: readonly PlayerMatchMetricsResult[];
  readonly rankings: {
    readonly byRating: readonly { steamId: string; name: string; value: number }[];
    readonly byADR: readonly { steamId: string; name: string; value: number }[];
    readonly byKAST: readonly { steamId: string; name: string; value: number }[];
    readonly byImpact: readonly { steamId: string; name: string; value: number }[];
    readonly byUtility: readonly { steamId: string; name: string; value: number }[];
  };
}

@Injectable()
export class PlayerMetricsService {
  private readonly logger = new Logger(PlayerMetricsService.name);

  constructor(private readonly metricsDataService: MetricsDataService) {}

  /**
   * Calculate comprehensive metrics for a single player in a match
   */
  async calculatePlayerMetrics(
    demoId: string,
    steamId: string
  ): Promise<PlayerMatchMetricsResult> {
    this.logger.debug(`Calculating metrics for player ${steamId} in demo ${demoId}`);

    const matchData = await this.metricsDataService.getFullMatchData(demoId);
    const playerData = await this.metricsDataService.getPlayerMatchData(demoId, steamId);

    return this.calculateMetricsFromData(playerData, matchData);
  }

  /**
   * Calculate metrics for all players in a match
   */
  async calculateAllPlayersMetrics(demoId: string): Promise<PlayerMatchMetricsResult[]> {
    this.logger.debug(`Calculating metrics for all players in demo ${demoId}`);

    const matchData = await this.metricsDataService.getFullMatchData(demoId);
    const results: PlayerMatchMetricsResult[] = [];

    for (const player of matchData.players) {
      const playerData = await this.metricsDataService.getPlayerMatchData(demoId, player.steamId);
      const metrics = this.calculateMetricsFromData(playerData, matchData);
      results.push(metrics);
    }

    results.sort((a, b) => b.rating.rating - a.rating.rating);
    return results;
  }

  /**
   * Compare players across a match
   */
  async comparePlayersInMatch(demoId: string): Promise<PlayerComparisonResult> {
    const players = await this.calculateAllPlayersMetrics(demoId);

    return {
      players,
      rankings: {
        byRating: this.createRanking(players, (p) => p.rating.rating),
        byADR: this.createRanking(players, (p) => p.combat.adr),
        byKAST: this.createRanking(players, (p) => p.kast.kast),
        byImpact: this.createRanking(players, (p) => p.impact.impact),
        byUtility: this.createRanking(players, (p) => p.utility.utilityDamagePerRound),
      },
    };
  }

  /**
   * Get metrics summary for quick display
   */
  async getPlayerSummary(
    demoId: string,
    steamId: string
  ): Promise<{
    steamId: string;
    name: string;
    rating: number;
    ratingLabel: string;
    kast: number;
    adr: number;
    kd: number;
    hsPercent: number;
    impact: number;
    clutchWinRate: number;
    utilityDPR: number;
  }> {
    const metrics = await this.calculatePlayerMetrics(demoId, steamId);

    return {
      steamId: metrics.steamId,
      name: metrics.name,
      rating: metrics.rating.rating,
      ratingLabel: metrics.ratingLabel,
      kast: metrics.kast.kast,
      adr: metrics.combat.adr,
      kd: metrics.combat.kd,
      hsPercent: metrics.combat.hsPercent,
      impact: metrics.impact.impact,
      clutchWinRate: metrics.clutches.successRate,
      utilityDPR: metrics.utility.utilityDamagePerRound,
    };
  }

  // ===========================================================================
  // PRIVATE CALCULATION METHODS
  // ===========================================================================

  private calculateMetricsFromData(
    playerData: PlayerMatchData,
    matchData: DemoMatchData
  ): PlayerMatchMetricsResult {
    const { steamId, name, teamNum, roundStats } = playerData;
    const { lookups, metadata } = matchData;

    const totalRounds = matchData.rounds.length;
    const allKills = matchData.kills;
    const allGrenades = matchData.grenades;

    // Get player team by round
    const playerTeamByRound = new Map<number, number>();
    for (const round of roundStats) {
      playerTeamByRound.set(round.roundNumber, round.teamNum);
    }

    // Calculate side by round
    const sideByRound = new Map<number, "T" | "CT">();
    for (const round of roundStats) {
      sideByRound.set(round.roundNumber, round.teamNum === 2 ? "T" : "CT");
    }

    // 1. Combat metrics
    const combat = calculateCombatMetrics(roundStats);

    // 2. KAST metrics
    const kast = calculateKAST({
      steamId,
      roundStats,
      allKills,
      tickRate: metadata.tickRate,
    });

    // 3. Impact metrics
    const impact = calculateImpact({
      steamId,
      roundStats,
      allKills,
      totalRounds,
    });

    // 4. HLTV Rating 2.0
    const rating = calculateRating({
      steamId,
      roundStats,
      allKills,
      totalRounds,
      tickRate: metadata.tickRate,
    });

    // 5. Trade metrics
    const trades = calculateTrades({
      steamId,
      allKills,
      tickRate: metadata.tickRate,
      playerNames: lookups.playerNames,
    });

    // 6. Clutch metrics
    const clutches = calculateClutches({
      steamId,
      roundStats,
      sideByRound,
    });

    // 7. Utility metrics
    const utility = calculateUtility({
      steamId,
      allGrenades,
      totalRounds,
      flashAssists: playerData.matchStats.flashAssists,
    });

    // 8. Economy metrics
    const economy = calculateEconomy({
      steamId,
      roundStats,
      totalRounds,
      roundWinners: lookups.roundWinners,
      teamNumber: teamNum,
    });

    // 9. Opening duels
    const openings = calculateOpeningDuels({
      steamId,
      allKills,
      totalRounds,
      tickRate: metadata.tickRate,
      roundWinners: lookups.roundWinners,
      playerTeamByRound,
      roundStartTicks: lookups.roundStartTicks,
      playerNames: lookups.playerNames,
    });

    // =========================================================================
    // ADVANCED METRICS (Phase 2)
    // =========================================================================

    // 10. Special kills (wallbangs, noscopes, through smoke, blind kills)
    const specialKills = calculateSpecialKills(playerData.kills);

    // 11. Kill distance breakdown
    const killDistance = calculateKillDistance(playerData.kills);

    // 12. Multi-kill rounds
    const multiKills = calculateMultiKillMetrics(roundStats);

    // 13. Trade chains
    const tradeChains = calculateTradeChains(allKills, teamNum, metadata.tickRate);

    // 14. Smoke kills
    const smokeKills = calculateSmokeKillsMetrics(playerData.kills, playerData.deaths);

    // 15. Utility waste
    const utilityWaste = calculateUtilityWasteMetrics(playerData.grenades);

    // Get labels
    const ratingLabel = getRatingLabel(rating.rating);
    const kastLabel = getKASTLabel(kast.kast);
    const clutchPerformance = getClutchPerformanceRating(clutches);
    const utilityLabel = getUtilityLabel(utility.utilityDamagePerRound);
    const economyLabel = getEconomyLabel(economy.valueEfficiency);
    const openingsLabel = getOpeningLabel(openings.winRate);

    // Calculate summary scores
    const summary = this.calculateSummaryScores(
      combat,
      rating,
      kast,
      impact,
      utility,
      clutches,
      openings
    );

    return {
      steamId,
      name,
      teamNum,
      combat,
      rating,
      ratingLabel,
      kast,
      kastLabel,
      impact,
      trades,
      clutches,
      clutchPerformance: {
        rating: clutchPerformance.rating,
        score: clutchPerformance.score,
        description: clutchPerformance.description,
      },
      utility,
      utilityLabel,
      economy,
      economyLabel,
      openings,
      openingsLabel,
      // Advanced metrics
      specialKills,
      killDistance,
      multiKills,
      tradeChains,
      smokeKills,
      utilityWaste,
      summary,
    };
  }

  private calculateSummaryScores(
    combat: CombatMetrics,
    rating: HLTVRating2,
    kast: KASTMetrics,
    impact: ImpactMetrics,
    utility: UtilityMetrics,
    clutches: ClutchMetrics,
    openings: OpeningDuelMetrics
  ): PlayerMatchMetricsResult["summary"] {
    // Combat score
    const combatScore = Math.min(
      100,
      (combat.adr / 100) * 50 +
        Math.min(combat.kd * 25, 30) +
        (combat.hsPercent / 100) * 20
    );

    // Impact score
    const impactScore = Math.min(
      100,
      impact.impact * 50 +
        openings.winRate * 0.3 +
        clutches.successRate * 0.2
    );

    // Support score
    const supportScore = Math.min(
      100,
      utility.utilityDamagePerRound * 3 +
        utility.flash.effectivenessRate * 0.3 +
        kast.roundsWithAssist * 2
    );

    // Consistency score
    const consistencyScore = Math.min(100, kast.kast * 1.1 + kast.roundsWithSurvival * 0.1);

    // Overall rating normalized
    const overallRating = Math.min(100, rating.rating * 50);

    return {
      overallRating: round2(overallRating),
      combatScore: round2(combatScore),
      impactScore: round2(impactScore),
      supportScore: round2(supportScore),
      consistencyScore: round2(consistencyScore),
    };
  }

  private createRanking(
    players: readonly PlayerMatchMetricsResult[],
    getValue: (p: PlayerMatchMetricsResult) => number
  ): { steamId: string; name: string; value: number }[] {
    return [...players]
      .sort((a, b) => getValue(b) - getValue(a))
      .map((p) => ({
        steamId: p.steamId,
        name: p.name,
        value: round2(getValue(p)),
      }));
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
