/**
 * Metrics Data Service - Database to Calculator Input Transformer
 *
 * This service is the bridge between Prisma database models and
 * pure calculator functions. It handles:
 * - Fetching data from the database
 * - Transforming Prisma models to calculator input types
 * - Optimized queries with proper indexes and relations
 *
 * Design principles:
 * - Single responsibility: only data fetching and transformation
 * - No business logic calculations (that's for calculators)
 * - Optimized queries (select only needed fields, batch operations)
 *
 * @module analysis/services/metrics-data
 */

import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../common/prisma";
import { DemoStatus } from "@prisma/client";
import type {
  KillInput,
  RoundPlayerStatsInput,
  GrenadeInput,
  MatchPlayerInput,
  RoundInput,
} from "../types/inputs.types";
import type { RoundEconomyType } from "../types/economy.types";
import { DemoNotFoundError, DemoNotParsedError } from "../utils/errors";

/**
 * Raw demo data structure for full match analysis
 */
export interface DemoMatchData {
  /** Demo ID */
  readonly demoId: string;

  /** Demo metadata */
  readonly metadata: {
    readonly mapName: string;
    readonly tickRate: number;
    readonly totalTicks: number;
    readonly durationSeconds: number;
    readonly team1Name: string;
    readonly team2Name: string;
    readonly team1Score: number;
    readonly team2Score: number;
    readonly gameMode: string;
  };

  /** All players in the match */
  readonly players: readonly MatchPlayerInput[];

  /** All rounds */
  readonly rounds: readonly RoundInput[];

  /** All kills */
  readonly kills: readonly KillInput[];

  /** All grenades */
  readonly grenades: readonly GrenadeInput[];

  /** Per-round player stats */
  readonly roundPlayerStats: readonly RoundPlayerStatsInput[];

  /** Helper maps for quick lookups */
  readonly lookups: {
    /** Player name by Steam ID */
    readonly playerNames: ReadonlyMap<string, string>;
    /** Player team by Steam ID */
    readonly playerTeams: ReadonlyMap<string, number>;
    /** Round winner (team number) by round number */
    readonly roundWinners: ReadonlyMap<number, number>;
    /** Round start tick by round number */
    readonly roundStartTicks: ReadonlyMap<number, number>;
    /** Round type by round number */
    readonly roundTypes: ReadonlyMap<number, RoundEconomyType>;
    /** Round ID by round number */
    readonly roundIds: ReadonlyMap<number, string>;
  };
}

/**
 * Player-specific data for individual analysis
 */
export interface PlayerMatchData {
  /** Player's Steam ID */
  readonly steamId: string;

  /** Player's name */
  readonly name: string;

  /** Player's team number (2=T, 3=CT) */
  readonly teamNum: number;

  /** Match stats for this player */
  readonly matchStats: MatchPlayerInput;

  /** Round stats for this player */
  readonly roundStats: readonly RoundPlayerStatsInput[];

  /** Kills made by this player */
  readonly kills: readonly KillInput[];

  /** Deaths of this player */
  readonly deaths: readonly KillInput[];

  /** Assists by this player */
  readonly assists: readonly KillInput[];

  /** Grenades thrown by this player */
  readonly grenades: readonly GrenadeInput[];
}

@Injectable()
export class MetricsDataService {
  // Logger available for debugging - uncomment when needed
  // private readonly logger = new Logger(MetricsDataService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetch all data needed for full match analysis
   *
   * This is an optimized query that fetches all related data in parallel
   * to minimize database round trips.
   *
   * @param demoId - The demo ID to fetch
   * @returns Complete match data ready for calculators
   */
  async getFullMatchData(demoId: string): Promise<DemoMatchData> {
    // First, verify demo exists and is parsed
    const demo = await this.prisma.demo.findUnique({
      where: { id: demoId },
      select: {
        id: true,
        status: true,
        mapName: true,
        tickRate: true,
        totalTicks: true,
        durationSeconds: true,
        team1Name: true,
        team2Name: true,
        team1Score: true,
        team2Score: true,
        gameMode: true,
      },
    });

    if (!demo) {
      throw new DemoNotFoundError(demoId);
    }

    if (
      demo.status !== DemoStatus.COMPLETED &&
      demo.status !== DemoStatus.PARSED
    ) {
      throw new DemoNotParsedError(demoId, demo.status);
    }

    // Fetch all related data in parallel for performance
    const [players, rounds, kills, grenades, roundPlayerStatsRaw] =
      await Promise.all([
        this.fetchPlayers(demoId),
        this.fetchRounds(demoId),
        this.fetchKills(demoId),
        this.fetchGrenades(demoId),
        this.fetchRoundPlayerStats(demoId),
      ]);

    // Build lookup maps
    const lookups = this.buildLookupMaps(players, rounds);

    // Transform round player stats with round numbers
    const roundPlayerStats = this.transformRoundPlayerStats(
      roundPlayerStatsRaw,
      lookups.roundIds,
    );

    return {
      demoId: demo.id,
      metadata: {
        mapName: demo.mapName,
        tickRate: demo.tickRate,
        totalTicks: demo.totalTicks,
        durationSeconds: demo.durationSeconds,
        team1Name: demo.team1Name,
        team2Name: demo.team2Name,
        team1Score: demo.team1Score,
        team2Score: demo.team2Score,
        gameMode: demo.gameMode,
      },
      players,
      rounds,
      kills,
      grenades,
      roundPlayerStats,
      lookups,
    };
  }

  /**
   * Fetch data for a specific player in a match
   *
   * @param demoId - The demo ID
   * @param steamId - The player's Steam ID
   * @returns Player-specific match data
   */
  async getPlayerMatchData(
    demoId: string,
    steamId: string,
  ): Promise<PlayerMatchData> {
    // Verify demo exists
    const demo = await this.prisma.demo.findUnique({
      where: { id: demoId },
      select: { id: true, status: true },
    });

    if (!demo) {
      throw new DemoNotFoundError(demoId);
    }

    if (
      demo.status !== DemoStatus.COMPLETED &&
      demo.status !== DemoStatus.PARSED
    ) {
      throw new DemoNotParsedError(demoId, demo.status);
    }

    // Fetch player's match stats
    const matchStats = await this.prisma.matchPlayerStats.findUnique({
      where: { demoId_steamId: { demoId, steamId } },
    });

    if (!matchStats) {
      throw new NotFoundException(
        `Player ${steamId} not found in demo ${demoId}`,
      );
    }

    // Fetch all player-specific data in parallel
    const [roundStatsRaw, kills, deaths, assists, grenades, rounds] =
      await Promise.all([
        this.prisma.roundPlayerStats.findMany({
          where: {
            round: { demoId },
            steamId,
          },
          include: { round: { select: { roundNumber: true } } },
        }),
        this.prisma.kill.findMany({
          where: { demoId, attackerSteamId: steamId },
          orderBy: { tick: "asc" },
        }),
        this.prisma.kill.findMany({
          where: { demoId, victimSteamId: steamId },
          orderBy: { tick: "asc" },
        }),
        this.prisma.kill.findMany({
          where: { demoId, assisterSteamId: steamId },
          orderBy: { tick: "asc" },
        }),
        this.prisma.grenade.findMany({
          where: { demoId, throwerSteamId: steamId },
          orderBy: { tick: "asc" },
        }),
        this.prisma.round.findMany({
          where: { demoId },
          select: { id: true, roundNumber: true },
        }),
      ]);

    // Build round number lookup
    const roundNumById = new Map(rounds.map((r) => [r.id, r.roundNumber]));

    // Transform round stats
    const roundStats: RoundPlayerStatsInput[] = roundStatsRaw.map((r) => ({
      roundNumber: r.round.roundNumber,
      steamId: r.steamId,
      teamNum: r.teamNum,
      kills: r.kills,
      deaths: r.deaths,
      assists: r.assists,
      damage: r.damage,
      equipValue: r.equipValue,
      moneySpent: r.moneySpent,
      startBalance: r.startBalance,
      survived: r.survived,
      firstKill: r.firstKill,
      firstDeath: r.firstDeath,
      clutchVs: r.clutchVs,
      clutchWon: r.clutchWon,
    }));

    return {
      steamId,
      name: matchStats.playerName,
      teamNum: matchStats.teamNum,
      matchStats: this.transformMatchPlayerStats(matchStats),
      roundStats,
      kills: this.transformKills(kills, roundNumById),
      deaths: this.transformKills(deaths, roundNumById),
      assists: this.transformKills(assists, roundNumById),
      grenades: this.transformGrenades(grenades, roundNumById),
    };
  }

  /**
   * Fetch aggregated team equipment values by round
   *
   * @param demoId - The demo ID
   * @param teamNum - Team number (2=T, 3=CT)
   * @returns Map of round number to total team equipment value
   */
  async getTeamEquipByRound(
    demoId: string,
    teamNum: number,
  ): Promise<ReadonlyMap<number, number>> {
    const roundStats = await this.prisma.roundPlayerStats.findMany({
      where: {
        round: { demoId },
        teamNum,
      },
      select: {
        equipValue: true,
        round: { select: { roundNumber: true } },
      },
    });

    // Aggregate by round
    const equipByRound = new Map<number, number>();
    for (const stat of roundStats) {
      const current = equipByRound.get(stat.round.roundNumber) || 0;
      equipByRound.set(stat.round.roundNumber, current + stat.equipValue);
    }

    return equipByRound;
  }

  /**
   * Get all Steam IDs for players in a match
   */
  async getPlayerSteamIds(demoId: string): Promise<string[]> {
    const players = await this.prisma.matchPlayerStats.findMany({
      where: { demoId },
      select: { steamId: true },
    });
    return players.map((p) => p.steamId);
  }

  /**
   * Get players grouped by team
   */
  async getPlayersByTeam(
    demoId: string,
  ): Promise<{ team2: MatchPlayerInput[]; team3: MatchPlayerInput[] }> {
    const players = await this.fetchPlayers(demoId);

    return {
      team2: players.filter((p) => p.teamNum === 2) as MatchPlayerInput[],
      team3: players.filter((p) => p.teamNum === 3) as MatchPlayerInput[],
    };
  }

  // ===========================================================================
  // PRIVATE FETCH METHODS
  // ===========================================================================

  private async fetchPlayers(demoId: string): Promise<MatchPlayerInput[]> {
    const players = await this.prisma.matchPlayerStats.findMany({
      where: { demoId },
      orderBy: { teamNum: "asc" },
    });

    return players.map(this.transformMatchPlayerStats);
  }

  private async fetchRounds(demoId: string): Promise<RoundInput[]> {
    const rounds = await this.prisma.round.findMany({
      where: { demoId },
      orderBy: { roundNumber: "asc" },
    });

    return rounds.map((r) => {
      const round: RoundInput = {
        id: r.id,
        roundNumber: r.roundNumber,
        startTick: r.startTick,
        endTick: r.endTick,
        winnerTeam: r.winnerTeam,
        winReason: r.winReason,
        winReasonCode: r.winReasonCode,
        ctScore: r.ctScore,
        tScore: r.tScore,
        ctEquipValue: r.ctEquipValue,
        tEquipValue: r.tEquipValue,
        ctMoneySpent: r.ctMoneySpent,
        tMoneySpent: r.tMoneySpent,
        roundType: r.roundType,
        bombPlanted: r.bombPlanted,
        bombDefused: r.bombDefused,
        bombExploded: r.bombExploded,
        ...(r.freezeEndTick !== null && { freezeEndTick: r.freezeEndTick }),
        ...(r.bombPlantTick !== null && { bombPlantTick: r.bombPlantTick }),
        ...(r.bombSite !== null && { bombSite: r.bombSite }),
        ...(r.mvpSteamId !== null && { mvpSteamId: r.mvpSteamId }),
        ...(r.mvpReason !== null && { mvpReason: r.mvpReason }),
      };
      return round;
    });
  }

  private async fetchKills(demoId: string): Promise<KillInput[]> {
    const kills = await this.prisma.kill.findMany({
      where: { demoId },
      include: {
        round: { select: { roundNumber: true } },
      },
      orderBy: { tick: "asc" },
    });

    return kills.map((k) => ({
      tick: k.tick,
      roundNumber: k.round.roundNumber,
      attackerSteamId: k.attackerSteamId,
      attackerTeam: k.attackerTeam,
      victimSteamId: k.victimSteamId,
      victimTeam: k.victimTeam,
      weapon: k.weapon,
      headshot: k.headshot,
      penetrated: k.penetrated,
      noscope: k.noscope,
      thrusmoke: k.thrusmoke,
      attackerblind: k.attackerblind,
      assistedflash: k.assistedflash,
      distance: k.distance,
      isSuicide: k.isSuicide,
      isTeamkill: k.isTeamkill,
      isFirstKill: k.isFirstKill,
      isTradeKill: k.isTradeKill,
      tradedWithin: k.tradedWithin,
      assisterSteamId: k.assisterSteamId,
    }));
  }

  private async fetchGrenades(demoId: string): Promise<GrenadeInput[]> {
    const grenades = await this.prisma.grenade.findMany({
      where: { demoId },
      include: {
        round: { select: { roundNumber: true } },
      },
      orderBy: { tick: "asc" },
    });

    return grenades.map((g) => ({
      type: g.type,
      tick: g.tick,
      roundNumber: g.round.roundNumber,
      x: g.x,
      y: g.y,
      z: g.z,
      throwerSteamId: g.throwerSteamId,
      throwerTeam: g.throwerTeam,
      enemiesBlinded: g.enemiesBlinded,
      teammatesBlinded: g.teammatesBlinded,
      totalBlindDuration: g.totalBlindDuration,
      damageDealt: g.damageDealt,
      enemiesDamaged: g.enemiesDamaged,
    }));
  }

  private async fetchRoundPlayerStats(demoId: string): Promise<
    Array<{
      roundId: string;
      steamId: string;
      teamNum: number;
      kills: number;
      deaths: number;
      assists: number;
      damage: number;
      equipValue: number;
      moneySpent: number;
      startBalance: number;
      survived: boolean;
      firstKill: boolean;
      firstDeath: boolean;
      clutchVs: number | null;
      clutchWon: boolean | null;
    }>
  > {
    return this.prisma.roundPlayerStats.findMany({
      where: { round: { demoId } },
      select: {
        roundId: true,
        steamId: true,
        teamNum: true,
        kills: true,
        deaths: true,
        assists: true,
        damage: true,
        equipValue: true,
        moneySpent: true,
        startBalance: true,
        survived: true,
        firstKill: true,
        firstDeath: true,
        clutchVs: true,
        clutchWon: true,
      },
    });
  }

  // ===========================================================================
  // TRANSFORMATION HELPERS
  // ===========================================================================

  private transformMatchPlayerStats(p: {
    steamId: string;
    playerName: string;
    teamNum: number;
    teamName: string | null;
    kills: number;
    deaths: number;
    assists: number;
    headshotKills: number;
    damage: number;
    kd: number;
    adr: number;
    hsp: number;
    rating: number | null;
    totalCashSpent: number;
    avgEquipValue: number;
    mvps: number;
    score: number;
    firstKills: number;
    firstDeaths: number;
    clutchesWon: number;
    clutchesPlayed: number;
    enemiesFlashed: number;
    flashAssists: number;
    utilityDamage: number;
  }): MatchPlayerInput {
    const base = {
      steamId: p.steamId,
      name: p.playerName,
      teamNum: p.teamNum,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      headshotKills: p.headshotKills,
      damage: p.damage,
      kd: p.kd,
      adr: p.adr,
      hsp: p.hsp,
      totalCashSpent: p.totalCashSpent,
      avgEquipValue: p.avgEquipValue,
      mvps: p.mvps,
      score: p.score,
      firstKills: p.firstKills,
      firstDeaths: p.firstDeaths,
      clutchesWon: p.clutchesWon,
      clutchesPlayed: p.clutchesPlayed,
      enemiesFlashed: p.enemiesFlashed,
      flashAssists: p.flashAssists,
      utilityDamage: p.utilityDamage,
    };

    return {
      ...base,
      ...(p.teamName !== null && { teamName: p.teamName }),
      ...(p.rating !== null && { rating: p.rating }),
    };
  }

  private transformKills(
    kills: Array<{
      tick: number;
      roundId: string;
      attackerSteamId: string | null;
      attackerTeam: number | null;
      victimSteamId: string;
      victimTeam: number;
      weapon: string;
      headshot: boolean;
      penetrated: number;
      noscope: boolean;
      thrusmoke: boolean;
      attackerblind: boolean;
      assistedflash: boolean;
      distance: number | null;
      isSuicide: boolean;
      isTeamkill: boolean;
      isFirstKill: boolean;
      isTradeKill: boolean;
      tradedWithin: number | null;
      assisterSteamId: string | null;
    }>,
    roundNumById: Map<string, number>,
  ): KillInput[] {
    return kills.map((k) => ({
      tick: k.tick,
      roundNumber: roundNumById.get(k.roundId) ?? 0,
      attackerSteamId: k.attackerSteamId,
      attackerTeam: k.attackerTeam,
      victimSteamId: k.victimSteamId,
      victimTeam: k.victimTeam,
      weapon: k.weapon,
      headshot: k.headshot,
      penetrated: k.penetrated,
      noscope: k.noscope,
      thrusmoke: k.thrusmoke,
      attackerblind: k.attackerblind,
      assistedflash: k.assistedflash,
      distance: k.distance,
      isSuicide: k.isSuicide,
      isTeamkill: k.isTeamkill,
      isFirstKill: k.isFirstKill,
      isTradeKill: k.isTradeKill,
      tradedWithin: k.tradedWithin,
      assisterSteamId: k.assisterSteamId,
    }));
  }

  private transformGrenades(
    grenades: Array<{
      type: string;
      tick: number;
      roundId: string;
      x: number;
      y: number;
      z: number;
      throwerSteamId: string;
      throwerTeam: number;
      enemiesBlinded: number;
      teammatesBlinded: number;
      totalBlindDuration: number;
      damageDealt: number;
      enemiesDamaged: number;
    }>,
    roundNumById: Map<string, number>,
  ): GrenadeInput[] {
    return grenades.map((g) => ({
      type: g.type,
      tick: g.tick,
      roundNumber: roundNumById.get(g.roundId) ?? 0,
      x: g.x,
      y: g.y,
      z: g.z,
      throwerSteamId: g.throwerSteamId,
      throwerTeam: g.throwerTeam,
      enemiesBlinded: g.enemiesBlinded,
      teammatesBlinded: g.teammatesBlinded,
      totalBlindDuration: g.totalBlindDuration,
      damageDealt: g.damageDealt,
      enemiesDamaged: g.enemiesDamaged,
    }));
  }

  private transformRoundPlayerStats(
    stats: Array<{
      roundId: string;
      steamId: string;
      teamNum: number;
      kills: number;
      deaths: number;
      assists: number;
      damage: number;
      equipValue: number;
      moneySpent: number;
      startBalance: number;
      survived: boolean;
      firstKill: boolean;
      firstDeath: boolean;
      clutchVs: number | null;
      clutchWon: boolean | null;
    }>,
    roundIds: ReadonlyMap<number, string>,
  ): RoundPlayerStatsInput[] {
    // Invert the map: id -> roundNumber
    const roundNumById = new Map<string, number>();
    for (const [roundNum, id] of roundIds) {
      roundNumById.set(id, roundNum);
    }

    return stats.map((s) => ({
      roundNumber: roundNumById.get(s.roundId) ?? 0,
      steamId: s.steamId,
      teamNum: s.teamNum,
      kills: s.kills,
      deaths: s.deaths,
      assists: s.assists,
      damage: s.damage,
      equipValue: s.equipValue,
      moneySpent: s.moneySpent,
      startBalance: s.startBalance,
      survived: s.survived,
      firstKill: s.firstKill,
      firstDeath: s.firstDeath,
      clutchVs: s.clutchVs,
      clutchWon: s.clutchWon,
    }));
  }

  private buildLookupMaps(
    players: readonly MatchPlayerInput[],
    rounds: readonly RoundInput[],
  ): DemoMatchData["lookups"] {
    // Player lookups
    const playerNames = new Map<string, string>();
    const playerTeams = new Map<string, number>();
    for (const player of players) {
      playerNames.set(player.steamId, player.name);
      playerTeams.set(player.steamId, player.teamNum);
    }

    // Round lookups
    const roundWinners = new Map<number, number>();
    const roundStartTicks = new Map<number, number>();
    const roundTypes = new Map<number, RoundEconomyType>();
    const roundIds = new Map<number, string>();

    for (const round of rounds) {
      roundWinners.set(round.roundNumber, round.winnerTeam);
      roundStartTicks.set(round.roundNumber, round.startTick);
      roundTypes.set(round.roundNumber, round.roundType as RoundEconomyType);
      roundIds.set(round.roundNumber, round.id);
    }

    return {
      playerNames,
      playerTeams,
      roundWinners,
      roundStartTicks,
      roundTypes,
      roundIds,
    };
  }
}
