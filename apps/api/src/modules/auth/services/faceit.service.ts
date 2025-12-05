/**
 * FACEIT Authentication Service
 *
 * Handles FACEIT OAuth2 authentication flow.
 * Manual implementation for Fastify compatibility and resilience.
 *
 * OAuth2 Flow:
 * 1. Redirect to FACEIT authorization endpoint
 * 2. User authorizes, FACEIT redirects back with code
 * 3. Exchange code for access token
 * 4. Fetch user profile with access token
 *
 * @module auth/services
 */

import {
  Injectable,
  Logger,
  UnauthorizedException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../../common/prisma";
import { randomBytes } from "crypto";

/**
 * FaceitProfile interface matching the strategy type
 * Used across auth module for consistency
 */
export interface FaceitProfile {
  faceitId: string;
  nickname: string;
  avatar: string;
  country: string;
  steamId64?: string;
  gamePlayerId?: string;
  games: {
    cs2?: {
      skillLevel: number;
      faceitElo: number;
      region: string;
    };
    csgo?: {
      skillLevel: number;
      faceitElo: number;
      region: string;
    };
  };
  membership: {
    type: string;
  };
}

interface FaceitTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

interface FaceitUserResponse {
  player_id: string;
  nickname: string;
  avatar: string;
  country: string;
  faceit_url: string;
  membership_type: string;
  games?: {
    cs2?: {
      skill_level: number;
      faceit_elo: number;
    };
    csgo?: {
      skill_level: number;
      faceit_elo: number;
    };
  };
  steam_id_64?: string;
}

@Injectable()
export class FaceitService {
  private readonly logger = new Logger(FaceitService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly isConfigured: boolean;

  // FACEIT OAuth2 endpoints
  private readonly authorizationUrl = "https://accounts.faceit.com/accounts";
  private readonly tokenUrl = "https://api.faceit.com/auth/v1/oauth/token";
  private readonly userInfoUrl = "https://api.faceit.com/auth/v1/resources/userinfo";

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.clientId = this.configService.get<string>("FACEIT_CLIENT_ID", "");
    this.clientSecret = this.configService.get<string>("FACEIT_CLIENT_SECRET", "");
    this.redirectUri = this.configService.get<string>(
      "FACEIT_REDIRECT_URI",
      "http://localhost:3000/v1/auth/faceit/callback",
    );

    this.isConfigured = !!(this.clientId && this.clientSecret);

    if (!this.isConfigured) {
      this.logger.warn(
        "FACEIT_CLIENT_ID or FACEIT_CLIENT_SECRET not configured - FACEIT auth disabled",
      );
    }
  }

  /**
   * Check if FACEIT authentication is available
   */
  isAvailable(): boolean {
    return this.isConfigured;
  }

  /**
   * Generate the FACEIT authorization URL
   */
  getAuthorizationUrl(state?: string): string {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException("FACEIT authentication not configured");
    }

    const authState = state || randomBytes(16).toString("hex");

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: "code",
      redirect_uri: this.redirectUri,
      scope: "openid profile email",
      state: authState,
    });

    return `${this.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<FaceitTokenResponse> {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException("FACEIT authentication not configured");
    }

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");

    try {
      const response = await fetch(this.tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: this.redirectUri,
        }).toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`FACEIT token exchange failed: ${response.status} - ${errorText}`);
        throw new UnauthorizedException("Failed to exchange authorization code");
      }

      const data = (await response.json()) as FaceitTokenResponse;
      return data;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`FACEIT token exchange error: ${error}`);
      throw new UnauthorizedException("Failed to authenticate with FACEIT");
    }
  }

  /**
   * Fetch user profile from FACEIT API
   */
  async fetchProfile(accessToken: string): Promise<FaceitProfile> {
    try {
      const response = await fetch(this.userInfoUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`FACEIT profile fetch failed: ${response.status} - ${errorText}`);
        throw new UnauthorizedException("Failed to fetch FACEIT profile");
      }

      const data = (await response.json()) as FaceitUserResponse;

      // Build profile matching the expected interface
      const profile: FaceitProfile = {
        faceitId: data.player_id,
        nickname: data.nickname,
        avatar: data.avatar,
        country: data.country,
        // Only include steamId64 if present (exactOptionalPropertyTypes compliance)
        ...(data.steam_id_64 ? { steamId64: data.steam_id_64 } : {}),
        games: {},
        membership: {
          type: data.membership_type,
        },
      };

      // Add CS2 stats if available
      if (data.games?.cs2) {
        profile.games.cs2 = {
          skillLevel: data.games.cs2.skill_level,
          faceitElo: data.games.cs2.faceit_elo,
          region: "EU", // Default, FACEIT userinfo doesn't always include region
        };
      }

      // Add CSGO stats if available
      if (data.games?.csgo) {
        profile.games.csgo = {
          skillLevel: data.games.csgo.skill_level,
          faceitElo: data.games.csgo.faceit_elo,
          region: "EU",
        };
      }

      return profile;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`FACEIT profile fetch error: ${error}`);
      throw new UnauthorizedException("Failed to fetch FACEIT profile");
    }
  }

  /**
   * Create or update user from FACEIT profile
   */
  async upsertUser(profile: FaceitProfile): Promise<void> {
    const existingUser = await this.prisma.user.findFirst({
      where: { faceitId: profile.faceitId },
    });

    if (existingUser) {
      await this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: profile.nickname,
          avatar: profile.avatar,
          // Update Steam ID if available and not already set
          ...(profile.steamId64 && !existingUser.steamId
            ? { steamId: profile.steamId64 }
            : {}),
        },
      });
      this.logger.debug(`Updated existing user: ${existingUser.id}`);
    } else {
      const newUser = await this.prisma.user.create({
        data: {
          email: `${profile.faceitId}@faceit.local`,
          name: profile.nickname,
          faceitId: profile.faceitId,
          steamId: profile.steamId64 ?? null,
          avatar: profile.avatar,
          plan: "FREE",
        },
      });
      this.logger.log(`Created new user from FACEIT: ${newUser.id}`);
    }
  }

  /**
   * Full authentication callback flow
   */
  async authenticateCallback(code: string): Promise<FaceitProfile> {
    // Exchange code for token
    const tokenResponse = await this.exchangeCodeForToken(code);

    // Fetch profile
    const profile = await this.fetchProfile(tokenResponse.access_token);

    // Create or update user
    await this.upsertUser(profile);

    return profile;
  }
}
