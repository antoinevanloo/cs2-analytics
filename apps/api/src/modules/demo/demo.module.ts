/**
 * Demo Module - Handles demo file management and parsing
 *
 * Features:
 * - Demo upload and parsing orchestration
 * - BullMQ queue for async processing
 * - Automatic analysis trigger after parsing
 * - Archival service for old demos
 * - Centralized parsing configuration
 *
 * Architecture:
 * - ParsingConfigService provides extensible parsing profiles
 * - Re-parsing support for demos without tick data
 */

import { Module, forwardRef } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ScheduleModule } from "@nestjs/schedule";
import { DemoController } from "./demo.controller";
import { DemoService } from "./demo.service";
import { DemoAccessService } from "./demo-access.service";
import { ParserService } from "./parser.service";
import { DemoProcessor } from "./demo.processor";
import { ArchivalService } from "./archival.service";
import { AnalysisModule } from "../analysis/analysis.module";
import { ParsingConfigService } from "../../common/config";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    // Demo parsing queue
    BullModule.registerQueue({
      name: "demo-parsing",
      defaultJobOptions: {
        // Retry configuration
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000, // Start with 5s, then 10s, then 20s
        },
        // Remove completed jobs after 1 hour
        removeOnComplete: {
          age: 3600,
          count: 100,
        },
        // Keep failed jobs for 24 hours for debugging
        removeOnFail: {
          age: 86400,
        },
      },
    }),
    // Import AnalysisModule to access the analysis queue
    forwardRef(() => AnalysisModule),
  ],
  controllers: [DemoController],
  providers: [
    DemoService,
    DemoAccessService,
    ParserService,
    DemoProcessor,
    ArchivalService,
    ParsingConfigService,
  ],
  exports: [
    DemoService,
    DemoAccessService,
    ParserService,
    ArchivalService,
    ParsingConfigService,
    BullModule,
  ],
})
export class DemoModule {}
