"use client";

/**
 * Authentication Provider
 *
 * Initializes the auth manager on app startup and provides
 * auth-related context to the application.
 *
 * Features:
 * - Initializes proactive token refresh
 * - Sets up page visibility handlers
 * - Provides session status monitoring
 *
 * @module components/providers/auth-provider
 */

import { useEffect, useRef } from "react";
import { initializeAuthManager, useAuthStore } from "@/stores/auth-store";

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const isInitialized = useRef(false);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    // Initialize auth manager once on mount
    if (!isInitialized.current) {
      initializeAuthManager();
      isInitialized.current = true;
    }
  }, []);

  // Re-initialize when auth state changes (e.g., after hydration)
  useEffect(() => {
    if (isAuthenticated && isInitialized.current) {
      // Auth manager will handle starting/stopping based on auth state
      // This ensures it picks up hydrated state from localStorage
      initializeAuthManager();
    }
  }, [isAuthenticated]);

  return <>{children}</>;
}
