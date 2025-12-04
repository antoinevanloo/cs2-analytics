/**
 * FACEIT OAuth2 Strategy
 *
 * Implements FACEIT authentication using OAuth2.
 * Creates or updates user on successful authentication.
 *
 * FACEIT OAuth2 flow:
 * 1. Redirect to FACEIT authorization URL
 * 2. User authorizes application
 * 3. FACEIT redirects back with authorization code
 * 4. Exchange code for access token
 * 5. Fetch user profile with access token
 *
 * @module auth/strategies
 */

import { Injectable, Logger } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { Strategy as OAuth2Strategy } from "passport-oauth2";
import { PrismaService } from "../../../common/prisma";

/**
 * FACEIT user profile from API
 */
export interface FaceitProfile {
  faceitId: string;
  nickname: string;
  avatar: string;
  country: string;
  steamId64?: string;
  gamePlayerId?: string; // CS2 game player ID
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

/**
 * Raw FACEIT API response
 */
interface FaceitApiProfile {
  player_id: string;
  nickname: string;
  avatar: string;
  country: string;
  steam_id_64?: string;
  games?: {
    cs2?: {
      skill_level: number;
      faceit_elo: number;
      region: string;
      game_player_id: string;
    };
    csgo?: {
      skill_level: number;
      faceit_elo: number;
      region: string;
      game_player_id: string;
    };
  };
  memberships?: string[];
  membership_type?: string;
}

@Injectable()
export class FaceitOAuthStrategy extends PassportStrategy(
  OAuth2Strategy,
  "faceit",
) {
  private readonly logger = new Logger(FaceitOAuthStrategy.name);

  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const clientId = configService.get<string>("FACEIT_CLIENT_ID");
    const clientSecret = configService.get<string>("FACEIT_CLIENT_SECRET");
    const callbackUrl = configService.get<string>(
      "FACEIT_CALLBACK_URL",
      "http://localhost:3001/v1/auth/faceit/callback",
    );

    if (!clientId || !clientSecret) {
      // Allow module to load without credentials (for development)
      super({
        authorizationURL: "https://accounts.faceit.com/oauth/authorize",
        tokenURL: "https://accounts.faceit.com/oauth/token",
        clientID: "placeholder",
        clientSecret: "placeholder",
        callbackURL: callbackUrl,
        scope: ["openid", "profile", "email"],
      });
      return;
    }

    super({
      authorizationURL: "https://accounts.faceit.com/oauth/authorize",
      tokenURL: "https://accounts.faceit.com/oauth/token",
      clientID: clientId,
      clientSecret: clientSecret,
      callbackURL: callbackUrl,
      scope: ["openid", "profile", "email"],
    });
  }

  /**
   * Validate OAuth callback and fetch user profile
   */
  async validate(
    accessToken: string,
    _refreshToken: string,
    _profile: unknown,
    done: (error: Error | null, user?: FaceitProfile) => void,
  ): Promise<void> {
    try {
      // Fetch full profile from FACEIT API
      const faceitProfile = await this.fetchFaceitProfile(accessToken);

      this.logger.log(
        `FACEIT authentication for: ${faceitProfile.nickname} (${faceitProfile.faceitId})`,
      );

      // Create or update user in database
      await this.upsertUser(faceitProfile);

      done(null, faceitProfile);
    } catch (error) {
      this.logger.error(`FACEIT authentication failed: ${error}`);
      done(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Fetch user profile from FACEIT API
   */
  private async fetchFaceitProfile(accessToken: string): Promise<FaceitProfile> {
    const response = await fetch("https://api.faceit.com/auth/v1/resources/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`FACEIT API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as FaceitApiProfile;

    return this.mapToFaceitProfile(data);
  }

  /**
   * Map raw API response to FaceitProfile
   */
  private mapToFaceitProfile(data: FaceitApiProfile): FaceitProfile {
    // Build games object, omitting undefined properties
    const games: FaceitProfile["games"] = {};
    if (data.games?.cs2) {
      games.cs2 = {
        skillLevel: data.games.cs2.skill_level,
        faceitElo: data.games.cs2.faceit_elo,
        region: data.games.cs2.region,
      };
    }
    if (data.games?.csgo) {
      games.csgo = {
        skillLevel: data.games.csgo.skill_level,
        faceitElo: data.games.csgo.faceit_elo,
        region: data.games.csgo.region,
      };
    }

    const profile: FaceitProfile = {
      faceitId: data.player_id,
      nickname: data.nickname,
      avatar: data.avatar,
      country: data.country,
      games,
      membership: {
        type: data.membership_type || "free",
      },
    };

    // Add optional properties only if present
    if (data.steam_id_64) profile.steamId64 = data.steam_id_64;
    const gamePlayerId = data.games?.cs2?.game_player_id || data.games?.csgo?.game_player_id;
    if (gamePlayerId) profile.gamePlayerId = gamePlayerId;

    return profile;
  }

  /**
   * Create or update user from FACEIT profile
   */
  private async upsertUser(profile: FaceitProfile): Promise<void> {
    // Check if user exists by FACEIT ID
    let existingUser = await this.prisma.user.findFirst({
      where: { faceitId: profile.faceitId },
    });

    // Also check by Steam ID if linked
    if (!existingUser && profile.steamId64) {
      existingUser = await this.prisma.user.findFirst({
        where: { steamId: profile.steamId64 },
      });
    }

    if (existingUser) {
      // Update existing user - link FACEIT account
      // Build update data, only including steamId if we have a value
      const updateData: {
        faceitId: string;
        name: string;
        avatar: string;
        steamId?: string;
      } = {
        faceitId: profile.faceitId,
        name: existingUser.name || profile.nickname,
        avatar: existingUser.avatar || profile.avatar,
      };

      // Link Steam ID if not already linked and we have one from FACEIT
      if (!existingUser.steamId && profile.steamId64) {
        updateData.steamId = profile.steamId64;
      }

      await this.prisma.user.update({
        where: { id: existingUser.id },
        data: updateData,
      });
      this.logger.debug(`Updated existing user with FACEIT: ${existingUser.id}`);
    } else {
      // Create new user from FACEIT
      // Build create data, only including steamId if we have a value
      const createData: {
        email: string;
        name: string;
        faceitId: string;
        avatar: string;
        plan: "FREE";
        steamId?: string;
      } = {
        email: `${profile.faceitId}@faceit.local`, // Placeholder email
        name: profile.nickname,
        faceitId: profile.faceitId,
        avatar: profile.avatar,
        plan: "FREE",
      };

      if (profile.steamId64) {
        createData.steamId = profile.steamId64;
      }

      const newUser = await this.prisma.user.create({
        data: createData,
      });
      this.logger.log(`Created new user from FACEIT: ${newUser.id}`);
    }
  }
}
