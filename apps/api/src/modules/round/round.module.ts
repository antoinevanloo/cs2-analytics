/**
 * Round Module - Round analysis and data
 */

import { Module } from "@nestjs/common";
import { RoundController } from "./round.controller";
import { RoundService } from "./round.service";

@Module({
  controllers: [RoundController],
  providers: [RoundService],
  exports: [RoundService],
})
export class RoundModule {}
