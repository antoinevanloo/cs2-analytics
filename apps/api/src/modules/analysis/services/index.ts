/**
 * Analysis Services - Barrel exports
 *
 * Services layer that connects database to calculators.
 *
 * @module analysis/services
 */

// Data access service
export {
  MetricsDataService,
  type DemoMatchData,
  type PlayerMatchData,
} from "./metrics-data.service";

// Player metrics service
export {
  PlayerMetricsService,
  type PlayerMatchMetricsResult,
  type PlayerComparisonResult,
} from "./player-metrics.service";

// Match analysis service
export {
  MatchAnalysisService,
  type MatchOverviewResult,
  type TeamStats,
  type RoundAnalysisResult,
  type RoundBreakdown,
  type EconomyFlowResult,
  type TradeAnalysisResult,
} from "./match-analysis.service";

// Analysis storage service
export {
  AnalysisStorageService,
  type StoredAnalysisResults,
  type AnalysisRecord,
  type CreateAnalysisOptions,
  type AnalysisUpdatePayload,
} from "./analysis-storage.service";
