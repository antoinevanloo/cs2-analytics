/**
 * Trade Types - Trade kill analysis
 *
 * Trade kills are a key indicator of team coordination.
 * A trade occurs when a teammate kills the enemy who killed you
 * within a short time window (typically 5 seconds).
 *
 * @module analysis/types/trade
 */

/**
 * Trade Metrics
 *
 * Measures team coordination through trade kills.
 *
 * Trade Success Rate is one of the best indicators of team play:
 * - Pro teams: > 60% trade success rate
 * - Good teams: 50-60%
 * - Average: 40-50%
 * - Poor coordination: < 40%
 */
export interface TradeMetrics {
  /**
   * Number of times player traded a teammate's death
   * Player killed the enemy who killed their teammate
   */
  readonly tradesGiven: number;

  /**
   * Number of times player's death was traded by a teammate
   * A teammate killed the enemy who killed the player
   */
  readonly tradesReceived: number;

  /**
   * Trade success rate (0-100)
   * Formula: (tradesGiven / tradeOpportunities) * 100
   */
  readonly tradeSuccessRate: number;

  /**
   * Number of trade opportunities
   * Situations where trading was possible (teammate died and enemy was exposed)
   */
  readonly tradeOpportunities: number;

  /**
   * Average time to trade (in ticks)
   * Lower = faster reactions
   */
  readonly avgTradeTimeTicks: number;

  /**
   * Average time to trade (in seconds)
   * Converted from ticks for readability
   */
  readonly avgTradeTimeSeconds: number;

  /** Detailed list of trade events */
  readonly trades: readonly TradeEvent[];
}

/**
 * Individual trade event
 *
 * Records the details of a specific trade kill.
 */
export interface TradeEvent {
  /** Round number where the trade occurred */
  readonly roundNumber: number;

  /** Tick when the trade kill happened */
  readonly tick: number;

  /** Tick when the original death happened */
  readonly originalKillTick: number;

  /** SteamID of the player who died (and was traded) */
  readonly tradedPlayerSteamId: string;

  /** Name of the player who died */
  readonly tradedPlayerName: string;

  /** SteamID of the player who got the trade kill */
  readonly traderSteamId: string;

  /** Name of the player who got the trade kill */
  readonly traderName: string;

  /** SteamID of the enemy who was traded (killed) */
  readonly enemySteamId: string;

  /** Name of the enemy who was traded */
  readonly enemyName: string;

  /** Time between death and trade in ticks */
  readonly tradeTimeTicks: number;

  /** Time between death and trade in seconds */
  readonly tradeTimeSeconds: number;

  /** Weapon used for the trade kill */
  readonly weapon: string;

  /** Whether the trade was a headshot */
  readonly headshot: boolean;
}

/**
 * Team trade statistics
 *
 * Aggregated trade metrics for an entire team.
 */
export interface TeamTradeMetrics {
  /** Team number (2=T, 3=CT) */
  readonly teamNumber: number;

  /** Team name */
  readonly teamName: string;

  /** Total trades made by the team */
  readonly totalTradesGiven: number;

  /** Total trade opportunities */
  readonly totalTradeOpportunities: number;

  /** Team trade success rate */
  readonly tradeSuccessRate: number;

  /** Average time to trade */
  readonly avgTradeTimeSeconds: number;

  /** Best trader on the team */
  readonly topTrader: {
    readonly steamId: string;
    readonly name: string;
    readonly tradesGiven: number;
  };

  /** Most traded player (receives most support) */
  readonly mostTraded: {
    readonly steamId: string;
    readonly name: string;
    readonly tradesReceived: number;
  };
}

/**
 * Trade analysis by position
 *
 * Shows where trades happen most frequently on the map.
 */
export interface TradesByPosition {
  /** Position/area name */
  readonly position: string;

  /** Number of trades in this position */
  readonly tradeCount: number;

  /** Success rate in this position */
  readonly successRate: number;

  /** Average trade time in this position */
  readonly avgTradeTime: number;
}

/**
 * Trade relationship between two players
 *
 * Shows how often two specific players trade each other.
 */
export interface TradeRelationship {
  /** First player */
  readonly player1SteamId: string;
  readonly player1Name: string;

  /** Second player */
  readonly player2SteamId: string;
  readonly player2Name: string;

  /** Times player1 traded player2's death */
  readonly player1TradedPlayer2: number;

  /** Times player2 traded player1's death */
  readonly player2TradedPlayer1: number;

  /** Total trades between these players */
  readonly totalTrades: number;

  /** Trade synergy score (how well they support each other) */
  readonly synergyScore: number;
}

// ============================================================================
// ADVANCED TRADE METRICS
// ============================================================================

/**
 * Trade chain analysis
 *
 * A trade chain is when multiple trades happen in sequence:
 * - Player A kills Player 1
 * - Player B kills Player A (trade 1)
 * - Player 2 kills Player B (trade 2)
 * - Player C kills Player 2 (trade 3)
 *
 * Understanding trade chains reveals team coordination depth.
 */
export interface TradeChainMetrics {
  /** Total trade chains in the match */
  readonly totalChains: number;

  /** Average chain length */
  readonly avgChainLength: number;

  /** Longest chain in the match */
  readonly longestChain: number;

  /** Chains won by player's team */
  readonly chainsWon: number;

  /** Chain win rate (0-100) */
  readonly chainWinRate: number;

  /** Detailed chain events */
  readonly chains: readonly TradeChainEvent[];

  /** Chains by length breakdown */
  readonly byLength: TradeChainLengthBreakdown;
}

/**
 * Individual trade chain event
 */
export interface TradeChainEvent {
  /** Round number */
  readonly roundNumber: number;

  /** Start tick of the chain */
  readonly startTick: number;

  /** End tick of the chain */
  readonly endTick: number;

  /** Duration in seconds */
  readonly durationSeconds: number;

  /** Chain length (number of trades) */
  readonly length: number;

  /** All kills in this chain (in order) */
  readonly kills: readonly TradeChainKill[];

  /** Team that won the chain (more survivors) */
  readonly winnerTeam: number;

  /** Net player advantage after chain (+ = more enemies dead) */
  readonly netAdvantage: number;
}

/**
 * Single kill within a trade chain
 */
export interface TradeChainKill {
  /** Kill tick */
  readonly tick: number;

  /** Attacker Steam ID */
  readonly attackerSteamId: string;

  /** Attacker name */
  readonly attackerName: string;

  /** Attacker team */
  readonly attackerTeam: number;

  /** Victim Steam ID */
  readonly victimSteamId: string;

  /** Victim name */
  readonly victimName: string;

  /** Victim team */
  readonly victimTeam: number;

  /** Weapon used */
  readonly weapon: string;

  /** Was this kill a trade? (killed someone who just killed a teammate) */
  readonly isTrade: boolean;

  /** Time since previous kill in chain (seconds) */
  readonly timeSincePrevious: number;
}

/**
 * Trade chain breakdown by length
 */
export interface TradeChainLengthBreakdown {
  /** Simple trades (2 kills) */
  readonly length2: ChainLengthStats;

  /** Triple trades (3 kills) */
  readonly length3: ChainLengthStats;

  /** Quad trades (4 kills) */
  readonly length4: ChainLengthStats;

  /** Extended chains (5+ kills) */
  readonly length5Plus: ChainLengthStats;
}

/**
 * Statistics for a specific chain length
 */
export interface ChainLengthStats {
  /** Number of chains of this length */
  readonly count: number;

  /** Chains won */
  readonly won: number;

  /** Win rate */
  readonly winRate: number;

  /** Average duration (seconds) */
  readonly avgDuration: number;
}

/**
 * Trade timing analysis
 *
 * Analyzes when trades happen - entry vs retake, etc.
 */
export interface TradeTimingMetrics {
  /** Entry trades (first 20 seconds of round) */
  readonly entryTrades: TradeTimingPhase;

  /** Mid-round trades (20-60 seconds) */
  readonly midRoundTrades: TradeTimingPhase;

  /** Late-round trades (60+ seconds) */
  readonly lateRoundTrades: TradeTimingPhase;

  /** Post-plant trades */
  readonly postPlantTrades: TradeTimingPhase;

  /** Retake trades (CT recovering site) */
  readonly retakeTrades: TradeTimingPhase;

  /** Average reaction time for trades (seconds) */
  readonly avgReactionTime: number;

  /** Fastest trade (seconds) */
  readonly fastestTradeTime: number;
}

/**
 * Trade statistics for a specific timing phase
 */
export interface TradeTimingPhase {
  /** Trades in this phase */
  readonly trades: number;

  /** Percentage of total trades */
  readonly percent: number;

  /** Success rate in this phase */
  readonly successRate: number;

  /** Average trade time in this phase */
  readonly avgTradeTime: number;
}

/**
 * Trade effectiveness metrics
 *
 * Measures how impactful trades are.
 */
export interface TradeEffectivenessMetrics {
  /** Trades that led to round wins */
  readonly tradesLeadingToWin: number;

  /** Percentage of trades that led to wins */
  readonly tradeWinImpact: number;

  /** Trades in winning rounds vs losing rounds */
  readonly tradesInWonRounds: number;
  readonly tradesInLostRounds: number;

  /** Average man advantage created by trades */
  readonly avgManAdvantageCreated: number;

  /** Trade value score (combined impact metric) */
  readonly tradeValueScore: number;
}

/**
 * Extended trade metrics
 *
 * Comprehensive trade analysis.
 */
export interface ExtendedTradeMetrics {
  /** Core trade metrics */
  readonly core: TradeMetrics;

  /** Trade chain analysis */
  readonly chains: TradeChainMetrics;

  /** Trade timing breakdown */
  readonly timing: TradeTimingMetrics;

  /** Trade effectiveness */
  readonly effectiveness: TradeEffectivenessMetrics;

  /** Player trade relationships */
  readonly relationships: readonly TradeRelationship[];

  /** Overall trade score (0-100) */
  readonly overallScore: number;

  /** Trade skill label */
  readonly skillLabel: TradeSkillLabel;
}

/**
 * Trade skill labels
 */
export type TradeSkillLabel =
  | "Elite"
  | "Excellent"
  | "Good"
  | "Average"
  | "Below Average"
  | "Poor";
