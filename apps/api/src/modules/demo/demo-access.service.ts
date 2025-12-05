/**
 * Demo Access Service - Authorization logic for demo visibility
 *
 * Visibility rules:
 * 1. Owner: User who uploaded the demo can always see it
 * 2. Participant: User whose steamId appears in match players
 * 3. Team Member: User who is a member of the team the demo belongs to
 * 4. Public: If demo.isPublic is true (future feature)
 *
 * Design principles:
 * - Extensible: Easy to add new visibility rules (isPublic, shared links)
 * - Scalable: Uses indexed queries, batches checks where possible
 * - Performance: Single query to check all access conditions
 * - Resilient: Handles edge cases (null steamId, missing team, etc.)
 */

import { Injectable, ForbiddenException, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma";
import type { AuthenticatedUser } from "../auth/strategies/jwt.strategy";

export type DemoAccessReason =
  | "owner"
  | "participant"
  | "team_member"
  | "public"
  | "admin";

export interface DemoAccessResult {
  hasAccess: boolean;
  reason?: DemoAccessReason;
  demoId: string;
}

@Injectable()
export class DemoAccessService {
  private readonly logger = new Logger(DemoAccessService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if a user can access a specific demo
   * Returns access status and reason
   */
  async canAccessDemo(
    demoId: string,
    user: AuthenticatedUser | null,
  ): Promise<DemoAccessResult> {
    // Anonymous users cannot access any demo
    if (!user) {
      return { hasAccess: false, demoId };
    }

    // Admin users can access all demos
    if (user.roles?.includes("admin")) {
      return { hasAccess: true, reason: "admin", demoId };
    }

    // Fetch demo with access-related data in a single query
    const demo = await this.prisma.demo.findUnique({
      where: { id: demoId },
      select: {
        id: true,
        uploadedById: true,
        teamId: true,
        // Check if user is a participant (by steamId)
        playerStats: {
          where: user.steamId ? { steamId: user.steamId } : { steamId: "" },
          select: { steamId: true },
          take: 1,
        },
        // Check team membership
        team: user.steamId
          ? {
              select: {
                members: {
                  where: { userId: user.id },
                  select: { userId: true },
                  take: 1,
                },
              },
            }
          : false,
      },
    });

    if (!demo) {
      // Demo not found - let the service handle 404
      return { hasAccess: false, demoId };
    }

    // Rule 1: Owner access
    if (demo.uploadedById === user.id) {
      return { hasAccess: true, reason: "owner", demoId };
    }

    // Rule 2: Participant access (user played in the match)
    if (user.steamId && demo.playerStats.length > 0) {
      return { hasAccess: true, reason: "participant", demoId };
    }

    // Rule 3: Team member access
    if (
      demo.team &&
      typeof demo.team === "object" &&
      "members" in demo.team &&
      Array.isArray(demo.team.members) &&
      demo.team.members.length > 0
    ) {
      return { hasAccess: true, reason: "team_member", demoId };
    }

    // No access
    return { hasAccess: false, demoId };
  }

  /**
   * Assert that user can access a demo, throw ForbiddenException if not
   */
  async assertCanAccessDemo(
    demoId: string,
    user: AuthenticatedUser | null,
  ): Promise<DemoAccessReason> {
    const result = await this.canAccessDemo(demoId, user);

    if (!result.hasAccess) {
      this.logger.warn(
        `Access denied: user ${user?.id || "anonymous"} to demo ${demoId}`,
      );
      throw new ForbiddenException(
        "You do not have permission to access this demo",
      );
    }

    return result.reason!;
  }

  /**
   * Build Prisma where clause for listing demos a user can see
   * Used by listDemos to filter results
   */
  buildAccessFilter(user: AuthenticatedUser | null): {
    OR?: Array<Record<string, unknown>>;
  } {
    if (!user) {
      // Anonymous users see nothing
      return { OR: [{ id: "__no_access__" }] };
    }

    // Admin users see all
    if (user.roles?.includes("admin")) {
      return {};
    }

    const conditions: Array<Record<string, unknown>> = [];

    // Condition 1: User is the owner
    conditions.push({ uploadedById: user.id });

    // Condition 2: User is a participant (by steamId)
    if (user.steamId) {
      conditions.push({
        playerStats: {
          some: { steamId: user.steamId },
        },
      });
    }

    // Condition 3: User is a team member
    conditions.push({
      team: {
        members: {
          some: { userId: user.id },
        },
      },
    });

    return { OR: conditions };
  }

  /**
   * Get accessible demo IDs for a user (batch check)
   * Useful for checking multiple demos at once
   */
  async getAccessibleDemoIds(
    demoIds: string[],
    user: AuthenticatedUser | null,
  ): Promise<Set<string>> {
    if (!user || demoIds.length === 0) {
      return new Set();
    }

    const accessFilter = this.buildAccessFilter(user);

    const accessibleDemos = await this.prisma.demo.findMany({
      where: {
        id: { in: demoIds },
        ...accessFilter,
      },
      select: { id: true },
    });

    return new Set(accessibleDemos.map((d) => d.id));
  }
}
