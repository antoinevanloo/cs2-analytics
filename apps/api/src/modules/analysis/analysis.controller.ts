/**
 * Analysis Controller - REST API endpoints for advanced analytics
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
} from "@nestjs/swagger";
import { IsArray, IsOptional, IsString } from "class-validator";
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
}
