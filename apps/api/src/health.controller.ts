/**
 * Health check controller with detailed diagnostics
 *
 * Features:
 * - Basic health check for load balancers
 * - Detailed status including queue, parser, and database
 * - Ready endpoint for Kubernetes probes
 */

import { Controller, Get, HttpCode, HttpStatus, Inject, Optional, Version, VERSION_NEUTRAL } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PrismaService } from "./common/prisma";
import { ParserService } from "./modules/demo/parser.service";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  service: string;
  timestamp: string;
  uptime: number;
  version: string;
  checks?: {
    database: { status: string; latency?: number };
    queue: { status: string; jobs?: { waiting: number; active: number; failed: number } };
    parser: { status: string; circuitBreaker?: { state: string; failures: number } };
  };
}

@ApiTags("health")
@Controller()
export class HealthController {
  private readonly startTime = Date.now();

  constructor(
    private prisma: PrismaService,
    @Optional() @InjectQueue("demo-parsing") private demoQueue: Queue | undefined,
    @Optional() @Inject(ParserService) private parserService: ParserService | undefined
  ) {}

  @Get("health")
  @Version([VERSION_NEUTRAL, "1"])
  @ApiOperation({ summary: "Basic health check for load balancers" })
  @ApiResponse({ status: 200, description: "Service is healthy" })
  @HttpCode(HttpStatus.OK)
  health(): { status: string; timestamp: string } {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("health/ready")
  @Version([VERSION_NEUTRAL, "1"])
  @ApiOperation({ summary: "Readiness probe - checks if service can accept requests" })
  @ApiResponse({ status: 200, description: "Service is ready" })
  @ApiResponse({ status: 503, description: "Service is not ready" })
  async ready(): Promise<{ ready: boolean; checks: Record<string, boolean> }> {
    const checks: Record<string, boolean> = {};

    // Check database connection
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch {
      checks.database = false;
    }

    // Check queue connection
    if (this.demoQueue) {
      try {
        await this.demoQueue.getJobCounts();
        checks.queue = true;
      } catch {
        checks.queue = false;
      }
    } else {
      checks.queue = true; // Queue not configured, skip check
    }

    const ready = Object.values(checks).every((v) => v);
    return { ready, checks };
  }

  @Get("health/detailed")
  @Version([VERSION_NEUTRAL, "1"])
  @ApiOperation({ summary: "Detailed health status with all components" })
  @ApiResponse({ status: 200, description: "Detailed health information" })
  async detailedHealth(): Promise<HealthStatus> {
    const checks: HealthStatus["checks"] = {
      database: { status: "unknown" },
      queue: { status: "unknown" },
      parser: { status: "unknown" },
    };

    let overallStatus: HealthStatus["status"] = "healthy";

    // Database check with latency
    const dbStart = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = {
        status: "healthy",
        latency: Date.now() - dbStart,
      };
    } catch {
      checks.database = { status: "unhealthy" };
      overallStatus = "unhealthy";
    }

    // Queue check with job counts
    if (this.demoQueue) {
      try {
        const counts = await this.demoQueue.getJobCounts();
        checks.queue = {
          status: "healthy",
          jobs: {
            waiting: counts.waiting || 0,
            active: counts.active || 0,
            failed: counts.failed || 0,
          },
        };

        // Warn if too many failed jobs
        if ((counts.failed ?? 0) > 10) {
          checks.queue.status = "degraded";
          if (overallStatus === "healthy") overallStatus = "degraded";
        }
      } catch {
        checks.queue = { status: "unhealthy" };
        overallStatus = "unhealthy";
      }
    } else {
      checks.queue = { status: "not_configured" };
    }

    // Parser check with circuit breaker status
    if (this.parserService) {
      try {
        const isHealthy = await this.parserService.checkHealth();
        const cbStatus = this.parserService.getCircuitBreakerStatus();

        checks.parser = {
          status: isHealthy ? "healthy" : "unhealthy",
          circuitBreaker: {
            state: cbStatus.state,
            failures: cbStatus.failures,
          },
        };

        if (cbStatus.state === "OPEN") {
          checks.parser.status = "degraded";
          if (overallStatus === "healthy") overallStatus = "degraded";
        }

        if (!isHealthy && cbStatus.state !== "OPEN") {
          overallStatus = "degraded";
        }
      } catch {
        checks.parser = { status: "unhealthy" };
        if (overallStatus === "healthy") overallStatus = "degraded";
      }
    } else {
      checks.parser = { status: "not_configured" };
    }

    return {
      status: overallStatus,
      service: "cs2-analytics-api",
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: process.env.npm_package_version || "0.1.0",
      checks,
    };
  }

  @Get()
  @ApiOperation({ summary: "API root - service info" })
  root() {
    return {
      name: "CS2 Analytics API",
      version: "0.1.0",
      description: "SaaS platform for CS2 demo analysis and esports coaching",
      documentation: "/docs",
      endpoints: {
        demos: "/v1/demos",
        players: "/v1/players",
        rounds: "/v1/rounds",
        analysis: "/v1/analysis",
        health: "/health",
        healthReady: "/health/ready",
        healthDetailed: "/health/detailed",
      },
    };
  }
}
