/**
 * Public Decorator
 *
 * Marks a route as public (no authentication required).
 * Use when global JWT guard is applied.
 *
 * @example
 * ```typescript
 * @Public()
 * @Get('health')
 * healthCheck() { ... }
 * ```
 *
 * @module common/decorators
 */

import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Mark endpoint as publicly accessible
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
