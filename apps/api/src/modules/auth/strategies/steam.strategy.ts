/**
 * Steam OpenID Strategy
 *
 * Implements Steam authentication using OpenID 2.0.
 * Creates or updates user on successful authentication.
 *
 * @module auth/strategies
 */

import { Injectable, Logger } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { Strategy as SteamStrategy } from "passport-steam";
import { PrismaService } from "../../../common/prisma";

/**
 * Steam Profile as returned by passport-steam
 */
interface SteamPassportProfile {
  id: string;
  displayName: string;
  _json: {
    steamid: string;
    personaname: string;
    profileurl: string;
    avatar: string;
    avatarmedium: string;
    avatarfull: string;
    communityvisibilitystate: number;
    realname?: string;
    loccountrycode?: string;
  };
}

/**
 * Steam profile returned from Steam API
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
  SteamStrategy,
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
      "http://localhost:3001/v1/auth/steam/callback",
    );
    const realm = configService.get<string>(
      "STEAM_REALM",
      "http://localhost:3001/",
    );

    super({
      returnURL: returnUrl,
      realm: realm,
      apiKey: apiKey,
    });
  }

  /**
   * Validate Steam profile and create/update user
   * Called after successful Steam authentication
   */
  async validate(
    _identifier: string,
    profile: SteamPassportProfile,
    done: (error: Error | null, user?: SteamProfile) => void,
  ): Promise<void> {
    try {
      this.logger.log(
        `Steam authentication for: ${profile.displayName} (${profile.id})`,
      );

      // Extract Steam profile data
      const steamProfile: SteamProfile = {
        steamId: profile.id,
        personaName: profile.displayName,
        profileUrl: profile._json.profileurl,
        avatar: {
          small: profile._json.avatar,
          medium: profile._json.avatarmedium,
          large: profile._json.avatarfull,
        },
        visibilityState: profile._json.communityvisibilitystate,
        realName: profile._json.realname,
        countryCode: profile._json.loccountrycode,
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
