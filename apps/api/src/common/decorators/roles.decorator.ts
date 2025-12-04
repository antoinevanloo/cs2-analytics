/**
 * Roles Decorator
 *
 * Specifies required roles for accessing a route.
 * Use with RolesGuard.
 *
 * @example
 * ```typescript
 * @Roles('admin', 'pro')
 * @Get('admin/stats')
 * getAdminStats() { ... }
 * ```
 *
 * @module common/decorators
 */

import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";

/**
 * Require specific roles to access endpoint
 * @param roles - Required roles (any of them grants access)
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
