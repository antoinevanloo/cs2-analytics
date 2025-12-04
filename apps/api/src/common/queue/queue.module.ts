/**
 * Queue Module - Centralized BullMQ configuration with production-ready features
 *
 * Features:
 * - Graceful shutdown handling
 * - Stalled job recovery on startup
 * - Connection pooling
 * - Event logging
 */

import {
  Module,
  Global,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>("REDIS_URL");
        const isProduction = configService.get("NODE_ENV") === "production";

        let connection: {
          host: string;
          port: number;
          maxRetriesPerRequest: null;
        };

        if (redisUrl) {
          const url = new URL(redisUrl);
          connection = {
            host: url.hostname,
            port: parseInt(url.port || "6379", 10),
            maxRetriesPerRequest: null, // Required for BullMQ
          };
        } else {
          connection = {
            host: configService.get("REDIS_HOST", "localhost"),
            port: configService.get("REDIS_PORT", 6379),
            maxRetriesPerRequest: null,
          };
        }

        return {
          connection,
          defaultJobOptions: {
            // Retry configuration
            attempts: isProduction ? 5 : 3,
            backoff: {
              type: "exponential",
              delay: 5000,
            },
            // Remove completed jobs
            removeOnComplete: {
              age: isProduction ? 86400 : 3600, // 24h prod, 1h dev
              count: 1000,
            },
            // Keep failed jobs for debugging
            removeOnFail: {
              age: isProduction ? 604800 : 86400, // 7d prod, 1d dev
              count: 5000,
            },
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}

/**
 * Queue Health Service - Monitors queue health and recovers stalled jobs
 */
@Global()
@Module({})
export class QueueHealthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueHealthService.name);
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    @InjectQueue("demo-parsing") private demoQueue: Queue,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.recoverStalledJobs();
    this.startHealthMonitoring();
    this.logger.log("Queue health service initialized");
  }

  async onModuleDestroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    await this.gracefulShutdown();
  }

  /**
   * Recover jobs that were left in "active" state after a crash
   */
  private async recoverStalledJobs(): Promise<void> {
    try {
      const stalledJobs = await this.demoQueue.getJobs(["active"]);

      if (stalledJobs.length > 0) {
        this.logger.warn(
          `Found ${stalledJobs.length} potentially stalled jobs, moving to waiting`,
        );

        for (const job of stalledJobs) {
          try {
            // Move back to waiting queue for retry
            await job.moveToFailed(
              new Error("Job recovered after restart"),
              job.token || "recovery",
            );
            await job.retry();
            this.logger.log(`Recovered stalled job ${job.id}`);
          } catch (err) {
            this.logger.error(`Failed to recover job ${job.id}: ${err}`);
          }
        }
      }
    } catch (err) {
      this.logger.error(`Error recovering stalled jobs: ${err}`);
    }
  }

  /**
   * Periodic health monitoring
   */
  private startHealthMonitoring(): void {
    const interval = this.configService.get("QUEUE_HEALTH_INTERVAL", 60000);

    this.healthCheckInterval = setInterval(async () => {
      try {
        const counts = await this.demoQueue.getJobCounts();
        const isPaused = await this.demoQueue.isPaused();

        this.logger.debug(
          `Queue status: waiting=${counts.waiting}, active=${counts.active}, ` +
            `completed=${counts.completed}, failed=${counts.failed}, paused=${isPaused}`,
        );

        // Alert if too many failed jobs
        if ((counts.failed ?? 0) > 10) {
          this.logger.warn(`High number of failed jobs: ${counts.failed}`);
        }

        // Alert if queue is backing up
        if ((counts.waiting ?? 0) > 50) {
          this.logger.warn(`Queue backing up: ${counts.waiting} waiting jobs`);
        }
      } catch (err) {
        this.logger.error(`Health check failed: ${err}`);
      }
    }, interval);
  }

  /**
   * Graceful shutdown - wait for active jobs to complete
   */
  private async gracefulShutdown(): Promise<void> {
    this.logger.log("Starting graceful shutdown...");

    try {
      // Pause the queue to stop accepting new jobs
      await this.demoQueue.pause();
      this.logger.log("Queue paused");

      // Wait for active jobs (with timeout)
      const timeout = this.configService.get("SHUTDOWN_TIMEOUT", 30000);
      const startTime = Date.now();

      while (Date.now() - startTime < timeout) {
        const activeCount = await this.demoQueue.getActiveCount();
        if (activeCount === 0) {
          this.logger.log("All active jobs completed");
          break;
        }
        this.logger.log(`Waiting for ${activeCount} active jobs...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      await this.demoQueue.close();
      this.logger.log("Queue closed");
    } catch (err) {
      this.logger.error(`Error during shutdown: ${err}`);
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: boolean;
  }> {
    const counts = await this.demoQueue.getJobCounts();
    const isPaused = await this.demoQueue.isPaused();

    return {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
      paused: isPaused,
    };
  }
}
