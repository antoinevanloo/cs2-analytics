/**
 * Opening Calculator Unit Tests
 *
 * Tests for opening duel analysis.
 * Opening duels are the first kills of each round.
 */

import {
  calculateOpeningDuels,
  getOpeningLabel,
  calculateTeamOpenings,
} from "./opening.calculator";
import type { KillInput } from "../types/inputs.types";

describe("Opening Calculator", () => {
  const steamId = "76561198000000001";
  const tickRate = 64;

  describe("calculateOpeningDuels", () => {
    it("should detect opening kill win", () => {
      const allKills: KillInput[] = [
        createKill({
          tick: 5000,
          roundNumber: 1,
          attackerSteamId: steamId,
          victimSteamId: "enemy1",
        }),
        createKill({
          tick: 6000,
          roundNumber: 1,
          attackerSteamId: "enemy2",
          victimSteamId: "teammate1",
        }),
      ];

      const result = calculateOpeningDuels({
        steamId,
        allKills,
        totalRounds: 1,
        tickRate,
      });

      expect(result.wins).toBe(1);
      expect(result.losses).toBe(0);
      expect(result.total).toBe(1);
      expect(result.winRate).toBe(100);
    });

    it("should detect opening death loss", () => {
      const allKills: KillInput[] = [
        createKill({
          tick: 5000,
          roundNumber: 1,
          attackerSteamId: "enemy1",
          victimSteamId: steamId,
        }),
        createKill({
          tick: 6000,
          roundNumber: 1,
          attackerSteamId: "teammate1",
          victimSteamId: "enemy1",
        }),
      ];

      const result = calculateOpeningDuels({
        steamId,
        allKills,
        totalRounds: 1,
        tickRate,
      });

      expect(result.wins).toBe(0);
      expect(result.losses).toBe(1);
      expect(result.total).toBe(1);
      expect(result.winRate).toBe(0);
    });

    it("should not count as opening if not involved in first kill", () => {
      const allKills: KillInput[] = [
        createKill({
          tick: 5000,
          roundNumber: 1,
          attackerSteamId: "teammate1",
          victimSteamId: "enemy1",
        }),
        createKill({
          tick: 6000,
          roundNumber: 1,
          attackerSteamId: steamId,
          victimSteamId: "enemy2",
        }),
      ];

      const result = calculateOpeningDuels({
        steamId,
        allKills,
        totalRounds: 1,
        tickRate,
      });

      expect(result.total).toBe(0);
      expect(result.wins).toBe(0);
      expect(result.losses).toBe(0);
    });

    it("should calculate opening duel statistics across multiple rounds", () => {
      const allKills: KillInput[] = [
        // Round 1: Win
        createKill({
          tick: 5000,
          roundNumber: 1,
          attackerSteamId: steamId,
          victimSteamId: "enemy1",
        }),
        // Round 2: Loss
        createKill({
          tick: 10000,
          roundNumber: 2,
          attackerSteamId: "enemy1",
          victimSteamId: steamId,
        }),
        // Round 3: Win
        createKill({
          tick: 15000,
          roundNumber: 3,
          attackerSteamId: steamId,
          victimSteamId: "enemy2",
        }),
        // Round 4: Not involved
        createKill({
          tick: 20000,
          roundNumber: 4,
          attackerSteamId: "teammate1",
          victimSteamId: "enemy3",
        }),
      ];

      const result = calculateOpeningDuels({
        steamId,
        allKills,
        totalRounds: 4,
        tickRate,
      });

      expect(result.total).toBe(3);
      expect(result.wins).toBe(2);
      expect(result.losses).toBe(1);
      expect(result.winRate).toBeCloseTo(66.67, 1);
    });

    it("should track side-specific stats", () => {
      const playerTeamByRound = new Map<number, number>([
        [1, 3], // CT
        [2, 3], // CT
        [3, 2], // T
      ]);

      const allKills: KillInput[] = [
        createKill({
          tick: 5000,
          roundNumber: 1,
          attackerSteamId: steamId,
          victimSteamId: "enemy1",
        }),
        createKill({
          tick: 10000,
          roundNumber: 2,
          attackerSteamId: "enemy1",
          victimSteamId: steamId,
        }),
        createKill({
          tick: 15000,
          roundNumber: 3,
          attackerSteamId: steamId,
          victimSteamId: "enemy2",
        }),
      ];

      const result = calculateOpeningDuels({
        steamId,
        allKills,
        totalRounds: 3,
        tickRate,
        playerTeamByRound,
      });

      // CT: 1 win, 1 loss
      expect(result.bySide.ct.wins).toBe(1);
      expect(result.bySide.ct.losses).toBe(1);
      expect(result.bySide.ct.winRate).toBe(50);

      // T: 1 win
      expect(result.bySide.t.wins).toBe(1);
      expect(result.bySide.t.losses).toBe(0);
      expect(result.bySide.t.winRate).toBe(100);
    });

    it("should correlate opening duels with round wins", () => {
      const playerTeamByRound = new Map<number, number>([
        [1, 3],
        [2, 3],
        [3, 3],
        [4, 3],
      ]);

      const roundWinners = new Map<number, number>([
        [1, 3], // Won opening, won round
        [2, 2], // Won opening, lost round
        [3, 3], // Lost opening, won round
        [4, 2], // Lost opening, lost round
      ]);

      const allKills: KillInput[] = [
        createKill({
          tick: 5000,
          roundNumber: 1,
          attackerSteamId: steamId,
          victimSteamId: "enemy1",
        }),
        createKill({
          tick: 10000,
          roundNumber: 2,
          attackerSteamId: steamId,
          victimSteamId: "enemy1",
        }),
        createKill({
          tick: 15000,
          roundNumber: 3,
          attackerSteamId: "enemy1",
          victimSteamId: steamId,
        }),
        createKill({
          tick: 20000,
          roundNumber: 4,
          attackerSteamId: "enemy1",
          victimSteamId: steamId,
        }),
      ];

      const result = calculateOpeningDuels({
        steamId,
        allKills,
        totalRounds: 4,
        tickRate,
        playerTeamByRound,
        roundWinners,
      });

      expect(result.roundCorrelation.roundsWonAfterOpeningWin).toBe(1);
      expect(result.roundCorrelation.roundsLostAfterOpeningWin).toBe(1);
      expect(result.roundCorrelation.roundsWonAfterOpeningLoss).toBe(1);
      expect(result.roundCorrelation.roundsLostAfterOpeningLoss).toBe(1);
      expect(result.roundCorrelation.winRateAfterOpeningWin).toBe(50);
      expect(result.roundCorrelation.winRateAfterOpeningLoss).toBe(50);
    });

    it("should return empty metrics for empty input", () => {
      const result = calculateOpeningDuels({
        steamId,
        allKills: [],
        totalRounds: 0,
        tickRate,
      });

      expect(result.total).toBe(0);
      expect(result.wins).toBe(0);
      expect(result.losses).toBe(0);
      expect(result.winRate).toBe(0);
    });

    it("should calculate rating impact", () => {
      const allKills: KillInput[] = [
        createKill({
          tick: 5000,
          roundNumber: 1,
          attackerSteamId: steamId,
          victimSteamId: "enemy1",
        }),
        createKill({
          tick: 10000,
          roundNumber: 2,
          attackerSteamId: steamId,
          victimSteamId: "enemy1",
        }),
        createKill({
          tick: 15000,
          roundNumber: 3,
          attackerSteamId: "enemy1",
          victimSteamId: steamId,
        }),
      ];

      const result = calculateOpeningDuels({
        steamId,
        allKills,
        totalRounds: 10,
        tickRate,
      });

      // Rating impact = (wins * 0.15 + losses * -0.1) / totalRounds
      // = (2 * 0.15 + 1 * -0.1) / 10 = 0.02
      expect(result.ratingImpact).toBeCloseTo(0.02, 3);
    });

    it("should track duel events with details", () => {
      const playerNames = new Map<string, string>([
        [steamId, "TestPlayer"],
        ["enemy1", "Enemy1"],
      ]);

      const allKills: KillInput[] = [
        createKill({
          tick: 5000,
          roundNumber: 1,
          attackerSteamId: steamId,
          victimSteamId: "enemy1",
          weapon: "ak47",
          headshot: true,
        }),
      ];

      const result = calculateOpeningDuels({
        steamId,
        allKills,
        totalRounds: 1,
        tickRate,
        playerNames,
      });

      expect(result.duels).toHaveLength(1);
      expect(result.duels[0]!.weapon).toBe("ak47");
      expect(result.duels[0]!.headshot).toBe(true);
    });
  });

  describe("getOpeningLabel", () => {
    it("should return correct labels", () => {
      expect(getOpeningLabel(60)).toBe("Elite Entry");
      expect(getOpeningLabel(55)).toBe("Excellent");
      expect(getOpeningLabel(50)).toBe("Good");
      expect(getOpeningLabel(45)).toBe("Average");
      expect(getOpeningLabel(40)).toBe("Below Average");
      expect(getOpeningLabel(30)).toBe("Passive Player");
    });
  });

  describe("calculateTeamOpenings", () => {
    it("should aggregate team opening stats", () => {
      const playerOpenings = [
        {
          steamId: "p1",
          name: "Player1",
          openings: createOpeningMetrics({ wins: 3, losses: 1, total: 4 }),
        },
        {
          steamId: "p2",
          name: "Player2",
          openings: createOpeningMetrics({ wins: 2, losses: 2, total: 4 }),
        },
      ];

      const result = calculateTeamOpenings(playerOpenings);

      expect(result.totalWins).toBe(5);
      expect(result.totalLosses).toBe(3);
      expect(result.winRate).toBe(62.5); // 5/8
    });

    it("should identify primary entry fragger", () => {
      const playerOpenings = [
        {
          steamId: "p1",
          name: "Player1",
          openings: createOpeningMetrics({
            wins: 3,
            losses: 1,
            total: 4,
            winRate: 75,
          }),
        },
        {
          steamId: "p2",
          name: "Player2",
          openings: createOpeningMetrics({
            wins: 5,
            losses: 3,
            total: 8,
            winRate: 62.5,
          }),
        },
      ];

      const result = calculateTeamOpenings(playerOpenings);

      expect(result.primaryEntry?.steamId).toBe("p2"); // Most attempts
      expect(result.primaryEntry?.openingAttempts).toBe(8);
    });

    it("should return empty for no players", () => {
      const result = calculateTeamOpenings([]);

      expect(result.totalWins).toBe(0);
      expect(result.primaryEntry).toBeNull();
    });
  });
});

// ==============================================================================
// Test Helpers
// ==============================================================================

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

function createOpeningMetrics(
  overrides: {
    wins?: number;
    losses?: number;
    total?: number;
    winRate?: number;
  } = {},
) {
  return {
    total: overrides.total ?? 0,
    wins: overrides.wins ?? 0,
    losses: overrides.losses ?? 0,
    winRate: overrides.winRate ?? 0,
    ratingImpact: 0,
    bySide: {
      ct: { wins: 0, losses: 0, winRate: 0, total: 0 },
      t: { wins: 0, losses: 0, winRate: 0, total: 0 },
    },
    roundCorrelation: {
      roundsWonAfterOpeningWin: 0,
      roundsLostAfterOpeningWin: 0,
      winRateAfterOpeningWin: 0,
      roundsWonAfterOpeningLoss: 0,
      roundsLostAfterOpeningLoss: 0,
      winRateAfterOpeningLoss: 0,
    },
    duels: [],
  };
}
