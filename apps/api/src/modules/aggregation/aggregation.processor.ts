/**
 * Aggregation Processor - BullMQ worker for async aggregation jobs
 *
 * Processes aggregation jobs triggered after analysis completes.
 * Updates player and team profiles with new match data.
 *
 * Features:
 * - Player profile updates
 * - Team profile updates
 * - Batch recomputation
 * - Progress reporting
 * - Error handling with retry
 *
 * @module aggregation/processor
 */

import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { PlayerAggregationService } from "./services/player-aggregation.service";
import { TeamAggregationService } from "./services/team-aggregation.service";
import { JOB_QUEUE_CONFIG, type TimeWindowKey } from "./aggregation.config";

// =============================================================================
// JOB TYPES
// =============================================================================

/**
 * Job types for aggregation processing
 */
export type AggregationJobType =
  | "update-player"
  | "update-team"
  | "batch-players"
  | "batch-teams"
  | "full-recompute";

/**
 * Job data for aggregation processing
 */
export interface AggregationJobData {
  /** Type of aggregation job */
  type: AggregationJobType;

  /** Player Steam ID (for player jobs) */
  steamId?: string;

  /** Team ID (for team jobs) */
  teamId?: string;

  /** Steam IDs for batch jobs */
  steamIds?: string[];

  /** Team IDs for batch jobs */
  teamIds?: string[];

  /** Time window for aggregation */
  window?: TimeWindowKey;

  /** Demo ID that triggered this aggregation (optional) */
  triggeredByDemoId?: string;

  /** Priority level */
  priority?: "high" | "normal" | "low";
}

/**
 * Job result returned after processing
 */
export interface AggregationJobResult {
  type: AggregationJobType;
  playersUpdated: number;
  teamsUpdated: number;
  duration: number;
  errors: string[];
}

// =============================================================================
// WORKER CONFIGURATION
// =============================================================================

const WORKER_OPTIONS = {
  // Process multiple jobs concurrently (aggregation is DB-bound, not CPU-bound)
  concurrency: JOB_QUEUE_CONFIG.CONCURRENCY,
  // Lock duration - how long a job can run before being considered stalled
  lockDuration: JOB_QUEUE_CONFIG.LOCK_DURATION_MS,
  // Max stalled count before job is considered failed
  maxStalledCount: JOB_QUEUE_CONFIG.MAX_STALLED_COUNT,
};

// =============================================================================
// PROCESSOR
// =============================================================================

@Processor(JOB_QUEUE_CONFIG.QUEUE_NAME, WORKER_OPTIONS)
export class AggregationProcessor extends WorkerHost {
  private readonly logger = new Logger(AggregationProcessor.name);

  constructor(
    private readonly playerAggregation: PlayerAggregationService,
    private readonly teamAggregation: TeamAggregationService,
  ) {
    super();
  }

  /**
   * Process an aggregation job
   */
  async process(job: Job<AggregationJobData>): Promise<AggregationJobResult> {
    const { type } = job.data;
    const startTime = Date.now();
    const errors: string[] = [];

    this.logger.log(`Processing ${type} aggregation job (job ${job.id})`);

    try {
      let playersUpdated = 0;
      let teamsUpdated = 0;

      switch (type) {
        case "update-player":
          playersUpdated = await this.processPlayerUpdate(job);
          break;

        case "update-team":
          teamsUpdated = await this.processTeamUpdate(job);
          break;

        case "batch-players":
          playersUpdated = await this.processBatchPlayers(job, errors);
          break;

        case "batch-teams":
          teamsUpdated = await this.processBatchTeams(job, errors);
          break;

        case "full-recompute":
          const result = await this.processFullRecompute(job, errors);
          playersUpdated = result.players;
          teamsUpdated = result.teams;
          break;

        default:
          throw new Error(`Unknown aggregation job type: ${type}`);
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `Aggregation completed in ${duration}ms ` +
          `(${playersUpdated} players, ${teamsUpdated} teams)`,
      );

      return { type, playersUpdated, teamsUpdated, duration, errors };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to process aggregation job: ${errorMessage}`);
      throw error;
    }
  }

  // ===========================================================================
  // JOB HANDLERS
  // ===========================================================================

  /**
   * Update a single player's aggregation
   */
  private async processPlayerUpdate(
    job: Job<AggregationJobData>,
  ): Promise<number> {
    const { steamId, window = "all_time" } = job.data;

    if (!steamId) {
      throw new Error("steamId is required for update-player job");
    }

    await job.updateProgress(10);

    try {
      await this.playerAggregation.recomputePlayerProfile(steamId, window);
      await job.updateProgress(100);
      return 1;
    } catch (error) {
      this.logger.warn(`Failed to update player ${steamId}: ${error}`);
      return 0;
    }
  }

  /**
   * Update a single team's aggregation
   */
  private async processTeamUpdate(
    job: Job<AggregationJobData>,
  ): Promise<number> {
    const { teamId, window = "all_time" } = job.data;

    if (!teamId) {
      throw new Error("teamId is required for update-team job");
    }

    await job.updateProgress(10);

    try {
      await this.teamAggregation.recomputeTeamProfile(teamId, window);
      await job.updateProgress(100);
      return 1;
    } catch (error) {
      this.logger.warn(`Failed to update team ${teamId}: ${error}`);
      return 0;
    }
  }

  /**
   * Process batch of player updates
   */
  private async processBatchPlayers(
    job: Job<AggregationJobData>,
    errors: string[],
  ): Promise<number> {
    const { steamIds = [], window = "all_time" } = job.data;

    if (steamIds.length === 0) {
      this.logger.warn("No steamIds provided for batch-players job");
      return 0;
    }

    let updated = 0;
    const total = steamIds.length;

    for (let i = 0; i < steamIds.length; i++) {
      const steamId = steamIds[i];
      if (!steamId) continue;

      try {
        await this.playerAggregation.recomputePlayerProfile(steamId, window);
        updated++;
      } catch (error) {
        const msg = `Failed to update player ${steamId}: ${error}`;
        this.logger.warn(msg);
        errors.push(msg);
      }

      // Update progress
      const progress = Math.round(((i + 1) / total) * 100);
      await job.updateProgress(progress);
    }

    return updated;
  }

  /**
   * Process batch of team updates
   */
  private async processBatchTeams(
    job: Job<AggregationJobData>,
    errors: string[],
  ): Promise<number> {
    const { teamIds = [], window = "all_time" } = job.data;

    if (teamIds.length === 0) {
      this.logger.warn("No teamIds provided for batch-teams job");
      return 0;
    }

    let updated = 0;
    const total = teamIds.length;

    for (let i = 0; i < teamIds.length; i++) {
      const teamId = teamIds[i];
      if (!teamId) continue;

      try {
        await this.teamAggregation.recomputeTeamProfile(teamId, window);
        updated++;
      } catch (error) {
        const msg = `Failed to update team ${teamId}: ${error}`;
        this.logger.warn(msg);
        errors.push(msg);
      }

      // Update progress
      const progress = Math.round(((i + 1) / total) * 100);
      await job.updateProgress(progress);
    }

    return updated;
  }

  /**
   * Full recompute of all aggregations
   */
  private async processFullRecompute(
    job: Job<AggregationJobData>,
    errors: string[],
  ): Promise<{ players: number; teams: number }> {
    const { steamIds = [], teamIds = [], window = "all_time" } = job.data;

    let playersUpdated = 0;
    let teamsUpdated = 0;

    const totalItems = steamIds.length + teamIds.length;
    let completed = 0;

    // Process players
    for (const steamId of steamIds) {
      try {
        await this.playerAggregation.recomputePlayerProfile(steamId, window);
        playersUpdated++;
      } catch (error) {
        const msg = `Failed to update player ${steamId}: ${error}`;
        this.logger.warn(msg);
        errors.push(msg);
      }

      completed++;
      await job.updateProgress(Math.round((completed / totalItems) * 100));
    }

    // Process teams
    for (const teamId of teamIds) {
      try {
        await this.teamAggregation.recomputeTeamProfile(teamId, window);
        teamsUpdated++;
      } catch (error) {
        const msg = `Failed to update team ${teamId}: ${error}`;
        this.logger.warn(msg);
        errors.push(msg);
      }

      completed++;
      await job.updateProgress(Math.round((completed / totalItems) * 100));
    }

    return { players: playersUpdated, teams: teamsUpdated };
  }

  // ===========================================================================
  // WORKER EVENTS
  // ===========================================================================

  @OnWorkerEvent("active")
  onActive(job: Job<AggregationJobData>) {
    this.logger.debug(`Job ${job.id} is now active (type: ${job.data.type})`);
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job<AggregationJobData>) {
    this.logger.log(`Job ${job.id} completed (type: ${job.data.type})`);
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job<AggregationJobData> | undefined, error: Error) {
    this.logger.error(
      `Job ${job?.id ?? "unknown"} failed (type: ${job?.data.type ?? "unknown"}): ${error.message}`,
    );
  }

  @OnWorkerEvent("stalled")
  onStalled(jobId: string) {
    this.logger.warn(`Job ${jobId} has stalled`);
  }
}
