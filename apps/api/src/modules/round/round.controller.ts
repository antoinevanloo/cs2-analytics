/**
 * Round Controller - REST API endpoints for round data
 */

import { Controller, Get, Param, Query, ParseIntPipe } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { RoundService } from "./round.service";
import { Public } from "../../common/decorators";

@ApiTags("rounds")
@ApiBearerAuth()
@Public() // All round endpoints are read-only and public
@Controller({ path: "rounds", version: "1" })
export class RoundController {
  constructor(private readonly roundService: RoundService) {}

  @Get(":demoId/:roundNumber")
  @ApiOperation({ summary: "Get detailed round data" })
  @ApiParam({ name: "demoId", description: "Demo UUID" })
  @ApiParam({ name: "roundNumber", description: "Round number" })
  async getRound(
    @Param("demoId") demoId: string,
    @Param("roundNumber", ParseIntPipe) roundNumber: number,
  ) {
    return this.roundService.getRound(demoId, roundNumber);
  }

  @Get(":demoId/:roundNumber/timeline")
  @ApiOperation({ summary: "Get round timeline events" })
  @ApiParam({ name: "demoId", description: "Demo UUID" })
  @ApiParam({ name: "roundNumber", description: "Round number" })
  async getRoundTimeline(
    @Param("demoId") demoId: string,
    @Param("roundNumber", ParseIntPipe) roundNumber: number,
  ) {
    return this.roundService.getRoundTimeline(demoId, roundNumber);
  }

  @Get(":demoId/:roundNumber/economy")
  @ApiOperation({ summary: "Get round economy breakdown" })
  @ApiParam({ name: "demoId", description: "Demo UUID" })
  @ApiParam({ name: "roundNumber", description: "Round number" })
  async getRoundEconomy(
    @Param("demoId") demoId: string,
    @Param("roundNumber", ParseIntPipe) roundNumber: number,
  ) {
    return this.roundService.getRoundEconomy(demoId, roundNumber);
  }

  @Get(":demoId/:roundNumber/replay")
  @ApiOperation({ summary: "Get round replay data (tick-by-tick positions)" })
  @ApiParam({ name: "demoId", description: "Demo UUID" })
  @ApiParam({ name: "roundNumber", description: "Round number" })
  @ApiQuery({ name: "interval", required: false, description: "Tick interval" })
  async getRoundReplay(
    @Param("demoId") demoId: string,
    @Param("roundNumber", ParseIntPipe) roundNumber: number,
    @Query("interval", new ParseIntPipe({ optional: true })) interval?: number,
  ) {
    return this.roundService.getRoundReplay(demoId, roundNumber, interval);
  }

  @Get(":demoId/:roundNumber/killfeed")
  @ApiOperation({ summary: "Get round kill feed" })
  @ApiParam({ name: "demoId", description: "Demo UUID" })
  @ApiParam({ name: "roundNumber", description: "Round number" })
  async getRoundKillfeed(
    @Param("demoId") demoId: string,
    @Param("roundNumber", ParseIntPipe) roundNumber: number,
  ) {
    return this.roundService.getRoundKillfeed(demoId, roundNumber);
  }
}
