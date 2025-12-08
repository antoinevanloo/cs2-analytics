/**
 * Steam Import Controller
 *
 * REST API endpoints for Steam match import functionality.
 *
 * @module steam-import
 */

import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { Roles, CurrentUser } from "../../common/decorators";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";
import { SteamImportService } from "./services/steam-import.service";
import {
  SetupImportDto,
  UpdateImportConfigDto,
  ListMatchesQueryDto,
} from "./dto/setup-import.dto";

@ApiTags("Steam Import")
@ApiBearerAuth("JWT-auth")
@Controller({ path: "steam-import", version: "1" })
export class SteamImportController {
  constructor(private readonly steamImportService: SteamImportService) {}

  // ============================================================================
  // Configuration Endpoints
  // ============================================================================

  @Post("setup")
  @Roles("user")
  @ApiOperation({
    summary: "Configure Steam match import",
    description:
      "Set up Steam import with game authentication code and initial share code",
  })
  @ApiResponse({ status: 201, description: "Import configured successfully" })
  @ApiResponse({ status: 400, description: "Invalid credentials or format" })
  async setupImport(
    @Body() dto: SetupImportDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.steamImportService.setupImport(user.id, dto);
  }

  @Post("config")
  @Roles("user")
  @ApiOperation({
    summary: "Update import configuration",
    description: "Update settings like auto-download, import filters, etc.",
  })
  @ApiResponse({ status: 200, description: "Configuration updated" })
  async updateConfig(
    @Body() dto: UpdateImportConfigDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.steamImportService.updateConfig(user.id, dto);
  }

  @Get("status")
  @Roles("user")
  @ApiOperation({
    summary: "Get sync status",
    description:
      "Get current sync configuration, status, and recent matches",
  })
  @ApiResponse({ status: 200, description: "Sync status retrieved" })
  async getSyncStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.steamImportService.getSyncStatus(user.id);
  }

  @Delete("config")
  @Roles("user")
  @ApiOperation({
    summary: "Disconnect Steam import",
    description:
      "Remove Steam import configuration and all imported match records",
  })
  @ApiResponse({ status: 200, description: "Import disconnected" })
  async disconnectImport(@CurrentUser() user: AuthenticatedUser) {
    await this.steamImportService.disconnect(user.id);
    return { success: true };
  }

  // ============================================================================
  // Sync Endpoints
  // ============================================================================

  @Post("sync")
  @Roles("user")
  @ApiOperation({
    summary: "Trigger manual sync",
    description:
      "Start a manual sync to fetch new matches from Steam match history",
  })
  @ApiResponse({ status: 202, description: "Sync job queued" })
  @ApiResponse({ status: 400, description: "Sync already in progress" })
  @ApiResponse({ status: 404, description: "Import not configured" })
  async triggerSync(@CurrentUser() user: AuthenticatedUser) {
    return this.steamImportService.triggerSync(user.id);
  }

  // ============================================================================
  // Match Endpoints
  // ============================================================================

  @Get("matches")
  @Roles("user")
  @ApiOperation({
    summary: "List imported matches",
    description: "Get paginated list of imported Steam matches with filtering",
  })
  @ApiResponse({ status: 200, description: "Matches retrieved" })
  async listMatches(
    @Query() query: ListMatchesQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.steamImportService.listMatches(user.id, query);
  }

  @Post("matches/:id/download")
  @Roles("user")
  @ApiOperation({
    summary: "Trigger download for a match",
    description: "Queue a download job for a specific match demo",
  })
  @ApiParam({ name: "id", description: "Steam match ID" })
  @ApiResponse({ status: 202, description: "Download job queued" })
  @ApiResponse({ status: 400, description: "Match already downloaded" })
  @ApiResponse({ status: 404, description: "Match not found" })
  async triggerDownload(
    @Param("id") matchId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.steamImportService.queueDownload(matchId, user.id);
  }

  @Post("matches/:id/refresh-info")
  @Roles("user")
  @ApiOperation({
    summary: "Refresh match info from GC",
    description:
      "Fetch match details (map, score, duration) from Steam GC for a single match",
  })
  @ApiParam({ name: "id", description: "Steam match ID" })
  @ApiResponse({ status: 200, description: "Match info refreshed" })
  @ApiResponse({ status: 404, description: "Match not found" })
  async refreshMatchInfo(
    @Param("id") matchId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.steamImportService.refreshMatchInfo(matchId, user.id);
  }

  @Post("refresh-all-info")
  @Roles("user")
  @ApiOperation({
    summary: "Refresh info for all PENDING matches",
    description:
      "Fetch match details from Steam GC for all matches that don't have info yet. Rate limited.",
  })
  @ApiResponse({ status: 200, description: "Info refresh completed" })
  async refreshAllPendingInfo(@CurrentUser() user: AuthenticatedUser) {
    return this.steamImportService.refreshAllPendingMatchesInfo(user.id);
  }

  @Delete("matches/:id")
  @Roles("user")
  @ApiOperation({
    summary: "Remove imported match",
    description: "Remove a match from the import list (does not delete demo)",
  })
  @ApiParam({ name: "id", description: "Steam match ID" })
  @ApiResponse({ status: 200, description: "Match removed" })
  @ApiResponse({ status: 404, description: "Match not found" })
  async removeMatch(
    @Param("id") matchId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.steamImportService.removeMatch(matchId, user.id);
    return { success: true };
  }
}
