/**
 * Steam Game Coordinator Service
 *
 * Connects to Steam via a bot account and communicates with the CS2 Game Coordinator
 * to fetch demo download URLs.
 *
 * @module steam-import/services
 */

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import SteamUser from "steam-user";
import GlobalOffensive from "globaloffensive";
import SteamTotp from "steam-totp";

export interface DemoUrlResult {
  success: boolean;
  demoUrl?: string;
  expiresAt?: Date;
  matchInfo?: {
    mapName: string;
    matchTime: Date;
    matchDuration: number;
    team1Score: number;
    team2Score: number;
  };
  error?: string;
}

interface MatchInfo {
  matchid?: string;
  matchtime?: number;
  watchablematchinfo?: {
    tv_port?: number;
    server_ip?: number;
    cl_decryptdata_key_pub?: Buffer;
  };
  roundstatsall?: Array<{
    map?: string;
    reservation?: {
      game_type?: number;
    };
    match_duration?: number;
    team_scores?: number[];
  }>;
}

@Injectable()
export class SteamGcService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SteamGcService.name);
  private steamClient: SteamUser | null = null;
  private csgoClient: GlobalOffensive | null = null;
  private isConnected = false;
  private isConnecting = false;
  private connectionPromise: Promise<void> | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectDelay = 30000; // 30 seconds between reconnect attempts

  private readonly botUsername: string;
  private readonly botPassword: string;
  private readonly sharedSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.botUsername = this.configService.get<string>("STEAM_BOT_USERNAME", "");
    this.botPassword = this.configService.get<string>("STEAM_BOT_PASSWORD", "");
    this.sharedSecret = this.configService.get<string>(
      "STEAM_BOT_SHARED_SECRET",
      "",
    );

    if (!this.botUsername || !this.botPassword) {
      this.logger.warn(
        "Steam bot credentials not configured - demo download disabled",
      );
    }
  }

  /**
   * Connect to Steam at module initialization (persistent connection)
   */
  async onModuleInit(): Promise<void> {
    if (this.isConfigured()) {
      this.logger.log("Initializing persistent Steam connection...");
      // Connect in background, don't block startup
      this.connect().catch((error) => {
        this.logger.error(`Failed to connect to Steam on startup: ${error.message}`);
        this.scheduleReconnect();
      });
    }
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error(
        `Max reconnect attempts (${this.maxReconnectAttempts}) reached. Manual intervention required.`,
      );
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    this.logger.log(
      `Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay / 1000}s`,
    );

    setTimeout(() => {
      if (!this.isConnected && !this.isConnecting) {
        this.connect().catch((error) => {
          this.logger.error(`Reconnect attempt failed: ${error.message}`);
          this.scheduleReconnect();
        });
      }
    }, delay);
  }

  /**
   * Check if service is properly configured
   */
  isConfigured(): boolean {
    return !!(this.botUsername && this.botPassword);
  }

  /**
   * Get connection status
   */
  getStatus(): { connected: boolean; connecting: boolean } {
    return {
      connected: this.isConnected,
      connecting: this.isConnecting,
    };
  }

  /**
   * Connect to Steam and CS2 Game Coordinator
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    if (this.isConnecting && this.connectionPromise) {
      return this.connectionPromise;
    }

    if (!this.isConfigured()) {
      throw new Error("Steam bot credentials not configured");
    }

    this.isConnecting = true;

    this.connectionPromise = new Promise<void>((resolve, reject) => {
      this.logger.log("Connecting to Steam...");

      this.steamClient = new SteamUser();
      this.csgoClient = new GlobalOffensive(this.steamClient);

      // Set up Steam client event handlers
      this.steamClient.on("loggedOn", () => {
        this.logger.log("Logged into Steam, launching CS2...");
        this.steamClient!.gamesPlayed([730]); // CS2 app ID
      });

      this.steamClient.on("error", (err: Error) => {
        this.logger.error(`Steam client error: ${err.message}`);
        this.isConnected = false;
        this.isConnecting = false;
        reject(err);
      });

      this.steamClient.on("disconnected", () => {
        this.logger.warn("Disconnected from Steam");
        this.isConnected = false;
        this.connectionPromise = null;
        // Schedule reconnection
        this.scheduleReconnect();
      });

      // Set up CS2 GC event handlers
      this.csgoClient.on("connectedToGC", () => {
        this.logger.log("Connected to CS2 Game Coordinator");
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0; // Reset reconnect counter on success
        resolve();
      });

      this.csgoClient.on("disconnectedFromGC", (reason: number) => {
        this.logger.warn(`Disconnected from GC: ${reason}`);
        this.isConnected = false;
        // Don't schedule reconnect here - wait for Steam disconnect
      });

      this.csgoClient.on("error", (err: Error) => {
        this.logger.error(`CS2 GC error: ${err.message}`);
      });

      // Login to Steam
      const loginOptions: {
        accountName: string;
        password: string;
        twoFactorCode?: string;
      } = {
        accountName: this.botUsername,
        password: this.botPassword,
      };

      // Generate 2FA code if shared secret is available
      if (this.sharedSecret) {
        const twoFactorCode = SteamTotp.generateAuthCode(this.sharedSecret);
        //this.logger.log(`Generated 2FA code: ${twoFactorCode} (secret starts with: ${this.sharedSecret.substring(0, 4)}...)`);
        loginOptions.twoFactorCode = twoFactorCode;
      } else {
        this.logger.warn("No shared secret configured - 2FA code not generated");
      }

      //this.logger.log(`Logging in as: ${this.botUsername}`);
      this.steamClient.logOn(loginOptions);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!this.isConnected) {
          this.isConnecting = false;
          reject(new Error("Connection timeout - failed to connect to GC"));
        }
      }, 30000);
    });

    return this.connectionPromise;
  }

  /**
   * Disconnect from Steam
   */
  async disconnect(): Promise<void> {
    if (this.steamClient) {
      this.steamClient.logOff();
      this.steamClient = null;
      this.csgoClient = null;
      this.isConnected = false;
      this.isConnecting = false;
      this.connectionPromise = null;
      this.logger.log("Disconnected from Steam");
    }
  }

  /**
   * Request demo URL from Game Coordinator
   *
   * @param matchId - Match ID (BigInt as string)
   * @param outcomeId - Outcome/Reservation ID
   * @param token - Token from share code
   */
  async requestDemoUrl(
    matchId: string,
    outcomeId: string,
    token: number,
  ): Promise<DemoUrlResult> {
    if (!this.isConnected) {
      try {
        await this.connect();
      } catch (error) {
        return {
          success: false,
          error: `Failed to connect to Steam: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    if (!this.csgoClient) {
      return {
        success: false,
        error: "CS2 client not initialized",
      };
    }

    return new Promise<DemoUrlResult>((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          success: false,
          error: "Timeout waiting for match info from GC",
        });
      }, 30000);

      // Request match info from GC
      this.csgoClient!.requestGame({
        matchId: matchId,
        outcomeId: outcomeId,
        token: token,
      });

      // Listen for the response
      const onMatchInfo = (matches: MatchInfo[]) => {
        clearTimeout(timeout);

        if (!matches || matches.length === 0) {
          resolve({
            success: false,
            error: "Match not found or demo unavailable",
          });
          return;
        }

        const response = matches[0];
        if (!response?.roundstatsall?.length) {
          resolve({
            success: false,
            error: "Match data incomplete",
          });
          return;
        }

        const lastRound = response.roundstatsall[response.roundstatsall.length - 1];

        // Extract match info
        const matchInfo = {
          mapName: lastRound?.map || "unknown",
          matchTime: new Date((response.matchtime || 0) * 1000),
          matchDuration: lastRound?.match_duration || 0,
          team1Score: lastRound?.team_scores?.[0] || 0,
          team2Score: lastRound?.team_scores?.[1] || 0,
        };

        resolve({
          success: true,
          matchInfo,
        });
      };

      this.csgoClient!.once("matchList", onMatchInfo);
    });
  }

  /**
   * Request full match list to get demo download URLs
   */
  async requestMatchDetails(
    matchId: string,
    outcomeId: string,
    token: number,
  ): Promise<DemoUrlResult> {
    if (!this.isConnected) {
      try {
        await this.connect();
      } catch (error) {
        return {
          success: false,
          error: `Failed to connect to Steam: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    if (!this.csgoClient) {
      return {
        success: false,
        error: "CS2 client not initialized",
      };
    }

    return new Promise<DemoUrlResult>((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          success: false,
          error: "Timeout waiting for match details from GC",
        });
      }, 30000);

      // Request the match
      this.csgoClient!.requestGame({
        matchId: matchId,
        outcomeId: outcomeId,
        token: token,
      });

      // The matchList event returns full match info including demo URL
      const onMatchList = (matches: MatchInfo[]) => {
        clearTimeout(timeout);

        this.logger.log(`GC Response: ${JSON.stringify(matches, null, 2).substring(0, 2000)}`);

        if (!matches || matches.length === 0) {
          resolve({
            success: false,
            error: "Match not found",
          });
          return;
        }

        const match = matches[0]!;

        // Extract demo URL info from the last round
        const lastRound = match?.roundstatsall?.[match?.roundstatsall?.length - 1 || 0];

        // In CS2, the demo URL is in the 'map' field of the last round
        const demoUrl = lastRound?.map as string | undefined;

        this.logger.log(`Demo URL from map field: ${demoUrl}`);
        this.logger.log(`Match time: ${match?.matchtime}`);

        // Check if we have a valid demo URL (starts with http)
        const hasDemoUrl = demoUrl && demoUrl.startsWith('http');

        if (!hasDemoUrl) {
          resolve({
            success: false,
            error: "Demo not available for download",
          });
          return;
        }

        // Extract match info - note: map field contains URL, not map name
        // We need to get map name from elsewhere or parse it from the URL
        const matchInfo = {
          mapName: "unknown", // Map name not directly available in this response
          matchTime: new Date((match?.matchtime || 0) * 1000),
          matchDuration: lastRound?.match_duration || 0,
          team1Score: lastRound?.team_scores?.[0] || 0,
          team2Score: lastRound?.team_scores?.[1] || 0,
        };

        this.logger.log(`Match info extracted: ${JSON.stringify(matchInfo)}`);
        this.logger.log(`Demo URL: ${demoUrl}`);

        resolve({
          success: true,
          demoUrl: demoUrl,
          matchInfo,
        });
      };

      this.csgoClient!.once("matchList", onMatchList);
    });
  }

  /**
   * Fetch match info only (no demo URL) - for sync phase
   * Rate limited: 1 request per 500ms to avoid GC spam
   *
   * @returns Match info without triggering download
   */
  async fetchMatchInfoOnly(
    matchId: string,
    outcomeId: string,
    token: number,
  ): Promise<{
    success: boolean;
    matchInfo?: {
      mapName: string;
      matchTime: Date;
      matchDuration: number;
      team1Score: number;
      team2Score: number;
    };
    error?: string;
  }> {
    if (!this.isConnected) {
      try {
        await this.connect();
      } catch (error) {
        return {
          success: false,
          error: `Failed to connect to Steam: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    if (!this.csgoClient) {
      return {
        success: false,
        error: "CS2 client not initialized",
      };
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          success: false,
          error: "Timeout waiting for match info from GC",
        });
      }, 15000); // 15s timeout for info-only requests

      this.csgoClient!.requestGame({
        matchId: matchId,
        outcomeId: outcomeId,
        token: token,
      });

      const onMatchList = (matches: MatchInfo[]) => {
        clearTimeout(timeout);

        if (!matches || matches.length === 0) {
          resolve({
            success: false,
            error: "Match not found",
          });
          return;
        }

        const match = matches[0]!;
        const lastRound = match?.roundstatsall?.[match?.roundstatsall?.length - 1 || 0];

        // Log all available fields to find map name location
        this.logger.debug(`Match keys: ${Object.keys(match || {}).join(", ")}`);
        this.logger.debug(`LastRound keys: ${Object.keys(lastRound || {}).join(", ")}`);
        if ((match as Record<string, unknown>).watchablematchinfo) {
          this.logger.debug(`WatchableMatchInfo: ${JSON.stringify((match as Record<string, unknown>).watchablematchinfo)}`);
        }

        // Map field might be URL or actual map name
        const mapField = lastRound?.map || "";
        const isUrl = mapField.startsWith("http");

        // If it's a URL, map name will come from parsing later
        // Otherwise use the map field value
        const mapName = isUrl ? "TBD" : (mapField || "unknown");

        resolve({
          success: true,
          matchInfo: {
            mapName,
            matchTime: new Date((match?.matchtime || 0) * 1000),
            matchDuration: lastRound?.match_duration || 0,
            team1Score: lastRound?.team_scores?.[0] || 0,
            team2Score: lastRound?.team_scores?.[1] || 0,
          },
        });
      };

      this.csgoClient!.once("matchList", onMatchList);
    });
  }

  /**
   * Batch fetch match info with rate limiting
   * Processes matches sequentially with delay to avoid GC rate limits
   *
   * Resilience: Continues on individual failures, returns partial results
   * Performance: 500ms delay between requests (~2 req/s)
   *
   * @param matches - Array of match data to fetch
   * @param onProgress - Optional callback for progress updates
   * @returns Results for each match (success or failure)
   */
  async fetchMatchInfoBatch(
    matches: Array<{
      id: string;
      matchId: string;
      outcomeId: string;
      token: number;
    }>,
    onProgress?: (completed: number, total: number) => void,
  ): Promise<Array<{
    id: string;
    success: boolean;
    matchInfo?: {
      mapName: string;
      matchTime: Date;
      matchDuration: number;
      team1Score: number;
      team2Score: number;
    };
    error?: string;
  }>> {
    const results: Array<{
      id: string;
      success: boolean;
      matchInfo?: {
        mapName: string;
        matchTime: Date;
        matchDuration: number;
        team1Score: number;
        team2Score: number;
      };
      error?: string;
    }> = [];

    const RATE_LIMIT_DELAY = 500; // 500ms between requests

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i]!;

      try {
        const result = await this.fetchMatchInfoOnly(
          match.matchId,
          match.outcomeId,
          match.token,
        );

        const resultEntry: (typeof results)[number] = {
          id: match.id,
          success: result.success,
        };
        if (result.matchInfo) {
          resultEntry.matchInfo = result.matchInfo;
        }
        if (result.error) {
          resultEntry.error = result.error;
        }
        results.push(resultEntry);

        if (result.success) {
          this.logger.log(
            `Fetched info for match ${match.id}: ${result.matchInfo?.team1Score}-${result.matchInfo?.team2Score}`,
          );
        } else {
          this.logger.warn(`Failed to fetch info for match ${match.id}: ${result.error}`);
        }
      } catch (error) {
        // Resilience: Continue on failure
        results.push({
          id: match.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
        this.logger.error(`Error fetching match ${match.id}: ${error}`);
      }

      // Progress callback for gamification
      if (onProgress) {
        onProgress(i + 1, matches.length);
      }

      // Rate limiting delay (except for last item)
      if (i < matches.length - 1) {
        await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY));
      }
    }

    return results;
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }
}
