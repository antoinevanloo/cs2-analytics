/**
 * Auth Service
 *
 * Handles JWT token generation, validation, and refresh token management.
 * Uses Redis for secure refresh token storage.
 *
 * @module auth
 */

import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "crypto";

import { PrismaService } from "../../common/prisma";
import { RedisService } from "../../common/redis/redis.service";
import type { JwtPayload, AuthenticatedUser } from "./strategies/jwt.strategy";
import type { SteamProfile } from "./strategies/steam.strategy";

/**
 * Token pair returned after authentication
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Refresh token data stored in Redis
 */
interface RefreshTokenData {
  userId: string;
  steamId?: string | undefined;
  createdAt: number;
  expiresAt: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessTokenTtl: number;
  private readonly refreshTokenTtl: number;
  private readonly REFRESH_TOKEN_PREFIX = "refresh_token:";
  private readonly USER_TOKENS_PREFIX = "user_tokens:";

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    this.accessTokenTtl = this.configService.get<number>("JWT_EXPIRES_IN_SECONDS", 3600); // 1 hour
    this.refreshTokenTtl = this.configService.get<number>("JWT_REFRESH_EXPIRES_IN_SECONDS", 604800); // 7 days
  }

  /**
   * Generate tokens for a Steam user
   */
  async generateTokensForSteamUser(steamProfile: SteamProfile): Promise<TokenPair> {
    // Find user by Steam ID
    const user = await this.prisma.user.findFirst({
      where: { steamId: steamProfile.steamId },
      select: {
        id: true,
        email: true,
        plan: true,
        steamId: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("User not found. Please try logging in again.");
    }

    return this.generateTokenPair(user);
  }

  /**
   * Generate access and refresh token pair
   */
  async generateTokenPair(user: {
    id: string;
    email: string;
    plan?: string;
    steamId?: string | null;
  }): Promise<TokenPair> {
    // Generate access token
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: this.mapPlanToRoles(user.plan ?? "FREE"),
      steamId: user.steamId ?? undefined,
    };
    const accessToken = this.jwtService.sign(payload);

    // Generate refresh token (random string, not JWT)
    const refreshToken = this.generateSecureToken();

    // Store refresh token in Redis
    await this.storeRefreshToken(refreshToken, {
      userId: user.id,
      steamId: user.steamId ?? undefined,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.refreshTokenTtl * 1000,
    });

    // Track token for user (for logout all devices)
    await this.trackUserToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenTtl,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenPair> {
    // Get refresh token data from Redis
    const tokenData = await this.getRefreshTokenData(refreshToken);

    if (!tokenData) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (tokenData.expiresAt < Date.now()) {
      await this.revokeRefreshToken(refreshToken);
      throw new UnauthorizedException("Refresh token expired");
    }

    // Get user from database
    const user = await this.prisma.user.findUnique({
      where: { id: tokenData.userId },
      select: {
        id: true,
        email: true,
        plan: true,
        steamId: true,
      },
    });

    if (!user) {
      await this.revokeRefreshToken(refreshToken);
      throw new UnauthorizedException("User not found");
    }

    // Revoke old refresh token (token rotation for security)
    await this.revokeRefreshToken(refreshToken);

    // Generate new token pair
    return this.generateTokenPair(user);
  }

  /**
   * Revoke a specific refresh token
   */
  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const tokenData = await this.getRefreshTokenData(refreshToken);

    if (tokenData) {
      // Remove from user's token list
      await this.removeUserToken(tokenData.userId, refreshToken);
    }

    // Delete token from Redis
    await this.redis.delete(`${this.REFRESH_TOKEN_PREFIX}${refreshToken}`);
  }

  /**
   * Revoke all refresh tokens for a user (logout all devices)
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    const tokens = await this.getUserTokens(userId);

    for (const token of tokens) {
      await this.redis.delete(`${this.REFRESH_TOKEN_PREFIX}${token}`);
    }

    // Clear user's token list
    await this.redis.delete(`${this.USER_TOKENS_PREFIX}${userId}`);

    this.logger.log(`Revoked all tokens for user: ${userId}`);
  }

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<{
    id: string;
    email: string;
    name: string | null;
    steamId: string | null;
    roles: string[];
    avatar: string | null;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        steamId: true,
        avatar: true,
        plan: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      steamId: user.steamId,
      roles: this.mapPlanToRoles(user.plan),
      avatar: user.avatar,
    };
  }

  /**
   * Generate JWT token (legacy method, kept for compatibility)
   */
  generateToken(user: {
    id: string;
    email: string;
    roles?: string[];
    steamId?: string;
  }): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles ?? ["user"],
      steamId: user.steamId,
    };

    return this.jwtService.sign(payload);
  }

  /**
   * Verify and decode a token
   */
  verifyToken(token: string): JwtPayload | null {
    try {
      return this.jwtService.verify<JwtPayload>(token);
    } catch (error) {
      this.logger.debug(`Token verification failed: ${error}`);
      return null;
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token: string): JwtPayload | null {
    try {
      return this.jwtService.decode(token) as JwtPayload;
    } catch {
      return null;
    }
  }

  /**
   * Check if user has required role
   */
  hasRole(user: AuthenticatedUser, role: string): boolean {
    return user.roles.includes(role);
  }

  /**
   * Check if user has any of the required roles
   */
  hasAnyRole(user: AuthenticatedUser, roles: string[]): boolean {
    return roles.some((role) => user.roles.includes(role));
  }

  /**
   * Check if user has all of the required roles
   */
  hasAllRoles(user: AuthenticatedUser, roles: string[]): boolean {
    return roles.every((role) => user.roles.includes(role));
  }

  // ============ Private Methods ============

  /**
   * Generate a cryptographically secure random token
   */
  private generateSecureToken(): string {
    return randomBytes(32).toString("hex");
  }

  /**
   * Store refresh token data in Redis
   */
  private async storeRefreshToken(token: string, data: RefreshTokenData): Promise<void> {
    const ttlMs = this.refreshTokenTtl * 1000;
    await this.redis.set(`${this.REFRESH_TOKEN_PREFIX}${token}`, data, ttlMs);
  }

  /**
   * Get refresh token data from Redis
   */
  private async getRefreshTokenData(token: string): Promise<RefreshTokenData | null> {
    return this.redis.get<RefreshTokenData>(`${this.REFRESH_TOKEN_PREFIX}${token}`);
  }

  /**
   * Track a refresh token for a user (for logout all devices)
   */
  private async trackUserToken(userId: string, token: string): Promise<void> {
    const tokens = await this.getUserTokens(userId);
    tokens.push(token);

    // Keep only recent tokens (max 10 devices)
    const recentTokens = tokens.slice(-10);
    const ttlMs = this.refreshTokenTtl * 1000;
    await this.redis.set(`${this.USER_TOKENS_PREFIX}${userId}`, recentTokens, ttlMs);
  }

  /**
   * Get all refresh tokens for a user
   */
  private async getUserTokens(userId: string): Promise<string[]> {
    const tokens = await this.redis.get<string[]>(`${this.USER_TOKENS_PREFIX}${userId}`);
    return tokens ?? [];
  }

  /**
   * Remove a specific token from user's token list
   */
  private async removeUserToken(userId: string, token: string): Promise<void> {
    const tokens = await this.getUserTokens(userId);
    const filteredTokens = tokens.filter((t) => t !== token);

    if (filteredTokens.length > 0) {
      const ttlMs = this.refreshTokenTtl * 1000;
      await this.redis.set(`${this.USER_TOKENS_PREFIX}${userId}`, filteredTokens, ttlMs);
    } else {
      await this.redis.delete(`${this.USER_TOKENS_PREFIX}${userId}`);
    }
  }

  /**
   * Map subscription plan to roles
   */
  private mapPlanToRoles(plan: string): string[] {
    const roles: string[] = ["user"];

    switch (plan) {
      case "ENTERPRISE":
        roles.push("enterprise", "team", "pro");
        break;
      case "TEAM":
        roles.push("team", "pro");
        break;
      case "PRO":
        roles.push("pro");
        break;
    }

    return roles;
  }
}
