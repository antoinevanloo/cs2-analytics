/**
 * FACEIT Integration Controller
 *
 * Provides endpoints for FACEIT integration features:
 * - Get player stats from FACEIT
 * - Get match history
 * - Import demos from FACEIT matches
 * - Get circuit breaker status
 *
 * @module integrations/faceit
 */

import {
  Controller,
  Get,
  Query,
  Param,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from "@nestjs/swagger";

import { FaceitService } from "./faceit.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { PrismaService } from "../../common/prisma";

@ApiTags("FACEIT Integration")
@Controller("v1/integrations/faceit")
export class FaceitController {
  constructor(
    private readonly faceitService: FaceitService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get FACEIT player information
   */
  @Get("player/:playerId")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get FACEIT player information" })
  @ApiParam({ name: "playerId", description: "FACEIT player ID" })
  @ApiResponse({ status: 200, description: "Player information" })
  @ApiResponse({ status: 404, description: "Player not found" })
  async getPlayer(@Param("playerId") playerId: string) {
    const player = await this.faceitService.getPlayer(playerId);

    if (!player) {
      throw new NotFoundException(`Player ${playerId} not found on FACEIT`);
    }

    return player;
  }

  /**
   * Get FACEIT player statistics
   */
  @Get("player/:playerId/stats")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get FACEIT player statistics" })
  @ApiParam({ name: "playerId", description: "FACEIT player ID" })
  @ApiQuery({ name: "game", required: false, description: "Game ID (default: cs2)" })
  @ApiResponse({ status: 200, description: "Player statistics" })
  @ApiResponse({ status: 404, description: "Player not found" })
  async getPlayerStats(
    @Param("playerId") playerId: string,
    @Query("game") game?: string,
  ) {
    const stats = await this.faceitService.getPlayerStats(playerId, game);

    if (!stats) {
      throw new NotFoundException(`Stats for player ${playerId} not found`);
    }

    return stats;
  }

  /**
   * Get FACEIT match history for a player
   */
  @Get("player/:playerId/history")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get FACEIT match history" })
  @ApiParam({ name: "playerId", description: "FACEIT player ID" })
  @ApiQuery({ name: "game", required: false, description: "Game ID (default: cs2)" })
  @ApiQuery({ name: "offset", required: false, description: "Offset for pagination" })
  @ApiQuery({ name: "limit", required: false, description: "Limit for pagination (max 100)" })
  @ApiResponse({ status: 200, description: "Match history" })
  async getMatchHistory(
    @Param("playerId") playerId: string,
    @Query("game") game?: string,
    @Query("offset") offset?: string,
    @Query("limit") limit?: string,
  ) {
    const parsedLimit = Math.min(parseInt(limit || "20", 10), 100);
    const parsedOffset = parseInt(offset || "0", 10);

    // Build options, only including game if provided
    const options: { game?: string; offset?: number; limit?: number } = {
      offset: parsedOffset,
      limit: parsedLimit,
    };
    if (game) options.game = game;

    return this.faceitService.getMatchHistory(playerId, options);
  }

  /**
   * Get FACEIT match details
   */
  @Get("match/:matchId")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get FACEIT match details" })
  @ApiParam({ name: "matchId", description: "FACEIT match ID" })
  @ApiResponse({ status: 200, description: "Match details" })
  @ApiResponse({ status: 404, description: "Match not found" })
  async getMatchDetails(@Param("matchId") matchId: string) {
    const match = await this.faceitService.getMatchDetails(matchId);

    if (!match) {
      throw new NotFoundException(`Match ${matchId} not found on FACEIT`);
    }

    return match;
  }

  /**
   * Search for FACEIT players by nickname
   */
  @Get("search")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Search FACEIT players" })
  @ApiQuery({ name: "nickname", required: true, description: "Player nickname to search" })
  @ApiResponse({ status: 200, description: "Search results" })
  async searchPlayer(@Query("nickname") nickname: string) {
    if (!nickname || nickname.length < 2) {
      throw new BadRequestException("Nickname must be at least 2 characters");
    }

    return this.faceitService.searchPlayer(nickname);
  }

  /**
   * Get recent matches with demo URLs for auto-import
   */
  @Get("player/:playerId/demos")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get recent matches with demo URLs" })
  @ApiParam({ name: "playerId", description: "FACEIT player ID" })
  @ApiQuery({ name: "limit", required: false, description: "Number of matches (max 20)" })
  @ApiResponse({ status: 200, description: "Matches with demo URLs" })
  async getRecentDemos(
    @Param("playerId") playerId: string,
    @Query("limit") limit?: string,
  ) {
    const parsedLimit = Math.min(parseInt(limit || "10", 10), 20);

    return this.faceitService.getRecentMatchesWithDemos(playerId, parsedLimit);
  }

  /**
   * Get current user's FACEIT integration status
   */
  @Get("me/status")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get FACEIT integration status for current user" })
  @ApiResponse({ status: 200, description: "Integration status" })
  async getMyFaceitStatus(@CurrentUser() user: AuthenticatedUser) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        faceitId: true,
      },
    });

    if (!dbUser?.faceitId) {
      return {
        linked: false,
        faceitId: null,
        player: null,
        stats: null,
      };
    }

    // Fetch FACEIT data in parallel
    const [player, stats] = await Promise.all([
      this.faceitService.getPlayer(dbUser.faceitId),
      this.faceitService.getPlayerStats(dbUser.faceitId),
    ]);

    return {
      linked: true,
      faceitId: dbUser.faceitId,
      player,
      stats,
    };
  }

  /**
   * Get my recent FACEIT matches with demos
   */
  @Get("me/demos")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user's recent FACEIT matches with demos" })
  @ApiQuery({ name: "limit", required: false, description: "Number of matches (max 20)" })
  @ApiResponse({ status: 200, description: "Matches with demo URLs" })
  @ApiResponse({ status: 400, description: "FACEIT account not linked" })
  async getMyRecentDemos(
    @CurrentUser() user: AuthenticatedUser,
    @Query("limit") limit?: string,
  ) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { faceitId: true },
    });

    if (!dbUser?.faceitId) {
      throw new BadRequestException("FACEIT account not linked. Please connect your FACEIT account first.");
    }

    const parsedLimit = Math.min(parseInt(limit || "10", 10), 20);
    return this.faceitService.getRecentMatchesWithDemos(dbUser.faceitId, parsedLimit);
  }

  /**
   * Get circuit breaker status (for monitoring)
   */
  @Get("health")
  @Public()
  @ApiOperation({ summary: "Get FACEIT API circuit breaker status" })
  @ApiResponse({ status: 200, description: "Circuit breaker status" })
  getCircuitStatus() {
    return {
      service: "faceit",
      circuit: this.faceitService.getCircuitStatus(),
    };
  }
}
