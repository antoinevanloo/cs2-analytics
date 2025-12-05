/**
 * Auth Module
 *
 * Provides authentication and authorization for the API.
 *
 * Features:
 * - Steam OpenID authentication (optional - requires STEAM_API_KEY)
 * - FACEIT OAuth2 authentication (optional - requires FACEIT_CLIENT_ID)
 * - JWT-based session management
 * - Refresh token rotation (stored in Redis)
 * - Role-based access control (RBAC)
 *
 * @module auth
 */

import { Module, Global, Logger, Provider } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { JwtStrategy } from "./strategies/jwt.strategy";
import { SteamOAuthStrategy } from "./strategies/steam.strategy";
import { FaceitOAuthStrategy } from "./strategies/faceit.strategy";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { IntegrationsModule } from "../integrations/integrations.module";
import { PrismaService } from "../../common/prisma";

const logger = new Logger("AuthModule");

/**
 * Conditionally provide Steam strategy if STEAM_API_KEY is set
 */
const SteamStrategyProvider: Provider = {
  provide: SteamOAuthStrategy,
  useFactory: (configService: ConfigService, prisma: PrismaService) => {
    const apiKey = configService.get<string>("STEAM_API_KEY");
    if (!apiKey) {
      logger.warn(
        "STEAM_API_KEY not configured - Steam authentication disabled",
      );
      return null;
    }
    return new SteamOAuthStrategy(configService, prisma);
  },
  inject: [ConfigService, PrismaService],
};

/**
 * Conditionally provide FACEIT strategy if FACEIT_CLIENT_ID is set
 */
const FaceitStrategyProvider: Provider = {
  provide: FaceitOAuthStrategy,
  useFactory: (configService: ConfigService, prisma: PrismaService) => {
    const clientId = configService.get<string>("FACEIT_CLIENT_ID");
    if (!clientId) {
      logger.warn(
        "FACEIT_CLIENT_ID not configured - FACEIT authentication disabled",
      );
      return null;
    }
    return new FaceitOAuthStrategy(configService, prisma);
  },
  inject: [ConfigService, PrismaService],
};

@Global()
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>(
          "JWT_SECRET",
          "cs2-analytics-dev-secret-change-in-prod",
        ),
        signOptions: {
          expiresIn: configService.get<number>("JWT_EXPIRES_IN_SECONDS", 3600), // 1h in seconds
        },
      }),
      inject: [ConfigService],
    }),
    IntegrationsModule,
  ],
  controllers: [AuthController],
  providers: [
    JwtStrategy,
    SteamStrategyProvider,
    FaceitStrategyProvider,
    AuthService,
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
