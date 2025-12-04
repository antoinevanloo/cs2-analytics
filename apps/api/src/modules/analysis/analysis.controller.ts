/**
 * Analysis Controller - REST API endpoints for advanced analytics
 *
 * Provides comprehensive match analysis including:
 * - HLTV Rating 2.0 calculations
 * - Opening duels, clutches, trades
 * - Economy and utility analysis
 * - Coaching insights
 */

import { Controller, Get, Post, Param, Query, Body } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiBody,
  ApiPropertyOptional,
  ApiResponse,
} from "@nestjs/swagger";
import {
  IsArray,
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";
import { AnalysisService } from "./analysis.service";
import { Public, Roles } from "../../common/decorators";

/**
 * DTO for comparing demos or players
 */
class CompareDataDto {
  @ApiPropertyOptional({
    description: "List of demo UUIDs to compare",
    type: [String],
    example: ["uuid-1", "uuid-2"],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  demoIds?: string[];

  @ApiPropertyOptional({
    description: "List of player Steam IDs to compare",
    type: [String],
    example: ["76561198000000001", "76561198000000002"],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  playerIds?: string[];
}

/**
 * DTO for rating simulation (what-if analysis)
 */
class RatingSimulationDto {
  @ApiPropertyOptional({
    description: "Simulated KAST percentage (0-100)",
    example: 75,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  kast?: number;

  @ApiPropertyOptional({
    description: "Simulated kills per round",
    example: 0.8,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(3)
  @Type(() => Number)
  kpr?: number;

  @ApiPropertyOptional({
    description: "Simulated deaths per round",
    example: 0.6,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(3)
  @Type(() => Number)
  dpr?: number;

  @ApiPropertyOptional({
    description: "Simulated impact rating",
    example: 1.1,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(2)
  @Type(() => Number)
  impact?: number;

  @ApiPropertyOptional({
    description: "Simulated average damage per round",
    example: 85,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(200)
  @Type(() => Number)
  adr?: number;
}

@ApiTags("Analysis")
@ApiBearerAuth("JWT-auth")
@Controller({ path: "analysis", version: "1" })
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Get("demo/:demoId/overview")
  @Public()
  @ApiOperation({ summary: "Get match overview analysis" })
  @ApiParam({ name: "demoId", description: "Demo UUID" })
  async getMatchOverview(@Param("demoId") demoId: string) {
    return this.analysisService.getMatchOverview(demoId);
  }

  @Get("demo/:demoId/opening-duels")
  @Public()
  @ApiOperation({ summary: "Analyze opening duels" })
  @ApiParam({ name: "demoId", description: "Demo UUID" })
  async getOpeningDuels(@Param("demoId") demoId: string) {
    return this.analysisService.getOpeningDuels(demoId);
  }

  @Get("demo/:demoId/clutches")
  @Public()
  @ApiOperation({ summary: "Analyze clutch situations" })
  @ApiParam({ name: "demoId", description: "Demo UUID" })
  async getClutches(@Param("demoId") demoId: string) {
    return this.analysisService.getClutches(demoId);
  }

  @Get("demo/:demoId/trades")
  @Public()
  @ApiOperation({ summary: "Analyze trade kills" })
  @ApiParam({ name: "demoId", description: "Demo UUID" })
  async getTrades(@Param("demoId") demoId: string) {
    return this.analysisService.getTrades(demoId);
  }

  @Get("demo/:demoId/economy")
  @Public()
  @ApiOperation({ summary: "Full economy analysis" })
  @ApiParam({ name: "demoId", description: "Demo UUID" })
  async getEconomyAnalysis(@Param("demoId") demoId: string) {
    return this.analysisService.getEconomyAnalysis(demoId);
  }

  @Get("demo/:demoId/utility")
  @Public()
  @ApiOperation({ summary: "Utility usage analysis" })
  @ApiParam({ name: "demoId", description: "Demo UUID" })
  async getUtilityAnalysis(@Param("demoId") demoId: string) {
    return this.analysisService.getUtilityAnalysis(demoId);
  }

  @Get("demo/:demoId/positioning")
  @Public()
  @ApiOperation({ summary: "Team positioning analysis" })
  @ApiParam({ name: "demoId", description: "Demo UUID" })
  async getPositioningAnalysis(@Param("demoId") demoId: string) {
    return this.analysisService.getPositioningAnalysis(demoId);
  }

  @Get("demo/:demoId/heatmaps")
  @Public()
  @ApiOperation({ summary: "Generate heatmaps for the match" })
  @ApiParam({ name: "demoId", description: "Demo UUID" })
  @ApiQuery({
    name: "type",
    description: "Heatmap type (positions, kills, deaths)",
  })
  @ApiQuery({ name: "team", required: false, description: "Filter by team" })
  async getHeatmaps(
    @Param("demoId") demoId: string,
    @Query("type") type: string,
    @Query("team") team?: "T" | "CT",
  ) {
    const options: { type: string; team?: "T" | "CT" } = { type };
    if (team !== undefined) options.team = team;
    return this.analysisService.getHeatmaps(demoId, options);
  }

  @Get("demo/:demoId/coaching-insights")
  @Public()
  @ApiOperation({ summary: "Get AI-generated coaching insights" })
  @ApiParam({ name: "demoId", description: "Demo UUID" })
  async getCoachingInsights(@Param("demoId") demoId: string) {
    return this.analysisService.getCoachingInsights(demoId);
  }

  @Post("compare")
  @Roles("user")
  @ApiOperation({ summary: "Compare multiple demos/players" })
  @ApiBody({ type: CompareDataDto })
  async compareData(@Body() body: CompareDataDto) {
    return this.analysisService.compare(body);
  }

  // ===========================================================================
  // HLTV RATING 2.0 ENDPOINTS
  // ===========================================================================

  @Get("demo/:demoId/ratings")
  @Public()
  @ApiOperation({
    summary: "Get HLTV Rating 2.0 for all players in a demo",
    description:
      "Returns complete rating breakdown for each player including components (KAST, KPR, DPR, Impact, ADR), contributions, and benchmarks.",
  })
  @ApiParam({ name: "demoId", description: "Demo UUID" })
  @ApiResponse({
    status: 200,
    description: "Player ratings with full breakdown",
  })
  async getDemoRatings(@Param("demoId") demoId: string) {
    return this.analysisService.getDemoRatings(demoId);
  }

  @Get("demo/:demoId/player/:steamId/rating")
  @Public()
  @ApiOperation({
    summary: "Get HLTV Rating 2.0 for a specific player in a demo",
    description:
      "Returns detailed rating for a single player including all components and improvement suggestions.",
  })
  @ApiParam({ name: "demoId", description: "Demo UUID" })
  @ApiParam({ name: "steamId", description: "Player Steam ID (64-bit)" })
  async getPlayerRating(
    @Param("demoId") demoId: string,
    @Param("steamId") steamId: string,
  ) {
    return this.analysisService.getPlayerRating(demoId, steamId);
  }

  @Get("player/:steamId/rating/history")
  @Public()
  @ApiOperation({
    summary: "Get rating history for a player across matches",
    description:
      "Returns rating trend over time with match metadata. Useful for tracking improvement.",
  })
  @ApiParam({ name: "steamId", description: "Player Steam ID (64-bit)" })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Maximum number of matches (default: 20)",
  })
  @ApiQuery({
    name: "map",
    required: false,
    description: "Filter by map name",
  })
  async getPlayerRatingHistory(
    @Param("steamId") steamId: string,
    @Query("limit") limit?: number,
    @Query("map") map?: string,
  ) {
    const options: { limit?: number; map?: string } = {};
    if (limit !== undefined) options.limit = limit;
    if (map !== undefined) options.map = map;
    return this.analysisService.getPlayerRatingHistory(steamId, options);
  }

  @Post("demo/:demoId/player/:steamId/rating/simulate")
  @Public()
  @ApiOperation({
    summary: "Simulate rating with modified stats (what-if analysis)",
    description:
      "Calculate what rating would be with different stats. Useful for coaching and identifying improvement areas.",
  })
  @ApiParam({ name: "demoId", description: "Demo UUID" })
  @ApiParam({ name: "steamId", description: "Player Steam ID (64-bit)" })
  @ApiBody({ type: RatingSimulationDto })
  async simulateRating(
    @Param("demoId") demoId: string,
    @Param("steamId") steamId: string,
    @Body() simulation: RatingSimulationDto,
  ) {
    return this.analysisService.simulatePlayerRating(
      demoId,
      steamId,
      simulation,
    );
  }

  @Get("demo/:demoId/player/:steamId/rating/improvements")
  @Public()
  @ApiOperation({
    summary: "Get improvement suggestions to reach target rating",
    description:
      "Analyzes current stats and suggests which areas to improve to reach a target rating.",
  })
  @ApiParam({ name: "demoId", description: "Demo UUID" })
  @ApiParam({ name: "steamId", description: "Player Steam ID (64-bit)" })
  @ApiQuery({
    name: "target",
    required: false,
    description: "Target rating (default: 1.10)",
  })
  async getRatingImprovements(
    @Param("demoId") demoId: string,
    @Param("steamId") steamId: string,
    @Query("target") target?: number,
  ) {
    return this.analysisService.getPlayerRatingImprovements(
      demoId,
      steamId,
      target,
    );
  }

  @Get("demo/:demoId/ratings/leaderboard")
  @Public()
  @ApiOperation({
    summary: "Get player leaderboard for a demo sorted by rating",
    description:
      "Returns players ranked by HLTV Rating 2.0 with key stats for quick comparison.",
  })
  @ApiParam({ name: "demoId", description: "Demo UUID" })
  async getDemoLeaderboard(@Param("demoId") demoId: string) {
    return this.analysisService.getDemoLeaderboard(demoId);
  }
}
