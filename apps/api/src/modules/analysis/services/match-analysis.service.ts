/**
 * Match Analysis Service - Full Match Analysis Orchestrator
 *
 * Provides comprehensive match-level analysis including:
 * - Match overview and summary
 * - Team vs team comparison
 * - Round-by-round analysis
 * - Key moments identification
 *
 * @module analysis/services/match-analysis
 */

import { Injectable, Logger } from "@nestjs/common";
import { MetricsDataService, type DemoMatchData } from "./metrics-data.service";
import { PlayerMetricsService, type PlayerMatchMetricsResult } from "./player-metrics.service";

// Import calculators
import {
  calculateTeamKAST,
  calculateTeamClutches,
  calculateTeamUtility,
  calculateTeamEconomy,
  calculateTeamOpenings,
} from "../calculators";

/**
 * Match overview result
 */
export interface MatchOverviewResult {
  readonly demoId: string;
  readonly metadata: {
    readonly mapName: string;
    readonly duration: number;
    readonly totalRounds: number;
    readonly tickRate: number;
    readonly gameMode: string;
  };
  readonly score: {
    readonly team1: { name: string; score: number; side: "T" | "CT" };
    readonly team2: { name: string; score: number; side: "CT" | "T" };
    readonly winner: string;
    readonly isOvertime: boolean;
  };
  readonly teamStats: {
    readonly team1: TeamStats;
    readonly team2: TeamStats;
  };
  readonly topPerformers: {
    readonly mvp: { steamId: string; name: string; rating: number } | null;
    readonly topFragger: { steamId: string; name: string; kills: number } | null;
    readonly topADR: { steamId: string; name: string; adr: number } | null;
    readonly topClutcher: { steamId: string; name: string; won: number } | null;
  };
  readonly roundStats: {
    readonly ctRoundWins: number;
    readonly tRoundWins: number;
    readonly pistolRoundsWon: { team1: number; team2: number };
    readonly ecoRoundsWon: { team1: number; team2: number };
    readonly forceRoundsWon: { team1: number; team2: number };
  };
}

/**
 * Team statistics
 */
export interface TeamStats {
  readonly name: string;
  readonly players: readonly {
    steamId: string;
    name: string;
    rating: number;
    kills: number;
    deaths: number;
    adr: number;
  }[];
  readonly avgRating: number;
  readonly avgKAST: number;
  readonly totalKills: number;
  readonly totalDeaths: number;
  readonly avgADR: number;
  readonly headshotPercentage: number;
  readonly clutchWinRate: number;
  readonly openingWinRate: number;
  readonly utilityDamagePerRound: number;
  readonly economyScore: number;
}

/**
 * Round analysis result
 */
export interface RoundAnalysisResult {
  readonly demoId: string;
  readonly rounds: readonly RoundBreakdown[];
  readonly momentum: readonly {
    roundNumber: number;
    team1Score: number;
    team2Score: number;
    difference: number;
  }[];
  readonly keyRounds: readonly {
    roundNumber: number;
    type: string;
    description: string;
    team: string;
  }[];
}

/**
 * Round breakdown
 */
export interface RoundBreakdown {
  readonly roundNumber: number;
  readonly winner: { team: number; name: string };
  readonly winReason: string;
  readonly score: { ct: number; t: number };
  readonly economy: {
    ctEquipValue: number;
    tEquipValue: number;
    roundType: string;
    advantage: "CT" | "T" | "EVEN";
  };
  readonly bombPlanted: boolean;
  readonly bombDefused: boolean;
}

/**
 * Economy flow result
 */
export interface EconomyFlowResult {
  readonly demoId: string;
  readonly timeline: readonly {
    roundNumber: number;
    team1: { equipValue: number; roundType: string };
    team2: { equipValue: number; roundType: string };
    winner: number;
    upset: boolean;
  }[];
  readonly summary: {
    readonly team1: {
      avgEquipValue: number;
      ecoWinRate: number;
      forceWinRate: number;
      fullBuyWinRate: number;
      antiEcoWinRate: number;
    };
    readonly team2: {
      avgEquipValue: number;
      ecoWinRate: number;
      forceWinRate: number;
      fullBuyWinRate: number;
      antiEcoWinRate: number;
    };
  };
}

/**
 * Trade analysis result
 */
export interface TradeAnalysisResult {
  readonly demoId: string;
  readonly teamStats: {
    readonly team1: {
      tradesGiven: number;
      tradesReceived: number;
      avgTradeTime: number;
    };
    readonly team2: {
      tradesGiven: number;
      tradesReceived: number;
      avgTradeTime: number;
    };
  };
  readonly topTraders: readonly {
    steamId: string;
    name: string;
    tradesGiven: number;
    tradesReceived: number;
  }[];
}

@Injectable()
export class MatchAnalysisService {
  private readonly logger = new Logger(MatchAnalysisService.name);

  constructor(
    private readonly metricsDataService: MetricsDataService,
    private readonly playerMetricsService: PlayerMetricsService
  ) {}

  /**
   * Get comprehensive match overview
   */
  async getMatchOverview(demoId: string): Promise<MatchOverviewResult> {
    this.logger.debug(`Generating match overview for demo ${demoId}`);

    const matchData = await this.metricsDataService.getFullMatchData(demoId);
    const playerMetrics = await this.playerMetricsService.calculateAllPlayersMetrics(demoId);

    const team1Players = playerMetrics.filter((p) => p.teamNum === 2);
    const team2Players = playerMetrics.filter((p) => p.teamNum === 3);

    const team1Stats = this.calculateTeamStats(matchData.metadata.team1Name, team1Players);
    const team2Stats = this.calculateTeamStats(matchData.metadata.team2Name, team2Players);

    const topPerformers = this.findTopPerformers(playerMetrics);
    const roundStats = this.calculateRoundStats(matchData);

    const winner =
      matchData.metadata.team1Score > matchData.metadata.team2Score
        ? matchData.metadata.team1Name
        : matchData.metadata.team1Score < matchData.metadata.team2Score
          ? matchData.metadata.team2Name
          : "Draw";

    const isOvertime = matchData.rounds.length > 24;

    return {
      demoId,
      metadata: {
        mapName: matchData.metadata.mapName,
        duration: matchData.metadata.durationSeconds,
        totalRounds: matchData.rounds.length,
        tickRate: matchData.metadata.tickRate,
        gameMode: matchData.metadata.gameMode,
      },
      score: {
        team1: {
          name: matchData.metadata.team1Name,
          score: matchData.metadata.team1Score,
          side: "T",
        },
        team2: {
          name: matchData.metadata.team2Name,
          score: matchData.metadata.team2Score,
          side: "CT",
        },
        winner,
        isOvertime,
      },
      teamStats: { team1: team1Stats, team2: team2Stats },
      topPerformers,
      roundStats,
    };
  }

  /**
   * Get round-by-round analysis
   */
  async getRoundAnalysis(demoId: string): Promise<RoundAnalysisResult> {
    this.logger.debug(`Generating round analysis for demo ${demoId}`);

    const matchData = await this.metricsDataService.getFullMatchData(demoId);

    const rounds = matchData.rounds.map((round) => {
      const equipDiff = round.ctEquipValue - round.tEquipValue;
      const advantage: "CT" | "T" | "EVEN" =
        equipDiff > 3000 ? "CT" : equipDiff < -3000 ? "T" : "EVEN";

      return {
        roundNumber: round.roundNumber,
        winner: {
          team: round.winnerTeam,
          name:
            round.winnerTeam === 2
              ? matchData.metadata.team1Name
              : matchData.metadata.team2Name,
        },
        winReason: round.winReason,
        score: { ct: round.ctScore, t: round.tScore },
        economy: {
          ctEquipValue: round.ctEquipValue,
          tEquipValue: round.tEquipValue,
          roundType: round.roundType,
          advantage,
        },
        bombPlanted: round.bombPlanted,
        bombDefused: round.bombDefused,
      };
    });

    let team1Score = 0;
    let team2Score = 0;
    const momentum = rounds.map((round) => {
      if (round.winner.team === 2) team1Score++;
      else team2Score++;
      return {
        roundNumber: round.roundNumber,
        team1Score,
        team2Score,
        difference: team1Score - team2Score,
      };
    });

    const keyRounds = this.identifyKeyRounds(rounds, matchData);

    return { demoId, rounds, momentum, keyRounds };
  }

  /**
   * Get economy flow analysis
   */
  async getEconomyFlow(demoId: string): Promise<EconomyFlowResult> {
    this.logger.debug(`Generating economy flow for demo ${demoId}`);

    const matchData = await this.metricsDataService.getFullMatchData(demoId);
    const playerMetrics = await this.playerMetricsService.calculateAllPlayersMetrics(demoId);

    const timeline = matchData.rounds.map((round) => {
      const equipDiff = Math.abs(round.ctEquipValue - round.tEquipValue);
      const econAdvantageTeam =
        equipDiff > 5000 ? (round.ctEquipValue > round.tEquipValue ? 3 : 2) : null;
      const upset = econAdvantageTeam !== null && round.winnerTeam !== econAdvantageTeam;

      return {
        roundNumber: round.roundNumber,
        team1: { equipValue: round.tEquipValue, roundType: round.roundType },
        team2: { equipValue: round.ctEquipValue, roundType: round.roundType },
        winner: round.winnerTeam,
        upset,
      };
    });

    const team1Players = playerMetrics.filter((p) => p.teamNum === 2);
    const team2Players = playerMetrics.filter((p) => p.teamNum === 3);

    const team1Economy = calculateTeamEconomy(
      team1Players.map((p) => ({ steamId: p.steamId, economy: p.economy }))
    );

    const team2Economy = calculateTeamEconomy(
      team2Players.map((p) => ({ steamId: p.steamId, economy: p.economy }))
    );

    return {
      demoId,
      timeline,
      summary: {
        team1: {
          avgEquipValue: team1Economy.avgTeamEquipValue,
          ecoWinRate: team1Economy.ecoWinRate,
          forceWinRate: team1Economy.forceWinRate,
          fullBuyWinRate: team1Economy.fullBuyWinRate,
          antiEcoWinRate: team1Economy.antiEcoWinRate,
        },
        team2: {
          avgEquipValue: team2Economy.avgTeamEquipValue,
          ecoWinRate: team2Economy.ecoWinRate,
          forceWinRate: team2Economy.forceWinRate,
          fullBuyWinRate: team2Economy.fullBuyWinRate,
          antiEcoWinRate: team2Economy.antiEcoWinRate,
        },
      },
    };
  }

  /**
   * Get trade analysis
   */
  async getTradeAnalysis(demoId: string): Promise<TradeAnalysisResult> {
    this.logger.debug(`Generating trade analysis for demo ${demoId}`);

    const playerMetrics = await this.playerMetricsService.calculateAllPlayersMetrics(demoId);

    const team1Players = playerMetrics.filter((p) => p.teamNum === 2);
    const team2Players = playerMetrics.filter((p) => p.teamNum === 3);

    const team1Stats = {
      tradesGiven: team1Players.reduce((sum, p) => sum + p.trades.tradesGiven, 0),
      tradesReceived: team1Players.reduce((sum, p) => sum + p.trades.tradesReceived, 0),
      avgTradeTime:
        team1Players.reduce((sum, p) => sum + p.trades.avgTradeTimeSeconds, 0) /
        Math.max(team1Players.length, 1),
    };

    const team2Stats = {
      tradesGiven: team2Players.reduce((sum, p) => sum + p.trades.tradesGiven, 0),
      tradesReceived: team2Players.reduce((sum, p) => sum + p.trades.tradesReceived, 0),
      avgTradeTime:
        team2Players.reduce((sum, p) => sum + p.trades.avgTradeTimeSeconds, 0) /
        Math.max(team2Players.length, 1),
    };

    const topTraders = [...playerMetrics]
      .sort((a, b) => b.trades.tradesGiven - a.trades.tradesGiven)
      .slice(0, 5)
      .map((p) => ({
        steamId: p.steamId,
        name: p.name,
        tradesGiven: p.trades.tradesGiven,
        tradesReceived: p.trades.tradesReceived,
      }));

    return {
      demoId,
      teamStats: { team1: team1Stats, team2: team2Stats },
      topTraders,
    };
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  private calculateTeamStats(
    teamName: string,
    players: readonly PlayerMatchMetricsResult[]
  ): TeamStats {
    if (players.length === 0) {
      return {
        name: teamName,
        players: [],
        avgRating: 0,
        avgKAST: 0,
        totalKills: 0,
        totalDeaths: 0,
        avgADR: 0,
        headshotPercentage: 0,
        clutchWinRate: 0,
        openingWinRate: 0,
        utilityDamagePerRound: 0,
        economyScore: 0,
      };
    }

    const playerStats = players.map((p) => ({
      steamId: p.steamId,
      name: p.name,
      rating: p.rating.rating,
      kills: p.combat.kills,
      deaths: p.combat.deaths,
      adr: p.combat.adr,
    }));

    const totalKills = players.reduce((sum, p) => sum + p.combat.kills, 0);
    const totalDeaths = players.reduce((sum, p) => sum + p.combat.deaths, 0);
    const totalHsKills = players.reduce((sum, p) => sum + p.combat.headshotKills, 0);

    const avgRating =
      players.reduce((sum, p) => sum + p.rating.rating, 0) / players.length;

    const teamKAST = calculateTeamKAST(players.map((p) => p.kast));

    const teamClutches = calculateTeamClutches(
      players.map((p) => ({ steamId: p.steamId, name: p.name, clutches: p.clutches }))
    );

    const teamOpenings = calculateTeamOpenings(
      players.map((p) => ({ steamId: p.steamId, name: p.name, openings: p.openings }))
    );

    const teamUtility = calculateTeamUtility(
      players.map((p) => ({ steamId: p.steamId, name: p.name, utility: p.utility }))
    );

    const teamEconomy = calculateTeamEconomy(
      players.map((p) => ({ steamId: p.steamId, economy: p.economy }))
    );

    return {
      name: teamName,
      players: playerStats,
      avgRating: round2(avgRating),
      avgKAST: teamKAST,
      totalKills,
      totalDeaths,
      avgADR: round2(players.reduce((sum, p) => sum + p.combat.adr, 0) / players.length),
      headshotPercentage: round2(totalKills > 0 ? (totalHsKills / totalKills) * 100 : 0),
      clutchWinRate: teamClutches.successRate,
      openingWinRate: teamOpenings.winRate,
      utilityDamagePerRound: teamUtility.utilityDPR,
      economyScore: teamEconomy.economyScore,
    };
  }

  private findTopPerformers(
    players: readonly PlayerMatchMetricsResult[]
  ): MatchOverviewResult["topPerformers"] {
    if (players.length === 0) {
      return { mvp: null, topFragger: null, topADR: null, topClutcher: null };
    }

    const byRating = [...players].sort((a, b) => b.rating.rating - a.rating.rating);
    const byKills = [...players].sort((a, b) => b.combat.kills - a.combat.kills);
    const byADR = [...players].sort((a, b) => b.combat.adr - a.combat.adr);
    const byClutches = [...players]
      .filter((p) => p.clutches.won > 0)
      .sort((a, b) => b.clutches.won - a.clutches.won);

    return {
      mvp: byRating[0]
        ? { steamId: byRating[0].steamId, name: byRating[0].name, rating: byRating[0].rating.rating }
        : null,
      topFragger: byKills[0]
        ? { steamId: byKills[0].steamId, name: byKills[0].name, kills: byKills[0].combat.kills }
        : null,
      topADR: byADR[0]
        ? { steamId: byADR[0].steamId, name: byADR[0].name, adr: byADR[0].combat.adr }
        : null,
      topClutcher: byClutches[0]
        ? { steamId: byClutches[0].steamId, name: byClutches[0].name, won: byClutches[0].clutches.won }
        : null,
    };
  }

  private calculateRoundStats(matchData: DemoMatchData): MatchOverviewResult["roundStats"] {
    let ctRoundWins = 0;
    let tRoundWins = 0;
    const pistolRoundsWon = { team1: 0, team2: 0 };
    const ecoRoundsWon = { team1: 0, team2: 0 };
    const forceRoundsWon = { team1: 0, team2: 0 };

    for (const round of matchData.rounds) {
      if (round.winnerTeam === 3) ctRoundWins++;
      else tRoundWins++;

      if (round.roundNumber === 1 || round.roundNumber === 13) {
        if (round.winnerTeam === 2) pistolRoundsWon.team1++;
        else pistolRoundsWon.team2++;
      }

      if (round.roundType === "eco") {
        if (round.winnerTeam === 2) ecoRoundsWon.team1++;
        else ecoRoundsWon.team2++;
      }

      if (round.roundType === "force") {
        if (round.winnerTeam === 2) forceRoundsWon.team1++;
        else forceRoundsWon.team2++;
      }
    }

    return { ctRoundWins, tRoundWins, pistolRoundsWon, ecoRoundsWon, forceRoundsWon };
  }

  private identifyKeyRounds(
    rounds: readonly RoundBreakdown[],
    _matchData: DemoMatchData
  ): RoundAnalysisResult["keyRounds"] {
    const keyRounds: { roundNumber: number; type: string; description: string; team: string }[] = [];

    // Find eco wins
    for (const round of rounds) {
      if (
        round.economy.roundType === "eco" &&
        round.economy.advantage !== (round.winner.team === 3 ? "CT" : "T")
      ) {
        keyRounds.push({
          roundNumber: round.roundNumber,
          type: "eco_win",
          description: `${round.winner.name} wins eco round`,
          team: round.winner.name,
        });
      }
    }

    return keyRounds.slice(0, 10);
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
