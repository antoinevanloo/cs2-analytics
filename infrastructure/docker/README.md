# CS2 Analytics - Infrastructure Docker

Configuration Docker pour le déploiement et la scalabilité de CS2 Analytics.

## Architecture de Base

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Web      │────▶│     API     │────▶│   Parser    │
│  (Next.js)  │     │  (NestJS)   │     │  (Python)   │
└─────────────┘     └──────┬──────┘     └─────────────┘
                          │
                    ┌─────▼─────┐
                    │ PgBouncer │
                    └─────┬─────┘
                          │
                    ┌─────▼─────┐
                    │PostgreSQL │
                    └───────────┘
```

## Démarrage Rapide

```bash
# Développement standard
docker compose up -d

# Avec TimescaleDB (pour analytics temps-réel)
docker compose -f docker-compose.yml -f docker-compose.timescale.yml up -d

# Avec Read Replicas (pour haute disponibilité)
docker compose -f docker-compose.yml -f docker-compose.replicas.yml up -d
```

## Options de Scalabilité

### 1. Connection Pooling (PgBouncer)

Activé par défaut. PgBouncer gère les connexions à PostgreSQL pour éviter la saturation.

**Configuration:**

- `MAX_CLIENT_CONN=500` - Connexions clients max
- `DEFAULT_POOL_SIZE=25` - Connexions par pool
- `POOL_MODE=transaction` - Mode transaction (recommandé)

**Fichiers:**

- `config/pgbouncer/userlist.txt` - Utilisateurs autorisés

### 2. TimescaleDB (Données Temporelles)

Optimisé pour les tables événementielles haute fréquence.

```bash
docker compose -f docker-compose.yml -f docker-compose.timescale.yml up -d
```

**Avantages:**

- Partitionnement automatique par temps (hypertables)
- Compression automatique des données anciennes
- Meilleures performances pour requêtes temporelles

**Configuration:**

- `init-scripts/timescale/01-extensions.sql` - Extensions
- `init-scripts/timescale/02-hypertables.sql` - Configuration hypertables

### 3. Read Replicas (Haute Disponibilité)

Pour distribuer la charge de lecture (requêtes analytics).

```bash
docker compose -f docker-compose.yml -f docker-compose.replicas.yml up -d
```

**Architecture:**

```
                     ┌───────────────┐
                     │   HAProxy     │ :5433 (read-only)
                     │  (Load Bal.)  │
                     └───────┬───────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│   Primary     │  │   Replica 1   │  │   Replica 2   │
│   (writes)    │  │   (reads)     │  │   (reads)     │
└───────────────┘  └───────────────┘  └───────────────┘
```

**Connexions:**

- `localhost:5432` - Primary (lectures + écritures)
- `localhost:5433` - Replicas (lectures uniquement, via HAProxy)

**Monitoring:**

- `http://localhost:8404/stats` - Dashboard HAProxy

### 4. Partitionnement PostgreSQL

Pour les très gros volumes de données GameEvent.

```bash
# Exécuter après les migrations Prisma
docker exec -i cs2-postgres psql -U postgres -d cs2analytics \
  -f /docker-entrypoint-initdb.d/02-partitioning.sql
```

**Fonctions disponibles:**

- `create_monthly_partition(table, date)` - Créer une partition mensuelle
- `ensure_future_partitions(table, months)` - Créer partitions futures
- `drop_old_partitions(table, retention_months)` - Supprimer anciennes

## Configuration PostgreSQL

### Développement

Fichier: `config/postgres/postgresql.conf`

- Mémoire modérée (256MB shared_buffers)
- Logs activés pour debug
- WAL configuré pour réplication

### Replica

Fichier: `config/postgres/postgresql-replica.conf`

- Plus de mémoire pour cache de lecture
- Parallélisme agressif pour analytics
- Hot standby activé

## Variables d'Environnement

### API

| Variable                    | Default              | Description                    |
| --------------------------- | -------------------- | ------------------------------ |
| `DATABASE_URL`              | -                    | URL PostgreSQL (via PgBouncer) |
| `PARSER_URL`                | `http://parser:8001` | URL du service parser          |
| `DEMO_STORAGE_PATH`         | `/tmp/demos`         | Stockage local des démos       |
| `ARCHIVAL_ENABLED`          | `true`               | Activer archivage auto         |
| `ARCHIVAL_THRESHOLD_MONTHS` | `6`                  | Seuil d'archivage              |

### Parser

| Variable    | Default | Description                  |
| ----------- | ------- | ---------------------------- |
| `WORKERS`   | `2`     | Nombre de workers de parsing |
| `REDIS_URL` | -       | URL Redis pour la queue      |

## Volumes

| Volume          | Description                 |
| --------------- | --------------------------- |
| `postgres-data` | Données PostgreSQL          |
| `redis-data`    | Données Redis (persistance) |
| `demo-files`    | Fichiers démo partagés      |
| `parser-demos`  | Démos en cours de parsing   |

## Healthchecks

Tous les services ont des healthchecks configurés:

```bash
# Vérifier l'état
docker compose ps

# Logs d'un service
docker compose logs -f api
```

## Production

Pour la production, considérez:

1. **Secrets**: Utiliser Docker secrets ou variables d'environnement sécurisées
2. **SSL**: Configurer SSL pour PostgreSQL et PgBouncer
3. **Backups**: Configurer pg_dump ou réplication vers S3
4. **Monitoring**: Ajouter Prometheus/Grafana pour les métriques
5. **Logs**: Centraliser avec ELK ou Loki

```yaml
# Exemple production avec secrets
services:
  postgres:
    environment:
      - POSTGRES_PASSWORD_FILE=/run/secrets/db_password
    secrets:
      - db_password
```
