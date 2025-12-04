/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures by temporarily blocking calls to a failing service.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests are blocked
 * - HALF_OPEN: Testing if service has recovered
 */

import { Logger } from "@nestjs/common";

export enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

export interface CircuitBreakerOptions {
  /** Name for logging */
  name: string;
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Time in ms before attempting to close circuit */
  resetTimeout: number;
  /** Number of successful calls in half-open state to close circuit */
  successThreshold: number;
  /** Time window for counting failures (ms) */
  failureWindow: number;
  /** Timeout for each request (ms) */
  requestTimeout: number;
}

const DEFAULT_OPTIONS: Omit<CircuitBreakerOptions, "name"> = {
  failureThreshold: 5,
  resetTimeout: 30000, // 30 seconds
  successThreshold: 2,
  failureWindow: 60000, // 1 minute
  requestTimeout: 300000, // 5 minutes (for large demos)
};

export class CircuitBreaker {
  private readonly logger: Logger;
  private readonly options: CircuitBreakerOptions;

  private state: CircuitState = CircuitState.CLOSED;
  private failures: number[] = [];
  private successCount = 0;
  private nextAttemptTime = 0;

  constructor(options: Partial<CircuitBreakerOptions> & { name: string }) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.logger = new Logger(`CircuitBreaker:${this.options.name}`);
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      throw new CircuitBreakerOpenError(
        `Circuit breaker is open for ${this.options.name}`,
        this.nextAttemptTime - Date.now(),
      );
    }

    try {
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `Request timeout after ${this.options.requestTimeout}ms`,
              ),
            ),
          this.options.requestTimeout,
        ),
      ),
    ]);
  }

  /**
   * Check if requests can be executed
   */
  private canExecute(): boolean {
    this.cleanupOldFailures();

    switch (this.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        if (Date.now() >= this.nextAttemptTime) {
          this.transitionTo(CircuitState.HALF_OPEN);
          return true;
        }
        return false;

      case CircuitState.HALF_OPEN:
        return true;

      default:
        return false;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    switch (this.state) {
      case CircuitState.HALF_OPEN:
        this.successCount++;
        this.logger.debug(
          `Half-open success ${this.successCount}/${this.options.successThreshold}`,
        );

        if (this.successCount >= this.options.successThreshold) {
          this.transitionTo(CircuitState.CLOSED);
        }
        break;

      case CircuitState.CLOSED:
        // Reset failure count on success
        this.failures = [];
        break;
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: unknown): void {
    const now = Date.now();
    this.failures.push(now);

    this.logger.warn(
      `Failure recorded: ${error instanceof Error ? error.message : "Unknown error"}`,
    );

    switch (this.state) {
      case CircuitState.HALF_OPEN:
        // Any failure in half-open state reopens the circuit
        this.transitionTo(CircuitState.OPEN);
        break;

      case CircuitState.CLOSED:
        this.cleanupOldFailures();
        if (this.failures.length >= this.options.failureThreshold) {
          this.transitionTo(CircuitState.OPEN);
        }
        break;
    }
  }

  /**
   * Remove failures outside the time window
   */
  private cleanupOldFailures(): void {
    const cutoff = Date.now() - this.options.failureWindow;
    this.failures = this.failures.filter((time) => time > cutoff);
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    this.state = newState;

    switch (newState) {
      case CircuitState.OPEN:
        this.nextAttemptTime = Date.now() + this.options.resetTimeout;
        this.successCount = 0;
        this.logger.warn(
          `Circuit OPENED after ${this.failures.length} failures. ` +
            `Will retry in ${this.options.resetTimeout}ms`,
        );
        break;

      case CircuitState.HALF_OPEN:
        this.successCount = 0;
        this.logger.log("Circuit HALF-OPEN, testing service availability");
        break;

      case CircuitState.CLOSED:
        this.failures = [];
        this.successCount = 0;
        this.logger.log("Circuit CLOSED, service recovered");
        break;
    }
  }

  /**
   * Get current circuit state and stats
   */
  getStatus(): {
    state: CircuitState;
    failures: number;
    successCount: number;
    nextAttemptTime: number | null;
  } {
    this.cleanupOldFailures();
    return {
      state: this.state,
      failures: this.failures.length,
      successCount: this.successCount,
      nextAttemptTime:
        this.state === CircuitState.OPEN ? this.nextAttemptTime : null,
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
    this.logger.log("Circuit breaker manually reset");
  }
}

/**
 * Error thrown when circuit is open
 */
export class CircuitBreakerOpenError extends Error {
  constructor(
    message: string,
    public readonly retryAfterMs: number,
  ) {
    super(message);
    this.name = "CircuitBreakerOpenError";
  }
}
