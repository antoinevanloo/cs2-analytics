/**
 * Replay Module
 *
 * Provides 2D replay functionality for demo analysis.
 *
 * Features:
 * - Player position streaming for round replay
 * - Event overlay data (kills, grenades, bombs)
 * - Map radar coordinate conversion
 * - NDJSON streaming for large datasets
 *
 * @module replay
 */

import { Module } from "@nestjs/common";

import { ReplayService } from "./replay.service";
import { ReplayController } from "./replay.controller";
import { DemoModule } from "../demo/demo.module";

@Module({
  imports: [DemoModule],
  controllers: [ReplayController],
  providers: [ReplayService],
  exports: [ReplayService],
})
export class ReplayModule {}
