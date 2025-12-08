/**
 * Steam Import Service
 *
 * Main orchestration service for Steam match import functionality.
 * Handles configuration, sync triggering, and match management.
 *
 * @module steam-import/services
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PrismaService } from "../../../common/prisma";
import {
  SteamSyncStatus,
  MatchDownloadStatus,
  GameMode,
  Prisma,
} from "@prisma/client";
import { ShareCodeService } from "./share-code.service";
import { SteamMatchHistoryService } from "./steam-match-history.service";
import { SteamGcService } from "./steam-gc.service";
import type {
  SetupImportDto,
  UpdateImportConfigDto,
  ListMatchesQueryDto,
} from "../dto/setup-import.dto";
import type {
  SteamSyncConfigResponse,
  SteamMatchResponse,
  SteamMatchListResponse,
  SyncStatusResponse,
  SyncMatchesJobData,
  DownloadDemoJobData,
} from "../types/steam-import.types";

@Injectable()
export class SteamImportService {
  private readonly logger = new Logger(SteamImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly shareCodeService: ShareCodeService,
    private readonly matchHistoryService: SteamMatchHistoryService,
    private readonly steamGcService: SteamGcService,
    @InjectQueue("steam-import") private readonly importQueue: Queue,
  ) {}

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Setup Steam import for a user
   */
  async setupImport(
    userId: string,
    dto: SetupImportDto,
  ): Promise<SteamSyncConfigResponse> {
    // Get user with Steam ID
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, steamId: true },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (!user.steamId) {
      throw new BadRequestException(
        "Steam account not linked. Please connect your Steam account first.",
      );
    }

    // Validate share code format
    if (!this.shareCodeService.isValid(dto.initialShareCode)) {
      throw new BadRequestException(
        "Invalid share code format. Expected: CSGO-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx",
      );
    }

    // Validate auth code by making a test request
    const validation = await this.matchHistoryService.validateAuthCode(
      user.steamId,
      dto.authCode,
      dto.initialShareCode,
    );

    if (!validation.valid) {
      throw new BadRequestException(
        `Invalid credentials: ${validation.error}`,
      );
    }

    // Create or update sync configuration
    const syncConfig = await this.prisma.steamMatchSync.upsert({
      where: { userId },
      create: {
        userId,
        steamId: user.steamId,
        authCode: dto.authCode, // TODO: Encrypt in production
        lastShareCode: dto.initialShareCode,
        status: SteamSyncStatus.ACTIVE,
        importPremier: dto.importPremier ?? true,
        importCompetitive: dto.importCompetitive ?? true,
        autoDownloadDemos: dto.autoDownloadDemos ?? true,
      },
      update: {
        authCode: dto.authCode,
        lastShareCode: dto.initialShareCode,
        status: SteamSyncStatus.ACTIVE,
        lastSyncError: null,
        importPremier: dto.importPremier ?? true,
        importCompetitive: dto.importCompetitive ?? true,
        autoDownloadDemos: dto.autoDownloadDemos ?? true,
      },
    });

    this.logger.log(`Steam import configured for user ${userId}`);

    return this.mapSyncConfigToResponse(syncConfig);
  }

  /**
   * Update import configuration
   */
  async updateConfig(
    userId: string,
    dto: UpdateImportConfigDto,
  ): Promise<SteamSyncConfigResponse> {
    const syncConfig = await this.prisma.steamMatchSync.findUnique({
      where: { userId },
    });

    if (!syncConfig) {
      throw new NotFoundException("Steam import not configured");
    }

    const updateData: Prisma.SteamMatchSyncUpdateInput = {};

    if (dto.authCode !== undefined) {
      updateData.authCode = dto.authCode;
    }
    if (dto.importPremier !== undefined) {
      updateData.importPremier = dto.importPremier;
    }
    if (dto.importCompetitive !== undefined) {
      updateData.importCompetitive = dto.importCompetitive;
    }
    if (dto.autoDownloadDemos !== undefined) {
      updateData.autoDownloadDemos = dto.autoDownloadDemos;
    }

    const updated = await this.prisma.steamMatchSync.update({
      where: { userId },
      data: updateData,
    });

    return this.mapSyncConfigToResponse(updated);
  }

  /**
   * Get sync status for a user
   */
  async getSyncStatus(userId: string): Promise<SyncStatusResponse> {
    const syncConfig = await this.prisma.steamMatchSync.findUnique({
      where: { userId },
      include: {
        matches: {
          orderBy: { matchTime: "desc" },
          take: 5,
          include: { demo: { select: { mapName: true } } },
        },
      },
    });

    if (!syncConfig) {
      return {
        config: null,
        isConfigured: false,
        canSync: false,
        recentMatches: [],
      };
    }

    const canSync =
      syncConfig.status === SteamSyncStatus.ACTIVE ||
      syncConfig.status === SteamSyncStatus.ERROR;

    return {
      config: this.mapSyncConfigToResponse(syncConfig),
      isConfigured: true,
      canSync,
      recentMatches: syncConfig.matches.map((m) => this.mapMatchToResponse(m, m.demo?.mapName)),
    };
  }

  /**
   * Disconnect Steam import
   */
  async disconnect(userId: string): Promise<void> {
    const syncConfig = await this.prisma.steamMatchSync.findUnique({
      where: { userId },
    });

    if (!syncConfig) {
      throw new NotFoundException("Steam import not configured");
    }

    // Delete all imported matches and the sync config
    await this.prisma.$transaction([
      this.prisma.steamMatch.deleteMany({
        where: { syncId: syncConfig.id },
      }),
      this.prisma.steamMatchSync.delete({
        where: { userId },
      }),
    ]);

    this.logger.log(`Steam import disconnected for user ${userId}`);
  }

  // ============================================================================
  // Sync Operations
  // ============================================================================

  /**
   * Trigger a manual sync
   */
  async triggerSync(
    userId: string,
    force: boolean = false,
  ): Promise<{ jobId: string; status: string }> {
    const syncConfig = await this.prisma.steamMatchSync.findUnique({
      where: { userId },
    });

    if (!syncConfig) {
      throw new NotFoundException("Steam import not configured");
    }

    if (
      syncConfig.status === SteamSyncStatus.SYNCING &&
      !force
    ) {
      throw new BadRequestException("Sync already in progress");
    }

    // Update status to syncing
    await this.prisma.steamMatchSync.update({
      where: { userId },
      data: { status: SteamSyncStatus.SYNCING },
    });

    // Queue sync job
    const jobData: SyncMatchesJobData = {
      userId,
      syncId: syncConfig.id,
      force,
    };

    const job = await this.importQueue.add("sync-matches", jobData, {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86400 },
    });

    this.logger.log(`Sync job queued for user ${userId}: ${job.id}`);

    return {
      jobId: job.id!,
      status: "queued",
    };
  }

  /**
   * Process sync job (called by processor)
   */
  async processSync(syncId: string): Promise<number> {
    const syncConfig = await this.prisma.steamMatchSync.findUnique({
      where: { id: syncId },
    });

    if (!syncConfig) {
      throw new NotFoundException("Sync config not found");
    }

    try {
      // Fetch new share codes from Steam API
      const newShareCodes = await this.matchHistoryService.getAllNewShareCodes(
        syncConfig.steamId,
        syncConfig.authCode,
        syncConfig.lastShareCode,
        100,
      );

      if (newShareCodes.length === 0) {
        await this.prisma.steamMatchSync.update({
          where: { id: syncId },
          data: {
            status: SteamSyncStatus.ACTIVE,
            lastSyncAt: new Date(),
            lastSyncError: null,
          },
        });
        return 0;
      }

      // Create SteamMatch records for each new share code
      const createdMatches = await this.createMatchesFromShareCodes(
        syncConfig.id,
        newShareCodes,
        syncConfig.importPremier,
        syncConfig.importCompetitive,
      );

      // ================================================================
      // Fetch match info from GC for all new matches (gamification: UX)
      // This allows users to see map/score before deciding to download
      // ================================================================
      if (createdMatches.length > 0 && this.steamGcService.isConfigured()) {
        this.logger.log(
          `Fetching match info for ${createdMatches.length} new matches...`,
        );

        const matchesToFetch = createdMatches.map((m) => ({
          id: m.id,
          matchId: m.matchId.toString(),
          outcomeId: m.outcomeId.toString(),
          token: m.token,
        }));

        const infoResults = await this.steamGcService.fetchMatchInfoBatch(
          matchesToFetch,
          (completed, total) => {
            this.logger.debug(`Fetched info: ${completed}/${total} matches`);
          },
        );

        // Update matches with fetched info
        let infoUpdated = 0;
        for (const result of infoResults) {
          if (result.success && result.matchInfo) {
            await this.prisma.steamMatch.update({
              where: { id: result.id },
              data: {
                mapName: result.matchInfo.mapName,
                matchTime: result.matchInfo.matchTime,
                matchDuration: result.matchInfo.matchDuration,
                team1Score: result.matchInfo.team1Score,
                team2Score: result.matchInfo.team2Score,
              },
            });
            infoUpdated++;
          }
        }

        this.logger.log(
          `Updated info for ${infoUpdated}/${createdMatches.length} matches`,
        );
      }

      // Update sync config
      const lastShareCode = newShareCodes[newShareCodes.length - 1];
      await this.prisma.steamMatchSync.update({
        where: { id: syncId },
        data: {
          status: SteamSyncStatus.ACTIVE,
          lastSyncAt: new Date(),
          lastShareCode: lastShareCode ?? null,
          lastSyncError: null,
          totalMatchesSynced: {
            increment: createdMatches.length,
          },
        },
      });

      // Queue downloads if auto-download enabled
      if (syncConfig.autoDownloadDemos) {
        for (const match of createdMatches) {
          await this.queueDownload(match.id, syncConfig.userId);
        }
      }

      this.logger.log(
        `Sync completed for ${syncConfig.userId}: ${createdMatches.length} new matches`,
      );

      return createdMatches.length;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await this.prisma.steamMatchSync.update({
        where: { id: syncId },
        data: {
          status: SteamSyncStatus.ERROR,
          lastSyncAt: new Date(),
          lastSyncError: errorMessage,
        },
      });

      throw error;
    }
  }

  /**
   * Create match records from share codes
   */
  private async createMatchesFromShareCodes(
    syncId: string,
    shareCodes: string[],
    _importPremier: boolean,
    _importCompetitive: boolean,
  ) {
    const matches = [];

    for (const shareCode of shareCodes) {
      // Decode share code
      const decoded = this.shareCodeService.decode(shareCode);

      // Check if match already exists
      const existing = await this.prisma.steamMatch.findUnique({
        where: { matchId: decoded.matchId },
      });

      if (existing) {
        this.logger.debug(`Match ${shareCode} already exists, skipping`);
        continue;
      }

      // Create match record
      const match = await this.prisma.steamMatch.create({
        data: {
          syncId,
          matchId: decoded.matchId,
          outcomeId: decoded.outcomeId,
          token: decoded.token,
          shareCode,
          downloadStatus: MatchDownloadStatus.PENDING,
          // Game mode will be determined from GC response
          gameMode: GameMode.COMPETITIVE,
        },
      });

      matches.push(match);
    }

    return matches;
  }

  // ============================================================================
  // Match Operations
  // ============================================================================

  /**
   * List imported matches for a user
   */
  async listMatches(
    userId: string,
    query: ListMatchesQueryDto,
  ): Promise<SteamMatchListResponse> {
    const syncConfig = await this.prisma.steamMatchSync.findUnique({
      where: { userId },
    });

    if (!syncConfig) {
      return {
        matches: [],
        pagination: {
          page: 1,
          limit: query.limit || 20,
          total: 0,
          totalPages: 0,
        },
      };
    }

    const where: Prisma.SteamMatchWhereInput = {
      syncId: syncConfig.id,
    };

    if (query.status) {
      where.downloadStatus = query.status as MatchDownloadStatus;
    }

    if (query.gameMode) {
      where.gameMode = query.gameMode as GameMode;
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [matches, total] = await Promise.all([
      this.prisma.steamMatch.findMany({
        where,
        orderBy: { matchTime: "desc" },
        skip,
        take: limit,
        include: { demo: { select: { mapName: true } } },
      }),
      this.prisma.steamMatch.count({ where }),
    ]);

    return {
      matches: matches.map((m) => this.mapMatchToResponse(m, m.demo?.mapName)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Queue download for a specific match
   */
  async queueDownload(
    steamMatchId: string,
    userId: string,
  ): Promise<{ jobId: string }> {
    const match = await this.prisma.steamMatch.findUnique({
      where: { id: steamMatchId },
      include: { sync: true },
    });

    if (!match) {
      throw new NotFoundException("Match not found");
    }

    if (match.sync.userId !== userId) {
      throw new ForbiddenException("Not authorized to download this match");
    }

    if (match.downloadStatus === MatchDownloadStatus.COMPLETED) {
      throw new BadRequestException("Match already downloaded");
    }

    const jobData: DownloadDemoJobData = {
      steamMatchId,
      userId,
      priority: "normal",
    };

    const job = await this.importQueue.add("download-demo", jobData, {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
    });

    await this.prisma.steamMatch.update({
      where: { id: steamMatchId },
      data: {
        downloadStatus: MatchDownloadStatus.PENDING,
        downloadAttempts: { increment: 1 },
      },
    });

    return { jobId: job.id! };
  }

  /**
   * Remove an imported match
   */
  async removeMatch(steamMatchId: string, userId: string): Promise<void> {
    const match = await this.prisma.steamMatch.findUnique({
      where: { id: steamMatchId },
      include: { sync: true },
    });

    if (!match) {
      throw new NotFoundException("Match not found");
    }

    if (match.sync.userId !== userId) {
      throw new ForbiddenException("Not authorized to remove this match");
    }

    await this.prisma.steamMatch.delete({
      where: { id: steamMatchId },
    });

    this.logger.log(`Match ${steamMatchId} removed by user ${userId}`);
  }

  // ============================================================================
  // Match Info Refresh (Gamification: Get info for PENDING matches)
  // ============================================================================

  /**
   * Refresh info for a single match from GC
   */
  async refreshMatchInfo(
    steamMatchId: string,
    userId: string,
  ): Promise<{ success: boolean; updated: boolean; error?: string }> {
    const match = await this.prisma.steamMatch.findUnique({
      where: { id: steamMatchId },
      include: { sync: true },
    });

    if (!match) {
      throw new NotFoundException("Match not found");
    }

    if (match.sync.userId !== userId) {
      throw new ForbiddenException("Not authorized to refresh this match");
    }

    if (!this.steamGcService.isConfigured()) {
      return { success: false, updated: false, error: "Steam bot not configured" };
    }

    const result = await this.steamGcService.fetchMatchInfoOnly(
      match.matchId.toString(),
      match.outcomeId.toString(),
      match.token,
    );

    if (result.success && result.matchInfo) {
      await this.prisma.steamMatch.update({
        where: { id: steamMatchId },
        data: {
          mapName: result.matchInfo.mapName,
          matchTime: result.matchInfo.matchTime,
          matchDuration: result.matchInfo.matchDuration,
          team1Score: result.matchInfo.team1Score,
          team2Score: result.matchInfo.team2Score,
        },
      });
      this.logger.log(`Refreshed info for match ${steamMatchId}`);
      return { success: true, updated: true };
    }

    const response: { success: boolean; updated: boolean; error?: string } = {
      success: false,
      updated: false,
    };
    if (result.error) {
      response.error = result.error;
    }
    return response;
  }

  /**
   * Refresh info for all PENDING matches (batch operation with rate limiting)
   */
  async refreshAllPendingMatchesInfo(userId: string): Promise<{
    total: number;
    updated: number;
    failed: number;
  }> {
    const syncConfig = await this.prisma.steamMatchSync.findUnique({
      where: { userId },
    });

    if (!syncConfig) {
      throw new NotFoundException("Steam import not configured");
    }

    if (!this.steamGcService.isConfigured()) {
      throw new BadRequestException("Steam bot not configured");
    }

    // Find all matches without complete info (scores, duration)
    // Note: Map name is only available after downloading/parsing the demo, not from GC
    const pendingMatches = await this.prisma.steamMatch.findMany({
      where: {
        syncId: syncConfig.id,
        OR: [
          { team1Score: null },
          { matchDuration: null },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50, // Limit to avoid overwhelming GC
    });

    if (pendingMatches.length === 0) {
      return { total: 0, updated: 0, failed: 0 };
    }

    this.logger.log(
      `Refreshing info for ${pendingMatches.length} pending matches...`,
    );

    const matchesToFetch = pendingMatches.map((m) => ({
      id: m.id,
      matchId: m.matchId.toString(),
      outcomeId: m.outcomeId.toString(),
      token: m.token,
    }));

    const results = await this.steamGcService.fetchMatchInfoBatch(matchesToFetch);

    let updated = 0;
    let failed = 0;

    for (const result of results) {
      if (result.success && result.matchInfo) {
        await this.prisma.steamMatch.update({
          where: { id: result.id },
          data: {
            mapName: result.matchInfo.mapName,
            matchTime: result.matchInfo.matchTime,
            matchDuration: result.matchInfo.matchDuration,
            team1Score: result.matchInfo.team1Score,
            team2Score: result.matchInfo.team2Score,
          },
        });
        updated++;
      } else {
        failed++;
      }
    }

    this.logger.log(
      `Refresh complete: ${updated}/${pendingMatches.length} updated, ${failed} failed`,
    );

    return {
      total: pendingMatches.length,
      updated,
      failed,
    };
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private mapSyncConfigToResponse(
    config: Prisma.SteamMatchSyncGetPayload<object>,
  ): SteamSyncConfigResponse {
    return {
      id: config.id,
      steamId: config.steamId,
      status: config.status,
      lastSyncAt: config.lastSyncAt,
      lastSyncError: config.lastSyncError,
      totalMatchesSynced: config.totalMatchesSynced,
      importPremier: config.importPremier,
      importCompetitive: config.importCompetitive,
      autoDownloadDemos: config.autoDownloadDemos,
      createdAt: config.createdAt,
    };
  }

  private mapMatchToResponse(
    match: Prisma.SteamMatchGetPayload<object>,
    demoMapName?: string | null,
  ): SteamMatchResponse {
    // Use demo's map name if available (after parsing), otherwise use match's map name
    const effectiveMapName = demoMapName || match.mapName;

    return {
      id: match.id,
      shareCode: match.shareCode,
      mapName: effectiveMapName,
      matchTime: match.matchTime,
      matchDuration: match.matchDuration,
      gameMode: match.gameMode,
      team1Score: match.team1Score,
      team2Score: match.team2Score,
      matchResult: match.matchResult,
      downloadStatus: match.downloadStatus,
      demoId: match.demoId,
      createdAt: match.createdAt,
      // Progress tracking for gamification UX
      downloadProgress: match.downloadProgress,
      downloadedBytes: match.downloadedBytes?.toString() ?? null,
      totalBytes: match.totalBytes?.toString() ?? null,
      currentStep: match.currentStep,
    };
  }
}
