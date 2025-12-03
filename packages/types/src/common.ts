/**
 * Common types and enums used across the platform.
 */

import { z } from "zod";

// ============================================================================
// Enums
// ============================================================================

export const TeamSchema = z.enum(["T", "CT", "SPECTATOR", "UNASSIGNED"]);
export type Team = z.infer<typeof TeamSchema>;

export const TeamNumSchema = z.union([
  z.literal(0), // Unassigned
  z.literal(1), // Spectator
  z.literal(2), // Terrorist
  z.literal(3), // Counter-Terrorist
]);
export type TeamNum = z.infer<typeof TeamNumSchema>;

export const GameModeSchema = z.enum([
  "competitive",
  "premier",
  "wingman",
  "casual",
  "deathmatch",
  "custom",
  "unknown",
]);
export type GameMode = z.infer<typeof GameModeSchema>;

export const MapNameSchema = z.enum([
  "de_ancient",
  "de_anubis",
  "de_dust2",
  "de_inferno",
  "de_mirage",
  "de_nuke",
  "de_overpass",
  "de_vertigo",
  "de_train",
  "de_cache",
  "other",
]);
export type MapName = z.infer<typeof MapNameSchema>;

export const HitgroupSchema = z.enum([
  "generic",
  "head",
  "chest",
  "stomach",
  "left_arm",
  "right_arm",
  "left_leg",
  "right_leg",
  "neck",
  "gear",
]);
export type Hitgroup = z.infer<typeof HitgroupSchema>;

export const WeaponTypeSchema = z.enum([
  "knife",
  "pistol",
  "smg",
  "rifle",
  "shotgun",
  "sniper",
  "machinegun",
  "grenade",
  "equipment",
  "other",
]);
export type WeaponType = z.infer<typeof WeaponTypeSchema>;

// ============================================================================
// Common Schemas
// ============================================================================

export const SteamIdSchema = z.string().regex(/^\d{17}$/, "Invalid Steam ID format");
export type SteamId = z.infer<typeof SteamIdSchema>;

export const Vector3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});
export type Vector3 = z.infer<typeof Vector3Schema>;

export const PositionSchema = z.object({
  X: z.number(),
  Y: z.number(),
  Z: z.number(),
});
export type Position = z.infer<typeof PositionSchema>;

export const AimAnglesSchema = z.object({
  pitch: z.number().min(-90).max(90),
  yaw: z.number().min(0).max(360),
});
export type AimAngles = z.infer<typeof AimAnglesSchema>;

export const VelocitySchema = z.object({
  velocity_X: z.number(),
  velocity_Y: z.number(),
  velocity_Z: z.number(),
});
export type Velocity = z.infer<typeof VelocitySchema>;

// ============================================================================
// Weapon Definitions
// ============================================================================

export const WeaponNameSchema = z.enum([
  // Pistols
  "weapon_glock",
  "weapon_usp_silencer",
  "weapon_hkp2000",
  "weapon_p250",
  "weapon_elite",
  "weapon_fiveseven",
  "weapon_tec9",
  "weapon_cz75a",
  "weapon_deagle",
  "weapon_revolver",

  // SMGs
  "weapon_mac10",
  "weapon_mp9",
  "weapon_mp7",
  "weapon_mp5sd",
  "weapon_ump45",
  "weapon_p90",
  "weapon_bizon",

  // Rifles
  "weapon_galilar",
  "weapon_famas",
  "weapon_ak47",
  "weapon_m4a1",
  "weapon_m4a1_silencer",
  "weapon_sg556",
  "weapon_aug",

  // Snipers
  "weapon_ssg08",
  "weapon_awp",
  "weapon_scar20",
  "weapon_g3sg1",

  // Heavy
  "weapon_nova",
  "weapon_xm1014",
  "weapon_sawedoff",
  "weapon_mag7",
  "weapon_m249",
  "weapon_negev",

  // Grenades
  "weapon_flashbang",
  "weapon_hegrenade",
  "weapon_smokegrenade",
  "weapon_molotov",
  "weapon_incgrenade",
  "weapon_decoy",

  // Equipment
  "weapon_knife",
  "weapon_knife_t",
  "weapon_taser",
  "weapon_c4",

  // Other
  "weapon_world",
  "weapon_inferno",
]);
export type WeaponName = z.infer<typeof WeaponNameSchema>;

// ============================================================================
// Round End Reasons
// ============================================================================

export const RoundEndReasonSchema = z.enum([
  "target_bombed",
  "bomb_defused",
  "terrorists_win",
  "counter_terrorists_win",
  "terrorists_surrender",
  "counter_terrorists_surrender",
  "round_draw",
  "hostages_rescued",
  "all_hostages_rescued",
  "target_saved",
  "hostages_not_rescued",
  "unknown",
]);
export type RoundEndReason = z.infer<typeof RoundEndReasonSchema>;

// Map numeric reason codes to names
export const ROUND_END_REASON_MAP: Record<number, RoundEndReason> = {
  0: "target_bombed",
  1: "bomb_defused",
  4: "terrorists_win",
  7: "counter_terrorists_win",
  8: "terrorists_surrender",
  9: "counter_terrorists_surrender",
  10: "round_draw",
  12: "hostages_rescued",
  15: "all_hostages_rescued",
  16: "target_saved",
  17: "hostages_not_rescued",
};

// ============================================================================
// Utility Types
// ============================================================================

export const TimestampSchema = z.string().datetime();
export type Timestamp = z.infer<typeof TimestampSchema>;

export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  total: z.number().int().min(0).optional(),
  totalPages: z.number().int().min(0).optional(),
});
export type Pagination = z.infer<typeof PaginationSchema>;

export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
    message: z.string().optional(),
  });

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
