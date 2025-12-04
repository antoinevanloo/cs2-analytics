/**
 * KAST Calculator Unit Tests
 *
 * Tests for KAST (Kill/Assist/Survival/Trade) calculations.
 * KAST is a key metric that measures round contribution.
 */

import { calculateKAST } from "./kast.calculator";
import type { RoundPlayerStatsInput, KillInput } from "../types/inputs.types";

describe("KAST Calculator", () => {
  describe("calculateKAST", () => {
    const steamId = "76561198000000001";

    it("should return 100% KAST when player has a kill every round", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({ kills: 1, survived: false, roundNumber: 1 }),
        createRoundStats({ kills: 2, survived: false, roundNumber: 2 }),
        createRoundStats({ kills: 1, survived: true, roundNumber: 3 }),
      ];
      const allKills: KillInput[] = [];

      const result = calculateKAST({ steamId, roundStats, allKills, tickRate: 64 });

      expect(result.kast).toBe(100);
      expect(result.roundsWithKill).toBe(3);
    });

    it("should return 100% KAST when player survives every round", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({ kills: 0, survived: true, roundNumber: 1 }),
        createRoundStats({ kills: 0, survived: true, roundNumber: 2 }),
        createRoundStats({ kills: 0, survived: true, roundNumber: 3 }),
      ];
      const allKills: KillInput[] = [];

      const result = calculateKAST({ steamId, roundStats, allKills, tickRate: 64 });

      expect(result.kast).toBe(100);
      expect(result.roundsWithSurvival).toBe(3);
    });

    it("should return 100% KAST when player has assists every round", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({ kills: 0, assists: 1, survived: false, roundNumber: 1 }),
        createRoundStats({ kills: 0, assists: 2, survived: false, roundNumber: 2 }),
        createRoundStats({ kills: 0, assists: 1, survived: false, roundNumber: 3 }),
      ];
      const allKills: KillInput[] = [];

      const result = calculateKAST({ steamId, roundStats, allKills, tickRate: 64 });

      expect(result.kast).toBe(100);
      expect(result.roundsWithAssist).toBe(3);
    });

    it("should count traded rounds correctly", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({ kills: 0, survived: false, deaths: 1, roundNumber: 1 }),
        createRoundStats({ kills: 0, survived: false, deaths: 1, roundNumber: 2 }),
      ];

      // Player was traded in round 1 (killed within 5s of dying)
      const allKills: KillInput[] = [
        // Player dies in round 1
        createKill({
          roundNumber: 1,
          victimSteamId: steamId,
          attackerSteamId: "enemy1",
          tick: 1000,
        }),
        // Teammate trades the kill
        createKill({
          roundNumber: 1,
          attackerSteamId: "teammate1",
          victimSteamId: "enemy1",
          tick: 1200, // 200 ticks later = ~3 seconds at 64 tick
        }),
        // Player dies in round 2 but no trade
        createKill({
          roundNumber: 2,
          victimSteamId: steamId,
          attackerSteamId: "enemy2",
          tick: 5000,
        }),
      ];

      const result = calculateKAST({ steamId, roundStats, allKills, tickRate: 64 });

      // Round 1: traded (counted)
      // Round 2: not traded, no kill, no assist, no survive (not counted)
      expect(result.roundsWithTrade).toBe(1);
      expect(result.kast).toBe(50); // 1 out of 2 rounds
    });

    it("should return 0% KAST when player has no contribution", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({ kills: 0, assists: 0, survived: false, deaths: 1, roundNumber: 1 }),
        createRoundStats({ kills: 0, assists: 0, survived: false, deaths: 1, roundNumber: 2 }),
      ];
      const allKills: KillInput[] = [];

      const result = calculateKAST({ steamId, roundStats, allKills, tickRate: 64 });

      expect(result.kast).toBe(0);
    });

    it("should handle mixed rounds correctly", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({ kills: 2, assists: 0, survived: false, roundNumber: 1 }), // K
        createRoundStats({ kills: 0, assists: 1, survived: false, roundNumber: 2 }), // A
        createRoundStats({ kills: 0, assists: 0, survived: true, roundNumber: 3 }), // S
        createRoundStats({ kills: 0, assists: 0, survived: false, deaths: 1, roundNumber: 4 }), // T (via trade)
        createRoundStats({ kills: 0, assists: 0, survived: false, deaths: 1, roundNumber: 5 }), // nothing
      ];

      // Add trade kill for round 4
      const allKills: KillInput[] = [
        createKill({
          roundNumber: 4,
          victimSteamId: steamId,
          attackerSteamId: "enemy1",
          tick: 1000,
        }),
        createKill({
          roundNumber: 4,
          attackerSteamId: "teammate1",
          victimSteamId: "enemy1",
          tick: 1100,
        }),
      ];

      const result = calculateKAST({ steamId, roundStats, allKills, tickRate: 64 });

      expect(result.roundsWithKill).toBe(1);
      expect(result.roundsWithAssist).toBe(1);
      expect(result.roundsWithSurvival).toBe(1);
      expect(result.roundsWithTrade).toBe(1);
      expect(result.kast).toBe(80); // 4 out of 5 rounds
    });

    it("should return empty metrics for empty input", () => {
      const result = calculateKAST({
        steamId,
        roundStats: [],
        allKills: [],
        tickRate: 64,
      });

      expect(result.kast).toBe(0);
      expect(result.totalRounds).toBe(0);
    });

    it("should calculate KAST per round correctly", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({ kills: 1, survived: true, roundNumber: 1 }),
        createRoundStats({ kills: 0, survived: false, roundNumber: 2 }),
        createRoundStats({ kills: 0, survived: true, roundNumber: 3 }),
        createRoundStats({ kills: 2, survived: true, roundNumber: 4 }),
      ];

      const result = calculateKAST({
        steamId,
        roundStats,
        allKills: [],
        tickRate: 64,
      });

      // Rounds 1, 3, 4 have KAST contribution
      expect(result.kast).toBe(75); // 3 out of 4 rounds
      expect(result.totalRounds).toBe(4);
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
