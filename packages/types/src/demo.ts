/**
 * Demo file and parsing related type definitions.
 */

import { z } from "zod";
import { GameModeSchema } from "./common.js";
import { PlayerMatchSummarySchema } from "./players.js";
import { RoundInfoSchema } from "./rounds.js";
import { GameEventSchema } from "./events.js";

// ============================================================================
// Demo Metadata
// ============================================================================

export const DemoMetadataSchema = z.object({
  // File info
  demo_file_name: z.string(),
  demo_file_size: z.number().int().min(0),
  demo_file_hash: z.string().nullable(),
  parse_timestamp: z.string().datetime(),
  parser_version: z.string(),

  // Match info
  map_name: z.string(),
  game_mode: GameModeSchema,
  match_id: z.string().nullable(),
  server_name: z.string().nullable(),

  // Timing
  tick_rate: z.number().int().default(64),
  total_ticks: z.number().int().min(0),
  duration_seconds: z.number().min(0),
  match_date: z.string().datetime().nullable(),

  // Scores
  team1_name: z.string().default("Team 1"),
  team2_name: z.string().default("Team 2"),
  team1_score: z.number().int().min(0).default(0),
  team2_score: z.number().int().min(0).default(0),
  team1_first_half_score: z.number().int().min(0).default(0),
  team2_first_half_score: z.number().int().min(0).default(0),

  // Network info
  demo_version: z.number().int().nullable(),
  network_protocol: z.number().int().nullable(),
  build_number: z.number().int().nullable(),

  // Players summary
  player_count: z.number().int().min(0).default(0),
  players: z.array(z.record(z.unknown())).default([]),
});
export type DemoMetadata = z.infer<typeof DemoMetadataSchema>;

// ============================================================================
// Tick Data
// ============================================================================

export const TickDataSchema = z.object({
  tick: z.number().int(),
  game_time: z.number(),
  players: z.array(z.record(z.unknown())),
});
export type TickData = z.infer<typeof TickDataSchema>;

// ============================================================================
// Grenade Data
// ============================================================================

export const GrenadeDataSchema = z.object({
  type: z.enum([
    "smoke",
    "flashbang",
    "hegrenade",
    "molotov",
    "incendiary",
    "decoy",
    "inferno",
  ]),
  event: z.string(),
  tick: z.number().int(),
  X: z.number(),
  Y: z.number(),
  Z: z.number(),
  thrower_steamid: z.string().optional(),
  thrower_name: z.string().optional(),
  thrower_team: z.number().int().optional(),
  entity_id: z.number().int().optional(),

  // Flash-specific
  players_blinded: z
    .array(
      z.object({
        steamid: z.string(),
        name: z.string(),
        duration: z.number(),
        is_enemy: z.boolean(),
      }),
    )
    .optional(),
  enemies_blinded: z.number().int().optional(),
  teammates_blinded: z.number().int().optional(),
  total_blind_duration: z.number().optional(),

  // HE-specific
  players_damaged: z
    .array(
      z.object({
        steamid: z.string(),
        name: z.string(),
        damage: z.number().int(),
        is_enemy: z.boolean(),
      }),
    )
    .optional(),
  total_damage: z.number().int().optional(),
  enemies_damaged: z.number().int().optional(),
});
export type GrenadeData = z.infer<typeof GrenadeDataSchema>;

// ============================================================================
// Chat Message
// ============================================================================

export const ChatMessageSchema = z.object({
  tick: z.number().int(),
  steamid: z.string(),
  name: z.string(),
  message: z.string(),
  is_all_chat: z.boolean(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// ============================================================================
// Parsed Demo (Complete Output)
// ============================================================================

export const ParsedDemoSchema = z.object({
  metadata: DemoMetadataSchema,
  players: z.array(PlayerMatchSummarySchema),
  rounds: z.array(RoundInfoSchema),
  events: z.array(GameEventSchema),
  ticks: z.array(TickDataSchema).nullable(),
  grenades: z.array(GrenadeDataSchema).default([]),
  chat_messages: z.array(ChatMessageSchema).default([]),
});
export type ParsedDemo = z.infer<typeof ParsedDemoSchema>;

// ============================================================================
// Streaming Chunk
// ============================================================================

export const StreamingChunkTypeSchema = z.enum([
  "metadata",
  "players",
  "rounds",
  "events",
  "ticks",
  "grenades",
  "chat",
]);
export type StreamingChunkType = z.infer<typeof StreamingChunkTypeSchema>;

export const StreamingChunkSchema = z.object({
  chunk_type: StreamingChunkTypeSchema,
  chunk_index: z.number().int().min(0),
  total_chunks: z.number().int().min(0).nullable(),
  data: z.record(z.unknown()),
});
export type StreamingChunk = z.infer<typeof StreamingChunkSchema>;

// ============================================================================
// Parse Request/Response
// ============================================================================

export const ParseRequestSchema = z.object({
  demo_path: z.string().nullable(),
  demo_url: z.string().url().nullable(),
  demo_id: z.string().nullable(),

  // Options
  extract_ticks: z.boolean().default(true),
  tick_interval: z.number().int().min(1).default(1),
  extract_grenades: z.boolean().default(true),
  extract_chat: z.boolean().default(true),
  properties: z.array(z.string()).nullable(),
  events: z.array(z.string()).nullable(),

  // Output
  output_format: z.enum(["json", "ndjson"]).default("ndjson"),
  compress: z.boolean().default(true),
  stream: z.boolean().default(false),
});
export type ParseRequest = z.infer<typeof ParseRequestSchema>;

export const ParseProgressSchema = z.object({
  demo_id: z.string(),
  status: z.enum([
    "queued",
    "parsing",
    "extracting_events",
    "extracting_ticks",
    "complete",
    "error",
  ]),
  progress_percent: z.number().min(0).max(100),
  current_tick: z.number().int().nullable(),
  total_ticks: z.number().int().nullable(),
  events_extracted: z.number().int().min(0).default(0),
  error_message: z.string().nullable(),
});
export type ParseProgress = z.infer<typeof ParseProgressSchema>;

export const ParseResultSchema = z.object({
  demo_id: z.string(),
  success: z.boolean(),
  output_path: z.string().nullable(),
  output_url: z.string().url().nullable(),
  metadata: DemoMetadataSchema.nullable(),
  error: z.string().nullable(),
  parse_time_seconds: z.number().min(0).default(0),
});
export type ParseResult = z.infer<typeof ParseResultSchema>;

// ============================================================================
// Demo Upload
// ============================================================================

export const DemoUploadSchema = z.object({
  file: z.instanceof(File).optional(), // For client-side
  filename: z.string(),
  size: z.number().int().min(0),
  content_type: z.string().default("application/octet-stream"),
});
export type DemoUpload = z.infer<typeof DemoUploadSchema>;

// ============================================================================
// Demo Storage
// ============================================================================

export const StoredDemoSchema = z.object({
  id: z.string().uuid(),
  original_filename: z.string(),
  storage_path: z.string(),
  storage_type: z.enum(["local", "s3"]),
  file_size: z.number().int().min(0),
  file_hash: z.string(),
  uploaded_at: z.string().datetime(),
  uploaded_by: z.string().nullable(),

  // Parsed status
  is_parsed: z.boolean().default(false),
  parsed_at: z.string().datetime().nullable(),
  parsed_output_path: z.string().nullable(),

  // Metadata (extracted after parsing)
  map_name: z.string().nullable(),
  game_mode: GameModeSchema.nullable(),
  duration_seconds: z.number().nullable(),
  player_count: z.number().int().nullable(),
  team1_score: z.number().int().nullable(),
  team2_score: z.number().int().nullable(),
});
export type StoredDemo = z.infer<typeof StoredDemoSchema>;

// ============================================================================
// Demo Analysis Job
// ============================================================================

export const AnalysisJobStatusSchema = z.enum([
  "pending",
  "downloading",
  "parsing",
  "analyzing",
  "completed",
  "failed",
]);
export type AnalysisJobStatus = z.infer<typeof AnalysisJobStatusSchema>;

export const AnalysisJobSchema = z.object({
  id: z.string().uuid(),
  demo_id: z.string().uuid(),
  status: AnalysisJobStatusSchema,
  progress: z.number().min(0).max(100).default(0),
  started_at: z.string().datetime().nullable(),
  completed_at: z.string().datetime().nullable(),
  error: z.string().nullable(),

  // Options
  analysis_types: z.array(z.string()), // e.g., ["basic", "advanced", "heatmaps"]

  // Results
  result_path: z.string().nullable(),
});
export type AnalysisJob = z.infer<typeof AnalysisJobSchema>;
