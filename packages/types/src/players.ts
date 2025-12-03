/**
 * Player data type definitions and Zod schemas.
 *
 * Covers all 60+ player properties available tick-by-tick in CS2 demos.
 */

import { z } from "zod";
import { TeamNumSchema } from "./common.js";

// ============================================================================
// Player Identity
// ============================================================================

export const PlayerIdentitySchema = z.object({
  steamid: z.string(),
  name: z.string(),
  user_id: z.number().int().optional(),
  crosshair_code: z.string().nullable().optional(),
  clan_name: z.string().nullable().optional(),
});
export type PlayerIdentity = z.infer<typeof PlayerIdentitySchema>;

// ============================================================================
// Player Position & Movement
// ============================================================================

export const PlayerPositionSchema = z.object({
  X: z.number(),
  Y: z.number(),
  Z: z.number(),
  pitch: z.number(),
  yaw: z.number(),
  velocity_X: z.number().optional(),
  velocity_Y: z.number().optional(),
  velocity_Z: z.number().optional(),
});
export type PlayerPosition = z.infer<typeof PlayerPositionSchema>;

export const PlayerMovementStateSchema = z.object({
  is_walking: z.boolean().default(false),
  is_strafing: z.boolean().default(false),
  is_scoped: z.boolean().default(false),
  is_defusing: z.boolean().default(false),
  is_planting: z.boolean().default(false),
  ducking: z.boolean().default(false),
  ducked: z.boolean().default(false),
  duck_amount: z.number().min(0).max(1).default(0),
  in_duck_jump: z.boolean().default(false),
  last_place_name: z.string().nullable().optional(),
});
export type PlayerMovementState = z.infer<typeof PlayerMovementStateSchema>;

// ============================================================================
// Player Health & Armor
// ============================================================================

export const PlayerHealthSchema = z.object({
  health: z.number().int().min(0).max(100),
  life_state: z.number().int().optional(),
  is_alive: z.boolean(),
});
export type PlayerHealth = z.infer<typeof PlayerHealthSchema>;

export const PlayerArmorSchema = z.object({
  armor_value: z.number().int().min(0).max(100),
  has_helmet: z.boolean(),
  has_defuser: z.boolean(),
});
export type PlayerArmor = z.infer<typeof PlayerArmorSchema>;

// ============================================================================
// Player Weapons
// ============================================================================

export const ActiveWeaponSchema = z.object({
  active_weapon_name: z.string().nullable(),
  active_weapon_ammo: z.number().int().nullable(),
  active_weapon_reserve_ammo: z.number().int().nullable(),
  active_weapon_original_owner: z.string().nullable(),
  active_weapon_silencer_on: z.boolean().nullable(),
  active_weapon_zoom_level: z.number().int().min(0).max(2).nullable(),
  active_weapon_max_ammo: z.number().int().nullable(),
  active_weapon_skin: z.string().nullable(),
  active_weapon_skin_name: z.string().nullable(),
  active_weapon_paint_seed: z.number().int().nullable(),
  active_weapon_paint_wear: z.number().nullable(),
  active_weapon_stattrak_kills: z.number().int().nullable(),
  active_weapon_quality: z.number().int().nullable(),
});
export type ActiveWeapon = z.infer<typeof ActiveWeaponSchema>;

// ============================================================================
// Player Economy
// ============================================================================

export const PlayerEconomySchema = z.object({
  balance: z.number().int().min(0),
  current_equip_value: z.number().int().min(0),
  total_cash_spent: z.number().int().min(0),
  round_start_equip_value: z.number().int().min(0).optional(),
  cash_spent_this_round: z.number().int().min(0).optional(),
});
export type PlayerEconomy = z.infer<typeof PlayerEconomySchema>;

// ============================================================================
// Player Combat Statistics
// ============================================================================

export const PlayerCombatStatsSchema = z.object({
  kills_total: z.number().int().min(0),
  deaths_total: z.number().int().min(0),
  assists_total: z.number().int().min(0),
  headshot_kills_total: z.number().int().min(0),
  ace_rounds_total: z.number().int().min(0).optional(),
  "4k_rounds_total": z.number().int().min(0).optional(),
  "3k_rounds_total": z.number().int().min(0).optional(),
  damage_total: z.number().int().min(0),
  objective_total: z.number().int().min(0).optional(),
  utility_damage_total: z.number().int().min(0).optional(),
  enemies_flashed_total: z.number().int().min(0).optional(),
  mvps: z.number().int().min(0),
  score: z.number().int().min(0),
});
export type PlayerCombatStats = z.infer<typeof PlayerCombatStatsSchema>;

export const PlayerRoundStatsSchema = z.object({
  kills_this_round: z.number().int().min(0),
  deaths_this_round: z.number().int().min(0),
  assists_this_round: z.number().int().min(0),
  damage_this_round: z.number().int().min(0),
});
export type PlayerRoundStats = z.infer<typeof PlayerRoundStatsSchema>;

// ============================================================================
// Player Utility State
// ============================================================================

export const PlayerUtilityStateSchema = z.object({
  flash_duration: z.number().min(0).default(0),
  flash_alpha: z.number().int().min(0).max(255).default(0),
  has_c4: z.boolean().default(false),
  spotted: z.boolean().default(false),
  spotted_by_mask: z.number().int().optional(),
});
export type PlayerUtilityState = z.infer<typeof PlayerUtilityStateSchema>;

// ============================================================================
// Player Inventory
// ============================================================================

export const PlayerInventorySchema = z.object({
  inventory: z.array(z.string()).optional(),
  has_primary: z.boolean().optional(),
  has_secondary: z.boolean().optional(),
  has_knife: z.boolean().optional(),
  has_zeus: z.boolean().optional(),
  has_smoke: z.boolean().optional(),
  has_flash: z.boolean().optional(),
  has_he: z.boolean().optional(),
  has_molotov: z.boolean().optional(),
  has_decoy: z.boolean().optional(),
  smoke_count: z.number().int().min(0).optional(),
  flash_count: z.number().int().min(0).optional(),
  he_count: z.number().int().min(0).optional(),
  molotov_count: z.number().int().min(0).optional(),
  decoy_count: z.number().int().min(0).optional(),
});
export type PlayerInventory = z.infer<typeof PlayerInventorySchema>;

// ============================================================================
// Player Team Info
// ============================================================================

export const PlayerTeamInfoSchema = z.object({
  team_num: TeamNumSchema,
  team_name: z.string().nullable().optional(),
  team_clan_name: z.string().nullable().optional(),
  team_rounds_won: z.number().int().min(0).optional(),
});
export type PlayerTeamInfo = z.infer<typeof PlayerTeamInfoSchema>;

// ============================================================================
// Player Flags
// ============================================================================

export const PlayerFlagsSchema = z.object({
  is_connected: z.boolean().default(true),
  is_controlling_bot: z.boolean().default(false),
  is_bot: z.boolean().default(false),
  is_hltv: z.boolean().default(false),
  is_coach: z.boolean().default(false),
  pending_team_num: TeamNumSchema.nullable().optional(),
  player_color: z.number().int().optional(),
  ever_played_on_team: z.boolean().optional(),
  spawn_time: z.number().optional(),
});
export type PlayerFlags = z.infer<typeof PlayerFlagsSchema>;

// ============================================================================
// Complete Player State (tick-by-tick)
// ============================================================================

export const PlayerTickStateSchema = z.object({
  // Identity
  steamid: z.string(),
  name: z.string(),
  tick: z.number().int(),

  // Position & Movement
  X: z.number(),
  Y: z.number(),
  Z: z.number(),
  pitch: z.number(),
  yaw: z.number(),
  velocity_X: z.number().optional(),
  velocity_Y: z.number().optional(),
  velocity_Z: z.number().optional(),

  // Movement state
  is_walking: z.boolean().optional(),
  is_scoped: z.boolean().optional(),
  ducking: z.boolean().optional(),

  // Health & Armor
  health: z.number().int(),
  armor_value: z.number().int().optional(),
  is_alive: z.boolean(),
  has_helmet: z.boolean().optional(),
  has_defuser: z.boolean().optional(),

  // Weapon
  active_weapon_name: z.string().nullable(),
  active_weapon_ammo: z.number().int().nullable(),

  // Team
  team_num: TeamNumSchema,

  // Utility
  flash_alpha: z.number().int().optional(),
  has_c4: z.boolean().optional(),

  // Location
  last_place_name: z.string().nullable().optional(),
});
export type PlayerTickState = z.infer<typeof PlayerTickStateSchema>;

// ============================================================================
// Player Match Summary
// ============================================================================

export const PlayerMatchSummarySchema = z.object({
  steamid: z.string(),
  name: z.string(),
  team_num: TeamNumSchema,
  team_name: z.string().nullable().optional(),
  clan_name: z.string().nullable().optional(),

  // Performance
  kills: z.number().int().min(0),
  deaths: z.number().int().min(0),
  assists: z.number().int().min(0),
  headshot_kills: z.number().int().min(0),
  mvps: z.number().int().min(0),
  score: z.number().int().min(0),

  // Computed stats
  kd_ratio: z.number().optional(),
  headshot_percentage: z.number().optional(),
  adr: z.number().optional(), // Average Damage per Round

  // Economy
  total_cash_spent: z.number().int().min(0),
  avg_equipment_value: z.number().min(0).optional(),

  // Advanced stats
  damage_dealt: z.number().int().min(0),
  utility_damage: z.number().int().min(0).optional(),
  enemies_flashed: z.number().int().min(0).optional(),
  flash_assists: z.number().int().min(0).optional(),

  // Opening duels
  first_kills: z.number().int().min(0).optional(),
  first_deaths: z.number().int().min(0).optional(),

  // Clutches
  clutches_won: z.number().int().min(0).optional(),
  clutches_played: z.number().int().min(0).optional(),

  // Trades
  traded_kills: z.number().int().min(0).optional(),
  trade_deaths: z.number().int().min(0).optional(),
});
export type PlayerMatchSummary = z.infer<typeof PlayerMatchSummarySchema>;

// ============================================================================
// Player Property Lists
// ============================================================================

export const ALL_PLAYER_PROPERTIES = [
  // Identity
  "steamid",
  "name",
  "user_id",
  "crosshair_code",
  "clan_name",

  // Position
  "X",
  "Y",
  "Z",
  "pitch",
  "yaw",
  "velocity_X",
  "velocity_Y",
  "velocity_Z",

  // Movement
  "is_walking",
  "is_strafing",
  "is_scoped",
  "is_defusing",
  "is_planting",
  "ducking",
  "ducked",
  "duck_amount",
  "in_duck_jump",
  "last_place_name",

  // Health
  "health",
  "life_state",
  "is_alive",

  // Armor
  "armor_value",
  "has_helmet",
  "has_defuser",

  // Weapons
  "active_weapon_name",
  "active_weapon_ammo",
  "active_weapon_reserve_ammo",
  "active_weapon_original_owner",
  "active_weapon_silencer_on",
  "active_weapon_zoom_level",
  "active_weapon_max_ammo",
  "active_weapon_skin",
  "active_weapon_skin_name",
  "active_weapon_paint_seed",
  "active_weapon_paint_wear",
  "active_weapon_stattrak_kills",
  "active_weapon_quality",

  // Economy
  "balance",
  "current_equip_value",
  "total_cash_spent",
  "round_start_equip_value",
  "cash_spent_this_round",

  // Combat stats
  "kills_total",
  "deaths_total",
  "assists_total",
  "headshot_kills_total",
  "ace_rounds_total",
  "4k_rounds_total",
  "3k_rounds_total",
  "damage_total",
  "objective_total",
  "utility_damage_total",
  "enemies_flashed_total",
  "mvps",
  "score",

  // Round stats
  "kills_this_round",
  "deaths_this_round",
  "assists_this_round",
  "damage_this_round",

  // Utility state
  "flash_duration",
  "flash_alpha",
  "has_c4",
  "spotted",
  "spotted_by_mask",

  // Team
  "team_num",
  "team_name",
  "team_clan_name",
  "team_rounds_won",

  // Flags
  "is_connected",
  "is_controlling_bot",
  "is_bot",
  "is_hltv",
  "is_coach",
  "pending_team_num",
  "player_color",
  "ever_played_on_team",
  "spawn_time",

  // Entity
  "entity_id",
  "player_pawn",
  "player_pawn_handle",
  "controller_handle",
  "tick",
] as const;

export const HIGH_FREQUENCY_PROPERTIES = [
  "steamid",
  "X",
  "Y",
  "Z",
  "pitch",
  "yaw",
  "velocity_X",
  "velocity_Y",
  "velocity_Z",
  "health",
  "armor_value",
  "is_alive",
  "active_weapon_name",
  "active_weapon_ammo",
  "is_scoped",
  "is_walking",
  "ducking",
  "flash_alpha",
  "tick",
] as const;

export const LOW_FREQUENCY_PROPERTIES = [
  "steamid",
  "name",
  "team_num",
  "balance",
  "kills_total",
  "deaths_total",
  "assists_total",
  "mvps",
  "score",
  "has_helmet",
  "has_defuser",
  "has_c4",
  "current_equip_value",
  "crosshair_code",
  "clan_name",
] as const;

export type PlayerProperty = (typeof ALL_PLAYER_PROPERTIES)[number];
export type HighFrequencyProperty = (typeof HIGH_FREQUENCY_PROPERTIES)[number];
export type LowFrequencyProperty = (typeof LOW_FREQUENCY_PROPERTIES)[number];
