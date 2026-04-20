# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Automatic Agent Platform — a multi-layered task execution platform built on SQLite, with durable event sourcing, lease-based worker coordination, and a stability rehearsal framework. Currently in Phase 1A/1B implementation.

## Build & Test Commands

```bash
npm run build          # TypeScript compilation (tsc)
npm run typecheck      # Type-check without emitting
npm test               # Build + run all tests (unit, integration, golden)
npm run test:unit      # Unit tests only
npm run test:integration  # Integration tests only
npm run test:golden    # Golden path tests only

# Run a single test file (must build first):
npm run build && node --test dist/tests/unit/runtime/transition-service.test.js

# CLI commands (all auto-build before running):
npm run doctor         # Health diagnostics
npm run inspect        # Entity inspection (set AA_INSPECT_KIND, AA_TASK_ID, etc.)
```

Tests use Node's built-in test runner (`node --test`), not Jest or Vitest. Test concurrency is set to 12.

## Architecture

### Layering

```
CLI (src/cli/)  →  Runtime Services (src/core/runtime/)  →  Domain Types (src/core/types/)
                                                          →  Storage (src/core/storage/sqlite/)
                                                          →  Event Bus (src/core/events/)
```

### Execution Model

- **Task** → user-level work unit with a terminal lifecycle (queued → pending → in_progress → done/failed/cancelled)
- **Workflow** → multi-step execution plan attached 1:1 to a task
- **Execution** → individual attempt to run work (many:1 to task), with fencing tokens, leases, and approval gates
- **Phase 1A** (`phase1a-happy-path.ts`): single-step task execution
- **Phase 1B** (`phase1b-orchestration.ts`): multi-step orchestration with DAG planning, context compaction, and streaming

### State Machine

All status transitions are enforced through `TransitionService` (`src/core/runtime/transition-service.ts`). Every transition requires an audit context with `reasonCode`, `traceId`, `actorType`, and `occurredAt`.

### Storage

SQLite with WAL mode, ~49 tables. Schema defined in `src/core/storage/sql/phase1a-schema.ts`. Data access through `Phase1aStore` (`src/core/storage/sqlite/phase1a-store.ts`). Migrations run via `SqliteDatabase.migrate()` with checksum validation.

### Event System

`DurableEventBus` (`src/core/events/durable-event-bus.ts`) with three tiers:
- **Tier 1:** Reliable delivery with consumer acks (required)
- **Tier 2:** At-least-once delivery, ack optional
- **Tier 3:** Best-effort (e.g., SSE stream chunks)

### Tool Execution Security

`CommandExecutor` enforces multi-layer security: command assessment (blocks shell metacharacters, injection patterns), sandbox path validation, process lifecycle management, and output sanitization (secret redaction, 6000-char limit).

### Stability / Release Testing

`stable-release-gate.ts` defines promotion criteria (contract_frozen → canary → tenant_gray → production_ready). Rehearsal tests (`src/core/testing/stable-*.ts`) cover chaos drills, lease fencing, backup/restore, gray rollout, rolling upgrades, and maintenance drains. CLI commands: `npm run chaos:stable`, `npm run rollback:stable`, etc.

## Key Conventions

- **IDs:** Generated via `newId(prefix)` → `{prefix}_{uuid}` (e.g., `task_abc123`, `exec_def456`)
- **Timestamps:** Always ISO 8601 via `nowIso()`
- **Error codes:** `{domain}.{error_type}:{context}` (e.g., `task.invalid_transition:in_progress->queued`)
- **DB columns** use snake_case; **TypeScript interfaces** use camelCase
- **CLI pattern:** All CLI commands resolve DB path from `AA_DB_PATH` env var (default: `data/sqlite/phase1a-demo.db`), init DB + migrate, run service, print JSON, close
- **Config files** live in `config/` (runtime, security, bootstrap, providers, workflows, gateways)
- **ESM modules:** The project uses `"type": "module"` with NodeNext module resolution. All imports require `.js` extensions.
- **No external runtime deps:** Only devDependencies (TypeScript, @types/node). Everything is built on Node.js standard library + SQLite.
