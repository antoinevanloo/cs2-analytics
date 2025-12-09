/**
 * Replay Event Generator - Creates ReplayEvents for 2D visualization
 *
 * Responsibility: Transform game events into ReplayEvent records
 * optimized for frontend rendering (bomb events, etc.)
 *
 * ## Architecture
 *
 * ReplayEvent is used ONLY for events without dedicated tables:
 * - BOMB_PLANT, BOMB_DEFUSE, BOMB_EXPLODE → ReplayEvent ✅
 * - KILL → dedicated `Kill` table (NOT here)
 * - GRENADE → dedicated `Grenade` table (NOT here)
 * - Future: FOOTSTEP, SHOT_FIRED for detailed replay
 *
 * The `replay.service.ts` aggregates data from:
 * 1. Kill table → kill events with full metadata
 * 2. Grenade table → grenade events with effectiveness stats
 * 3. ReplayEvent table → bomb events
 *
 * Quality Checklist:
 * ✅ Extensibility: Easy to add new event types via EVENT_TYPE_MAP
 * ✅ Scalability: Batch inserts, configurable batch size
 * ✅ Exhaustivité: Bomb events (kills/grenades have dedicated tables)
 * ✅ Performance: Single pass, O(n) complexity, batch DB operations
 * ✅ Stabilité: Full error handling, rollback support
 * ✅ Résilience: Handles missing coordinates gracefully
 * ✅ Concurrence: Idempotent (deletes before insert)
 * ✅ Paramétrable: Batch size configurable via options
 */

import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../../common/prisma";
import { ReplayEventType, Prisma } from "@prisma/client";
import type {
  Transformer,
  TransformContext,
  TransformResult,
  DemoEvent,
  RoundInfo,
} from "../transformer.interface";

@Injectable()
export class ReplayEventGenerator implements Transformer {
  readonly name = "ReplayEventGenerator";
  readonly priority = 30; // After other extractors
  readonly description = "Generates ReplayEvents for 2D visualization overlay";

  private readonly logger = new Logger(ReplayEventGenerator.name);

  /**
   * Event type mapping from parser to database
   *
   * NOTE: Only bomb events are mapped here.
   * - KILL → handled by KillExtractor → Kill table
   * - GRENADE → handled by GrenadeExtractor → Grenade table
   * - player_hurt → too many events, not stored
   */
  private readonly EVENT_TYPE_MAP: Record<string, ReplayEventType | null> = {
    bomb_planted: ReplayEventType.BOMB_PLANT,
    bomb_defused: ReplayEventType.BOMB_DEFUSE,
    bomb_exploded: ReplayEventType.BOMB_EXPLODE,
  };

  constructor(private readonly prisma: PrismaService) {}

  async shouldRun(ctx: TransformContext): Promise<boolean> {
    // Check if we have events to process
    const relevantEvents = ctx.events.filter(
      (e) => e.event_name && this.EVENT_TYPE_MAP[e.event_name] !== undefined,
    );

    if (relevantEvents.length === 0) {
      this.logger.debug(`No relevant events for demo ${ctx.demoId}`);
      return false;
    }

    return true;
  }

  async transform(ctx: TransformContext): Promise<TransformResult> {
    const startTime = Date.now();
    const { demoId, events, rounds, options } = ctx;
    const batchSize = options?.batchSize ?? 500;

    try {
      // Delete existing replay events for idempotency
      const deleted = await this.prisma.replayEvent.deleteMany({
        where: { demoId },
      });

      if (deleted.count > 0) {
        this.logger.debug(
          `Deleted ${deleted.count} existing ReplayEvents for demo ${demoId}`,
        );
      }

      // Build round lookup
      const findRoundForTick = (tick: number): RoundInfo | null => {
        return rounds.find((r) => tick >= r.startTick && tick <= r.endTick) ?? null;
      };

      // Transform events
      const replayEvents: Prisma.ReplayEventCreateManyInput[] = [];
      const metrics = {
        bombPlants: 0,
        bombDefuses: 0,
        bombExplodes: 0,
        skipped: 0,
      };

      for (const event of events) {
        const eventType = this.EVENT_TYPE_MAP[event.event_name || ""];
        if (!eventType) continue;

        const round = findRoundForTick(event.tick ?? 0);
        if (!round) {
          metrics.skipped++;
          continue;
        }

        const replayEvent = this.transformEvent(demoId, round.id, event, eventType);
        if (replayEvent) {
          replayEvents.push(replayEvent);

          // Track metrics
          switch (eventType) {
            case ReplayEventType.BOMB_PLANT:
              metrics.bombPlants++;
              break;
            case ReplayEventType.BOMB_DEFUSE:
              metrics.bombDefuses++;
              break;
            case ReplayEventType.BOMB_EXPLODE:
              metrics.bombExplodes++;
              break;
          }
        }
      }

      // Batch insert
      let inserted = 0;
      for (let i = 0; i < replayEvents.length; i += batchSize) {
        const batch = replayEvents.slice(i, i + batchSize);
        await this.prisma.replayEvent.createMany({
          data: batch,
          skipDuplicates: true,
        });
        inserted += batch.length;
      }

      this.logger.log(
        `Generated ${inserted} ReplayEvents for demo ${demoId} ` +
          `(${metrics.bombPlants} plants, ${metrics.bombDefuses} defuses, ${metrics.bombExplodes} explodes)`,
      );

      return {
        transformer: this.name,
        success: true,
        recordsCreated: inserted,
        processingTimeMs: Date.now() - startTime,
        metrics,
      };
    } catch (error) {
      this.logger.error(`Failed to generate replay events for demo ${demoId}`, error);
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
    await this.prisma.replayEvent.deleteMany({
      where: { demoId: ctx.demoId },
    });
    this.logger.warn(`Rolled back ReplayEvents for demo ${ctx.demoId}`);
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Transform a game event into a replay event
   * Only handles bomb events (kills use dedicated Kill table)
   */
  private transformEvent(
    demoId: string,
    roundId: string,
    event: DemoEvent,
    eventType: ReplayEventType,
  ): Prisma.ReplayEventCreateManyInput | null {
    const baseEvent = {
      demoId,
      roundId,
      type: eventType,
      tick: event.tick ?? 0,
    };

    switch (eventType) {
      case ReplayEventType.BOMB_PLANT:
      case ReplayEventType.BOMB_DEFUSE:
      case ReplayEventType.BOMB_EXPLODE:
        return this.transformBombEvent(baseEvent, event);

      default:
        return null;
    }
  }

  /**
   * Transform a bomb event for visualization
   */
  private transformBombEvent(
    base: { demoId: string; roundId: string; type: ReplayEventType; tick: number },
    event: DemoEvent,
  ): Prisma.ReplayEventCreateManyInput {
    // Bomb events use player position (the person planting/defusing)
    const playerX = this.extractCoord(event, "user_X", "x", "player_x");
    const playerY = this.extractCoord(event, "user_Y", "y", "player_y");
    const playerZ = this.extractCoord(event, "user_Z", "z", "player_z");

    return {
      ...base,
      x: playerX ?? 0,
      y: playerY ?? 0,
      z: playerZ ?? 0,
      data: {
        playerSteamId: String(
          event.player_steamid ??
            event.userid_steamid ??
            event.user_steamid ??
            "",
        ),
        playerName: String(
          event.player_name ?? event.userid_name ?? event.user_name ?? "",
        ),
        site: String(event.site ?? ""),
      },
    };
  }

  /**
   * Extract coordinate from event with multiple fallback field names
   */
  private extractCoord(event: DemoEvent, ...keys: string[]): number | null {
    for (const key of keys) {
      const value = event[key];
      if (typeof value === "number" && !isNaN(value)) {
        return value;
      }
    }
    return null;
  }
}
