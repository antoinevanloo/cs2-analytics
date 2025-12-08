/**
 * Session Activity Middleware
 *
 * Tracks user activity for session management:
 * - Updates last activity timestamp in Redis
 * - Enables session timeout detection
 * - Provides analytics on user engagement
 *
 * Design considerations:
 * - Extensibility: Easy to add new activity tracking metrics
 * - Scalability: Uses Redis with TTL for automatic cleanup
 * - Performance: Async fire-and-forget updates (non-blocking)
 * - Resilience: Fails silently to not break request flow
 *
 * @module common/middleware
 */

import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import type { FastifyRequest, FastifyReply } from "fastify";
import { RedisService } from "../redis/redis.service";

interface SessionActivityData {
  userId: string;
  lastActivityAt: number;
  lastIp: string;
  lastUserAgent: string;
  requestCount: number;
}

@Injectable()
export class SessionActivityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SessionActivityMiddleware.name);
  private readonly SESSION_ACTIVITY_PREFIX = "session_activity:";
  private readonly SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(private readonly redis: RedisService) {}

  use(req: FastifyRequest, _res: FastifyReply, next: () => void): void {
    // Extract user from request (set by JWT guard)
    const user = (req as FastifyRequest & { user?: { id: string } }).user;

    if (user?.id) {
      // Fire-and-forget update - don't await to keep request fast
      this.updateActivityAsync(user.id, req).catch((error) => {
        this.logger.debug(`Session activity update failed: ${error}`);
      });
    }

    next();
  }

  /**
   * Update session activity asynchronously
   * Non-blocking to maintain request performance
   */
  private async updateActivityAsync(
    userId: string,
    req: FastifyRequest,
  ): Promise<void> {
    const key = `${this.SESSION_ACTIVITY_PREFIX}${userId}`;
    const now = Date.now();

    // Get existing activity data
    const existing = await this.redis.get<SessionActivityData>(key);

    const activityData: SessionActivityData = {
      userId,
      lastActivityAt: now,
      lastIp: req.ip || "unknown",
      lastUserAgent: req.headers["user-agent"] || "unknown",
      requestCount: (existing?.requestCount || 0) + 1,
    };

    // Store with TTL
    await this.redis.set(key, activityData, this.SESSION_TTL_MS);
  }

  /**
   * Get session activity for a user
   * Useful for admin/debugging
   */
  async getSessionActivity(userId: string): Promise<SessionActivityData | null> {
    const key = `${this.SESSION_ACTIVITY_PREFIX}${userId}`;
    return this.redis.get<SessionActivityData>(key);
  }

  /**
   * Check if session is active (has recent activity)
   */
  async isSessionActive(userId: string, maxInactivityMs: number): Promise<boolean> {
    const activity = await this.getSessionActivity(userId);
    if (!activity) return false;

    const inactivityDuration = Date.now() - activity.lastActivityAt;
    return inactivityDuration < maxInactivityMs;
  }

  /**
   * Clear session activity (on logout)
   */
  async clearSessionActivity(userId: string): Promise<void> {
    const key = `${this.SESSION_ACTIVITY_PREFIX}${userId}`;
    await this.redis.delete(key);
  }
}
