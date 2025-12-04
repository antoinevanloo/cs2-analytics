/**
 * Current User Decorator
 *
 * Extracts authenticated user from request.
 * Use in controller methods to get current user.
 *
 * @example
 * ```typescript
 * @Get('profile')
 * getProfile(@CurrentUser() user: AuthenticatedUser) {
 *   return user;
 * }
 * ```
 *
 * @module common/decorators
 */

import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthenticatedUser } from "../../modules/auth/strategies/jwt.strategy";

/**
 * Get current authenticated user from request
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) {
      return undefined;
    }

    // Return specific property if requested
    if (data) {
      return user[data];
    }

    return user;
  },
);
