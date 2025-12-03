/**
 * Demo Module - Handles demo file management and parsing
 */

import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { DemoController } from "./demo.controller";
import { DemoService } from "./demo.service";
import { ParserService } from "./parser.service";
import { DemoProcessor } from "./demo.processor";

@Module({
  imports: [
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
  ],
  controllers: [DemoController],
  providers: [DemoService, ParserService, DemoProcessor],
  exports: [DemoService, ParserService, BullModule],
})
export class DemoModule {}
