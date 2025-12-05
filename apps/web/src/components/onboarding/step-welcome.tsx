"use client";

/**
 * Step Welcome - Initial onboarding screen
 *
 * Welcomes the user and introduces CS2 Analytics features.
 *
 * @module components/onboarding/step-welcome
 */

import { useOnboarding } from "@/hooks/use-onboarding";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, Target, Users, Video } from "lucide-react";

// ============================================================================
// Feature data
// ============================================================================

const FEATURES = [
  {
    icon: BarChart3,
    title: "Advanced Analytics",
    description: "Get detailed performance insights with HLTV 2.0 rating",
  },
  {
    icon: Target,
    title: "Personalized Insights",
    description: "Identify your strengths and areas for improvement",
  },
  {
    icon: Users,
    title: "Role-Based Dashboard",
    description: "Tailored views for players, coaches, scouts, and creators",
  },
  {
    icon: Video,
    title: "2D Replay Viewer",
    description: "Analyze rounds with interactive 2D replay visualization",
  },
];

// ============================================================================
// Component
// ============================================================================

export function StepWelcome() {
  const { nextStep, markWelcomeAsSeen } = useOnboarding();

  const handleGetStarted = async () => {
    await markWelcomeAsSeen();
    nextStep();
  };

  return (
    <div className="flex flex-col items-center text-center">
      {/* Hero section */}
      <div className="mb-8">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-3xl font-bold text-primary-foreground">
          CS2
        </div>
        <h1 className="mb-2 text-3xl font-bold tracking-tight">
          Welcome to CS2 Analytics
        </h1>
        <p className="text-lg text-muted-foreground">
          Your personal performance analysis platform for Counter-Strike 2
        </p>
      </div>

      {/* Features grid */}
      <div className="mb-8 grid w-full gap-4 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="flex items-start gap-3 rounded-lg border bg-card p-4 text-left"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <feature.icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">
                {feature.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="flex flex-col items-center gap-4">
        <Button size="lg" onClick={handleGetStarted} className="gap-2">
          Get Started
          <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="text-xs text-muted-foreground">
          Takes about 2 minutes to complete
        </p>
      </div>
    </div>
  );
}
