/**
 * JWT Strategy
 *
 * Validates JWT tokens and extracts user information.
 * Used by Passport for authentication.
 *
 * @module auth/strategies
 */

import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../../common/prisma";

/**
 * JWT payload structure
 */
export interface JwtPayload {
  /** User ID */
  sub: string;
  /** User email */
  email: string;
  /** User roles */
  roles: string[];
  /** Steam ID (optional) */
  steamId?: string | undefined;
  /** Token issued at timestamp */
  iat?: number | undefined;
  /** Token expiration timestamp */
  exp?: number | undefined;
}

/**
 * Authenticated user attached to request
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
  steamId?: string | undefined;
  name?: string | undefined;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("JWT_SECRET", "cs2-analytics-dev-secret-change-in-prod"),
    });
  }

  /**
   * Validate JWT payload and return user
   * Called automatically by Passport after token verification
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // Verify user still exists in database
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        steamId: true,
        plan: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    // Map plan to roles
    const roles = this.mapPlanToRoles(user.plan, payload.roles);

    return {
      id: user.id,
      email: user.email,
      name: user.name ?? undefined,
      steamId: user.steamId ?? undefined,
      roles,
    };
  }

  /**
   * Map subscription plan to roles
   */
  private mapPlanToRoles(plan: string, existingRoles: string[]): string[] {
    const roles = new Set(existingRoles);

    // Add role based on plan
    switch (plan) {
      case "ENTERPRISE":
        roles.add("enterprise");
        roles.add("team");
        roles.add("pro");
        roles.add("user");
        break;
      case "TEAM":
        roles.add("team");
        roles.add("pro");
        roles.add("user");
        break;
      case "PRO":
        roles.add("pro");
        roles.add("user");
        break;
      case "FREE":
      default:
        roles.add("user");
        break;
    }

    return Array.from(roles);
  }
}
