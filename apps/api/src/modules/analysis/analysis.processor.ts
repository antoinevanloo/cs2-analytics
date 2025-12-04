/**
 * Analysis Processor - BullMQ worker for async analysis jobs
 *
 * Processes analysis jobs queued after demo parsing completes.
 * Computes all metrics and stores results for fast retrieval.
 *
 * Features:
 * - Full match analysis (all metrics)
 * - Automatic storage of results
 * - Progress reporting
 * - Error handling with retry
 *
 * @module analysis/processor
 */

import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { PlayerMetricsService } from "./services/player-metrics.service";
import { MatchAnalysisService } from "./services/match-analysis.service";
import { AnalysisStorageService } from "./services/analysis-storage.service";
import { AnalysisType, AnalysisStatus } from "@prisma/client";

/**
 * Job data for analysis processing
 */
export interface AnalysisJobData {
  /** Demo ID to analyze */
  demoId: string;
  /** Type of analysis to perform */
  type: "full" | "players" | "match";
  /** User who requested the analysis (optional) */
  requestedById?: string;
  /** Priority level */
  priority?: "high" | "normal" | "low";
}

/**
 * Job result returned after processing
 */
export interface AnalysisJobResult {
  demoId: string;
  analysisId: string;
  playersAnalyzed: number;
  roundsAnalyzed: number;
  duration: number;
}

// Worker configuration for robustness
const WORKER_OPTIONS = {
  // Process 2 analysis jobs concurrently (analysis is less CPU-intensive than parsing)
  concurrency: 2,
  // Lock duration - how long a job can run before being considered stalled
  lockDuration: 300000, // 5 minutes (analysis is faster than parsing)
  // Max stalled count before job is considered failed
  maxStalledCount: 2,
};

@Processor("demo-analysis", WORKER_OPTIONS)
export class AnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalysisProcessor.name);

  constructor(
    private readonly playerMetrics: PlayerMetricsService,
    private readonly matchAnalysis: MatchAnalysisService,
    private readonly storage: AnalysisStorageService,
  ) {
    super();
  }

  /**
   * Process an analysis job
   */
  async process(job: Job<AnalysisJobData>): Promise<AnalysisJobResult> {
    const { demoId, type, requestedById } = job.data;
    const startTime = Date.now();

    this.logger.log(
      `Processing ${type} analysis for demo ${demoId} (job ${job.id})`,
    );

    try {
      // Check if analysis already exists and is completed
      const existingAnalysis = await this.storage.getLatestAnalysis(
        demoId,
        AnalysisType.ADVANCED,
      );

      if (existingAnalysis?.status === AnalysisStatus.COMPLETED) {
        this.logger.log(`Analysis already exists for demo ${demoId}, skipping`);
        return {
          demoId,
          analysisId: existingAnalysis.id,
          playersAnalyzed: existingAnalysis.results?.playerMetrics?.length ?? 0,
          roundsAnalyzed:
            existingAnalysis.results?.matchOverview?.metadata.totalRounds ?? 0,
          duration: 0,
        };
      }

      // Update progress
      await job.updateProgress(10);

      // Perform full analysis based on type
      let result: Omit<AnalysisJobResult, "duration">;

      switch (type) {
        case "full":
          result = await this.performFullAnalysis(job, demoId, requestedById);
          break;
        case "players":
          result = await this.performPlayersOnlyAnalysis(
            job,
            demoId,
            requestedById,
          );
          break;
        case "match":
          result = await this.performMatchOnlyAnalysis(
            job,
            demoId,
            requestedById,
          );
          break;
        default:
          result = await this.performFullAnalysis(job, demoId, requestedById);
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `Analysis completed for demo ${demoId} in ${duration}ms ` +
          `(${result.playersAnalyzed} players, ${result.roundsAnalyzed} rounds)`,
      );

      return { ...result, duration };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to analyze demo ${demoId}: ${errorMessage}`);

      // Try to mark as failed in storage if we have an analysis record
      try {
        const pending = await this.storage.getAnalysesByStatus(
          AnalysisStatus.PROCESSING,
        );
        const ourAnalysis = pending.find((a) => a.demoId === demoId);
        if (ourAnalysis) {
          await this.storage.markAsFailed(ourAnalysis.id, errorMessage);
        }
      } catch {
        // Ignore storage errors during cleanup
      }

      throw error; // Re-throw for BullMQ retry mechanism
    }
  }

  /**
   * Full analysis - all metrics
   */
  private async performFullAnalysis(
    job: Job<AnalysisJobData>,
    demoId: string,
    requestedById?: string,
  ): Promise<Omit<AnalysisJobResult, "duration">> {
    // Calculate player metrics (this is the heavy computation)
    await job.updateProgress(20);
    const playerMetrics =
      await this.playerMetrics.calculateAllPlayersMetrics(demoId);

    await job.updateProgress(50);

    // Calculate match-level analysis
    const [matchOverview, roundAnalysis, economyFlow, tradeAnalysis] =
      await Promise.all([
        this.matchAnalysis.getMatchOverview(demoId),
        this.matchAnalysis.getRoundAnalysis(demoId),
        this.matchAnalysis.getEconomyFlow(demoId),
        this.matchAnalysis.getTradeAnalysis(demoId),
      ]);

    await job.updateProgress(80);

    // Store complete results
    const analysisRecord = await this.storage.storeFullMatchAnalysis(
      demoId,
      {
        playerMetrics,
        matchOverview,
        roundAnalysis,
        economyFlow,
        tradeAnalysis,
      },
      requestedById,
    );

    await job.updateProgress(100);

    return {
      demoId,
      analysisId: analysisRecord.id,
      playersAnalyzed: playerMetrics.length,
      roundsAnalyzed: matchOverview.metadata.totalRounds,
    };
  }

  /**
   * Players-only analysis
   */
  private async performPlayersOnlyAnalysis(
    job: Job<AnalysisJobData>,
    demoId: string,
    requestedById?: string,
  ): Promise<Omit<AnalysisJobResult, "duration">> {
    await job.updateProgress(20);
    const playerMetrics =
      await this.playerMetrics.calculateAllPlayersMetrics(demoId);

    await job.updateProgress(80);

    const analysisRecord = await this.storage.storePlayerMetrics(
      demoId,
      playerMetrics,
      requestedById,
    );

    await job.updateProgress(100);

    return {
      demoId,
      analysisId: analysisRecord.id,
      playersAnalyzed: playerMetrics.length,
      roundsAnalyzed: playerMetrics[0]?.combat.roundsPlayed ?? 0,
    };
  }

  /**
   * Match-only analysis (lighter, no per-player details)
   */
  private async performMatchOnlyAnalysis(
    job: Job<AnalysisJobData>,
    demoId: string,
    requestedById?: string,
  ): Promise<Omit<AnalysisJobResult, "duration">> {
    await job.updateProgress(20);

    const [matchOverview, roundAnalysis] = await Promise.all([
      this.matchAnalysis.getMatchOverview(demoId),
      this.matchAnalysis.getRoundAnalysis(demoId),
    ]);

    await job.updateProgress(80);

    // Store with minimal player metrics
    const playerMetrics =
      await this.playerMetrics.calculateAllPlayersMetrics(demoId);

    const analysisRecord = await this.storage.storeFullMatchAnalysis(
      demoId,
      {
        playerMetrics,
        matchOverview,
        roundAnalysis,
        economyFlow: await this.matchAnalysis.getEconomyFlow(demoId),
        tradeAnalysis: await this.matchAnalysis.getTradeAnalysis(demoId),
      },
      requestedById,
    );

    await job.updateProgress(100);

    return {
      demoId,
      analysisId: analysisRecord.id,
      playersAnalyzed: playerMetrics.length,
      roundsAnalyzed: matchOverview.metadata.totalRounds,
    };
  }

  // ===========================================================================
  // WORKER EVENTS
  // ===========================================================================

  @OnWorkerEvent("active")
  onActive(job: Job<AnalysisJobData>) {
    this.logger.debug(
      `Job ${job.id} is now active for demo ${job.data.demoId}`,
    );
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job<AnalysisJobData>) {
    this.logger.log(`Job ${job.id} completed for demo ${job.data.demoId}`);
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job<AnalysisJobData> | undefined, error: Error) {
    this.logger.error(
      `Job ${job?.id ?? "unknown"} failed for demo ${job?.data.demoId ?? "unknown"}: ${error.message}`,
    );
  }

  @OnWorkerEvent("stalled")
  onStalled(jobId: string) {
    this.logger.warn(`Job ${jobId} has stalled`);
  }
}
