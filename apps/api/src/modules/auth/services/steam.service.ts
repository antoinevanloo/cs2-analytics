/**
 * Steam Authentication Service
 *
 * Handles Steam OpenID 2.0 verification and profile fetching.
 * Implements manual OpenID verification to avoid Passport/Fastify incompatibility.
 *
 * @module auth/services
 */

import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../../common/prisma";

export interface SteamProfile {
  steamId: string;
  personaName: string;
  profileUrl: string;
  avatar: {
    small: string;
    medium: string;
    large: string;
  };
  visibilityState: number;
  realName?: string;
  countryCode?: string;
}

interface SteamApiResponse {
  response: {
    players: Array<{
      steamid: string;
      personaname: string;
      profileurl: string;
      avatar: string;
      avatarmedium: string;
      avatarfull: string;
      communityvisibilitystate: number;
      realname?: string;
      loccountrycode?: string;
    }>;
  };
}

@Injectable()
export class SteamService {
  private readonly logger = new Logger(SteamService.name);
  private readonly apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.apiKey = this.configService.get<string>("STEAM_API_KEY", "");

    if (!this.apiKey) {
      this.logger.warn("STEAM_API_KEY not configured - Steam auth disabled");
    }
  }

  /**
   * Verify Steam OpenID 2.0 response
   * Returns the Steam ID if verification is successful
   */
  async verifyOpenIdResponse(
    query: Record<string, string>,
  ): Promise<string> {
    // Check required OpenID parameters
    const mode = query["openid.mode"];
    const claimedId = query["openid.claimed_id"];

    if (mode !== "id_res") {
      throw new UnauthorizedException("Invalid OpenID mode");
    }

    if (!claimedId) {
      throw new UnauthorizedException("Missing claimed_id");
    }

    // Extract Steam ID from claimed_id
    // Format: https://steamcommunity.com/openid/id/76561198012345678
    const steamIdMatch = claimedId.match(/\/openid\/id\/(\d+)$/);
    if (!steamIdMatch || !steamIdMatch[1]) {
      throw new UnauthorizedException("Invalid Steam ID format");
    }

    const steamId: string = steamIdMatch[1];

    // Verify the OpenID assertion with Steam
    const verificationParams = new URLSearchParams();

    // Copy all openid.* params from the callback
    for (const [key, value] of Object.entries(query)) {
      if (key.startsWith("openid.")) {
        verificationParams.set(key, value);
      }
    }

    // Change mode to check_authentication
    verificationParams.set("openid.mode", "check_authentication");

    try {
      const verifyUrl = `https://steamcommunity.com/openid/login?${verificationParams.toString()}`;
      const response = await fetch(verifyUrl);
      const text = await response.text();

      // Steam responds with "is_valid:true" if valid
      if (!text.includes("is_valid:true")) {
        this.logger.error("Steam OpenID verification failed");
        throw new UnauthorizedException("OpenID verification failed");
      }

      this.logger.log(`Steam OpenID verified for: ${steamId}`);
      return steamId;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Steam verification error: ${error}`);
      throw new UnauthorizedException("Failed to verify with Steam");
    }
  }

  /**
   * Fetch user profile from Steam Web API
   */
  async fetchProfile(steamId: string): Promise<SteamProfile> {
    if (!this.apiKey) {
      throw new Error("STEAM_API_KEY not configured");
    }

    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${this.apiKey}&steamids=${steamId}`;

    try {
      const response = await fetch(url);
      const data = (await response.json()) as SteamApiResponse;

      const player = data.response?.players?.[0];
      if (!player) {
        throw new UnauthorizedException("Steam profile not found");
      }

      const profile: SteamProfile = {
        steamId: player.steamid,
        personaName: player.personaname,
        profileUrl: player.profileurl,
        avatar: {
          small: player.avatar,
          medium: player.avatarmedium,
          large: player.avatarfull,
        },
        visibilityState: player.communityvisibilitystate,
      };

      if (player.realname) {
        profile.realName = player.realname;
      }
      if (player.loccountrycode) {
        profile.countryCode = player.loccountrycode;
      }

      return profile;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Failed to fetch Steam profile: ${error}`);
      throw new UnauthorizedException("Failed to fetch Steam profile");
    }
  }

  /**
   * Create or update user from Steam profile
   */
  async upsertUser(profile: SteamProfile): Promise<void> {
    const existingUser = await this.prisma.user.findFirst({
      where: { steamId: profile.steamId },
    });

    if (existingUser) {
      await this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: profile.personaName,
          avatar: profile.avatar.large,
        },
      });
      this.logger.debug(`Updated existing user: ${existingUser.id}`);
    } else {
      const newUser = await this.prisma.user.create({
        data: {
          email: `${profile.steamId}@steam.local`,
          name: profile.personaName,
          steamId: profile.steamId,
          avatar: profile.avatar.large,
          plan: "FREE",
        },
      });
      this.logger.log(`Created new user from Steam: ${newUser.id}`);
    }
  }

  /**
   * Full authentication flow: verify, fetch profile, upsert user
   */
  async authenticateCallback(
    query: Record<string, string>,
  ): Promise<SteamProfile> {
    // Verify the OpenID response
    const steamId = await this.verifyOpenIdResponse(query);

    // Fetch the full profile
    const profile = await this.fetchProfile(steamId);

    // Create or update user
    await this.upsertUser(profile);

    return profile;
  }
}
