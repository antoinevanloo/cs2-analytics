/**
 * Aggregation Module - Cross-demo statistics aggregation
 *
 * Provides comprehensive player and team statistics by aggregating
 * data across multiple matches.
 *
 * Features:
 * - Player profile aggregation (lifetime stats, form, percentiles)
 * - Team profile aggregation (synergy, map pool, situational stats)
 * - BullMQ queue for async processing
 * - REST API endpoints
 *
 * Architecture:
 * - Controller: REST API endpoints
 * - PlayerAggregationService: Player profile computation
 * - TeamAggregationService: Team profile computation
 * - AggregationProcessor: BullMQ worker for async jobs
 *
 * @module aggregation
 */

import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";

import { AggregationController } from "./aggregation.controller";
import { AggregationProcessor } from "./aggregation.processor";
import { PlayerAggregationService } from "./services/player-aggregation.service";
import { TeamAggregationService } from "./services/team-aggregation.service";
import { JOB_QUEUE_CONFIG } from "./aggregation.config";

@Module({
  imports: [
    // Register the aggregation queue with centralized configuration
    BullModule.registerQueue({
      name: JOB_QUEUE_CONFIG.QUEUE_NAME,
      defaultJobOptions: {
        // Retry configuration
        attempts: JOB_QUEUE_CONFIG.MAX_RETRY_ATTEMPTS,
        backoff: {
          type: "exponential",
          delay: JOB_QUEUE_CONFIG.RETRY_BACKOFF_MS,
        },
        // Remove completed jobs after configured retention period
        removeOnComplete: {
          age: JOB_QUEUE_CONFIG.COMPLETED_JOB_RETENTION_S,
          count: 200,
        },
        // Keep failed jobs for debugging
        removeOnFail: {
          age: JOB_QUEUE_CONFIG.FAILED_JOB_RETENTION_S,
        },
      },
    }),
  ],
  controllers: [AggregationController],
  providers: [
    // Services
    PlayerAggregationService,
    TeamAggregationService,

    // Queue processor (worker)
    AggregationProcessor,
  ],
  exports: [
    // Export services for use in other modules
    PlayerAggregationService,
    TeamAggregationService,
    // Export BullModule for other modules to queue aggregation jobs
    BullModule,
  ],
})
export class AggregationModule {}
