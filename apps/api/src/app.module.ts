/**
 * CS2 Analytics API - Root Application Module
 */

import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";

import { PrismaModule } from "./common/prisma";
import { RedisModule } from "./common/redis";
import { CorrelationIdMiddleware } from "./common/middleware";
import { AuthModule } from "./modules/auth/auth.module";
import { DemoModule } from "./modules/demo/demo.module";
import { PlayerModule } from "./modules/player/player.module";
import { RoundModule } from "./modules/round/round.module";
import { AnalysisModule } from "./modules/analysis/analysis.module";
import { AggregationModule } from "./modules/aggregation/aggregation.module";
import { ReplayModule } from "./modules/replay/replay.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
    }),

    // Rate limiting - protect against abuse
    ThrottlerModule.forRoot([
      {
        name: "short",
        ttl: 1000, // 1 second
        limit: 10, // 10 requests per second
      },
      {
        name: "medium",
        ttl: 10000, // 10 seconds
        limit: 50, // 50 requests per 10 seconds
      },
      {
        name: "long",
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),

    // Queue (BullMQ) - use forRootAsync to access ConfigService
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>("REDIS_URL");
        if (redisUrl) {
          const url = new URL(redisUrl);
          return {
            connection: {
              host: url.hostname,
              port: parseInt(url.port || "6379", 10),
            },
          };
        }
        return {
          connection: {
            host: configService.get("REDIS_HOST", "localhost"),
            port: configService.get("REDIS_PORT", 6379),
          },
        };
      },
      inject: [ConfigService],
    }),

    // Database
    PrismaModule,

    // Cache
    RedisModule,

    // Authentication
    AuthModule,

    // Feature modules
    DemoModule,
    PlayerModule,
    RoundModule,
    AnalysisModule,
    AggregationModule,
    ReplayModule,
  ],
  controllers: [HealthController],
  providers: [
    // Apply rate limiting globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  /**
   * Configure global middleware
   */
  configure(consumer: MiddlewareConsumer) {
    // Apply correlation ID middleware to all routes
    consumer.apply(CorrelationIdMiddleware).forRoutes("*");
  }
}
