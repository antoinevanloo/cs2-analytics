"use client";

/**
 * Step Connect - Account linking step
 *
 * Allows users to connect their Steam and FACEIT accounts.
 *
 * @module components/onboarding/step-connect
 */

import { useState } from "react";
import { useOnboarding } from "@/hooks/use-onboarding";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowRight, Check, ExternalLink, Loader2 } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface AccountProvider {
  id: "steam" | "faceit";
  name: string;
  description: string;
  icon: string;
  benefits: string[];
  required: boolean;
}

// ============================================================================
// Data
// ============================================================================

const PROVIDERS: AccountProvider[] = [
  {
    id: "steam",
    name: "Steam",
    description: "Connect your Steam account to import your match history",
    icon: "/icons/steam.svg",
    benefits: [
      "Import official matchmaking demos",
      "Link your Steam profile",
      "Track your CS2 inventory",
    ],
    required: true,
  },
  {
    id: "faceit",
    name: "FACEIT",
    description: "Connect FACEIT to auto-import competitive matches",
    icon: "/icons/faceit.svg",
    benefits: [
      "Auto-import FACEIT matches",
      "Access FACEIT Elo history",
      "Premium queue demos",
    ],
    required: false,
  },
];

// ============================================================================
// Component
// ============================================================================

export function StepConnect() {
  const { connectedAccounts, nextStep } = useOnboarding();
  const [connectingProvider, setConnectingProvider] = useState<string | null>(
    null,
  );

  const handleConnect = async (provider: "steam" | "faceit") => {
    setConnectingProvider(provider);

    // Redirect to OAuth flow
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    window.location.href = `${apiUrl}/auth/${provider}?redirect=/onboarding`;
  };

  const canProceed = connectedAccounts.steam; // Steam is required

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="mb-6 text-center">
        <h2 className="mb-2 text-2xl font-bold">Connect Your Accounts</h2>
        <p className="text-muted-foreground">
          Link your gaming accounts to unlock all features
        </p>
      </div>

      {/* Provider cards */}
      <div className="mb-8 space-y-4">
        {PROVIDERS.map((provider) => {
          const isConnected = connectedAccounts[provider.id];
          const isConnecting = connectingProvider === provider.id;

          return (
            <div
              key={provider.id}
              className={cn(
                "rounded-lg border-2 p-4 transition-colors",
                isConnected
                  ? "border-green-500/50 bg-green-500/5"
                  : "border-border bg-card hover:border-primary/50",
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  {/* Icon placeholder */}
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <span className="text-xl font-bold">
                      {provider.name[0]}
                    </span>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{provider.name}</h3>
                      {provider.required && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          Required
                        </span>
                      )}
                      {isConnected && (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <Check className="h-3 w-3" />
                          Connected
                        </span>
                      )}
                    </div>
                    <p className="mb-2 text-sm text-muted-foreground">
                      {provider.description}
                    </p>

                    {/* Benefits */}
                    <ul className="space-y-1">
                      {provider.benefits.map((benefit) => (
                        <li
                          key={benefit}
                          className="flex items-center gap-2 text-xs text-muted-foreground"
                        >
                          <Check className="h-3 w-3 text-primary" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Connect button */}
                <Button
                  variant={isConnected ? "outline" : "default"}
                  size="sm"
                  disabled={isConnected || isConnecting}
                  onClick={() => handleConnect(provider.id)}
                  className="shrink-0"
                >
                  {isConnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isConnected ? (
                    <>
                      <Check className="mr-1 h-4 w-4" />
                      Connected
                    </>
                  ) : (
                    <>
                      Connect
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info notice */}
      <div className="mb-6 rounded-lg bg-muted/50 p-4 text-center text-sm text-muted-foreground">
        <p>
          We only access public profile data. Your password is never shared.
        </p>
      </div>

      {/* Navigation */}
      <div className="flex justify-end">
        <Button onClick={nextStep} disabled={!canProceed} className="gap-2">
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
