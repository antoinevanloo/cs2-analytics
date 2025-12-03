/**
 * Round data type definitions and Zod schemas.
 */

import { z } from "zod";
import { TeamNumSchema, RoundEndReasonSchema } from "./common.js";

// ============================================================================
// Round Economy Types
// ============================================================================

export const RoundEconomyTypeSchema = z.enum([
  "pistol",
  "eco",
  "force_buy",
  "full_buy",
  "unknown",
]);
export type RoundEconomyType = z.infer<typeof RoundEconomyTypeSchema>;

// ============================================================================
// Round Info Schema
// ============================================================================

export const RoundInfoSchema = z.object({
  round_number: z.number().int().min(1),
  start_tick: z.number().int(),
  end_tick: z.number().int(),
  freeze_end_tick: z.number().int().nullable(),

  // Outcome
  winner_team: TeamNumSchema,
  win_reason: z.string(),
  end_reason_code: z.number().int(),
  end_reason_name: RoundEndReasonSchema.optional(),

  // Scores at round end
  ct_score: z.number().int().min(0),
  t_score: z.number().int().min(0),

  // Round type
  is_pistol_round: z.boolean().default(false),
  is_eco_round: z.boolean().default(false),
  is_force_buy: z.boolean().default(false),
  is_full_buy: z.boolean().default(false),
  round_economy_type: RoundEconomyTypeSchema.optional(),

  // Economy
  ct_equipment_value: z.number().int().min(0).default(0),
  t_equipment_value: z.number().int().min(0).default(0),
  ct_money_spent: z.number().int().min(0).default(0),
  t_money_spent: z.number().int().min(0).default(0),
  ct_avg_money: z.number().min(0).optional(),
  t_avg_money: z.number().min(0).optional(),

  // Combat
  kills_count: z.number().int().min(0).default(0),
  ct_kills: z.number().int().min(0).default(0),
  t_kills: z.number().int().min(0).default(0),

  // Bomb
  bomb_planted: z.boolean().default(false),
  bomb_plant_tick: z.number().int().nullable(),
  bomb_site: z.enum(["A", "B"]).nullable(),
  bomb_defused: z.boolean().default(false),
  bomb_exploded: z.boolean().default(false),
  bomb_time_remaining: z.number().nullable().optional(),

  // MVP
  mvp_steamid: z.string().nullable(),
  mvp_reason: z.number().int().nullable(),

  // Duration
  duration_ticks: z.number().int().optional(),
  duration_seconds: z.number().optional(),
});
export type RoundInfo = z.infer<typeof RoundInfoSchema>;

// ============================================================================
// Round Player Stats
// ============================================================================

export const RoundPlayerStatsSchema = z.object({
  steamid: z.string(),
  name: z.string(),
  team: TeamNumSchema,

  // Combat
  kills: z.number().int().min(0),
  deaths: z.number().int().min(0),
  assists: z.number().int().min(0),
  damage: z.number().int().min(0),
  headshot_kills: z.number().int().min(0).optional(),

  // ADR for this round
  adr: z.number().optional(),

  // Economy
  equipment_value: z.number().int().min(0),
  money_spent: z.number().int().min(0),
  start_balance: z.number().int().min(0).optional(),
  end_balance: z.number().int().min(0).optional(),

  // Utility
  enemies_flashed: z.number().int().min(0).optional(),
  utility_damage: z.number().int().min(0).optional(),
  grenades_thrown: z.number().int().min(0).optional(),

  // Opening duel
  first_kill: z.boolean().default(false),
  first_death: z.boolean().default(false),

  // Survival
  survived: z.boolean(),
  time_alive_ticks: z.number().int().optional(),

  // Clutch
  clutch_situation: z
    .object({
      vs_count: z.number().int().min(1).max(5),
      won: z.boolean(),
    })
    .nullable()
    .optional(),

  // Trade info
  was_traded: z.boolean().optional(),
  got_trade_kill: z.boolean().optional(),
});
export type RoundPlayerStats = z.infer<typeof RoundPlayerStatsSchema>;

// ============================================================================
// Detailed Round Data
// ============================================================================

export const RoundDetailedSchema = RoundInfoSchema.extend({
  // Player stats for this round
  player_stats: z.array(RoundPlayerStatsSchema).optional(),

  // Kill feed
  kills: z
    .array(
      z.object({
        tick: z.number().int(),
        attacker_steamid: z.string().nullable(),
        attacker_name: z.string().nullable(),
        victim_steamid: z.string(),
        victim_name: z.string(),
        weapon: z.string(),
        headshot: z.boolean(),
        penetrated: z.number().int(),
        assistedflash: z.boolean().optional(),
        noscope: z.boolean().optional(),
        thrusmoke: z.boolean().optional(),
        attackerblind: z.boolean().optional(),
      })
    )
    .optional(),

  // Grenades used
  grenades: z
    .array(
      z.object({
        type: z.string(),
        tick: z.number().int(),
        thrower_steamid: z.string(),
        X: z.number(),
        Y: z.number(),
        Z: z.number(),
      })
    )
    .optional(),

  // Plant/defuse attempts
  bomb_events: z
    .array(
      z.object({
        type: z.enum(["begin_plant", "abort_plant", "planted", "begin_defuse", "abort_defuse", "defused", "exploded"]),
        tick: z.number().int(),
        player_steamid: z.string().optional(),
        site: z.enum(["A", "B"]).optional(),
      })
    )
    .optional(),
});
export type RoundDetailed = z.infer<typeof RoundDetailedSchema>;

// ============================================================================
// Round Timeline Event
// ============================================================================

export const RoundTimelineEventSchema = z.object({
  tick: z.number().int(),
  time_in_round: z.number(), // Seconds since round start
  event_type: z.enum([
    "round_start",
    "freeze_end",
    "kill",
    "bomb_plant_start",
    "bomb_planted",
    "bomb_defuse_start",
    "bomb_defused",
    "bomb_exploded",
    "grenade",
    "player_flash",
    "round_end",
  ]),
  data: z.record(z.unknown()),
});
export type RoundTimelineEvent = z.infer<typeof RoundTimelineEventSchema>;

// ============================================================================
// Half Summary
// ============================================================================

export const HalfSummarySchema = z.object({
  half_number: z.number().int().min(1).max(6), // Support overtime
  start_round: z.number().int().min(1),
  end_round: z.number().int().min(1),

  ct_team_name: z.string(),
  t_team_name: z.string(),
  ct_score: z.number().int().min(0),
  t_score: z.number().int().min(0),

  // Rounds breakdown
  rounds_played: z.number().int().min(0),
  ct_rounds_won: z.number().int().min(0),
  t_rounds_won: z.number().int().min(0),

  // Economy
  ct_total_spent: z.number().int().min(0).optional(),
  t_total_spent: z.number().int().min(0).optional(),

  // Pistol round
  pistol_winner: TeamNumSchema.optional(),
});
export type HalfSummary = z.infer<typeof HalfSummarySchema>;

// ============================================================================
// Match Rounds Summary
// ============================================================================

export const MatchRoundsSummarySchema = z.object({
  total_rounds: z.number().int().min(0),
  ct_rounds_won: z.number().int().min(0),
  t_rounds_won: z.number().int().min(0),

  // By half
  halves: z.array(HalfSummarySchema),

  // Round type breakdown
  pistol_rounds: z.number().int().min(0),
  eco_rounds: z.number().int().min(0),
  force_buy_rounds: z.number().int().min(0),
  full_buy_rounds: z.number().int().min(0),

  // Bomb stats
  bombs_planted: z.number().int().min(0),
  bombs_defused: z.number().int().min(0),
  bombs_exploded: z.number().int().min(0),
  site_a_plants: z.number().int().min(0),
  site_b_plants: z.number().int().min(0),

  // Round win reasons
  win_reasons: z.record(z.number().int().min(0)),
});
export type MatchRoundsSummary = z.infer<typeof MatchRoundsSummarySchema>;

// ============================================================================
// Economy Thresholds
// ============================================================================

export const ECONOMY_THRESHOLDS = {
  ECO_MAX: 4000, // Max equipment value for eco
  FORCE_MAX: 12000, // Max equipment value for force buy
  FULL_BUY_MIN: 12000, // Min equipment value for full buy
  PISTOL_ROUND_MONEY: 800, // Starting money for pistol rounds
  LOSS_BONUS_BASE: 1400,
  LOSS_BONUS_INCREMENT: 500,
  LOSS_BONUS_MAX: 3400,
  PLANT_REWARD: 300,
  WIN_REWARD: 3250,
  BOMB_WIN_REWARD: 3500,
  DEFUSE_WIN_REWARD: 3250,
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

export function determineRoundEconomyType(
  teamEquipmentValue: number,
  isPistolRound: boolean
): RoundEconomyType {
  if (isPistolRound) return "pistol";
  if (teamEquipmentValue <= ECONOMY_THRESHOLDS.ECO_MAX) return "eco";
  if (teamEquipmentValue <= ECONOMY_THRESHOLDS.FORCE_MAX) return "force_buy";
  if (teamEquipmentValue >= ECONOMY_THRESHOLDS.FULL_BUY_MIN) return "full_buy";
  return "unknown";
}
