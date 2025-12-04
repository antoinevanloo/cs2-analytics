/**
 * Global HTTP Exception Filter
 *
 * Standardizes all error responses across the API.
 * Provides consistent error format for frontend consumption.
 *
 * Features:
 * - Consistent error response structure
 * - Request correlation ID tracking
 * - Detailed logging for debugging
 * - User-friendly error messages
 *
 * @module common/filters
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";

/**
 * Standardized API error response
 */
export interface ApiErrorResponse {
  /** HTTP status code */
  statusCode: number;
  /** Error type/code for programmatic handling */
  error: string;
  /** Human-readable error message */
  message: string;
  /** Detailed error messages (validation errors, etc.) */
  details?: string[];
  /** Request path that caused the error */
  path: string;
  /** ISO timestamp of when error occurred */
  timestamp: string;
  /** Correlation ID for request tracing */
  correlationId?: string;
}

/**
 * Error code mapping for consistent error types
 */
const ERROR_CODES: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  422: "UNPROCESSABLE_ENTITY",
  429: "TOO_MANY_REQUESTS",
  500: "INTERNAL_SERVER_ERROR",
  502: "BAD_GATEWAY",
  503: "SERVICE_UNAVAILABLE",
  504: "GATEWAY_TIMEOUT",
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    // Get correlation ID from request headers or generate one
    const correlationId =
      (request.headers["x-correlation-id"] as string) ||
      (request.headers["x-request-id"] as string) ||
      this.generateCorrelationId();

    // Determine status code and message
    const { statusCode, message, details } = this.extractErrorInfo(exception);
    const errorCode = ERROR_CODES[statusCode] || "UNKNOWN_ERROR";

    // Build standardized error response
    const errorResponse: ApiErrorResponse = {
      statusCode,
      error: errorCode,
      message: this.sanitizeMessage(message),
      path: request.url,
      timestamp: new Date().toISOString(),
      correlationId,
    };

    // Add details if available (e.g., validation errors)
    if (details && details.length > 0) {
      errorResponse.details = details;
    }

    // Log the error with appropriate level
    this.logError(exception, errorResponse, request);

    // Send response
    response.status(statusCode).send(errorResponse);
  }

  /**
   * Extract error information from various exception types
   */
  private extractErrorInfo(exception: unknown): {
    statusCode: number;
    message: string;
    details?: string[] | undefined;
  } {
    // Handle NestJS HTTP exceptions
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === "string") {
        return { statusCode: status, message: response };
      }

      if (typeof response === "object" && response !== null) {
        const res = response as Record<string, unknown>;
        const message = (res.message as string | string[]) || exception.message;
        const details = Array.isArray(message) ? message : undefined;
        const mainMessage = Array.isArray(message)
          ? "Validation failed"
          : message;

        return {
          statusCode: status,
          message: mainMessage,
          details,
        };
      }

      return { statusCode: status, message: exception.message };
    }

    // Handle standard Error objects
    if (exception instanceof Error) {
      // Check for specific error types
      if (exception.name === "PrismaClientKnownRequestError") {
        return this.handlePrismaError(exception);
      }

      if (exception.name === "JsonWebTokenError") {
        return {
          statusCode: HttpStatus.UNAUTHORIZED,
          message: "Invalid authentication token",
        };
      }

      if (exception.name === "TokenExpiredError") {
        return {
          statusCode: HttpStatus.UNAUTHORIZED,
          message: "Authentication token has expired",
        };
      }

      // Generic error
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message:
          process.env.NODE_ENV === "production"
            ? "An unexpected error occurred"
            : exception.message,
      };
    }

    // Unknown error type
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "An unexpected error occurred",
    };
  }

  /**
   * Handle Prisma-specific errors
   */
  private handlePrismaError(error: Error): {
    statusCode: number;
    message: string;
  } {
    const prismaError = error as Error & { code?: string };

    switch (prismaError.code) {
      case "P2002":
        return {
          statusCode: HttpStatus.CONFLICT,
          message: "A record with this identifier already exists",
        };
      case "P2025":
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: "The requested resource was not found",
        };
      case "P2003":
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: "Invalid reference to related resource",
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "Database operation failed",
        };
    }
  }

  /**
   * Sanitize error message for production
   */
  private sanitizeMessage(message: string): string {
    if (process.env.NODE_ENV === "production") {
      // Remove stack traces and internal details
      return message
        .replace(/at .+:\d+:\d+/g, "")
        .replace(/\n/g, " ")
        .trim()
        .substring(0, 200);
    }
    return message;
  }

  /**
   * Log error with appropriate level and context
   */
  private logError(
    exception: unknown,
    errorResponse: ApiErrorResponse,
    request: FastifyRequest,
  ): void {
    const logContext = {
      correlationId: errorResponse.correlationId,
      path: errorResponse.path,
      method: request.method,
      statusCode: errorResponse.statusCode,
      userAgent: request.headers["user-agent"],
      ip: request.ip,
    };

    if (errorResponse.statusCode >= 500) {
      this.logger.error(
        `[${errorResponse.correlationId}] ${errorResponse.error}: ${errorResponse.message}`,
        exception instanceof Error ? exception.stack : undefined,
        JSON.stringify(logContext),
      );
    } else if (errorResponse.statusCode >= 400) {
      this.logger.warn(
        `[${errorResponse.correlationId}] ${errorResponse.error}: ${errorResponse.message}`,
        JSON.stringify(logContext),
      );
    }
  }

  /**
   * Generate a unique correlation ID
   */
  private generateCorrelationId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
