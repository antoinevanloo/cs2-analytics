/**
 * Opening Duel Types - First engagement analysis
 *
 * Opening duels are the first kills of each round.
 * They strongly correlate with round wins:
 * - Teams that get the first kill win ~65% of rounds
 * - Opening duel specialists are highly valuable
 *
 * @module analysis/types/opening
 */

/**
 * Opening Duel Metrics
 *
 * Statistics for first engagements in rounds.
 *
 * Opening duel win rate is one of the most impactful individual stats:
 * - Elite entry fraggers: > 55% win rate
 * - Good fraggers: 50-55%
 * - Average: 45-50%
 * - Support players: often lower, but that's expected
 */
export interface OpeningDuelMetrics {
  /** Total opening duels participated in */
  readonly total: number;

  /** Opening duels won (got the first kill of the round) */
  readonly wins: number;

  /** Opening duels lost (first death of the round) */
  readonly losses: number;

  /**
   * Opening duel win rate (0-100)
   * Formula: (wins / total) * 100
   */
  readonly winRate: number;

  /**
   * Impact on rating from opening duels
   * Positive for wins, negative for losses
   */
  readonly ratingImpact: number;

  /** Side-specific breakdown */
  readonly bySide: OpeningsBySide;

  /** Correlation with round outcomes */
  readonly roundCorrelation: OpeningRoundCorrelation;

  /** Detailed opening duel events */
  readonly duels: readonly OpeningDuelEvent[];
}

/**
 * Opening duels broken down by side
 */
export interface OpeningsBySide {
  /** CT-side opening duels */
  readonly ct: SideOpenings;

  /** T-side opening duels */
  readonly t: SideOpenings;
}

/**
 * Opening stats for one side
 */
export interface SideOpenings {
  /** Opening wins on this side */
  readonly wins: number;

  /** Opening losses on this side */
  readonly losses: number;

  /** Win rate on this side */
  readonly winRate: number;

  /** Rounds played on this side with opening involvement */
  readonly total: number;
}

/**
 * How opening duels correlate with round outcomes
 *
 * Shows the impact of opening duels on actual round wins.
 */
export interface OpeningRoundCorrelation {
  /** Rounds won after winning the opening duel */
  readonly roundsWonAfterOpeningWin: number;

  /** Rounds lost after winning the opening duel */
  readonly roundsLostAfterOpeningWin: number;

  /** Round win rate after opening win */
  readonly winRateAfterOpeningWin: number;

  /** Rounds won after losing the opening duel */
  readonly roundsWonAfterOpeningLoss: number;

  /** Rounds lost after losing the opening duel */
  readonly roundsLostAfterOpeningLoss: number;

  /** Round win rate after opening loss */
  readonly winRateAfterOpeningLoss: number;
}

/**
 * Individual opening duel event
 */
export interface OpeningDuelEvent {
  /** Round number */
  readonly roundNumber: number;

  /** Tick when the opening kill happened */
  readonly tick: number;

  /** Winner of the opening duel */
  readonly winner: {
    readonly steamId: string;
    readonly name: string;
    readonly team: number;
  };

  /** Loser of the opening duel */
  readonly loser: {
    readonly steamId: string;
    readonly name: string;
    readonly team: number;
  };

  /** Weapon used */
  readonly weapon: string;

  /** Was it a headshot */
  readonly headshot: boolean;

  /** Team that won the round */
  readonly roundWinner: number;

  /** Time into the round (seconds) */
  readonly timeIntoRound: number;
}

/**
 * Opening duel matchup analysis
 *
 * Shows how a player performs in opening duels against specific opponents.
 */
export interface OpeningMatchup {
  /** Opponent steam ID */
  readonly opponentSteamId: string;

  /** Opponent name */
  readonly opponentName: string;

  /** Wins against this opponent */
  readonly wins: number;

  /** Losses against this opponent */
  readonly losses: number;

  /** Win rate against this opponent */
  readonly winRate: number;

  /** Most common positions where they duel */
  readonly commonPositions: readonly string[];
}

/**
 * Team opening duel statistics
 */
export interface TeamOpeningMetrics {
  /** Team number */
  readonly teamNumber: number;

  /** Team name */
  readonly teamName: string;

  /** Total opening duels won */
  readonly totalWins: number;

  /** Total opening duels lost */
  readonly totalLosses: number;

  /** Team opening win rate */
  readonly winRate: number;

  /** Round win rate after winning opening */
  readonly roundWinRateAfterOpening: number;

  /** Primary entry fragger */
  readonly primaryEntry: {
    readonly steamId: string;
    readonly name: string;
    readonly openingAttempts: number;
    readonly winRate: number;
  };

  /** Players ranked by opening performance */
  readonly playerRankings: readonly PlayerOpeningRanking[];
}

/**
 * Player ranking for opening duels
 */
export interface PlayerOpeningRanking {
  readonly steamId: string;
  readonly name: string;
  readonly wins: number;
  readonly losses: number;
  readonly winRate: number;
  readonly attempts: number;
}
