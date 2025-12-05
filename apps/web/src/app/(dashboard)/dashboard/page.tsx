"use client";

/**
 * Dashboard Page
 *
 * Main dashboard with role-based personalized views.
 * Displays different content based on user's selected role.
 *
 * @module app/(dashboard)/dashboard/page
 */

import { DashboardRouter } from "@/components/dashboard/dashboard-router";

export default function DashboardPage() {
  return <DashboardRouter />;
}
