/**
 * Utility Calculator Unit Tests
 *
 * Tests for grenade usage analysis.
 */

import { calculateUtility, getUtilityLabel, calculateTeamUtility } from "./utility.calculator";
import type { GrenadeInput } from "../types/inputs.types";

describe("Utility Calculator", () => {
  const steamId = "76561198000000001";

  describe("calculateUtility", () => {
    it("should return empty metrics for no grenades", () => {
      const result = calculateUtility({
        steamId,
        allGrenades: [],
        totalRounds: 10,
      });

      expect(result.totalGrenadesThrown).toBe(0);
      expect(result.totalUtilityDamage).toBe(0);
      expect(result.utilityDamagePerRound).toBe(0);
    });

    it("should calculate flash metrics correctly", () => {
      const grenades: GrenadeInput[] = [
        createGrenade({ type: "flashbang", enemiesBlinded: 2, teammatesBlinded: 0, totalBlindDuration: 4.5 }),
        createGrenade({ type: "flashbang", enemiesBlinded: 1, teammatesBlinded: 1, totalBlindDuration: 2.0, roundNumber: 2 }),
        createGrenade({ type: "flashbang", enemiesBlinded: 0, teammatesBlinded: 2, totalBlindDuration: 0, roundNumber: 3 }),
      ];

      const result = calculateUtility({
        steamId,
        allGrenades: grenades,
        totalRounds: 10,
        flashAssists: 2,
      });

      expect(result.flash.thrown).toBe(3);
      expect(result.flash.enemiesBlinded).toBe(3);
      expect(result.flash.teammatesBlinded).toBe(3);
      expect(result.flash.flashAssists).toBe(2);
      expect(result.flash.effectivenessRate).toBeCloseTo(66.67, 1); // 2/3 effective
    });

    it("should calculate HE grenade metrics correctly", () => {
      const grenades: GrenadeInput[] = [
        createGrenade({ type: "hegrenade", damageDealt: 50, enemiesDamaged: 2 }),
        createGrenade({ type: "hegrenade", damageDealt: 30, enemiesDamaged: 1, roundNumber: 2 }),
        createGrenade({ type: "hegrenade", damageDealt: 0, enemiesDamaged: 0, roundNumber: 3 }),
      ];

      const result = calculateUtility({
        steamId,
        allGrenades: grenades,
        totalRounds: 10,
      });

      expect(result.heGrenade.thrown).toBe(3);
      expect(result.heGrenade.damage).toBe(80);
      expect(result.heGrenade.enemiesDamaged).toBe(3);
      expect(result.heGrenade.avgDamage).toBeCloseTo(26.67, 1);
      expect(result.heGrenade.hitRate).toBeCloseTo(66.67, 1); // 2/3 did damage
    });

    it("should calculate Molotov/Incendiary metrics correctly", () => {
      const grenades: GrenadeInput[] = [
        createGrenade({ type: "molotov", damageDealt: 100, enemiesDamaged: 2 }),
        createGrenade({ type: "incendiary", damageDealt: 50, enemiesDamaged: 1, roundNumber: 2 }),
      ];

      const result = calculateUtility({
        steamId,
        allGrenades: grenades,
        totalRounds: 10,
      });

      expect(result.molotov.thrown).toBe(2);
      expect(result.molotov.damage).toBe(150);
      expect(result.molotov.avgDamage).toBe(75);
    });

    it("should calculate smoke metrics correctly", () => {
      const grenades: GrenadeInput[] = [
        createGrenade({ type: "smokegrenade" }),
        createGrenade({ type: "smokegrenade", roundNumber: 2 }),
        createGrenade({ type: "smokegrenade", roundNumber: 3 }),
        createGrenade({ type: "smokegrenade", roundNumber: 4 }),
      ];

      const result = calculateUtility({
        steamId,
        allGrenades: grenades,
        totalRounds: 10,
      });

      expect(result.smoke.thrown).toBe(4);
      expect(result.smoke.perRound).toBe(0.4);
    });

    it("should calculate total utility damage", () => {
      const grenades: GrenadeInput[] = [
        createGrenade({ type: "hegrenade", damageDealt: 50 }),
        createGrenade({ type: "molotov", damageDealt: 30, roundNumber: 2 }),
      ];

      const result = calculateUtility({
        steamId,
        allGrenades: grenades,
        totalRounds: 10,
      });

      expect(result.totalUtilityDamage).toBe(80);
      expect(result.utilityDamagePerRound).toBe(8);
    });

    it("should only count grenades thrown by the player", () => {
      const grenades: GrenadeInput[] = [
        createGrenade({ type: "hegrenade", damageDealt: 50, throwerSteamId: steamId }),
        createGrenade({ type: "hegrenade", damageDealt: 100, throwerSteamId: "otherPlayer", roundNumber: 2 }),
      ];

      const result = calculateUtility({
        steamId,
        allGrenades: grenades,
        totalRounds: 10,
      });

      expect(result.heGrenade.thrown).toBe(1);
      expect(result.heGrenade.damage).toBe(50);
    });
  });

  describe("getUtilityLabel", () => {
    it("should return 'Elite' for >= 20 utility DPR", () => {
      expect(getUtilityLabel(20)).toBe("Elite");
      expect(getUtilityLabel(25)).toBe("Elite");
    });

    it("should return 'Excellent' for >= 15 utility DPR", () => {
      expect(getUtilityLabel(15)).toBe("Excellent");
      expect(getUtilityLabel(19)).toBe("Excellent");
    });

    it("should return 'Good' for >= 10 utility DPR", () => {
      expect(getUtilityLabel(10)).toBe("Good");
      expect(getUtilityLabel(14)).toBe("Good");
    });

    it("should return 'Average' for >= 5 utility DPR", () => {
      expect(getUtilityLabel(5)).toBe("Average");
      expect(getUtilityLabel(9)).toBe("Average");
    });

    it("should return 'Below Average' for >= 2 utility DPR", () => {
      expect(getUtilityLabel(2)).toBe("Below Average");
      expect(getUtilityLabel(4)).toBe("Below Average");
    });

    it("should return 'Poor' for < 2 utility DPR", () => {
      expect(getUtilityLabel(0)).toBe("Poor");
      expect(getUtilityLabel(1.9)).toBe("Poor");
    });
  });

  describe("calculateTeamUtility", () => {
    it("should aggregate team utility stats", () => {
      const playerUtilities = [
        {
          steamId: "player1",
          name: "Player1",
          utility: createUtilityMetrics({ totalUtilityDamage: 100, utilityDamagePerRound: 10, flashEffectiveness: 60 }),
        },
        {
          steamId: "player2",
          name: "Player2",
          utility: createUtilityMetrics({ totalUtilityDamage: 150, utilityDamagePerRound: 15, flashEffectiveness: 80 }),
        },
      ];

      const result = calculateTeamUtility(playerUtilities);

      expect(result.totalUtilityDamage).toBe(250);
      expect(result.utilityDPR).toBe(12.5); // Average
      expect(result.avgFlashEffectiveness).toBe(70); // Average
    });

    it("should identify top utility player", () => {
      const playerUtilities = [
        {
          steamId: "player1",
          name: "Player1",
          utility: createUtilityMetrics({ totalUtilityDamage: 100 }),
        },
        {
          steamId: "player2",
          name: "Player2",
          utility: createUtilityMetrics({ totalUtilityDamage: 200 }),
        },
      ];

      const result = calculateTeamUtility(playerUtilities);

      expect(result.topUtilityPlayer?.steamId).toBe("player2");
      expect(result.topUtilityPlayer?.utilityDamage).toBe(200);
    });

    it("should return empty for no players", () => {
      const result = calculateTeamUtility([]);

      expect(result.totalUtilityDamage).toBe(0);
      expect(result.topUtilityPlayer).toBeNull();
    });
  });
});

// ==============================================================================
// Test Helpers
// ==============================================================================

function createGrenade(overrides: Partial<GrenadeInput> = {}): GrenadeInput {
  return {
    tick: 1000,
    type: "hegrenade",
    roundNumber: 1,
    x: 0,
    y: 0,
    z: 0,
    throwerSteamId: "76561198000000001",
    throwerTeam: 3,
    enemiesBlinded: 0,
    teammatesBlinded: 0,
    totalBlindDuration: 0,
    damageDealt: 0,
    enemiesDamaged: 0,
    ...overrides,
  };
}

function createUtilityMetrics(overrides: {
  totalUtilityDamage?: number;
  utilityDamagePerRound?: number;
  flashEffectiveness?: number;
} = {}) {
  return {
    flash: {
      thrown: 0,
      enemiesBlinded: 0,
      teammatesBlinded: 0,
      totalEnemyBlindDuration: 0,
      avgBlindDuration: 0,
      flashAssists: 0,
      effectivenessRate: overrides.flashEffectiveness ?? 0,
      enemyTeammateRatio: 0,
      enemiesPerFlash: 0,
    },
    heGrenade: {
      thrown: 0,
      damage: 0,
      kills: 0,
      enemiesDamaged: 0,
      avgDamage: 0,
      hitRate: 0,
    },
    molotov: {
      thrown: 0,
      damage: 0,
      kills: 0,
      enemiesDamaged: 0,
      avgDamage: 0,
      totalBurnTime: 0,
    },
    smoke: {
      thrown: 0,
      perRound: 0,
    },
    decoy: {
      thrown: 0,
    },
    totalUtilityDamage: overrides.totalUtilityDamage ?? 0,
    utilityDamagePerRound: overrides.utilityDamagePerRound ?? 0,
    totalGrenadesThrown: 0,
    grenadesPerRound: 0,
  };
}
