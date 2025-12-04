/**
 * Dashboard exports
 *
 * Central export point for all dashboard components
 *
 * @module components/dashboard
 */

// Main components
export { DashboardRouter } from "./dashboard-router";
export { DashboardSwitcher, CompactRoleSwitcher } from "./dashboard-switcher";

// Role-specific dashboards
export { PlayerDashboard } from "./player";
export { CoachDashboard } from "./coach";
export { ScoutDashboard } from "./scout";
