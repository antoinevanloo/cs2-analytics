/**
 * Store exports
 *
 * Central export point for all Zustand stores
 *
 * @module stores
 */

export { useDemoStore } from "./demo-store";
export {
  useAuthStore,
  selectUser,
  selectIsAuthenticated,
  selectIsLoading as selectAuthIsLoading,
  selectError as selectAuthError,
  type AuthUser,
  type AuthTokens,
} from "./auth-store";
export {
  usePreferencesStore,
  selectPreferences,
  selectPreferredRole,
  selectIsOnboardingComplete,
  selectOnboardingStep,
  selectTheme,
  selectIsLoading as selectPreferencesIsLoading,
  selectIsSaving,
  ROLE_METADATA,
  type PreferredRole,
  type ProfileVisibility,
  type UserPreferences,
  type DashboardLayout,
  type DashboardWidget,
} from "./preferences-store";
