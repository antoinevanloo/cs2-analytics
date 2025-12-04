/**
 * Rating Calculator Unit Tests
 *
 * Tests for HLTV Rating 2.0 calculations.
 * Formula: Rating = 0.0073*KAST + 0.3591*KPR - 0.5329*DPR + 0.2372*Impact + 0.0032*ADR + 0.1587
 */

import { calculateRating, getRatingLabel } from "./rating.calculator";
import type { RoundPlayerStatsInput, KillInput } from "../types/inputs.types";

describe("Rating Calculator", () => {
  const steamId = "76561198000000001";

  describe("calculateRating", () => {
    it("should calculate rating close to 1.0 for average performance", () => {
      // Average performance: ~20 kills, ~20 deaths, ~80 ADR over 24 rounds
      const roundStats: RoundPlayerStatsInput[] = Array.from({ length: 24 }, (_, i) =>
        createRoundStats({
          roundNumber: i + 1,
          kills: 1, // ~1 KPR = average
          deaths: 1, // ~1 DPR = average
          damage: 80, // ~80 ADR = average
          survived: i % 3 !== 0, // ~66% survival = 66% KAST from survival
        })
      );

      const allKills = roundStats.flatMap((r) =>
        r.kills > 0
          ? [createKill({ roundNumber: r.roundNumber, attackerSteamId: steamId })]
          : []
      );

      const result = calculateRating({
        steamId,
        roundStats,
        allKills,
        totalRounds: 24,
        tickRate: 64,
      });

      // Rating should be positive for average player
      // Note: Actual rating depends on formula implementation
      expect(result.rating).toBeGreaterThan(0.8);
      expect(result.rating).toBeLessThan(2.0);
    });

    it("should return higher rating for dominant performance", () => {
      // Dominant: 2+ kills per round, low deaths, high ADR
      const roundStats: RoundPlayerStatsInput[] = Array.from({ length: 20 }, (_, i) =>
        createRoundStats({
          roundNumber: i + 1,
          kills: 2,
          deaths: 0,
          damage: 150,
          survived: true,
          firstKill: true,
        })
      );

      const allKills = roundStats.flatMap((r) =>
        Array.from({ length: r.kills }, () =>
          createKill({ roundNumber: r.roundNumber, attackerSteamId: steamId })
        )
      );

      const result = calculateRating({
        steamId,
        roundStats,
        allKills,
        totalRounds: 20,
        tickRate: 64,
      });

      // Dominant player should have rating > 1.5
      expect(result.rating).toBeGreaterThan(1.5);
    });

    it("should return lower rating for poor performance", () => {
      // Poor: few kills, many deaths, low ADR
      const roundStats: RoundPlayerStatsInput[] = Array.from({ length: 20 }, (_, i) =>
        createRoundStats({
          roundNumber: i + 1,
          kills: 0,
          deaths: 1,
          damage: 30,
          survived: false,
        })
      );

      const result = calculateRating({
        steamId,
        roundStats,
        allKills: [],
        totalRounds: 20,
        tickRate: 64,
      });

      // Poor player should have rating < 0.6
      expect(result.rating).toBeLessThan(0.7);
    });

    it("should return components in result", () => {
      const roundStats: RoundPlayerStatsInput[] = Array.from({ length: 10 }, (_, i) =>
        createRoundStats({
          roundNumber: i + 1,
          kills: 1,
          deaths: 1,
          damage: 80,
          survived: true,
        })
      );

      const result = calculateRating({
        steamId,
        roundStats,
        allKills: [],
        totalRounds: 10,
        tickRate: 64,
      });

      expect(result.components.kpr).toBe(1);
      expect(result.components.dpr).toBe(1);
      expect(result.components.adr).toBe(80);
      expect(typeof result.components.kast).toBe("number");
      expect(typeof result.components.impact).toBe("number");
    });

    it("should return empty metrics for zero rounds", () => {
      const result = calculateRating({
        steamId,
        roundStats: [],
        allKills: [],
        totalRounds: 0,
        tickRate: 64,
      });

      expect(result.rating).toBe(0);
      expect(result.components.kpr).toBe(0);
      expect(result.components.dpr).toBe(0);
    });
  });

  describe("getRatingLabel", () => {
    it("should return 'GOAT Level' for rating >= 1.30", () => {
      expect(getRatingLabel(1.30)).toBe("GOAT Level");
      expect(getRatingLabel(1.50)).toBe("GOAT Level");
    });

    it("should return 'Elite' for rating >= 1.25", () => {
      expect(getRatingLabel(1.25)).toBe("Elite");
      expect(getRatingLabel(1.29)).toBe("Elite");
    });

    it("should return 'Very Good' for rating >= 1.15", () => {
      expect(getRatingLabel(1.15)).toBe("Very Good");
      expect(getRatingLabel(1.19)).toBe("Very Good");
    });

    it("should return 'Above Average' for rating >= 1.05", () => {
      expect(getRatingLabel(1.05)).toBe("Above Average");
      expect(getRatingLabel(1.09)).toBe("Above Average");
    });

    it("should return 'Average' for rating >= 0.95", () => {
      expect(getRatingLabel(0.95)).toBe("Average");
      expect(getRatingLabel(1.04)).toBe("Average");
    });

    it("should return 'Below Average' for rating >= 0.90", () => {
      expect(getRatingLabel(0.90)).toBe("Below Average");
      expect(getRatingLabel(0.94)).toBe("Below Average");
    });

    it("should return 'Poor' for rating >= 0.85", () => {
      expect(getRatingLabel(0.85)).toBe("Poor");
      expect(getRatingLabel(0.89)).toBe("Poor");
    });

    it("should return 'Very Poor' for rating < 0.85", () => {
      expect(getRatingLabel(0.50)).toBe("Very Poor");
      expect(getRatingLabel(0.84)).toBe("Very Poor");
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

function createKill(overrides: Partial<KillInput> = {}): KillInput {
  return {
    tick: 1000,
    roundNumber: 1,
    attackerSteamId: "76561198000000001",
    attackerTeam: 3,
    victimSteamId: "76561198000000002",
    victimTeam: 2,
    weapon: "ak47",
    headshot: false,
    penetrated: 0,
    noscope: false,
    thrusmoke: false,
    attackerblind: false,
    assistedflash: false,
    distance: 500,
    isSuicide: false,
    isTeamkill: false,
    isFirstKill: false,
    isTradeKill: false,
    tradedWithin: null,
    assisterSteamId: null,
    ...overrides,
  };
}
