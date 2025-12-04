/**
 * Analysis Types - Barrel exports
 *
 * Central export point for all analysis type definitions.
 *
 * Usage:
 * ```typescript
 * import { HLTVRating2, CombatMetrics, PlayerMatchMetrics } from './types';
 * ```
 *
 * @module analysis/types
 */

// Input types (raw data from database)
export * from "./inputs.types";

// Constants and configuration
export * from "./constants";

// Core metric types
export * from "./combat.types";
export * from "./rating.types";
export * from "./trade.types";
export * from "./opening.types";
export * from "./clutch.types";
export * from "./utility.types";
export * from "./economy.types";

// Aggregated types
export * from "./player.types";
export * from "./team.types";

// Cross-demo aggregation types
export * from "./aggregation.types";
