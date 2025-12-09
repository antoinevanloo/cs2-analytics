/**
 * Trade Detector Transformer Unit Tests
 *
 * Tests for the TradeDetector transformer which detects trade kills
 * and updates the Kill table with trade information.
 */

import { Test, TestingModule } from "@nestjs/testing";
import { TradeDetector } from "./trade.detector";
import { PrismaService } from "../../../../common/prisma";
import type { TransformContext } from "../transformer.interface";

describe("TradeDetector", () => {
  let tradeDetector: TradeDetector;
  let prismaService: PrismaService;

  // Mock data
  const mockDemoId = "test-demo-123";
  const mockRounds = [
    {
      id: "round-1",
      roundNumber: 1,
      startTick: 0,
      endTick: 3000,
    },
  ];
  const mockPlayers = [
    { steamId: "ct1", playerName: "CT Player 1", teamNum: 3, teamName: "CT" },
    { steamId: "ct2", playerName: "CT Player 2", teamNum: 3, teamName: "CT" },
    { steamId: "t1", playerName: "T Player 1", teamNum: 2, teamName: "T" },
    { steamId: "t2", playerName: "T Player 2", teamNum: 2, teamName: "T" },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradeDetector,
        {
          provide: PrismaService,
          useValue: {
            kill: {
              count: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    tradeDetector = module.get<TradeDetector>(TradeDetector);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe("metadata", () => {
    it("should have correct name", () => {
      expect(tradeDetector.name).toBe("TradeDetector");
    });

    it("should have priority 20", () => {
      expect(tradeDetector.priority).toBe(20);
    });

    it("should have description", () => {
      expect(tradeDetector.description).toBeTruthy();
    });
  });

  describe("shouldRun", () => {
    it("should return false if no kills exist", async () => {
      const ctx = createContext();
      jest.spyOn(prismaService.kill, "count").mockResolvedValue(0);

      const result = await tradeDetector.shouldRun(ctx);

      expect(result).toBe(false);
    });

    it("should return true if kills exist", async () => {
      const ctx = createContext();
      jest.spyOn(prismaService.kill, "count").mockResolvedValue(10);

      const result = await tradeDetector.shouldRun(ctx);

      expect(result).toBe(true);
    });
  });

  describe("transform", () => {
    it("should detect trade kill within threshold", async () => {
      const ctx = createContext();
      const mockKills = [
        // T1 kills CT1 at tick 1000
        createKillRecord({
          id: "kill-1",
          tick: 1000,
          roundId: "round-1",
          attackerSteamId: "t1",
          attackerTeam: 2,
          victimSteamId: "ct1",
          victimTeam: 3,
        }),
        // CT2 trades by killing T1 at tick 1200 (200 ticks = ~3s at 64 tick)
        createKillRecord({
          id: "kill-2",
          tick: 1200,
          roundId: "round-1",
          attackerSteamId: "ct2",
          attackerTeam: 3,
          victimSteamId: "t1",
          victimTeam: 2,
        }),
      ];

      jest.spyOn(prismaService.kill, "count").mockResolvedValue(2);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(prismaService.kill, "findMany").mockResolvedValue(mockKills as any);
      jest.spyOn(prismaService, "$transaction").mockResolvedValue(undefined);

      const result = await tradeDetector.transform(ctx);

      expect(result.success).toBe(true);
      // The second kill is a trade kill
      expect(result.recordsCreated).toBe(1);
    });

    it("should NOT detect trade kill outside threshold", async () => {
      const ctx = createContext();
      const mockKills = [
        createKillRecord({
          id: "kill-1",
          tick: 1000,
          roundId: "round-1",
          attackerSteamId: "t1",
          attackerTeam: 2,
          victimSteamId: "ct1",
          victimTeam: 3,
        }),
        // CT2 kills T1 at tick 2000 (1000 ticks = ~15s at 64 tick, outside 5s window)
        createKillRecord({
          id: "kill-2",
          tick: 2000,
          roundId: "round-1",
          attackerSteamId: "ct2",
          attackerTeam: 3,
          victimSteamId: "t1",
          victimTeam: 2,
        }),
      ];

      jest.spyOn(prismaService.kill, "count").mockResolvedValue(2);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(prismaService.kill, "findMany").mockResolvedValue(mockKills as any);
      jest.spyOn(prismaService, "$transaction").mockResolvedValue(undefined);

      const result = await tradeDetector.transform(ctx);

      expect(result.success).toBe(true);
      expect(result.recordsCreated).toBe(0);
    });

    it("should detect correct trade pattern (revenge kill)", async () => {
      const ctx = createContext();
      const mockKills = [
        // T1 kills CT1
        createKillRecord({
          id: "kill-1",
          tick: 1000,
          roundId: "round-1",
          attackerSteamId: "t1",
          attackerTeam: 2,
          victimSteamId: "ct1",
          victimTeam: 3,
        }),
        // CT2 (teammate of victim) kills T1 (the attacker) - this is a trade
        createKillRecord({
          id: "kill-2",
          tick: 1150,
          roundId: "round-1",
          attackerSteamId: "ct2",
          attackerTeam: 3,
          victimSteamId: "t1", // Same as attacker in kill-1
          victimTeam: 2,
        }),
      ];

      jest.spyOn(prismaService.kill, "count").mockResolvedValue(2);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(prismaService.kill, "findMany").mockResolvedValue(mockKills as any);
      jest.spyOn(prismaService, "$transaction").mockResolvedValue(undefined);

      const result = await tradeDetector.transform(ctx);

      expect(result.success).toBe(true);
      expect(result.recordsCreated).toBe(1);
    });

    it("should NOT count unrelated kills as trades", async () => {
      const ctx = createContext();
      const mockKills = [
        // T1 kills CT1
        createKillRecord({
          id: "kill-1",
          tick: 1000,
          roundId: "round-1",
          attackerSteamId: "t1",
          attackerTeam: 2,
          victimSteamId: "ct1",
          victimTeam: 3,
        }),
        // CT2 kills T2 (different T player, not the one who killed CT1)
        createKillRecord({
          id: "kill-2",
          tick: 1150,
          roundId: "round-1",
          attackerSteamId: "ct2",
          attackerTeam: 3,
          victimSteamId: "t2", // Different T player
          victimTeam: 2,
        }),
      ];

      jest.spyOn(prismaService.kill, "count").mockResolvedValue(2);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(prismaService.kill, "findMany").mockResolvedValue(mockKills as any);
      jest.spyOn(prismaService, "$transaction").mockResolvedValue(undefined);

      const result = await tradeDetector.transform(ctx);

      expect(result.success).toBe(true);
      expect(result.recordsCreated).toBe(0);
    });

    it("should handle empty kills array", async () => {
      const ctx = createContext();

      jest.spyOn(prismaService.kill, "count").mockResolvedValue(0);
      jest.spyOn(prismaService.kill, "findMany").mockResolvedValue([]);

      const result = await tradeDetector.transform(ctx);

      expect(result.success).toBe(true);
      expect(result.recordsCreated).toBe(0);
    });

    it("should handle database errors gracefully", async () => {
      const ctx = createContext();

      jest.spyOn(prismaService.kill, "count").mockResolvedValue(1);
      jest.spyOn(prismaService.kill, "findMany").mockRejectedValue(new Error("DB Error"));

      const result = await tradeDetector.transform(ctx);

      expect(result.success).toBe(false);
      expect(result.error).toBe("DB Error");
    });
  });

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  function createContext(overrides?: Partial<TransformContext>): TransformContext {
    return {
      demoId: mockDemoId,
      demo: {
        id: mockDemoId,
        mapName: "de_dust2",
        tickRate: 64,
        totalTicks: 100000,
      },
      events: [],
      rounds: mockRounds,
      players: mockPlayers,
      ...overrides,
    };
  }

  function createKillRecord(overrides: {
    id: string;
    tick: number;
    roundId: string;
    attackerSteamId: string;
    attackerTeam: number;
    victimSteamId: string;
    victimTeam: number;
  }) {
    return {
      id: overrides.id,
      tick: overrides.tick,
      roundId: overrides.roundId,
      attackerSteamId: overrides.attackerSteamId,
      attackerTeam: overrides.attackerTeam,
      victimSteamId: overrides.victimSteamId,
      victimTeam: overrides.victimTeam,
      isTradeKill: false,
      tradedWithin: null,
    };
  }
});
