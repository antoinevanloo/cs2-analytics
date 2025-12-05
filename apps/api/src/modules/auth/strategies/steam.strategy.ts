/**
 * Steam OpenID Strategy
 *
 * Implements Steam authentication using OpenID 2.0.
 * Uses passport-steam-openid for reliable OpenID handling without
 * the problematic openid library dependency.
 *
 * @module auth/strategies
 */

import { Injectable, Logger } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { SteamOpenIdStrategy } from "passport-steam-openid";
import { PrismaService } from "../../../common/prisma";
import type { FastifyRequest } from "fastify";

/**
 * Steam Profile as returned by passport-steam-openid
 */
interface SteamOpenIdProfile {
  steamid: string;
  personaname: string;
  profileurl: string;
  avatar: string;
  avatarmedium: string;
  avatarfull: string;
  communityvisibilitystate: number;
  realname?: string;
  loccountrycode?: string;
}

/**
 * Steam profile normalized for our application
 */
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
  realName?: string | undefined;
  countryCode?: string | undefined;
}

@Injectable()
export class SteamOAuthStrategy extends PassportStrategy(
  SteamOpenIdStrategy,
  "steam",
) {
  private readonly logger = new Logger(SteamOAuthStrategy.name);

  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const apiKey = configService.get<string>("STEAM_API_KEY", "");
    const returnUrl = configService.get<string>(
      "STEAM_RETURN_URL",
      "http://localhost:3000/v1/auth/steam/callback",
    );

    super({
      returnURL: returnUrl,
      profile: true, // Fetch full profile from Steam API
      apiKey: apiKey,
    });
  }

  /**
   * Validate Steam profile and create/update user
   * Called after successful Steam authentication
   */
  async validate(
    _req: FastifyRequest,
    _identifier: string,
    profile: SteamOpenIdProfile,
    done: (error: Error | null, user?: SteamProfile) => void,
  ): Promise<void> {
    try {
      this.logger.log(
        `Steam authentication for: ${profile.personaname} (${profile.steamid})`,
      );

      // Extract Steam profile data
      const steamProfile: SteamProfile = {
        steamId: profile.steamid,
        personaName: profile.personaname,
        profileUrl: profile.profileurl,
        avatar: {
          small: profile.avatar,
          medium: profile.avatarmedium,
          large: profile.avatarfull,
        },
        visibilityState: profile.communityvisibilitystate,
        realName: profile.realname,
        countryCode: profile.loccountrycode,
      };

      // Create or update user in database
      await this.upsertUser(steamProfile);

      done(null, steamProfile);
    } catch (error) {
      this.logger.error(`Steam authentication failed: ${error}`);
      done(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Create or update user from Steam profile
   */
  private async upsertUser(profile: SteamProfile): Promise<void> {
    // Check if user exists by Steam ID
    const existingUser = await this.prisma.user.findFirst({
      where: { steamId: profile.steamId },
    });

    if (existingUser) {
      // Update existing user
      await this.prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: profile.personaName,
          avatar: profile.avatar.large,
        },
      });
      this.logger.debug(`Updated existing user: ${existingUser.id}`);
    } else {
      // Create new user
      const newUser = await this.prisma.user.create({
        data: {
          email: `${profile.steamId}@steam.local`, // Placeholder email
          name: profile.personaName,
          steamId: profile.steamId,
          avatar: profile.avatar.large,
          plan: "FREE",
        },
      });
      this.logger.log(`Created new user from Steam: ${newUser.id}`);
    }
  }
}
