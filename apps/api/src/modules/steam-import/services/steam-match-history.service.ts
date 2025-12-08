/**
 * Steam Match History Service
 *
 * Interacts with Steam API GetNextMatchSharingCode endpoint
 * to retrieve user's match history.
 *
 * API: https://api.steampowered.com/ICSGOPlayers_730/GetNextMatchSharingCode/v1
 *
 * @module steam-import/services
 */

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CircuitBreaker,
  CircuitBreakerOpenError,
} from "../../../common/resilience/circuit-breaker";
import type { SteamMatchHistoryResponse } from "../types/steam-import.types";

const STEAM_API_BASE = "https://api.steampowered.com";
const MATCH_HISTORY_ENDPOINT = "/ICSGOPlayers_730/GetNextMatchSharingCode/v1";

// Rate limit: Steam allows ~200 requests per 5 minutes
const REQUEST_TIMEOUT = 30000; // 30 seconds

@Injectable()
export class SteamMatchHistoryService {
  private readonly logger = new Logger(SteamMatchHistoryService.name);
  private readonly apiKey: string;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>("STEAM_API_KEY", "");

    if (!this.apiKey) {
      this.logger.warn(
        "STEAM_API_KEY not configured - Steam match history disabled",
      );
    }

    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker({
      name: "steam-match-history-api",
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      successThreshold: 2,
      failureWindow: 120000, // 2 minutes
      requestTimeout: REQUEST_TIMEOUT,
    });
  }

  /**
   * Check if service is properly configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get circuit breaker status for monitoring
   */
  getCircuitStatus(): { state: string; failures: number } {
    return this.circuitBreaker.getStatus();
  }

  /**
   * Fetch next share code in user's match history
   *
   * @param steamId - User's Steam ID (64-bit)
   * @param authCode - Game authentication code (XXXX-XXXXX-XXXX format)
   * @param knownCode - Last known share code
   * @returns Next share code or null if no more matches
   * @throws Error if API call fails
   */
  async getNextShareCode(
    steamId: string,
    authCode: string,
    knownCode: string,
  ): Promise<string | null> {
    if (!this.isConfigured()) {
      throw new Error("Steam API key not configured");
    }

    try {
      return await this.circuitBreaker.execute(async () => {
        const params = new URLSearchParams({
          key: this.apiKey,
          steamid: steamId,
          steamidkey: authCode,
          knowncode: knownCode,
        });

        const url = `${STEAM_API_BASE}${MATCH_HISTORY_ENDPOINT}?${params.toString()}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          REQUEST_TIMEOUT,
        );

        try {
          const response = await fetch(url, {
            method: "GET",
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          // Handle specific Steam API error codes
          if (response.status === 403) {
            throw new Error("Invalid authentication code - please regenerate");
          }

          if (response.status === 412) {
            throw new Error(
              "Invalid or mismatched share code - check the format",
            );
          }

          if (response.status === 429) {
            throw new Error("Rate limited by Steam API - try again later");
          }

          if (!response.ok) {
            throw new Error(`Steam API error: ${response.status}`);
          }

          const data = (await response.json()) as SteamMatchHistoryResponse;

          // "n/a" means no more matches in history
          if (data.result?.nextcode === "n/a") {
            return null;
          }

          return data.result?.nextcode || null;
        } finally {
          clearTimeout(timeoutId);
        }
      });
    } catch (error) {
      if (error instanceof CircuitBreakerOpenError) {
        this.logger.warn(
          `Circuit breaker open, retry in ${error.retryAfterMs}ms`,
        );
        throw new Error(
          `Steam API temporarily unavailable. Retry in ${Math.ceil(error.retryAfterMs / 1000)} seconds.`,
        );
      }

      this.logger.error(
        `Failed to get next share code: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Fetch all new share codes since the last known code
   *
   * Paginates through the match history API until no more matches are found.
   * Returns share codes in chronological order (oldest first).
   *
   * @param steamId - User's Steam ID
   * @param authCode - Game authentication code
   * @param lastKnownCode - Last processed share code (null = start from oldest)
   * @param maxMatches - Maximum matches to fetch (default: 100)
   * @returns Array of new share codes
   */
  async getAllNewShareCodes(
    steamId: string,
    authCode: string,
    lastKnownCode: string | null,
    maxMatches: number = 100,
  ): Promise<string[]> {
    const shareCodes: string[] = [];
    let currentCode = lastKnownCode;
    let iterations = 0;

    // Safety limit to prevent infinite loops
    const maxIterations = maxMatches + 10;

    while (iterations < maxIterations) {
      iterations++;

      if (!currentCode) {
        // No starting code - user needs to provide initial share code
        this.logger.warn(
          `No starting share code for user ${steamId} - need initial code`,
        );
        break;
      }

      try {
        const nextCode = await this.getNextShareCode(
          steamId,
          authCode,
          currentCode,
        );

        if (!nextCode) {
          // No more matches
          this.logger.debug(
            `No more matches found for user ${steamId} after ${shareCodes.length} new codes`,
          );
          break;
        }

        shareCodes.push(nextCode);
        currentCode = nextCode;

        if (shareCodes.length >= maxMatches) {
          this.logger.debug(
            `Reached max matches limit (${maxMatches}) for user ${steamId}`,
          );
          break;
        }

        // Small delay to be nice to Steam API
        await this.delay(100);
      } catch (error) {
        this.logger.error(
          `Error fetching share codes for ${steamId}: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    }

    return shareCodes;
  }

  /**
   * Validate that an auth code is valid by making a test request
   *
   * @param steamId - User's Steam ID
   * @param authCode - Game authentication code to validate
   * @param testShareCode - A share code to test with
   * @returns true if auth code is valid
   */
  async validateAuthCode(
    steamId: string,
    authCode: string,
    testShareCode: string,
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      // Try to get next code - if it doesn't throw, credentials are valid
      await this.getNextShareCode(steamId, authCode, testShareCode);
      return { valid: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";

      if (message.includes("Invalid authentication code")) {
        return { valid: false, error: "Invalid authentication code" };
      }

      if (message.includes("Invalid or mismatched share code")) {
        return { valid: false, error: "Invalid share code format" };
      }

      // Other errors might be temporary (rate limiting, network issues)
      return { valid: false, error: message };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
