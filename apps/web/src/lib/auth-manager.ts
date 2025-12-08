/**
 * Authentication Session Manager
 *
 * Centralized manager for authentication state with:
 * - Proactive token refresh (background interval)
 * - Page visibility handling (pause/resume)
 * - Heartbeat/keepalive mechanism
 * - Automatic session recovery
 *
 * Best practices implemented:
 * - Extensibility: Easy to add new refresh strategies
 * - Scalability: Minimal server load with smart refresh timing
 * - Resilience: Graceful error handling with exponential backoff
 * - Performance: Efficient timers, no unnecessary refreshes
 *
 * @module lib/auth-manager
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// ============================================================================
// Configuration
// ============================================================================

interface AuthManagerConfig {
  /**
   * Interval for proactive token refresh (ms)
   * Default: 4 minutes (refresh before 5-minute window)
   */
  refreshInterval: number;

  /**
   * Buffer time before token expiration to trigger refresh (ms)
   * Default: 2 minutes
   */
  refreshBuffer: number;

  /**
   * Interval for heartbeat pings when tab is visible (ms)
   * Default: 30 seconds
   */
  heartbeatInterval: number;

  /**
   * Maximum retry attempts for failed refresh
   */
  maxRetryAttempts: number;

  /**
   * Base delay for exponential backoff (ms)
   */
  retryBaseDelay: number;

  /**
   * Enable debug logging
   */
  debug: boolean;
}

/**
 * Default configuration optimized for:
 * - Scalability: 100k users = ~33k heartbeat req/min (vs 200k with 30s)
 * - Performance: Minimal overhead, smart refresh timing
 * - Resilience: Exponential backoff, graceful degradation
 */
const DEFAULT_CONFIG: AuthManagerConfig = {
  refreshInterval: 4 * 60 * 1000, // 4 minutes - check token validity
  refreshBuffer: 2 * 60 * 1000, // 2 minutes before expiry - trigger refresh
  heartbeatInterval: 3 * 60 * 1000, // 3 minutes - reduced for scalability (was 30s)
  maxRetryAttempts: 3,
  retryBaseDelay: 1000, // 1 second base, doubles each retry
  debug: process.env.NODE_ENV === "development",
};

// ============================================================================
// Types
// ============================================================================

type AuthEventType =
  | "token_refreshed"
  | "token_expired"
  | "session_ended"
  | "session_restored"
  | "refresh_failed"
  | "visibility_changed"
  | "heartbeat_failed";

interface AuthEvent {
  type: AuthEventType;
  timestamp: number;
  data?: Record<string, unknown>;
}

type AuthEventListener = (event: AuthEvent) => void;

// ============================================================================
// Auth Manager Singleton
// ============================================================================

class AuthSessionManager {
  private config: AuthManagerConfig;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private isInitialized = false;
  private isRefreshing = false;
  private retryCount = 0;
  private lastRefreshTime = 0;
  private listeners: Set<AuthEventListener> = new Set();

  // Metrics for monitoring (Observability)
  private _metrics = {
    refreshSuccessCount: 0,
    refreshFailCount: 0,
    heartbeatFailCount: 0,
    lastHeartbeatTime: 0,
  };

  // Store reference for auth actions
  private getTokens: (() => { accessToken: string; expiresAt: number } | null) | null = null;
  private refreshTokens: (() => Promise<string | null>) | null = null;
  private logout: (() => void) | null = null;
  private isAuthenticated: (() => boolean) | null = null;

  constructor(config: Partial<AuthManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Initialize the auth manager with store actions
   */
  initialize(actions: {
    getTokens: () => { accessToken: string; expiresAt: number } | null;
    refreshTokens: () => Promise<string | null>;
    logout: () => void;
    isAuthenticated: () => boolean;
  }): void {
    if (this.isInitialized) {
      this.log("Already initialized, skipping");
      return;
    }

    this.getTokens = actions.getTokens;
    this.refreshTokens = actions.refreshTokens;
    this.logout = actions.logout;
    this.isAuthenticated = actions.isAuthenticated;

    // Start managers only if authenticated
    if (this.isAuthenticated()) {
      this.start();
    }

    // Setup visibility listener
    this.setupVisibilityListener();

    this.isInitialized = true;
    this.log("Auth manager initialized");
  }

  /**
   * Start proactive refresh and heartbeat
   */
  start(): void {
    if (!this.isAuthenticated?.()) {
      this.log("Not authenticated, not starting managers");
      return;
    }

    this.startRefreshTimer();
    this.startHeartbeat();
    this.log("Auth manager started");
  }

  /**
   * Stop all timers
   */
  stop(): void {
    this.stopRefreshTimer();
    this.stopHeartbeat();
    this.log("Auth manager stopped");
  }

  /**
   * Handle login - start managers
   */
  onLogin(): void {
    this.retryCount = 0;
    this.start();
    this.emit({ type: "session_restored", timestamp: Date.now() });
  }

  /**
   * Handle logout - stop managers
   */
  onLogout(): void {
    this.stop();
    this.emit({ type: "session_ended", timestamp: Date.now() });
  }

  /**
   * Subscribe to auth events
   */
  subscribe(listener: AuthEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Force immediate token refresh
   */
  async forceRefresh(): Promise<boolean> {
    return this.performRefresh();
  }

  /**
   * Get manager status for monitoring/debugging
   * Useful for admin dashboards and health checks
   */
  getStatus(): {
    initialized: boolean;
    refreshTimerActive: boolean;
    heartbeatActive: boolean;
    lastRefreshTime: number;
    retryCount: number;
    config: AuthManagerConfig;
    metrics: {
      totalRefreshes: number;
      failedRefreshes: number;
      successRate: number;
    };
  } {
    const totalRefreshes = this._metrics.refreshSuccessCount + this._metrics.refreshFailCount;
    return {
      initialized: this.isInitialized,
      refreshTimerActive: this.refreshTimer !== null,
      heartbeatActive: this.heartbeatTimer !== null,
      lastRefreshTime: this.lastRefreshTime,
      retryCount: this.retryCount,
      config: { ...this.config },
      metrics: {
        totalRefreshes,
        failedRefreshes: this._metrics.refreshFailCount,
        successRate: totalRefreshes > 0
          ? Math.round((this._metrics.refreshSuccessCount / totalRefreshes) * 100)
          : 100,
      },
    };
  }

  /**
   * Update configuration at runtime
   * Useful for A/B testing or dynamic adjustments
   */
  updateConfig(newConfig: Partial<AuthManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.log(`Config updated: ${JSON.stringify(newConfig)}`);

    // Restart timers with new config if running
    if (this.refreshTimer) {
      this.stopRefreshTimer();
      this.startRefreshTimer();
    }
    if (this.heartbeatTimer) {
      this.stopHeartbeat();
      this.startHeartbeat();
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private startRefreshTimer(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    // Check immediately if refresh is needed
    this.checkAndRefresh();

    // Then check periodically
    this.refreshTimer = setInterval(() => {
      this.checkAndRefresh();
    }, this.config.refreshInterval);

    this.log(`Refresh timer started (interval: ${this.config.refreshInterval}ms)`);
  }

  private stopRefreshTimer(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
      this.log("Refresh timer stopped");
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    // Only run heartbeat when tab is visible
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      this.heartbeatTimer = setInterval(() => {
        this.performHeartbeat();
      }, this.config.heartbeatInterval);

      this.log(`Heartbeat started (interval: ${this.config.heartbeatInterval}ms)`);
    }
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      this.log("Heartbeat stopped");
    }
  }

  private setupVisibilityListener(): void {
    if (typeof document === "undefined") return;

    document.addEventListener("visibilitychange", () => {
      const isVisible = document.visibilityState === "visible";

      this.emit({
        type: "visibility_changed",
        timestamp: Date.now(),
        data: { visible: isVisible },
      });

      if (isVisible) {
        this.log("Tab became visible - checking auth state");

        // Check token immediately when tab becomes visible
        this.checkAndRefresh();

        // Restart heartbeat
        if (this.isAuthenticated?.()) {
          this.startHeartbeat();
        }
      } else {
        this.log("Tab hidden - pausing heartbeat");
        this.stopHeartbeat();
      }
    });
  }

  private async checkAndRefresh(): Promise<void> {
    if (!this.isAuthenticated?.() || !this.getTokens) {
      return;
    }

    const tokens = this.getTokens();
    if (!tokens) {
      return;
    }

    const now = Date.now();
    const timeUntilExpiry = tokens.expiresAt - now;

    // Refresh if within buffer window
    if (timeUntilExpiry <= this.config.refreshBuffer) {
      this.log(`Token expires in ${Math.round(timeUntilExpiry / 1000)}s, refreshing...`);
      await this.performRefresh();
    } else {
      this.log(`Token valid for ${Math.round(timeUntilExpiry / 1000)}s, no refresh needed`);
    }
  }

  private async performRefresh(): Promise<boolean> {
    if (this.isRefreshing) {
      this.log("Refresh already in progress, skipping");
      return false;
    }

    if (!this.refreshTokens) {
      this.log("No refresh function available");
      return false;
    }

    this.isRefreshing = true;

    try {
      const newToken = await this.refreshTokens();

      if (newToken) {
        this.lastRefreshTime = Date.now();
        this.retryCount = 0;
        this._metrics.refreshSuccessCount++;

        this.emit({
          type: "token_refreshed",
          timestamp: Date.now(),
        });

        this.log("Token refreshed successfully");
        return true;
      } else {
        throw new Error("Refresh returned null token");
      }
    } catch (error) {
      this.retryCount++;
      this._metrics.refreshFailCount++;

      this.emit({
        type: "refresh_failed",
        timestamp: Date.now(),
        data: { error: String(error), attempt: this.retryCount },
      });

      this.log(`Refresh failed (attempt ${this.retryCount}): ${error}`);

      // Retry with exponential backoff
      if (this.retryCount < this.config.maxRetryAttempts) {
        const delay = this.config.retryBaseDelay * Math.pow(2, this.retryCount - 1);
        this.log(`Retrying in ${delay}ms...`);

        setTimeout(() => {
          this.performRefresh();
        }, delay);
      } else {
        // Max retries reached - emit session ended
        this.emit({
          type: "session_ended",
          timestamp: Date.now(),
          data: { reason: "max_retries_exceeded" },
        });

        this.log("Max retry attempts reached, session ended");
        this.logout?.();
      }

      return false;
    } finally {
      this.isRefreshing = false;
    }
  }

  private async performHeartbeat(): Promise<void> {
    if (!this.isAuthenticated?.() || !this.getTokens) {
      return;
    }

    const tokens = this.getTokens();
    if (!tokens) {
      return;
    }

    try {
      // Use auth/verify endpoint for lightweight health check
      const response = await fetch(`${API_URL}/v1/auth/verify`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Cache-Control": "no-cache",
          "Authorization": `Bearer ${tokens.accessToken}`,
        },
      });

      this._metrics.lastHeartbeatTime = Date.now();

      if (!response.ok) {
        this._metrics.heartbeatFailCount++;
        // Server returned error - might need to refresh
        if (response.status === 401) {
          this.log("Heartbeat got 401, triggering refresh");
          await this.performRefresh();
        } else {
          this.emit({
            type: "heartbeat_failed",
            timestamp: Date.now(),
            data: { status: response.status },
          });
        }
      }
    } catch (error) {
      // Network error - don't logout, just log
      this._metrics.heartbeatFailCount++;
      this.log(`Heartbeat failed: ${error}`);
      this.emit({
        type: "heartbeat_failed",
        timestamp: Date.now(),
        data: { error: String(error) },
      });
    }
  }

  private emit(event: AuthEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("Auth event listener error:", error);
      }
    });
  }

  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[AuthManager] ${message}`);
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const authManager = new AuthSessionManager();

// Re-export types
export type { AuthManagerConfig, AuthEvent, AuthEventType, AuthEventListener };
