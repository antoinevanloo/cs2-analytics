/**
 * Analysis Storage Service - Persistence Layer for Computed Analysis Results
 *
 * Manages the lifecycle and storage of analysis results:
 * - Creates and tracks analysis jobs
 * - Stores computed metrics as JSON in the Analysis table
 * - Provides retrieval methods for analysis results
 * - Handles analysis status transitions
 *
 * @module analysis/services/analysis-storage
 */

import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../common/prisma";
import { AnalysisType, AnalysisStatus, Prisma } from "@prisma/client";
import type { PlayerMatchMetricsResult } from "./player-metrics.service";
import type {
  MatchOverviewResult,
  RoundAnalysisResult,
  EconomyFlowResult,
  TradeAnalysisResult,
} from "./match-analysis.service";

// =============================================================================
// STORED RESULT TYPES
// =============================================================================

/**
 * Complete analysis results stored in the database
 */
export interface StoredAnalysisResults {
  /** Analysis metadata */
  readonly version: string;
  readonly analyzedAt: string;

  /** Player-level metrics */
  readonly playerMetrics?: readonly PlayerMatchMetricsResult[] | undefined;

  /** Match-level analysis */
  readonly matchOverview?: MatchOverviewResult | undefined;
  readonly roundAnalysis?: RoundAnalysisResult | undefined;
  readonly economyFlow?: EconomyFlowResult | undefined;
  readonly tradeAnalysis?: TradeAnalysisResult | undefined;

  /** Computed summary for quick access */
  readonly summary?:
    | {
        readonly mvpSteamId: string | null;
        readonly mvpRating: number | null;
        readonly totalKills: number;
        readonly totalRounds: number;
        readonly avgRating: number;
        readonly hasAdvancedMetrics: boolean;
      }
    | undefined;
}

/**
 * Analysis record with typed results
 */
export interface AnalysisRecord {
  readonly id: string;
  readonly type: AnalysisType;
  readonly status: AnalysisStatus;
  readonly demoId: string;
  readonly requestedById: string | null;
  readonly results: StoredAnalysisResults | null;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly error: string | null;
  readonly createdAt: Date;
}

/**
 * Analysis creation options
 */
export interface CreateAnalysisOptions {
  readonly demoId: string;
  readonly type: AnalysisType;
  readonly requestedById?: string | undefined;
}

/**
 * Analysis update payload
 */
export interface AnalysisUpdatePayload {
  readonly status?: AnalysisStatus | undefined;
  readonly results?: StoredAnalysisResults | undefined;
  readonly error?: string | undefined;
  readonly startedAt?: Date | undefined;
  readonly completedAt?: Date | undefined;
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

@Injectable()
export class AnalysisStorageService {
  private readonly logger = new Logger(AnalysisStorageService.name);

  /** Current schema version for stored results */
  private readonly RESULTS_VERSION = "2.0.0";

  constructor(private readonly prisma: PrismaService) {}

  // ===========================================================================
  // ANALYSIS LIFECYCLE MANAGEMENT
  // ===========================================================================

  /**
   * Create a new analysis record
   */
  async createAnalysis(
    options: CreateAnalysisOptions,
  ): Promise<AnalysisRecord> {
    const { demoId, type, requestedById } = options;

    this.logger.debug(`Creating ${type} analysis for demo ${demoId}`);

    const analysis = await this.prisma.analysis.create({
      data: {
        demoId,
        type,
        status: AnalysisStatus.PENDING,
        requestedById: requestedById ?? null,
      },
    });

    return this.mapToAnalysisRecord(analysis);
  }

  /**
   * Mark analysis as started (PROCESSING)
   */
  async markAsStarted(analysisId: string): Promise<AnalysisRecord> {
    this.logger.debug(`Marking analysis ${analysisId} as started`);

    const analysis = await this.prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: AnalysisStatus.PROCESSING,
        startedAt: new Date(),
      },
    });

    return this.mapToAnalysisRecord(analysis);
  }

  /**
   * Mark analysis as completed with results
   */
  async markAsCompleted(
    analysisId: string,
    results: StoredAnalysisResults,
  ): Promise<AnalysisRecord> {
    this.logger.debug(`Marking analysis ${analysisId} as completed`);

    const analysis = await this.prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: AnalysisStatus.COMPLETED,
        completedAt: new Date(),
        results: results as unknown as Prisma.JsonObject,
      },
    });

    return this.mapToAnalysisRecord(analysis);
  }

  /**
   * Mark analysis as failed with error message
   */
  async markAsFailed(
    analysisId: string,
    error: string,
  ): Promise<AnalysisRecord> {
    this.logger.warn(`Marking analysis ${analysisId} as failed: ${error}`);

    const analysis = await this.prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: AnalysisStatus.FAILED,
        completedAt: new Date(),
        error,
      },
    });

    return this.mapToAnalysisRecord(analysis);
  }

  /**
   * Update analysis with partial data
   */
  async updateAnalysis(
    analysisId: string,
    payload: AnalysisUpdatePayload,
  ): Promise<AnalysisRecord> {
    const analysis = await this.prisma.analysis.update({
      where: { id: analysisId },
      data: {
        ...(payload.status && { status: payload.status }),
        ...(payload.results && {
          results: payload.results as unknown as Prisma.JsonObject,
        }),
        ...(payload.error && { error: payload.error }),
        ...(payload.startedAt && { startedAt: payload.startedAt }),
        ...(payload.completedAt && { completedAt: payload.completedAt }),
      },
    });

    return this.mapToAnalysisRecord(analysis);
  }

  // ===========================================================================
  // RETRIEVAL METHODS
  // ===========================================================================

  /**
   * Get analysis by ID
   */
  async getAnalysis(analysisId: string): Promise<AnalysisRecord | null> {
    const analysis = await this.prisma.analysis.findUnique({
      where: { id: analysisId },
    });

    return analysis ? this.mapToAnalysisRecord(analysis) : null;
  }

  /**
   * Get latest analysis for a demo by type
   */
  async getLatestAnalysis(
    demoId: string,
    type: AnalysisType,
  ): Promise<AnalysisRecord | null> {
    const analysis = await this.prisma.analysis.findFirst({
      where: {
        demoId,
        type,
        status: AnalysisStatus.COMPLETED,
      },
      orderBy: { completedAt: "desc" },
    });

    return analysis ? this.mapToAnalysisRecord(analysis) : null;
  }

  /**
   * Get all analyses for a demo
   */
  async getAnalysesForDemo(demoId: string): Promise<readonly AnalysisRecord[]> {
    const analyses = await this.prisma.analysis.findMany({
      where: { demoId },
      orderBy: { createdAt: "desc" },
    });

    return analyses.map((a) => this.mapToAnalysisRecord(a));
  }

  /**
   * Get analyses by status
   */
  async getAnalysesByStatus(
    status: AnalysisStatus,
  ): Promise<readonly AnalysisRecord[]> {
    const analyses = await this.prisma.analysis.findMany({
      where: { status },
      orderBy: { createdAt: "asc" },
    });

    return analyses.map((a) => this.mapToAnalysisRecord(a));
  }

  /**
   * Get pending analyses (for queue processing)
   */
  async getPendingAnalyses(
    limit: number = 10,
  ): Promise<readonly AnalysisRecord[]> {
    const analyses = await this.prisma.analysis.findMany({
      where: { status: AnalysisStatus.PENDING },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    return analyses.map((a) => this.mapToAnalysisRecord(a));
  }

  /**
   * Get stale processing analyses (stuck for more than timeout)
   */
  async getStaleProcessingAnalyses(
    timeoutMinutes: number = 30,
  ): Promise<readonly AnalysisRecord[]> {
    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    const analyses = await this.prisma.analysis.findMany({
      where: {
        status: AnalysisStatus.PROCESSING,
        startedAt: { lt: cutoff },
      },
      orderBy: { startedAt: "asc" },
    });

    return analyses.map((a) => this.mapToAnalysisRecord(a));
  }

  // ===========================================================================
  // CONVENIENCE METHODS FOR STORING SPECIFIC ANALYSIS TYPES
  // ===========================================================================

  /**
   * Store player metrics analysis results
   */
  async storePlayerMetrics(
    demoId: string,
    playerMetrics: readonly PlayerMatchMetricsResult[],
    requestedById?: string,
  ): Promise<AnalysisRecord> {
    const analysis = await this.createAnalysis({
      demoId,
      type: AnalysisType.ADVANCED,
      requestedById,
    });

    await this.markAsStarted(analysis.id);

    const results = this.buildStoredResults({
      playerMetrics,
    });

    return this.markAsCompleted(analysis.id, results);
  }

  /**
   * Store full match analysis (all metrics)
   */
  async storeFullMatchAnalysis(
    demoId: string,
    data: {
      playerMetrics: readonly PlayerMatchMetricsResult[];
      matchOverview: MatchOverviewResult;
      roundAnalysis: RoundAnalysisResult;
      economyFlow: EconomyFlowResult;
      tradeAnalysis: TradeAnalysisResult;
    },
    requestedById?: string,
  ): Promise<AnalysisRecord> {
    const analysis = await this.createAnalysis({
      demoId,
      type: AnalysisType.ADVANCED,
      requestedById,
    });

    await this.markAsStarted(analysis.id);

    const results = this.buildStoredResults(data);

    return this.markAsCompleted(analysis.id, results);
  }

  /**
   * Check if an analysis already exists and is completed
   */
  async hasCompletedAnalysis(
    demoId: string,
    type: AnalysisType,
  ): Promise<boolean> {
    const count = await this.prisma.analysis.count({
      where: {
        demoId,
        type,
        status: AnalysisStatus.COMPLETED,
      },
    });

    return count > 0;
  }

  /**
   * Delete all analyses for a demo
   */
  async deleteAnalysesForDemo(demoId: string): Promise<number> {
    const { count } = await this.prisma.analysis.deleteMany({
      where: { demoId },
    });

    this.logger.debug(`Deleted ${count} analyses for demo ${demoId}`);
    return count;
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Build stored results with metadata
   */
  private buildStoredResults(
    data: Partial<
      Omit<StoredAnalysisResults, "version" | "analyzedAt" | "summary">
    >,
  ): StoredAnalysisResults {
    const summary = this.buildSummary(data);

    return {
      version: this.RESULTS_VERSION,
      analyzedAt: new Date().toISOString(),
      ...data,
      summary,
    };
  }

  /**
   * Build summary from analysis data
   */
  private buildSummary(
    data: Partial<
      Omit<StoredAnalysisResults, "version" | "analyzedAt" | "summary">
    >,
  ): StoredAnalysisResults["summary"] {
    const { playerMetrics, matchOverview } = data;

    if (!playerMetrics || playerMetrics.length === 0) {
      return {
        mvpSteamId: null,
        mvpRating: null,
        totalKills: 0,
        totalRounds: matchOverview?.metadata.totalRounds ?? 0,
        avgRating: 0,
        hasAdvancedMetrics: false,
      };
    }

    // Find MVP (highest rating)
    const sortedByRating = [...playerMetrics].sort(
      (a, b) => b.rating.rating - a.rating.rating,
    );
    const mvp = sortedByRating[0];

    // Calculate totals
    const totalKills = playerMetrics.reduce(
      (sum, p) => sum + p.combat.kills,
      0,
    );
    const avgRating =
      playerMetrics.reduce((sum, p) => sum + p.rating.rating, 0) /
      playerMetrics.length;

    // Check if advanced metrics are populated
    const hasAdvancedMetrics = playerMetrics.some(
      (p) => p.specialKills && p.specialKills.wallbangs >= 0,
    );

    return {
      mvpSteamId: mvp?.steamId ?? null,
      mvpRating: mvp ? round2(mvp.rating.rating) : null,
      totalKills,
      totalRounds:
        matchOverview?.metadata.totalRounds ??
        playerMetrics[0]?.combat.roundsPlayed ??
        0,
      avgRating: round2(avgRating),
      hasAdvancedMetrics,
    };
  }

  /**
   * Map Prisma model to AnalysisRecord
   */
  private mapToAnalysisRecord(analysis: {
    id: string;
    type: AnalysisType;
    status: AnalysisStatus;
    demoId: string;
    requestedById: string | null;
    results: Prisma.JsonValue | null;
    startedAt: Date | null;
    completedAt: Date | null;
    error: string | null;
    createdAt: Date;
  }): AnalysisRecord {
    return {
      id: analysis.id,
      type: analysis.type,
      status: analysis.status,
      demoId: analysis.demoId,
      requestedById: analysis.requestedById,
      results: analysis.results as StoredAnalysisResults | null,
      startedAt: analysis.startedAt,
      completedAt: analysis.completedAt,
      error: analysis.error,
      createdAt: analysis.createdAt,
    };
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
