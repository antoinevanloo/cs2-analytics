# CS2 Analytics

> **La plateforme d'analyse de démos CS2 la plus complète pour progresser, coacher et recruter.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.x-red.svg)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-Proprietary-orange.svg)]()

---

## Vision

CS2 Analytics transforme les démos CS2 en insights actionnables. Notre mission est de démocratiser l'analyse de haut niveau pour tous les joueurs, des amateurs aux professionnels.

**Ce qui nous différencie :**

- **2D Replay Viewer** : Visualisation interactive des rounds avec timeline
- **AI Coaching** : Recommandations personnalisées basées sur vos patterns de jeu
- **HLTV Rating 2.0** : Implémentation exacte du standard de l'industrie
- **Multi-persona** : Adapté aux joueurs solo, coachs, scouts et recruteurs

---

## Table des matières

- [Architecture](#architecture)
- [Stack Technique](#stack-technique)
- [Installation](#installation)
- [Configuration](#configuration)
- [Principes Architecturaux](#principes-architecturaux)
  - [Extensibilité](#extensibilité)
  - [Scalabilité](#scalabilité)
  - [Performance](#performance)
  - [Stabilité](#stabilité)
  - [Résilience](#résilience)
- [Fonctionnalités](#fonctionnalités)
- [API Reference](#api-reference)
- [Roadmap](#roadmap)
- [Analyse Concurrentielle](#analyse-concurrentielle)
- [Contributing](#contributing)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Web App    │  │  Mobile App  │  │   CLI Tool   │  │  Third-party │     │
│  │  (Next.js)   │  │   (Future)   │  │   (Future)   │  │     APIs     │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
└─────────┼──────────────────┼──────────────────┼──────────────────┼───────────┘
          │                  │                  │                  │
          ▼                  ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY / CDN                                  │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  Rate Limiting │ Authentication │ Load Balancing │ SSL Termination │     │
│  └────────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            API LAYER (NestJS)                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │    Demo      │  │   Analysis   │  │    Player    │  │  Aggregation │     │
│  │   Module     │  │    Module    │  │    Module    │  │    Module    │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                 │                 │              │
│  ┌──────┴─────────────────┴─────────────────┴─────────────────┴──────┐      │
│  │                      Common Services                              │      │
│  │  Auth │ Cache │ Prisma │ Queue │ Streaming │ Feature Flags        │      │
│  └───────────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   PostgreSQL    │  │     Redis       │  │   ClickHouse    │
│  (Primary DB)   │  │  (Cache/Queue)  │  │  (Analytics)    │
│   + PgBouncer   │  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BACKGROUND WORKERS                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Demo Parser  │  │  Analysis    │  │ Aggregation  │  │  Cleanup     │     │
│  │  (Python)    │  │  Processor   │  │   Worker     │  │   Worker     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           OBJECT STORAGE                                     │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │                    MinIO / S3 Compatible                           │     │
│  │         Demos │ Thumbnails │ Exports │ Replay Data                 │     │
│  └────────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Flux de données

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│ Upload  │────▶│  Queue  │────▶│  Parse  │────▶│  Store  │────▶│ Analyze │
│  Demo   │     │ (Bull)  │     │(Python) │     │(Prisma) │     │(Workers)│
└─────────┘     └─────────┘     └─────────┘     └─────────┘     └─────────┘
                                                      │
                                                      ▼
                                              ┌─────────────┐
                                              │   Insights  │
                                              │   & Rating  │
                                              └─────────────┘
```

---

## Stack Technique

### Monorepo Structure

```
cs2-analytics/
├── apps/
│   ├── api/                 # NestJS Backend API
│   ├── web/                 # Next.js Frontend
│   └── parser/              # Python Demo Parser
├── packages/
│   ├── db/                  # Prisma Schema & Client
│   ├── ui/                  # Shared UI Components
│   ├── types/               # Shared TypeScript Types
│   └── config/              # Shared Configurations
└── infrastructure/
    ├── docker/              # Docker Compose Files
    ├── kubernetes/          # K8s Manifests (Future)
    └── terraform/           # IaC (Future)
```

### Technologies

| Couche             | Technologies                                                                  |
| ------------------ | ----------------------------------------------------------------------------- |
| **Frontend**       | Next.js 14, React 18, TypeScript, Radix UI, TailwindCSS, React Query, Zustand |
| **Backend**        | NestJS 10, TypeScript, Prisma ORM, BullMQ, Passport JWT                       |
| **Parser**         | Python 3.11, demoparser2, awpy                                                |
| **Databases**      | PostgreSQL 16, Redis 7, ClickHouse (analytics)                                |
| **Infrastructure** | Docker, PgBouncer, MinIO, Nginx                                               |
| **Observability**  | OpenTelemetry, Prometheus, Grafana (planned)                                  |

---

## Installation

### Prérequis

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose
- Python 3.11+ (pour le parser)

### Quick Start

```bash
# Clone le repository
git clone https://github.com/your-org/cs2-analytics.git
cd cs2-analytics

# Install dependencies
pnpm install

# Start infrastructure services
docker compose -f infrastructure/docker/docker-compose.yml up -d

# Setup database
pnpm db:push
pnpm db:generate

# Start development servers
pnpm dev
```

### Services disponibles

| Service    | URL                   | Description        |
| ---------- | --------------------- | ------------------ |
| API        | http://localhost:3001 | Backend NestJS     |
| Web        | http://localhost:3000 | Frontend Next.js   |
| PostgreSQL | localhost:5432        | Base de données    |
| Redis      | localhost:6379        | Cache & Queues     |
| PgBouncer  | localhost:6432        | Connection pooling |
| MinIO      | http://localhost:9001 | Object storage UI  |

---

## Configuration

### Variables d'environnement

```bash
# .env.local

# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cs2analytics"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/cs2analytics"

# Redis
REDIS_URL="redis://localhost:6379"
REDIS_HOST="localhost"
REDIS_PORT=6379

# Auth
JWT_SECRET="your-super-secret-key-change-in-production"
JWT_EXPIRES_IN_SECONDS=86400

# Storage
MINIO_ENDPOINT="localhost"
MINIO_PORT=9000
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
MINIO_BUCKET="cs2-demos"

# Feature Flags
FEATURE_AI_COACHING=false
FEATURE_2D_REPLAY=true
FEATURE_ADVANCED_ANALYTICS=true

# Rate Limiting
THROTTLE_TTL=60000
THROTTLE_LIMIT=100
```

---

## Principes Architecturaux

### Extensibilité

Notre architecture est conçue pour évoluer sans friction :

#### 1. Architecture Modulaire

```typescript
// Chaque module est autonome et injectable
@Module({
  imports: [PrismaModule, RedisModule],
  providers: [AnalysisService, ...calculators],
  exports: [AnalysisService],
})
export class AnalysisModule {}
```

#### 2. Pattern Calculator

Les métriques sont calculées par des calculators indépendants :

```typescript
// Facile d'ajouter de nouvelles métriques
export function calculateRating(input: RatingCalculationInput): HLTVRating2;
export function calculateKAST(input: KASTCalculationInput): KASTMetrics;
export function calculateImpact(input: ImpactCalculationInput): ImpactMetrics;
export function calculateCombatMetrics(
  stats: RoundPlayerStatsInput[],
): CombatMetrics;
```

#### 3. Feature Flags

Activation progressive des fonctionnalités :

```typescript
@Injectable()
export class FeatureFlagService {
  isEnabled(flag: string, context?: UserContext): boolean {
    // Support pour rollout progressif, A/B testing, beta users
  }
}
```

#### 4. Plugin System (Roadmap)

```typescript
// Future: système de plugins pour métriques custom
interface MetricPlugin {
  name: string;
  version: string;
  calculate(data: MatchData): MetricResult;
  visualize?(result: MetricResult): ReactNode;
}
```

#### 5. API Versioning

```typescript
// Support multi-versions pour rétrocompatibilité
@Controller({ version: "1", path: "analysis" })
export class AnalysisV1Controller {}

@Controller({ version: "2", path: "analysis" })
export class AnalysisV2Controller {}
```

---

### Scalabilité

L'architecture supporte une croissance horizontale et verticale :

#### 1. Stateless API

```typescript
// Aucun état en mémoire - scaling horizontal illimité
@Injectable()
export class AnalysisService {
  constructor(
    private prisma: PrismaService,
    private cache: RedisService, // État externalisé
  ) {}
}
```

#### 2. Connection Pooling (PgBouncer)

```yaml
# docker-compose.yml
pgbouncer:
  image: bitnami/pgbouncer:latest
  environment:
    PGBOUNCER_POOL_MODE: transaction
    PGBOUNCER_MAX_CLIENT_CONN: 1000
    PGBOUNCER_DEFAULT_POOL_SIZE: 20
```

#### 3. Queue-Based Processing

```typescript
// BullMQ pour traitement asynchrone distribué
@Processor("demo-processing")
export class DemoProcessor {
  @Process()
  async process(job: Job<DemoJobData>) {
    // Workers parallèles, retry automatique
  }
}
```

#### 4. Time-Series Analytics (ClickHouse)

```sql
-- Requêtes analytiques sur des millions de rounds
CREATE TABLE round_stats (
  timestamp DateTime,
  player_id String,
  rating Float32,
  ...
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (player_id, timestamp);
```

#### 5. Read Replicas

```typescript
// Future: répartition lecture/écriture
@Injectable()
export class PrismaService {
  readonly write: PrismaClient; // Primary
  readonly read: PrismaClient; // Replica
}
```

#### Benchmarks de scalabilité

| Métrique                  | Objectif Phase 1 | Objectif Phase 5 |
| ------------------------- | ---------------- | ---------------- |
| Démos/jour                | 1,000            | 100,000          |
| Utilisateurs concurrents  | 100              | 10,000           |
| Temps parsing (30 rounds) | < 30s            | < 10s            |
| Latence API p99           | < 200ms          | < 100ms          |

---

### Performance

Optimisations à chaque couche :

#### 1. Storage-First Architecture

```typescript
// Calcul une fois, stockage permanent
async function getMatchOverview(demoId: string) {
  // 1. Check stored analysis
  const stored = await prisma.analysis.findUnique({ where: { demoId } });
  if (stored) return stored; // Instant return

  // 2. Lazy computation fallback
  return computeAndStore(demoId);
}
```

#### 2. Multi-Level Caching

```typescript
// L1: In-memory (process)
// L2: Redis (shared)
// L3: Database (persistent)

@Cacheable({ ttl: 300, key: 'player:${steamId}' })
async getPlayerStats(steamId: string) {
  // Cache automatique avec invalidation
}
```

#### 3. Streaming Responses

```typescript
// NDJSON streaming pour datasets volumineux
@Get('analysis/:id/rounds')
async streamRounds(@Param('id') id: string, @Res() res: Response) {
  res.setHeader('Content-Type', 'application/x-ndjson');
  for await (const round of this.getRoundsIterator(id)) {
    res.write(JSON.stringify(round) + '\n');
  }
  res.end();
}
```

#### 4. Query Optimization

```typescript
// Sélection précise des champs
const analysis = await prisma.demo.findUnique({
  where: { id },
  select: {
    id: true,
    matchOverview: true,
    // Pas de chargement des données volumineuses
  },
});
```

#### 5. Compression & CDN

```typescript
// Gzip/Brotli automatique
app.use(compression());

// Assets statiques via CDN
// Replay data pre-cached at edge
```

#### Métriques de performance cibles

| Opération              | Objectif       |
| ---------------------- | -------------- |
| Parse demo (30 rounds) | < 15s          |
| Get match overview     | < 50ms         |
| Get player rating      | < 20ms         |
| Search players         | < 100ms        |
| Load 2D replay frame   | < 16ms (60fps) |

---

### Stabilité

Garantir un service fiable :

#### 1. Type Safety

```typescript
// TypeScript strict avec types partagés
// packages/types/src/analysis.types.ts
export interface HLTVRating2 {
  rating: number;
  components: RatingComponents;
  contributions: RatingContributions;
  benchmarks: RatingBenchmarks;
}
```

#### 2. Validation Runtime

```typescript
// Zod schemas pour validation entrées/sorties
const DemoUploadSchema = z.object({
  file: z.instanceof(File),
  metadata: z
    .object({
      source: z.enum(["faceit", "matchmaking", "custom"]),
      map: z.string().optional(),
    })
    .optional(),
});
```

#### 3. Testing Strategy

```
tests/
├── unit/           # Logique métier isolée
├── integration/    # Modules + DB
├── e2e/            # Flux complets
└── load/           # Performance (k6)
```

```typescript
// Couverture minimale requise
describe("RatingCalculator", () => {
  it("should calculate HLTV 2.0 rating correctly", () => {
    const result = calculateRating(mockInput);
    expect(result.rating).toBeCloseTo(1.15, 2);
  });
});
```

#### 4. Database Migrations

```bash
# Migrations versionnées et réversibles
pnpm prisma migrate dev --name add_analysis_table
pnpm prisma migrate deploy  # Production
```

#### 5. Health Checks

```typescript
@Controller("health")
export class HealthController {
  @Get()
  check() {
    return {
      status: "ok",
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
      queue: await this.checkQueue(),
    };
  }
}
```

---

### Résilience

Survivre aux pannes :

#### 1. Circuit Breaker

```typescript
@Injectable()
export class ResilientService {
  private circuitBreaker = new CircuitBreaker({
    timeout: 5000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
  });

  async callExternalService() {
    return this.circuitBreaker.fire(() => externalCall());
  }
}
```

#### 2. Retry avec Backoff Exponentiel

```typescript
// BullMQ retry automatique
@Process()
async processDemo(job: Job) {
  // Retry: 1s, 2s, 4s, 8s, 16s...
}

// Configuration
{
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
}
```

#### 3. Graceful Degradation

```typescript
async getAnalysis(demoId: string) {
  try {
    // Try full analysis
    return await this.fullAnalysis(demoId);
  } catch (error) {
    // Fallback to basic stats
    return await this.basicStats(demoId);
  }
}
```

#### 4. Dead Letter Queue

```typescript
// Jobs échoués pour analyse manuelle
@OnQueueFailed()
async handleFailed(job: Job, error: Error) {
  await this.dlq.add('failed-demo', {
    jobId: job.id,
    error: error.message,
    data: job.data,
  });
}
```

#### 5. Idempotency

```typescript
// Opérations répétables sans effet de bord
async processDemo(demoId: string) {
  // Check if already processed
  const existing = await prisma.analysis.findUnique({
    where: { demoId },
  });
  if (existing) return existing; // Idempotent

  return this.compute(demoId);
}
```

#### 6. Timeouts & Bulkheads

```typescript
// Isolation des ressources
const pools = {
  parsing: new Pool({ max: 5 }),
  analysis: new Pool({ max: 10 }),
  export: new Pool({ max: 3 }),
};
```

---

## Fonctionnalités

### Phase 0 - Foundation (Actuel)

- [x] Upload et parsing de démos
- [x] Calcul HLTV Rating 2.0
- [x] Statistiques de base (KDA, ADR, HS%)
- [x] API REST documentée
- [x] Authentification JWT

### Phase 1 - Core Analytics

- [ ] Dashboard joueur complet
- [ ] Analyse des ouvertures (duels)
- [ ] Clutches et impact
- [ ] Comparaison multi-joueurs

### Phase 2 - Advanced Insights

- [ ] 2D Replay Viewer interactif
- [ ] Heatmaps de positions
- [ ] Analyse des grenades
- [ ] Timeline de round

### Phase 3 - AI Coaching

- [ ] Détection de patterns
- [ ] Recommandations personnalisées
- [ ] Identification des faiblesses
- [ ] Plans d'amélioration

### Phase 4 - Team & Coaching

- [ ] Gestion d'équipes
- [ ] Dashboard coach
- [ ] Analyse tactique
- [ ] Préparation adversaire

### Phase 5 - Platform

- [ ] Marketplace de coaching
- [ ] API publique
- [ ] Intégrations tierces
- [ ] Mobile app

---

## API Reference

### Authentication

```bash
# Login
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "..."
}

# Response
{
  "access_token": "eyJhbG...",
  "user": { "id": "...", "email": "..." }
}
```

### Demos

```bash
# Upload demo
POST /api/demos
Content-Type: multipart/form-data
file: <demo.dem>

# Get demo status
GET /api/demos/:id

# Get demo analysis
GET /api/demos/:id/analysis
```

### Analysis

```bash
# Match overview
GET /api/analysis/:demoId/overview

# Player rating
GET /api/analysis/:demoId/players/:steamId/rating

# Opening duels
GET /api/analysis/:demoId/openings

# Clutches
GET /api/analysis/:demoId/clutches
```

### Players

```bash
# Player profile
GET /api/players/:steamId

# Player stats
GET /api/players/:steamId/stats?period=30d

# Player matches
GET /api/players/:steamId/matches
```

---

## Analyse Concurrentielle

| Fonctionnalité  | CS2 Analytics | Leetify  | SCOPE.GG | Noesis |
| --------------- | ------------- | -------- | -------- | ------ |
| HLTV Rating 2.0 | ✅            | ✅       | ✅       | ✅     |
| 2D Replay       | ✅ (Roadmap)  | ❌       | ❌       | ✅     |
| AI Coaching     | ✅ (Roadmap)  | ✅       | ❌       | ❌     |
| Open API        | ✅ (Roadmap)  | ❌       | ❌       | ❌     |
| Self-hosted     | ✅            | ❌       | ❌       | ❌     |
| Custom metrics  | ✅ (Plugins)  | ❌       | ❌       | ❌     |
| Team management | ✅ (Roadmap)  | ✅       | ✅       | ❌     |
| Prix            | Freemium      | $4.99/mo | $7.99/mo | Free   |

### Notre différenciation

1. **2D Replay Viewer** : Seul à offrir une visualisation interactive complète
2. **AI Coaching personnalisé** : Recommandations basées sur votre profil unique
3. **Extensibilité** : API ouverte et système de plugins
4. **Self-hosted option** : Pour équipes pro et organisations
5. **Multi-persona** : Interface adaptée à chaque type d'utilisateur

---

## Roadmap

Voir [ROADMAP.md](./ROADMAP.md) pour le détail complet.

```
Q1 2025: Phase 1 - Core Analytics
Q2 2025: Phase 2 - Advanced Insights + 2D Replay
Q3 2025: Phase 3 - AI Coaching
Q4 2025: Phase 4 - Team Features
2026:    Phase 5 - Platform & Marketplace
```

---

## Contributing

### Development Setup

```bash
# Fork & clone
git clone https://github.com/your-username/cs2-analytics.git

# Install
pnpm install

# Create branch
git checkout -b feature/your-feature

# Develop
pnpm dev

# Test
pnpm test

# Lint
pnpm lint

# Commit
git commit -m "feat: add your feature"

# Push & PR
git push origin feature/your-feature
```

### Code Style

- TypeScript strict mode
- ESLint + Prettier
- Conventional commits
- 80%+ test coverage pour nouveau code

### Architecture Decisions

Les décisions architecturales sont documentées dans `docs/adr/`.

---

## License

Proprietary - All rights reserved.

---

## Support

- **Documentation** : [docs.cs2analytics.com](https://docs.cs2analytics.com)
- **Issues** : [GitHub Issues](https://github.com/your-org/cs2-analytics/issues)
- **Discord** : [Join our community](https://discord.gg/cs2analytics)
- **Email** : support@cs2analytics.com

---

<p align="center">
  <strong>Built with passion for the CS2 community</strong>
</p>
