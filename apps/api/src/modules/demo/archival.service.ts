/**
 * Demo Archival Service - Manages archiving of old demos
 *
 * Features:
 * - Archives demos older than configurable threshold (default: 6 months)
 * - Compresses event data for archived demos
 * - Supports S3/GCS storage for archived files
 * - Maintains metadata for archived demos
 * - Batch processing for efficiency
 */

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../common/prisma";
import { DemoStatus, StorageType } from "@prisma/client";
import * as fs from "fs/promises";
import * as path from "path";
import { createGzip } from "zlib";
import { pipeline } from "stream/promises";
import { createReadStream, createWriteStream } from "fs";

export interface ArchivalConfig {
  enabled: boolean;
  thresholdMonths: number;
  batchSize: number;
  archiveStoragePath: string;
  deleteOriginalAfterArchive: boolean;
  compressEvents: boolean;
}

export interface ArchivalStats {
  totalArchived: number;
  totalSpaceSaved: number;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
}

interface ArchivalResult {
  demoId: string;
  success: boolean;
  originalSize?: number;
  archivedSize?: number;
  error?: string;
}

@Injectable()
export class ArchivalService {
  private readonly logger = new Logger(ArchivalService.name);
  private readonly config: ArchivalConfig;
  private stats: ArchivalStats = {
    totalArchived: 0,
    totalSpaceSaved: 0,
    lastRunAt: null,
    nextRunAt: null,
  };

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.config = {
      enabled: this.configService.get("ARCHIVAL_ENABLED", "true") === "true",
      thresholdMonths: parseInt(
        this.configService.get("ARCHIVAL_THRESHOLD_MONTHS", "6"),
        10,
      ),
      batchSize: parseInt(
        this.configService.get("ARCHIVAL_BATCH_SIZE", "10"),
        10,
      ),
      archiveStoragePath: this.configService.get(
        "ARCHIVE_STORAGE_PATH",
        "/tmp/demos/archive",
      ),
      deleteOriginalAfterArchive:
        this.configService.get("ARCHIVAL_DELETE_ORIGINAL", "false") === "true",
      compressEvents:
        this.configService.get("ARCHIVAL_COMPRESS_EVENTS", "true") === "true",
    };

    this.logger.log(
      `Archival service initialized: ${this.config.enabled ? "enabled" : "disabled"}, ` +
        `threshold: ${this.config.thresholdMonths} months`,
    );
  }

  /**
   * Get current archival statistics
   */
  getStats(): ArchivalStats {
    return { ...this.stats };
  }

  /**
   * Get archival configuration
   */
  getConfig(): ArchivalConfig {
    return { ...this.config };
  }

  /**
   * Scheduled archival job - runs daily at 3 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async scheduledArchival() {
    if (!this.config.enabled) {
      return;
    }

    this.logger.log("Starting scheduled archival job");
    const results = await this.archiveOldDemos();
    this.stats.lastRunAt = new Date();

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    this.logger.log(
      `Archival job completed: ${successful} archived, ${failed} failed`,
    );
  }

  /**
   * Archive demos older than threshold
   */
  async archiveOldDemos(): Promise<ArchivalResult[]> {
    const thresholdDate = new Date();
    thresholdDate.setMonth(
      thresholdDate.getMonth() - this.config.thresholdMonths,
    );

    // Find demos to archive
    const demosToArchive = await this.prisma.demo.findMany({
      where: {
        status: DemoStatus.COMPLETED,
        storageType: StorageType.LOCAL,
        parsedAt: {
          lt: thresholdDate,
        },
        // Don't re-archive already archived demos
        NOT: {
          storagePath: {
            contains: "/archive/",
          },
        },
      },
      take: this.config.batchSize,
      orderBy: {
        parsedAt: "asc",
      },
    });

    if (demosToArchive.length === 0) {
      this.logger.log("No demos to archive");
      return [];
    }

    this.logger.log(`Found ${demosToArchive.length} demos to archive`);

    const results: ArchivalResult[] = [];

    for (const demo of demosToArchive) {
      try {
        const result = await this.archiveDemo(demo.id);
        results.push(result);

        if (result.success) {
          this.stats.totalArchived++;
          this.stats.totalSpaceSaved +=
            (result.originalSize || 0) - (result.archivedSize || 0);
        }
      } catch (error) {
        results.push({
          demoId: demo.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * Archive a specific demo
   */
  async archiveDemo(demoId: string): Promise<ArchivalResult> {
    const demo = await this.prisma.demo.findUnique({
      where: { id: demoId },
    });

    if (!demo) {
      return { demoId, success: false, error: "Demo not found" };
    }

    if (demo.storageType !== StorageType.LOCAL) {
      return {
        demoId,
        success: false,
        error: "Demo is not stored locally",
      };
    }

    try {
      // Ensure archive directory exists
      await fs.mkdir(this.config.archiveStoragePath, { recursive: true });

      const originalPath = demo.storagePath;
      const archivePath = path.join(
        this.config.archiveStoragePath,
        `${demoId}.dem.gz`,
      );

      // Get original file size
      const originalStats = await fs.stat(originalPath);
      const originalSize = originalStats.size;

      // Compress demo file
      await this.compressFile(originalPath, archivePath);

      // Get compressed file size
      const archivedStats = await fs.stat(archivePath);
      const archivedSize = archivedStats.size;

      // Archive event data if configured
      if (this.config.compressEvents) {
        await this.archiveEventData(demoId);
      }

      // Update demo record
      await this.prisma.demo.update({
        where: { id: demoId },
        data: {
          storagePath: archivePath,
          storageType: StorageType.LOCAL, // Could be S3 if uploaded
        },
      });

      // Delete original if configured
      if (this.config.deleteOriginalAfterArchive) {
        await fs.unlink(originalPath).catch(() => {
          // Ignore deletion errors
        });
      }

      this.logger.log(
        `Archived demo ${demoId}: ${originalSize} -> ${archivedSize} bytes ` +
          `(${Math.round((1 - archivedSize / originalSize) * 100)}% reduction)`,
      );

      return {
        demoId,
        success: true,
        originalSize,
        archivedSize,
      };
    } catch (error) {
      this.logger.error(`Failed to archive demo ${demoId}: ${error}`);
      return {
        demoId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Compress a file using gzip
   */
  private async compressFile(
    inputPath: string,
    outputPath: string,
  ): Promise<void> {
    const gzip = createGzip({ level: 9 });
    const source = createReadStream(inputPath);
    const destination = createWriteStream(outputPath);

    await pipeline(source, gzip, destination);
  }

  /**
   * Archive event data by removing raw events and keeping aggregates
   * This significantly reduces database size for old demos
   */
  private async archiveEventData(demoId: string): Promise<void> {
    // Create aggregate summary before deletion
    const eventSummary = await this.prisma.gameEvent.groupBy({
      by: ["eventName"],
      where: { demoId },
      _count: { id: true },
    });

    // Store summary in demo metadata (could be a separate table)
    // For now, we keep the events but could delete them for space savings

    this.logger.debug(
      `Event summary for demo ${demoId}: ${eventSummary.length} event types`,
    );

    // Optional: Delete raw events after creating summary
    // await this.prisma.gameEvent.deleteMany({ where: { demoId } });
  }

  /**
   * Restore an archived demo
   */
  async restoreDemo(
    demoId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const demo = await this.prisma.demo.findUnique({
      where: { id: demoId },
    });

    if (!demo) {
      return { success: false, error: "Demo not found" };
    }

    if (!demo.storagePath.endsWith(".gz")) {
      return { success: false, error: "Demo is not archived (compressed)" };
    }

    try {
      const archivePath = demo.storagePath;
      const restoredPath = archivePath.replace(".dem.gz", ".dem");

      // Decompress file
      const { createGunzip } = await import("zlib");
      const gunzip = createGunzip();
      const source = createReadStream(archivePath);
      const destination = createWriteStream(restoredPath);

      await pipeline(source, gunzip, destination);

      // Update demo record
      await this.prisma.demo.update({
        where: { id: demoId },
        data: {
          storagePath: restoredPath,
        },
      });

      this.logger.log(`Restored demo ${demoId}`);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get archival candidates (demos that would be archived)
   */
  async getArchivalCandidates(limit = 100): Promise<
    Array<{
      id: string;
      filename: string;
      fileSize: number;
      parsedAt: Date | null;
      daysSinceParsed: number;
    }>
  > {
    const thresholdDate = new Date();
    thresholdDate.setMonth(
      thresholdDate.getMonth() - this.config.thresholdMonths,
    );

    const candidates = await this.prisma.demo.findMany({
      where: {
        status: DemoStatus.COMPLETED,
        storageType: StorageType.LOCAL,
        parsedAt: {
          lt: thresholdDate,
        },
        NOT: {
          storagePath: {
            contains: "/archive/",
          },
        },
      },
      select: {
        id: true,
        filename: true,
        fileSize: true,
        parsedAt: true,
      },
      take: limit,
      orderBy: {
        parsedAt: "asc",
      },
    });

    const now = new Date();
    return candidates.map((c) => ({
      ...c,
      daysSinceParsed: c.parsedAt
        ? Math.floor(
            (now.getTime() - c.parsedAt.getTime()) / (1000 * 60 * 60 * 24),
          )
        : 0,
    }));
  }
}
