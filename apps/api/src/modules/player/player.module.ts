/**
 * Player Module - Player statistics and profiles
 */

import { Module } from "@nestjs/common";
import { PlayerController } from "./player.controller";
import { PlayerService } from "./player.service";

@Module({
  controllers: [PlayerController],
  providers: [PlayerService],
  exports: [PlayerService],
})
export class PlayerModule {}
