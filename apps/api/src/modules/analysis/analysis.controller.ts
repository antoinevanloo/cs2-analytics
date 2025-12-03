/**
 * Analysis Controller - REST API endpoints for advanced analytics
 */

import { Controller, Get, Post, Param, Query, Body } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from "@nestjs/swagger";
import { AnalysisService } from "./analysis.service";

@ApiTags("analysis")
@Controller({ path: "analysis", version: "1" })
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Get("demo/:demoId/overview")
  @ApiOperation({ summary: "Get match overview analysis" })
  @ApiParam({ name: "demoId", description: "Demo UUID" })
  async getMatchOverview(@Param("demoId") demoId: string) {
    return this.analysisService.getMatchOverview(demoId);
  }

  @Get("demo/:demoId/opening-duels")
  @ApiOperation({ summary: "Analyze opening duels" })
  @ApiParam({ name: "demoId", description: "Demo UUID" })
  async getOpeningDuels(@Param("demoId") demoId: string) {
    return this.analysisService.getOpeningDuels(demoId);
  }

  @Get("demo/:demoId/clutches")
  @ApiOperation({ summary: "Analyze clutch situations" })
  @ApiParam({ name: "demoId", description: "Demo UUID" })
  async getClutches(@Param("demoId") demoId: string) {
    return this.analysisService.getClutches(demoId);
  }

  @Get("demo/:demoId/trades")
  @ApiOperation({ summary: "Analyze trade kills" })
  @ApiParam({ name: "demoId", description: "Demo UUID" })
  async getTrades(@Param("demoId") demoId: string) {
    return this.analysisService.getTrades(demoId);
  }

  @Get("demo/:demoId/economy")
  @ApiOperation({ summary: "Full economy analysis" })
  @ApiParam({ name: "demoId", description: "Demo UUID" })
  async getEconomyAnalysis(@Param("demoId") demoId: string) {
    return this.analysisService.getEconomyAnalysis(demoId);
  }

  @Get("demo/:demoId/utility")
  @ApiOperation({ summary: "Utility usage analysis" })
  @ApiParam({ name: "demoId", description: "Demo UUID" })
  async getUtilityAnalysis(@Param("demoId") demoId: string) {
    return this.analysisService.getUtilityAnalysis(demoId);
  }

  @Get("demo/:demoId/positioning")
  @ApiOperation({ summary: "Team positioning analysis" })
  @ApiParam({ name: "demoId", description: "Demo UUID" })
  async getPositioningAnalysis(@Param("demoId") demoId: string) {
    return this.analysisService.getPositioningAnalysis(demoId);
  }

  @Get("demo/:demoId/heatmaps")
  @ApiOperation({ summary: "Generate heatmaps for the match" })
  @ApiParam({ name: "demoId", description: "Demo UUID" })
  @ApiQuery({ name: "type", description: "Heatmap type (positions, kills, deaths)" })
  @ApiQuery({ name: "team", required: false, description: "Filter by team" })
  async getHeatmaps(
    @Param("demoId") demoId: string,
    @Query("type") type: string,
    @Query("team") team?: "T" | "CT"
  ) {
    const options: { type: string; team?: "T" | "CT" } = { type };
    if (team !== undefined) options.team = team;
    return this.analysisService.getHeatmaps(demoId, options);
  }

  @Get("demo/:demoId/coaching-insights")
  @ApiOperation({ summary: "Get AI-generated coaching insights" })
  @ApiParam({ name: "demoId", description: "Demo UUID" })
  async getCoachingInsights(@Param("demoId") demoId: string) {
    return this.analysisService.getCoachingInsights(demoId);
  }

  @Post("compare")
  @ApiOperation({ summary: "Compare multiple demos/players" })
  async compareData(@Body() body: { demoIds?: string[]; playerIds?: string[] }) {
    return this.analysisService.compare(body);
  }
}
