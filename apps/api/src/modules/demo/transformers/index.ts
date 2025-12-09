/**
 * Transformers Module - Barrel exports
 *
 * Usage:
 * import { TransformerOrchestrator, TransformerModule } from './transformers';
 */

// Module
export { TransformerModule } from "./transformer.module";

// Orchestrator
export {
  TransformerOrchestrator,
  TRANSFORMERS,
} from "./transformer.orchestrator";

// Interfaces
export type {
  Transformer,
  TransformContext,
  TransformResult,
  TransformOptions,
  OrchestrationResult,
  DemoEvent,
  RoundInfo,
  PlayerInfo,
  DemoInfo,
  KillData,
  RoundPlayerStatsData,
  PlayerDeathEvent,
  PlayerHurtEvent,
} from "./transformer.interface";

// Extractors
export { KillExtractor } from "./extractors/kill.extractor";
export { ReplayEventGenerator } from "./extractors/replay-event.generator";

// Computers
export { RoundStatsComputer } from "./computers/round-stats.computer";

// Analyzers
export { TradeDetector } from "./analyzers/trade.detector";
export { ClutchDetector } from "./analyzers/clutch.detector";
