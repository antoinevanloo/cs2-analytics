/**
 * Auth Module
 *
 * Provides authentication and authorization for the API.
 *
 * Features:
 * - Steam OpenID authentication
 * - FACEIT OAuth2 authentication
 * - JWT-based session management
 * - Refresh token rotation (stored in Redis)
 * - Role-based access control (RBAC)
 *
 * @module auth
 */

import { Module, Global } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { JwtStrategy } from "./strategies/jwt.strategy";
import { SteamOAuthStrategy } from "./strategies/steam.strategy";
import { FaceitOAuthStrategy } from "./strategies/faceit.strategy";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { IntegrationsModule } from "../integrations/integrations.module";

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
  providers: [JwtStrategy, SteamOAuthStrategy, FaceitOAuthStrategy, AuthService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
