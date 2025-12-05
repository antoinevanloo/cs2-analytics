# Dashboard Authentication

> **Domain**: Authentication & Authorization
> **Status**: Implemented
> **Last Updated**: 2025-12-05
> **Related Files**:
> - `apps/web/src/components/auth/auth-guard.tsx`
> - `apps/web/src/app/(dashboard)/layout.tsx`
> - `apps/web/src/stores/auth-store.ts`

---

## Overview

The dashboard and all protected routes require user authentication. This document describes the client-side authentication guard that ensures only authenticated users can access the dashboard.

### Business Context

CS2 Analytics contains sensitive user data including match statistics, team information, and demo files. The dashboard must be protected to:

- **Prevent unauthorized access** to user data
- **Ensure data isolation** between users
- **Comply with privacy requirements**

---

## Authentication Flow

### User Journey

```
┌─────────────────────────────────────────────────────────────┐
│                    Unauthenticated User                     │
└─────────────────────┬───────────────────────────────────────┘
                      │ Attempts to access /dashboard
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                      AuthGuard                              │
│  1. Check hydration status                                  │
│  2. Verify tokens in localStorage                           │
│  3. Refresh if expired                                      │
│  4. Redirect if unauthenticated                             │
└─────────────────────┬───────────────────────────────────────┘
                      │ Not authenticated
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Redirect to /login?returnTo=/dashboard         │
└─────────────────────┬───────────────────────────────────────┘
                      │ User logs in via Steam/FACEIT
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    OAuth Callback                           │
│  1. Store tokens in Zustand                                 │
│  2. Read returnTo from sessionStorage                       │
│  3. Redirect to original destination                        │
└─────────────────────┬───────────────────────────────────────┘
                      │ Authenticated
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                      Dashboard                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Access Rules

### Protected Routes

All routes under `/dashboard/*` require authentication:

| Route | Description | Protection |
|-------|-------------|------------|
| `/dashboard` | Main dashboard | AuthGuard |
| `/dashboard/demos` | Demo management | AuthGuard |
| `/dashboard/analysis` | Match analysis | AuthGuard |
| `/dashboard/players` | Player profiles | AuthGuard |
| `/dashboard/settings` | User settings | AuthGuard |

### Public Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/login` | Authentication page |
| `/callback` | OAuth callback handler |
| `/onboarding` | New user onboarding |

---

## AuthGuard Component

### Responsibilities

1. **Hydration Safety**: Wait for client-side hydration before checking auth
2. **Token Validation**: Verify access token exists and is not expired
3. **Auto-Refresh**: Attempt to refresh expired tokens transparently
4. **Redirection**: Send unauthenticated users to login with return URL
5. **Loading State**: Display themed loading screen during verification

### Props

```typescript
interface AuthGuardProps {
  children: React.ReactNode;
  requiredRoles?: string[];        // Optional role requirements
  redirectTo?: string;             // Custom redirect (default: /login)
  showLoadingState?: boolean;      // Show loading UI (default: true)
  loadingComponent?: React.ReactNode; // Custom loading component
  onAuthFailure?: (reason: AuthFailureReason) => void;
}

type AuthFailureReason =
  | "not_authenticated"
  | "token_expired"
  | "insufficient_roles"
  | "validation_failed";
```

### Usage

```tsx
// In dashboard layout
export default function DashboardLayout({ children }) {
  return (
    <AuthGuard>
      <Sidebar />
      <main>{children}</main>
    </AuthGuard>
  );
}

// With role requirements (future)
<AuthGuard requiredRoles={["pro", "team"]}>
  <ProFeatureComponent />
</AuthGuard>
```

---

## Token Management

### Storage Strategy

| Token Type | Storage | Purpose |
|------------|---------|---------|
| Access Token | Zustand (localStorage) | API authorization |
| Refresh Token | HttpOnly Cookie | Secure token refresh |
| Expiration | Zustand (localStorage) | Client-side expiry check |

### Token Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    OAuth Callback                           │
│  - Receives access_token in URL fragment                    │
│  - Refresh token set as HttpOnly cookie by backend          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Auth Store                               │
│  - Stores { accessToken, expiresAt } in localStorage        │
│  - Persists across browser sessions                         │
└─────────────────────┬───────────────────────────────────────┘
                      │ Token expires (1 hour)
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Auto-Refresh                             │
│  - POST /v1/auth/refresh with HttpOnly cookie               │
│  - Receive new access token                                 │
│  - Update store transparently                               │
└─────────────────────┬───────────────────────────────────────┘
                      │ Refresh fails
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Logout                                   │
│  - Clear localStorage                                       │
│  - Redirect to /login                                       │
└─────────────────────────────────────────────────────────────┘
```

### Expiration Buffer

Tokens are considered expired 60 seconds before actual expiration to prevent edge cases:

```typescript
isTokenExpired: () => {
  const { tokens } = get();
  if (!tokens) return true;
  return Date.now() >= tokens.expiresAt - 60000; // 60s buffer
}
```

---

## Return URL Handling

### Flow

1. User visits `/dashboard/analysis/123`
2. AuthGuard redirects to `/login?returnTo=/dashboard/analysis/123`
3. User clicks "Login with Steam"
4. Login page stores `returnTo` in `sessionStorage`
5. User completes OAuth flow
6. Callback page reads `returnTo` from `sessionStorage`
7. User redirected to `/dashboard/analysis/123`

### Security

Return URLs are validated to prevent open redirect attacks:

```typescript
const isValidReturnTo = returnTo &&
  returnTo.startsWith("/") &&     // Must be relative
  !returnTo.startsWith("//") &&   // Not protocol-relative
  !returnTo.includes("://");      // Not absolute URL
```

---

## Loading State

### CS2-Themed Animation

The loading screen displays while verifying authentication:

- Animated crosshair icon with pulse effect
- "Verifying credentials" message
- Progress bar animation
- Gaming-appropriate visual design

### Render States

```
┌─────────────────────────────────────────────────────────────┐
│ State: "idle" or "checking"                                 │
│ Render: Loading screen                                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ State: "unauthenticated"                                    │
│ Render: Nothing (redirect in progress)                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ State: "authenticated"                                      │
│ Render: Children (dashboard content)                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Cross-Tab Synchronization

### Storage Event Listener

AuthGuard listens for changes to auth storage from other tabs:

```typescript
useEffect(() => {
  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === "cs2-auth-storage") {
      verifyAuth(); // Re-verify if auth state changed
    }
  };
  window.addEventListener("storage", handleStorageChange);
  return () => window.removeEventListener("storage", handleStorageChange);
}, [verifyAuth]);
```

### Use Cases

- User logs out in Tab A → Tab B redirects to login
- User logs in in Tab A → Tab B gains access
- Token refresh in Tab A → Tab B uses new token

---

## Error Handling

### Failure Scenarios

| Scenario | Behavior |
|----------|----------|
| No tokens in storage | Redirect to login |
| Token expired, refresh fails | Clear storage, redirect to login |
| Network error during refresh | Keep user logged in, retry on next API call |
| Invalid token format | Clear storage, redirect to login |

### Resilience

- Concurrent refresh requests are deduplicated
- Failed refreshes don't immediately log out (may be temporary network issue)
- Auth state persists across page reloads

---

## Related Documentation

- [Demo Access Control](./demo-access-control.md)
- [OAuth Implementation](../auth/oauth-flow.md) *(planned)*
- [Token Security](../security/token-management.md) *(planned)*
