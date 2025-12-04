/**
 * Game event type definitions and Zod schemas.
 *
 * Covers all 40+ game events available in CS2 demos.
 */

import { z } from "zod";
import { TeamNumSchema, HitgroupSchema } from "./common.js";

// ============================================================================
// Base Event Schema
// ============================================================================

export const BaseEventSchema = z.object({
  event_name: z.string(),
  tick: z.number().int(),
  game_time: z.number().optional(),
});
export type BaseEvent = z.infer<typeof BaseEventSchema>;

// ============================================================================
// Combat Events
// ============================================================================

export const PlayerDeathEventSchema = BaseEventSchema.extend({
  event_name: z.literal("player_death"),

  // Attacker info
  attacker_steamid: z.string().nullable(),
  attacker_name: z.string().nullable(),
  attacker_team: TeamNumSchema.nullable(),
  attacker_X: z.number().nullable(),
  attacker_Y: z.number().nullable(),
  attacker_Z: z.number().nullable(),
  attacker_pitch: z.number().nullable(),
  attacker_yaw: z.number().nullable(),

  // Victim info
  victim_steamid: z.string(),
  victim_name: z.string(),
  victim_team: TeamNumSchema,
  victim_X: z.number(),
  victim_Y: z.number(),
  victim_Z: z.number(),

  // Assister info
  assister_steamid: z.string().nullable(),
  assister_name: z.string().nullable(),

  // Kill details
  weapon: z.string(),
  weapon_skin: z.string().nullable(),
  headshot: z.boolean().default(false),
  penetrated: z.number().int().default(0),
  noscope: z.boolean().default(false),
  thrusmoke: z.boolean().default(false),
  attackerblind: z.boolean().default(false),
  is_bomb_planted: z.boolean().default(false),
  distance: z.number().nullable(),

  // Special kills
  dominated: z.boolean().default(false),
  revenge: z.boolean().default(false),
  assistedflash: z.boolean().default(false),

  // Computed
  is_suicide: z.boolean().default(false),
  is_teamkill: z.boolean().default(false),
});
export type PlayerDeathEvent = z.infer<typeof PlayerDeathEventSchema>;

export const PlayerHurtEventSchema = BaseEventSchema.extend({
  event_name: z.literal("player_hurt"),

  // Attacker info
  attacker_steamid: z.string().nullable(),
  attacker_name: z.string().nullable(),
  attacker_team: TeamNumSchema.nullable(),
  attacker_X: z.number().nullable(),
  attacker_Y: z.number().nullable(),
  attacker_Z: z.number().nullable(),

  // Victim info
  victim_steamid: z.string(),
  victim_name: z.string(),
  victim_team: TeamNumSchema,
  victim_X: z.number(),
  victim_Y: z.number(),
  victim_Z: z.number(),

  // Damage info
  weapon: z.string(),
  damage_health: z.number().int(),
  damage_armor: z.number().int(),
  health_remaining: z.number().int(),
  armor_remaining: z.number().int(),
  hitgroup: z.number().int(),
  hitgroup_name: HitgroupSchema.optional(),
  is_fatal: z.boolean().optional(),
});
export type PlayerHurtEvent = z.infer<typeof PlayerHurtEventSchema>;

export const WeaponFireEventSchema = BaseEventSchema.extend({
  event_name: z.literal("weapon_fire"),
  steamid: z.string(),
  player_name: z.string(),
  team: TeamNumSchema,
  X: z.number(),
  Y: z.number(),
  Z: z.number(),
  pitch: z.number(),
  yaw: z.number(),
  weapon: z.string(),
  silenced: z.boolean().default(false),
});
export type WeaponFireEvent = z.infer<typeof WeaponFireEventSchema>;

export const PlayerBlindEventSchema = BaseEventSchema.extend({
  event_name: z.literal("player_blind"),
  attacker_steamid: z.string().nullable(),
  attacker_name: z.string().nullable(),
  attacker_team: TeamNumSchema.nullable(),
  victim_steamid: z.string(),
  victim_name: z.string(),
  victim_team: TeamNumSchema,
  blind_duration: z.number(),
  is_teammate_flash: z.boolean().default(false),
});
export type PlayerBlindEvent = z.infer<typeof PlayerBlindEventSchema>;

// ============================================================================
// Bomb Events
// ============================================================================

export const BombPlantedEventSchema = BaseEventSchema.extend({
  event_name: z.literal("bomb_planted"),
  planter_steamid: z.string(),
  planter_name: z.string(),
  planter_team: TeamNumSchema,
  site: z.enum(["A", "B"]),
  X: z.number(),
  Y: z.number(),
  Z: z.number(),
});
export type BombPlantedEvent = z.infer<typeof BombPlantedEventSchema>;

export const BombDefusedEventSchema = BaseEventSchema.extend({
  event_name: z.literal("bomb_defused"),
  defuser_steamid: z.string(),
  defuser_name: z.string(),
  defuser_team: TeamNumSchema,
  site: z.enum(["A", "B"]),
  with_kit: z.boolean(),
});
export type BombDefusedEvent = z.infer<typeof BombDefusedEventSchema>;

export const BombExplodedEventSchema = BaseEventSchema.extend({
  event_name: z.literal("bomb_exploded"),
  site: z.enum(["A", "B"]),
  planter_steamid: z.string().nullable(),
});
export type BombExplodedEvent = z.infer<typeof BombExplodedEventSchema>;

export const BombBeginPlantEventSchema = BaseEventSchema.extend({
  event_name: z.literal("bomb_beginplant"),
  planter_steamid: z.string(),
  planter_name: z.string(),
  site: z.enum(["A", "B"]),
  X: z.number(),
  Y: z.number(),
  Z: z.number(),
});
export type BombBeginPlantEvent = z.infer<typeof BombBeginPlantEventSchema>;

export const BombBeginDefuseEventSchema = BaseEventSchema.extend({
  event_name: z.literal("bomb_begindefuse"),
  defuser_steamid: z.string(),
  defuser_name: z.string(),
  has_kit: z.boolean(),
});
export type BombBeginDefuseEvent = z.infer<typeof BombBeginDefuseEventSchema>;

// ============================================================================
// Grenade Events
// ============================================================================

export const GrenadeDetonateBaseSchema = BaseEventSchema.extend({
  thrower_steamid: z.string(),
  thrower_name: z.string(),
  thrower_team: TeamNumSchema,
  X: z.number(),
  Y: z.number(),
  Z: z.number(),
  entity_id: z.number().int().optional(),
});

export const SmokeGrenadeEventSchema = GrenadeDetonateBaseSchema.extend({
  event_name: z.literal("smokegrenade_detonate"),
});
export type SmokeGrenadeEvent = z.infer<typeof SmokeGrenadeEventSchema>;

export const FlashbangEventSchema = GrenadeDetonateBaseSchema.extend({
  event_name: z.literal("flashbang_detonate"),
  players_blinded: z
    .array(
      z.object({
        steamid: z.string(),
        name: z.string(),
        duration: z.number(),
        is_enemy: z.boolean(),
      }),
    )
    .default([]),
  enemies_blinded: z.number().int().default(0),
  teammates_blinded: z.number().int().default(0),
  total_blind_duration: z.number().default(0),
});
export type FlashbangEvent = z.infer<typeof FlashbangEventSchema>;

export const HEGrenadeEventSchema = GrenadeDetonateBaseSchema.extend({
  event_name: z.literal("hegrenade_detonate"),
  players_damaged: z
    .array(
      z.object({
        steamid: z.string(),
        name: z.string(),
        damage: z.number().int(),
        is_enemy: z.boolean(),
      }),
    )
    .default([]),
  total_damage: z.number().int().default(0),
  enemies_damaged: z.number().int().default(0),
});
export type HEGrenadeEvent = z.infer<typeof HEGrenadeEventSchema>;

export const MolotovEventSchema = GrenadeDetonateBaseSchema.extend({
  event_name: z.literal("molotov_detonate"),
  is_incendiary: z.boolean().default(false),
});
export type MolotovEvent = z.infer<typeof MolotovEventSchema>;

export const DecoyEventSchema = GrenadeDetonateBaseSchema.extend({
  event_name: z.enum(["decoy_started", "decoy_detonate"]),
});
export type DecoyEvent = z.infer<typeof DecoyEventSchema>;

export const InfernoEventSchema = BaseEventSchema.extend({
  event_name: z.enum(["inferno_startburn", "inferno_expire"]),
  X: z.number(),
  Y: z.number(),
  Z: z.number(),
  entity_id: z.number().int(),
});
export type InfernoEvent = z.infer<typeof InfernoEventSchema>;

// ============================================================================
// Round Events
// ============================================================================

export const RoundStartEventSchema = BaseEventSchema.extend({
  event_name: z.literal("round_start"),
  round_number: z.number().int(),
  timelimit: z.number().int(),
  objective: z.string().nullable(),
});
export type RoundStartEvent = z.infer<typeof RoundStartEventSchema>;

export const RoundEndEventSchema = BaseEventSchema.extend({
  event_name: z.literal("round_end"),
  round_number: z.number().int(),
  winner_team: TeamNumSchema,
  reason: z.number().int(),
  reason_name: z.string().optional(),
  message: z.string(),
  ct_score: z.number().int(),
  t_score: z.number().int(),
  winner_team_name: z.string().optional(),
});
export type RoundEndEvent = z.infer<typeof RoundEndEventSchema>;

export const RoundFreezeEndEventSchema = BaseEventSchema.extend({
  event_name: z.literal("round_freeze_end"),
});
export type RoundFreezeEndEvent = z.infer<typeof RoundFreezeEndEventSchema>;

export const RoundMVPEventSchema = BaseEventSchema.extend({
  event_name: z.literal("round_mvp"),
  steamid: z.string(),
  player_name: z.string(),
  team: TeamNumSchema,
  reason: z.number().int(),
});
export type RoundMVPEvent = z.infer<typeof RoundMVPEventSchema>;

// ============================================================================
// Player State Events
// ============================================================================

export const PlayerSpawnEventSchema = BaseEventSchema.extend({
  event_name: z.literal("player_spawn"),
  steamid: z.string(),
  player_name: z.string(),
  team: TeamNumSchema,
});
export type PlayerSpawnEvent = z.infer<typeof PlayerSpawnEventSchema>;

export const PlayerTeamEventSchema = BaseEventSchema.extend({
  event_name: z.literal("player_team"),
  steamid: z.string(),
  player_name: z.string(),
  old_team: TeamNumSchema,
  new_team: TeamNumSchema,
  disconnect: z.boolean().default(false),
});
export type PlayerTeamEvent = z.infer<typeof PlayerTeamEventSchema>;

export const ItemPickupEventSchema = BaseEventSchema.extend({
  event_name: z.literal("item_pickup"),
  steamid: z.string(),
  player_name: z.string(),
  team: TeamNumSchema,
  item: z.string(),
  silent: z.boolean().default(false),
  defindex: z.number().int().nullable(),
});
export type ItemPickupEvent = z.infer<typeof ItemPickupEventSchema>;

export const ItemEquipEventSchema = BaseEventSchema.extend({
  event_name: z.literal("item_equip"),
  steamid: z.string(),
  player_name: z.string(),
  team: TeamNumSchema,
  item: z.string(),
  weptype: z.number().int(),
  hastracers: z.boolean().default(false),
  issilenced: z.boolean().default(false),
});
export type ItemEquipEvent = z.infer<typeof ItemEquipEventSchema>;

// ============================================================================
// Chat Events
// ============================================================================

export const ChatMessageEventSchema = BaseEventSchema.extend({
  event_name: z.literal("player_chat"),
  steamid: z.string(),
  player_name: z.string(),
  message: z.string(),
  is_all_chat: z.boolean(),
});
export type ChatMessageEvent = z.infer<typeof ChatMessageEventSchema>;

// ============================================================================
// Event Lists
// ============================================================================

export const ALL_EVENT_NAMES = [
  // Round events
  "round_start",
  "round_end",
  "round_freeze_end",
  "round_officially_ended",
  "round_mvp",
  "round_announce_match_start",
  "round_announce_last_round_half",
  "round_announce_match_point",
  "round_announce_final",
  "round_prestart",
  "round_poststart",
  "cs_round_start_beep",
  "cs_round_final_beep",

  // Combat events
  "player_death",
  "player_hurt",
  "player_blind",
  "other_death",
  "weapon_fire",
  "weapon_reload",
  "weapon_zoom",
  "silencer_detach",
  "silencer_on",
  "item_pickup",
  "item_remove",
  "item_equip",

  // Bomb events
  "bomb_planted",
  "bomb_defused",
  "bomb_exploded",
  "bomb_dropped",
  "bomb_pickup",
  "bomb_beginplant",
  "bomb_abortplant",
  "bomb_begindefuse",
  "bomb_abortdefuse",
  "bombsite_enter",
  "bombsite_exit",

  // Grenade events
  "smokegrenade_detonate",
  "smokegrenade_expired",
  "flashbang_detonate",
  "hegrenade_detonate",
  "molotov_detonate",
  "decoy_started",
  "decoy_detonate",
  "decoy_firing",
  "inferno_startburn",
  "inferno_expire",
  "grenade_thrown",

  // Economy events
  "cs_win_panel_round",
  "cs_win_panel_match",
  "announce_phase_end",

  // Player state events
  "player_spawn",
  "player_team",
  "player_connect",
  "player_disconnect",
  "player_footstep",
  "player_jump",
  "player_falldamage",
  "enter_buyzone",
  "exit_buyzone",
  "enter_bombzone",
  "exit_bombzone",
  "enter_rescue_zone",
  "exit_rescue_zone",
  "player_given_c4",

  // Game events
  "begin_new_match",
  "game_start",
  "game_end",
  "game_newmap",
  "server_spawn",
  "cs_game_disconnected",
  "cs_match_end_restart",
  "switch_team",
  "match_end_conditions",
  "cs_pre_restart",
  "announce_warmup",
  "warmup_end",
  "cs_intermission",

  // Chat events
  "player_chat",
  "player_say",
  "say_team",

  // Hostage events
  "hostage_follows",
  "hostage_hurt",
  "hostage_killed",
  "hostage_rescued",
  "hostage_stops_following",
  "hostage_rescued_all",
  "hostage_call_for_help",
] as const;

export const EventNameSchema = z.enum(ALL_EVENT_NAMES);
export type EventName = z.infer<typeof EventNameSchema>;

export const ESSENTIAL_EVENT_NAMES = [
  "round_start",
  "round_end",
  "round_freeze_end",
  "player_death",
  "player_hurt",
  "player_blind",
  "weapon_fire",
  "bomb_planted",
  "bomb_defused",
  "bomb_exploded",
  "bomb_beginplant",
  "bomb_begindefuse",
  "smokegrenade_detonate",
  "flashbang_detonate",
  "hegrenade_detonate",
  "molotov_detonate",
  "inferno_startburn",
  "inferno_expire",
  "grenade_thrown",
  "player_spawn",
  "player_team",
  "round_mvp",
] as const;

// ============================================================================
// Generic Event Schema (for unknown/dynamic events)
// ============================================================================

export const GameEventSchema = BaseEventSchema.passthrough();
export type GameEvent = z.infer<typeof GameEventSchema>;
