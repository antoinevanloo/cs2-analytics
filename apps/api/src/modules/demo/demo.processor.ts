/**
 * Demo Processor - BullMQ worker for processing demo parsing jobs
 *
 * Configured for robustness with:
 * - Concurrency limit to prevent parser overload
 * - Job timeout for hung jobs
 * - Retry with exponential backoff
 */

import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { DemoService } from "./demo.service";
import { ParserService } from "./parser.service";

interface ParseJobData {
  demoId: string;
  filePath: string;
  options: {
    extractTicks?: boolean;
    tickInterval?: number;
    extractGrenades?: boolean;
    extractChat?: boolean;
  };
}

// Worker options for robustness
const WORKER_OPTIONS = {
  // Process 1 job at a time - parser is single-threaded and can't handle concurrent requests
  // The queue handles concurrency by queueing jobs, not by parallel processing
  concurrency: 1,
  // Lock duration - how long a job can run before being considered stalled
  lockDuration: 600000, // 10 minutes
  // Max stalled count before job is considered failed
  maxStalledCount: 2,
};

@Processor("demo-parsing", WORKER_OPTIONS)
export class DemoProcessor extends WorkerHost {
  private readonly logger = new Logger(DemoProcessor.name);

  constructor(
    private demoService: DemoService,
    private parserService: ParserService
  ) {
    super();
  }

  async process(job: Job<ParseJobData>): Promise<void> {
    const { demoId, filePath, options } = job.data;

    this.logger.log(`Processing demo ${demoId} from ${filePath}`);

    try {
      // Note: We don't check parser health here because:
      // 1. The circuit breaker in parseDemo() handles failures
      // 2. The parser can't respond to health checks while processing
      // 3. BullMQ retry mechanism handles transient failures

      // Parse the demo - build options object excluding undefined values
      const parseOptions: {
        extractTicks?: boolean;
        tickInterval?: number;
        extractGrenades?: boolean;
        extractChat?: boolean;
      } = {};
      if (options.extractTicks !== undefined) parseOptions.extractTicks = options.extractTicks;
      if (options.tickInterval !== undefined) parseOptions.tickInterval = options.tickInterval;
      if (options.extractGrenades !== undefined) parseOptions.extractGrenades = options.extractGrenades;
      if (options.extractChat !== undefined) parseOptions.extractChat = options.extractChat;

      const result = await this.parserService.parseDemo(filePath, parseOptions);

      if (!result.success) {
        throw new Error(result.error || "Parsing failed");
      }

      this.logger.log(`Parser returned: events=${result.events?.length || 0}, rounds=${result.rounds?.length || 0}, players=${result.players?.length || 0}, grenades=${result.grenades?.length || 0}, chat=${result.chat_messages?.length || 0}`);

      // Store results and mark as completed
      await this.demoService.markAsCompleted(demoId, {
        metadata: result.metadata as import("./demo.service").DemoMetadata,
        players: result.players as import("./demo.service").DemoPlayer[],
        rounds: result.rounds as import("./demo.service").DemoRound[],
        events: result.events as import("./demo.service").DemoEvent[],
        grenades: result.grenades as import("./demo.service").DemoGrenade[],
        chat_messages: result.chat_messages as import("./demo.service").DemoChatMessage[],
      });

      this.logger.log(`Demo ${demoId} parsed successfully`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to parse demo ${demoId}: ${errorMessage}`);

      await this.demoService.markAsFailed(demoId, errorMessage);

      throw error; // Re-throw for BullMQ retry mechanism
    }
  }
}
