/**
 * Clutch Calculator Unit Tests
 *
 * Tests for clutch situation detection and analysis.
 * A clutch is when a player is the last alive and facing multiple enemies.
 */

import { calculateClutches, getClutchPerformanceRating } from "./clutch.calculator";
import type { RoundPlayerStatsInput } from "../types/inputs.types";

describe("Clutch Calculator", () => {
  const steamId = "76561198000000001";

  describe("calculateClutches", () => {
    it("should detect 1v1 clutch situation", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({
          roundNumber: 1,
          clutchVs: 1,
          clutchWon: true,
          kills: 1,
        }),
      ];

      const sideByRound = new Map<number, "T" | "CT">([[1, "CT"]]);

      const result = calculateClutches({
        steamId,
        roundStats,
        sideByRound,
      });

      expect(result.total).toBe(1);
      expect(result.won).toBe(1);
      expect(result.breakdown["1v1"].attempts).toBe(1);
      expect(result.breakdown["1v1"].wins).toBe(1);
    });

    it("should detect 1v2 clutch situation", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({
          roundNumber: 1,
          clutchVs: 2,
          clutchWon: true,
          kills: 2,
        }),
      ];

      const sideByRound = new Map<number, "T" | "CT">([[1, "T"]]);

      const result = calculateClutches({
        steamId,
        roundStats,
        sideByRound,
      });

      expect(result.total).toBe(1);
      expect(result.won).toBe(1);
      expect(result.breakdown["1v2"].attempts).toBe(1);
      expect(result.breakdown["1v2"].wins).toBe(1);
    });

    it("should detect 1v3 clutch situation", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({
          roundNumber: 1,
          clutchVs: 3,
          clutchWon: false,
          kills: 2,
        }),
      ];

      const sideByRound = new Map<number, "T" | "CT">([[1, "CT"]]);

      const result = calculateClutches({
        steamId,
        roundStats,
        sideByRound,
      });

      expect(result.total).toBe(1);
      expect(result.won).toBe(0);
      expect(result.breakdown["1v3"].attempts).toBe(1);
      expect(result.breakdown["1v3"].wins).toBe(0);
    });

    it("should calculate clutch success rate correctly", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({ roundNumber: 1, clutchVs: 1, clutchWon: true }),
        createRoundStats({ roundNumber: 2, clutchVs: 1, clutchWon: true }),
        createRoundStats({ roundNumber: 3, clutchVs: 1, clutchWon: false }),
        createRoundStats({ roundNumber: 4, clutchVs: 2, clutchWon: true }),
        createRoundStats({ roundNumber: 5, clutchVs: 2, clutchWon: false }),
      ];

      const sideByRound = new Map<number, "T" | "CT">([
        [1, "CT"],
        [2, "CT"],
        [3, "T"],
        [4, "T"],
        [5, "CT"],
      ]);

      const result = calculateClutches({
        steamId,
        roundStats,
        sideByRound,
      });

      expect(result.total).toBe(5);
      expect(result.won).toBe(3);
      expect(result.successRate).toBe(60); // 3/5 * 100
    });

    it("should track kills during clutches", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({ roundNumber: 1, clutchVs: 3, clutchWon: true, kills: 3 }),
        createRoundStats({ roundNumber: 2, clutchVs: 2, clutchWon: false, kills: 1 }),
      ];

      const sideByRound = new Map<number, "T" | "CT">([
        [1, "CT"],
        [2, "T"],
      ]);

      const result = calculateClutches({
        steamId,
        roundStats,
        sideByRound,
      });

      expect(result.clutchKills).toBe(4); // 3 + 1 kills in clutch situations
    });

    it("should separate clutches by side", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({ roundNumber: 1, clutchVs: 1, clutchWon: true, teamNum: 3 }), // CT
        createRoundStats({ roundNumber: 2, clutchVs: 1, clutchWon: true, teamNum: 3 }), // CT
        createRoundStats({ roundNumber: 13, clutchVs: 2, clutchWon: true, teamNum: 2 }), // T
      ];

      const sideByRound = new Map<number, "T" | "CT">([
        [1, "CT"],
        [2, "CT"],
        [13, "T"],
      ]);

      const result = calculateClutches({
        steamId,
        roundStats,
        sideByRound,
      });

      expect(result.bySide.ct.total).toBe(2);
      expect(result.bySide.ct.won).toBe(2);
      expect(result.bySide.t.total).toBe(1);
      expect(result.bySide.t.won).toBe(1);
    });

    it("should return empty metrics for no clutches", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({ roundNumber: 1, clutchVs: null, clutchWon: null }),
        createRoundStats({ roundNumber: 2, clutchVs: null, clutchWon: null }),
      ];

      const sideByRound = new Map<number, "T" | "CT">();

      const result = calculateClutches({
        steamId,
        roundStats,
        sideByRound,
      });

      expect(result.total).toBe(0);
      expect(result.won).toBe(0);
      expect(result.successRate).toBe(0);
    });

    it("should handle 1v4 and 1v5 clutches", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({ roundNumber: 1, clutchVs: 4, clutchWon: true }),
        createRoundStats({ roundNumber: 2, clutchVs: 5, clutchWon: false }),
      ];

      const sideByRound = new Map<number, "T" | "CT">([
        [1, "CT"],
        [2, "T"],
      ]);

      const result = calculateClutches({
        steamId,
        roundStats,
        sideByRound,
      });

      expect(result.breakdown["1v4"].attempts).toBe(1);
      expect(result.breakdown["1v4"].wins).toBe(1);
      expect(result.breakdown["1v5"].attempts).toBe(1);
      expect(result.breakdown["1v5"].wins).toBe(0);
    });
  });

  describe("getClutchPerformanceRating", () => {
    it("should return performance rating for calculated clutch metrics", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({ roundNumber: 1, clutchVs: 1, clutchWon: true, kills: 1 }),
        createRoundStats({ roundNumber: 2, clutchVs: 2, clutchWon: true, kills: 2 }),
        createRoundStats({ roundNumber: 3, clutchVs: 1, clutchWon: true, kills: 1 }),
      ];

      const sideByRound = new Map<number, "T" | "CT">([
        [1, "CT"],
        [2, "T"],
        [3, "CT"],
      ]);

      const clutchMetrics = calculateClutches({ steamId, roundStats, sideByRound });
      const result = getClutchPerformanceRating(clutchMetrics);

      expect(typeof result.rating).toBe("string");
      expect(typeof result.score).toBe("number");
      expect(result.score).toBeGreaterThan(0);
    });

    it("should handle no clutch attempts", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({ roundNumber: 1, clutchVs: null, clutchWon: null }),
      ];

      const clutchMetrics = calculateClutches({ steamId, roundStats, sideByRound: new Map() });
      const result = getClutchPerformanceRating(clutchMetrics);

      expect(result.score).toBe(0);
    });
  });
});

// ==============================================================================
// Test Helpers
// ==============================================================================

function createRoundStats(overrides: Partial<RoundPlayerStatsInput> = {}): RoundPlayerStatsInput {
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
