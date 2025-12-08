/**
 * Steam Import Module
 *
 * Module for importing CS2 match demos from Steam.
 * Provides sync with Steam match history and demo download capabilities.
 *
 * @module steam-import
 */

import { Module, forwardRef } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { DemoModule } from "../demo/demo.module";

// Controller
import { SteamImportController } from "./steam-import.controller";

// Services
import { SteamImportService } from "./services/steam-import.service";
import { ShareCodeService } from "./services/share-code.service";
import { SteamMatchHistoryService } from "./services/steam-match-history.service";
import { SteamGcService } from "./services/steam-gc.service";
import { DemoDownloadService } from "./services/demo-download.service";

// Processor
import { SteamImportProcessor } from "./steam-import.processor";

@Module({
  imports: [
    // Steam import queue
    BullModule.registerQueue({
      name: "steam-import",
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000, // 5s -> 10s -> 20s
        },
        removeOnComplete: {
          age: 3600, // 1 hour
          count: 100,
        },
        removeOnFail: {
          age: 86400, // 24 hours
        },
      },
    }),
    // Import DemoModule for demo creation and parsing
    forwardRef(() => DemoModule),
  ],
  controllers: [SteamImportController],
  providers: [
    // Services
    SteamImportService,
    ShareCodeService,
    SteamMatchHistoryService,
    SteamGcService,
    DemoDownloadService,

    // Processor
    SteamImportProcessor,
  ],
  exports: [
    SteamImportService,
    ShareCodeService,
    SteamMatchHistoryService,
    SteamGcService,
    DemoDownloadService,
  ],
})
export class SteamImportModule {}
