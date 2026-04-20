# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Production-readiness delivery assets: async repository registry, dedicated metrics server, optional OpenTelemetry bootstrap, SQLite→PostgreSQL migration CLI, AES-256-GCM field encryption helper
- Deployment and resilience assets: Redis in `docker-compose`, canary ingress template, rollout promotion logic, chaos manifests, hot-upgrade verification script
- Operations documentation: runbook, hot-upgrade validation guide, cross-region validation guide, capacity planning guide
- Integration scaffolding: PostgreSQL smoke helper/tests and secret-provider integration workflow
- **Task 5**: Memory system enhancement — `kind`/`status` fields, write gate, deduplication (SHA-256 hash), token-based budget (via `TokenEstimator`) replacing count-based `.slice()` in `BuiltinMemoryProvider`
- **Task 5**: `ExperienceCacheService` — TTL eviction (7-day default) and capacity eviction (1000-entry default)
- **Task 5**: `MemoryRetrievalService` — Multi-signal re-ranking (BM25 + recency + importance + access frequency) replacing single-signal BM25
- **Task 5**: `SessionSummaryService` + `session_summaries` table — Session-end summarization with `keyDecisions`, `keyOutcomes`, `memoryIdsReferenced`, `tokenCount`
- **Task 6**: `EffectBuffer` integration into `CommandExecutor` — process spawn wrapped in `EffectScope` with compensation
- **Task 6**: `spawnTracked` production integration — `CommandExecutor` now uses tracked spawn replacing bare `spawn()`
- **Task 6**: `CircuitBreaker` class — per-provider circuit breaker in `UnifiedChatProvider`
- **Task 6**: Dead letter queue — `event_dead_letters` table, `durable-event-bus.ts` failure events written to DLQ after retry exhaustion
- **Task 6**: `ServiceRegistry` teardown dependency ordering — topological sort before `teardownAll()`
- **Task 6**: `session_events` table — Session lifecycle event persistence
- **Task 7**: JWT security hardening — algorithm whitelist (`HS256` only), explicit `none` rejection, token max-age check (24h)
- **Task 7**: `ApprovalTimeoutExecutor` — sweep logic for `timeoutPolicy` (`reject`/`approve`/`remain_pending`)
- **Task 7**: Sandbox regression tests — symlink traversal, config-root escape, double-encoded path, null-byte injection
- **Task 2**: `governance-bootstrap.ts` — unified factory for governance CLI service initialization

### Changed

- API server can now expose a dedicated `/metrics` listener and optional OpenTelemetry export through environment configuration
- CI now includes changelog, PostgreSQL integration, and mutation-testing lanes; deployment workflow now understands canary and blue/green release naming
- **Task 3**: Storage layer type safety — 101 `as unknown as` in `authoritative-task-store-methods-04.ts` through `-13.ts` replaced with `queryAll`/`queryOne`/`queryOneOrThrow`
- **Task 2**: 5 governance CLI files refactored from ~80-line inline service construction to `bootstrapGovernanceServices()` factory call (~50 lines removed per file)
- **Task 2**: CLI output unified from mixed `console.log(JSON.stringify(...))` and `process.stdout.write(...)` to `process.stdout.write(...)`

### Deprecated

- `/tasks`, `/sessions`, `/executions` (unversioned routes) — deprecated in favor of `/v1/` prefixed routes; will be removed in v2

### Removed

- **Task 1**: Duplicate files deleted:
  - `src/core/governance/approval-service.ts` (merged into `src/core/approvals/approval-service.js`)
  - `src/core/governance/audit-export-service.ts` (merged into `src/core/compliance/audit-export-service.js`)
  - `src/core/output/artifact-store.ts` (merged into `src/core/artifacts/artifact-store.js`)
  - `src/core/output/result-envelope.ts` (merged into `src/core/results/result-envelope.js`)
  - `src/core/lifecycle/traffic-routing-service.ts` (merged into `src/core/deployment/traffic-routing-service.js`)
  - `src/core/product/budget-guard.ts` (merged into `src/core/cost/budget-guard.js`)
- Empty directories removed: `src/core/governance/`, `src/core/output/`

### Fixed

- **Task 7**: JWT validation — algorithm whitelist now enforced, `none` algorithm explicitly rejected, max token age checked
- **Task 6**: `DurableEventBus` dead-letter path now persists to `event_dead_letters` table instead of only marking `status: "failed"`
- **Task 3**: `query-helper.ts` functions (`queryAll`, `queryOne`, `queryOneOrThrow`) now actively consumed by store methods

### Security

- Added field-level encryption utility for sensitive at-rest payloads and enabled encrypted RDS storage inputs in Terraform
- **Task 7**: All API secret comparisons replaced with `timingSafeEqual`
- **Task 7**: HTTP body size limit enforced (1MB public API, 512KB webhooks)
- **Task 7**: Webhook signature verification strengthened — secrets read from server config, nonce/timestamp replay protection added
- **Task 7**: `authService` null fallback removed — protected endpoints reject requests when auth service is unavailable
- **Task 7**: SSRF guard — all outbound URLs validated against private network / metadata endpoint / localhost blocklist

---

## [0.1.0] — 2026-04-13

### Added

- Initial tracked documentation release
- Phase 1A and 1B execution paths (`phase1a-happy-path.ts`, `phase1b-orchestration.ts`)
- SQLite WAL-mode storage with 37 schema migrations
- Durable event bus with Tier 1/2/3 delivery semantics
- Command execution security (7-layer shell injection defense, sandbox path validation)
- Multi-provider support (OpenAI, Anthropic, MiniMax)
- Tool execution with parallel runner and output sanitization
- Memory system with FTS5 BM25 retrieval
- Workflow DAG planning and context compaction
- Graceful shutdown and process tracking
- Stable rehearsal framework (chaos, rollback, recovery, upgrade drills)
- Enterprise governance CLI tools
