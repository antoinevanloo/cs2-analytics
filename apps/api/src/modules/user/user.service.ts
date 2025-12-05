/**
 * User Service - Business logic for user management and preferences
 *
 * Features:
 * - User profile management
 * - Preferences CRUD with defaults
 * - Dashboard data aggregation by role
 * - Onboarding state management
 */

import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma";
import { RedisService } from "../../common/redis";
import { PreferredRole, Prisma } from "@prisma/client";
import type {
  UpdatePreferencesDto,
  UserPreferencesResponse,
  DashboardQueryDto,
} from "./dto/user.dto";

// Dashboard widget type
export interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  data: Record<string, unknown>;
  priority: number;
}

// Player dashboard data
export interface PlayerDashboardData {
  role: "PLAYER";
  overview: {
    totalMatches: number;
    winRate: number;
    currentRating: number;
    ratingTrend: number;
  };
  strengths: Array<{ name: string; score: number; description: string }>;
  weaknesses: Array<{ name: string; score: number; suggestion: string }>;
  recentMatches: Array<{
    id: string;
    map: string;
    result: "win" | "loss" | "draw";
    rating: number;
    kills: number;
    deaths: number;
    date: Date;
  }>;
  nextSteps: Array<{
    id: string;
    title: string;
    description: string;
    priority: number;
  }>;
  widgets: DashboardWidget[];
}

// Coach dashboard data
export interface CoachDashboardData {
  role: "COACH";
  teamHealth: {
    averageRating: number;
    averageRatingTrend: number;
    totalMatches: number;
    winRate: number;
  };
  playerTiles: Array<{
    id: string;
    name: string;
    avatar: string | null;
    rating: number;
    ratingTrend: number;
    form: "hot" | "normal" | "cold";
    needsAttention: boolean;
    topStrength: string;
    topWeakness: string;
  }>;
  teamStrengths: Array<{ name: string; score: number }>;
  teamWeaknesses: Array<{ name: string; score: number; suggestion: string }>;
  practiceRecommendations: Array<{
    id: string;
    title: string;
    description: string;
  }>;
  widgets: DashboardWidget[];
}

// Scout dashboard data
export interface ScoutDashboardData {
  role: "SCOUT";
  recentOpponents: Array<{
    id: string;
    name: string;
    tag: string | null;
    matchCount: number;
    winRate: number;
    lastPlayed: Date;
  }>;
  upcomingMatches: Array<{
    id: string;
    opponent: string;
    date: Date;
    hasScoutingReport: boolean;
  }>;
  mapMeta: Array<{
    map: string;
    pickRate: number;
    winRate: number;
    trend: "up" | "stable" | "down";
  }>;
  playerWatchlist: Array<{
    id: string;
    name: string;
    team: string;
    rating: number;
    role: string;
  }>;
  widgets: DashboardWidget[];
}

// Analyst dashboard data
export interface AnalystDashboardData {
  role: "ANALYST";
  dataOverview: {
    totalDemos: number;
    totalRounds: number;
    dataPoints: number;
    lastUpdated: Date;
  };
  trendingInsights: Array<{
    id: string;
    title: string;
    description: string;
    type: "positive" | "negative" | "neutral";
  }>;
  customReports: Array<{
    id: string;
    name: string;
    lastRun: Date;
    schedule: string | null;
  }>;
  widgets: DashboardWidget[];
}

export type DashboardData =
  | PlayerDashboardData
  | CoachDashboardData
  | ScoutDashboardData
  | AnalystDashboardData;

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  // Cache TTL for dashboard data (5 minutes in ms)
  private readonly DASHBOARD_CACHE_TTL = 300000;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  /**
   * Get user profile by ID
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        steamId: true,
        faceitId: true,
        eseaId: true,
        plan: true,
        planExpiresAt: true,
        createdAt: true,
        teams: {
          select: {
            role: true,
            team: {
              select: {
                id: true,
                name: true,
                tag: true,
                logo: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    return user;
  }

  /**
   * Get or create user preferences
   */
  async getPreferences(userId: string): Promise<UserPreferencesResponse> {
    // Try to get existing preferences
    let preferences = await this.prisma.userPreferences.findUnique({
      where: { userId },
    });

    // Create default preferences if none exist
    if (!preferences) {
      preferences = await this.prisma.userPreferences.create({
        data: { userId },
      });
      this.logger.log(`Created default preferences for user ${userId}`);
    }

    return {
      preferredRole: preferences.preferredRole,
      dashboardLayout: preferences.dashboardLayout as Record<
        string,
        unknown
      > | null,
      favoriteMetrics: preferences.favoriteMetrics,
      defaultTimeRange: preferences.defaultTimeRange,
      emailNotifications: preferences.emailNotifications,
      weeklyDigest: preferences.weeklyDigest,
      onboardingStep: preferences.onboardingStep,
      onboardingCompletedAt: preferences.onboardingCompletedAt,
      hasSeenWelcome: preferences.hasSeenWelcome,
      hasCompletedTour: preferences.hasCompletedTour,
      faceitAutoImport: preferences.faceitAutoImport,
      faceitImportInterval: preferences.faceitImportInterval,
      theme: preferences.theme,
      compactMode: preferences.compactMode,
      showAdvancedStats: preferences.showAdvancedStats,
      profileVisibility: preferences.profileVisibility,
      shareStats: preferences.shareStats,
    };
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    userId: string,
    data: UpdatePreferencesDto,
  ): Promise<UserPreferencesResponse> {
    // Ensure user exists
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // Build update data, excluding undefined values
    const updateData: Prisma.UserPreferencesUpdateInput = {};

    if (data.preferredRole !== undefined)
      updateData.preferredRole = data.preferredRole;
    if (data.dashboardLayout !== undefined) {
      updateData.dashboardLayout =
        data.dashboardLayout as Prisma.InputJsonValue;
    }
    if (data.favoriteMetrics !== undefined)
      updateData.favoriteMetrics = data.favoriteMetrics;
    if (data.defaultTimeRange !== undefined)
      updateData.defaultTimeRange = data.defaultTimeRange;
    if (data.emailNotifications !== undefined)
      updateData.emailNotifications = data.emailNotifications;
    if (data.weeklyDigest !== undefined)
      updateData.weeklyDigest = data.weeklyDigest;
    if (data.faceitAutoImport !== undefined)
      updateData.faceitAutoImport = data.faceitAutoImport;
    if (data.faceitImportInterval !== undefined)
      updateData.faceitImportInterval = data.faceitImportInterval;
    if (data.theme !== undefined) updateData.theme = data.theme;
    if (data.compactMode !== undefined)
      updateData.compactMode = data.compactMode;
    if (data.showAdvancedStats !== undefined)
      updateData.showAdvancedStats = data.showAdvancedStats;
    if (data.profileVisibility !== undefined)
      updateData.profileVisibility = data.profileVisibility;
    if (data.shareStats !== undefined) updateData.shareStats = data.shareStats;

    // Upsert preferences
    await this.prisma.userPreferences.upsert({
      where: { userId },
      create: {
        userId,
        ...(data.preferredRole && { preferredRole: data.preferredRole }),
        ...(data.dashboardLayout && {
          dashboardLayout: data.dashboardLayout as Prisma.InputJsonValue,
        }),
        ...(data.favoriteMetrics && { favoriteMetrics: data.favoriteMetrics }),
        ...(data.defaultTimeRange && {
          defaultTimeRange: data.defaultTimeRange,
        }),
        ...(data.emailNotifications !== undefined && {
          emailNotifications: data.emailNotifications,
        }),
        ...(data.weeklyDigest !== undefined && {
          weeklyDigest: data.weeklyDigest,
        }),
        ...(data.faceitAutoImport !== undefined && {
          faceitAutoImport: data.faceitAutoImport,
        }),
        ...(data.faceitImportInterval && {
          faceitImportInterval: data.faceitImportInterval,
        }),
        ...(data.theme && { theme: data.theme }),
        ...(data.compactMode !== undefined && {
          compactMode: data.compactMode,
        }),
        ...(data.showAdvancedStats !== undefined && {
          showAdvancedStats: data.showAdvancedStats,
        }),
        ...(data.profileVisibility && {
          profileVisibility: data.profileVisibility,
        }),
        ...(data.shareStats !== undefined && { shareStats: data.shareStats }),
      },
      update: updateData,
    });

    // Invalidate dashboard cache
    await this.invalidateDashboardCache(userId);

    this.logger.log(`Updated preferences for user ${userId}`);

    return this.getPreferences(userId);
  }

  /**
   * Update onboarding progress
   */
  async updateOnboarding(
    userId: string,
    step: number,
    completed = false,
  ): Promise<{ step: number; completed: boolean }> {
    const updateData: Prisma.UserPreferencesUpdateInput = {
      onboardingStep: step,
    };

    if (completed) {
      updateData.onboardingCompletedAt = new Date();
    }

    await this.prisma.userPreferences.upsert({
      where: { userId },
      create: {
        userId,
        onboardingStep: step,
        ...(completed && { onboardingCompletedAt: new Date() }),
      },
      update: updateData,
    });

    return { step, completed };
  }

  /**
   * Mark welcome modal as seen
   */
  async markWelcomeSeen(userId: string): Promise<void> {
    await this.prisma.userPreferences.upsert({
      where: { userId },
      create: { userId, hasSeenWelcome: true },
      update: { hasSeenWelcome: true },
    });
  }

  /**
   * Mark product tour as completed
   */
  async markTourCompleted(userId: string): Promise<void> {
    await this.prisma.userPreferences.upsert({
      where: { userId },
      create: { userId, hasCompletedTour: true },
      update: { hasCompletedTour: true },
    });
  }

  /**
   * Get dashboard data for a specific role
   */
  async getDashboardData(
    userId: string,
    role: PreferredRole,
    query: DashboardQueryDto,
  ): Promise<DashboardData> {
    // Check cache first
    const cacheKey = `dashboard:${userId}:${role}:${query.timeRange || "30d"}`;
    const cached = await this.redis.get<DashboardData>(cacheKey);
    if (cached) {
      return cached;
    }

    // Get user profile
    const user = await this.getProfile(userId);

    // Generate role-specific dashboard
    let dashboardData: DashboardData;

    switch (role) {
      case PreferredRole.PLAYER:
        dashboardData = await this.getPlayerDashboard(user.steamId, query);
        break;
      case PreferredRole.COACH:
        dashboardData = await this.getCoachDashboard(userId, query);
        break;
      case PreferredRole.SCOUT:
        dashboardData = await this.getScoutDashboard(query);
        break;
      case PreferredRole.ANALYST:
        dashboardData = await this.getAnalystDashboard(query);
        break;
      default:
        dashboardData = await this.getPlayerDashboard(user.steamId, query);
    }

    // Cache result
    await this.redis.set(cacheKey, dashboardData, this.DASHBOARD_CACHE_TTL);

    return dashboardData;
  }

  /**
   * Generate player-focused dashboard
   */
  private async getPlayerDashboard(
    steamId: string | null,
    query: DashboardQueryDto,
  ): Promise<PlayerDashboardData> {
    const timeRange = this.parseTimeRange(query.timeRange || "30d");

    // Get player stats if steamId is available
    let stats: Array<{
      kills: number;
      deaths: number;
      teamNum: number;
      demo: {
        id: string;
        mapName: string;
        parsedAt: Date | null;
        team1Score: number;
        team2Score: number;
      };
    }> = [];

    if (steamId) {
      stats = await this.prisma.matchPlayerStats.findMany({
        where: {
          steamId,
          demo: {
            parsedAt: { gte: timeRange.start },
          },
        },
        include: {
          demo: {
            select: {
              id: true,
              mapName: true,
              parsedAt: true,
              team1Score: true,
              team2Score: true,
            },
          },
        },
        orderBy: { demo: { parsedAt: "desc" } },
        take: 20,
      });
    }

    // Calculate overview
    const totalMatches = stats.length;
    const wins = stats.filter((s) => this.isWin(s)).length;
    const winRate = totalMatches > 0 ? (wins / totalMatches) * 100 : 0;

    // Rating calculation (simplified - would use actual rating from analysis)
    const currentRating = 1.0 + (winRate - 50) / 100;
    const ratingTrend = 0.02; // Placeholder

    // Build recent matches
    const recentMatches = stats.slice(0, 5).map((s) => ({
      id: s.demo.id,
      map: s.demo.mapName,
      result: this.isWin(s) ? ("win" as const) : ("loss" as const),
      rating: currentRating,
      kills: s.kills,
      deaths: s.deaths,
      date: s.demo.parsedAt || new Date(),
    }));

    return {
      role: "PLAYER",
      overview: {
        totalMatches,
        winRate: Math.round(winRate * 10) / 10,
        currentRating: Math.round(currentRating * 100) / 100,
        ratingTrend,
      },
      strengths: [
        {
          name: "Aim",
          score: 75,
          description: "Your headshot percentage is above average",
        },
        {
          name: "Trade Fragging",
          score: 68,
          description: "You often get refrag opportunities",
        },
      ],
      weaknesses: [
        {
          name: "Utility Usage",
          score: 45,
          suggestion: "Use more flashes before pushing",
        },
        {
          name: "Economy Management",
          score: 52,
          suggestion: "Avoid force-buying on 3rd round loss",
        },
      ],
      recentMatches,
      nextSteps: [
        {
          id: "1",
          title: "Watch your recent demos",
          description: "Review your last 3 matches for mistakes",
          priority: 1,
        },
        {
          id: "2",
          title: "Practice utility",
          description: "Learn 3 new smokes for your favorite map",
          priority: 2,
        },
      ],
      widgets: [],
    };
  }

  /**
   * Generate coach-focused dashboard
   */
  private async getCoachDashboard(
    userId: string,
    _query: DashboardQueryDto,
  ): Promise<CoachDashboardData> {
    // Get user's teams
    const teamMemberships = await this.prisma.teamMember.findMany({
      where: { userId },
      include: {
        team: {
          include: {
            members: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    const team = teamMemberships[0]?.team;
    const players = team?.members.filter((m) => m.role === "PLAYER") || [];

    // Build player tiles
    const playerTiles = players.map((member) => ({
      id: member.user.id,
      name: member.user.name || "Unknown",
      avatar: member.user.avatar,
      rating: 1.05, // Would calculate from actual data
      ratingTrend: 0.02,
      form: "normal" as const,
      needsAttention: false,
      topStrength: "Aim",
      topWeakness: "Utility",
    }));

    return {
      role: "COACH",
      teamHealth: {
        averageRating: 1.05,
        averageRatingTrend: 0.01,
        totalMatches: 15,
        winRate: 60,
      },
      playerTiles,
      teamStrengths: [
        { name: "Pistol Rounds", score: 72 },
        { name: "CT Side", score: 68 },
      ],
      teamWeaknesses: [
        { name: "Anti-eco", score: 45, suggestion: "Review anti-eco setups" },
        {
          name: "Late round situations",
          score: 48,
          suggestion: "Practice clutch scenarios",
        },
      ],
      practiceRecommendations: [
        {
          id: "1",
          title: "CT Retakes on Mirage",
          description: "Win rate below average",
        },
        {
          id: "2",
          title: "T Side Executes on Inferno",
          description: "Post-plant situations need work",
        },
      ],
      widgets: [],
    };
  }

  /**
   * Generate scout-focused dashboard
   */
  private async getScoutDashboard(
    _query: DashboardQueryDto,
  ): Promise<ScoutDashboardData> {
    return {
      role: "SCOUT",
      recentOpponents: [
        {
          id: "1",
          name: "Team Liquid",
          tag: "TL",
          matchCount: 3,
          winRate: 33,
          lastPlayed: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      ],
      upcomingMatches: [],
      mapMeta: [
        { map: "de_mirage", pickRate: 25, winRate: 55, trend: "stable" },
        { map: "de_inferno", pickRate: 22, winRate: 48, trend: "down" },
        { map: "de_dust2", pickRate: 18, winRate: 62, trend: "up" },
      ],
      playerWatchlist: [],
      widgets: [],
    };
  }

  /**
   * Generate analyst-focused dashboard
   */
  private async getAnalystDashboard(
    _query: DashboardQueryDto,
  ): Promise<AnalystDashboardData> {
    // Get data statistics
    const [demoCount, roundCount] = await Promise.all([
      this.prisma.demo.count({ where: { status: "COMPLETED" } }),
      this.prisma.round.count(),
    ]);

    return {
      role: "ANALYST",
      dataOverview: {
        totalDemos: demoCount,
        totalRounds: roundCount,
        dataPoints: roundCount * 100, // Approximate
        lastUpdated: new Date(),
      },
      trendingInsights: [
        {
          id: "1",
          title: "Smoke usage increased",
          description: "Your team is using 15% more smokes this month",
          type: "positive",
        },
        {
          id: "2",
          title: "AWP impact declining",
          description: "AWP kills per round down from 0.8 to 0.6",
          type: "negative",
        },
      ],
      customReports: [],
      widgets: [],
    };
  }

  /**
   * Parse time range string to date range
   */
  private parseTimeRange(range: string): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date();

    switch (range) {
      case "7d":
        start.setDate(end.getDate() - 7);
        break;
      case "30d":
        start.setDate(end.getDate() - 30);
        break;
      case "90d":
        start.setDate(end.getDate() - 90);
        break;
      case "all":
        start.setFullYear(2020); // CS2 release
        break;
      default:
        start.setDate(end.getDate() - 30);
    }

    return { start, end };
  }

  /**
   * Check if a match was a win for the player
   */
  private isWin(stats: {
    teamNum: number;
    demo: { team1Score: number; team2Score: number };
  }): boolean {
    const { teamNum, demo } = stats;
    if (teamNum === 2) {
      return demo.team1Score > demo.team2Score;
    }
    return demo.team2Score > demo.team1Score;
  }

  /**
   * Invalidate dashboard cache for a user
   */
  private async invalidateDashboardCache(userId: string): Promise<void> {
    const pattern = `dashboard:${userId}:*`;
    await this.redis.deletePattern(pattern);
  }
}
