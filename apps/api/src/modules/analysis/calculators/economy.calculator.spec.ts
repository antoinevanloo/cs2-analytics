/**
 * Economy Calculator Unit Tests
 *
 * Tests for economic performance analysis.
 */

import {
  calculateEconomy,
  classifyRoundType,
  getEconomyLabel,
  calculateTeamEconomy,
  buildEconomyTimeline,
} from "./economy.calculator";
import type { RoundPlayerStatsInput } from "../types/inputs.types";
import { ECONOMY_THRESHOLDS } from "../types/constants";

describe("Economy Calculator", () => {
  const steamId = "76561198000000001";

  describe("classifyRoundType", () => {
    it("should classify pistol rounds correctly", () => {
      expect(classifyRoundType(1, 800)).toBe("pistol");
      expect(classifyRoundType(13, 1000)).toBe("pistol");
    });

    it("should classify eco rounds correctly", () => {
      expect(classifyRoundType(2, 1000)).toBe("eco");
      expect(classifyRoundType(5, ECONOMY_THRESHOLDS.ECO - 1)).toBe("eco");
    });

    it("should classify force buy rounds correctly", () => {
      expect(classifyRoundType(3, ECONOMY_THRESHOLDS.ECO)).toBe("force");
      expect(classifyRoundType(5, ECONOMY_THRESHOLDS.FULL_BUY - 1)).toBe(
        "force",
      );
    });

    it("should classify full buy rounds correctly", () => {
      expect(classifyRoundType(4, ECONOMY_THRESHOLDS.FULL_BUY)).toBe(
        "full_buy",
      );
      expect(classifyRoundType(10, 6000)).toBe("full_buy");
    });
  });

  describe("calculateEconomy", () => {
    it("should return empty metrics for empty input", () => {
      const result = calculateEconomy({
        steamId,
        roundStats: [],
        totalRounds: 0,
      });

      expect(result.avgEquipValue).toBe(0);
      expect(result.totalSpent).toBe(0);
    });

    it("should calculate average equipment value correctly", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({
          equipValue: 4000,
          moneySpent: 4000,
          roundNumber: 3,
        }),
        createRoundStats({
          equipValue: 5000,
          moneySpent: 5000,
          roundNumber: 4,
        }),
        createRoundStats({
          equipValue: 5500,
          moneySpent: 5500,
          roundNumber: 5,
        }),
      ];

      const result = calculateEconomy({
        steamId,
        roundStats,
        totalRounds: 3,
      });

      expect(result.avgEquipValue).toBeCloseTo(4833.33, 0);
      expect(result.totalSpent).toBe(14500);
    });

    it("should calculate value efficiency correctly", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({ damage: 200, moneySpent: 5000, roundNumber: 3 }),
        createRoundStats({ damage: 300, moneySpent: 5000, roundNumber: 4 }),
      ];

      const result = calculateEconomy({
        steamId,
        roundStats,
        totalRounds: 2,
      });

      // Value efficiency = (totalDamage / totalSpent) * 1000
      // = (500 / 10000) * 1000 = 50
      expect(result.valueEfficiency).toBe(50);
    });

    it("should categorize rounds by economy type", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({ equipValue: 800, roundNumber: 1 }), // Pistol
        createRoundStats({ equipValue: 1000, roundNumber: 2 }), // Eco
        createRoundStats({ equipValue: 3000, roundNumber: 3 }), // Force
        createRoundStats({ equipValue: 5000, roundNumber: 4 }), // Full buy
      ];

      const result = calculateEconomy({
        steamId,
        roundStats,
        totalRounds: 4,
      });

      expect(result.eco.roundsPlayed).toBe(1);
      expect(result.forceBuy.roundsPlayed).toBe(1);
      expect(result.fullBuy.roundsPlayed).toBe(1);
    });

    it("should calculate stats per round type", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        // Eco rounds
        createRoundStats({
          equipValue: 1000,
          kills: 2,
          deaths: 1,
          damage: 100,
          roundNumber: 2,
        }),
        createRoundStats({
          equipValue: 1500,
          kills: 1,
          deaths: 0,
          damage: 80,
          roundNumber: 3,
        }),
        // Full buy rounds
        createRoundStats({
          equipValue: 5000,
          kills: 1,
          deaths: 1,
          damage: 120,
          roundNumber: 4,
        }),
        createRoundStats({
          equipValue: 5500,
          kills: 2,
          deaths: 1,
          damage: 150,
          roundNumber: 5,
        }),
      ];

      const result = calculateEconomy({
        steamId,
        roundStats,
        totalRounds: 4,
      });

      // Eco rounds stats
      expect(result.eco.kills).toBe(3);
      expect(result.eco.deaths).toBe(1);
      expect(result.eco.adr).toBe(90); // 180/2

      // Full buy stats
      expect(result.fullBuy.kills).toBe(3);
      expect(result.fullBuy.adr).toBe(135); // 270/2
    });

    it("should calculate kill efficiency correctly", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({ kills: 3, moneySpent: 5000, roundNumber: 3 }),
        createRoundStats({ kills: 2, moneySpent: 5000, roundNumber: 4 }),
      ];

      const result = calculateEconomy({
        steamId,
        roundStats,
        totalRounds: 2,
      });

      // Kill efficiency = (totalKills / totalSpent) * 1000
      // = (5 / 10000) * 1000 = 0.5
      expect(result.killEfficiency).toBe(0.5);
    });
  });

  describe("getEconomyLabel", () => {
    it("should return correct labels for value efficiency", () => {
      expect(getEconomyLabel(30)).toBe("Elite");
      expect(getEconomyLabel(25)).toBe("Excellent");
      expect(getEconomyLabel(20)).toBe("Good");
      expect(getEconomyLabel(15)).toBe("Average");
      expect(getEconomyLabel(10)).toBe("Below Average");
      expect(getEconomyLabel(5)).toBe("Poor");
    });
  });

  describe("buildEconomyTimeline", () => {
    it("should build round-by-round economy timeline", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({
          equipValue: 800,
          moneySpent: 650,
          startBalance: 800,
          roundNumber: 1,
        }),
        createRoundStats({
          equipValue: 1500,
          moneySpent: 1200,
          startBalance: 1500,
          roundNumber: 2,
        }),
      ];

      const result = buildEconomyTimeline(roundStats);

      expect(result).toHaveLength(2);
      expect(result[0]!.roundNumber).toBe(1);
      expect(result[0]!.roundType).toBe("pistol");
      expect(result[1]!.roundNumber).toBe(2);
      expect(result[1]!.roundType).toBe("eco");
    });

    it("should calculate economic advantage correctly", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({ equipValue: 5000, roundNumber: 3 }),
      ];

      const teamEquipByRound = new Map([[3, 25000]]);
      const opponentEquipByRound = new Map([[3, 15000]]);

      const result = buildEconomyTimeline(
        roundStats,
        teamEquipByRound,
        opponentEquipByRound,
      );

      expect(result[0]!.teamEquipValue).toBe(25000);
      expect(result[0]!.opponentEquipValue).toBe(15000);
      expect(result[0]!.economicAdvantage).toBe(10000);
    });
  });

  describe("calculateTeamEconomy", () => {
    it("should aggregate team economy stats", () => {
      const playerEconomies = [
        {
          steamId: "p1",
          economy: createEconomyMetrics({
            avgEquipValue: 4000,
            totalSpent: 50000,
          }),
        },
        {
          steamId: "p2",
          economy: createEconomyMetrics({
            avgEquipValue: 4500,
            totalSpent: 55000,
          }),
        },
      ];

      const result = calculateTeamEconomy(playerEconomies);

      expect(result.avgTeamEquipValue).toBe(4250);
      expect(result.totalTeamSpent).toBe(105000);
    });

    it("should return empty for no players", () => {
      const result = calculateTeamEconomy([]);

      expect(result.avgTeamEquipValue).toBe(0);
      expect(result.economyScore).toBe(0);
    });
  });
});

// ==============================================================================
// Test Helpers
// ==============================================================================

function createRoundStats(
  overrides: Partial<RoundPlayerStatsInput> = {},
): RoundPlayerStatsInput {
  return {
    steamId: "76561198000000001",
    roundNumber: 1,
    teamNum: 3,
    kills: 0,
    deaths: 0,
    assists: 0,
    damage: 0,
    equipValue: 4750,
    moneySpent: 4750,
    startBalance: 5000,
    survived: true,
    firstKill: false,
    firstDeath: false,
    clutchVs: null,
    clutchWon: null,
    ...overrides,
  };
}

function createEconomyMetrics(
  overrides: {
    avgEquipValue?: number;
    totalSpent?: number;
  } = {},
) {
  const emptyRoundStats = {
    roundsPlayed: 0,
    kills: 0,
    deaths: 0,
    damage: 0,
    kd: 0,
    adr: 0,
    roundsWon: 0,
    winRate: 0,
  };

  return {
    avgEquipValue: overrides.avgEquipValue ?? 0,
    totalSpent: overrides.totalSpent ?? 0,
    avgSpentPerRound: 0,
    valueEfficiency: 0,
    killEfficiency: 0,
    eco: emptyRoundStats,
    forceBuy: emptyRoundStats,
    fullBuy: emptyRoundStats,
    antiEco: emptyRoundStats,
  };
}
