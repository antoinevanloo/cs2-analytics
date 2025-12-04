/**
 * Correlation ID Middleware
 *
 * Adds unique correlation ID to each request for distributed tracing.
 * Enables request tracking across services and log correlation.
 *
 * Features:
 * - Generates unique ID if not provided
 * - Passes through existing correlation ID from upstream services
 * - Adds ID to response headers for client tracking
 *
 * @module common/middleware
 */

import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import { FastifyRequest, FastifyReply } from "fastify";

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CorrelationIdMiddleware.name);

  use(req: FastifyRequest["raw"], res: FastifyReply["raw"], next: () => void): void {
    // Get existing correlation ID or generate new one
    const existingId =
      (req.headers["x-correlation-id"] as string) ||
      (req.headers["x-request-id"] as string);

    const correlationId = existingId || this.generateCorrelationId();

    // Add to request headers for downstream use
    (req.headers as Record<string, string>)["x-correlation-id"] = correlationId;

    // Add to response headers for client tracking
    res.setHeader("x-correlation-id", correlationId);

    // Log request with correlation ID
    this.logger.debug(
      `[${correlationId}] ${req.method} ${req.url}`
    );

    next();
  }

  /**
   * Generate a unique correlation ID
   * Format: timestamp-random (e.g., "lq2x5kv-a1b2c3d")
   */
  private generateCorrelationId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `${timestamp}-${random}`;
  }
}
