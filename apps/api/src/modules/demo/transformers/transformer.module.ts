/**
 * Transformer Module - NestJS module for demo data transformers
 *
 * Registers all transformers and makes them available for dependency injection.
 * The orchestrator auto-discovers transformers via the TRANSFORMERS token.
 *
 * Adding a new transformer:
 * 1. Create transformer class implementing Transformer interface
 * 2. Add to this module's providers
 * 3. Add to transformers array in useFactory
 *
 * Quality: Follows NestJS best practices for modular architecture
 */

import { Module } from "@nestjs/common";
import { PrismaModule } from "../../../common/prisma";

// Orchestrator
import { TransformerOrchestrator, TRANSFORMERS } from "./transformer.orchestrator";

// Extractors
import { KillExtractor } from "./extractors/kill.extractor";
import { ReplayEventGenerator } from "./extractors/replay-event.generator";

// Computers
import { RoundStatsComputer } from "./computers/round-stats.computer";

// Analyzers
import { TradeDetector } from "./analyzers/trade.detector";
import { ClutchDetector } from "./analyzers/clutch.detector";

/**
 * All transformer classes - add new transformers here
 */
const TRANSFORMER_CLASSES = [
  KillExtractor,
  RoundStatsComputer,
  TradeDetector,
  ClutchDetector,
  ReplayEventGenerator,
];

@Module({
  imports: [PrismaModule],
  providers: [
    // Register all transformer classes as providers
    ...TRANSFORMER_CLASSES,

    // Provide transformers array for orchestrator injection
    {
      provide: TRANSFORMERS,
      useFactory: (
        killExtractor: KillExtractor,
        roundStatsComputer: RoundStatsComputer,
        tradeDetector: TradeDetector,
        clutchDetector: ClutchDetector,
        replayEventGenerator: ReplayEventGenerator,
      ) => [
        killExtractor,
        roundStatsComputer,
        tradeDetector,
        clutchDetector,
        replayEventGenerator,
      ],
      inject: TRANSFORMER_CLASSES,
    },

    // Orchestrator
    TransformerOrchestrator,
  ],
  exports: [
    TransformerOrchestrator,
    // Export individual transformers for direct use if needed
    ...TRANSFORMER_CLASSES,
  ],
})
export class TransformerModule {}
