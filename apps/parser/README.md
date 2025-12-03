# CS2 Demo Parser

Exhaustive CS2 demo parsing microservice using demoparser2.

## Features

- **Complete data extraction**: All 60+ player properties tick-by-tick
- **All game events**: 40+ event types including kills, bomb events, grenades
- **Streaming output**: NDJSON format for efficient processing
- **REST API**: FastAPI-based service with async support
- **Queue support**: Redis/BullMQ integration for background processing

## Quick Start

```bash
# Install dependencies
pip install uv
uv venv
source .venv/bin/activate
uv pip install -e ".[dev]"

# Run the service
python -m src.api
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/info` | Parser capabilities |
| POST | `/parse/upload` | Upload and parse demo |
| POST | `/parse/path` | Parse from local path |
| POST | `/parse/sync` | Synchronous parsing |
| POST | `/parse/stream` | Streaming output |
| GET | `/parse/status/{job_id}` | Get job status |
| POST | `/extract/events` | Extract events only |
| POST | `/extract/metadata` | Extract metadata only |

## Available Data

### Player Properties (60+)

- Position: X, Y, Z, pitch, yaw, velocity
- Health: health, armor, is_alive, has_helmet
- Weapons: active_weapon_*, inventory
- Economy: balance, equipment_value, cash_spent
- Combat: kills, deaths, assists, damage
- State: is_scoped, ducking, flash_alpha

### Game Events (40+)

- Combat: player_death, player_hurt, weapon_fire
- Bomb: bomb_planted, bomb_defused, bomb_exploded
- Grenades: smokegrenade_detonate, flashbang_detonate, etc.
- Round: round_start, round_end, round_mvp
- Economy: cs_win_panel_round

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Server host |
| `PORT` | `8001` | Server port |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `STORAGE_TYPE` | `local` | Storage backend |
| `LOG_LEVEL` | `INFO` | Logging level |

## Docker

```bash
# Development
docker build --target development -t cs2-parser:dev .
docker run -p 8001:8001 cs2-parser:dev

# Production
docker build --target production -t cs2-parser:prod .
docker run -p 8001:8001 cs2-parser:prod
```

## Output Format

NDJSON streaming format:

```json
{"type": "metadata", "data": {...}}
{"type": "players", "data": [...]}
{"type": "rounds", "data": [...]}
{"type": "events", "batch_index": 0, "data": [...]}
{"type": "ticks", "batch_index": 0, "data": [...]}
{"type": "grenades", "data": [...]}
```
