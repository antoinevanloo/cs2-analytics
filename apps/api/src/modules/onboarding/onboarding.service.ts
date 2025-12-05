/**
 * Onboarding Service - Business logic for onboarding flow
 *
 * Features:
 * - Step tracking and progression
 * - First insight generation (rating + weakness analysis)
 * - Match import orchestration
 * - Cache for transient state
 *
 * @module onboarding
 */

import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PrismaService } from "../../common/prisma";
import { RedisService } from "../../common/redis";
import { PreferredRole } from "@prisma/client";
import {
  OnboardingStep,
  ImportSource,
  ImportStatus,
  type OnboardingStatusResponse,
  type FirstInsightResponse,
  type ImportProgressResponse,
  type CompleteOnboardingResponse,
} from "./dto/onboarding.dto";

// ============================================================================
// Constants
// ============================================================================

const CACHE_PREFIX = "onboarding:";
const CACHE_TTL = 3600 * 1000; // 1 hour in milliseconds

const METRIC_LABELS: Record<string, string> = {
  rating: "HLTV Rating",
  kast: "KAST %",
  adr: "ADR",
  impact: "Impact Rating",
  kpr: "Kills per Round",
  dpr: "Deaths per Round",
  hsPercent: "Headshot %",
  clutchWinRate: "Clutch Win Rate",
  openingKillRate: "Opening Kill Rate",
  utilityDamage: "Utility Damage",
};

const METRIC_TIPS: Record<string, string> = {
  kast: "Focus on staying alive and providing value each round, even without kills",
  adr: "Take more duels and aim for higher damage output in engagements",
  hsPercent: "Practice aim training and crosshair placement at head level",
  clutchWinRate:
    "Work on post-plant positioning and time management in clutches",
  openingKillRate: "Consider playing entry roles or practice aggressive peeks",
  utilityDamage: "Learn common molotov and HE grenade lineups for your maps",
  impact: "Focus on creating space for your team and getting impactful kills",
  dpr: "Work on positioning and avoid overpeaking or taking unnecessary fights",
};

// ============================================================================
// Service
// ============================================================================

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @InjectQueue("demo-import") private importQueue: Queue,
  ) {}

  // ===========================================================================
  // Status
  // ===========================================================================

  async getStatus(userId: string): Promise<OnboardingStatusResponse> {
    // Get or create user preferences
    let preferences = await this.prisma.userPreferences.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            steamId: true,
            faceitId: true,
          },
        },
      },
    });

    if (!preferences) {
      preferences = await this.prisma.userPreferences.create({
        data: { userId },
        include: {
          user: {
            select: {
              steamId: true,
              faceitId: true,
            },
          },
        },
      });
    }

    // Get import status from cache
    const importStatus = await this.getImportStatusFromCache(userId);

    // Calculate completed steps
    const completedSteps = this.calculateCompletedSteps(
      preferences.onboardingStep,
    );

    return {
      currentStep: preferences.onboardingStep as OnboardingStep,
      isCompleted: preferences.onboardingCompletedAt !== null,
      completedAt: preferences.onboardingCompletedAt?.toISOString() ?? null,
      completedSteps,
      connectedAccounts: {
        steam: preferences.user.steamId !== null,
        faceit: preferences.user.faceitId !== null,
      },
      selectedRole: preferences.preferredRole,
      importStatus,
    };
  }

  // ===========================================================================
  // Step Management
  // ===========================================================================

  async updateStep(
    userId: string,
    step: number,
    data?: Record<string, unknown>,
  ): Promise<OnboardingStatusResponse> {
    // Validate step
    if (step < 0 || step > OnboardingStep.COMPLETED) {
      throw new BadRequestException(`Invalid step: ${step}`);
    }

    // Build update data
    const updateData: {
      onboardingStep: number;
      preferredRole?: PreferredRole;
    } = {
      onboardingStep: step,
    };

    // Handle step-specific data
    if (data?.preferredRole) {
      updateData.preferredRole = data.preferredRole as PreferredRole;
    }

    await this.prisma.userPreferences.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        ...updateData,
      },
    });

    return this.getStatus(userId);
  }

  async selectRole(
    userId: string,
    role: PreferredRole,
    focusAreas?: string[],
  ): Promise<OnboardingStatusResponse> {
    await this.prisma.userPreferences.upsert({
      where: { userId },
      update: {
        preferredRole: role,
        onboardingStep: OnboardingStep.IMPORT_MATCHES,
      },
      create: {
        userId,
        preferredRole: role,
        onboardingStep: OnboardingStep.IMPORT_MATCHES,
      },
    });

    // Cache focus areas for analytics
    if (focusAreas && focusAreas.length > 0) {
      await this.redis.set(
        `${CACHE_PREFIX}focus:${userId}`,
        JSON.stringify(focusAreas),
        CACHE_TTL,
      );
    }

    return this.getStatus(userId);
  }

  // ===========================================================================
  // Import
  // ===========================================================================

  async startImport(
    userId: string,
    source: ImportSource,
    matchCount = 10,
    enableAutoImport = false,
  ): Promise<ImportProgressResponse> {
    // Check if import already in progress
    const existing = await this.getImportProgress(userId);
    if (
      existing &&
      (existing.status === ImportStatus.IN_PROGRESS ||
        existing.status === ImportStatus.QUEUED)
    ) {
      throw new BadRequestException("Import already in progress");
    }

    // Get user for account verification
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { steamId: true, faceitId: true },
    });

    if (!user) {
      throw new BadRequestException("User not found");
    }

    // Verify account is connected
    if (source === ImportSource.FACEIT && !user.faceitId) {
      throw new BadRequestException("FACEIT account not connected");
    }
    if (source === ImportSource.STEAM && !user.steamId) {
      throw new BadRequestException("Steam account not connected");
    }

    // Create import job
    const jobId = `import-${userId}-${Date.now()}`;
    const jobData = {
      userId,
      source,
      matchCount,
      enableAutoImport,
    };

    await this.importQueue.add("import-matches", jobData, {
      jobId,
      priority: 5,
    });

    // Store initial progress in cache
    const progress: ImportProgressResponse = {
      jobId,
      status: ImportStatus.QUEUED,
      source,
      progress: 0,
      matchesImported: 0,
      matchesTotal: matchCount,
      currentMatch: null,
      error: null,
      estimatedTimeRemaining: null,
    };

    await this.setImportProgress(userId, progress);

    // Update auto-import preference
    if (enableAutoImport && source === ImportSource.FACEIT) {
      await this.prisma.userPreferences.update({
        where: { userId },
        data: { faceitAutoImport: true },
      });
    }

    return progress;
  }

  async getImportProgress(
    userId: string,
  ): Promise<ImportProgressResponse | null> {
    return this.redis.get<ImportProgressResponse>(
      `${CACHE_PREFIX}import:${userId}`,
    );
  }

  async skipImport(userId: string): Promise<OnboardingStatusResponse> {
    await this.prisma.userPreferences.update({
      where: { userId },
      data: { onboardingStep: OnboardingStep.FIRST_INSIGHT },
    });

    // Clear any import progress
    await this.redis.delete(`${CACHE_PREFIX}import:${userId}`);

    return this.getStatus(userId);
  }

  async cancelImport(userId: string): Promise<void> {
    const progress = await this.getImportProgress(userId);
    if (!progress) return;

    // Try to remove the job from queue
    try {
      const job = await this.importQueue.getJob(progress.jobId);
      if (job) {
        await job.remove();
      }
    } catch (error) {
      this.logger.warn(`Failed to remove job ${progress.jobId}: ${error}`);
    }

    // Update progress to cancelled
    progress.status = ImportStatus.CANCELLED;
    await this.setImportProgress(userId, progress);
  }

  // ===========================================================================
  // First Insight
  // ===========================================================================

  async getFirstInsight(userId: string): Promise<FirstInsightResponse> {
    // Get user's match stats
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { steamId: true },
    });

    if (!user?.steamId) {
      return this.generateMockInsight();
    }

    // Get recent match stats
    const matchStats = await this.prisma.matchPlayerStats.findMany({
      where: { steamId: user.steamId },
      orderBy: { demo: { playedAt: "desc" } },
      take: 20,
      select: {
        rating: true,
        kills: true,
        deaths: true,
        assists: true,
        adr: true,
        hsp: true,
        firstKills: true,
        clutchesWon: true,
        clutchesPlayed: true,
        utilityDamage: true,
      },
    });

    if (matchStats.length === 0) {
      return this.generateMockInsight();
    }

    // Calculate averages
    const avgRating = this.average(matchStats.map((s) => s.rating ?? 0));
    // KAST is not stored directly, estimate from survival rate
    const avgKd = this.average(
      matchStats.map((s) => (s.deaths > 0 ? s.kills / s.deaths : s.kills)),
    );
    const avgAdr = this.average(matchStats.map((s) => s.adr ?? 0));
    const avgHsPercent = this.average(matchStats.map((s) => s.hsp ?? 0));
    const avgFirstKills = this.average(
      matchStats.map((s) => s.firstKills ?? 0),
    );

    // Benchmark values (average player stats)
    const benchmarks = {
      rating: 1.0,
      kd: 1.0,
      adr: 75,
      hsPercent: 45,
      firstKills: 2,
    };

    // Calculate relative performance
    const metrics = [
      {
        key: "rating",
        label: METRIC_LABELS.rating ?? "Rating",
        value: avgRating,
        benchmark: benchmarks.rating,
        relativeDiff: (avgRating - benchmarks.rating) / benchmarks.rating,
      },
      {
        key: "kd",
        label: "K/D Ratio",
        value: avgKd,
        benchmark: benchmarks.kd,
        relativeDiff: (avgKd - benchmarks.kd) / benchmarks.kd,
      },
      {
        key: "adr",
        label: METRIC_LABELS.adr ?? "ADR",
        value: avgAdr,
        benchmark: benchmarks.adr,
        relativeDiff: (avgAdr - benchmarks.adr) / benchmarks.adr,
      },
      {
        key: "hsPercent",
        label: METRIC_LABELS.hsPercent ?? "HS%",
        value: avgHsPercent,
        benchmark: benchmarks.hsPercent,
        relativeDiff:
          (avgHsPercent - benchmarks.hsPercent) / benchmarks.hsPercent,
      },
      {
        key: "firstKills",
        label: "First Kills",
        value: avgFirstKills,
        benchmark: benchmarks.firstKills,
        relativeDiff:
          (avgFirstKills - benchmarks.firstKills) / benchmarks.firstKills,
      },
    ];

    // Sort by relative difference
    const ranked = [...metrics].sort((a, b) => b.relativeDiff - a.relativeDiff);

    const defaultMetric = {
      key: "kast",
      label: "KAST",
      value: 70,
      benchmark: 70,
      relativeDiff: 0,
    };
    const topStrength = ranked[0] ?? defaultMetric;
    const mainWeakness = ranked[ranked.length - 1] ?? defaultMetric;

    // Calculate percentile (simplified)
    const percentile = Math.min(99, Math.max(1, Math.round(avgRating * 50)));

    // Rating label
    const ratingLabel = this.getRatingLabel(avgRating);

    return {
      rating: {
        value: Number(avgRating.toFixed(2)),
        label: ratingLabel,
        percentile,
      },
      topStrength: {
        metric: topStrength.key,
        label: topStrength.label,
        value: Number(topStrength.value.toFixed(1)),
        insight: this.generateStrengthInsight(
          topStrength.key,
          topStrength.relativeDiff,
        ),
      },
      mainWeakness: {
        metric: mainWeakness.key,
        label: mainWeakness.label,
        value: Number(mainWeakness.value.toFixed(1)),
        insight: this.generateWeaknessInsight(
          mainWeakness.key,
          mainWeakness.relativeDiff,
        ),
        improvementTip:
          METRIC_TIPS[mainWeakness.key] ??
          "Focus on this area in your practice sessions",
      },
      matchesAnalyzed: matchStats.length,
      nextStep: {
        title: "Explore Your Dashboard",
        description:
          "Dive deeper into your performance with detailed match analysis",
        actionUrl: "/dashboard",
      },
    };
  }

  // ===========================================================================
  // Completion
  // ===========================================================================

  async completeOnboarding(
    userId: string,
  ): Promise<CompleteOnboardingResponse> {
    const preferences = await this.prisma.userPreferences.update({
      where: { userId },
      data: {
        onboardingStep: OnboardingStep.COMPLETED,
        onboardingCompletedAt: new Date(),
      },
      include: {
        user: {
          select: {
            steamId: true,
            faceitId: true,
          },
        },
      },
    });

    // Count imported matches
    let matchCount = 0;
    if (preferences.user.steamId) {
      matchCount = await this.prisma.matchPlayerStats.count({
        where: {
          steamId: preferences.user.steamId,
        },
      });
    }

    const accountsConnected: string[] = [];
    if (preferences.user.steamId) accountsConnected.push("Steam");
    if (preferences.user.faceitId) accountsConnected.push("FACEIT");

    return {
      success: true,
      redirectUrl: "/dashboard",
      summary: {
        accountsConnected,
        matchesImported: matchCount,
        selectedRole: preferences.preferredRole,
        insightGenerated: matchCount > 0,
      },
    };
  }

  async markWelcomeSeen(userId: string): Promise<void> {
    await this.prisma.userPreferences.upsert({
      where: { userId },
      update: { hasSeenWelcome: true },
      create: { userId, hasSeenWelcome: true },
    });
  }

  async markTourCompleted(userId: string): Promise<void> {
    await this.prisma.userPreferences.upsert({
      where: { userId },
      update: { hasCompletedTour: true },
      create: { userId, hasCompletedTour: true },
    });
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private calculateCompletedSteps(currentStep: number): number[] {
    const completed: number[] = [];
    for (let i = 0; i < currentStep; i++) {
      completed.push(i);
    }
    return completed;
  }

  private async getImportStatusFromCache(userId: string) {
    const progress = await this.getImportProgress(userId);
    if (!progress) return null;

    return {
      status: progress.status,
      source: progress.source,
      progress: progress.progress,
      matchesImported: progress.matchesImported,
      matchesTotal: progress.matchesTotal,
    };
  }

  private async setImportProgress(
    userId: string,
    progress: ImportProgressResponse,
  ): Promise<void> {
    await this.redis.set(
      `${CACHE_PREFIX}import:${userId}`,
      JSON.stringify(progress),
      CACHE_TTL,
    );
  }

  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  private getRatingLabel(rating: number): string {
    if (rating >= 1.3) return "Elite";
    if (rating >= 1.15) return "Excellent";
    if (rating >= 1.05) return "Good";
    if (rating >= 0.95) return "Average";
    if (rating >= 0.85) return "Below Average";
    return "Needs Improvement";
  }

  private generateStrengthInsight(metric: string, diff: number): string {
    const percentAbove = Math.round(diff * 100);
    return `Your ${METRIC_LABELS[metric] ?? metric} is ${percentAbove}% above average players`;
  }

  private generateWeaknessInsight(metric: string, diff: number): string {
    const percentBelow = Math.round(Math.abs(diff) * 100);
    return `Your ${METRIC_LABELS[metric] ?? metric} is ${percentBelow}% below average - this is your biggest opportunity for improvement`;
  }

  private generateMockInsight(): FirstInsightResponse {
    return {
      rating: {
        value: 1.0,
        label: "Average",
        percentile: 50,
      },
      topStrength: {
        metric: "rating",
        label: "Rating",
        value: 1.0,
        insight: "Import matches to see your real strengths",
      },
      mainWeakness: {
        metric: "kast",
        label: "KAST",
        value: 70,
        insight: "Import matches to identify areas for improvement",
        improvementTip:
          "Connect your accounts and import matches to get personalized insights",
      },
      matchesAnalyzed: 0,
      nextStep: {
        title: "Import Your Matches",
        description:
          "Get personalized insights by importing your match history",
        actionUrl: "/onboarding?step=import",
      },
    };
  }
}
