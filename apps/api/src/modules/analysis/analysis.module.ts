/**
 * Analysis Module - Advanced analytics and insights
 *
 * This module provides comprehensive CS2 match analysis:
 * - Player metrics (Rating, KAST, ADR, etc.)
 * - Team statistics
 * - Round-by-round analysis
 * - Economy flow
 * - Trade analysis
 * - Opening duels
 * - Clutch situations
 * - Utility usage
 *
 * Architecture:
 * - Controller: REST API endpoints
 * - AnalysisService: Main orchestrator (storage-first + fallback)
 * - AnalysisProcessor: BullMQ worker for async processing
 * - MatchAnalysisService: Match-level analysis
 * - PlayerMetricsService: Individual player analysis
 * - AnalysisStorageService: Persistence layer
 * - MetricsDataService: Database to calculator bridge
 * - Calculators: Pure functions for metric calculations
 *
 * @module analysis
 */

import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AnalysisController } from "./analysis.controller";
import { AnalysisService } from "./analysis.service";
import { AnalysisProcessor } from "./analysis.processor";
import { MetricsDataService } from "./services/metrics-data.service";
import { PlayerMetricsService } from "./services/player-metrics.service";
import { MatchAnalysisService } from "./services/match-analysis.service";
import { AnalysisStorageService } from "./services/analysis-storage.service";

@Module({
  imports: [
    // Register the analysis queue
    BullModule.registerQueue({
      name: "demo-analysis",
      defaultJobOptions: {
        // Retry configuration
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 3000, // Start with 3s, then 6s, then 12s
        },
        // Remove completed jobs after 6 hours
        removeOnComplete: {
          age: 21600,
          count: 500,
        },
        // Keep failed jobs for 7 days for debugging
        removeOnFail: {
          age: 604800,
        },
      },
    }),
  ],
  controllers: [AnalysisController],
  providers: [
    // Data access layer
    MetricsDataService,

    // Business logic services
    PlayerMetricsService,
    MatchAnalysisService,

    // Persistence layer
    AnalysisStorageService,

    // Queue processor (worker)
    AnalysisProcessor,

    // Main service (orchestrator)
    AnalysisService,
  ],
  exports: [
    // Export all services for use in other modules
    AnalysisService,
    PlayerMetricsService,
    MatchAnalysisService,
    MetricsDataService,
    AnalysisStorageService,
    // Export BullModule for other modules to queue analysis jobs
    BullModule,
  ],
})
export class AnalysisModule {}
