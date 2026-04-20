# Automatic Agent Platform

Enterprise automatic agent platform baseline built on Node.js 22 + TypeScript ESM. This repository migrates the full `automatic_agent_system` implementation into the new platform workspace and preserves the new v2.7 seven-layer architecture and migration guidance as the governing design source.

## Quick Start

```bash
# Install
npm ci

# Build
npm run build

# Run tests
npm test

# Start API server
npm run api

# Run diagnostics
npm run doctor
```

## Configuration

Copy `.env.example` to `.env` and set required variables:

- `AA_DB_PATH` — SQLite database path (default: `data/sqlite/phase1a-demo.db`)
- `AA_API_JWT_SECRET` — JWT secret for API authentication
- At least one LLM provider key: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `MINIMAX_API_KEY`

## Documentation

- Chinese docs: `docs_zh/`
- English docs: `docs_en/`
- Platform architecture design: `docs_zh/automatic_agent_patform_arthitecture_design.md`
- Migration guideline: `docs_zh/migrate_guideline.md`
- Migration scope: `docs_zh/migration_scope.md`
- Contracts and engineering boundaries: `docs_zh/contracts/`
- Operations guides: `docs_zh/operations/`
- API reference: `GET /v1/openapi.json` when the API server is running

## Docker

```bash
# Build image
docker build -t automatic-agent-platform .

# Run with docker-compose
docker-compose up --build
```

Health check: `http://localhost:3000/healthz`

## Project Structure

```
src/
  cli/          — 75 CLI entrypoints
  core/
    runtime/    — Task dispatch, execution, leases, HA coordinator
    storage/    — SQLite/PostgreSQL repositories and data access
    events/     — Durable event bus (3-tier)
    observability/ — Health, metrics, Prometheus export
    security/   — Sandbox, secrets, policy, audit
    cache/      — Multi-level cache (L1/L2/L3)
    locking/    — Distributed locking (SQLite, PostgreSQL, Redis)
    api/        — HTTP REST API with OpenAPI 3.1
  gateway/      — Channel gateway and SSE stream bridge
  plugins/      — Built-in domain plugins and SPI adapters
config/         — Multi-environment configuration
tests/          — Unit, integration, golden, and performance tests
```

## Platform-Specific Extensions

The migrated system code is now paired with platform-only extension points that did not exist in the old repository:

- `src/core/nl-entry/` — natural-language task intake boundary
- `src/core/goal-decomposition/` — goal graph and decomposition contracts
- `src/core/proactive-agent/` — proactive wakeup and trigger contracts
- `src/core/autonomy/` — progressive autonomy contracts
- `src/core/dashboard/` — dashboard aggregation contracts
- `src/gateway/user-portal/` — non-technical user portal boundary

## CLI Commands

```bash
npm run doctor           # Health diagnostics
npm run inspect          # Entity inspection (set AA_INSPECT_KIND, AA_TASK_ID)
npm run api              # Start HTTP API server
npm run channel-gateway  # Start channel gateway
npm run chaos:stable     # Run chaos stability drills
npm run lease:stable      # Run lease rehearsal drills
npm run validate:stable   # Run full validation suite
```

## License

MIT
# automatic-agent-platform
