"use client";

/**
 * Step Role - Role selection step
 *
 * Allows users to choose their preferred role/persona.
 *
 * @module components/onboarding/step-role
 */

import { useState } from "react";
import { useOnboarding } from "@/hooks/use-onboarding";
import { ROLE_METADATA, type PreferredRole } from "@/stores/preferences-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  User,
  Users,
  Search,
  BarChart,
  Video,
  Loader2,
} from "lucide-react";

// ============================================================================
// Icon mapping
// ============================================================================

const ROLE_ICONS: Record<
  PreferredRole,
  React.ComponentType<{ className?: string }>
> = {
  PLAYER: User,
  COACH: Users,
  SCOUT: Search,
  ANALYST: BarChart,
  CREATOR: Video,
};

// ============================================================================
// Component
// ============================================================================

export function StepRole() {
  const { selectRole, nextStep, status } = useOnboarding();
  const [selectedRole, setSelectedRole] = useState<PreferredRole | null>(
    (status?.selectedRole as PreferredRole) ?? null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const roles = Object.entries(ROLE_METADATA) as [
    PreferredRole,
    (typeof ROLE_METADATA)[PreferredRole],
  ][];

  const handleContinue = async () => {
    if (!selectedRole) return;

    setIsSubmitting(true);
    try {
      await selectRole(selectedRole, ROLE_METADATA[selectedRole].focusAreas);
      nextStep();
    } catch (error) {
      console.error("Failed to select role:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="mb-6 text-center">
        <h2 className="mb-2 text-2xl font-bold">
          How do you use CS2 Analytics?
        </h2>
        <p className="text-muted-foreground">
          Choose your primary role to customize your experience
        </p>
      </div>

      {/* Role cards */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map(([role, metadata]) => {
          const Icon = ROLE_ICONS[role];
          const isSelected = selectedRole === role;

          return (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={cn(
                "flex flex-col items-center rounded-lg border-2 p-4 text-center transition-all",
                isSelected
                  ? "border-primary bg-primary/5 ring-2 ring-primary ring-offset-2"
                  : "border-border bg-card hover:border-primary/50",
              )}
            >
              <div
                className={cn(
                  "mb-3 flex h-12 w-12 items-center justify-center rounded-full",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted",
                )}
              >
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mb-1 font-semibold">{metadata.label}</h3>
              <p className="text-xs text-muted-foreground">
                {metadata.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Selected role details */}
      {selectedRole && (
        <div className="mb-6 rounded-lg bg-muted/50 p-4">
          <h4 className="mb-2 text-sm font-medium">
            As a {ROLE_METADATA[selectedRole].label}, you'll focus on:
          </h4>
          <div className="flex flex-wrap gap-2">
            {ROLE_METADATA[selectedRole].focusAreas.map((area) => (
              <span
                key={area}
                className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
              >
                {area}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-end">
        <Button
          onClick={handleContinue}
          disabled={!selectedRole || isSubmitting}
          className="gap-2"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Continue
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
