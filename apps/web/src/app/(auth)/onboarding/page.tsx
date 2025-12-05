/**
 * Onboarding Page
 *
 * Entry point for the onboarding flow. This page is only accessible
 * to authenticated users who haven't completed onboarding yet.
 *
 * @module app/(auth)/onboarding/page
 */

import { OnboardingFlow } from "@/components/onboarding";

export const metadata = {
  title: "Welcome | CS2 Analytics",
  description: "Complete your setup to start analyzing your CS2 performance",
};

export default function OnboardingPage() {
  return <OnboardingFlow />;
}
