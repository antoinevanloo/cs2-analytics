/**
 * Auth Error Page
 *
 * Displays authentication errors with a gaming-themed UI.
 * Provides clear error messages and retry options.
 *
 * @module app/(auth)/error/page
 */

"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  Shield,
  Crosshair,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Error messages mapping
const ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
  access_denied: {
    title: "Access Denied",
    description: "You denied the authentication request. Please try again if this was a mistake.",
  },
  invalid_token: {
    title: "Invalid Token",
    description: "The authentication token is invalid or has expired. Please try logging in again.",
  },
  user_not_found: {
    title: "Account Not Found",
    description: "We couldn't find an account with those credentials. Please check and try again.",
  },
  server_error: {
    title: "Server Error",
    description: "Something went wrong on our end. Please try again in a few moments.",
  },
  network_error: {
    title: "Connection Failed",
    description: "Unable to connect to the authentication service. Check your internet connection.",
  },
  steam_error: {
    title: "Steam Authentication Failed",
    description: "There was a problem authenticating with Steam. Please ensure your Steam account is accessible.",
  },
  faceit_error: {
    title: "FACEIT Authentication Failed",
    description: "There was a problem authenticating with FACEIT. Please ensure your FACEIT account is accessible.",
  },
  default: {
    title: "Authentication Failed",
    description: "An unexpected error occurred during authentication. Please try again.",
  },
};

function AuthErrorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [countdown, setCountdown] = useState(10);
  const [isRetrying, setIsRetrying] = useState(false);

  const reason = searchParams.get("reason") || searchParams.get("error") || "default";
  const errorInfo = ERROR_MESSAGES[reason] || ERROR_MESSAGES.default;

  useEffect(() => {
    // Countdown for auto-redirect
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push("/login");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  const handleRetry = () => {
    setIsRetrying(true);
    router.push("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-destructive/5 p-4">
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

        {/* Warning glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-destructive/10 rounded-full blur-3xl" />
      </div>

      <Card className="relative z-10 w-full max-w-md border-destructive/20 bg-card/80 backdrop-blur-sm shadow-2xl">
        <CardContent className="p-8">
          {/* Error icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-10 h-10 text-destructive" />
              </div>
              {/* Pulse effect */}
              <div className="absolute inset-0 w-20 h-20 rounded-2xl bg-destructive/20 animate-ping" />
            </div>
          </div>

          {/* Error message */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-destructive mb-2">
              {errorInfo.title}
            </h1>
            <p className="text-muted-foreground">{errorInfo.description}</p>
          </div>

          {/* Error details */}
          <div className="mb-6 p-4 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="w-4 h-4" />
              <span>Error Code: {reason}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              size="lg"
              className="w-full"
              onClick={handleRetry}
              disabled={isRetrying}
            >
              {isRetrying ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Try Again
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="w-full"
              asChild
            >
              <Link href="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Link>
            </Button>
          </div>

          {/* Auto-redirect notice */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Redirecting to login in{" "}
              <span className="font-mono text-foreground">{countdown}s</span>
            </p>
            <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-1000 ease-linear"
                style={{ width: `${(countdown / 10) * 100}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Decorative crosshair */}
      <div className="absolute bottom-10 right-10 opacity-5">
        <Crosshair className="w-24 h-24" strokeWidth={0.5} />
      </div>
    </div>
  );
}

function AuthErrorLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<AuthErrorLoading />}>
      <AuthErrorContent />
    </Suspense>
  );
}
