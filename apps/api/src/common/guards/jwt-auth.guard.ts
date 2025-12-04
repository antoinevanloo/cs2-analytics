/**
 * JWT Authentication Guard
 *
 * Protects routes requiring authentication.
 * Supports @Public() decorator to skip authentication.
 *
 * @module common/guards
 */

import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  /**
   * Check if route should be protected
   */
  canActivate(context: ExecutionContext) {
    // Check for @Public() decorator
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  /**
   * Handle authentication errors
   */
  handleRequest<TUser>(
    err: Error | null,
    user: TUser,
    info: Error | null,
  ): TUser {
    if (err || !user) {
      if (info?.name === "TokenExpiredError") {
        throw new UnauthorizedException("Token has expired");
      }
      if (info?.name === "JsonWebTokenError") {
        throw new UnauthorizedException("Invalid token");
      }
      throw new UnauthorizedException(
        err?.message || "Authentication required"
      );
    }
    return user;
  }
}
