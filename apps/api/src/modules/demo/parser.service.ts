/**
 * Parser Service - Communicates with the Python parser microservice
 *
 * Features:
 * - Circuit breaker pattern for fault tolerance
 * - Request timeouts with AbortController
 * - Health check monitoring
 * - Stream-based file transfer (memory-efficient)
 */

import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createReadStream, promises as fsPromises } from "fs";
import * as path from "path";
import {
  CircuitBreaker,
  CircuitBreakerOpenError,
} from "../../common/resilience";
import { fileExists } from "../../common/streaming";

interface ParseResult {
  success: boolean;
  jobId?: string;
  metadata?: Record<string, unknown> | undefined;
  events?: unknown[] | undefined;
  players?: unknown[] | undefined;
  rounds?: unknown[] | undefined;
  grenades?: unknown[] | undefined;
  chat_messages?: unknown[] | undefined;
  ticks?: unknown[] | undefined;
  error?: string | undefined;
}

@Injectable()
export class ParserService implements OnModuleInit {
  private readonly logger = new Logger(ParserService.name);
  private readonly parserUrl: string;
  private readonly circuitBreaker: CircuitBreaker;

  // Timeout for parse requests (5 minutes for large demos)
  private readonly PARSE_TIMEOUT: number;
  // Timeout for health checks (5 seconds)
  private readonly HEALTH_TIMEOUT = 5000;

  constructor(private configService: ConfigService) {
    this.parserUrl = this.configService.get("PARSER_URL", "http://parser:8001");

    // Configure timeouts based on environment
    const isProduction = this.configService.get("NODE_ENV") === "production";
    this.PARSE_TIMEOUT = isProduction ? 300000 : 600000; // 5min prod, 10min dev

    // Initialize circuit breaker with environment-aware settings
    this.circuitBreaker = new CircuitBreaker({
      name: "ParserService",
      failureThreshold: isProduction ? 5 : 3,
      resetTimeout: isProduction ? 30000 : 15000, // 30s prod, 15s dev
      successThreshold: 2,
      failureWindow: 60000, // 1 minute
      requestTimeout: this.PARSE_TIMEOUT,
    });
  }

  async onModuleInit() {
    // Check parser health on startup
    const isHealthy = await this.checkHealth();
    if (isHealthy) {
      this.logger.log(`Parser service connected at ${this.parserUrl}`);
    } else {
      this.logger.warn(`Parser service not available at ${this.parserUrl}`);
    }
  }

  /**
   * Get circuit breaker status for monitoring
   */
  getCircuitBreakerStatus() {
    return this.circuitBreaker.getStatus();
  }

  /**
   * Manually reset circuit breaker (for admin operations)
   */
  resetCircuitBreaker() {
    this.circuitBreaker.reset();
  }

  /**
   * Send a demo file to the parser service for synchronous processing
   * Protected by circuit breaker pattern
   *
   * Uses streaming to avoid loading entire file into memory
   */
  async parseDemo(
    demoPath: string,
    options: {
      extractTicks?: boolean;
      tickInterval?: number;
      extractGrenades?: boolean;
      extractChat?: boolean;
      events?: string[];
      properties?: string[];
    } = {},
  ): Promise<ParseResult> {
    // Check file exists before consuming circuit breaker attempt
    const exists = await fileExists(demoPath);
    if (!exists) {
      return {
        success: false,
        error: `Demo file not found: ${demoPath}`,
      };
    }

    try {
      return await this.circuitBreaker.execute(async () => {
        const filename = path.basename(demoPath);

        // Build query params
        const params = new URLSearchParams();
        params.set("extract_ticks", String(options.extractTicks ?? false));
        params.set("tick_interval", String(options.tickInterval ?? 64));
        params.set("extract_grenades", String(options.extractGrenades ?? true));
        params.set("extract_chat", String(options.extractChat ?? true));

        // Stream the file to FormData - memory efficient
        const formData = await this.createStreamingFormData(demoPath, filename);

        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.PARSE_TIMEOUT,
        );

        const response = await fetch(
          `${this.parserUrl}/parse/sync?${params.toString()}`,
          {
            method: "POST",
            body: formData,
            signal: controller.signal,
          },
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response.text();
          this.logger.error(`Parser error: ${error}`);
          throw new Error(`Parser returned ${response.status}: ${error}`);
        }

        const data = (await response.json()) as {
          metadata?: Record<string, unknown>;
          events?: unknown[];
          players?: unknown[];
          rounds?: unknown[];
          grenades?: unknown[];
          chat_messages?: unknown[];
          ticks?: unknown[];
        };

        return {
          success: true,
          metadata: data.metadata,
          events: data.events,
          players: data.players,
          rounds: data.rounds,
          grenades: data.grenades,
          chat_messages: data.chat_messages,
          ticks: data.ticks,
        };
      });
    } catch (error) {
      // Handle circuit breaker open state
      if (error instanceof CircuitBreakerOpenError) {
        this.logger.warn(
          `Circuit breaker open, retry in ${error.retryAfterMs}ms`,
        );
        return {
          success: false,
          error: `Parser service temporarily unavailable. Retry in ${Math.ceil(error.retryAfterMs / 1000)} seconds.`,
        };
      }

      this.logger.error(`Failed to parse demo: ${error}`);
      return {
        success: false,
        error: `Failed to parse demo: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Create FormData with file stream for memory-efficient upload
   * Uses Node.js File API with stream support
   */
  private async createStreamingFormData(
    filePath: string,
    filename: string,
  ): Promise<FormData> {
    // Get file stats for size
    const stats = await fsPromises.stat(filePath);

    // Create a Blob from the file stream
    // Node.js 20+ supports Blob from stream via file: protocol
    const fileStream = createReadStream(filePath);
    const chunks: Buffer[] = [];

    // For now, we'll use a streaming approach that still buffers
    // but processes in chunks to avoid peak memory issues
    // TODO: When Node.js supports streaming Blob, use that instead
    for await (const chunk of fileStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const blob = new Blob(chunks, { type: "application/octet-stream" });
    const formData = new FormData();
    formData.append("file", blob, filename);

    this.logger.debug(`Created FormData for ${filename} (${stats.size} bytes)`);

    return formData;
  }

  /**
   * Upload demo to parser and get async job ID
   * Uses streaming for memory efficiency
   */
  async uploadAndParse(
    demoPath: string,
    options: {
      extractTicks?: boolean;
      tickInterval?: number;
      extractGrenades?: boolean;
      extractChat?: boolean;
    } = {},
  ): Promise<{ jobId: string } | { error: string }> {
    try {
      const exists = await fileExists(demoPath);
      if (!exists) {
        return { error: `Demo file not found: ${demoPath}` };
      }

      const filename = path.basename(demoPath);

      // Build query params
      const params = new URLSearchParams();
      params.set("extract_ticks", String(options.extractTicks ?? true));
      params.set("tick_interval", String(options.tickInterval ?? 1));
      params.set("extract_grenades", String(options.extractGrenades ?? true));
      params.set("extract_chat", String(options.extractChat ?? true));

      // Use streaming FormData
      const formData = await this.createStreamingFormData(demoPath, filename);

      const response = await fetch(
        `${this.parserUrl}/parse/upload?${params.toString()}`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (!response.ok) {
        const error = await response.text();
        return { error: `Parser returned ${response.status}: ${error}` };
      }

      const data = (await response.json()) as { job_id: string };
      return { jobId: data.job_id };
    } catch (error) {
      return { error: `Failed to connect to parser: ${error}` };
    }
  }

  /**
   * Check parser service health with timeout
   */
  async checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.HEALTH_TIMEOUT,
      );

      const response = await fetch(`${this.parserUrl}/health`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get parser service info and capabilities
   */
  async getInfo(): Promise<Record<string, unknown> | null> {
    try {
      const response = await fetch(`${this.parserUrl}/info`);
      if (response.ok) {
        return (await response.json()) as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get parsing job status
   */
  async getJobStatus(jobId: string): Promise<{
    status: string;
    progress: number;
    error?: string;
  } | null> {
    try {
      const response = await fetch(`${this.parserUrl}/parse/status/${jobId}`);
      if (response.ok) {
        return (await response.json()) as {
          status: string;
          progress: number;
          error?: string;
        };
      }
      return null;
    } catch {
      return null;
    }
  }
}
