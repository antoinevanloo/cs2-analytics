/**
 * Analysis Service - Main entry point for advanced analytics
 *
 * ARCHITECTURE: Storage-First with Lazy Computation Fallback
 *
 * 1. Check if analysis results exist in storage
 * 2. If found: return cached results (fast path, <50ms)
 * 3. If not found: compute, store, and return (slow path)
 *
 * This approach provides:
 * - Fast API responses for pre-computed analyses
 * - Automatic caching of on-demand computations
 * - Seamless fallback for demos not yet analyzed
 *
 * @module analysis/analysis
 */

import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { AnalysisType } from "@prisma/client";
import { MatchAnalysisService } from "./services/match-analysis.service";
import {
  PlayerMetricsService,
  type PlayerMatchMetricsResult,
} from "./services/player-metrics.service";
import {
  AnalysisStorageService,
  type StoredAnalysisResults,
} from "./services/analysis-storage.service";
import type { AnalysisJobData } from "./analysis.processor";

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    private readonly matchAnalysis: MatchAnalysisService,
    private readonly playerMetrics: PlayerMetricsService,
    private readonly storage: AnalysisStorageService,
    @InjectQueue("demo-analysis")
    private readonly analysisQueue: Queue<AnalysisJobData>,
  ) {}

  // ===========================================================================
  // STORAGE-FIRST HELPERS
  // ===========================================================================

  /**
   * Get stored analysis or compute and store if not available
   * This is the core of the storage-first strategy
   */
  private async getOrComputeAnalysis(
    demoId: string,
  ): Promise<StoredAnalysisResults> {
    // Try to get from storage first
    const stored = await this.storage.getLatestAnalysis(
      demoId,
      AnalysisType.ADVANCED,
    );

    if (stored?.results) {
      this.logger.debug(`Cache hit for demo ${demoId}`);
      return stored.results;
    }

    // Not in storage, compute and store
    this.logger.debug(`Cache miss for demo ${demoId}, computing...`);
    return this.computeAndStore(demoId);
  }

  /**
   * Compute full analysis and store results
   */
  private async computeAndStore(
    demoId: string,
  ): Promise<StoredAnalysisResults> {
    const startTime = Date.now();

    // Compute all metrics
    const [
      playerMetrics,
      matchOverview,
      roundAnalysis,
      economyFlow,
      tradeAnalysis,
    ] = await Promise.all([
      this.playerMetrics.calculateAllPlayersMetrics(demoId),
      this.matchAnalysis.getMatchOverview(demoId),
      this.matchAnalysis.getRoundAnalysis(demoId),
      this.matchAnalysis.getEconomyFlow(demoId),
      this.matchAnalysis.getTradeAnalysis(demoId),
    ]);

    // Store results
    const record = await this.storage.storeFullMatchAnalysis(demoId, {
      playerMetrics,
      matchOverview,
      roundAnalysis,
      economyFlow,
      tradeAnalysis,
    });

    const duration = Date.now() - startTime;
    this.logger.log(
      `Computed and stored analysis for demo ${demoId} in ${duration}ms`,
    );

    return record.results!;
  }

  /**
   * Get player metrics from storage or compute
   */
  private async getPlayerMetricsFromStorage(
    demoId: string,
  ): Promise<readonly PlayerMatchMetricsResult[]> {
    const stored = await this.storage.getLatestAnalysis(
      demoId,
      AnalysisType.ADVANCED,
    );

    if (stored?.results?.playerMetrics) {
      return stored.results.playerMetrics;
    }

    // Compute and store full analysis
    const results = await this.computeAndStore(demoId);
    return results.playerMetrics ?? [];
  }

  // ===========================================================================
  // PUBLIC API METHODS (Storage-First)
  // ===========================================================================

  /**
   * Get comprehensive match overview
   */
  async getMatchOverview(demoId: string) {
    this.logger.debug(`Getting match overview for ${demoId}`);
    const results = await this.getOrComputeAnalysis(demoId);
    return results.matchOverview;
  }

  /**
   * Get opening duels analysis
   */
  async getOpeningDuels(demoId: string) {
    this.logger.debug(`Getting opening duels for ${demoId}`);
    const playerMetrics = await this.getPlayerMetricsFromStorage(demoId);

    return {
      demoId,
      duels: playerMetrics.flatMap((p) => p.openings.duels),
      stats: {
        ctWins: playerMetrics
          .filter((p) => p.teamNum === 3)
          .reduce((sum, p) => sum + p.openings.wins, 0),
        tWins: playerMetrics
          .filter((p) => p.teamNum === 2)
          .reduce((sum, p) => sum + p.openings.wins, 0),
        topOpeners: playerMetrics
          .map((p) => ({
            steamId: p.steamId,
            name: p.name,
            wins: p.openings.wins,
            losses: p.openings.losses,
            winRate: p.openings.winRate,
          }))
          .sort((a, b) => b.wins - a.wins)
          .slice(0, 5),
      },
    };
  }

  /**
   * Get clutch situations analysis
   */
  async getClutches(demoId: string) {
    this.logger.debug(`Getting clutches for ${demoId}`);
    const playerMetrics = await this.getPlayerMetricsFromStorage(demoId);

    const totalClutches = playerMetrics.reduce(
      (sum, p) => sum + p.clutches.total,
      0,
    );
    const totalWon = playerMetrics.reduce((sum, p) => sum + p.clutches.won, 0);

    return {
      demoId,
      clutches: playerMetrics.flatMap((p) => p.clutches.clutches),
      stats: {
        total: totalClutches,
        won: totalWon,
        by1v1: playerMetrics.reduce(
          (sum, p) => sum + p.clutches.breakdown["1v1"].wins,
          0,
        ),
        by1v2: playerMetrics.reduce(
          (sum, p) => sum + p.clutches.breakdown["1v2"].wins,
          0,
        ),
        by1v3: playerMetrics.reduce(
          (sum, p) => sum + p.clutches.breakdown["1v3"].wins,
          0,
        ),
        by1v4: playerMetrics.reduce(
          (sum, p) => sum + p.clutches.breakdown["1v4"].wins,
          0,
        ),
        by1v5: playerMetrics.reduce(
          (sum, p) => sum + p.clutches.breakdown["1v5"].wins,
          0,
        ),
        topClutchers: playerMetrics
          .filter((p) => p.clutches.won > 0)
          .map((p) => ({
            steamId: p.steamId,
            name: p.name,
            won: p.clutches.won,
            total: p.clutches.total,
            successRate: p.clutches.successRate,
          }))
          .sort((a, b) => b.won - a.won)
          .slice(0, 5),
      },
    };
  }

  /**
   * Get trade kills analysis
   */
  async getTrades(demoId: string) {
    this.logger.debug(`Getting trades for ${demoId}`);
    const results = await this.getOrComputeAnalysis(demoId);
    return results.tradeAnalysis;
  }

  /**
   * Get economy analysis
   */
  async getEconomyAnalysis(demoId: string) {
    this.logger.debug(`Getting economy analysis for ${demoId}`);
    const results = await this.getOrComputeAnalysis(demoId);
    return results.economyFlow;
  }

  /**
   * Get utility usage analysis
   */
  async getUtilityAnalysis(demoId: string) {
    this.logger.debug(`Getting utility analysis for ${demoId}`);
    const playerMetrics = await this.getPlayerMetricsFromStorage(demoId);

    const team1 = playerMetrics.filter((p) => p.teamNum === 2);
    const team2 = playerMetrics.filter((p) => p.teamNum === 3);

    return {
      demoId,
      utility: {
        smoke: {
          total: playerMetrics.reduce(
            (sum, p) => sum + p.utility.smoke.thrown,
            0,
          ),
          perRound:
            playerMetrics.reduce(
              (sum, p) => sum + p.utility.smoke.perRound,
              0,
            ) / playerMetrics.length,
        },
        flash: {
          total: playerMetrics.reduce(
            (sum, p) => sum + p.utility.flash.thrown,
            0,
          ),
          enemiesBlinded: playerMetrics.reduce(
            (sum, p) => sum + p.utility.flash.enemiesBlinded,
            0,
          ),
          teammatesBlinded: playerMetrics.reduce(
            (sum, p) => sum + p.utility.flash.teammatesBlinded,
            0,
          ),
          avgEffectiveness:
            playerMetrics.reduce(
              (sum, p) => sum + p.utility.flash.effectivenessRate,
              0,
            ) / playerMetrics.length,
        },
        he: {
          total: playerMetrics.reduce(
            (sum, p) => sum + p.utility.heGrenade.thrown,
            0,
          ),
          damage: playerMetrics.reduce(
            (sum, p) => sum + p.utility.heGrenade.damage,
            0,
          ),
        },
        molotov: {
          total: playerMetrics.reduce(
            (sum, p) => sum + p.utility.molotov.thrown,
            0,
          ),
          damage: playerMetrics.reduce(
            (sum, p) => sum + p.utility.molotov.damage,
            0,
          ),
        },
      },
      byTeam: {
        team1: {
          utilityDamage: team1.reduce(
            (sum, p) => sum + p.utility.totalUtilityDamage,
            0,
          ),
          utilityDPR:
            team1.length > 0
              ? team1.reduce(
                  (sum, p) => sum + p.utility.utilityDamagePerRound,
                  0,
                ) / team1.length
              : 0,
        },
        team2: {
          utilityDamage: team2.reduce(
            (sum, p) => sum + p.utility.totalUtilityDamage,
            0,
          ),
          utilityDPR:
            team2.length > 0
              ? team2.reduce(
                  (sum, p) => sum + p.utility.utilityDamagePerRound,
                  0,
                ) / team2.length
              : 0,
        },
      },
      byPlayer: playerMetrics.map((p) => ({
        steamId: p.steamId,
        name: p.name,
        team: p.teamNum,
        utility: p.utility,
        label: p.utilityLabel,
      })),
    };
  }

  /**
   * Get positioning analysis
   * Note: Requires position data from parser (not yet implemented)
   */
  async getPositioningAnalysis(demoId: string) {
    this.logger.debug(`Getting positioning analysis for ${demoId}`);

    return {
      demoId,
      positioning: {
        ctSetups: [],
        tExecutes: [],
        rotations: [],
      },
      message:
        "Position analysis requires tick-by-tick position data (future enhancement)",
    };
  }

  /**
   * Get heatmaps
   * Note: Requires position data from parser (not yet implemented)
   */
  async getHeatmaps(
    demoId: string,
    options: { type: string; team?: "T" | "CT" },
  ) {
    this.logger.debug(`Getting heatmaps for ${demoId}`);

    return {
      demoId,
      type: options.type,
      team: options.team || "all",
      data: [],
      bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
      message:
        "Heatmap generation requires tick-by-tick position data (future enhancement)",
    };
  }

  /**
   * Get AI coaching insights
   */
  async getCoachingInsights(demoId: string) {
    this.logger.debug(`Getting coaching insights for ${demoId}`);

    const results = await this.getOrComputeAnalysis(demoId);
    const overview = results.matchOverview;
    const roundAnalysis = results.roundAnalysis;

    if (!overview || !roundAnalysis) {
      return {
        demoId,
        insights: [],
        recommendations: [],
        strengths: [],
        weaknesses: [],
        overview: null,
      };
    }

    // Generate basic insights based on metrics
    const insights: string[] = [];
    const recommendations: string[] = [];
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    const { team1, team2 } = overview.teamStats;

    // Rating comparison
    if (team1.avgRating > team2.avgRating + 0.2) {
      insights.push(
        `Team 1 significantly outperformed Team 2 in overall rating (${team1.avgRating.toFixed(2)} vs ${team2.avgRating.toFixed(2)})`,
      );
    } else if (team2.avgRating > team1.avgRating + 0.2) {
      insights.push(
        `Team 2 significantly outperformed Team 1 in overall rating (${team2.avgRating.toFixed(2)} vs ${team1.avgRating.toFixed(2)})`,
      );
    }

    // Opening duel analysis
    if (team1.openingWinRate > 55) {
      strengths.push("Strong opening duel performance");
    } else if (team1.openingWinRate < 45) {
      weaknesses.push(
        "Poor opening duel performance - consider adjusting entry positions",
      );
      recommendations.push(
        "Review entry positions and consider trading more effectively",
      );
    }

    // Utility usage
    if (team1.utilityDamagePerRound < 10) {
      weaknesses.push("Low utility damage output");
      recommendations.push(
        "Focus on coordinating utility usage and practicing grenade lineups",
      );
    } else if (team1.utilityDamagePerRound > 20) {
      strengths.push("Excellent utility damage output");
    }

    // Clutch performance
    if (team1.clutchWinRate > 40) {
      strengths.push("Strong clutch performance");
    } else if (team1.clutchWinRate < 25) {
      weaknesses.push("Below average clutch conversion");
      recommendations.push("Work on 1vX decision making and time management");
    }

    // Key rounds analysis
    const ecoWins = roundAnalysis.keyRounds.filter((r) => r.type === "eco_win");
    if (ecoWins.length > 2) {
      insights.push(
        `Multiple eco round wins (${ecoWins.length}) showing good discipline`,
      );
    }

    return {
      demoId,
      insights,
      recommendations,
      strengths,
      weaknesses,
      overview: {
        winner: overview.score.winner,
        score: `${overview.score.team1.score}-${overview.score.team2.score}`,
        keyMoments: roundAnalysis.keyRounds.length,
      },
    };
  }

  /**
   * Compare multiple demos or players
   */
  async compare(data: { demoIds?: string[]; playerIds?: string[] }) {
    this.logger.debug(`Comparing demos/players: ${JSON.stringify(data)}`);

    const results: Record<string, unknown> = {};

    if (data.demoIds && data.demoIds.length > 0) {
      const demoComparisons = await Promise.all(
        data.demoIds.map(async (demoId) => {
          try {
            const analysis = await this.getOrComputeAnalysis(demoId);
            return { demoId, overview: analysis.matchOverview, error: null };
          } catch (error) {
            return { demoId, overview: null, error: String(error) };
          }
        }),
      );
      results.demos = demoComparisons;
    }

    if (data.playerIds && data.playerIds.length > 0) {
      results.players = {
        message:
          "Player comparison across demos requires aggregate stats (future enhancement)",
        playerIds: data.playerIds,
      };
    }

    return {
      comparison: {
        demos: data.demoIds || [],
        players: data.playerIds || [],
      },
      results,
    };
  }

  // ===========================================================================
  // ADDITIONAL ANALYSIS ENDPOINTS
  // ===========================================================================

  /**
   * Get player metrics for a specific player in a match
   */
  async getPlayerMetrics(demoId: string, steamId: string) {
    const playerMetrics = await this.getPlayerMetricsFromStorage(demoId);
    const player = playerMetrics.find((p) => p.steamId === steamId);

    if (!player) {
      // Fall back to direct computation if player not found
      return this.playerMetrics.calculatePlayerMetrics(demoId, steamId);
    }

    return player;
  }

  /**
   * Get all players metrics for a match
   */
  async getAllPlayersMetrics(demoId: string) {
    return this.getPlayerMetricsFromStorage(demoId);
  }

  /**
   * Get player summary (quick stats)
   */
  async getPlayerSummary(demoId: string, steamId: string) {
    const player = await this.getPlayerMetrics(demoId, steamId);

    return {
      steamId: player.steamId,
      name: player.name,
      rating: player.rating.rating,
      ratingLabel: player.ratingLabel,
      kast: player.kast.kast,
      adr: player.combat.adr,
      kd: player.combat.kd,
      hsPercent: player.combat.hsPercent,
      impact: player.impact.impact,
      clutchWinRate: player.clutches.successRate,
      utilityDPR: player.utility.utilityDamagePerRound,
    };
  }

  /**
   * Compare players in a match
   */
  async comparePlayersInMatch(demoId: string) {
    const players = await this.getPlayerMetricsFromStorage(demoId);

    return {
      players,
      rankings: {
        byRating: this.createRanking(players, (p) => p.rating.rating),
        byADR: this.createRanking(players, (p) => p.combat.adr),
        byKAST: this.createRanking(players, (p) => p.kast.kast),
        byImpact: this.createRanking(players, (p) => p.impact.impact),
        byUtility: this.createRanking(
          players,
          (p) => p.utility.utilityDamagePerRound,
        ),
      },
    };
  }

  /**
   * Get round-by-round analysis
   */
  async getRoundAnalysis(demoId: string) {
    const results = await this.getOrComputeAnalysis(demoId);
    return results.roundAnalysis;
  }

  // ===========================================================================
  // QUEUE MANAGEMENT
  // ===========================================================================

  /**
   * Manually trigger analysis for a demo
   * Useful for re-analysis or manual triggering
   */
  async queueAnalysis(
    demoId: string,
    options: {
      type?: "full" | "players" | "match";
      priority?: "high" | "normal" | "low";
    } = {},
  ): Promise<{ jobId: string; message: string }> {
    const { type = "full", priority = "normal" } = options;

    // Check if already analyzed
    const existing = await this.storage.getLatestAnalysis(
      demoId,
      AnalysisType.ADVANCED,
    );
    if (existing?.results) {
      return {
        jobId: existing.id,
        message: `Analysis already exists for demo ${demoId}`,
      };
    }

    // Queue the job
    const job = await this.analysisQueue.add(
      "analyze-demo",
      { demoId, type, priority },
      {
        priority: priority === "high" ? 1 : priority === "low" ? 20 : 10,
        jobId: `analysis-${demoId}-${Date.now()}`,
      },
    );

    return {
      jobId: job.id ?? "unknown",
      message: `Analysis queued for demo ${demoId}`,
    };
  }

  /**
   * Get analysis status for a demo
   */
  async getAnalysisStatus(demoId: string): Promise<{
    hasAnalysis: boolean;
    status: string;
    analyzedAt: string | null;
    summary: StoredAnalysisResults["summary"] | null;
  }> {
    const analysis = await this.storage.getLatestAnalysis(
      demoId,
      AnalysisType.ADVANCED,
    );

    if (!analysis) {
      return {
        hasAnalysis: false,
        status: "not_started",
        analyzedAt: null,
        summary: null,
      };
    }

    return {
      hasAnalysis: analysis.status === "COMPLETED",
      status: analysis.status.toLowerCase(),
      analyzedAt: analysis.results?.analyzedAt ?? null,
      summary: analysis.results?.summary ?? null,
    };
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  private createRanking(
    players: readonly PlayerMatchMetricsResult[],
    getValue: (p: PlayerMatchMetricsResult) => number,
  ): { steamId: string; name: string; value: number }[] {
    return [...players]
      .sort((a, b) => getValue(b) - getValue(a))
      .map((p) => ({
        steamId: p.steamId,
        name: p.name,
        value: Math.round(getValue(p) * 100) / 100,
      }));
  }
}
