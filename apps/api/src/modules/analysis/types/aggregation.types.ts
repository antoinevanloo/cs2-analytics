/**
 * Aggregation Types - Cross-demo player and team statistics
 *
 * Comprehensive types for aggregating performance data across multiple matches.
 * Designed for scalability, extensibility, and precise statistical analysis.
 *
 * Architecture:
 * - PlayerProfile: Lifetime + recent stats for individual players
 * - TeamProfile: Roster-based team performance and synergy
 * - TimeWindow: Configurable time periods for trend analysis
 * - Percentile: Peer comparison and ranking
 *
 * @module analysis/types/aggregation
 */

// =============================================================================
// TIME WINDOWS & PERIODS
// =============================================================================

/**
 * Time window configuration for aggregation
 * Supports flexible periods for trend analysis
 */
export interface TimeWindow {
  /** Window identifier */
  readonly id: "all_time" | "last_90d" | "last_30d" | "last_7d" | "last_10_matches" | "last_20_matches";

  /** Human-readable label */
  readonly label: string;

  /** Start date (null = beginning) */
  readonly startDate: Date | null;

  /** End date (null = now) */
  readonly endDate: Date | null;

  /** Match limit (null = use dates only) */
  readonly matchLimit: number | null;
}

/**
 * Available time windows for aggregation
 */
export const TIME_WINDOWS: Record<string, Omit<TimeWindow, "startDate" | "endDate">> = {
  all_time: { id: "all_time", label: "All Time", matchLimit: null },
  last_90d: { id: "last_90d", label: "Last 90 Days", matchLimit: null },
  last_30d: { id: "last_30d", label: "Last 30 Days", matchLimit: null },
  last_7d: { id: "last_7d", label: "Last 7 Days", matchLimit: null },
  last_10_matches: { id: "last_10_matches", label: "Last 10 Matches", matchLimit: 10 },
  last_20_matches: { id: "last_20_matches", label: "Last 20 Matches", matchLimit: 20 },
} as const;

// =============================================================================
// PLAYER PROFILE - CORE STRUCTURE
// =============================================================================

/**
 * Complete aggregated player profile
 *
 * This is the main output structure for player aggregation.
 * Contains all dimensions of analysis across multiple matches.
 */
export interface AggregatedPlayerProfile {
  /** Player identification */
  readonly identity: PlayerIdentity;

  /** Aggregation period */
  readonly period: AggregationPeriod;

  /** Core statistics */
  readonly coreStats: AggregatedCoreStats;

  /** Combat analysis */
  readonly combat: AggregatedCombatStats;

  /** Rating and performance metrics */
  readonly performance: AggregatedPerformanceStats;

  /** Trade analysis */
  readonly trades: AggregatedTradeStats;

  /** Opening duel analysis */
  readonly openings: AggregatedOpeningStats;

  /** Clutch analysis */
  readonly clutches: AggregatedClutchStats;

  /** Utility usage analysis */
  readonly utility: AggregatedUtilityStats;

  /** Economy management */
  readonly economy: AggregatedEconomyStats;

  /** Map-specific breakdown */
  readonly byMap: readonly MapSpecificStats[];

  /** Weapon proficiency */
  readonly weapons: AggregatedWeaponStats;

  /** Role analysis */
  readonly role: PlayerRoleAnalysis;

  /** Form and trends */
  readonly form: PlayerFormAnalysis;

  /** Peer comparison (percentile ranks) */
  readonly percentiles: PlayerPercentiles;

  /** Consistency metrics */
  readonly consistency: ConsistencyMetrics;

  /** Peak performances */
  readonly peaks: PeakPerformances;

  /** Metadata */
  readonly metadata: AggregationMetadata;
}

/**
 * Player identification
 */
export interface PlayerIdentity {
  /** Steam ID (64-bit) */
  readonly steamId: string;

  /** Current display name */
  readonly displayName: string;

  /** Historical names used */
  readonly aliases: readonly string[];

  /** Avatar URL */
  readonly avatar: string | null;

  /** External platform IDs */
  readonly externalIds: {
    readonly faceitId: string | null;
    readonly faceitElo: number | null;
    readonly faceitLevel: number | null;
    readonly eseaId: string | null;
    readonly eseaRws: number | null;
  };
}

/**
 * Aggregation period details
 */
export interface AggregationPeriod {
  /** Time window used */
  readonly window: TimeWindow["id"];

  /** First match date in period */
  readonly firstMatch: Date;

  /** Last match date in period */
  readonly lastMatch: Date;

  /** Total matches in period */
  readonly matchCount: number;

  /** Total rounds in period */
  readonly roundCount: number;

  /** Days span */
  readonly daysSpan: number;
}

// =============================================================================
// AGGREGATED STATISTICS - DETAILED BREAKDOWN
// =============================================================================

/**
 * Core aggregated statistics
 */
export interface AggregatedCoreStats {
  /** Total kills */
  readonly totalKills: number;

  /** Total deaths */
  readonly totalDeaths: number;

  /** Total assists */
  readonly totalAssists: number;

  /** Total damage dealt */
  readonly totalDamage: number;

  /** Total headshot kills */
  readonly headshotKills: number;

  /** Total MVPs */
  readonly totalMvps: number;

  /** Match wins */
  readonly matchWins: number;

  /** Match losses */
  readonly matchLosses: number;

  /** Match draws */
  readonly matchDraws: number;

  /** Round wins */
  readonly roundWins: number;

  /** Round losses */
  readonly roundLosses: number;

  /** Calculated averages */
  readonly averages: {
    readonly killsPerMatch: number;
    readonly deathsPerMatch: number;
    readonly assistsPerMatch: number;
    readonly killsPerRound: number;
    readonly deathsPerRound: number;
    readonly damagePerRound: number; // ADR
    readonly headshotPercentage: number;
  };
}

/**
 * Aggregated combat statistics
 */
export interface AggregatedCombatStats {
  /** Kill/Death ratio */
  readonly kdRatio: number;

  /** Kill/Death difference */
  readonly kdDiff: number;

  /** Average damage per round (ADR) */
  readonly adr: number;

  /** Headshot percentage */
  readonly hsPercent: number;

  /** Multi-kill rounds breakdown */
  readonly multiKills: {
    readonly doubleKills: number;
    readonly tripleKills: number;
    readonly quadKills: number;
    readonly aces: number;
    readonly multiKillRounds: number; // Total rounds with 2+ kills
    readonly multiKillRate: number; // Percentage of rounds
  };

  /** Kill type breakdown */
  readonly killTypes: {
    readonly wallbangKills: number;
    readonly noscopeKills: number;
    readonly throughSmokeKills: number;
    readonly blindKills: number;
    readonly airborneKills: number;
  };

  /** Distance analysis */
  readonly distance: {
    readonly avgKillDistance: number;
    readonly shortRange: number; // <5m
    readonly mediumRange: number; // 5-20m
    readonly longRange: number; // >20m
  };

  /** By side breakdown */
  readonly bySide: {
    readonly ct: SideSpecificCombat;
    readonly t: SideSpecificCombat;
  };
}

/**
 * Side-specific combat stats
 */
export interface SideSpecificCombat {
  readonly roundsPlayed: number;
  readonly kills: number;
  readonly deaths: number;
  readonly adr: number;
  readonly kdRatio: number;
  readonly survivalRate: number;
  readonly winRate: number;
}

/**
 * Aggregated performance/rating statistics
 */
export interface AggregatedPerformanceStats {
  /** Average HLTV Rating 2.0 */
  readonly avgRating: number;

  /** Rating standard deviation */
  readonly ratingStdDev: number;

  /** Average KAST */
  readonly avgKast: number;

  /** KAST standard deviation */
  readonly kastStdDev: number;

  /** Average Impact */
  readonly avgImpact: number;

  /** Rating distribution */
  readonly ratingDistribution: {
    readonly below080: number; // Very bad games
    readonly from080to100: number; // Below average
    readonly from100to120: number; // Good games
    readonly from120to140: number; // Great games
    readonly above140: number; // Outstanding games
  };

  /** Match-by-match rating history (last N matches) */
  readonly ratingHistory: readonly MatchRatingEntry[];
}

/**
 * Single match rating entry for history
 */
export interface MatchRatingEntry {
  readonly demoId: string;
  readonly playedAt: Date;
  readonly map: string;
  readonly rating: number;
  readonly kast: number;
  readonly won: boolean;
}

/**
 * Aggregated trade statistics
 */
export interface AggregatedTradeStats {
  /** Total trade kills */
  readonly tradeKills: number;

  /** Times traded by teammate */
  readonly timesTraded: number;

  /** Trade success rate (when opportunity exists) */
  readonly tradeSuccessRate: number;

  /** Average trade time (ticks) */
  readonly avgTradeTime: number;

  /** Entry trade stats */
  readonly entryTrades: {
    readonly attempts: number;
    readonly successes: number;
    readonly successRate: number;
  };

  /** Post-plant trades */
  readonly postPlantTrades: {
    readonly kills: number;
    readonly deaths: number;
  };
}

/**
 * Aggregated opening duel statistics
 */
export interface AggregatedOpeningStats {
  /** Total opening duels */
  readonly totalDuels: number;

  /** Opening kills */
  readonly openingKills: number;

  /** Opening deaths */
  readonly openingDeaths: number;

  /** Opening success rate */
  readonly successRate: number;

  /** Opening duel attempts rate (per round) */
  readonly attemptRate: number;

  /** By side breakdown */
  readonly bySide: {
    readonly ct: {
      readonly duels: number;
      readonly wins: number;
      readonly successRate: number;
    };
    readonly t: {
      readonly duels: number;
      readonly wins: number;
      readonly successRate: number;
    };
  };

  /** Impact of opening duels on round outcome */
  readonly impact: {
    readonly roundWinRateAfterOpeningKill: number;
    readonly roundWinRateAfterOpeningDeath: number;
    readonly roundWinRateDifference: number; // Impact measure
  };
}

/**
 * Aggregated clutch statistics
 */
export interface AggregatedClutchStats {
  /** Total clutch situations */
  readonly totalClutches: number;

  /** Clutches won */
  readonly clutchesWon: number;

  /** Overall success rate */
  readonly successRate: number;

  /** Clutch attempts rate (per round) */
  readonly clutchAttemptRate: number;

  /** By opponent count */
  readonly byOpponents: {
    readonly vs1: AggregatedClutchByOpponent;
    readonly vs2: AggregatedClutchByOpponent;
    readonly vs3: AggregatedClutchByOpponent;
    readonly vs4: AggregatedClutchByOpponent;
    readonly vs5: AggregatedClutchByOpponent;
  };

  /** By side */
  readonly bySide: {
    readonly ct: {
      readonly attempts: number;
      readonly wins: number;
      readonly successRate: number;
    };
    readonly t: {
      readonly attempts: number;
      readonly wins: number;
      readonly successRate: number;
    };
  };

  /** Clutch performance under pressure */
  readonly pressure: {
    readonly clutchesInCloseGames: number; // Score within 3
    readonly clutchesInOvertimes: number;
    readonly matchPointClutches: number;
  };
}

/**
 * Clutch breakdown by opponent count (for aggregation)
 */
export interface AggregatedClutchByOpponent {
  readonly attempts: number;
  readonly wins: number;
  readonly successRate: number;
  readonly roundsWonValue: number; // Economic value of rounds won
}

/**
 * Aggregated utility statistics
 */
export interface AggregatedUtilityStats {
  /** Flash statistics */
  readonly flash: {
    readonly thrown: number;
    readonly enemiesBlinded: number;
    readonly avgBlindDuration: number;
    readonly flashAssists: number;
    readonly flashKills: number;
    readonly selfFlashes: number;
    readonly teamFlashes: number;
    readonly blindEfficiency: number; // Enemies blinded per flash
  };

  /** HE grenade statistics */
  readonly heGrenade: {
    readonly thrown: number;
    readonly totalDamage: number;
    readonly enemiesHit: number;
    readonly avgDamagePerGrenade: number;
    readonly kills: number;
  };

  /** Smoke statistics */
  readonly smoke: {
    readonly thrown: number;
    readonly effectiveSmokes: number; // Smokes that blocked enemy vision
    readonly avgDuration: number;
  };

  /** Molotov/Incendiary statistics */
  readonly molotov: {
    readonly thrown: number;
    readonly totalDamage: number;
    readonly enemiesHit: number;
    readonly avgDamagePerMolotov: number;
    readonly kills: number;
    readonly areadenied: number; // Seconds of area denial
  };

  /** Overall utility metrics */
  readonly overall: {
    readonly utilityDamagePerRound: number;
    readonly utilityCostEfficiency: number; // Value generated per $ spent
    readonly grenadeAccuracy: number; // Effective throws / total throws
  };
}

/**
 * Aggregated economy statistics
 */
export interface AggregatedEconomyStats {
  /** Total money spent */
  readonly totalSpent: number;

  /** Average equipment value */
  readonly avgEquipValue: number;

  /** Performance by buy type */
  readonly byBuyType: {
    readonly fullBuy: BuyTypePerformance;
    readonly forceBuy: BuyTypePerformance;
    readonly eco: BuyTypePerformance;
    readonly pistol: BuyTypePerformance;
  };

  /** Save success rate */
  readonly saves: {
    readonly saveAttempts: number;
    readonly successfulSaves: number;
    readonly avgSavedValue: number;
    readonly saveSuccessRate: number;
  };

  /** Exit frags (kill before losing round) */
  readonly exitFrags: {
    readonly kills: number;
    readonly valueGenerated: number; // Economic impact
  };

  /** Cost per kill */
  readonly costPerKill: number;

  /** Equipment damage ratio (damage dealt / equipment value) */
  readonly damagePerDollar: number;
}

/**
 * Performance by economy/buy type
 */
export interface BuyTypePerformance {
  readonly roundsPlayed: number;
  readonly kills: number;
  readonly deaths: number;
  readonly adr: number;
  readonly rating: number;
  readonly winRate: number;
  readonly survivalRate: number;
}

// =============================================================================
// MAP & WEAPON ANALYSIS
// =============================================================================

/**
 * Map-specific statistics
 */
export interface MapSpecificStats {
  /** Map name */
  readonly mapName: string;

  /** Matches played on this map */
  readonly matchesPlayed: number;

  /** Rounds played */
  readonly roundsPlayed: number;

  /** Win/loss record */
  readonly record: {
    readonly wins: number;
    readonly losses: number;
    readonly draws: number;
    readonly winRate: number;
  };

  /** Performance metrics */
  readonly performance: {
    readonly avgRating: number;
    readonly avgKast: number;
    readonly adr: number;
    readonly kdRatio: number;
    readonly hsPercent: number;
  };

  /** Side balance */
  readonly sides: {
    readonly ctWinRate: number;
    readonly tWinRate: number;
    readonly preferredSide: "CT" | "T" | "balanced";
  };

  /** Best/worst positions */
  readonly positions: {
    readonly strongestPosition: string | null;
    readonly weakestPosition: string | null;
  };
}

/**
 * Aggregated weapon statistics
 */
export interface AggregatedWeaponStats {
  /** Primary weapons breakdown */
  readonly primary: readonly WeaponProficiency[];

  /** Pistol breakdown */
  readonly pistols: readonly WeaponProficiency[];

  /** AWP specific stats (important role indicator) */
  readonly awp: AWPStats | null;

  /** Preferred weapon categories */
  readonly preferences: {
    readonly rifle: "ak47" | "m4a4" | "m4a1_silencer" | "other";
    readonly smg: string | null;
    readonly pistol: string | null;
    readonly sniper: "awp" | "scout" | "none";
  };
}

/**
 * Weapon proficiency stats
 */
export interface WeaponProficiency {
  readonly weapon: string;
  readonly kills: number;
  readonly deaths: number; // Deaths while holding this weapon
  readonly headshotKills: number;
  readonly headshotRate: number;
  readonly avgKillDistance: number;
  readonly accuracy: number; // If available
  readonly usageRate: number; // How often picked up
}

/**
 * AWP-specific statistics (role indicator)
 */
export interface AWPStats {
  readonly roundsWithAwp: number;
  readonly kills: number;
  readonly deaths: number;
  readonly openingKills: number;
  readonly openingDeaths: number;
  readonly holdingKills: number;
  readonly aggressivePeekKills: number;
  readonly avgKillsPerAwpRound: number;
  readonly survivalWithAwpRate: number;
  readonly isMainAwper: boolean;
}

// =============================================================================
// ROLE ANALYSIS
// =============================================================================

/**
 * Player role analysis
 */
export interface PlayerRoleAnalysis {
  /** Detected primary role */
  readonly primaryRole: PlayerRole;

  /** Secondary role tendencies */
  readonly secondaryRole: PlayerRole | null;

  /** Role confidence score (0-100) */
  readonly confidence: number;

  /** Role breakdown scores */
  readonly breakdown: {
    readonly entryFragger: number; // 0-100
    readonly awper: number;
    readonly support: number;
    readonly lurker: number;
    readonly igl: number; // Hard to detect without comms
    readonly anchor: number;
  };

  /** Role indicators */
  readonly indicators: RoleIndicators;

  /** Playstyle metrics */
  readonly playstyle: PlaystyleMetrics;
}

/**
 * Available player roles
 */
export type PlayerRole = "entry" | "awper" | "support" | "lurker" | "igl" | "anchor" | "hybrid";

/**
 * Metrics that indicate role
 */
export interface RoleIndicators {
  /** Entry indicators */
  readonly entry: {
    readonly openingDuelRate: number;
    readonly firstContactRate: number;
    readonly avgTimeAlive: number;
    readonly flashesForTeammates: number;
  };

  /** AWPer indicators */
  readonly awper: {
    readonly awpUsageRate: number;
    readonly awpKillRate: number;
    readonly holdingPositionRate: number;
  };

  /** Support indicators */
  readonly support: {
    readonly flashAssists: number;
    readonly tradeKills: number;
    readonly utilityDamage: number;
    readonly refragRate: number;
  };

  /** Lurker indicators */
  readonly lurker: {
    readonly lateRoundKills: number;
    readonly soloKillRate: number;
    readonly behindEnemyKills: number;
    readonly avgDistanceFromTeam: number | null;
  };

  /** Anchor indicators (CT) */
  readonly anchor: {
    readonly siteHoldSuccess: number;
    readonly retakeParticipation: number;
    readonly clutchRate: number;
  };
}

/**
 * General playstyle metrics
 */
export interface PlaystyleMetrics {
  /** Aggression level (0-100) */
  readonly aggression: number;

  /** Positioning consistency (0-100) */
  readonly positioning: number;

  /** Aim style: spray control vs tap/burst */
  readonly aimStyle: "spray" | "burst" | "tap" | "mixed";

  /** Utility focus (0-100) */
  readonly utilityUsage: number;

  /** Team play score (0-100) */
  readonly teamPlay: number;

  /** Clutch under pressure (0-100) */
  readonly clutchAbility: number;
}

// =============================================================================
// FORM & TRENDS
// =============================================================================

/**
 * Player form analysis
 */
export interface PlayerFormAnalysis {
  /** Current form indicator */
  readonly current: FormIndicator;

  /** Trend over last N matches */
  readonly trend: TrendAnalysis;

  /** Performance streaks */
  readonly streaks: {
    readonly currentWinStreak: number;
    readonly currentLossStreak: number;
    readonly currentRatingStreak: number; // Consecutive games above/below avg
    readonly longestWinStreak: number;
    readonly longestLossStreak: number;
  };

  /** Comparison to average */
  readonly vsAverage: {
    readonly recentRating: number;
    readonly lifetimeRating: number;
    readonly difference: number;
    readonly isAboveAverage: boolean;
  };

  /** Hot/cold analysis */
  readonly momentum: {
    readonly hotStreak: boolean; // 3+ games above 1.1 rating
    readonly coldStreak: boolean; // 3+ games below 0.9 rating
    readonly bounceBackRate: number; // Recovery rate after bad games
  };
}

/**
 * Form indicator
 */
export type FormIndicator = "on_fire" | "hot" | "warm" | "average" | "cold" | "ice_cold" | "unknown";

/**
 * Trend analysis
 */
export interface TrendAnalysis {
  /** Direction */
  readonly direction: "improving" | "stable" | "declining";

  /** Slope (rate of change) */
  readonly slope: number;

  /** Confidence (R-squared) */
  readonly confidence: number;

  /** Predicted next match rating */
  readonly prediction: number | null;
}

// =============================================================================
// PERCENTILES & RANKINGS
// =============================================================================

/**
 * Player percentile rankings
 */
export interface PlayerPercentiles {
  /** Sample size for percentile calculation */
  readonly sampleSize: number;

  /** Percentile group used */
  readonly peerGroup: "all" | "similar_skill" | "similar_matches";

  /** Individual percentiles */
  readonly percentiles: {
    readonly rating: number;
    readonly kast: number;
    readonly adr: number;
    readonly kd: number;
    readonly hsPercent: number;
    readonly openingSuccessRate: number;
    readonly clutchSuccessRate: number;
    readonly impact: number;
    readonly utilityDamage: number;
  };

  /** Overall percentile (weighted average) */
  readonly overallPercentile: number;

  /** Tier classification */
  readonly tier: SkillTier;
}

/**
 * Skill tier based on percentiles
 */
export type SkillTier = "S" | "A+" | "A" | "B+" | "B" | "C+" | "C" | "D";

// =============================================================================
// CONSISTENCY METRICS
// =============================================================================

/**
 * Performance consistency metrics
 */
export interface ConsistencyMetrics {
  /** Rating consistency (inverse of std dev, normalized) */
  readonly ratingConsistency: number; // 0-100

  /** KAST consistency */
  readonly kastConsistency: number; // 0-100

  /** ADR consistency */
  readonly adrConsistency: number; // 0-100

  /** Floor/ceiling analysis */
  readonly floorCeiling: {
    readonly floor: number; // 10th percentile performance
    readonly ceiling: number; // 90th percentile performance
    readonly range: number; // Ceiling - Floor
    readonly reliableMinimum: number; // What you can count on
  };

  /** Variance breakdown */
  readonly variance: {
    readonly overall: number;
    readonly byMap: number; // How much variance is map-dependent
    readonly bySide: number; // How much variance is side-dependent
    readonly byEconomy: number; // How much variance is economy-dependent
    readonly residual: number; // Unexplained variance
  };

  /** Bad game frequency */
  readonly badGameRate: number; // % of games below 0.8 rating
}

// =============================================================================
// PEAK PERFORMANCES
// =============================================================================

/**
 * Peak performance records
 */
export interface PeakPerformances {
  /** Highest single-match values */
  readonly highestRating: MatchPeak;
  readonly highestKills: MatchPeak;
  readonly highestAdr: MatchPeak;
  readonly mostClutches: MatchPeak;
  readonly mostOpeningKills: MatchPeak;
  readonly mostMultiKills: MatchPeak;

  /** Special achievements */
  readonly achievements: readonly Achievement[];
}

/**
 * Single match peak value
 */
export interface MatchPeak {
  readonly value: number;
  readonly demoId: string;
  readonly map: string;
  readonly playedAt: Date;
  readonly opponent: string | null;
}

/**
 * Special achievement
 */
export interface Achievement {
  readonly type: AchievementType;
  readonly count: number;
  readonly lastAchieved: Date;
}

/**
 * Achievement types
 */
export type AchievementType =
  | "ace" // 5 kills in a round
  | "4k" // 4 kills in a round
  | "clutch_1v5" // Won 1v5
  | "clutch_1v4" // Won 1v4
  | "clutch_1v3" // Won 1v3
  | "rating_2_plus" // 2.0+ rating
  | "40_bomb" // 40+ kills
  | "perfect_kd" // 0 deaths with 5+ kills
  | "flash_master" // 10+ enemies blinded in match
  | "trade_machine" // 5+ trade kills
  | "opening_specialist"; // 5+ opening kills

// =============================================================================
// METADATA
// =============================================================================

/**
 * Aggregation metadata
 */
export interface AggregationMetadata {
  /** When aggregation was computed */
  readonly computedAt: Date;

  /** Version of aggregation algorithm */
  readonly version: string;

  /** Data quality score (0-100) */
  readonly dataQuality: number;

  /** Matches included */
  readonly matchesIncluded: number;

  /** Matches excluded (and why) */
  readonly matchesExcluded: {
    readonly count: number;
    readonly reasons: readonly string[];
  };

  /** Computation time (ms) */
  readonly computationTime: number;

  /** Any warnings */
  readonly warnings: readonly string[];
}

// =============================================================================
// TEAM PROFILE
// =============================================================================

/**
 * Aggregated team profile
 */
export interface AggregatedTeamProfile {
  /** Team identification */
  readonly identity: TeamIdentity;

  /** Current roster */
  readonly roster: TeamRoster;

  /** Aggregation period */
  readonly period: AggregationPeriod;

  /** Team performance */
  readonly performance: TeamPerformance;

  /** Map pool analysis */
  readonly mapPool: TeamMapPool;

  /** Team synergy */
  readonly synergy: TeamSynergy;

  /** Situational analysis */
  readonly situations: TeamSituationalStats;

  /** Economy management */
  readonly economy: TeamEconomyStats;

  /** Communication/coordination proxies */
  readonly coordination: TeamCoordination;

  /** Metadata */
  readonly metadata: AggregationMetadata;
}

/**
 * Team identification
 */
export interface TeamIdentity {
  readonly teamId: string;
  readonly name: string;
  readonly tag: string | null;
  readonly logo: string | null;
  readonly region: string | null;
}

/**
 * Team roster
 */
export interface TeamRoster {
  /** Current players */
  readonly current: readonly RosterPlayer[];

  /** Average time together (days) */
  readonly avgTenure: number;

  /** Roster stability score (0-100) */
  readonly stability: number;

  /** Recent changes */
  readonly changes: readonly RosterChange[];
}

/**
 * Roster player entry
 */
export interface RosterPlayer {
  readonly steamId: string;
  readonly name: string;
  readonly role: PlayerRole;
  readonly joinedAt: Date;
  readonly matchesWithTeam: number;
}

/**
 * Roster change entry
 */
export interface RosterChange {
  readonly type: "joined" | "left";
  readonly steamId: string;
  readonly name: string;
  readonly date: Date;
}

/**
 * Team performance stats
 */
export interface TeamPerformance {
  /** Match record */
  readonly record: {
    readonly wins: number;
    readonly losses: number;
    readonly draws: number;
    readonly winRate: number;
  };

  /** Round record */
  readonly rounds: {
    readonly won: number;
    readonly lost: number;
    readonly winRate: number;
  };

  /** Average team rating */
  readonly avgTeamRating: number;

  /** Combined ADR */
  readonly combinedAdr: number;

  /** Best player */
  readonly bestPlayer: {
    readonly steamId: string;
    readonly name: string;
    readonly avgRating: number;
  };

  /** Most consistent player */
  readonly mostConsistent: {
    readonly steamId: string;
    readonly name: string;
    readonly consistency: number;
  };
}

/**
 * Team map pool
 */
export interface TeamMapPool {
  /** Sorted by preference/success */
  readonly maps: readonly TeamMapStats[];

  /** Recommended bans */
  readonly recommendedBans: readonly string[];

  /** Recommended picks */
  readonly recommendedPicks: readonly string[];

  /** Map pool depth (number of viable maps) */
  readonly depth: number;
}

/**
 * Single map stats for team
 */
export interface TeamMapStats {
  readonly mapName: string;
  readonly matchesPlayed: number;
  readonly winRate: number;
  readonly avgRoundDiff: number;
  readonly ctWinRate: number;
  readonly tWinRate: number;
  readonly preference: "strong" | "comfortable" | "developing" | "weak" | "avoid";
}

/**
 * Team synergy metrics
 */
export interface TeamSynergy {
  /** Overall synergy score (0-100) */
  readonly overallScore: number;

  /** Trade efficiency */
  readonly tradeEfficiency: number;

  /** Flash assist rate */
  readonly flashAssistRate: number;

  /** Crossfire setups success rate */
  readonly crossfireSuccess: number;

  /** Player pair synergies */
  readonly playerPairs: readonly PlayerPairSynergy[];

  /** Entry support coordination */
  readonly entrySupport: {
    readonly successRate: number;
    readonly avgTimeBetweenEntryAndSupport: number;
  };
}

/**
 * Synergy between two players
 */
export interface PlayerPairSynergy {
  readonly player1: { steamId: string; name: string };
  readonly player2: { steamId: string; name: string };
  readonly synergyScore: number;
  readonly tradingFrequency: number;
  readonly flashAssistRate: number;
  readonly combinedKillsInSameRound: number;
}

/**
 * Team situational performance
 */
export interface TeamSituationalStats {
  /** Pistol rounds */
  readonly pistolRounds: {
    readonly played: number;
    readonly won: number;
    readonly winRate: number;
    readonly ctWinRate: number;
    readonly tWinRate: number;
  };

  /** Anti-eco rounds */
  readonly antiEco: {
    readonly played: number;
    readonly won: number;
    readonly winRate: number;
    readonly avgKillsGained: number;
  };

  /** Force buy rounds */
  readonly forceBuy: {
    readonly played: number;
    readonly won: number;
    readonly winRate: number;
  };

  /** Close games (OT or within 3 rounds) */
  readonly closeGames: {
    readonly played: number;
    readonly won: number;
    readonly winRate: number;
    readonly mentalFortitude: number; // How well team performs under pressure
  };

  /** Comebacks */
  readonly comebacks: {
    readonly from5RoundsDown: { attempts: number; successes: number };
    readonly from10RoundsDown: { attempts: number; successes: number };
  };
}

/**
 * Team economy stats
 */
export interface TeamEconomyStats {
  /** Average equipment value */
  readonly avgEquipValue: number;

  /** Buy coordination */
  readonly buyCoordination: number; // How often team buys together

  /** Economic decision making */
  readonly decisionMaking: {
    readonly correctEcos: number;
    readonly correctForces: number;
    readonly correctFullBuys: number;
  };

  /** Save success */
  readonly saveSuccess: number;
}

/**
 * Team coordination metrics
 */
export interface TeamCoordination {
  /** Execute timing (site takes) */
  readonly executeTiming: number; // Synchronization score

  /** Default-to-execute conversion */
  readonly defaultToExecute: number;

  /** Rotate coordination */
  readonly rotateCoordination: number;

  /** Clutch support (util usage when teammate in clutch) */
  readonly clutchSupport: number;
}
