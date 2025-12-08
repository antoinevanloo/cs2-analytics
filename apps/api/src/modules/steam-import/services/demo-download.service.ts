/**
 * Demo Download Service
 *
 * Downloads CS2 demo files from Valve servers and handles decompression.
 *
 * @module steam-import/services
 */

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createWriteStream, createReadStream, unlinkSync, existsSync, mkdirSync } from "fs";
import { pipeline } from "stream/promises";
import unbzip2Stream from "unbzip2-stream";
import * as https from "https";
import * as http from "http";
import { join } from "path";
import { createHash } from "crypto";

export interface DownloadResult {
  success: boolean;
  filePath?: string;
  fileSize?: number;
  hash?: string;
  error?: string;
}

/**
 * Progress callback for download tracking
 * Enables gamification: user sees real-time progress
 */
export type DownloadProgressCallback = (progress: {
  step: 'FETCHING_URL' | 'DOWNLOADING' | 'DECOMPRESSING' | 'COMPLETE';
  percent: number;        // 0-100
  downloadedBytes?: number;
  totalBytes?: number;
}) => Promise<void>;

@Injectable()
export class DemoDownloadService {
  private readonly logger = new Logger(DemoDownloadService.name);
  private readonly downloadDir: string;
  private readonly maxConcurrentDownloads = 2;
  private activeDownloads = 0;

  constructor(private readonly configService: ConfigService) {
    this.downloadDir = this.configService.get<string>(
      "DEMO_DOWNLOAD_DIR",
      "/tmp/cs2-demos",
    );

    // Ensure download directory exists
    if (!existsSync(this.downloadDir)) {
      mkdirSync(this.downloadDir, { recursive: true });
      this.logger.log(`Created demo download directory: ${this.downloadDir}`);
    }
  }

  /**
   * Download and decompress a demo file from URL
   *
   * @param demoUrl - URL of the demo file (usually .dem.bz2)
   * @param matchId - Match ID for naming the file
   * @param onProgress - Optional callback for progress updates (gamification)
   * @returns Download result with file path
   *
   * Performance: Streaming download, never loads full file in memory
   * Gamification: Real-time progress updates for UX
   */
  async downloadDemo(
    demoUrl: string,
    matchId: string,
    onProgress?: DownloadProgressCallback,
  ): Promise<DownloadResult> {
    if (this.activeDownloads >= this.maxConcurrentDownloads) {
      return {
        success: false,
        error: "Max concurrent downloads reached, please retry later",
      };
    }

    this.activeDownloads++;

    try {
      const isBz2 = demoUrl.endsWith(".bz2");
      const tempPath = join(this.downloadDir, `${matchId}.dem${isBz2 ? ".bz2" : ""}`);
      const finalPath = join(this.downloadDir, `${matchId}.dem`);

      this.logger.log(`Starting download: ${demoUrl}`);
      this.logger.log(`Temp path: ${tempPath}`);

      // Download the file with progress tracking
      await this.downloadFile(demoUrl, tempPath, onProgress);

      // Get file size
      const { size: downloadedSize } = await import("fs").then((fs) =>
        fs.promises.stat(tempPath),
      );
      this.logger.log(`Downloaded ${downloadedSize} bytes`);

      // Decompress if bz2
      if (isBz2) {
        this.logger.log("Decompressing bz2 file...");
        // Update progress: decompression phase (90-99%)
        if (onProgress) {
          await onProgress({ step: 'DECOMPRESSING', percent: 90 });
        }
        await this.decompressBz2(tempPath, finalPath);

        // Remove temp bz2 file
        unlinkSync(tempPath);
        this.logger.log("Decompression complete, temp file removed");
      } else {
        // No decompression needed, just rename
        await import("fs").then((fs) =>
          fs.promises.rename(tempPath, finalPath),
        );
      }

      // Calculate hash of final file
      const hash = await this.calculateFileHash(finalPath);
      const { size: finalSize } = await import("fs").then((fs) =>
        fs.promises.stat(finalPath),
      );

      this.logger.log(
        `Demo download complete: ${finalPath} (${finalSize} bytes, hash: ${hash.substring(0, 16)}...)`,
      );

      // Final progress update
      if (onProgress) {
        await onProgress({ step: 'COMPLETE', percent: 100 });
      }

      return {
        success: true,
        filePath: finalPath,
        fileSize: finalSize,
        hash,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Download failed: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      this.activeDownloads--;
    }
  }

  /**
   * Download a file from URL with progress tracking
   *
   * Progress updates are throttled to avoid DB spam (every 2 seconds)
   * Uses 0-89% range for download, leaving 90-100% for decompression
   */
  private downloadFile(
    url: string,
    destPath: string,
    onProgress?: DownloadProgressCallback,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith("https") ? https : http;
      const file = createWriteStream(destPath);

      const request = protocol.get(url, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            file.close();
            unlinkSync(destPath);
            this.downloadFile(redirectUrl, destPath, onProgress).then(resolve).catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200) {
          file.close();
          unlinkSync(destPath);
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        const totalSize = parseInt(response.headers["content-length"] || "0", 10);
        let downloadedSize = 0;
        let lastLogTime = Date.now();
        let lastProgressTime = 0;

        response.on("data", (chunk: Buffer) => {
          downloadedSize += chunk.length;
          const now = Date.now();

          // Log progress every 5 seconds
          if (now - lastLogTime > 5000) {
            const progress = totalSize
              ? ((downloadedSize / totalSize) * 100).toFixed(1)
              : "?";
            this.logger.log(
              `Download progress: ${progress}% (${(downloadedSize / 1024 / 1024).toFixed(1)} MB)`,
            );
            lastLogTime = now;
          }

          // Update DB progress every 2 seconds (throttled to avoid spam)
          if (onProgress && now - lastProgressTime > 2000) {
            const percent = totalSize
              ? Math.floor((downloadedSize / totalSize) * 89) // 0-89% for download
              : 0;
            const progressData: Parameters<DownloadProgressCallback>[0] = {
              step: 'DOWNLOADING' as const,
              percent,
              downloadedBytes: downloadedSize,
            };
            if (totalSize > 0) {
              progressData.totalBytes = totalSize;
            }
            onProgress(progressData).catch(() => {}); // Ignore progress update errors
            lastProgressTime = now;
          }
        });

        response.pipe(file);

        file.on("finish", () => {
          file.close();
          resolve();
        });

        file.on("error", (err) => {
          file.close();
          unlinkSync(destPath);
          reject(err);
        });
      });

      request.on("error", (err) => {
        file.close();
        if (existsSync(destPath)) {
          unlinkSync(destPath);
        }
        reject(err);
      });

      // Timeout after 5 minutes
      request.setTimeout(300000, () => {
        request.destroy();
        file.close();
        if (existsSync(destPath)) {
          unlinkSync(destPath);
        }
        reject(new Error("Download timeout after 5 minutes"));
      });
    });
  }

  /**
   * Decompress a bz2 file using unbzip2-stream
   *
   * Performance: Streams data chunk-by-chunk, memory-efficient for large demos (~500MB)
   * Resilience: Pipeline handles backpressure and cleanup on error
   */
  private async decompressBz2(srcPath: string, destPath: string): Promise<void> {
    const input = createReadStream(srcPath);
    const output = createWriteStream(destPath);

    await pipeline(input, unbzip2Stream(), output);
  }

  /**
   * Calculate SHA256 hash of a file
   */
  private calculateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash("sha256");
      const stream = createReadStream(filePath);

      stream.on("data", (data) => hash.update(data));
      stream.on("end", () => resolve(hash.digest("hex")));
      stream.on("error", reject);
    });
  }

  /**
   * Check if a demo file already exists
   */
  async demoExists(matchId: string): Promise<boolean> {
    const filePath = join(this.downloadDir, `${matchId}.dem`);
    return existsSync(filePath);
  }

  /**
   * Get the path for a demo file
   */
  getDemoPath(matchId: string): string {
    return join(this.downloadDir, `${matchId}.dem`);
  }

  /**
   * Clean up old demo files (older than specified days)
   */
  async cleanupOldDemos(maxAgeDays: number = 7): Promise<number> {
    const fs = await import("fs");
    const files = await fs.promises.readdir(this.downloadDir);
    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let deletedCount = 0;

    for (const file of files) {
      if (!file.endsWith(".dem")) continue;

      const filePath = join(this.downloadDir, file);
      const stats = await fs.promises.stat(filePath);

      if (now - stats.mtimeMs > maxAge) {
        await fs.promises.unlink(filePath);
        deletedCount++;
        this.logger.log(`Cleaned up old demo: ${file}`);
      }
    }

    return deletedCount;
  }
}
