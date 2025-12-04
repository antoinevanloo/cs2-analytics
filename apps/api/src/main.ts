/**
 * CS2 Analytics API - Main Entry Point
 *
 * Features:
 * - Fastify adapter for high performance
 * - Graceful shutdown handling
 * - API versioning and validation
 * - Swagger documentation
 */

import { NestFactory, Reflector } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { ValidationPipe, VersioningType, Logger } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { ConfigService } from "@nestjs/config";
import multipart from "@fastify/multipart";
import cookie from "@fastify/cookie";

import { GlobalExceptionFilter } from "./common/filters";
import { JwtAuthGuard, RolesGuard } from "./common/guards";

const logger = new Logger("Bootstrap");

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true })
  );

  const configService = app.get(ConfigService);

  // Register multipart support for file uploads
  await app.register(multipart, {
    limits: {
      fileSize: 500 * 1024 * 1024, // 500MB max file size for demo files
    },
  });

  // Register cookie support for auth
  const cookieSecret = configService.get<string>("COOKIE_SECRET", "cs2-analytics-cookie-secret-change-in-prod");
  await app.register(cookie, {
    secret: cookieSecret,
  });

  // Enable CORS
  app.enableCors({
    origin: configService.get("CORS_ORIGINS", "*").split(","),
    credentials: true,
  });

  // API versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1",
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  );

  // Global exception filter for standardized error responses
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global authentication guards
  const reflector = app.get(Reflector);
  app.useGlobalGuards(
    new JwtAuthGuard(reflector),
    new RolesGuard(reflector)
  );

  // Swagger documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle("CS2 Analytics API")
    .setDescription("API for CS2 demo analysis and coaching insights")
    .setVersion("1.0")
    .addBearerAuth()
    .addTag("Authentication", "Steam OAuth and token management")
    .addTag("demos", "Demo file management and parsing")
    .addTag("players", "Player statistics and profiles")
    .addTag("rounds", "Round analysis and data")
    .addTag("analysis", "Advanced analytics and insights")
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  // Enable graceful shutdown hooks
  app.enableShutdownHooks();

  // Start server
  const port = configService.get("PORT", 3000);
  const host = configService.get("HOST", "0.0.0.0");

  await app.listen(port, host);
  logger.log(`CS2 Analytics API running at http://${host}:${port}`);
  logger.log(`Swagger docs available at http://${host}:${port}/docs`);

  // Graceful shutdown handling
  const shutdownTimeout = configService.get("SHUTDOWN_TIMEOUT", 30000);

  const gracefulShutdown = async (signal: string) => {
    logger.log(`Received ${signal}, starting graceful shutdown...`);

    // Set a timeout for forced shutdown
    const forceShutdownTimer = setTimeout(() => {
      logger.error("Forced shutdown due to timeout");
      process.exit(1);
    }, shutdownTimeout);

    try {
      await app.close();
      clearTimeout(forceShutdownTimer);
      logger.log("Graceful shutdown completed");
      process.exit(0);
    } catch (error) {
      logger.error(`Error during shutdown: ${error}`);
      clearTimeout(forceShutdownTimer);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

bootstrap().catch((error) => {
  logger.error(`Failed to start application: ${error}`);
  process.exit(1);
});
