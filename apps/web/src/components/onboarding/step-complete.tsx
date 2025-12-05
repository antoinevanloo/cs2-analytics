"use client";

/**
 * Step Complete - Final onboarding screen
 *
 * Celebrates completion and redirects to dashboard.
 *
 * @module components/onboarding/step-complete
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, Sparkles } from "lucide-react";

// ============================================================================
// Component
// ============================================================================

export function StepComplete() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

  // Auto-redirect countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push("/dashboard");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  const handleGoToDashboard = () => {
    router.push("/dashboard");
  };

  return (
    <div className="flex flex-col items-center py-8 text-center">
      {/* Success animation */}
      <div className="relative mb-6">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-500/20">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500">
            <Check className="h-8 w-8 text-white" strokeWidth={3} />
          </div>
        </div>
        <Sparkles className="absolute -right-2 -top-2 h-6 w-6 text-yellow-500" />
        <Sparkles className="absolute -left-3 bottom-0 h-5 w-5 text-yellow-500" />
      </div>

      {/* Title */}
      <h2 className="mb-2 text-3xl font-bold">You're All Set!</h2>
      <p className="mb-8 text-lg text-muted-foreground">
        Welcome to CS2 Analytics. Your personalized dashboard is ready.
      </p>

      {/* Quick summary */}
      <div className="mb-8 w-full max-w-sm rounded-lg border bg-card p-4 text-left">
        <h3 className="mb-3 text-sm font-medium">Setup Complete:</h3>
        <ul className="space-y-2">
          <li className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-green-500" />
            Account connected
          </li>
          <li className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-green-500" />
            Role preference saved
          </li>
          <li className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-green-500" />
            Matches imported
          </li>
          <li className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-green-500" />
            First insight generated
          </li>
        </ul>
      </div>

      {/* CTA */}
      <Button size="lg" onClick={handleGoToDashboard} className="gap-2">
        Go to Dashboard
        <ArrowRight className="h-4 w-4" />
      </Button>

      {/* Auto-redirect notice */}
      <p className="mt-4 text-sm text-muted-foreground">
        Redirecting in {countdown} seconds...
      </p>
    </div>
  );
}
