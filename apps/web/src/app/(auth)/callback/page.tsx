/**
 * OAuth Callback Page
 *
 * Handles the OAuth redirect from Steam/FACEIT authentication.
 * Extracts tokens from URL fragment and completes the login flow.
 *
 * Flow:
 * 1. Backend redirects here with access_token in URL fragment
 * 2. Extract token and expiration from fragment
 * 3. Fetch user profile from /v1/auth/me
 * 4. Store user and tokens in auth store
 * 5. Redirect to appropriate page (onboarding or dashboard)
 *
 * @module app/(auth)/callback/page
 */

"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { Loader2, CheckCircle, AlertCircle, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// Animation keyframes for the CS2 theme
const pulseAnimation = "animate-pulse";

interface CallbackState {
  status: "loading" | "success" | "error";
  message: string;
  provider?: string;
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, setError } = useAuthStore();
  const [state, setState] = useState<CallbackState>({
    status: "loading",
    message: "Authenticating...",
  });
  const processedRef = useRef(false);

  useEffect(() => {
    // Prevent double processing in React strict mode
    if (processedRef.current) return;
    processedRef.current = true;

    const processCallback = async () => {
      try {
        // Extract data from URL fragment (after #)
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);

        const accessToken = params.get("access_token");
        const expiresIn = params.get("expires_in");
        const provider = params.get("provider") || "steam";

        // Check for error in query params
        const error = searchParams.get("error");
        const errorReason = searchParams.get("reason");

        if (error || errorReason) {
          throw new Error(errorReason || error || "Authentication failed");
        }

        if (!accessToken) {
          throw new Error("No access token received");
        }

        setState({
          status: "loading",
          message: `Connecting with ${provider === "faceit" ? "FACEIT" : "Steam"}...`,
          provider,
        });

        // Clear the URL fragment for security
        window.history.replaceState(null, "", window.location.pathname);

        // Calculate expiration timestamp
        const expiresAt = Date.now() + (parseInt(expiresIn || "3600") * 1000);

        // Fetch user profile
        setState({
          status: "loading",
          message: "Loading your profile...",
          provider,
        });

        const response = await fetch(`${API_URL}/v1/auth/me`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch user profile");
        }

        const user = await response.json();

        // Get refresh token from cookie (set by backend)
        // Note: HttpOnly cookies are not accessible via JS, but the token
        // will be sent automatically with requests
        const refreshToken = ""; // Refresh token is in HttpOnly cookie

        // Store in auth store
        login(
          {
            id: user.id,
            email: user.email,
            name: user.name,
            steamId: user.steamId,
            faceitId: user.faceitId,
            avatarUrl: user.avatar,
            createdAt: user.createdAt,
          },
          {
            accessToken,
            refreshToken,
            expiresAt,
          }
        );

        setState({
          status: "success",
          message: `Welcome, ${user.name || "Player"}!`,
          provider,
        });

        // Small delay to show success state
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Redirect based on onboarding status
        if (user.onboardingCompleted) {
          router.push("/dashboard");
        } else {
          router.push("/onboarding");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Authentication failed";
        console.error("Auth callback error:", error);
        setError(message);
        setState({
          status: "error",
          message,
        });

        // Redirect to login after delay
        setTimeout(() => {
          router.push("/login?error=" + encodeURIComponent(message));
        }, 3000);
      }
    };

    processCallback();
  }, [login, router, searchParams, setError]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }}
        />

        {/* Radial gradient overlay */}
        <div className="absolute inset-0 bg-gradient-radial from-primary/10 via-transparent to-transparent opacity-50" />

        {/* Animated accent lines */}
        <div className="absolute top-1/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent animate-pulse" />
        <div className="absolute bottom-1/3 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-pulse delay-500" />
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center">
        {/* Status indicator */}
        <div
          className={cn(
            "w-24 h-24 mx-auto mb-8 rounded-2xl flex items-center justify-center transition-all duration-500",
            state.status === "loading" && "bg-primary/20",
            state.status === "success" && "bg-green-500/20",
            state.status === "error" && "bg-red-500/20"
          )}
        >
          {state.status === "loading" && (
            <div className="relative">
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
              <div className="absolute inset-0 h-12 w-12 rounded-full border-2 border-primary/20 animate-ping" />
            </div>
          )}
          {state.status === "success" && (
            <CheckCircle className="h-12 w-12 text-green-500 animate-in zoom-in duration-300" />
          )}
          {state.status === "error" && (
            <AlertCircle className="h-12 w-12 text-red-500 animate-in zoom-in duration-300" />
          )}
        </div>

        {/* Provider badge */}
        {state.provider && (
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground uppercase tracking-wider">
              {state.provider === "faceit" ? "FACEIT" : "Steam"} Authentication
            </span>
          </div>
        )}

        {/* Message */}
        <h1
          className={cn(
            "text-2xl font-bold mb-2 transition-colors duration-300",
            state.status === "loading" && "text-foreground",
            state.status === "success" && "text-green-500",
            state.status === "error" && "text-red-500"
          )}
        >
          {state.status === "loading" && "Authenticating"}
          {state.status === "success" && "Success!"}
          {state.status === "error" && "Authentication Failed"}
        </h1>

        <p className="text-muted-foreground">{state.message}</p>

        {/* Loading bar */}
        {state.status === "loading" && (
          <div className="mt-8 w-64 mx-auto">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary via-primary/80 to-primary w-1/2 rounded-full animate-loading-bar" />
            </div>
          </div>
        )}

        {/* Error retry hint */}
        {state.status === "error" && (
          <p className="mt-4 text-sm text-muted-foreground">
            Redirecting to login...
          </p>
        )}
      </div>

      {/* Custom animation styles */}
      <style jsx>{`
        @keyframes loading-bar {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(100%);
          }
          100% {
            transform: translateX(-100%);
          }
        }
        .animate-loading-bar {
          animation: loading-bar 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

function AuthCallbackLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-primary/20 flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AuthCallbackLoading />}>
      <AuthCallbackContent />
    </Suspense>
  );
}
