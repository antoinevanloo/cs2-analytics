/**
 * Player Aggregation Service
 *
 * Service layer for aggregating player statistics across multiple matches.
 * Transforms database data into calculator inputs and stores results.
 *
 * @module aggregation/services/player-aggregation
 */

import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../common/prisma";
import { RedisService } from "../../../common/redis";

import type { AggregatedPlayerProfile, PlayerIdentity } from "../../analysis/types/aggregation.types";

import {
  aggregatePlayerProfile,
  type PlayerMatchData,
} from "../../analysis/calculators/aggregation/player-profile.calculator";

import {
  detectPlayerRole,
  createRoleDetectionInput,
} from "../../analysis/calculators/aggregation/role.calculator";

import { groupBy, mean, safePercentage, safeRate } from "../../analysis/calculators/aggregation/stats.calculator";

import {
  calculateKast,
  type RoundKastData,
} from "../../analysis/calculators/aggregation/kast.calculator";

import {
  analyzeKills,
  type KillEventData,
} from "../../analysis/calculators/aggregation/multi-kill.calculator";

import {
  calculateImpact,
  type ImpactInput,
} from "../../analysis/calculators/aggregation/impact.calculator";

import {
  type TimeWindowKey,
  getTimeWindowFilter,
  CACHE_CONFIG,
  ECONOMY_CONFIG,
  MAP_CONFIG,
} from "../aggregation.config";

// =============================================================================
// INTERNAL TYPES
// =============================================================================

/**
 * Side-specific stats (CT or T)
 */
interface SideStats {
  rounds: number;
  kills: number;
  deaths: number;
  damage: number;
  roundsWon: number;
}

/**
 * Economy breakdown by round type
 */
interface EconomyStats {
  pistol: { rounds: number; won: number };
  eco: { rounds: number; won: number };
  force: { rounds: number; won: number };
  fullBuy: { rounds: number; won: number };
}

/**
 * Complete match analysis data including KAST, kills, impact
 */
interface MatchAnalysisData {
  kast: number;
  impact: number;
  multiKills: {
    doubleKills: number;
    tripleKills: number;
    quadKills: number;
    aces: number;
  };
  specialKills: {
    wallbangKills: number;
    noscopeKills: number;
    throughSmokeKills: number;
    blindKills: number;
  };
  tradeKills: {
    tradeKills: number;
    timesTraded: number;
    tradeOpportunities: number;
  };
}

// =============================================================================
// SERVICE
// =============================================================================

@Injectable()
export class PlayerAggregationService {
  private readonly logger = new Logger(PlayerAggregationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Get or compute player aggregated profile
   */
  async getPlayerProfile(steamId: string, window: TimeWindowKey = "all_time"): Promise<AggregatedPlayerProfile> {
    this.logger.log(`Getting player profile for ${steamId} (window: ${window})`);

    // Check Redis cache first
    const cacheKey = this.getCacheKey(steamId, window);
    const cached = await this.redis.get<AggregatedPlayerProfile>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for player ${steamId}`);
      return cached;
    }

    // Compute fresh profile
    this.logger.debug(`Cache miss for player ${steamId}, computing...`);
    return this.computeAndStoreProfile(steamId, window);
  }

  /**
   * Force recompute player profile
   */
  async recomputePlayerProfile(steamId: string, window: TimeWindowKey = "all_time"): Promise<AggregatedPlayerProfile> {
    this.logger.log(`Force recomputing profile for ${steamId}`);
    return this.computeAndStoreProfile(steamId, window);
  }

  /**
   * Get multiple player profiles (batch) with Redis MGET optimization
   */
  async getPlayerProfiles(
    steamIds: readonly string[],
    window: TimeWindowKey = "all_time"
  ): Promise<Map<string, AggregatedPlayerProfile>> {
    const results = new Map<string, AggregatedPlayerProfile>();

    if (steamIds.length === 0) return results;

    // Generate cache keys
    const cacheKeys = steamIds.map((id) => this.getCacheKey(id, window));

    // Batch fetch from Redis
    const cached = await this.redis.getMany<AggregatedPlayerProfile>(cacheKeys);

    // Identify which profiles need to be computed
    const toCompute: string[] = [];
    steamIds.forEach((id, idx) => {
      const profile = cached.get(cacheKeys[idx]!);
      if (profile) {
        results.set(id, profile);
      } else {
        toCompute.push(id);
      }
    });

    this.logger.debug(
      `Batch fetch: ${steamIds.length - toCompute.length}/${steamIds.length} cache hits`
    );

    // Compute missing profiles in parallel (batched to avoid overload)
    const BATCH_SIZE = CACHE_CONFIG.PLAYER_BATCH_SIZE;
    for (let i = 0; i < toCompute.length; i += BATCH_SIZE) {
      const batch = toCompute.slice(i, i + BATCH_SIZE);
      const profiles = await Promise.all(
        batch.map((id) =>
          this.computeAndStoreProfile(id, window).catch((err) => {
            this.logger.warn(`Failed to compute profile for ${id}: ${err.message}`);
            return null;
          })
        )
      );

      batch.forEach((id, idx) => {
        const profile = profiles[idx];
        if (profile) {
          results.set(id, profile);
        }
      });
    }

    return results;
  }

  /**
   * Get peer statistics for percentile calculation.
   * Uses real aggregated data from the database.
   */
  async getPeerStats(
    minMatches = CACHE_CONFIG.MIN_MATCHES_FOR_PEER_STATS
  ): Promise<
    readonly {
      rating: number;
      kast: number;
      adr: number;
      kd: number;
      hsPercent: number;
      openingSuccessRate: number;
      clutchSuccessRate: number;
      impact: number;
      utilityDamage: number;
    }[]
  > {
    // Get players with sufficient matches and their match stats for real data
    const players = await this.prisma.player.findMany({
      where: { totalMatches: { gte: minMatches } },
      select: {
        steamId: true,
        totalKills: true,
        totalDeaths: true,
        totalDamage: true,
        totalRounds: true,
        totalHsKills: true,
        totalMatches: true,
        matchStats: {
          take: 20, // Use last 20 matches for averages
          orderBy: { demo: { playedAt: "desc" } },
          select: {
            rating: true,
            firstKills: true,
            firstDeaths: true,
            clutchesWon: true,
            clutchesPlayed: true,
            utilityDamage: true,
          },
        },
      },
    });

    return players.map((p) => {
      const matchCount = p.matchStats.length;

      // Calculate real opening success rate
      const totalFirstKills = p.matchStats.reduce((sum, m) => sum + m.firstKills, 0);
      const totalFirstDeaths = p.matchStats.reduce((sum, m) => sum + m.firstDeaths, 0);
      const totalOpeningDuels = totalFirstKills + totalFirstDeaths;
      const openingSuccessRate = totalOpeningDuels > 0
        ? safePercentage(totalFirstKills, totalOpeningDuels)
        : 50;

      // Calculate real clutch success rate
      const totalClutchWins = p.matchStats.reduce((sum, m) => sum + m.clutchesWon, 0);
      const totalClutchAttempts = p.matchStats.reduce((sum, m) => sum + m.clutchesPlayed, 0);
      const clutchSuccessRate = totalClutchAttempts > 0
        ? safePercentage(totalClutchWins, totalClutchAttempts)
        : 30;

      // Calculate average rating from matches
      const avgRating = matchCount > 0
        ? p.matchStats.reduce((sum, m) => sum + (m.rating ?? 1.0), 0) / matchCount
        : 1.0;

      // Calculate average utility damage per round
      const totalUtilityDmg = p.matchStats.reduce((sum, m) => sum + m.utilityDamage, 0);
      const avgUtilityDamage = p.totalRounds > 0
        ? safeRate(totalUtilityDmg * (p.totalMatches / Math.max(matchCount, 1)), p.totalRounds)
        : 10;

      // KAST approximation based on survival rate and K/D
      // Players with good K/D and survival tend to have higher KAST
      const kd = safeRate(p.totalKills, p.totalDeaths || 1);
      const estimatedKast = Math.min(95, Math.max(50, 65 + (kd - 1) * 10));

      // Impact approximation based on opening success and clutch rate
      const estimatedImpact = 0.7 + (openingSuccessRate / 100) * 0.4 + (clutchSuccessRate / 100) * 0.2;

      return {
        rating: Number(avgRating.toFixed(2)),
        kast: Number(estimatedKast.toFixed(1)),
        adr: Number(safeRate(p.totalDamage, p.totalRounds).toFixed(1)),
        kd: Number(kd.toFixed(2)),
        hsPercent: Number(safePercentage(p.totalHsKills, p.totalKills).toFixed(1)),
        openingSuccessRate: Number(openingSuccessRate.toFixed(1)),
        clutchSuccessRate: Number(clutchSuccessRate.toFixed(1)),
        impact: Number(estimatedImpact.toFixed(2)),
        utilityDamage: Number(avgUtilityDamage.toFixed(1)),
      };
    });
  }

  /**
   * Load player match data from database with actual round-level statistics.
   * Loads CT/T splits and economy data from RoundPlayerStats and Round tables.
   */
  private async loadPlayerMatchData(
    steamId: string,
    window: TimeWindowKey
  ): Promise<{ identity: PlayerIdentity; matches: PlayerMatchData[] }> {
    const player = await this.prisma.player.findUnique({
      where: { steamId },
      select: {
        steamId: true,
        name: true,
        avatar: true,
        faceitId: true,
        faceitElo: true,
        faceitLevel: true,
        eseaId: true,
        eseaRws: true,
      },
    });

    if (!player) {
      throw new NotFoundException(`Player not found: ${steamId}`);
    }

    // Use centralized time window configuration
    const windowFilter = getTimeWindowFilter(window);
    const matchLimit = windowFilter.matchLimit;
    const dateFilter = windowFilter.dateFilter;

    // Load match stats with demo relation
    const matchStats = await this.prisma.matchPlayerStats.findMany({
      where: {
        steamId,
        demo: {
          status: "COMPLETED",
          ...(dateFilter ? { playedAt: { gte: dateFilter } } : {}),
        },
      },
      include: {
        demo: {
          select: {
            id: true,
            mapName: true,
            playedAt: true,
            team1Score: true,
            team2Score: true,
            team1Name: true,
            team2Name: true,
          },
        },
      },
      orderBy: { demo: { playedAt: "desc" } },
      ...(matchLimit ? { take: matchLimit } : {}),
    });

    // Get demo IDs for round-level queries
    const demoIds = matchStats.map((ms) => ms.demoId);

    // Load round-level stats for accurate CT/T split
    const roundStats = await this.loadRoundLevelStats(steamId, demoIds);

    // Load economy data per demo
    const economyData = await this.loadEconomyData(steamId, demoIds);

    // Build match stats map for KAST/Impact calculation
    const matchStatsMap = new Map(
      matchStats.map((ms) => {
        const isTeam1 = ms.teamNum === 2 || ms.teamName === ms.demo.team1Name;
        const myScore = isTeam1 ? ms.demo.team1Score : ms.demo.team2Score;
        const totalRounds = ms.demo.team1Score + ms.demo.team2Score;
        return [
          ms.demoId,
          {
            kills: ms.kills,
            deaths: ms.deaths,
            roundsPlayed: totalRounds,
            roundsWon: myScore,
            openingKills: ms.firstKills,
            openingDeaths: ms.firstDeaths,
            clutchWins: ms.clutchesWon,
          },
        ];
      })
    );

    // Load KAST, Impact, Multi-kills, Special kills, Trade kills (real data!)
    const matchAnalysis = await this.loadMatchAnalysis(steamId, demoIds, matchStatsMap);

    const identity: PlayerIdentity = {
      steamId: player.steamId,
      displayName: player.name,
      aliases: [],
      avatar: player.avatar,
      externalIds: {
        faceitId: player.faceitId,
        faceitElo: player.faceitElo,
        faceitLevel: player.faceitLevel,
        eseaId: player.eseaId,
        eseaRws: player.eseaRws,
      },
    };

    const matches: PlayerMatchData[] = matchStats
      .filter((ms) => ms.demo.playedAt !== null)
      .map((ms) => {
        const isTeam1 = ms.teamNum === 2 || ms.teamName === ms.demo.team1Name;
        const myScore = isTeam1 ? ms.demo.team1Score : ms.demo.team2Score;
        const oppScore = isTeam1 ? ms.demo.team2Score : ms.demo.team1Score;
        const won = myScore > oppScore;
        const draw = myScore === oppScore;
        const totalRounds = myScore + oppScore;

        // Get actual round-level stats (or use approximations with config values)
        const demoRoundStats = roundStats.get(ms.demoId);
        const demoEconomy = economyData.get(ms.demoId);

        // Get match analysis (KAST, Impact, Multi-kills, Special kills, Trades)
        const analysis = matchAnalysis.get(ms.demoId);

        // CT/T split from actual data or balanced approximation
        const ctStats = demoRoundStats?.ct ?? this.approximateCtStats(ms.kills, ms.deaths, ms.damage, totalRounds, myScore);
        const tStats = demoRoundStats?.t ?? this.approximateTStats(ms.kills, ms.deaths, ms.damage, totalRounds, myScore);

        // Economy from actual data or config-based approximation
        const economy = demoEconomy ?? this.approximateEconomy(totalRounds, myScore);

        return {
          demoId: ms.demoId,
          playedAt: ms.demo.playedAt!,
          mapName: ms.demo.mapName,
          won,
          draw,
          kills: ms.kills,
          deaths: ms.deaths,
          assists: ms.assists,
          damage: ms.damage,
          headshotKills: ms.headshotKills,
          mvps: ms.mvps,
          roundsPlayed: totalRounds,
          roundsWon: myScore,
          rating: ms.rating ?? 1.0,
          kast: analysis?.kast ?? 70, // Real KAST from round data
          impact: analysis?.impact ?? 0.8, // Real Impact from kill analysis
          ctRounds: ctStats.rounds,
          ctKills: ctStats.kills,
          ctDeaths: ctStats.deaths,
          ctDamage: ctStats.damage,
          ctRoundsWon: ctStats.roundsWon,
          tRounds: tStats.rounds,
          tKills: tStats.kills,
          tDeaths: tStats.deaths,
          tDamage: tStats.damage,
          tRoundsWon: tStats.roundsWon,
          doubleKills: analysis?.multiKills.doubleKills ?? 0,
          tripleKills: analysis?.multiKills.tripleKills ?? 0,
          quadKills: analysis?.multiKills.quadKills ?? 0,
          aces: analysis?.multiKills.aces ?? 0,
          wallbangKills: analysis?.specialKills.wallbangKills ?? 0,
          noscopeKills: analysis?.specialKills.noscopeKills ?? 0,
          throughSmokeKills: analysis?.specialKills.throughSmokeKills ?? 0,
          blindKills: analysis?.specialKills.blindKills ?? 0,
          tradeKills: analysis?.tradeKills.tradeKills ?? 0,
          timesTraded: analysis?.tradeKills.timesTraded ?? 0,
          tradeOpportunities: analysis?.tradeKills.tradeOpportunities ?? ms.deaths,
          openingKills: ms.firstKills,
          openingDeaths: ms.firstDeaths,
          openingAttempts: ms.firstKills + ms.firstDeaths,
          clutchAttempts: ms.clutchesPlayed,
          clutchWins: ms.clutchesWon,
          clutchVs1Attempts: 0,
          clutchVs1Wins: 0,
          clutchVs2Attempts: 0,
          clutchVs2Wins: 0,
          clutchVs3Attempts: 0,
          clutchVs3Wins: 0,
          clutchVs4Attempts: 0,
          clutchVs4Wins: 0,
          clutchVs5Attempts: 0,
          clutchVs5Wins: 0,
          flashesThrown: 0,
          enemiesFlashed: ms.enemiesFlashed,
          flashAssists: ms.flashAssists,
          heGrenadesThrown: 0,
          heDamage: 0,
          smokesThrown: 0,
          molotovsThrown: 0,
          molotovDamage: 0,
          utilityDamage: ms.utilityDamage,
          avgEquipValue: ms.avgEquipValue,
          totalSpent: ms.totalCashSpent,
          pistolRounds: economy.pistol.rounds,
          pistolRoundsWon: economy.pistol.won,
          ecoRounds: economy.eco.rounds,
          ecoRoundsWon: economy.eco.won,
          forceRounds: economy.force.rounds,
          forceRoundsWon: economy.force.won,
          fullBuyRounds: economy.fullBuy.rounds,
          fullBuyRoundsWon: economy.fullBuy.won,
          awpRounds: 0,
          awpKills: 0,
        };
      });

    return { identity, matches };
  }

  /**
   * Load round-level stats aggregated by side (CT/T) for each demo
   */
  private async loadRoundLevelStats(
    steamId: string,
    demoIds: string[]
  ): Promise<Map<string, { ct: SideStats; t: SideStats }>> {
    if (demoIds.length === 0) return new Map();

    const roundStats = await this.prisma.roundPlayerStats.findMany({
      where: {
        steamId,
        round: { demoId: { in: demoIds } },
      },
      include: {
        round: {
          select: {
            demoId: true,
            winnerTeam: true,
          },
        },
      },
    });

    // Aggregate by demo and side (teamNum: 3=CT, 2=T)
    const result = new Map<string, { ct: SideStats; t: SideStats }>();

    for (const demoId of demoIds) {
      const demoRounds = roundStats.filter((rs) => rs.round.demoId === demoId);

      const ctRounds = demoRounds.filter((rs) => rs.teamNum === 3);
      const tRounds = demoRounds.filter((rs) => rs.teamNum === 2);

      result.set(demoId, {
        ct: {
          rounds: ctRounds.length,
          kills: ctRounds.reduce((sum, r) => sum + r.kills, 0),
          deaths: ctRounds.reduce((sum, r) => sum + r.deaths, 0),
          damage: ctRounds.reduce((sum, r) => sum + r.damage, 0),
          roundsWon: ctRounds.filter((r) => r.round.winnerTeam === 3).length,
        },
        t: {
          rounds: tRounds.length,
          kills: tRounds.reduce((sum, r) => sum + r.kills, 0),
          deaths: tRounds.reduce((sum, r) => sum + r.deaths, 0),
          damage: tRounds.reduce((sum, r) => sum + r.damage, 0),
          roundsWon: tRounds.filter((r) => r.round.winnerTeam === 2).length,
        },
      });
    }

    return result;
  }

  /**
   * Load economy data (round types) per demo
   */
  private async loadEconomyData(
    steamId: string,
    demoIds: string[]
  ): Promise<Map<string, EconomyStats>> {
    if (demoIds.length === 0) return new Map();

    // Get rounds with their types and player participation
    const roundData = await this.prisma.round.findMany({
      where: { demoId: { in: demoIds } },
      select: {
        demoId: true,
        roundType: true,
        winnerTeam: true,
        playerStats: {
          where: { steamId },
          select: { teamNum: true },
        },
      },
    });

    const result = new Map<string, EconomyStats>();

    for (const demoId of demoIds) {
      const demoRounds = roundData.filter((r) => r.demoId === demoId);

      const stats: EconomyStats = {
        pistol: { rounds: 0, won: 0 },
        eco: { rounds: 0, won: 0 },
        force: { rounds: 0, won: 0 },
        fullBuy: { rounds: 0, won: 0 },
      };

      for (const round of demoRounds) {
        const playerTeam = round.playerStats[0]?.teamNum;
        const won = playerTeam !== undefined && round.winnerTeam === playerTeam;

        switch (round.roundType) {
          case "PISTOL":
            stats.pistol.rounds++;
            if (won) stats.pistol.won++;
            break;
          case "ECO":
            stats.eco.rounds++;
            if (won) stats.eco.won++;
            break;
          case "FORCE_BUY":
            stats.force.rounds++;
            if (won) stats.force.won++;
            break;
          case "FULL_BUY":
            stats.fullBuy.rounds++;
            if (won) stats.fullBuy.won++;
            break;
          default:
            // UNKNOWN rounds counted as full buy (conservative estimate)
            stats.fullBuy.rounds++;
            if (won) stats.fullBuy.won++;
        }
      }

      result.set(demoId, stats);
    }

    return result;
  }

  /**
   * Approximate CT stats when round-level data is unavailable.
   * Uses balanced 50/50 split as fallback.
   */
  private approximateCtStats(
    kills: number,
    deaths: number,
    damage: number,
    totalRounds: number,
    roundsWon: number
  ): SideStats {
    // Standard MR12: 12 rounds per half (approximation)
    const ctRounds = Math.min(totalRounds, MAP_CONFIG.ROUNDS_PER_HALF);
    const ratio = ctRounds / totalRounds;

    return {
      rounds: ctRounds,
      kills: Math.round(kills * ratio),
      deaths: Math.round(deaths * ratio),
      damage: Math.round(damage * ratio),
      roundsWon: Math.round(roundsWon * ratio),
    };
  }

  /**
   * Approximate T stats when round-level data is unavailable.
   */
  private approximateTStats(
    kills: number,
    deaths: number,
    damage: number,
    totalRounds: number,
    roundsWon: number
  ): SideStats {
    const tRounds = Math.max(0, totalRounds - MAP_CONFIG.ROUNDS_PER_HALF);
    const ratio = tRounds / totalRounds;

    return {
      rounds: tRounds,
      kills: Math.round(kills * ratio),
      deaths: Math.round(deaths * ratio),
      damage: Math.round(damage * ratio),
      roundsWon: Math.round(roundsWon * ratio),
    };
  }

  /**
   * Approximate economy breakdown when round-level data is unavailable.
   * Uses configurable distribution from ECONOMY_CONFIG.
   */
  private approximateEconomy(totalRounds: number, roundsWon: number): EconomyStats {
    const dist = ECONOMY_CONFIG.DEFAULT_ROUND_DISTRIBUTION;
    const winRates = ECONOMY_CONFIG.EXPECTED_WIN_RATES;

    return {
      pistol: {
        rounds: MAP_CONFIG.PISTOL_ROUNDS_PER_GAME,
        won: Math.round(MAP_CONFIG.PISTOL_ROUNDS_PER_GAME * winRates.pistol),
      },
      eco: {
        rounds: Math.round(totalRounds * dist.eco),
        won: Math.round(totalRounds * dist.eco * winRates.eco),
      },
      force: {
        rounds: Math.round(totalRounds * dist.force),
        won: Math.round(totalRounds * dist.force * winRates.force),
      },
      fullBuy: {
        rounds: Math.round(totalRounds * dist.fullBuy),
        won: Math.round(roundsWon * 0.65), // Full buys account for ~65% of won rounds
      },
    };
  }

  // ===========================================================================
  // MATCH ANALYSIS (KAST + Kill Analysis + Impact)
  // ===========================================================================

  /**
   * Load complete match analysis (KAST + Impact + Multi-kills) for demos.
   * OPTIMIZED: Runs RoundPlayerStats and Kill queries in parallel.
   */
  private async loadMatchAnalysis(
    steamId: string,
    demoIds: string[],
    matchStatsMap: Map<string, { kills: number; deaths: number; roundsPlayed: number; roundsWon: number; openingKills: number; openingDeaths: number; clutchWins: number }>
  ): Promise<Map<string, MatchAnalysisData>> {
    if (demoIds.length === 0) return new Map();

    // Run both queries in parallel for better performance
    const [roundStats, kills] = await Promise.all([
      // Query 1: Round player stats for KAST (kills, assists, survived)
      this.prisma.roundPlayerStats.findMany({
        where: {
          steamId,
          round: { demoId: { in: demoIds } },
        },
        select: {
          kills: true,
          assists: true,
          survived: true,
          roundId: true,
          round: { select: { demoId: true } },
        },
      }),
      // Query 2: All kills (combined query for KAST trades + kill analysis)
      this.prisma.kill.findMany({
        where: {
          demoId: { in: demoIds },
          OR: [
            { attackerSteamId: steamId },
            { victimSteamId: steamId },
          ],
        },
        select: {
          demoId: true,
          roundId: true,
          tick: true,
          attackerSteamId: true,
          victimSteamId: true,
          headshot: true,
          penetrated: true,
          noscope: true,
          thrusmoke: true,
          attackerblind: true,
          weapon: true,
          isTradeKill: true,
        },
      }),
    ]);

    // Build trade lookup for KAST: roundId -> wasTraded
    const tradeByRound = new Map<string, boolean>();
    const deathsByDemo = new Map<string, number>();
    for (const kill of kills) {
      if (kill.victimSteamId === steamId) {
        if (kill.isTradeKill) {
          tradeByRound.set(kill.roundId, true);
        }
        const count = deathsByDemo.get(kill.demoId) ?? 0;
        deathsByDemo.set(kill.demoId, count + 1);
      }
    }

    const result = new Map<string, MatchAnalysisData>();

    for (const demoId of demoIds) {
      // Build KAST data from round stats
      const demoRounds = roundStats.filter((rs) => rs.round.demoId === demoId);
      const kastData: RoundKastData[] = demoRounds.map((rs) => ({
        roundId: rs.roundId,
        kills: rs.kills,
        assists: rs.assists,
        survived: rs.survived,
        wasTraded: tradeByRound.get(rs.roundId) ?? false,
      }));
      const kastResult = calculateKast(kastData);

      // Build kill analysis data
      const demoKills: KillEventData[] = kills
        .filter((k) => k.demoId === demoId)
        .map((k) => ({
          roundId: k.roundId,
          tick: k.tick,
          attackerSteamId: k.attackerSteamId,
          victimSteamId: k.victimSteamId,
          headshot: k.headshot,
          penetrated: k.penetrated,
          noscope: k.noscope,
          thrusmoke: k.thrusmoke,
          attackerblind: k.attackerblind,
          weapon: k.weapon,
          isTradeKill: k.isTradeKill,
        }));
      const deaths = deathsByDemo.get(demoId) ?? 0;
      const killAnalysis = analyzeKills(demoKills, steamId, deaths);

      // Calculate Impact
      const matchStats = matchStatsMap.get(demoId);
      const impactInput: ImpactInput = {
        kills: matchStats?.kills ?? 0,
        deaths: matchStats?.deaths ?? 0,
        roundsPlayed: matchStats?.roundsPlayed ?? 0,
        roundsWon: matchStats?.roundsWon ?? 0,
        openingKills: matchStats?.openingKills ?? 0,
        openingDeaths: matchStats?.openingDeaths ?? 0,
        doubleKills: killAnalysis.multiKills.doubleKills,
        tripleKills: killAnalysis.multiKills.tripleKills,
        quadKills: killAnalysis.multiKills.quadKills,
        aces: killAnalysis.multiKills.aces,
        clutchWins: matchStats?.clutchWins ?? 0,
        tradeKills: killAnalysis.tradeKills.tradeKills,
      };
      const impactResult = calculateImpact(impactInput);

      result.set(demoId, {
        kast: kastResult.kast,
        impact: impactResult.impact,
        multiKills: killAnalysis.multiKills,
        specialKills: killAnalysis.specialKills,
        tradeKills: {
          tradeKills: killAnalysis.tradeKills.tradeKills,
          timesTraded: killAnalysis.tradeKills.timesTraded,
          tradeOpportunities: killAnalysis.tradeKills.tradeOpportunities,
        },
      });
    }

    return result;
  }

  /**
   * Compute and store player profile
   */
  private async computeAndStoreProfile(steamId: string, window: TimeWindowKey): Promise<AggregatedPlayerProfile> {
    const startTime = Date.now();
    const { identity, matches } = await this.loadPlayerMatchData(steamId, window);

    if (matches.length === 0) {
      throw new NotFoundException(`No matches found for player ${steamId} in window ${window}`);
    }

    const peerStats = await this.getPeerStats();
    const baseProfile = aggregatePlayerProfile(identity, matches, peerStats, window);

    // Compute map-specific stats
    const byMap = this.computeMapStats(matches);

    // Compute role
    const roleInput = createRoleDetectionInput(matches);
    const role = detectPlayerRole(roleInput, baseProfile.combat.hsPercent);

    const profile: AggregatedPlayerProfile = {
      ...baseProfile,
      byMap,
      weapons: {
        primary: [],
        pistols: [],
        awp: null,
        preferences: { rifle: "ak47", smg: null, pistol: null, sniper: "none" },
      },
      role,
    };

    // Cache in Redis
    const cacheKey = this.getCacheKey(steamId, window);
    await this.redis.set(cacheKey, profile, CACHE_CONFIG.PLAYER_PROFILE_TTL_MS);

    const duration = Date.now() - startTime;
    this.logger.log(`Computed profile for ${steamId} in ${duration}ms (${matches.length} matches)`);

    return profile;
  }

  /**
   * Compute map-specific statistics
   */
  private computeMapStats(matches: readonly PlayerMatchData[]): AggregatedPlayerProfile["byMap"] {
    const mapGroups = groupBy(matches, (m) => m.mapName);
    type MapStats = AggregatedPlayerProfile["byMap"][number];
    const results: MapStats[] = [];

    for (const [mapName, mapMatches] of Object.entries(mapGroups)) {
      const wins = mapMatches.filter((m) => m.won).length;
      const losses = mapMatches.filter((m) => !m.won && !m.draw).length;
      const draws = mapMatches.filter((m) => m.draw).length;
      const totalKills = mapMatches.reduce((sum, m) => sum + m.kills, 0);
      const totalDeaths = mapMatches.reduce((sum, m) => sum + m.deaths, 0);
      const totalDamage = mapMatches.reduce((sum, m) => sum + m.damage, 0);
      const totalRounds = mapMatches.reduce((sum, m) => sum + m.roundsPlayed, 0);
      const totalHeadshots = mapMatches.reduce((sum, m) => sum + m.headshotKills, 0);
      const avgRating = mean(mapMatches.map((m) => m.rating));
      const avgKast = mean(mapMatches.map((m) => m.kast));
      const ctWinRate = safePercentage(
        mapMatches.reduce((sum, m) => sum + m.ctRoundsWon, 0),
        mapMatches.reduce((sum, m) => sum + m.ctRounds, 0)
      );
      const tWinRate = safePercentage(
        mapMatches.reduce((sum, m) => sum + m.tRoundsWon, 0),
        mapMatches.reduce((sum, m) => sum + m.tRounds, 0)
      );

      results.push({
        mapName,
        matchesPlayed: mapMatches.length,
        roundsPlayed: totalRounds,
        record: {
          wins,
          losses,
          draws,
          winRate: safePercentage(wins, mapMatches.length),
        },
        performance: {
          avgRating: Number(avgRating.toFixed(2)),
          avgKast: Number(avgKast.toFixed(1)),
          adr: Number(safeRate(totalDamage, totalRounds).toFixed(1)),
          kdRatio: Number(safeRate(totalKills, totalDeaths || 1).toFixed(2)),
          hsPercent: Number(safePercentage(totalHeadshots, totalKills).toFixed(1)),
        },
        sides: {
          ctWinRate: Number(ctWinRate.toFixed(1)),
          tWinRate: Number(tWinRate.toFixed(1)),
          preferredSide: Math.abs(ctWinRate - tWinRate) < 5 ? "balanced" : ctWinRate > tWinRate ? "CT" : "T",
        },
        positions: { strongestPosition: null, weakestPosition: null },
      });
    }

    results.sort((a: MapStats, b: MapStats) => b.matchesPlayed - a.matchesPlayed);
    return results;
  }

  /**
   * Generate cache key for a player profile
   */
  private getCacheKey(steamId: string, window: TimeWindowKey): string {
    return `aggregation:player:${steamId}:${window}`;
  }

  /**
   * Invalidate player profile cache
   */
  async invalidatePlayerCache(steamId: string): Promise<void> {
    const pattern = `aggregation:player:${steamId}:*`;
    const deleted = await this.redis.deletePattern(pattern);
    this.logger.debug(`Invalidated ${deleted} cache entries for player ${steamId}`);
  }
}
