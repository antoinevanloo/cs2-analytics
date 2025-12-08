/**
 * Authentication state management with Zustand
 *
 * Handles user authentication state, tokens, and session management.
 * Persists auth state to localStorage for session continuity.
 *
 * Features:
 * - Proactive token refresh via AuthManager
 * - Automatic session recovery on page visibility
 * - Exponential backoff on refresh failures
 * - Concurrent refresh request deduplication
 *
 * @module stores/auth-store
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { authManager } from "@/lib/auth-manager";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// Singleton promise for refresh to prevent concurrent refresh requests
let refreshPromise: Promise<string | null> | null = null;

// Track initialization state
let isAuthManagerInitialized = false;

// ============================================================================
// Types
// ============================================================================

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  steamId: string | null;
  faceitId: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp
}

interface AuthState {
  // User data
  user: AuthUser | null;
  tokens: AuthTokens | null;

  // Status
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: AuthUser | null) => void;
  setTokens: (tokens: AuthTokens | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;

  // Auth operations
  login: (user: AuthUser, tokens: AuthTokens) => void;
  logout: () => void;
  refreshSession: (tokens: AuthTokens) => void;

  // Computed
  isTokenExpired: () => boolean;
  getAccessToken: () => string | null;

  // Async operations
  refreshTokens: () => Promise<string | null>;
  getValidAccessToken: () => Promise<string | null>;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Setters
      setUser: (user) =>
        set({
          user,
          isAuthenticated: user !== null,
        }),

      setTokens: (tokens) => set({ tokens }),

      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error }),

      // Login - sets both user and tokens
      login: (user, tokens) => {
        set({
          user,
          tokens,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        // Notify auth manager of login
        authManager.onLogin();
      },

      // Logout - clears everything
      logout: () => {
        // Notify auth manager before clearing state
        authManager.onLogout();
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      },

      // Refresh tokens
      refreshSession: (tokens) =>
        set({
          tokens,
          error: null,
        }),

      // Check if token is expired
      isTokenExpired: () => {
        const { tokens } = get();
        if (!tokens) return true;

        // Add 60 second buffer for network latency
        return Date.now() >= tokens.expiresAt - 60000;
      },

      // Get access token (returns null if expired) - use getValidAccessToken for auto-refresh
      getAccessToken: () => {
        const state = get();
        if (!state.tokens || state.isTokenExpired()) {
          return null;
        }
        return state.tokens.accessToken;
      },

      /**
       * Refresh access token using the refresh endpoint.
       *
       * Architecture note: The refresh token is stored in an HttpOnly cookie
       * by the backend for security (not accessible via JavaScript).
       * The browser automatically sends this cookie when credentials: "include" is set.
       *
       * @returns New access token or null if refresh failed
       */
      refreshTokens: async () => {
        const state = get();

        // Must have an authenticated session to attempt refresh
        // Note: We check isAuthenticated, not refreshToken, because the
        // refresh token is in an HttpOnly cookie (inaccessible to JS)
        if (!state.isAuthenticated) {
          return null;
        }

        // Prevent concurrent refresh requests (race condition protection)
        if (refreshPromise) {
          return refreshPromise;
        }

        refreshPromise = (async () => {
          try {
            const response = await fetch(`${API_URL}/v1/auth/refresh`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              // Empty body - refresh token is sent via HttpOnly cookie
              body: JSON.stringify({}),
              // Critical: This sends the HttpOnly cookie with the request
              credentials: "include",
            });

            if (!response.ok) {
              // Refresh failed - session invalid, logout user
              get().logout();
              return null;
            }

            const data = await response.json();

            // Update tokens - refreshToken stays empty as it's in HttpOnly cookie
            const newTokens: AuthTokens = {
              accessToken: data.accessToken,
              refreshToken: "", // Stored in HttpOnly cookie, not accessible
              expiresAt: Date.now() + data.expiresIn * 1000,
            };

            set({ tokens: newTokens });
            return newTokens.accessToken;
          } catch (error) {
            console.error("Token refresh failed:", error);
            get().logout();
            return null;
          } finally {
            refreshPromise = null;
          }
        })();

        return refreshPromise;
      },

      // Get valid access token - refreshes automatically if expired
      getValidAccessToken: async () => {
        const state = get();

        // No tokens at all
        if (!state.tokens) {
          return null;
        }

        // Token still valid
        if (!state.isTokenExpired()) {
          return state.tokens.accessToken;
        }

        // Token expired - try to refresh
        return state.refreshTokens();
      },
    }),
    {
      name: "cs2-auth-storage",
      storage: createJSONStorage(() => localStorage),
      // Only persist user and tokens
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);

// ============================================================================
// Selectors (for performance optimization)
// ============================================================================

export const selectUser = (state: AuthState) => state.user;
export const selectIsAuthenticated = (state: AuthState) =>
  state.isAuthenticated;
export const selectIsLoading = (state: AuthState) => state.isLoading;
export const selectError = (state: AuthState) => state.error;

// ============================================================================
// Auth Manager Integration
// ============================================================================

/**
 * Initialize the auth manager with store actions.
 * Should be called once when the app starts.
 * Safe to call multiple times - subsequent calls are no-ops.
 */
export function initializeAuthManager(): void {
  if (isAuthManagerInitialized) {
    return;
  }

  // IMPORTANT: Always use useAuthStore.getState() to get CURRENT state
  // Do NOT capture store reference - it won't update after state changes
  authManager.initialize({
    getTokens: () => useAuthStore.getState().tokens,
    refreshTokens: () => useAuthStore.getState().refreshTokens(),
    logout: () => useAuthStore.getState().logout(),
    isAuthenticated: () => useAuthStore.getState().isAuthenticated,
  });

  // Subscribe to auth events for logging/analytics
  authManager.subscribe((event) => {
    if (process.env.NODE_ENV === "development") {
      console.log("[Auth Event]", event.type, event.data);
    }

    // Handle specific events
    if (event.type === "session_ended") {
      // Could trigger UI notification here
    }
  });

  isAuthManagerInitialized = true;
}

/**
 * Get the auth manager instance for advanced usage
 */
export { authManager };
