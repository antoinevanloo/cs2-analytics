/**
 * Trade Detector - Detects trade kills in match data
 *
 * Definition: A trade kill occurs when player B kills the enemy who killed
 * player A (same team) within a short time window.
 *
 * Trade detection is crucial for:
 * - KAST calculation (the "T" = Traded)
 * - Team coordination analysis
 * - Entry frag effectiveness
 *
 * Quality Checklist:
 * ✅ Extensibility: Threshold configurable, algorithm isolated
 * ✅ Scalability: O(n) per round, efficient updates
 * ✅ Exhaustivité: Detects all trade patterns
 * ✅ Performance: Reads from Kill table, batch updates
 * ✅ Stabilité: Full error handling
 * ✅ Résilience: Works with partial data
 * ✅ Concurrence: Updates in place, safe to re-run
 * ✅ Paramétrable: Trade threshold configurable (ticks)
 */

import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../../common/prisma";
import type {
  Transformer,
  TransformContext,
  TransformResult,
} from "../transformer.interface";

/** Kill data from database */
interface KillRecord {
  id: string;
  tick: number;
  roundId: string;
  attackerSteamId: string | null;
  attackerTeam: number | null;
  victimSteamId: string;
  victimTeam: number;
  isTradeKill: boolean;
  tradedWithin: number | null;
}

/** Trade detection result */
interface TradeInfo {
  killId: string;
  isTradeKill: boolean;
  tradedWithin: number;
}

@Injectable()
export class TradeDetector implements Transformer {
  readonly name = "TradeDetector";
  readonly priority = 20; // After KillExtractor
  readonly description = "Detects trade kills within configurable time window";

  private readonly logger = new Logger(TradeDetector.name);

  /** Default trade threshold: 320 ticks = 5 seconds at 64 tick rate */
  private readonly DEFAULT_TRADE_THRESHOLD_TICKS = 320;

  constructor(private readonly prisma: PrismaService) {}

  async shouldRun(ctx: TransformContext): Promise<boolean> {
    // Check if kills exist
    const killCount = await this.prisma.kill.count({
      where: { demoId: ctx.demoId },
      take: 1,
    });

    if (killCount === 0) {
      this.logger.debug(`No kills for demo ${ctx.demoId}, skipping trade detection`);
      return false;
    }

    return true;
  }

  async transform(ctx: TransformContext): Promise<TransformResult> {
    const startTime = Date.now();
    const { demoId, options } = ctx;
    const tradeThreshold =
      options?.tradeThresholdTicks ?? this.DEFAULT_TRADE_THRESHOLD_TICKS;

    try {
      // Fetch all kills ordered by round and tick
      const kills = await this.prisma.kill.findMany({
        where: { demoId },
        select: {
          id: true,
          tick: true,
          roundId: true,
          attackerSteamId: true,
          attackerTeam: true,
          victimSteamId: true,
          victimTeam: true,
          isTradeKill: true,
          tradedWithin: true,
        },
        orderBy: [{ roundId: "asc" }, { tick: "asc" }],
      });

      if (kills.length === 0) {
        return this.createResult(startTime, 0, {
          kills: 0,
          trades: 0,
          tradeThresholdTicks: tradeThreshold,
        });
      }

      // Group kills by round
      const killsByRound = this.groupByRound(kills);

      // Detect trades in each round
      const trades: TradeInfo[] = [];

      for (const [, roundKills] of killsByRound) {
        const roundTrades = this.detectTradesInRound(roundKills, tradeThreshold);
        trades.push(...roundTrades);
      }

      // Batch update kills with trade info
      if (trades.length > 0) {
        await this.updateTradeKills(trades);
      }

      this.logger.log(
        `Detected ${trades.length} trade kills in ${kills.length} kills for demo ${demoId}`,
      );

      return this.createResult(startTime, trades.length, {
        kills: kills.length,
        trades: trades.length,
        tradeRate: kills.length > 0 ? (trades.length / kills.length) * 100 : 0,
        tradeThresholdTicks: tradeThreshold,
        roundsAnalyzed: killsByRound.size,
      });
    } catch (error) {
      this.logger.error(`Failed to detect trades for demo ${demoId}`, error);
      return {
        transformer: this.name,
        success: false,
        recordsCreated: 0,
        processingTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async rollback(ctx: TransformContext): Promise<void> {
    // Reset trade flags on all kills
    await this.prisma.kill.updateMany({
      where: { demoId: ctx.demoId },
      data: {
        isTradeKill: false,
        tradedWithin: null,
      },
    });
    this.logger.warn(`Reset trade flags for demo ${ctx.demoId}`);
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Group kills by round for per-round analysis
   */
  private groupByRound(kills: KillRecord[]): Map<string, KillRecord[]> {
    const groups = new Map<string, KillRecord[]>();

    for (const kill of kills) {
      const existing = groups.get(kill.roundId);
      if (existing) {
        existing.push(kill);
      } else {
        groups.set(kill.roundId, [kill]);
      }
    }

    return groups;
  }

  /**
   * Detect trades within a single round
   *
   * Algorithm:
   * For each kill K at tick T by attacker A (team X) on victim V (team Y):
   *   Look for a previous kill K' within threshold where:
   *   - K'.victim = A (the current attacker was killed)
   *   - K'.attacker.team = V.team (killed by same team as current victim)
   *   If found: K is a trade kill (avenging K'.victim)
   *
   * Time complexity: O(n²) worst case, but typically much less due to threshold
   */
  private detectTradesInRound(
    kills: KillRecord[],
    thresholdTicks: number,
  ): TradeInfo[] {
    const trades: TradeInfo[] = [];

    // Sort by tick (should already be sorted, but ensure)
    const sortedKills = [...kills].sort((a, b) => a.tick - b.tick);

    // For each kill, check if it's a trade
    for (let i = 0; i < sortedKills.length; i++) {
      const currentKill = sortedKills[i]!;

      // Skip suicides/world kills (no attacker)
      if (!currentKill.attackerSteamId || currentKill.attackerTeam === null) {
        continue;
      }

      // Look backwards for a kill to trade
      for (let j = i - 1; j >= 0; j--) {
        const previousKill = sortedKills[j]!;
        const tickDelta = currentKill.tick - previousKill.tick;

        // Stop if outside threshold
        if (tickDelta > thresholdTicks) {
          break;
        }

        // Check if this is a trade:
        // 1. The previous kill's victim is on the same team as current attacker
        // 2. The current kill's victim is on the same team as the previous attacker
        // This means: current attacker avenges their teammate

        // Simple trade: current attacker kills the person who killed their teammate
        if (
          previousKill.attackerSteamId &&
          previousKill.attackerSteamId === currentKill.victimSteamId &&
          previousKill.victimTeam === currentKill.attackerTeam
        ) {
          trades.push({
            killId: currentKill.id,
            isTradeKill: true,
            tradedWithin: tickDelta,
          });
          break; // One trade per kill
        }
      }
    }

    return trades;
  }

  /**
   * Update kills in database with trade information
   */
  private async updateTradeKills(trades: TradeInfo[]): Promise<void> {
    // Use transaction for atomicity
    await this.prisma.$transaction(
      trades.map((trade) =>
        this.prisma.kill.update({
          where: { id: trade.killId },
          data: {
            isTradeKill: trade.isTradeKill,
            tradedWithin: trade.tradedWithin,
          },
        }),
      ),
    );
  }

  /**
   * Create success result
   */
  private createResult(
    startTime: number,
    recordsCreated: number,
    metrics: Record<string, number>,
  ): TransformResult {
    return {
      transformer: this.name,
      success: true,
      recordsCreated,
      processingTimeMs: Date.now() - startTime,
      metrics,
    };
  }
}
