/**
 * Aggregation Controller - REST API for aggregated statistics
 *
 * Provides endpoints for player and team profile retrieval.
 *
 * Endpoints:
 * - GET /aggregation/players/:steamId - Get player profile
 * - GET /aggregation/players/:steamId/compare/:otherSteamId - Compare players
 * - GET /aggregation/teams/:teamId - Get team profile
 * - GET /aggregation/teams/roster - Get team profile by roster
 * - POST /aggregation/recompute/player/:steamId - Force recompute player
 * - POST /aggregation/recompute/team/:teamId - Force recompute team
 *
 * @module aggregation/controller
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";

import { Public, Roles } from "../../common/decorators";
import { PlayerAggregationService } from "./services/player-aggregation.service";
import { TeamAggregationService } from "./services/team-aggregation.service";
import type { AggregationJobData } from "./aggregation.processor";

import type {
  AggregatedPlayerProfile,
  AggregatedTeamProfile,
} from "../analysis/types/aggregation.types";

// =============================================================================
// DTOs
// =============================================================================

interface TimeWindowQuery {
  window?:
    | "all_time"
    | "last_90d"
    | "last_30d"
    | "last_7d"
    | "last_10_matches"
    | "last_20_matches";
}

interface RosterQuery extends TimeWindowQuery {
  steamIds: string; // Comma-separated
}

interface BatchRecomputeBody {
  steamIds?: string[];
  teamIds?: string[];
  window?: TimeWindowQuery["window"];
}

interface PlayerComparisonResult {
  player1: AggregatedPlayerProfile;
  player2: AggregatedPlayerProfile;
  comparison: {
    rating: { player1: number; player2: number; winner: string | null };
    kast: { player1: number; player2: number; winner: string | null };
    adr: { player1: number; player2: number; winner: string | null };
    kd: { player1: number; player2: number; winner: string | null };
    openingSuccessRate: {
      player1: number;
      player2: number;
      winner: string | null;
    };
    clutchSuccessRate: {
      player1: number;
      player2: number;
      winner: string | null;
    };
    overall: string | null;
  };
}

// =============================================================================
// CONTROLLER
// =============================================================================

@ApiTags("aggregation")
@ApiBearerAuth()
@Controller("aggregation")
export class AggregationController {
  private readonly logger = new Logger(AggregationController.name);

  constructor(
    private readonly playerAggregation: PlayerAggregationService,
    private readonly teamAggregation: TeamAggregationService,
    @InjectQueue("demo-aggregation")
    private readonly aggregationQueue: Queue<AggregationJobData>,
  ) {}

  // ===========================================================================
  // PLAYER ENDPOINTS
  // ===========================================================================

  /**
   * Get aggregated player profile
   */
  @Get("players/:steamId")
  @Public()
  @ApiOperation({ summary: "Get aggregated player profile" })
  async getPlayerProfile(
    @Param("steamId") steamId: string,
    @Query() query: TimeWindowQuery,
  ): Promise<AggregatedPlayerProfile> {
    this.logger.log(
      `GET /aggregation/players/${steamId} (window: ${query.window ?? "all_time"})`,
    );

    try {
      return await this.playerAggregation.getPlayerProfile(
        steamId,
        query.window ?? "all_time",
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get player profile: ${error}`);
      throw error;
    }
  }

  /**
   * Compare two players
   */
  @Get("players/:steamId/compare/:otherSteamId")
  @Public()
  @ApiOperation({ summary: "Compare two players" })
  async comparePlayers(
    @Param("steamId") steamId: string,
    @Param("otherSteamId") otherSteamId: string,
    @Query() query: TimeWindowQuery,
  ): Promise<PlayerComparisonResult> {
    this.logger.log(
      `GET /aggregation/players/${steamId}/compare/${otherSteamId}`,
    );

    const window = query.window ?? "all_time";

    const [player1, player2] = await Promise.all([
      this.playerAggregation.getPlayerProfile(steamId, window),
      this.playerAggregation.getPlayerProfile(otherSteamId, window),
    ]);

    return {
      player1,
      player2,
      comparison: this.buildComparison(player1, player2),
    };
  }

  /**
   * Get multiple player profiles (batch)
   */
  @Get("players")
  @Public()
  @ApiOperation({ summary: "Get multiple player profiles (batch)" })
  async getPlayerProfiles(
    @Query("steamIds") steamIdsParam: string,
    @Query() query: TimeWindowQuery,
  ): Promise<{
    profiles: Record<string, AggregatedPlayerProfile>;
    errors: string[];
  }> {
    const steamIds = steamIdsParam.split(",").filter(Boolean);

    if (steamIds.length === 0) {
      return { profiles: {}, errors: [] };
    }

    if (steamIds.length > 20) {
      throw new Error("Maximum 20 players per request");
    }

    const window = query.window ?? "all_time";
    const profiles = await this.playerAggregation.getPlayerProfiles(
      steamIds,
      window,
    );

    const result: Record<string, AggregatedPlayerProfile> = {};
    const errors: string[] = [];

    for (const steamId of steamIds) {
      const profile = profiles.get(steamId);
      if (profile) {
        result[steamId] = profile;
      } else {
        errors.push(`Profile not found for ${steamId}`);
      }
    }

    return { profiles: result, errors };
  }

  /**
   * Force recompute player profile
   */
  @Post("recompute/player/:steamId")
  @Roles("user")
  @ApiOperation({ summary: "Force recompute player profile" })
  @HttpCode(HttpStatus.ACCEPTED)
  async recomputePlayerProfile(
    @Param("steamId") steamId: string,
    @Query() query: TimeWindowQuery,
  ): Promise<{ jobId: string; message: string }> {
    this.logger.log(`POST /aggregation/recompute/player/${steamId}`);

    const job = await this.aggregationQueue.add(
      "update-player",
      {
        type: "update-player",
        steamId,
        window: query.window ?? "all_time",
      },
      {
        jobId: `player-recompute-${steamId}-${Date.now()}`,
      },
    );

    return {
      jobId: job.id ?? "unknown",
      message: `Queued recomputation for player ${steamId}`,
    };
  }

  // ===========================================================================
  // TEAM ENDPOINTS
  // ===========================================================================

  /**
   * Get aggregated team profile
   */
  @Get("teams/:teamId")
  @Public()
  @ApiOperation({ summary: "Get aggregated team profile" })
  async getTeamProfile(
    @Param("teamId") teamId: string,
    @Query() query: TimeWindowQuery,
  ): Promise<AggregatedTeamProfile> {
    this.logger.log(
      `GET /aggregation/teams/${teamId} (window: ${query.window ?? "all_time"})`,
    );

    try {
      return await this.teamAggregation.getTeamProfile(
        teamId,
        query.window ?? "all_time",
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get team profile: ${error}`);
      throw error;
    }
  }

  /**
   * Get team profile by roster (ad-hoc team)
   */
  @Get("teams/roster")
  @Public()
  @ApiOperation({ summary: "Get team profile by roster" })
  async getTeamProfileByRoster(
    @Query() query: RosterQuery,
  ): Promise<AggregatedTeamProfile> {
    const steamIds = query.steamIds.split(",").filter(Boolean);

    if (steamIds.length < 2) {
      throw new Error("At least 2 players required for roster analysis");
    }

    if (steamIds.length > 5) {
      throw new Error("Maximum 5 players for roster analysis");
    }

    this.logger.log(
      `GET /aggregation/teams/roster (${steamIds.length} players)`,
    );

    return await this.teamAggregation.getTeamProfileByRoster(
      steamIds,
      query.window ?? "all_time",
    );
  }

  /**
   * Force recompute team profile
   */
  @Post("recompute/team/:teamId")
  @Roles("user")
  @ApiOperation({ summary: "Force recompute team profile" })
  @HttpCode(HttpStatus.ACCEPTED)
  async recomputeTeamProfile(
    @Param("teamId") teamId: string,
    @Query() query: TimeWindowQuery,
  ): Promise<{ jobId: string; message: string }> {
    this.logger.log(`POST /aggregation/recompute/team/${teamId}`);

    const job = await this.aggregationQueue.add(
      "update-team",
      {
        type: "update-team",
        teamId,
        window: query.window ?? "all_time",
      },
      {
        jobId: `team-recompute-${teamId}-${Date.now()}`,
      },
    );

    return {
      jobId: job.id ?? "unknown",
      message: `Queued recomputation for team ${teamId}`,
    };
  }

  // ===========================================================================
  // BATCH ENDPOINTS
  // ===========================================================================

  /**
   * Batch recompute multiple profiles
   */
  @Post("recompute/batch")
  @Roles("admin")
  @ApiOperation({ summary: "Batch recompute multiple profiles (admin only)" })
  @HttpCode(HttpStatus.ACCEPTED)
  async batchRecompute(@Body() body: BatchRecomputeBody): Promise<{
    jobId: string;
    message: string;
    playersQueued: number;
    teamsQueued: number;
  }> {
    const { steamIds = [], teamIds = [], window = "all_time" } = body;

    this.logger.log(
      `POST /aggregation/recompute/batch (${steamIds.length} players, ${teamIds.length} teams)`,
    );

    if (steamIds.length === 0 && teamIds.length === 0) {
      return {
        jobId: "none",
        message: "No items to recompute",
        playersQueued: 0,
        teamsQueued: 0,
      };
    }

    const job = await this.aggregationQueue.add(
      "full-recompute",
      {
        type: "full-recompute",
        steamIds,
        teamIds,
        window,
      },
      {
        jobId: `batch-recompute-${Date.now()}`,
      },
    );

    return {
      jobId: job.id ?? "unknown",
      message: "Batch recomputation queued",
      playersQueued: steamIds.length,
      teamsQueued: teamIds.length,
    };
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Build comparison between two players
   */
  private buildComparison(
    player1: AggregatedPlayerProfile,
    player2: AggregatedPlayerProfile,
  ): PlayerComparisonResult["comparison"] {
    const compareMetric = (
      v1: number,
      v2: number,
      threshold = 0.02,
    ): { player1: number; player2: number; winner: string | null } => {
      const diff = v1 - v2;
      let winner: string | null = null;

      if (Math.abs(diff) / Math.max(v1, v2, 0.01) > threshold) {
        winner = diff > 0 ? player1.identity.steamId : player2.identity.steamId;
      }

      return { player1: v1, player2: v2, winner };
    };

    const rating = compareMetric(
      player1.performance.avgRating,
      player2.performance.avgRating,
    );
    const kast = compareMetric(
      player1.performance.avgKast,
      player2.performance.avgKast,
    );
    const adr = compareMetric(player1.combat.adr, player2.combat.adr);
    const kd = compareMetric(player1.combat.kdRatio, player2.combat.kdRatio);
    const openingSuccessRate = compareMetric(
      player1.openings.successRate,
      player2.openings.successRate,
    );
    const clutchSuccessRate = compareMetric(
      player1.clutches.successRate,
      player2.clutches.successRate,
    );

    // Count wins
    const metrics = [
      rating,
      kast,
      adr,
      kd,
      openingSuccessRate,
      clutchSuccessRate,
    ];
    const player1Wins = metrics.filter(
      (m) => m.winner === player1.identity.steamId,
    ).length;
    const player2Wins = metrics.filter(
      (m) => m.winner === player2.identity.steamId,
    ).length;

    let overall: string | null = null;
    if (player1Wins > player2Wins + 1) {
      overall = player1.identity.steamId;
    } else if (player2Wins > player1Wins + 1) {
      overall = player2.identity.steamId;
    }

    return {
      rating,
      kast,
      adr,
      kd,
      openingSuccessRate,
      clutchSuccessRate,
      overall,
    };
  }
}
