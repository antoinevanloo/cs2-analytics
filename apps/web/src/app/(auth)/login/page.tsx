/**
 * Login Page - CS2 Analytics
 *
 * Gaming-themed authentication page with Steam and FACEIT OAuth options.
 * Features CS2-inspired design with animations and visual effects.
 *
 * @module app/(auth)/login/page
 */

"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Crosshair,
  Shield,
  Zap,
  Trophy,
  Target,
  TrendingUp,
  Loader2,
  AlertCircle,
  ChevronRight,
  Gamepad2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// Steam and FACEIT brand colors
const STEAM_COLOR = "#1b2838";
const FACEIT_COLOR = "#ff5500";

// Features to highlight
const features = [
  {
    icon: Target,
    title: "HLTV Rating 2.0",
    description: "Exact implementation of the industry standard",
  },
  {
    icon: Crosshair,
    title: "2D Replay Viewer",
    description: "Interactive round visualization",
  },
  {
    icon: TrendingUp,
    title: "AI Coaching",
    description: "Personalized improvement insights",
  },
  {
    icon: Trophy,
    title: "Progress Tracking",
    description: "Track your journey to Global Elite",
  },
];

// Steam SVG Icon
function SteamIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z" />
    </svg>
  );
}

// FACEIT SVG Icon
function FaceitIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M4.513 5.973a6.026 6.026 0 0 0-1.725 4.232c0 3.342 2.698 6.052 6.025 6.052 1.05 0 2.039-.27 2.9-.746l2.706 2.704a.576.576 0 0 0 .814 0 .578.578 0 0 0 0-.816l-2.707-2.704a6.012 6.012 0 0 0 1.726-4.232c0-3.342-2.698-6.052-6.025-6.052-1.05 0-2.039.27-2.9.746L2.62 2.453a.576.576 0 0 0-.814 0 .578.578 0 0 0 0 .816l2.707 2.704zm4.3-1.551a4.87 4.87 0 0 1 4.868 4.873 4.87 4.87 0 0 1-4.867 4.873 4.87 4.87 0 0 1-4.868-4.873 4.87 4.87 0 0 1 4.868-4.873zM22.92 21.52l-2.706-2.704a6.012 6.012 0 0 0 1.725-4.232c0-3.342-2.697-6.052-6.025-6.052-1.05 0-2.038.27-2.9.746L10.31 6.574a.576.576 0 0 0-.815 0 .578.578 0 0 0 0 .816l2.706 2.704a6.026 6.026 0 0 0-1.725 4.232c0 3.342 2.698 6.052 6.025 6.052 1.05 0 2.039-.27 2.9-.746l2.706 2.704a.574.574 0 0 0 .814 0 .578.578 0 0 0 0-.816zm-6.412-2.215a4.87 4.87 0 0 1-4.867-4.873 4.87 4.87 0 0 1 4.867-4.873 4.87 4.87 0 0 1 4.868 4.873 4.87 4.87 0 0 1-4.868 4.873z" />
    </svg>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuthStore();
  const [isLoading, setIsLoading] = useState<"steam" | "faceit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check for error in URL
    const errorParam = searchParams.get("error");
    if (errorParam) {
      setError(errorParam);
    }
  }, [searchParams]);

  useEffect(() => {
    // Redirect if already authenticated
    if (isAuthenticated) {
      // Check for returnTo parameter to redirect back to original page
      const returnTo = searchParams.get("returnTo");
      const destination = returnTo ? decodeURIComponent(returnTo) : "/dashboard";
      // Validate returnTo is a relative path to prevent open redirect
      const isRelativePath = destination.startsWith("/") && !destination.startsWith("//");
      router.push(isRelativePath ? destination : "/dashboard");
    }
  }, [isAuthenticated, router, searchParams]);

  const handleLogin = (provider: "steam" | "faceit") => {
    setIsLoading(provider);
    setError(null);

    // Store returnTo in sessionStorage for after OAuth callback
    const returnTo = searchParams.get("returnTo");
    if (returnTo) {
      sessionStorage.setItem("auth_return_to", decodeURIComponent(returnTo));
    }

    // Redirect to backend OAuth endpoint
    window.location.href = `${API_URL}/v1/auth/${provider}`;
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Hero/Features */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* Animated background elements */}
        <div className="absolute inset-0">
          {/* Grid */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
                               linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
              backgroundSize: "40px 40px",
            }}
          />

          {/* Animated glow orbs */}
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/3 right-1/4 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl animate-pulse delay-1000" />

          {/* Crosshair decoration */}
          <div className="absolute top-20 right-20 opacity-10">
            <Crosshair className="w-32 h-32 text-primary" strokeWidth={0.5} />
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center p-12">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
              <Crosshair className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">CS2 Analytics</h1>
              <p className="text-sm text-slate-400">Level up your game</p>
            </div>
          </div>

          {/* Tagline */}
          <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
            Analyze. Improve.
            <br />
            <span className="text-primary">Dominate.</span>
          </h2>
          <p className="text-lg text-slate-400 mb-12 max-w-md">
            Transform your CS2 demos into actionable insights. Whether you're a
            player, coach, or analyst, we've got the tools you need.
          </p>

          {/* Features */}
          <div className="space-y-4">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex items-start gap-4 p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 transition-all hover:bg-white/10 hover:border-primary/30"
                style={{
                  animationDelay: `${index * 100}ms`,
                }}
              >
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{feature.title}</h3>
                  <p className="text-sm text-slate-400">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="mt-12 flex items-center gap-8">
            <div>
              <p className="text-3xl font-bold text-white">10K+</p>
              <p className="text-sm text-slate-400">Demos analyzed</p>
            </div>
            <div className="w-px h-12 bg-slate-700" />
            <div>
              <p className="text-3xl font-bold text-white">5K+</p>
              <p className="text-sm text-slate-400">Players</p>
            </div>
            <div className="w-px h-12 bg-slate-700" />
            <div>
              <p className="text-3xl font-bold text-white">99%</p>
              <p className="text-sm text-slate-400">Accuracy</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
              <Crosshair className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">CS2 Analytics</h1>
          </div>

          {/* Login card */}
          <Card className="border-0 shadow-2xl bg-card/50 backdrop-blur-sm">
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <Gamepad2 className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">Welcome, Player</h2>
                <p className="text-muted-foreground mt-2">
                  Sign in with your gaming account to continue
                </p>
              </div>

              {/* Error message */}
              {error && (
                <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-destructive">
                      Authentication failed
                    </p>
                    <p className="text-sm text-destructive/80 mt-1">{error}</p>
                  </div>
                </div>
              )}

              {/* OAuth buttons */}
              <div className="space-y-4">
                {/* Steam button */}
                <Button
                  size="lg"
                  className={cn(
                    "w-full h-14 text-base font-semibold relative overflow-hidden group",
                    "bg-[#1b2838] hover:bg-[#2a475e] text-white",
                    "transition-all duration-300"
                  )}
                  onClick={() => handleLogin("steam")}
                  disabled={isLoading !== null}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  {isLoading === "steam" ? (
                    <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                  ) : (
                    <SteamIcon className="w-5 h-5 mr-3" />
                  )}
                  Continue with Steam
                  <ChevronRight className="w-4 h-4 ml-auto opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </Button>

                {/* FACEIT button */}
                <Button
                  size="lg"
                  className={cn(
                    "w-full h-14 text-base font-semibold relative overflow-hidden group",
                    "bg-[#ff5500] hover:bg-[#ff6a1a] text-white",
                    "transition-all duration-300"
                  )}
                  onClick={() => handleLogin("faceit")}
                  disabled={isLoading !== null}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  {isLoading === "faceit" ? (
                    <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                  ) : (
                    <FaceitIcon className="w-5 h-5 mr-3" />
                  )}
                  Continue with FACEIT
                  <ChevronRight className="w-4 h-4 ml-auto opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </Button>
              </div>

              {/* Divider */}
              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Secure authentication
                  </span>
                </div>
              </div>

              {/* Security badges */}
              <div className="flex items-center justify-center gap-6 text-muted-foreground">
                <div className="flex items-center gap-2 text-xs">
                  <Shield className="w-4 h-4" />
                  <span>256-bit encryption</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Zap className="w-4 h-4" />
                  <span>Instant access</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            By continuing, you agree to our{" "}
            <Link href="/terms" className="text-primary hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function LoginPageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageLoading />}>
      <LoginPageContent />
    </Suspense>
  );
}
