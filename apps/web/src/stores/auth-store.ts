/**
 * Authentication state management with Zustand
 *
 * Handles user authentication state, tokens, and session management.
 * Persists auth state to localStorage for session continuity.
 *
 * @module stores/auth-store
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// Singleton promise for refresh to prevent concurrent refresh requests
let refreshPromise: Promise<string | null> | null = null;

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
      login: (user, tokens) =>
        set({
          user,
          tokens,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        }),

      // Logout - clears everything
      logout: () =>
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        }),

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

      // Refresh tokens using the refresh endpoint
      refreshTokens: async () => {
        const state = get();
        if (!state.tokens?.refreshToken) {
          return null;
        }

        // If a refresh is already in progress, wait for it
        if (refreshPromise) {
          return refreshPromise;
        }

        // Create new refresh promise
        refreshPromise = (async () => {
          try {
            const response = await fetch(`${API_URL}/v1/auth/refresh`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                refreshToken: state.tokens?.refreshToken,
              }),
              credentials: "include",
            });

            if (!response.ok) {
              // Refresh failed - logout user
              get().logout();
              return null;
            }

            const data = await response.json();
            const newTokens: AuthTokens = {
              accessToken: data.accessToken,
              refreshToken: state.tokens?.refreshToken || "", // Keep existing refresh token
              expiresAt: Date.now() + data.expiresIn * 1000,
            };

            // Update tokens in store
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
export const selectIsAuthenticated = (state: AuthState) => state.isAuthenticated;
export const selectIsLoading = (state: AuthState) => state.isLoading;
export const selectError = (state: AuthState) => state.error;
