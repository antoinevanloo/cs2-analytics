/**
 * Steam Import Processor
 *
 * BullMQ job processor for Steam import background tasks.
 *
 * @module steam-import
 */

import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { SteamImportService } from "./services/steam-import.service";
import { SteamGcService } from "./services/steam-gc.service";
import { DemoDownloadService } from "./services/demo-download.service";
import { PrismaService } from "../../common/prisma";
import { DemoService } from "../demo/demo.service";
import { MatchDownloadStatus, DemoStatus } from "@prisma/client";
import type {
  SyncMatchesJobData,
  DownloadDemoJobData,
} from "./types/steam-import.types";

const WORKER_OPTIONS = {
  concurrency: 1, // Serialize GC requests
  lockDuration: 600000, // 10 minutes
  maxStalledCount: 2,
};

@Processor("steam-import", WORKER_OPTIONS)
export class SteamImportProcessor extends WorkerHost {
  private readonly logger = new Logger(SteamImportProcessor.name);

  constructor(
    private readonly steamImportService: SteamImportService,
    private readonly steamGcService: SteamGcService,
    private readonly demoDownloadService: DemoDownloadService,
    private readonly demoService: DemoService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.name}:${job.id} completed`);
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Job ${job.name}:${job.id} failed: ${error.message}`,
      error.stack,
    );
  }

  @OnWorkerEvent("stalled")
  onStalled(jobId: string) {
    this.logger.warn(`Job ${jobId} stalled`);
  }

  async process(job: Job): Promise<unknown> {
    this.logger.log(`Processing job ${job.name}:${job.id}`);

    switch (job.name) {
      case "sync-matches":
        return this.processSyncMatches(job.data as SyncMatchesJobData);

      case "download-demo":
        return this.processDownloadDemo(job.data as DownloadDemoJobData);

      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
        throw new Error(`Unknown job type: ${job.name}`);
    }
  }

  /**
   * Process sync-matches job
   * Fetches new share codes from Steam API and creates SteamMatch records
   */
  private async processSyncMatches(data: SyncMatchesJobData): Promise<number> {
    const { syncId, userId } = data;

    this.logger.log(`Starting sync for user ${userId}, syncId ${syncId}`);

    try {
      const newMatchCount = await this.steamImportService.processSync(syncId);
      this.logger.log(
        `Sync completed for user ${userId}: ${newMatchCount} new matches`,
      );
      return newMatchCount;
    } catch (error) {
      this.logger.error(
        `Sync failed for user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Process download-demo job
   * Gets demo info from Game Coordinator and updates match record
   */
  private async processDownloadDemo(
    data: DownloadDemoJobData,
  ): Promise<{ success: boolean; demoId?: string }> {
    const { steamMatchId, userId } = data;

    this.logger.log(
      `Processing download for match ${steamMatchId}, user ${userId}`,
    );

    // Get match details from database
    const match = await this.prisma.steamMatch.findUnique({
      where: { id: steamMatchId },
      include: { sync: true },
    });

    if (!match) {
      throw new Error(`Match ${steamMatchId} not found`);
    }

    if (match.sync.userId !== userId) {
      throw new Error(`User ${userId} not authorized for match ${steamMatchId}`);
    }

    // Check if Steam GC service is configured
    if (!this.steamGcService.isConfigured()) {
      this.logger.warn(
        "Steam GC service not configured - skipping demo download",
      );
      await this.prisma.steamMatch.update({
        where: { id: steamMatchId },
        data: {
          downloadStatus: MatchDownloadStatus.FAILED,
          downloadError: "Steam bot not configured",
        },
      });
      return { success: false };
    }

    try {
      // Update status to downloading with initial progress
      await this.prisma.steamMatch.update({
        where: { id: steamMatchId },
        data: {
          downloadStatus: MatchDownloadStatus.DOWNLOADING,
          currentStep: 'FETCHING_URL',
          downloadProgress: 0,
        },
      });

      // Request demo details from Game Coordinator
      const result = await this.steamGcService.requestMatchDetails(
        match.matchId.toString(),
        match.outcomeId.toString(),
        match.token,
      );

      if (!result.success) {
        this.logger.warn(
          `Failed to get demo info for match ${steamMatchId}: ${result.error}`,
        );
        await this.prisma.steamMatch.update({
          where: { id: steamMatchId },
          data: {
            downloadStatus: MatchDownloadStatus.FAILED,
            downloadError: result.error || "Failed to get demo info",
          },
        });
        return { success: false };
      }

      // Update match with info from GC
      if (result.matchInfo) {
        await this.prisma.steamMatch.update({
          where: { id: steamMatchId },
          data: {
            mapName: result.matchInfo.mapName,
            matchTime: result.matchInfo.matchTime,
            matchDuration: result.matchInfo.matchDuration,
            team1Score: result.matchInfo.team1Score,
            team2Score: result.matchInfo.team2Score,
            downloadStatus: result.demoUrl
              ? MatchDownloadStatus.URL_FETCHED
              : MatchDownloadStatus.UNAVAILABLE,
            demoUrl: result.demoUrl ?? null,
            demoUrlExpiresAt: result.expiresAt ?? null,
          },
        });
      }

      if (result.demoUrl) {
        this.logger.log(
          `Demo URL fetched for match ${steamMatchId}, starting download...`,
        );

        // Progress callback for real-time UX updates (gamification)
        const onProgress = async (progress: {
          step: string;
          percent: number;
          downloadedBytes?: number;
          totalBytes?: number;
        }) => {
          await this.prisma.steamMatch.update({
            where: { id: steamMatchId },
            data: {
              downloadProgress: progress.percent,
              downloadedBytes: progress.downloadedBytes ? BigInt(progress.downloadedBytes) : null,
              totalBytes: progress.totalBytes ? BigInt(progress.totalBytes) : null,
              currentStep: progress.step,
            },
          });
        };

        // Download the demo file with progress tracking
        const downloadResult = await this.demoDownloadService.downloadDemo(
          result.demoUrl,
          steamMatchId,
          onProgress,
        );

        if (!downloadResult.success) {
          this.logger.error(
            `Demo download failed for match ${steamMatchId}: ${downloadResult.error}`,
          );
          await this.prisma.steamMatch.update({
            where: { id: steamMatchId },
            data: {
              downloadStatus: MatchDownloadStatus.FAILED,
              downloadError: downloadResult.error || "Download failed",
            },
          });
          return { success: false };
        }

        this.logger.log(
          `Demo downloaded for match ${steamMatchId}: ${downloadResult.filePath}`,
        );

        // Update status to downloaded
        await this.prisma.steamMatch.update({
          where: { id: steamMatchId },
          data: {
            downloadStatus: MatchDownloadStatus.DOWNLOADED,
          },
        });

        // Create Demo record and trigger parsing
        try {
          const filename = `steam_${match.shareCode.replace(/[^a-zA-Z0-9]/g, "_")}.dem`;

          // Create demo record with all required fields
          const demo = await this.prisma.demo.create({
            data: {
              filename,
              storagePath: downloadResult.filePath!,
              fileSize: downloadResult.fileSize || 0,
              fileHash: downloadResult.hash || `steam_${steamMatchId}_${Date.now()}`,
              storageType: "LOCAL",
              mapName: result.matchInfo?.mapName || "unknown",
              tickRate: 64,
              totalTicks: 0,
              durationSeconds: result.matchInfo?.matchDuration || 0,
              status: DemoStatus.PENDING,
              uploadedById: userId,
            },
          });

          // Link SteamMatch to Demo and update progress for parsing
          await this.prisma.steamMatch.update({
            where: { id: steamMatchId },
            data: {
              demoId: demo.id,
              downloadStatus: MatchDownloadStatus.PARSING,
              currentStep: 'PARSING',
              downloadProgress: 100, // Download complete, now parsing
            },
          });

          // Queue for parsing using DemoService
          this.logger.log(`Queueing demo ${demo.id} for parsing...`);
          await this.demoService.queueForParsing(demo.id, {});

          this.logger.log(
            `Demo ${demo.id} created and parsing triggered for match ${steamMatchId}`,
          );

          return { success: true, demoId: demo.id };
        } catch (parseError) {
          const errorMsg = parseError instanceof Error ? parseError.message : String(parseError);
          this.logger.error(
            `Failed to create demo or trigger parse: ${errorMsg}`,
          );
          await this.prisma.steamMatch.update({
            where: { id: steamMatchId },
            data: {
              downloadStatus: MatchDownloadStatus.FAILED,
              downloadError: `Parse setup failed: ${errorMsg}`,
            },
          });
          return { success: false };
        }
      } else {
        this.logger.warn(`No demo URL available for match ${steamMatchId}`);
        return { success: false };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error processing demo download for ${steamMatchId}: ${errorMessage}`,
      );

      await this.prisma.steamMatch.update({
        where: { id: steamMatchId },
        data: {
          downloadStatus: MatchDownloadStatus.FAILED,
          downloadError: errorMessage,
        },
      });

      throw error;
    }
  }
}
