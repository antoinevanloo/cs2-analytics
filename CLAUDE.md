# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CS2 Analytics is a SaaS platform for analyzing Counter-Strike 2 demo files. It's a TypeScript/Python monorepo using pnpm workspaces and Turbo for build orchestration.

## Common Commands

```bash
# Install dependencies
pnpm install

# Start all dev servers (API + Web + Parser)
pnpm dev

# Start individual services
pnpm api:dev      # NestJS API on port 3001
pnpm web:dev      # Next.js frontend on port 3000
pnpm parser:dev   # Python FastAPI parser on port 8001

# Build
pnpm build

# Type checking
pnpm typecheck

# Linting and formatting
pnpm lint
pnpm format

# Testing
pnpm test              # All tests
pnpm test:unit         # Unit tests only
pnpm test:integration  # Integration tests
pnpm test:e2e          # End-to-end tests
pnpm test:cov          # With coverage

# Database (Prisma)
pnpm db:generate       # Generate Prisma client
pnpm db:push           # Push schema to DB (dev)
pnpm db:migrate        # Create and run migrations

# Infrastructure
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

## Architecture

```
cs2-analytics/
├── apps/
│   ├── api/           # NestJS 10 + Fastify backend
│   ├── web/           # Next.js 14 + React 18 frontend
│   └── parser/        # Python 3.11+ FastAPI demo parser (demoparser2)
├── packages/
│   ├── db/            # Prisma schema + client (PostgreSQL 16)
│   └── types/         # Shared TypeScript types + Zod schemas
└── infrastructure/
    └── docker/        # Docker Compose configs
```

### API Module Structure (apps/api/src/modules/)
Each domain module follows NestJS conventions with service/controller separation:
- `demo/` - Demo upload, parsing orchestration
- `player/` - Player profiles and stats
- `analysis/` - Rating calculations (HLTV 2.0), metrics
- `replay/` - 2D Replay viewer data
- `auth/` - JWT + Steam OpenID authentication
- `aggregation/` - Time-series data aggregation

### Shared Services (apps/api/src/common/)
- `prisma/` - Database service
- `redis/` - Caching service
- `queue/` - BullMQ job queue (Redis-backed)
- `resilience/` - Circuit breakers, retry logic

### Frontend Structure (apps/web/src/)
- `app/` - Next.js App Router pages
- `components/` - React components (feature-organized)
- `stores/` - Zustand state management
- `hooks/` - Custom React hooks

## Key Technologies

**Backend**: NestJS 10, Fastify, Prisma 5, BullMQ, Passport (JWT + Steam)
**Frontend**: Next.js 14, React 18, Radix UI, TailwindCSS, Zustand, React Query, Konva.js
**Parser**: FastAPI, demoparser2, uvicorn
**Infrastructure**: PostgreSQL 16, Redis 7, PgBouncer, MinIO (S3)

## Database

Schema location: `packages/db/prisma/schema.prisma`

Key models: User, Demo, Analysis, Round, Player

Always run `pnpm db:generate` after schema changes.

## Testing

API tests use Jest with ts-jest. Test files follow patterns:
- `*.spec.ts` - Unit tests
- `*.integration.spec.ts` - Integration tests

Parser tests use pytest with pytest-asyncio.

## Code Style

- TypeScript strict mode enabled
- Conventional commits: `feat(scope): description`
- ESLint + Prettier enforced
- Python: ruff + black + mypy (strict)

## Architecture Principles

The codebase follows these patterns:
- **Storage-First**: Compute metrics once, store permanently
- **Multi-Level Caching**: Memory → Redis → Database
- **Queue-Based Processing**: BullMQ for async demo parsing
- **Circuit Breaker**: Resilience patterns for external calls
- **API Versioning**: URI-based (v1, v2) for backward compatibility

## Product Context

**Personas**:
- **Joueur**: Progression personnelle, feedback rapide, dopamine loops
- **Coach**: Analyse tactique, comparaisons d'équipe, préparation adversaire
- **Analyste**: Données exhaustives, exports, détection de patterns
- **Recruteur**: Profils joueurs, benchmarks, historique de performance

**UX Goals**:
- Feedback immédiat sur chaque action
- Parcours utilisateur clair (l'utilisateur sait toujours quoi faire après)
- Animations purposeful (une seule animation par action, avec un objectif clair)
- Gamification subtile (progression visible, achievements)

**Performance Targets**:
- Demo parsing: <15s (30 rounds)
- API responses: <50ms (cached), <200ms (computed)
- 2D Replay: <16ms/frame (60fps)
- Search: <100ms

**Key Differentiators** (vs Leetify, SCOPE.GG, Noesis):
- 2D Replay Viewer interactif
- AI Coaching personnalisé
- API ouverte + système de plugins
- Option self-hosted pour équipes pro
