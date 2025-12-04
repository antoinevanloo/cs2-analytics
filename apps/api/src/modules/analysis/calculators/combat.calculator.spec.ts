/**
 * Combat Calculator Unit Tests
 *
 * Tests for fundamental combat statistics calculations.
 */

import {
  calculateCombatMetrics,
  calculateCombatBySide,
  calculateWeaponStats,
  calculateSpecialKills,
  calculateKillDistance,
  calculateMultiKillMetrics,
} from "./combat.calculator";
import type { RoundPlayerStatsInput, KillInput } from "../types/inputs.types";
import type { WeaponCombatMetrics } from "../types/combat.types";

describe("Combat Calculator", () => {
  describe("calculateCombatMetrics", () => {
    it("should return empty metrics for empty array", () => {
      const result = calculateCombatMetrics([]);

      expect(result.kills).toBe(0);
      expect(result.deaths).toBe(0);
      expect(result.assists).toBe(0);
      expect(result.kd).toBe(0);
      expect(result.adr).toBe(0);
      expect(result.roundsPlayed).toBe(0);
    });

    it("should calculate basic combat metrics correctly", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({ kills: 2, deaths: 1, assists: 1, damage: 120 }),
        createRoundStats({
          kills: 1,
          deaths: 0,
          assists: 0,
          damage: 80,
          roundNumber: 2,
        }),
        createRoundStats({
          kills: 0,
          deaths: 1,
          assists: 1,
          damage: 50,
          roundNumber: 3,
        }),
      ];

      const result = calculateCombatMetrics(roundStats);

      expect(result.kills).toBe(3);
      expect(result.deaths).toBe(2);
      expect(result.assists).toBe(2);
      expect(result.kd).toBe(1.5); // 3 kills / 2 deaths
      expect(result.adr).toBeCloseTo(83.33, 1); // 250 / 3 rounds
      expect(result.roundsPlayed).toBe(3);
      expect(result.kpr).toBe(1); // 3 kills / 3 rounds
      expect(result.dpr).toBeCloseTo(0.67, 1); // 2 deaths / 3 rounds
    });

    it("should handle zero deaths correctly (K/D calculation)", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({ kills: 3, deaths: 0, damage: 200 }),
      ];

      const result = calculateCombatMetrics(roundStats);

      expect(result.kd).toBe(3); // 3 kills / max(0, 1) deaths = 3
      expect(result.kdDiff).toBe(3);
    });

    it("should calculate K/D difference correctly", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({ kills: 5, deaths: 3 }),
      ];

      const result = calculateCombatMetrics(roundStats);

      expect(result.kdDiff).toBe(2); // 5 - 3
    });

    it("should handle negative K/D difference", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({ kills: 1, deaths: 4 }),
      ];

      const result = calculateCombatMetrics(roundStats);

      expect(result.kdDiff).toBe(-3); // 1 - 4
    });
  });

  describe("calculateCombatBySide", () => {
    it("should separate stats by CT and T side", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({
          kills: 2,
          deaths: 1,
          damage: 100,
          teamNum: 3,
          roundNumber: 1,
        }), // CT
        createRoundStats({
          kills: 1,
          deaths: 0,
          damage: 80,
          teamNum: 3,
          roundNumber: 2,
        }), // CT
        createRoundStats({
          kills: 3,
          deaths: 2,
          damage: 150,
          teamNum: 2,
          roundNumber: 3,
        }), // T
      ];

      const sideByRound = new Map<number, number>([
        [1, 3], // CT
        [2, 3], // CT
        [3, 2], // T
      ]);

      const result = calculateCombatBySide(roundStats, sideByRound);

      // CT stats
      expect(result.ct.kills).toBe(3);
      expect(result.ct.deaths).toBe(1);
      expect(result.ct.adr).toBe(90); // 180 / 2 rounds

      // T stats
      expect(result.t.kills).toBe(3);
      expect(result.t.deaths).toBe(2);
      expect(result.t.adr).toBe(150);
    });

    it("should return empty for side with no rounds", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({
          kills: 2,
          deaths: 1,
          damage: 100,
          teamNum: 3,
          roundNumber: 1,
        }), // CT only
      ];

      const sideByRound = new Map<number, number>([
        [1, 3], // CT
      ]);

      const result = calculateCombatBySide(roundStats, sideByRound);

      expect(result.t.kills).toBe(0);
      expect(result.t.roundsPlayed).toBe(0);
    });
  });

  describe("calculateWeaponStats", () => {
    it("should calculate weapon stats correctly", () => {
      const kills: KillInput[] = [
        createKill({ weapon: "ak47", headshot: true }),
        createKill({ weapon: "ak47", headshot: false }),
        createKill({ weapon: "ak47", headshot: true }),
        createKill({ weapon: "m4a1", headshot: true }),
        createKill({ weapon: "awp", headshot: false }),
      ];

      const result = calculateWeaponStats(kills);

      // AK47 stats (normalized to "AK-47")
      const ak = result.find((w: WeaponCombatMetrics) => w.weapon === "AK-47");
      expect(ak).toBeDefined();
      expect(ak!.kills).toBe(3);
      expect(ak!.headshotKills).toBe(2);
      expect(ak!.hsPercent).toBeCloseTo(66.67, 1);

      // AWP stats (normalized to "AWP")
      const awp = result.find((w: WeaponCombatMetrics) => w.weapon === "AWP");
      expect(awp).toBeDefined();
      expect(awp!.kills).toBe(1);
      expect(awp!.headshotKills).toBe(0);
      expect(awp!.hsPercent).toBe(0);
    });

    it("should return sorted by kills descending", () => {
      const kills: KillInput[] = [
        createKill({ weapon: "ak47" }),
        createKill({ weapon: "m4a1" }),
        createKill({ weapon: "m4a1" }),
        createKill({ weapon: "m4a1" }),
        createKill({ weapon: "awp" }),
      ];

      const result = calculateWeaponStats(kills);

      // M4A1 normalized to "M4A1-S"
      expect(result[0]!.weapon).toBe("M4A1-S");
      expect(result[0]!.kills).toBe(3);
    });

    it("should return empty array for no kills", () => {
      const result = calculateWeaponStats([]);
      expect(result).toEqual([]);
    });
  });

  describe("calculateSpecialKills", () => {
    it("should detect wallbang kills", () => {
      const kills: KillInput[] = [
        createKill({ penetrated: 2 }), // Wallbang
        createKill({ penetrated: 0 }), // Normal
        createKill({ penetrated: 1 }), // Wallbang
      ];

      const result = calculateSpecialKills(kills);

      expect(result.wallbangs).toBe(2);
      expect(result.wallbangPercent).toBeCloseTo(66.67, 1);
    });

    it("should detect noscope kills", () => {
      const kills: KillInput[] = [
        createKill({ noscope: true, weapon: "awp" }),
        createKill({ noscope: false, weapon: "awp" }),
        createKill({ noscope: true, weapon: "ssg08" }),
      ];

      const result = calculateSpecialKills(kills);

      expect(result.noscopes).toBe(2);
      expect(result.noscopePercent).toBeCloseTo(66.67, 1);
    });

    it("should detect through smoke kills", () => {
      const kills: KillInput[] = [
        createKill({ thrusmoke: true }),
        createKill({ thrusmoke: false }),
        createKill({ thrusmoke: true }),
      ];

      const result = calculateSpecialKills(kills);

      expect(result.throughSmoke).toBe(2);
      expect(result.throughSmokePercent).toBeCloseTo(66.67, 1);
    });

    it("should detect blind kills (attacker flashed)", () => {
      const kills: KillInput[] = [
        createKill({ attackerblind: true }),
        createKill({ attackerblind: false }),
      ];

      const result = calculateSpecialKills(kills);

      expect(result.whileBlind).toBe(1);
      expect(result.whileBlindPercent).toBe(50);
    });

    it("should detect flash-assisted kills", () => {
      const kills: KillInput[] = [
        createKill({ assistedflash: true }),
        createKill({ assistedflash: true }),
        createKill({ assistedflash: false }),
      ];

      const result = calculateSpecialKills(kills);

      expect(result.flashAssisted).toBe(2);
      expect(result.flashAssistedPercent).toBeCloseTo(66.67, 1);
    });

    it("should calculate total special kills correctly", () => {
      const kills: KillInput[] = [
        createKill({ penetrated: 1 }), // Wallbang
        createKill({ noscope: true }), // Noscope
        createKill({ thrusmoke: true, penetrated: 1 }), // Both thrusmoke and wallbang
      ];

      const result = calculateSpecialKills(kills);

      // Wallbangs: 2 (penetrated > 0)
      // Noscopes: 1
      // Through smoke: 1
      // Total unique: each kill counted once for each category
      expect(result.wallbangs).toBe(2);
      expect(result.noscopes).toBe(1);
      expect(result.throughSmoke).toBe(1);
    });

    it("should return empty metrics for empty array", () => {
      const result = calculateSpecialKills([]);

      expect(result.wallbangs).toBe(0);
      expect(result.noscopes).toBe(0);
      expect(result.throughSmoke).toBe(0);
      expect(result.whileBlind).toBe(0);
      expect(result.flashAssisted).toBe(0);
    });
  });

  describe("calculateKillDistance", () => {
    it("should classify close range kills (0-500 units)", () => {
      const kills: KillInput[] = [
        createKill({ distance: 100 }),
        createKill({ distance: 300 }),
        createKill({ distance: 499 }),
      ];

      const result = calculateKillDistance(kills);

      expect(result.close.kills).toBe(3);
      expect(result.close.percent).toBe(100);
      expect(result.preferredRange).toBe("close");
    });

    it("should classify medium range kills (500-1500 units)", () => {
      const kills: KillInput[] = [
        createKill({ distance: 600 }),
        createKill({ distance: 1000 }),
        createKill({ distance: 1400 }),
      ];

      const result = calculateKillDistance(kills);

      expect(result.medium.kills).toBe(3);
      expect(result.medium.percent).toBe(100);
      expect(result.preferredRange).toBe("medium");
    });

    it("should classify long range kills (1500-3000 units)", () => {
      const kills: KillInput[] = [
        createKill({ distance: 1600 }),
        createKill({ distance: 2500 }),
        createKill({ distance: 2900 }),
      ];

      const result = calculateKillDistance(kills);

      expect(result.long.kills).toBe(3);
      expect(result.long.percent).toBe(100);
      expect(result.preferredRange).toBe("long");
    });

    it("should classify extreme range kills (3000+ units)", () => {
      const kills: KillInput[] = [
        createKill({ distance: 3100 }),
        createKill({ distance: 4000 }),
      ];

      const result = calculateKillDistance(kills);

      expect(result.extreme.kills).toBe(2);
      expect(result.extreme.percent).toBe(100);
      expect(result.preferredRange).toBe("extreme");
    });

    it("should calculate average distance correctly", () => {
      const kills: KillInput[] = [
        createKill({ distance: 500 }),
        createKill({ distance: 1000 }),
        createKill({ distance: 1500 }),
      ];

      const result = calculateKillDistance(kills);

      expect(result.avgDistance).toBe(1000);
    });

    it("should handle null distance values", () => {
      const kills: KillInput[] = [
        createKill({ distance: null }),
        createKill({ distance: 500 }),
      ];

      const result = calculateKillDistance(kills);

      // Null should default to 1000 (medium range)
      expect(result.medium.kills).toBeGreaterThanOrEqual(1);
    });

    it("should return empty metrics for empty array", () => {
      const result = calculateKillDistance([]);

      expect(result.close.kills).toBe(0);
      expect(result.medium.kills).toBe(0);
      expect(result.long.kills).toBe(0);
      expect(result.extreme.kills).toBe(0);
      expect(result.avgDistance).toBe(0);
    });
  });

  describe("calculateMultiKillMetrics", () => {
    it("should detect 2K rounds", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({ kills: 2, roundNumber: 1 }),
        createRoundStats({ kills: 1, roundNumber: 2 }),
        createRoundStats({ kills: 2, roundNumber: 3 }),
      ];

      const result = calculateMultiKillMetrics(roundStats);

      expect(result.twoK).toBe(2);
    });

    it("should detect 3K rounds", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({ kills: 3, roundNumber: 1 }),
        createRoundStats({ kills: 2, roundNumber: 2 }),
      ];

      const result = calculateMultiKillMetrics(roundStats);

      expect(result.threeK).toBe(1);
      expect(result.twoK).toBe(1);
    });

    it("should detect 4K rounds", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({ kills: 4, roundNumber: 1 }),
      ];

      const result = calculateMultiKillMetrics(roundStats);

      expect(result.fourK).toBe(1);
    });

    it("should detect ace (5K) rounds", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({ kills: 5, roundNumber: 1 }),
      ];

      const result = calculateMultiKillMetrics(roundStats);

      expect(result.fiveK).toBe(1);
    });

    it("should calculate total multi-kill rounds", () => {
      const roundStats: RoundPlayerStatsInput[] = [
        createRoundStats({ kills: 2, roundNumber: 1 }),
        createRoundStats({ kills: 3, roundNumber: 2 }),
        createRoundStats({ kills: 4, roundNumber: 3 }),
        createRoundStats({ kills: 1, roundNumber: 4 }),
      ];

      const result = calculateMultiKillMetrics(roundStats);

      expect(result.totalMultiKillRounds).toBe(3);
    });

    it("should return empty metrics for empty array", () => {
      const result = calculateMultiKillMetrics([]);

      expect(result.twoK).toBe(0);
      expect(result.threeK).toBe(0);
      expect(result.fourK).toBe(0);
      expect(result.fiveK).toBe(0);
      expect(result.totalMultiKillRounds).toBe(0);
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
