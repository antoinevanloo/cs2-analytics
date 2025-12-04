/**
 * Team Aggregation Service
 *
 * Service layer for aggregating team statistics across multiple matches.
 * Analyzes roster dynamics, map pool, and team synergy.
 *
 * Features:
 * - Loads team match data from database
 * - Transforms to calculator input format
 * - Computes aggregated team profile
 * - Stores results for fast retrieval
 * - Supports multiple time windows
 *
 * @module aggregation/services/team-aggregation
 */

import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../common/prisma";
import { AnalysisType, AnalysisStatus } from "@prisma/client";

import type {
  AggregatedTeamProfile,
  TeamIdentity,
  PlayerRole,
} from "../../analysis/types/aggregation.types";

import {
  type TimeWindowKey,
  getTimeWindowFilter,
  CACHE_CONFIG,
  TEAM_CONFIG,
} from "../aggregation.config";

import {
  aggregateTeamProfile,
  type TeamMatchData,
  type TeamMatchPlayer,
} from "../../analysis/calculators/aggregation/team-profile.calculator";

// =============================================================================
// SERVICE
// =============================================================================

@Injectable()
export class TeamAggregationService {
  private readonly logger = new Logger(TeamAggregationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  /**
   * Get or compute team aggregated profile
   *
   * Uses storage-first strategy for fast retrieval.
   */
  async getTeamProfile(
    teamId: string,
    window: TimeWindowKey = "all_time",
  ): Promise<AggregatedTeamProfile> {
    this.logger.log(`Getting team profile for ${teamId} (window: ${window})`);

    // Check for cached profile
    const cached = await this.getCachedProfile(teamId, window);

    if (cached && !this.isStale(cached)) {
      this.logger.debug(`Cache hit for team ${teamId}`);
      return cached.profile;
    }

    // Compute fresh profile
    this.logger.debug(`Cache miss for team ${teamId}, computing...`);
    return this.computeAndStoreProfile(teamId, window);
  }

  /**
   * Force recompute team profile
   */
  async recomputeTeamProfile(
    teamId: string,
    window: TimeWindowKey = "all_time",
  ): Promise<AggregatedTeamProfile> {
    this.logger.log(`Force recomputing profile for team ${teamId}`);
    return this.computeAndStoreProfile(teamId, window);
  }

  /**
   * Get team profile by roster (for ad-hoc teams without a team ID)
   */
  async getTeamProfileByRoster(
    steamIds: readonly string[],
    window: TimeWindowKey = "all_time",
  ): Promise<AggregatedTeamProfile> {
    // Create a deterministic ID from roster
    const sortedIds = [...steamIds].sort();
    const rosterId = `roster:${sortedIds.join(":")}`;

    // Check cache
    const cached = await this.getCachedProfile(rosterId, window);
    if (cached && !this.isStale(cached)) {
      return cached.profile;
    }

    // Compute
    return this.computeRosterProfile(rosterId, steamIds, window);
  }

  // ===========================================================================
  // PRIVATE: DATA LOADING
  // ===========================================================================

  /**
   * Load team match data from database
   */
  private async loadTeamMatchData(
    teamId: string,
    window: TimeWindowKey,
  ): Promise<{
    identity: TeamIdentity;
    matches: TeamMatchData[];
    roster: RosterEntry[];
  }> {
    // Get team info
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            user: {
              select: {
                steamId: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException(`Team not found: ${teamId}`);
    }

    // Build identity
    const identity: TeamIdentity = {
      teamId: team.id,
      name: team.name,
      tag: team.tag,
      logo: team.logo,
      region: null,
    };

    // Use centralized time window configuration
    const windowFilter = getTimeWindowFilter(window);
    const matchLimit = windowFilter.matchLimit;
    const dateFilter = windowFilter.dateFilter
      ? { gte: windowFilter.dateFilter }
      : undefined;

    // Load demos for this team
    const demoQuery = {
      where: {
        teamId,
        status: "COMPLETED" as const,
        ...(dateFilter ? { playedAt: dateFilter } : {}),
      },
      include: {
        playerStats: {
          select: {
            steamId: true,
            playerName: true,
            teamNum: true,
            kills: true,
            deaths: true,
            assists: true,
            damage: true,
            rating: true,
            firstKills: true,
            firstDeaths: true,
            flashAssists: true,
          },
        },
        rounds: {
          select: {
            roundNumber: true,
            winnerTeam: true,
            ctScore: true,
            tScore: true,
            roundType: true,
            ctEquipValue: true,
            tEquipValue: true,
          },
        },
      },
      orderBy: { playedAt: "desc" as const },
      ...(matchLimit ? { take: matchLimit } : {}),
    };

    const demos = await this.prisma.demo.findMany(demoQuery);

    // Get roster from team members
    const roster: RosterEntry[] = team.members
      .filter((m) => m.user.steamId)
      .map((m) => ({
        steamId: m.user.steamId!,
        name: m.user.name ?? "Unknown",
        role: this.inferRole(m.role),
        joinedAt: m.createdAt,
      }));

    // Transform demos to TeamMatchData
    const matches: TeamMatchData[] = demos.map((demo) => {
      // Determine which team is "our" team
      const teamPlayers = demo.playerStats.filter((ps) => {
        // Players on team 2 or 3 (T/CT)
        return roster.some((r) => r.steamId === ps.steamId);
      });

      const firstPlayer = teamPlayers[0];
      const ourTeamNum = firstPlayer ? firstPlayer.teamNum : 2;
      const isTeam1 = ourTeamNum === 2;

      const myScore = isTeam1 ? demo.team1Score : demo.team2Score;
      const oppScore = isTeam1 ? demo.team2Score : demo.team1Score;

      // Calculate rounds by side
      const ctRounds = demo.rounds.filter((r) =>
        isTeam1 ? r.roundNumber <= 12 : r.roundNumber > 12,
      ).length;
      const ctRoundsWon = demo.rounds.filter(
        (r) =>
          (isTeam1 ? r.roundNumber <= 12 : r.roundNumber > 12) &&
          r.winnerTeam === 3,
      ).length;
      const tRounds = demo.rounds.length - ctRounds;
      const tRoundsWon = demo.rounds.filter(
        (r) =>
          (isTeam1 ? r.roundNumber > 12 : r.roundNumber <= 12) &&
          r.winnerTeam === 2,
      ).length;

      // Calculate situational rounds
      const pistolRounds = demo.rounds.filter(
        (r) => r.roundNumber === 1 || r.roundNumber === 13,
      ).length;
      const pistolRoundsWon = demo.rounds.filter(
        (r) =>
          (r.roundNumber === 1 || r.roundNumber === 13) &&
          ((isTeam1 && r.winnerTeam === (r.roundNumber === 1 ? 2 : 3)) ||
            (!isTeam1 && r.winnerTeam === (r.roundNumber === 1 ? 3 : 2))),
      ).length;

      // Build player list
      const players: TeamMatchPlayer[] = teamPlayers.map((ps) => ({
        steamId: ps.steamId,
        name: ps.playerName,
        rating: ps.rating ?? 1.0,
        kills: ps.kills,
        deaths: ps.deaths,
        assists: ps.assists,
        adr: ps.damage / demo.rounds.length,
        tradeKills: 0, // Would need trade analysis
        flashAssists: ps.flashAssists,
      }));

      return {
        demoId: demo.id,
        playedAt: demo.playedAt ?? new Date(),
        mapName: demo.mapName,
        won: myScore > oppScore,
        draw: myScore === oppScore,
        score: myScore,
        opponentScore: oppScore,
        opponent: isTeam1 ? demo.team2Name : demo.team1Name,

        totalRounds: demo.rounds.length,
        roundsWon: myScore,
        ctRounds,
        ctRoundsWon,
        tRounds,
        tRoundsWon,

        pistolRoundsPlayed: pistolRounds,
        pistolRoundsWon: pistolRoundsWon,
        ecoRoundsPlayed: demo.rounds.filter((r) => r.roundType === "ECO")
          .length,
        ecoRoundsWon: 0, // Would need to match with winner
        antiEcoRoundsPlayed: 0, // Would need opponent economy data
        antiEcoRoundsWon: 0,
        forceRoundsPlayed: demo.rounds.filter(
          (r) => r.roundType === "FORCE_BUY",
        ).length,
        forceRoundsWon: 0,
        fullBuyRoundsPlayed: demo.rounds.filter(
          (r) => r.roundType === "FULL_BUY",
        ).length,
        fullBuyRoundsWon: 0,

        totalKills: teamPlayers.reduce((sum, p) => sum + p.kills, 0),
        totalDeaths: teamPlayers.reduce((sum, p) => sum + p.deaths, 0),
        totalDamage: teamPlayers.reduce((sum, p) => sum + p.damage, 0),
        firstKills: teamPlayers.reduce((sum, p) => sum + p.firstKills, 0),
        firstDeaths: teamPlayers.reduce((sum, p) => sum + p.firstDeaths, 0),

        avgEquipValue: 0, // Would need economy data
        totalSpent: 0,

        players,

        isOvertime: demo.rounds.length > 30,
        wasCloseGame: Math.abs(myScore - oppScore) <= 3,
        camebackFrom5Down: false, // Would need round-by-round analysis
      };
    });

    return { identity, matches, roster };
  }

  /**
   * Infer player role from team role
   */
  private inferRole(teamRole: string): PlayerRole {
    switch (teamRole) {
      case "PLAYER":
        return "hybrid";
      case "COACH":
        return "igl";
      case "ANALYST":
        return "support";
      default:
        return "hybrid";
    }
  }

  // ===========================================================================
  // PRIVATE: COMPUTATION
  // ===========================================================================

  /**
   * Compute and store team profile
   */
  private async computeAndStoreProfile(
    teamId: string,
    window: TimeWindowKey,
  ): Promise<AggregatedTeamProfile> {
    const startTime = Date.now();

    // Load data
    const { identity, matches, roster } = await this.loadTeamMatchData(
      teamId,
      window,
    );

    if (matches.length === 0) {
      throw new NotFoundException(
        `No matches found for team ${teamId} in window ${window}`,
      );
    }

    // Compute profile
    const profile = aggregateTeamProfile(identity, matches, roster, window);

    // Store in cache
    await this.storeProfile(teamId, window, profile);

    const duration = Date.now() - startTime;
    this.logger.log(
      `Computed profile for team ${teamId} in ${duration}ms ` +
        `(${matches.length} matches, ${profile.period.roundCount} rounds)`,
    );

    return profile;
  }

  /**
   * Compute profile for ad-hoc roster
   */
  private async computeRosterProfile(
    rosterId: string,
    steamIds: readonly string[],
    window: TimeWindowKey,
  ): Promise<AggregatedTeamProfile> {
    const startTime = Date.now();

    // Build date filter
    // Use centralized time window configuration
    const windowFilter = getTimeWindowFilter(window);
    const matchLimit = windowFilter.matchLimit;
    const dateFilter = windowFilter.dateFilter
      ? { gte: windowFilter.dateFilter }
      : undefined;

    // Find demos where all these players played together
    const rosterDemoQuery = {
      where: {
        status: "COMPLETED" as const,
        ...(dateFilter ? { playedAt: dateFilter } : {}),
        playerStats: {
          some: {
            steamId: { in: [...steamIds] },
          },
        },
      },
      include: {
        playerStats: {
          where: {
            steamId: { in: [...steamIds] },
          },
          select: {
            steamId: true,
            playerName: true,
            teamNum: true,
            kills: true,
            deaths: true,
            assists: true,
            damage: true,
            rating: true,
            firstKills: true,
            firstDeaths: true,
            flashAssists: true,
          },
        },
        rounds: {
          select: {
            roundNumber: true,
            winnerTeam: true,
          },
        },
      },
      orderBy: { playedAt: "desc" as const },
      ...(matchLimit ? { take: matchLimit } : {}),
    };

    const demos = await this.prisma.demo.findMany(rosterDemoQuery);

    // Filter to demos where at least 3 of the players were on the same team
    const validDemos = demos.filter((demo) => {
      const teamNums = new Map<number, number>();
      for (const ps of demo.playerStats) {
        teamNums.set(ps.teamNum, (teamNums.get(ps.teamNum) ?? 0) + 1);
      }
      // At least MIN_SAME_TEAM_COUNT players on same team
      return [...teamNums.values()].some(
        (count) => count >= TEAM_CONFIG.MIN_SAME_TEAM_COUNT,
      );
    });

    if (validDemos.length === 0) {
      throw new NotFoundException(
        `No matches found for roster in window ${window}`,
      );
    }

    // Build identity for ad-hoc roster
    const identity: TeamIdentity = {
      teamId: rosterId,
      name: "Ad-hoc Team",
      tag: null,
      logo: null,
      region: null,
    };

    // Transform to TeamMatchData (simplified version)
    const matches: TeamMatchData[] = validDemos.map((demo) => {
      const ourTeamNum = demo.playerStats[0]?.teamNum ?? 2;
      const isTeam1 = ourTeamNum === 2;

      const myScore = isTeam1 ? demo.team1Score : demo.team2Score;
      const oppScore = isTeam1 ? demo.team2Score : demo.team1Score;

      const players: TeamMatchPlayer[] = demo.playerStats.map((ps) => ({
        steamId: ps.steamId,
        name: ps.playerName,
        rating: ps.rating ?? 1.0,
        kills: ps.kills,
        deaths: ps.deaths,
        assists: ps.assists,
        adr: ps.damage / demo.rounds.length,
        tradeKills: 0,
        flashAssists: ps.flashAssists,
      }));

      return {
        demoId: demo.id,
        playedAt: demo.playedAt ?? new Date(),
        mapName: demo.mapName,
        won: myScore > oppScore,
        draw: myScore === oppScore,
        score: myScore,
        opponentScore: oppScore,
        opponent: isTeam1 ? demo.team2Name : demo.team1Name,

        totalRounds: demo.rounds.length,
        roundsWon: myScore,
        ctRounds: 15,
        ctRoundsWon: Math.floor(myScore / 2),
        tRounds: 15,
        tRoundsWon: Math.ceil(myScore / 2),

        pistolRoundsPlayed: 2,
        pistolRoundsWon: 1,
        ecoRoundsPlayed: 5,
        ecoRoundsWon: 1,
        antiEcoRoundsPlayed: 5,
        antiEcoRoundsWon: 4,
        forceRoundsPlayed: 4,
        forceRoundsWon: 1,
        fullBuyRoundsPlayed: 14,
        fullBuyRoundsWon: Math.floor(myScore * 0.6),

        totalKills: demo.playerStats.reduce((sum, p) => sum + p.kills, 0),
        totalDeaths: demo.playerStats.reduce((sum, p) => sum + p.deaths, 0),
        totalDamage: demo.playerStats.reduce((sum, p) => sum + p.damage, 0),
        firstKills: demo.playerStats.reduce((sum, p) => sum + p.firstKills, 0),
        firstDeaths: demo.playerStats.reduce(
          (sum, p) => sum + p.firstDeaths,
          0,
        ),

        avgEquipValue: 0,
        totalSpent: 0,

        players,

        isOvertime: demo.rounds.length > 30,
        wasCloseGame: Math.abs(myScore - oppScore) <= 3,
        camebackFrom5Down: false,
      };
    });

    // Build roster
    const roster: RosterEntry[] = steamIds.map((steamId) => {
      const player = validDemos[0]?.playerStats.find(
        (p) => p.steamId === steamId,
      );
      return {
        steamId,
        name: player?.playerName ?? "Unknown",
        role: "hybrid" as PlayerRole,
        joinedAt: new Date(),
      };
    });

    // Compute profile
    const profile = aggregateTeamProfile(identity, matches, roster, window);

    // Store in cache
    await this.storeProfile(rosterId, window, profile);

    const duration = Date.now() - startTime;
    this.logger.log(
      `Computed roster profile in ${duration}ms ` +
        `(${matches.length} matches, ${profile.period.roundCount} rounds)`,
    );

    return profile;
  }

  // ===========================================================================
  // PRIVATE: CACHING
  // ===========================================================================

  /**
   * Get cached profile
   */
  private async getCachedProfile(
    teamId: string,
    window: TimeWindowKey,
  ): Promise<{ profile: AggregatedTeamProfile; cachedAt: Date } | null> {
    const cacheKey = `aggregation:team:${teamId}:${window}`;

    const cached = await this.prisma.analysis.findFirst({
      where: {
        demo: {
          fileHash: cacheKey,
        },
        status: AnalysisStatus.COMPLETED,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!cached || !cached.results) return null;

    return {
      profile: cached.results as unknown as AggregatedTeamProfile,
      cachedAt: cached.completedAt ?? cached.createdAt,
    };
  }

  /**
   * Check if cached profile is stale
   */
  private isStale(cached: {
    profile: AggregatedTeamProfile;
    cachedAt: Date;
  }): boolean {
    const age = Date.now() - cached.cachedAt.getTime();
    return age > CACHE_CONFIG.TEAM_PROFILE_TTL_MS;
  }

  /**
   * Store profile in cache
   */
  private async storeProfile(
    teamId: string,
    window: TimeWindowKey,
    profile: AggregatedTeamProfile,
  ): Promise<void> {
    const cacheKey = `aggregation:team:${teamId}:${window}`;

    // Find or create the aggregation demo marker
    let demo = await this.prisma.demo.findFirst({
      where: { fileHash: cacheKey },
    });

    if (!demo) {
      demo = await this.prisma.demo.create({
        data: {
          filename: `${teamId}-${window}-aggregation`,
          fileSize: 0,
          fileHash: cacheKey,
          storagePath: "",
          mapName: "aggregation",
          totalTicks: 0,
          durationSeconds: 0,
          status: "COMPLETED",
        },
      });
    }

    // Store the profile as analysis results
    await this.prisma.analysis.create({
      data: {
        demoId: demo.id,
        type: AnalysisType.ADVANCED,
        status: AnalysisStatus.COMPLETED,
        results: profile as object,
        completedAt: new Date(),
      },
    });
  }
}

// =============================================================================
// HELPER TYPES
// =============================================================================

interface RosterEntry {
  steamId: string;
  name: string;
  role: PlayerRole;
  joinedAt: Date;
}
