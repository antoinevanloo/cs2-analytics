/**
 * Analysis Errors - Custom error types for analysis module
 *
 * Provides structured error handling with:
 * - Specific error types for different failure modes
 * - Error codes for programmatic handling
 * - Contextual information for debugging
 *
 * @module analysis/utils/errors
 */

/**
 * Base error for all analysis errors
 */
export abstract class AnalysisError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  readonly timestamp: Date;
  readonly context: Record<string, unknown> | undefined;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.context = context;

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
    };
  }
}

/**
 * Invalid input data error
 */
export class InvalidInputError extends AnalysisError {
  readonly code = "INVALID_INPUT";
  readonly statusCode = 400;
  readonly field: string | undefined;

  constructor(message: string, field?: string, context?: Record<string, unknown>) {
    super(message, { ...context, field });
    this.field = field;
  }
}

/**
 * Insufficient data for calculation
 */
export class InsufficientDataError extends AnalysisError {
  readonly code = "INSUFFICIENT_DATA";
  readonly statusCode = 422;
  readonly required: number;
  readonly actual: number;

  constructor(
    message: string,
    required: number,
    actual: number,
    context?: Record<string, unknown>
  ) {
    super(message, { ...context, required, actual });
    this.required = required;
    this.actual = actual;
  }
}

/**
 * Calculation error (division by zero, overflow, etc.)
 */
export class CalculationError extends AnalysisError {
  readonly code = "CALCULATION_ERROR";
  readonly statusCode = 500;
  readonly operation: string;

  constructor(
    message: string,
    operation: string,
    context?: Record<string, unknown>
  ) {
    super(message, { ...context, operation });
    this.operation = operation;
  }
}

/**
 * Data inconsistency detected
 */
export class DataInconsistencyError extends AnalysisError {
  readonly code = "DATA_INCONSISTENCY";
  readonly statusCode = 500;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
  }
}

/**
 * Demo not found or not parsed
 */
export class DemoNotFoundError extends AnalysisError {
  readonly code = "DEMO_NOT_FOUND";
  readonly statusCode = 404;
  readonly demoId: string;

  constructor(demoId: string) {
    super(`Demo not found: ${demoId}`, { demoId });
    this.demoId = demoId;
  }
}

/**
 * Demo not yet parsed
 */
export class DemoNotParsedError extends AnalysisError {
  readonly code = "DEMO_NOT_PARSED";
  readonly statusCode = 422;
  readonly demoId: string;
  readonly status: string;

  constructor(demoId: string, status: string) {
    super(`Demo not yet parsed. Current status: ${status}`, { demoId, status });
    this.demoId = demoId;
    this.status = status;
  }
}

/**
 * Player not found in demo
 */
export class PlayerNotFoundError extends AnalysisError {
  readonly code = "PLAYER_NOT_FOUND";
  readonly statusCode = 404;
  readonly steamId: string;
  readonly demoId: string;

  constructor(steamId: string, demoId: string) {
    super(`Player ${steamId} not found in demo ${demoId}`, { steamId, demoId });
    this.steamId = steamId;
    this.demoId = demoId;
  }
}

/**
 * Result type for operations that can fail
 */
export type Result<T, E extends AnalysisError = AnalysisError> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Create a success result
 */
export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

/**
 * Create a failure result
 */
export function err<E extends AnalysisError>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Check if result is success
 */
export function isOk<T, E extends AnalysisError>(
  result: Result<T, E>
): result is { success: true; data: T } {
  return result.success;
}

/**
 * Check if result is error
 */
export function isErr<T, E extends AnalysisError>(
  result: Result<T, E>
): result is { success: false; error: E } {
  return !result.success;
}

/**
 * Unwrap result or throw
 */
export function unwrap<T, E extends AnalysisError>(result: Result<T, E>): T {
  if (result.success) {
    return result.data;
  }
  throw result.error;
}

/**
 * Unwrap result or return default
 */
export function unwrapOr<T, E extends AnalysisError>(
  result: Result<T, E>,
  defaultValue: T
): T {
  if (result.success) {
    return result.data;
  }
  return defaultValue;
}
