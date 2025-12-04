/**
 * Player Controller - REST API endpoints for player data
 */

import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiBearerAuth } from "@nestjs/swagger";
import { PlayerService } from "./player.service";
import { Public } from "../../common/decorators";

@ApiTags("players")
@ApiBearerAuth()
@Public() // All player endpoints are read-only and public
@Controller({ path: "players", version: "1" })
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Get(":steamId")
  @ApiOperation({ summary: "Get player profile by Steam ID" })
  @ApiParam({ name: "steamId", description: "Player Steam ID (64-bit)" })
  async getPlayer(@Param("steamId") steamId: string) {
    return this.playerService.getPlayer(steamId);
  }

  @Get(":steamId/stats")
  @ApiOperation({ summary: "Get aggregated player statistics" })
  @ApiParam({ name: "steamId", description: "Player Steam ID" })
  @ApiQuery({ name: "map", required: false, description: "Filter by map" })
  @ApiQuery({ name: "days", required: false, description: "Last N days" })
  async getPlayerStats(
    @Param("steamId") steamId: string,
    @Query("map") map?: string,
    @Query("days") days?: number
  ) {
    const options: { map?: string; days?: number } = {};
    if (map !== undefined) options.map = map;
    if (days !== undefined) options.days = days;
    return this.playerService.getPlayerStats(steamId, options);
  }

  @Get(":steamId/matches")
  @ApiOperation({ summary: "Get player match history" })
  @ApiParam({ name: "steamId", description: "Player Steam ID" })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  async getPlayerMatches(
    @Param("steamId") steamId: string,
    @Query("page") page = 1,
    @Query("limit") limit = 20
  ) {
    return this.playerService.getPlayerMatches(steamId, { page, limit });
  }

  @Get(":steamId/heatmap")
  @ApiOperation({ summary: "Get player position heatmap data" })
  @ApiParam({ name: "steamId", description: "Player Steam ID" })
  @ApiQuery({ name: "map", required: true, description: "Map name" })
  @ApiQuery({ name: "side", required: false, description: "T or CT" })
  async getPlayerHeatmap(
    @Param("steamId") steamId: string,
    @Query("map") map: string,
    @Query("side") side?: "T" | "CT"
  ) {
    const options: { map: string; side?: "T" | "CT" } = { map };
    if (side !== undefined) options.side = side;
    return this.playerService.getPlayerHeatmap(steamId, options);
  }

  @Get(":steamId/weapons")
  @ApiOperation({ summary: "Get player weapon statistics" })
  @ApiParam({ name: "steamId", description: "Player Steam ID" })
  async getPlayerWeaponStats(@Param("steamId") steamId: string) {
    return this.playerService.getPlayerWeaponStats(steamId);
  }

  @Get(":steamId/utility")
  @ApiOperation({ summary: "Get player utility usage statistics" })
  @ApiParam({ name: "steamId", description: "Player Steam ID" })
  async getPlayerUtilityStats(@Param("steamId") steamId: string) {
    return this.playerService.getPlayerUtilityStats(steamId);
  }

  @Get()
  @ApiOperation({ summary: "Search players" })
  @ApiQuery({ name: "name", required: false, description: "Search by name" })
  @ApiQuery({ name: "team", required: false, description: "Filter by team" })
  async searchPlayers(
    @Query("name") name?: string,
    @Query("team") team?: string
  ) {
    const options: { name?: string; team?: string } = {};
    if (name !== undefined) options.name = name;
    if (team !== undefined) options.team = team;
    return this.playerService.searchPlayers(options);
  }
}
