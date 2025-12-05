# Demo Access Control

> **Domain**: Demo Management
> **Status**: Implemented
> **Last Updated**: 2025-12-05
> **Related Files**:
> - `apps/api/src/modules/demo/demo-access.service.ts`
> - `apps/api/src/modules/demo/demo.controller.ts`

---

## Overview

This document defines the business rules governing who can access demo files and their associated data (rounds, players, events, etc.) in CS2 Analytics.

### Business Context

CS2 Analytics is a multi-persona platform serving players, coaches, scouts, and analysts. Demo files contain sensitive match data that should only be accessible to authorized users. The access control system must balance:

- **Privacy**: Users should not see other users' private data
- **Collaboration**: Team members and match participants need shared access
- **Usability**: Access checks should be transparent and fast

---

## Access Rules

### Rule Matrix

| User Type | Can Access Demo? | Reason |
|-----------|------------------|--------|
| Demo uploader | Yes | Owner rights |
| Match participant | Yes | Played in the match |
| Team member | Yes | Team collaboration |
| Admin | Yes | Platform administration |
| Other authenticated user | No | No authorization |
| Anonymous user | No | Authentication required |

### Detailed Rules

#### 1. Owner Access

```
IF demo.uploadedById == user.id
THEN access = GRANTED (reason: "owner")
```

**Description**: The user who uploaded the demo always has full access to it.

**Rationale**: Uploaders have invested effort in providing the demo and should always be able to manage their content.

#### 2. Participant Access

```
IF user.steamId IN demo.playerStats[].steamId
THEN access = GRANTED (reason: "participant")
```

**Description**: Any user whose Steam ID appears in the match's player statistics can access the demo.

**Rationale**: Players have a legitimate interest in reviewing matches they participated in, regardless of who uploaded the demo.

**Prerequisites**:
- User must have linked their Steam account (`user.steamId` is set)
- Demo must be parsed with player statistics populated

#### 3. Team Member Access

```
IF demo.teamId IS NOT NULL
AND user.id IN demo.team.members[].userId
THEN access = GRANTED (reason: "team_member")
```

**Description**: If a demo is associated with a team, all members of that team can access it.

**Rationale**: Teams need to share demos for analysis, coaching, and improvement purposes.

**Use Cases**:
- Coach reviewing team practice matches
- Analyst preparing opponent reports
- Players studying team strategies

#### 4. Admin Access

```
IF "admin" IN user.roles
THEN access = GRANTED (reason: "admin")
```

**Description**: Users with the admin role can access all demos.

**Rationale**: Platform administrators need unrestricted access for support, moderation, and maintenance purposes.

---

## Implementation Details

### Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     DemoController                          │
│  - Handles HTTP requests                                    │
│  - Injects authenticated user                               │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   DemoAccessService                         │
│  - canAccessDemo(demoId, user) → boolean                   │
│  - assertCanAccessDemo(demoId, user) → throws if denied    │
│  - buildAccessFilter(user) → Prisma WHERE clause           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                      PrismaService                          │
│  - Single optimized query for all access checks            │
└─────────────────────────────────────────────────────────────┘
```

### Access Check Flow

```
1. Request arrives at controller endpoint
2. JWT Guard validates authentication
3. Controller calls assertCanAccessDemo(demoId, user)
4. DemoAccessService queries demo with access-related data
5. Rules are evaluated in order: owner → participant → team → admin
6. If any rule grants access, return success
7. If no rule grants access, throw ForbiddenException
8. Controller proceeds with business logic
```

### Database Query Strategy

Access checks use a single optimized query that fetches only the necessary data:

```typescript
const demo = await prisma.demo.findUnique({
  where: { id: demoId },
  select: {
    uploadedById: true,
    teamId: true,
    playerStats: {
      where: { steamId: user.steamId },
      select: { steamId: true },
      take: 1,
    },
    team: {
      select: {
        members: {
          where: { userId: user.id },
          select: { userId: true },
          take: 1,
        },
      },
    },
  },
});
```

**Performance characteristics**:
- Single database round-trip
- Uses indexed columns (`uploadedById`, `steamId`, `userId`)
- Limits subquery results to minimize data transfer

### List Filtering

When listing demos, the service builds a Prisma `WHERE` clause:

```typescript
{
  OR: [
    { uploadedById: user.id },
    { playerStats: { some: { steamId: user.steamId } } },
    { team: { members: { some: { userId: user.id } } } },
  ]
}
```

This ensures users only see demos they have access to in paginated lists.

---

## Protected Endpoints

All demo-related endpoints require authentication and access checks:

| Endpoint | Method | Access Check |
|----------|--------|--------------|
| `/v1/demos` | GET | Filter by access rules |
| `/v1/demos/:id` | GET | `assertCanAccessDemo` |
| `/v1/demos/:id/status` | GET | `assertCanAccessDemo` |
| `/v1/demos/:id/events` | GET | `assertCanAccessDemo` |
| `/v1/demos/:id/rounds` | GET | `assertCanAccessDemo` |
| `/v1/demos/:id/players` | GET | `assertCanAccessDemo` |
| `/v1/demos/:id/ticks` | GET | `assertCanAccessDemo` |
| `/v1/demos/:id/grenades` | GET | `assertCanAccessDemo` |
| `/v1/demos/:id/chat` | GET | `assertCanAccessDemo` |
| `/v1/demos/:id/parse` | POST | `assertCanAccessDemo` |
| `/v1/demos/:id/retry` | POST | `assertCanAccessDemo` |
| `/v1/demos/:id` | DELETE | Owner only (via `DemoService`) |
| `/v1/demos/upload` | POST | Authenticated (creates ownership) |

---

## Error Responses

### 401 Unauthorized

Returned when the request lacks valid authentication.

```json
{
  "statusCode": 401,
  "message": "Authentication required",
  "error": "Unauthorized"
}
```

### 403 Forbidden

Returned when the user is authenticated but lacks permission.

```json
{
  "statusCode": 403,
  "message": "You do not have permission to access this demo",
  "error": "Forbidden"
}
```

### 404 Not Found

Returned when the demo does not exist. Note: For security, we return 404 (not 403) for non-existent demos to prevent enumeration attacks.

```json
{
  "statusCode": 404,
  "message": "Demo {id} not found",
  "error": "Not Found"
}
```

---

## Future Considerations

### Planned Extensions

1. **Public Demos** (`isPublic` flag)
   - Allow users to mark demos as publicly accessible
   - Useful for educational content, community highlights

2. **Share Links** (token-based access)
   - Generate time-limited URLs for sharing with non-registered users
   - Track share analytics

3. **Organization Access**
   - Enterprise customers with organization-wide demo access
   - Role-based permissions within organizations

4. **Demo Collections**
   - Group demos into shareable collections
   - Inherit access from collection settings

### Extensibility

The `DemoAccessService` is designed for easy extension:

```typescript
// Adding a new access rule
async canAccessDemo(demoId: string, user: AuthenticatedUser | null) {
  // ... existing checks ...

  // New: Public demo access
  if (demo.isPublic) {
    return { hasAccess: true, reason: "public", demoId };
  }

  // New: Share link access
  if (this.hasValidShareToken(demoId, user)) {
    return { hasAccess: true, reason: "share_link", demoId };
  }
}
```

---

## Audit & Compliance

### Logging

Access denials are logged for security monitoring:

```typescript
this.logger.warn(
  `Access denied: user ${user?.id || "anonymous"} to demo ${demoId}`
);
```

### Testing Requirements

- Unit tests for each access rule
- Integration tests for protected endpoints
- E2E tests for complete user flows
- Load tests for access check performance (<50ms p99)

---

## Related Documentation

- [Authentication Flow](../auth/authentication-flow.md) *(planned)*
- [Team Management](./team-management.md) *(planned)*
- [API Reference](../api/demos.md) *(planned)*
