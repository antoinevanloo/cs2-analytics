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

import { Module, Global } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { JwtStrategy } from "./strategies/jwt.strategy";
import { AuthService } from "./auth.service";
import { SteamService } from "./services/steam.service";
import { FaceitService } from "./services/faceit.service";
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
  providers: [
    JwtStrategy,
    SteamService,
    FaceitService,
    AuthService,
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
