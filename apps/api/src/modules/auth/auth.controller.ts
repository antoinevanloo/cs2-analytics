/**
 * Auth Controller
 *
 * Handles authentication endpoints for Steam OAuth and JWT management.
 *
 * Endpoints:
 * - GET  /v1/auth/steam          - Redirect to Steam login
 * - GET  /v1/auth/steam/callback - Steam callback handler
 * - POST /v1/auth/refresh        - Refresh access token
 * - POST /v1/auth/logout         - Logout and invalidate refresh token
 * - GET  /v1/auth/me             - Get current user profile
 *
 * @module auth
 */

import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
  Logger,
  HttpCode,
  HttpStatus,
  Body,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiProperty,
} from "@nestjs/swagger";
import type { FastifyRequest, FastifyReply } from "fastify";

import { AuthService } from "./auth.service";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "./strategies/jwt.strategy";
import type { SteamProfile } from "./strategies/steam.strategy";
import type { FaceitProfile } from "./strategies/faceit.strategy";

// Extend FastifyRequest to include cookies
type FastifyRequestWithCookies = FastifyRequest & {
  cookies?: Record<string, string>;
};

// Extend FastifyReply to include cookie methods
type FastifyReplyWithCookies = FastifyReply & {
  setCookie: (
    name: string,
    value: string,
    options?: Record<string, unknown>,
  ) => FastifyReply;
  clearCookie: (
    name: string,
    options?: Record<string, unknown>,
  ) => FastifyReply;
};

/**
 * DTO for refresh token request
 */
class RefreshTokenDto {
  @ApiProperty({
    description: "Refresh token obtained from Steam OAuth callback",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  })
  refreshToken!: string;
}

@ApiTags("Authentication")
@Controller("v1/auth")
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<string>(
      "FRONTEND_URL",
      "http://localhost:3000",
    );
  }

  /**
   * Redirect to Steam login page
   */
  @Get("steam")
  @Public()
  @UseGuards(AuthGuard("steam"))
  @ApiOperation({ summary: "Initiate Steam OAuth login" })
  @ApiResponse({ status: 302, description: "Redirect to Steam login" })
  steamLogin(): void {
    // Passport handles the redirect automatically
  }

  /**
   * Handle Steam callback after authentication
   */
  @Get("steam/callback")
  @Public()
  @UseGuards(AuthGuard("steam"))
  @ApiOperation({ summary: "Steam OAuth callback" })
  @ApiResponse({ status: 302, description: "Redirect to frontend with tokens" })
  async steamCallback(
    @Req() req: FastifyRequestWithCookies & { user?: SteamProfile },
    @Res() reply: FastifyReplyWithCookies,
  ): Promise<void> {
    const steamProfile = req.user;

    if (!steamProfile) {
      this.logger.error("Steam callback: No user profile received");
      return reply.redirect(`${this.frontendUrl}/auth/error?reason=no_profile`);
    }

    try {
      // Generate tokens
      const tokens =
        await this.authService.generateTokensForSteamUser(steamProfile);

      // Set HttpOnly cookie for refresh token (more secure)
      reply.setCookie("refresh_token", tokens.refreshToken, {
        httpOnly: true,
        secure: this.configService.get("NODE_ENV") === "production",
        sameSite: "lax",
        path: "/v1/auth",
        maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
      });

      // Redirect to frontend with access token
      // The access token is passed as a URL fragment (not query param) for security
      const redirectUrl = `${this.frontendUrl}/auth/callback#access_token=${tokens.accessToken}&expires_in=${tokens.expiresIn}`;

      this.logger.log(
        `Steam login successful for: ${steamProfile.personaName}`,
      );
      return reply.redirect(redirectUrl);
    } catch (error) {
      this.logger.error(`Steam callback error: ${error}`);
      return reply.redirect(
        `${this.frontendUrl}/auth/error?reason=token_generation_failed`,
      );
    }
  }

  /**
   * Redirect to FACEIT login page
   */
  @Get("faceit")
  @Public()
  @UseGuards(AuthGuard("faceit"))
  @ApiOperation({ summary: "Initiate FACEIT OAuth login" })
  @ApiResponse({ status: 302, description: "Redirect to FACEIT login" })
  faceitLogin(): void {
    // Passport handles the redirect automatically
  }

  /**
   * Handle FACEIT callback after authentication
   */
  @Get("faceit/callback")
  @Public()
  @UseGuards(AuthGuard("faceit"))
  @ApiOperation({ summary: "FACEIT OAuth callback" })
  @ApiResponse({ status: 302, description: "Redirect to frontend with tokens" })
  async faceitCallback(
    @Req() req: FastifyRequestWithCookies & { user?: FaceitProfile },
    @Res() reply: FastifyReplyWithCookies,
  ): Promise<void> {
    const faceitProfile = req.user;

    if (!faceitProfile) {
      this.logger.error("FACEIT callback: No user profile received");
      return reply.redirect(`${this.frontendUrl}/auth/error?reason=no_profile`);
    }

    try {
      // Generate tokens
      const tokens =
        await this.authService.generateTokensForFaceitUser(faceitProfile);

      // Set HttpOnly cookie for refresh token (more secure)
      reply.setCookie("refresh_token", tokens.refreshToken, {
        httpOnly: true,
        secure: this.configService.get("NODE_ENV") === "production",
        sameSite: "lax",
        path: "/v1/auth",
        maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
      });

      // Redirect to frontend with access token
      // Include provider info for the frontend to know how user authenticated
      const redirectUrl = `${this.frontendUrl}/auth/callback#access_token=${tokens.accessToken}&expires_in=${tokens.expiresIn}&provider=faceit`;

      this.logger.log(
        `FACEIT login successful for: ${faceitProfile.nickname} (${faceitProfile.faceitId})`,
      );
      return reply.redirect(redirectUrl);
    } catch (error) {
      this.logger.error(`FACEIT callback error: ${error}`);
      return reply.redirect(
        `${this.frontendUrl}/auth/error?reason=token_generation_failed`,
      );
    }
  }

  /**
   * Refresh access token using refresh token
   */
  @Post("refresh")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Refresh access token" })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: "New tokens generated" })
  @ApiResponse({ status: 401, description: "Invalid or expired refresh token" })
  async refresh(
    @Body() body: RefreshTokenDto,
    @Req() req: FastifyRequestWithCookies,
  ): Promise<{
    accessToken: string;
    expiresIn: number;
  }> {
    // Try body first, then cookie
    const refreshToken = body.refreshToken || req.cookies?.refresh_token;

    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token is required");
    }

    try {
      const tokens = await this.authService.refreshAccessToken(refreshToken);
      return {
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
      };
    } catch (error) {
      this.logger.warn(`Token refresh failed: ${error}`);
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
  }

  /**
   * Logout and invalidate refresh token
   */
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Logout and invalidate tokens" })
  @ApiResponse({ status: 200, description: "Successfully logged out" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: FastifyRequestWithCookies,
    @Res({ passthrough: true }) reply: FastifyReplyWithCookies,
  ): Promise<{ success: boolean }> {
    // Get refresh token from cookie or body
    const refreshToken = req.cookies?.refresh_token;

    if (refreshToken) {
      await this.authService.revokeRefreshToken(refreshToken);
    }

    // Also revoke all tokens for this user (optional, more secure)
    await this.authService.revokeAllUserTokens(user.id);

    // Clear the cookie
    reply.clearCookie("refresh_token", {
      path: "/v1/auth",
    });

    this.logger.log(`User logged out: ${user.id}`);
    return { success: true };
  }

  /**
   * Get current authenticated user profile
   */
  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user profile" })
  @ApiResponse({ status: 200, description: "User profile" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getProfile(@CurrentUser() user: AuthenticatedUser): Promise<{
    id: string;
    email: string;
    name: string | null;
    steamId: string | null;
    faceitId: string | null;
    roles: string[];
    avatar: string | null;
  }> {
    // Fetch full user details from database
    const fullProfile = await this.authService.getUserProfile(user.id);
    return fullProfile;
  }

  /**
   * Verify token validity (useful for frontend)
   */
  @Get("verify")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Verify token validity" })
  @ApiResponse({ status: 200, description: "Token is valid" })
  @ApiResponse({ status: 401, description: "Invalid token" })
  verify(@CurrentUser() user: AuthenticatedUser): {
    valid: boolean;
    userId: string;
  } {
    return {
      valid: true,
      userId: user.id,
    };
  }
}
