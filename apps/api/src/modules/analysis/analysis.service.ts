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

import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { AnalysisType } from "@prisma/client";
import { PrismaService } from "../../common/prisma";
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
import {
  simulateRating,
  analyzeImprovementPotential,
  getRatingLabel,
} from "./calculators/rating.calculator";
import type { RatingComponents } from "./types/rating.types";

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    private readonly matchAnalysis: MatchAnalysisService,
    private readonly playerMetrics: PlayerMetricsService,
    private readonly storage: AnalysisStorageService,
    private readonly prisma: PrismaService,
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

  // ===========================================================================
  // HLTV RATING 2.0 ENDPOINTS
  // ===========================================================================

  /**
   * Get all player ratings for a demo with full breakdown
   */
  async getDemoRatings(demoId: string) {
    this.logger.debug(`Getting demo ratings for ${demoId}`);
    const playerMetrics = await this.getPlayerMetricsFromStorage(demoId);

    const ratings = playerMetrics.map((p) => ({
      steamId: p.steamId,
      name: p.name,
      team: p.teamNum,
      rating: p.rating,
      ratingLabel: p.ratingLabel,
      summary: {
        kast: p.kast.kast,
        adr: p.combat.adr,
        kd: p.combat.kd,
        hsPercent: p.combat.hsPercent,
        impact: p.impact.impact,
      },
    }));

    // Calculate team averages
    const team1Players = ratings.filter((r) => r.team === 2);
    const team2Players = ratings.filter((r) => r.team === 3);

    const team1AvgRating =
      team1Players.length > 0
        ? team1Players.reduce((sum, p) => sum + p.rating.rating, 0) /
          team1Players.length
        : 0;

    const team2AvgRating =
      team2Players.length > 0
        ? team2Players.reduce((sum, p) => sum + p.rating.rating, 0) /
          team2Players.length
        : 0;

    return {
      demoId,
      players: ratings,
      teamAverages: {
        team1: {
          avgRating: Math.round(team1AvgRating * 1000) / 1000,
          label: getRatingLabel(team1AvgRating),
          playerCount: team1Players.length,
        },
        team2: {
          avgRating: Math.round(team2AvgRating * 1000) / 1000,
          label: getRatingLabel(team2AvgRating),
          playerCount: team2Players.length,
        },
      },
      mvp:
        ratings.length > 0
          ? ratings.reduce((a, b) =>
              a.rating.rating > b.rating.rating ? a : b,
            )
          : null,
    };
  }

  /**
   * Get detailed rating for a specific player in a demo
   */
  async getPlayerRating(demoId: string, steamId: string) {
    this.logger.debug(`Getting player rating for ${steamId} in ${demoId}`);
    const player = await this.getPlayerMetrics(demoId, steamId);

    if (!player) {
      throw new NotFoundException(
        `Player ${steamId} not found in demo ${demoId}`,
      );
    }

    // Get improvement suggestions
    const improvements = analyzeImprovementPotential(player.rating.components);

    return {
      demoId,
      steamId: player.steamId,
      name: player.name,
      team: player.teamNum,
      rating: player.rating,
      ratingLabel: player.ratingLabel,
      detailedStats: {
        kast: player.kast,
        combat: player.combat,
        impact: player.impact,
        openings: {
          wins: player.openings.wins,
          losses: player.openings.losses,
          winRate: player.openings.winRate,
        },
        clutches: {
          won: player.clutches.won,
          total: player.clutches.total,
          successRate: player.clutches.successRate,
        },
      },
      improvements,
    };
  }

  /**
   * Get rating history for a player across matches
   */
  async getPlayerRatingHistory(
    steamId: string,
    options: { limit?: number; map?: string } = {},
  ): Promise<{
    steamId: string;
    matchCount: number;
    history: Array<{
      demoId: string;
      map: string;
      playedAt: Date | null;
      score: string;
      rating: number;
      ratingLabel: string;
      components: RatingComponents;
      kd: number;
      adr: number;
    }>;
    statistics: {
      avgRating: number;
      minRating: number;
      maxRating: number;
      trend: number;
      trendLabel: string;
    };
  }> {
    const { limit = 20, map } = options;
    this.logger.debug(`Getting rating history for ${steamId}`);

    // Find demos where this player participated
    const demos = await this.prisma.demo.findMany({
      where: {
        playerStats: {
          some: { steamId },
        },
        ...(map && { mapName: map }),
      },
      select: {
        id: true,
        mapName: true,
        playedAt: true,
        team1Score: true,
        team2Score: true,
      },
      orderBy: {
        playedAt: "desc",
      },
      take: limit,
    });

    // Define the history entry type
    type RatingHistoryEntry = {
      demoId: string;
      map: string;
      playedAt: Date | null;
      score: string;
      rating: number;
      ratingLabel: string;
      components: RatingComponents;
      kd: number;
      adr: number;
    };

    // Get ratings for each demo
    const history: (RatingHistoryEntry | null)[] = await Promise.all(
      demos.map(async (demo): Promise<RatingHistoryEntry | null> => {
        try {
          const playerMetrics = await this.getPlayerMetricsFromStorage(demo.id);
          const player = playerMetrics.find((p) => p.steamId === steamId);

          if (!player) {
            return null;
          }

          return {
            demoId: demo.id,
            map: demo.mapName,
            playedAt: demo.playedAt,
            score: `${demo.team1Score}-${demo.team2Score}`,
            rating: player.rating.rating,
            ratingLabel: player.ratingLabel,
            components: player.rating.components,
            kd: player.combat.kd,
            adr: player.combat.adr,
          };
        } catch {
          // Skip demos without analysis
          return null;
        }
      }),
    );

    const validHistory: RatingHistoryEntry[] = history.filter(
      (h): h is RatingHistoryEntry => h !== null,
    );

    // Calculate statistics
    const ratings: number[] = validHistory.map((h) => h.rating);
    const avgRating =
      ratings.length > 0
        ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length
        : 0;

    const minRating = ratings.length > 0 ? Math.min(...ratings) : 0;
    const maxRating = ratings.length > 0 ? Math.max(...ratings) : 0;

    // Calculate trend (positive = improving, negative = declining)
    let trend = 0;
    if (validHistory.length >= 5) {
      const recentAvg =
        validHistory
          .slice(0, 5)
          .reduce((sum: number, h: RatingHistoryEntry) => sum + h.rating, 0) /
        5;
      const olderAvg =
        validHistory
          .slice(-5)
          .reduce((sum: number, h: RatingHistoryEntry) => sum + h.rating, 0) /
        5;
      trend = Math.round((recentAvg - olderAvg) * 1000) / 1000;
    }

    return {
      steamId,
      matchCount: validHistory.length,
      history: validHistory,
      statistics: {
        avgRating: Math.round(avgRating * 1000) / 1000,
        minRating: Math.round(minRating * 1000) / 1000,
        maxRating: Math.round(maxRating * 1000) / 1000,
        trend,
        trendLabel:
          trend > 0.02 ? "Improving" : trend < -0.02 ? "Declining" : "Stable",
      },
    };
  }

  /**
   * Simulate rating with modified stats (what-if analysis)
   */
  async simulatePlayerRating(
    demoId: string,
    steamId: string,
    modifications: Partial<RatingComponents>,
  ) {
    this.logger.debug(`Simulating rating for ${steamId} in ${demoId}`);
    const player = await this.getPlayerMetrics(demoId, steamId);

    if (!player) {
      throw new NotFoundException(
        `Player ${steamId} not found in demo ${demoId}`,
      );
    }

    const baseComponents = player.rating.components;
    const simulation = simulateRating(baseComponents, modifications);

    return {
      demoId,
      steamId,
      name: player.name,
      original: {
        rating: simulation.originalRating,
        label: getRatingLabel(simulation.originalRating),
        components: baseComponents,
      },
      simulated: {
        rating: simulation.newRating,
        label: getRatingLabel(simulation.newRating),
        components: {
          ...baseComponents,
          ...modifications,
        },
      },
      change: simulation.change,
      changePercent:
        Math.round((simulation.change / simulation.originalRating) * 10000) /
        100,
      modifications,
      insight: this.generateSimulationInsight(simulation, modifications),
    };
  }

  /**
   * Get improvement suggestions to reach a target rating
   */
  async getPlayerRatingImprovements(
    demoId: string,
    steamId: string,
    targetRating: number = 1.1,
  ) {
    this.logger.debug(
      `Getting rating improvements for ${steamId} in ${demoId}`,
    );
    const player = await this.getPlayerMetrics(demoId, steamId);

    if (!player) {
      throw new NotFoundException(
        `Player ${steamId} not found in demo ${demoId}`,
      );
    }

    const improvements = analyzeImprovementPotential(
      player.rating.components,
      targetRating,
    );

    const currentRating = player.rating.rating;
    const ratingGap = targetRating - currentRating;

    return {
      demoId,
      steamId,
      name: player.name,
      currentRating,
      currentLabel: player.ratingLabel,
      targetRating,
      targetLabel: getRatingLabel(targetRating),
      ratingGap: Math.round(ratingGap * 1000) / 1000,
      alreadyAchieved: ratingGap <= 0,
      improvements: ratingGap > 0 ? improvements : [],
      recommendations: this.generateImprovementRecommendations(
        improvements,
        player,
      ),
    };
  }

  /**
   * Get demo leaderboard sorted by rating
   */
  async getDemoLeaderboard(demoId: string) {
    this.logger.debug(`Getting leaderboard for ${demoId}`);
    const playerMetrics = await this.getPlayerMetricsFromStorage(demoId);

    const leaderboard = [...playerMetrics]
      .sort((a, b) => b.rating.rating - a.rating.rating)
      .map((p, index) => ({
        rank: index + 1,
        steamId: p.steamId,
        name: p.name,
        team: p.teamNum,
        rating: p.rating.rating,
        ratingLabel: p.ratingLabel,
        kast: p.kast.kast,
        adr: p.combat.adr,
        kd: p.combat.kd,
        impact: p.impact.impact,
        highlights: this.getPlayerHighlights(p, playerMetrics),
      }));

    return {
      demoId,
      leaderboard,
      mvp: leaderboard[0] || null,
      highlights: {
        highestKAST: this.findTopPlayer(playerMetrics, (p) => p.kast.kast),
        highestADR: this.findTopPlayer(playerMetrics, (p) => p.combat.adr),
        highestImpact: this.findTopPlayer(
          playerMetrics,
          (p) => p.impact.impact,
        ),
        bestClutcher: this.findTopPlayer(
          playerMetrics.filter((p) => p.clutches.total > 0),
          (p) => p.clutches.successRate,
        ),
      },
    };
  }

  // ===========================================================================
  // RATING HELPER METHODS
  // ===========================================================================

  private generateSimulationInsight(
    simulation: { newRating: number; change: number; originalRating: number },
    modifications: Partial<RatingComponents>,
  ): string {
    const modKeys = Object.keys(modifications) as (keyof RatingComponents)[];
    if (modKeys.length === 0) {
      return "No modifications applied.";
    }

    const changePercent = Math.abs(
      Math.round((simulation.change / simulation.originalRating) * 100),
    );

    if (simulation.change > 0) {
      return `Improving ${modKeys.join(", ")} would increase your rating by ${changePercent}%.`;
    } else if (simulation.change < 0) {
      return `These changes would decrease your rating by ${changePercent}%.`;
    }
    return "These changes would not significantly impact your rating.";
  }

  private generateImprovementRecommendations(
    improvements: ReturnType<typeof analyzeImprovementPotential>,
    player: PlayerMatchMetricsResult,
  ): string[] {
    const recommendations: string[] = [];

    // Sort by feasibility
    const easy = improvements.filter((i) => i.feasibility === "easy");
    const moderate = improvements.filter((i) => i.feasibility === "moderate");

    const easiest = easy[0];
    if (easiest) {
      if (easiest.component === "KAST") {
        recommendations.push(
          `Focus on survival: aim for ${Math.round(easiest.targetValue)}% KAST (currently ${Math.round(easiest.currentValue)}%)`,
        );
      } else if (easiest.component === "ADR") {
        recommendations.push(
          `Deal more damage per round: target ${Math.round(easiest.targetValue)} ADR (currently ${Math.round(easiest.currentValue)})`,
        );
      }
    }

    if (player.openings.winRate < 50) {
      recommendations.push(
        "Improve opening duel win rate - consider trading more effectively with teammates",
      );
    }

    if (player.utility.utilityDamagePerRound < 10) {
      recommendations.push(
        "Increase utility damage - practice grenade lineups and coordinate with team",
      );
    }

    const mod = moderate[0];
    if (mod && recommendations.length < 3) {
      recommendations.push(
        `Work on ${mod.component}: improve from ${Math.round(mod.currentValue * 100) / 100} to ${Math.round(mod.targetValue * 100) / 100}`,
      );
    }

    return recommendations.slice(0, 3);
  }

  private getPlayerHighlights(
    player: PlayerMatchMetricsResult,
    allPlayers: readonly PlayerMatchMetricsResult[],
  ): string[] {
    const highlights: string[] = [];

    // Check if top in any category
    const sortedByRating = [...allPlayers].sort(
      (a, b) => b.rating.rating - a.rating.rating,
    );
    const sortedByADR = [...allPlayers].sort(
      (a, b) => b.combat.adr - a.combat.adr,
    );
    const sortedByKAST = [...allPlayers].sort(
      (a, b) => b.kast.kast - a.kast.kast,
    );

    if (sortedByRating[0]?.steamId === player.steamId) {
      highlights.push("MVP");
    }
    if (sortedByADR[0]?.steamId === player.steamId) {
      highlights.push("Highest ADR");
    }
    if (sortedByKAST[0]?.steamId === player.steamId) {
      highlights.push("Best KAST");
    }
    if (player.clutches.won >= 2) {
      highlights.push(`${player.clutches.won} Clutches`);
    }
    if (player.openings.wins >= 3) {
      highlights.push(`${player.openings.wins} Entry Kills`);
    }

    return highlights;
  }

  private findTopPlayer(
    players: readonly PlayerMatchMetricsResult[],
    getValue: (p: PlayerMatchMetricsResult) => number,
  ): { steamId: string; name: string; value: number } | null {
    if (players.length === 0) return null;

    const sorted = [...players].sort((a, b) => getValue(b) - getValue(a));
    const top = sorted[0];

    if (!top) return null;

    return {
      steamId: top.steamId,
      name: top.name,
      value: Math.round(getValue(top) * 100) / 100,
    };
  }
}
