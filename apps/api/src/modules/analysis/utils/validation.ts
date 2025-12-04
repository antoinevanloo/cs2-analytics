/**
 * Validation Utilities - Input validation for calculators
 *
 * All public calculator functions should validate inputs before processing.
 * This ensures:
 * - Early failure with clear error messages
 * - No runtime crashes from null/undefined
 * - Consistent data quality
 *
 * @module analysis/utils/validation
 */

import type {
  KillInput,
  RoundPlayerStatsInput,
  MatchPlayerStatsInput,
} from "../types/inputs.types";
import { InvalidInputError, InsufficientDataError } from "./errors";
import { MINIMUM_ROUNDS } from "../types/constants";

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate round stats array
 */
export function validateRoundStats(
  roundStats: unknown,
  fieldName: string = "roundStats"
): asserts roundStats is readonly RoundPlayerStatsInput[] {
  if (!Array.isArray(roundStats)) {
    throw new InvalidInputError(
      `${fieldName} must be an array`,
      fieldName,
      { received: typeof roundStats }
    );
  }

  for (let i = 0; i < roundStats.length; i++) {
    const round = roundStats[i];
    if (!isValidRoundPlayerStats(round)) {
      throw new InvalidInputError(
        `Invalid round stats at index ${i}`,
        `${fieldName}[${i}]`,
        { round }
      );
    }
  }
}

/**
 * Validate kills array
 */
export function validateKills(
  kills: unknown,
  fieldName: string = "kills"
): asserts kills is readonly KillInput[] {
  if (!Array.isArray(kills)) {
    throw new InvalidInputError(
      `${fieldName} must be an array`,
      fieldName,
      { received: typeof kills }
    );
  }

  for (let i = 0; i < kills.length; i++) {
    const kill = kills[i];
    if (!isValidKillInput(kill)) {
      throw new InvalidInputError(
        `Invalid kill at index ${i}`,
        `${fieldName}[${i}]`,
        { kill }
      );
    }
  }
}

/**
 * Validate Steam ID format
 */
export function validateSteamId(
  steamId: unknown,
  fieldName: string = "steamId"
): asserts steamId is string {
  if (typeof steamId !== "string") {
    throw new InvalidInputError(
      `${fieldName} must be a string`,
      fieldName,
      { received: typeof steamId }
    );
  }

  if (steamId.length === 0) {
    throw new InvalidInputError(
      `${fieldName} cannot be empty`,
      fieldName
    );
  }

  // Steam64 IDs are 17 digits starting with 7656
  // We also accept Steam3 format [U:1:XXXXX]
  const isSteam64 = /^7656\d{13}$/.test(steamId);
  const isSteam3 = /^\[U:\d+:\d+\]$/.test(steamId);
  const isLegacy = /^STEAM_\d+:\d+:\d+$/.test(steamId);

  if (!isSteam64 && !isSteam3 && !isLegacy) {
    throw new InvalidInputError(
      `${fieldName} has invalid format`,
      fieldName,
      { received: steamId, expected: "Steam64, Steam3, or Legacy format" }
    );
  }
}

/**
 * Validate minimum rounds for reliable statistics
 */
export function validateMinimumRounds(
  actualRounds: number,
  metricType: keyof typeof MINIMUM_ROUNDS = "BASIC_STATS"
): void {
  const required = MINIMUM_ROUNDS[metricType];

  if (actualRounds < required) {
    throw new InsufficientDataError(
      `Insufficient rounds for ${metricType}. Need at least ${required}, got ${actualRounds}`,
      required,
      actualRounds,
      { metricType }
    );
  }
}

/**
 * Validate positive number
 */
export function validatePositiveNumber(
  value: unknown,
  fieldName: string
): asserts value is number {
  if (typeof value !== "number") {
    throw new InvalidInputError(
      `${fieldName} must be a number`,
      fieldName,
      { received: typeof value }
    );
  }

  if (isNaN(value)) {
    throw new InvalidInputError(
      `${fieldName} is NaN`,
      fieldName
    );
  }

  if (value < 0) {
    throw new InvalidInputError(
      `${fieldName} must be non-negative`,
      fieldName,
      { received: value }
    );
  }
}

/**
 * Validate tick rate
 */
export function validateTickRate(
  tickRate: unknown,
  fieldName: string = "tickRate"
): asserts tickRate is number {
  validatePositiveNumber(tickRate, fieldName);

  const validTickRates = [32, 64, 128];
  if (!validTickRates.includes(tickRate as number)) {
    throw new InvalidInputError(
      `${fieldName} must be 32, 64, or 128`,
      fieldName,
      { received: tickRate, valid: validTickRates }
    );
  }
}

/**
 * Type guard for RoundPlayerStatsInput
 */
function isValidRoundPlayerStats(obj: unknown): obj is RoundPlayerStatsInput {
  if (typeof obj !== "object" || obj === null) return false;

  const round = obj as Record<string, unknown>;

  return (
    typeof round.steamId === "string" &&
    typeof round.roundNumber === "number" &&
    typeof round.kills === "number" &&
    typeof round.deaths === "number" &&
    typeof round.assists === "number" &&
    typeof round.damage === "number" &&
    typeof round.survived === "boolean"
  );
}

/**
 * Type guard for KillInput
 */
function isValidKillInput(obj: unknown): obj is KillInput {
  if (typeof obj !== "object" || obj === null) return false;

  const kill = obj as Record<string, unknown>;

  return (
    typeof kill.tick === "number" &&
    typeof kill.victimSteamId === "string" &&
    typeof kill.weapon === "string" &&
    typeof kill.headshot === "boolean" &&
    typeof kill.roundNumber === "number"
  );
}

/**
 * Type guard for MatchPlayerStatsInput
 */
export function isValidMatchPlayerStats(
  obj: unknown
): obj is MatchPlayerStatsInput {
  if (typeof obj !== "object" || obj === null) return false;

  const stats = obj as Record<string, unknown>;

  return (
    typeof stats.steamId === "string" &&
    typeof stats.playerName === "string" &&
    typeof stats.kills === "number" &&
    typeof stats.deaths === "number" &&
    typeof stats.assists === "number" &&
    typeof stats.damage === "number"
  );
}

/**
 * Comprehensive validation for rating calculation input
 */
export function validateRatingInput(input: {
  steamId: unknown;
  roundStats: unknown;
  allKills: unknown;
  totalRounds: unknown;
  tickRate?: unknown;
}): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate steamId
  try {
    validateSteamId(input.steamId);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "Invalid steamId");
  }

  // Validate roundStats
  try {
    validateRoundStats(input.roundStats);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "Invalid roundStats");
  }

  // Validate kills
  try {
    validateKills(input.allKills);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "Invalid kills");
  }

  // Validate totalRounds
  try {
    validatePositiveNumber(input.totalRounds, "totalRounds");
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "Invalid totalRounds");
  }

  // Validate tickRate if provided
  if (input.tickRate !== undefined) {
    try {
      validateTickRate(input.tickRate);
    } catch (e) {
      warnings.push(
        `Invalid tickRate, using default: ${e instanceof Error ? e.message : "unknown error"}`
      );
    }
  }

  // Check for minimum rounds
  if (Array.isArray(input.roundStats) && input.roundStats.length < MINIMUM_ROUNDS.RATING) {
    warnings.push(
      `Only ${input.roundStats.length} rounds. Rating may be unreliable (recommend ${MINIMUM_ROUNDS.RATING}+)`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
