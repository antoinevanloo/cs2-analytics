/**
 * FACEIT Integration Service
 *
 * Provides resilient access to FACEIT API with:
 * - Circuit breaker pattern for fault tolerance
 * - Rate limiting to respect API quotas
 * - Retry with exponential backoff
 * - Response caching
 * - Concurrent request management
 *
 * API Documentation: https://developers.faceit.com/docs
 *
 * @module integrations/faceit
 */

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CircuitBreaker,
  CircuitBreakerOpenError,
} from "../../common/resilience/circuit-breaker";
import { RedisService } from "../../common/redis/redis.service";

// ============================================================================
// TYPES
// ============================================================================

/**
 * FACEIT Match from API
 */
export interface FaceitMatch {
  matchId: string;
  gameId: string;
  region: string;
  matchType: string;
  game: string;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  results?: {
    winner: string;
    score: {
      faction1: number;
      faction2: number;
    };
  };
  teams: {
    faction1: FaceitTeam;
    faction2: FaceitTeam;
  };
  demoUrl?: string;
}

export interface FaceitTeam {
  teamId: string;
  name: string;
  avatar?: string;
  roster: FaceitPlayer[];
}

export interface FaceitPlayer {
  playerId: string;
  nickname: string;
  avatar?: string;
  gamePlayerId?: string;
  skillLevel?: number;
  elo?: number;
}

export interface FaceitMatchHistory {
  matches: FaceitMatch[];
  start: number;
  end: number;
  total: number;
}

export interface FaceitPlayerStats {
  playerId: string;
  nickname: string;
  lifetime: {
    matches: number;
    wins: number;
    winRate: number;
    averageKD: number;
    averageHSPercent: number;
    currentWinStreak: number;
    longestWinStreak: number;
  };
  segments?: Array<{
    label: string;
    stats: Record<string, number>;
  }>;
}

// ============================================================================
// SERVICE
// ============================================================================

@Injectable()
export class FaceitService {
  private readonly logger = new Logger(FaceitService.name);
  private readonly apiKey: string;
  private readonly baseUrl = "https://open.faceit.com/data/v4";

  // Resilience components
  private readonly circuitBreaker: CircuitBreaker;
  private readonly requestQueue: Map<string, Promise<unknown>> = new Map();

  // Rate limiting
  private readonly rateLimitWindow = 60000; // 1 minute
  private readonly rateLimitMax = 100; // requests per window
  private requestCount = 0;
  private windowStart = Date.now();

  // Cache TTLs (in milliseconds)
  private readonly CACHE_TTL = {
    PLAYER_STATS: 5 * 60 * 1000, // 5 minutes
    MATCH_HISTORY: 2 * 60 * 1000, // 2 minutes
    MATCH_DETAILS: 60 * 60 * 1000, // 1 hour (matches don't change)
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
  ) {
    this.apiKey = this.configService.get<string>("FACEIT_API_KEY", "");

    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker({
      name: "faceit-api",
      failureThreshold: 5,
      resetTimeout: 30000, // 30 seconds
      successThreshold: 2,
      failureWindow: 60000, // 1 minute
      requestTimeout: 30000, // 30 seconds per request
    });

    if (!this.apiKey) {
      this.logger.warn(
        "FACEIT_API_KEY not configured. FACEIT integration will be limited.",
      );
    }
  }

  // ============================================================================
  // PUBLIC API METHODS
  // ============================================================================

  /**
   * Get player information by FACEIT ID
   */
  async getPlayer(playerId: string): Promise<FaceitPlayer | null> {
    const cacheKey = `faceit:player:${playerId}`;
    const cached = await this.redis.get<FaceitPlayer>(cacheKey);
    if (cached) return cached;

    const data = await this.makeRequest<{
      player_id: string;
      nickname: string;
      avatar: string;
      games?: {
        cs2?: {
          skill_level: number;
          faceit_elo: number;
          game_player_id: string;
        };
      };
    }>(`/players/${playerId}`);

    if (!data) return null;

    // Build player object, omitting undefined optional properties
    const player: FaceitPlayer = {
      playerId: data.player_id,
      nickname: data.nickname,
    };

    if (data.avatar) player.avatar = data.avatar;
    if (data.games?.cs2?.game_player_id)
      player.gamePlayerId = data.games.cs2.game_player_id;
    if (data.games?.cs2?.skill_level !== undefined)
      player.skillLevel = data.games.cs2.skill_level;
    if (data.games?.cs2?.faceit_elo !== undefined)
      player.elo = data.games.cs2.faceit_elo;

    await this.redis.set(cacheKey, player, this.CACHE_TTL.PLAYER_STATS);
    return player;
  }

  /**
   * Get player statistics
   */
  async getPlayerStats(
    playerId: string,
    game: string = "cs2",
  ): Promise<FaceitPlayerStats | null> {
    const cacheKey = `faceit:stats:${playerId}:${game}`;
    const cached = await this.redis.get<FaceitPlayerStats>(cacheKey);
    if (cached) return cached;

    const data = await this.makeRequest<{
      player_id: string;
      lifetime: {
        Matches: string;
        Wins: string;
        "Win Rate %": string;
        "Average K/D Ratio": string;
        "Average Headshots %": string;
        "Current Win Streak": string;
        "Longest Win Streak": string;
      };
      segments?: Array<{
        label: string;
        stats: Record<string, string>;
      }>;
    }>(`/players/${playerId}/stats/${game}`);

    if (!data) return null;

    const player = await this.getPlayer(playerId);

    // Build stats object, omitting undefined optional properties
    const stats: FaceitPlayerStats = {
      playerId: data.player_id,
      nickname: player?.nickname ?? playerId,
      lifetime: {
        matches: parseInt(data.lifetime.Matches, 10) || 0,
        wins: parseInt(data.lifetime.Wins, 10) || 0,
        winRate: parseFloat(data.lifetime["Win Rate %"]) || 0,
        averageKD: parseFloat(data.lifetime["Average K/D Ratio"]) || 0,
        averageHSPercent: parseFloat(data.lifetime["Average Headshots %"]) || 0,
        currentWinStreak:
          parseInt(data.lifetime["Current Win Streak"], 10) || 0,
        longestWinStreak:
          parseInt(data.lifetime["Longest Win Streak"], 10) || 0,
      },
    };

    // Only add segments if present
    if (data.segments) {
      stats.segments = data.segments.map((s) => ({
        label: s.label,
        stats: Object.fromEntries(
          Object.entries(s.stats).map(([k, v]) => [k, parseFloat(v) || 0]),
        ),
      }));
    }

    await this.redis.set(cacheKey, stats, this.CACHE_TTL.PLAYER_STATS);
    return stats;
  }

  /**
   * Get match history for a player
   */
  async getMatchHistory(
    playerId: string,
    options: {
      game?: string;
      offset?: number;
      limit?: number;
    } = {},
  ): Promise<FaceitMatchHistory> {
    const { game = "cs2", offset = 0, limit = 20 } = options;

    const cacheKey = `faceit:history:${playerId}:${game}:${offset}:${limit}`;
    const cached = await this.redis.get<FaceitMatchHistory>(cacheKey);
    if (cached) return cached;

    const data = await this.makeRequest<{
      items: Array<{
        match_id: string;
        game_id: string;
        region: string;
        match_type: string;
        game: string;
        status: string;
        started_at: number;
        finished_at: number;
        results?: {
          winner: string;
          score: { faction1: number; faction2: number };
        };
        teams: {
          faction1: {
            team_id: string;
            nickname: string;
            avatar: string;
            roster: Array<{
              player_id: string;
              nickname: string;
              avatar: string;
              game_player_id?: string;
              game_skill_level?: number;
            }>;
          };
          faction2: {
            team_id: string;
            nickname: string;
            avatar: string;
            roster: Array<{
              player_id: string;
              nickname: string;
              avatar: string;
              game_player_id?: string;
              game_skill_level?: number;
            }>;
          };
        };
      }>;
      start: number;
      end: number;
    }>(
      `/players/${playerId}/history?game=${game}&offset=${offset}&limit=${limit}`,
    );

    if (!data) {
      return { matches: [], start: 0, end: 0, total: 0 };
    }

    const history: FaceitMatchHistory = {
      matches: data.items.map((m) => this.mapMatch(m)),
      start: data.start,
      end: data.end,
      total: data.end - data.start,
    };

    await this.redis.set(cacheKey, history, this.CACHE_TTL.MATCH_HISTORY);
    return history;
  }

  /**
   * Get match details including demo URL
   */
  async getMatchDetails(matchId: string): Promise<FaceitMatch | null> {
    const cacheKey = `faceit:match:${matchId}`;
    const cached = await this.redis.get<FaceitMatch>(cacheKey);
    if (cached) return cached;

    const data = await this.makeRequest<{
      match_id: string;
      game_id: string;
      region: string;
      match_type: string;
      game: string;
      status: string;
      started_at: number;
      finished_at: number;
      results?: {
        winner: string;
        score: { faction1: number; faction2: number };
      };
      teams: {
        faction1: {
          team_id: string;
          nickname: string;
          avatar: string;
          roster: Array<{
            player_id: string;
            nickname: string;
            avatar: string;
            game_player_id?: string;
            game_skill_level?: number;
          }>;
        };
        faction2: {
          team_id: string;
          nickname: string;
          avatar: string;
          roster: Array<{
            player_id: string;
            nickname: string;
            avatar: string;
            game_player_id?: string;
            game_skill_level?: number;
          }>;
        };
      };
      demo_url?: string[];
    }>(`/matches/${matchId}`);

    if (!data) return null;

    const match = this.mapMatch(data);

    // Only set demoUrl if present
    const demoUrl = data.demo_url?.[0];
    if (demoUrl) {
      match.demoUrl = demoUrl;
    }

    await this.redis.set(cacheKey, match, this.CACHE_TTL.MATCH_DETAILS);
    return match;
  }

  /**
   * Get demo download URL for a match
   */
  async getDemoUrl(matchId: string): Promise<string | null> {
    const match = await this.getMatchDetails(matchId);
    return match?.demoUrl ?? null;
  }

  /**
   * Get recent matches with demo URLs for auto-import
   */
  async getRecentMatchesWithDemos(
    playerId: string,
    limit: number = 10,
  ): Promise<Array<{ matchId: string; demoUrl: string; playedAt: Date }>> {
    const history = await this.getMatchHistory(playerId, { limit });

    const matchesWithDemos: Array<{
      matchId: string;
      demoUrl: string;
      playedAt: Date;
    }> = [];

    // Fetch demo URLs in parallel with concurrency limit
    const concurrencyLimit = 3;
    for (let i = 0; i < history.matches.length; i += concurrencyLimit) {
      const batch = history.matches.slice(i, i + concurrencyLimit);
      const results = await Promise.all(
        batch.map(async (m) => {
          const details = await this.getMatchDetails(m.matchId);
          if (details?.demoUrl) {
            return {
              matchId: m.matchId,
              demoUrl: details.demoUrl,
              playedAt: m.startedAt,
            };
          }
          return null;
        }),
      );

      matchesWithDemos.push(
        ...results.filter((r): r is NonNullable<typeof r> => r !== null),
      );
    }

    return matchesWithDemos;
  }

  /**
   * Search for a player by nickname
   */
  async searchPlayer(nickname: string): Promise<FaceitPlayer[]> {
    const data = await this.makeRequest<{
      items: Array<{
        player_id: string;
        nickname: string;
        avatar: string;
        games?: Array<{
          name: string;
          skill_level?: number;
        }>;
      }>;
    }>(`/search/players?nickname=${encodeURIComponent(nickname)}&limit=10`);

    if (!data?.items) return [];

    return data.items.map((p) => {
      const player: FaceitPlayer = {
        playerId: p.player_id,
        nickname: p.nickname,
      };

      if (p.avatar) player.avatar = p.avatar;

      const cs2Game = p.games?.find((g) => g.name === "cs2");
      if (cs2Game?.skill_level !== undefined) {
        player.skillLevel = cs2Game.skill_level;
      }

      return player;
    });
  }

  /**
   * Get circuit breaker status
   */
  getCircuitStatus() {
    return this.circuitBreaker.getStatus();
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Make a rate-limited, circuit-breaker-protected API request
   */
  private async makeRequest<T>(endpoint: string): Promise<T | null> {
    // Check rate limit
    await this.checkRateLimit();

    // Deduplicate concurrent requests for same endpoint
    const existingRequest = this.requestQueue.get(endpoint);
    if (existingRequest) {
      this.logger.debug(`Deduplicating request: ${endpoint}`);
      return existingRequest as Promise<T | null>;
    }

    const requestPromise = this.executeRequest<T>(endpoint);
    this.requestQueue.set(endpoint, requestPromise);

    try {
      return await requestPromise;
    } finally {
      this.requestQueue.delete(endpoint);
    }
  }

  /**
   * Execute the actual API request with retries
   */
  private async executeRequest<T>(endpoint: string): Promise<T | null> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.circuitBreaker.execute(async () => {
          const url = `${this.baseUrl}${endpoint}`;
          this.logger.debug(
            `FACEIT API request: ${endpoint} (attempt ${attempt})`,
          );

          const response = await fetch(url, {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              Accept: "application/json",
            },
          });

          // Handle rate limiting from API
          if (response.status === 429) {
            const retryAfter = response.headers.get("Retry-After");
            const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60000;
            this.logger.warn(`FACEIT API rate limited. Waiting ${waitMs}ms`);
            await this.sleep(waitMs);
            throw new Error("Rate limited by FACEIT API");
          }

          if (!response.ok) {
            if (response.status === 404) {
              return null;
            }
            throw new Error(
              `FACEIT API error: ${response.status} ${response.statusText}`,
            );
          }

          this.requestCount++;
          return response.json() as Promise<T>;
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry circuit breaker open errors
        if (error instanceof CircuitBreakerOpenError) {
          throw error;
        }

        // Exponential backoff
        if (attempt < maxRetries) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt), 10000);
          this.logger.debug(
            `Request failed, retrying in ${backoffMs}ms (attempt ${attempt}/${maxRetries})`,
          );
          await this.sleep(backoffMs);
        }
      }
    }

    this.logger.error(
      `FACEIT API request failed after ${maxRetries} attempts`,
      lastError,
    );
    return null;
  }

  /**
   * Check and enforce rate limiting
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();

    // Reset window if expired
    if (now - this.windowStart >= this.rateLimitWindow) {
      this.requestCount = 0;
      this.windowStart = now;
    }

    // Wait if at rate limit
    if (this.requestCount >= this.rateLimitMax) {
      const waitMs = this.rateLimitWindow - (now - this.windowStart);
      this.logger.warn(`Rate limit reached. Waiting ${waitMs}ms`);
      await this.sleep(waitMs);
      this.requestCount = 0;
      this.windowStart = Date.now();
    }
  }

  /**
   * Map raw API match to FaceitMatch
   */
  private mapMatch(data: {
    match_id: string;
    game_id: string;
    region: string;
    match_type: string;
    game: string;
    status: string;
    started_at: number;
    finished_at: number;
    results?: {
      winner: string;
      score: { faction1: number; faction2: number };
    };
    teams: {
      faction1: {
        team_id: string;
        nickname: string;
        avatar: string;
        roster: Array<{
          player_id: string;
          nickname: string;
          avatar: string;
          game_player_id?: string;
          game_skill_level?: number;
        }>;
      };
      faction2: {
        team_id: string;
        nickname: string;
        avatar: string;
        roster: Array<{
          player_id: string;
          nickname: string;
          avatar: string;
          game_player_id?: string;
          game_skill_level?: number;
        }>;
      };
    };
  }): FaceitMatch {
    // Helper to map roster player with proper optional property handling
    const mapRosterPlayer = (p: {
      player_id: string;
      nickname: string;
      avatar: string;
      game_player_id?: string;
      game_skill_level?: number;
    }): FaceitPlayer => {
      const player: FaceitPlayer = {
        playerId: p.player_id,
        nickname: p.nickname,
      };
      if (p.avatar) player.avatar = p.avatar;
      if (p.game_player_id) player.gamePlayerId = p.game_player_id;
      if (p.game_skill_level !== undefined)
        player.skillLevel = p.game_skill_level;
      return player;
    };

    // Build faction1 team
    const faction1: FaceitTeam = {
      teamId: data.teams.faction1.team_id,
      name: data.teams.faction1.nickname,
      roster: data.teams.faction1.roster.map(mapRosterPlayer),
    };
    if (data.teams.faction1.avatar)
      faction1.avatar = data.teams.faction1.avatar;

    // Build faction2 team
    const faction2: FaceitTeam = {
      teamId: data.teams.faction2.team_id,
      name: data.teams.faction2.nickname,
      roster: data.teams.faction2.roster.map(mapRosterPlayer),
    };
    if (data.teams.faction2.avatar)
      faction2.avatar = data.teams.faction2.avatar;

    const match: FaceitMatch = {
      matchId: data.match_id,
      gameId: data.game_id,
      region: data.region,
      matchType: data.match_type,
      game: data.game,
      status: data.status,
      startedAt: new Date(data.started_at * 1000),
      finishedAt: data.finished_at ? new Date(data.finished_at * 1000) : null,
      teams: {
        faction1,
        faction2,
      },
    };

    // Add optional results if present
    if (data.results) match.results = data.results;

    return match;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
