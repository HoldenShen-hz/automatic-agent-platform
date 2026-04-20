# Automatic Agent System - Code Architecture Analysis and Refactoring Baseline Document

> **Analysis Date**: 2026-04-13 (Version 5, full rescan + completed items removed + data refresh)
> **Analysis Scope**: src/ (572 files, 145,230 lines), tests/ (584 files, 116,139 lines), config/, divisions/, root directory configuration
> **Analysis Method**: Directory-by-directory static analysis + dependency tracking + test coverage mapping + pattern recognition
> **Document Purpose**: Source code status, call chains, technical debt, refactoring basis; does not directly represent production readiness
> **Document Nature**: Internal audit document, not production readiness proof. This document records the actual state of the codebase and technical debt, serving as the factual baseline for subsequent refactoring tasks.

---

## Table of Contents

1. [Repository Overview and Key Metrics](#1-repository-overview-and-key-metrics)

   * 1.4 [Criteria: Two-Dimensional Status System](#14-criteria-two-dimensional-status-system)
   * 1.5 [Architecture Blockers](#15-architecture-blockers)
2. [Module Inventory and Status Matrix (Two-Dimensional)](#2-module-inventory-and-status-matrix)
3. [Module-by-Module Deep Analysis](#3-module-by-module-deep-analysis)
4. [Core Call Chain Analysis (with function names + file locations)](#4-core-call-chain-analysis)
5. [Module Dependency and Boundary Analysis](#5-module-dependency-and-boundary-analysis)
6. [Code Quality Issues](#6-code-quality-issues)
7. [Security and Reliability Analysis](#7-security-and-reliability-analysis)
8. [Testing Analysis](#8-testing-analysis)
9. [Configuration and Deployment Architecture](#9-configuration-and-deployment-architecture)
10. [Refactoring Priority](#10-refactoring-priority)
11. [Conclusion](#11-conclusion)
12. [Appendix](#appendix) (including test coverage three-category table)

---

## 1. Repository Overview and Key Metrics

### 1.1 Code Scale

| Metric | Value |
| --- | --- |
| Source files (`src/`) | 572 `.ts` files |
| Source lines | 145,230 lines |
| Test files (`tests/`) | 584 `.ts` files |
| Test lines | 116,139 lines |
| Test/Source ratio | 0.80:1 |
| `src/core/` subdirectories | 37 + 1 root file (`errors.ts`) |
| `src/core/` files | 486 `.ts` files |
| `src/core/` lines | ~136,562 lines |
| `src/cli/` files | 74 |
| `src/cli/` lines | 5,436 lines |
| `src/gateway/` files | 11 |
| npm scripts | 82 (37+ CLI commands + 22 stability rehearsals + build/test/CI) |
| Runtime dependencies | 2 (`typescript`, `zod`) - extremely low supply chain risk |
| Division definitions | 10 |
| Configuration files | 24 (6-layer environment gradient) |

### 1.2 Technology Stack

| Category | Technology Choice |
| --- | --- |
| Language | TypeScript 5.8+ (strict mode + ESM) |
| Runtime | Node.js 20+ (CI: 20 + 22) |
| Database | SQLite (WAL mode, ~52 tables) + PostgreSQL (in adaptation) |
| Testing | `node:test` + `node:assert/strict` + `c8` coverage |
| Build | `tsc` (build vs build:test separation) |
| Lint | ESLint 9.x flat config |
| Container | Multi-stage Dockerfile, `node:22-bookworm-slim` |
| CI | GitHub Actions (matrix: Node 20/22) |

### 1.3 `as unknown as` Type Assertion Statistics (Version 5 Refresh)

| Metric | Value |
| --- | --- |
| Total occurrences | ~37 |
| Files involved | ~20 |
| `methods-04~13.ts` | **0** (was 101 in v4, all cleared, now uses `query-helper.ts`) |
| `query-helper.ts` | Created (6 functions), **consumed by all 10 method files** |
| Remaining concentration areas | `tool-argument-coercion.ts` (6), `query-helper.ts` (6, by design intent), others 1-3 each |

### 1.4 Criteria: Two-Dimensional Status System

This document uses two-dimensional judgment for each module. **Implemented ≠ Production-ready, Partial ≠ Unusable**.

**Dimension A - Implementation Status**

| Status | Meaning |
| --- | --- |
| Not Started | Zero code or only placeholder files |
| Skeleton | Interface/type defined, core logic empty or TODO |
| Partial | Main path implemented, secondary paths or boundary conditions missing |
| Implemented | Functional code complete, compiles successfully |

**Dimension B - Production Confidence**

| Level | Meaning |
| --- | --- |
| Unverified | No specialized tests, or only compilation passes |
| Test-covered | Unit/integration tests cover main paths |
| Staging-verified | Verified in staging/pre-production-like environment |
| Production-ready | Confirmed through traffic verification, fault injection, monitoring closed loop |

> Currently, **no module in the codebase has reached Staging-verified or Production-ready**, because production-like deployment has not yet been performed.

### 1.5 Architecture Blockers

The following 3 items are the most prominent blocking issues in the current architecture, hindering production deployment or seriously affecting engineering quality.

| # | Blocker | Severity | Location | Description |
| --- | --- | --- | --- | --- |
| B1 | **PostgreSQL async/sync incompatibility** | Blocking | `sqlite-database-wrapper.ts` (~111 lines, in `postgres/` directory) | Synchronous API wrapping asynchronous PG connection, dual backend cannot switch |
| B2 | **AuthoritativeTaskStore compatibility layer still heavy** | Medium | `authoritative-task-store-legacy-compat.ts` 8,469 lines | `methods-01~13` and `Object.assign` have been deleted, structural God-class has been demolished; current remaining issue is that legacy compat semantics have not yet fully converged to each Repository |
| B3 | **E2E test coverage insufficient** | Medium | `tests/e2e/task-lifecycle.test.ts` | Has 1 E2E test file, but coverage is still extremely narrow |

---

## 2. Module Inventory and Status Matrix

### 2.1 `src/core/` Complete Module Inventory (Two-Dimensional Status)

| Directory | Files | Lines | Core Services/Classes | Implementation Status | Production Confidence | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `errors.ts` | 1 | 490 | `AppError` + 12 subclasses | Implemented | Test-covered | Unified error hierarchy, zero external dependencies |
| `api/` | 22 | 4,067 | `HttpApiServer`, `ApiAuthService`, `OidcOAuthService` | Implemented | Test-covered | HTTP API layer, 14 route files |
| `approvals/` | 3 | 490 | `ApprovalService`, `ApprovalTimeoutExecutor` | Implemented | Test-covered | HITL approval workflow + timeout scanning |
| `artifacts/` | 2 | 370 | `ArtifactStore` | Implemented | Test-covered | Sandboxed file storage + SHA-256 |
| `cache/` | 25 | 2,238 | `CacheFacade`, `CacheOrchestrationService` | Implemented | **Test-covered** | Three-level cache L1/L2/L3, 21 test files coverage |
| `compliance/` | 2 | 346 | `AuditExportService` | Implemented | Unverified | SOC2/ISO/HIPAA/GDPR |
| `config/` | 26 | 6,395 | `ConfigGovernanceService` | Implemented | Test-covered | Layered config + schema validation |
| `constants/` | 2 | 16 | Time constants | Implemented | Unverified | Leaf module |
| `cost/` | 2 | 64 | `BudgetGuard` | Implemented | Unverified | Pure logic, no DB dependency |
| `deployment/` | 2 | 502 | `TrafficRoutingService` | Implemented | Unverified | Blue-green/canary release |
| `divisions/` | 4 | 1,636 | `DivisionLoader`, `DivisionRegistry` | Implemented | Test-covered | Division definition loading + validation |
| `evaluation/` | 3 | 1,335 | `LLMEvalService` | Implemented | Test-covered | LLM evaluation + model governance |
| `events/` | 6 | 1,291 | `DurableEventBus`, `TypedEventBus` | Implemented | Test-covered | Three-tier event delivery, `dispose()` implemented |
| `evolution/` | 11 | 2,231 | `EvolutionMvpService`, `ReflectionEngine` | Implemented | Unverified | Self-improvement pipeline |
| `hr/` | 2 | 572 | `HrRoleGovernanceService` | Implemented | Unverified | Role governance |
| `lifecycle/` | 2 | 269 | `ServiceRegistry` (268 lines) | Implemented | **Test-covered** | Singleton management core, 6 test files (including `service-registry.test.ts`) |
| `locking/` | 8 | 623 | `DistributedLockAdapter` (SQLite/PG/Redis) | Implemented | **Test-covered** | Strategy pattern + factory, 2 test files |
| `memory/` | 11 | 3,057 | `MemoryService`, `ExperienceCacheService`, `SessionSummaryService` | Implemented | Test-covered | Layered memory + FTS5 + BM25 + session summary |
| `messages/` | 2 | 509 | `TokenEstimator` | Implemented | Test-covered | Message parsing + token estimation |
| `observability/` | 20 | 6,697 | `StructuredLogger`, `HealthService`, `DiagnosticsService` | Implemented | Test-covered | Complete observability stack |
| `ops/` | 16 | 7,696 | `DoctorService`, `EnterpriseGovernanceService` | Implemented | Test-covered | Operations toolkit |
| `orchestration/` | 3 | 1,053 | `IntakeRouter`, `AgentTeamService` | Implemented | Test-covered | Request routing + orchestration |
| `product/` | 17 | 6,872 | `BillingService`, `MarketplaceGovernanceService` | Implemented | Test-covered | Billing/marketplace/compliance |
| `providers/` | 9 | 4,217 | `UnifiedChatProvider`, `BaseChatProvider`, `CircuitBreaker` | Implemented | Test-covered | Multi-Provider LLM abstraction + circuit breaker |
| `queue/` | 6 | 904 | `QueueAdapter` (SQLite/Redis) | Implemented | **Test-covered** | Strategy pattern + factory, 7 test files |
| `reliability/` | 8 | 1,112 | `RepairPipeline`, `FailureClassification` | Implemented | Unverified | Repair pipeline |
| `resource/` | 2 | 361 | `ProcessTracker` | Implemented | Test-covered | Process tracking (singleton) |
| `results/` | 2 | 390 | `ResultEnvelope` | Implemented | Unverified | Standardized result envelope |
| `runtime/` | **76** | **23,032** | `TransitionService`, `ExecutionLeaseService`, `AgentExecutor` | Implemented | Test-covered | **Core execution engine** |
| `security/` | 18 | 6,976 | `SandboxPolicy`, `PolicyEngine`, `SecretManagementService` | Implemented | Test-covered | Defense in depth |
| `stability/` | 31 | 12,727 | `GoldenTaskRunner`, 18+ rehearsal suites | Implemented | Test-covered | Stability rehearsal framework |
| `storage/` | **80** | **20,561** | `AuthoritativeTaskStore` (delegating core + legacy compat 9,695 lines) | Implemented | **Indirect** | Dual backend SQLite/PG (PG unavailable); `sqlite/repositories/` 22 files, methods-01~13 deleted |
| `storage/postgres/` | - | - | PG adapter | **Partial** | **Unverified** | async/sync incompatibility, cannot switch |
| `tools/` | **36** | **13,481** | `CommandExecutor`, `PatchDslService`, `SkillExecutionService` | Implemented | Test-covered | Tool execution + security |
| `types/` | 20 | 2,881 | Domain types (17 files), IDs, Status enums | Implemented | Unverified | Pure type definitions |
| `utils/` | 2 | 109 | `BoundedCache` | Implemented | **Unverified** | Tool leaf module, zero tests |
| `workflow/` | 4 | 992 | `WorkflowValidator`, `MinimalWorkflow` | Implemented | Test-covered | Workflow definition + validation |

### 2.2 Code Duplication Issues

The 6 pairs of completely duplicated code (total 2,001 lines) reported in v4 **have all been cleaned up**:

* `governance/` directory deleted (`approvals/` + `compliance/` retained as canonical)
* `output/` directory deleted (`artifacts/` + `results/` retained as canonical)
* `lifecycle/traffic-routing-service.ts` deleted (`deployment/` retained)
* `product/budget-guard.ts` deleted (`cost/` retained)

**No completely duplicated source files** exist in the current codebase.

---

## 3. Module-by-Module Deep Analysis

### 3.1 `src/core/runtime/` - Core Execution Engine

**Scale**: 76 files, 23,032 lines - largest and most complex module in the codebase.

#### 3.1.1 Files Grouped by Function

**Core Execution (8 files, ~3,800 lines)**

| File | Lines | Responsibilities |
| --- | --- | --- |
| `agent-executor.ts` | 304 | Formal execution skeleton + middleware chain (before/after model hooks) |
| `agent-middleware-chain.ts` | ~200 | Middleware pipeline: before_agent → before_model → wrap_model_call → after_model → after_agent |
| `transition-service.ts` | 723 | Four state machines (Task/Workflow/Session/Execution) centralized management |
| `state-transition-machine.ts` | ~150 | Generic state machine + legal transition validation |
| `single-task-execution.ts` | ~400 | Single task execution path |
| `single-task-happy-path.ts` | 594 | Single task happy path |
| `phase1a-happy-path.ts` | ~350 | Phase1A execution path |
| `phase1b-orchestration.ts` | ~31 | **Refactored to re-export** (original 2172 lines split) |

**Lease and Worker Management (9 files, ~5,600 lines)**

| File | Lines | Responsibilities |
| --- | --- | --- |
| `execution-lease-service.ts` | 796 | Lease acquisition/renewal/release/recovery/write validation |
| `execution-worker-handshake-service.ts` | 789 | Worker handshake/heartbeat/remote logging |
| `execution-worker-writeback-service.ts` | 734 | Worker result writeback |
| `worker-registry-service.ts` | 694 | Worker registration/discovery |
| `worker-load-balancing.ts` | ~150 | Load skew analysis |
| `worker-scheduling-status.ts` | ~100 | Scheduling status |
| `execution-dispatch-service.ts` | 733 | Ticket dispatch + worker qualification evaluation |
| `execution-dispatch-reconciliation-service.ts` | ~300 | Dispatch reconciliation |
| `remote-worker-registration-service.ts` | ~200 | Remote Worker registration |

**Recovery and Repair (6 files, ~3,400 lines)**

| File | Lines | Responsibilities |
| --- | --- | --- |
| `runtime-recovery-service.ts` | 546 | Recovery orchestration entry point |
| `runtime-recovery-decision-service.ts` | ~300 | Recovery decision logic |
| `runtime-recovery-replay-service.ts` | 700 | Tier-1 event replay |
| `runtime-repair-service.ts` | 595 | State repair |
| `stalled-execution-detector.ts` | ~85 | Stall detection (logic relatively simple) |
| `stalled-execution-escalation-service.ts` | ~200 | Stall escalation |

**HA and Infrastructure (8 files, ~3,800 lines)**

| File | Lines | Responsibilities |
| --- | --- | --- |
| `ha-coordinator-service.ts` | 680 | HA coordinator, leader election |
| `coordinator-load-balancing-service.ts` | ~400 | Control plane load balancing |
| `cross-region-deployment-service.ts` | 663 | Cross-region deployment (Experimental) |
| `hot-upgrade-service.ts` | 706 | Hot upgrade (Experimental) |
| `graceful-shutdown.ts` | ~276 | Graceful shutdown + signal handling + orderly teardown |
| `startup-preflight.ts` | ~200 | Pre-startup checks |
| `startup-consistency-checker.ts` | 510 | Post-startup consistency verification |
| `remote-session-guard.ts` | ~150 | Remote session permission control |

**Middleware and Detection (8 files, ~2,800 lines)**

| File | Lines | Responsibilities |
| --- | --- | --- |
| `loop-detection.ts` | ~442 | Agent loop pattern detection |
| `tight-loop-detector.ts` | ~150 | Tight loop detection |
| `admission-controller.ts` | ~300 | Request admission control |
| `complexity-router.ts` | ~200 | Task complexity routing |
| `call-governance.ts` | 733 | LLM call governance |
| `context-compaction-service.ts` | ~250 | Context window compression |
| `effect-buffer.ts` | 549 | Side effect buffer (consumed by `command-executor.ts`: `globalEffectBuffer` + `EffectBuilder`) |
| `license-enforcement-service.ts` | 584 | License enforcement |

**Orchestration (6 files, ~1,500 lines)**

| File | Lines | Responsibilities |
| --- | --- | --- |
| `multi-step-orchestration.ts` | ~350 | Multi-step workflow orchestration |
| `output-continuation-service.ts` | ~200 | Long output continuation |
| `prompt-partition-cache.ts` | ~150 | Prompt caching |
| `model-call-provider.ts` | ~100 | Model call Provider singleton |
| `session-lifecycle.ts` | ~200 | Session lifecycle management |
| `validation-repair-loop.ts` | ~100 | Validation-repair loop |

**Subdirectories (7 directories, ~400 lines)**

| Subdirectory | Files | Responsibilities |
| --- | --- | --- |
| `dispatcher/` | 1 | Tool dispatch registry |
| `orchestrator/` | 2 | Orchestrator types + entry |
| `supervisor/` | 1 | Supervisor |
| `planner/` | 1 | Planner |
| `ha-coordinator/` | 2 | HA coordinator support types |
| `orchestration/` | 4 | phase1b tool definitions and utility functions |
| `execution-lease/` | 2 | Lease types and utility functions |

#### 3.1.2 Architecture Evaluation

**Advantages**:

* Middleware chain pattern (`agent-middleware-chain.ts`) provides good extensibility
* Lease + fencing token pattern fully implemented
* State machine transition service centralized and strict
* `phase1b-orchestration.ts` refactored from 2172 lines to 31 lines re-export

**Issues**:

* 76 files too flat, lacking further subdirectory organization
* `stalled-execution-detector.ts` only 85 lines, detection logic too simple
* HA coordinator and cross-region deployment still in Experimental status
* Multiple module-level singletons (`_toolRegistry`, `_phase1bInstance`), lacking unified dispose

---

### 3.2 `src/core/storage/` - Data Persistence Layer

**Scale**: 80 files, 20,561 lines - second largest module in the codebase. Subdirectories: `sqlite/` (52 files, 16,051 lines, including `sqlite/repositories/` 22 files 5,874 lines), `postgres/` (11, 1,665), `sql/` (6, 838), `repositories/` (3, 577).

#### 3.2.1 AuthoritativeTaskStore Splitting Status

| Layer | File | Lines | Notes |
| --- | --- | --- | --- |
| Facade | `authoritative-task-store-facade.ts` | 12 | Backward-compatible facade alias |
| Core | `authoritative-task-store-core.ts` | 1 | Thin re-export |
| Delegating | `authoritative-task-store-delegating-core.ts` | 756 | Repo delegation layer |
| Legacy compat | `authoritative-task-store-legacy-compat.ts` | 8,469 | Compatibility semantics bearer layer |
| Compat | `authoritative-task-store-compat.ts` | 5 | Backward compatible |
| Repositories | `authoritative-task-store-repositories.ts` | 79 | Repositories assembly |
| Types | `authoritative-task-store-types.ts` | 373 | Type definitions |
| **Total** | 7 files | **9,695** | methods-01~13 deleted |

**Current Status**: Both `Object.assign` prototype mixin and `authoritative-task-store-methods-01~13.ts` have been deleted, `repositories()` has been cached and points to real Repository instances. Structural splitting is complete, but `legacy compat` is still large. The focus of subsequent work has shifted from "continue splitting method files" to "continue converging compatibility semantics to each Repository".

**`sqlite/repositories/` subdirectory (22 files, 5,874 lines)** - Current main bearer layer:

* `authoritative-task-store-decorator.ts` (163 lines) - SQLITE_BUSY retry decorator
* `phase1a-store-decorator.ts` (9 lines) - Phase1A decorator
* `runtime-lifecycle-repository.ts` (405 lines) - Runtime lifecycle data access
* 22 Repository / support files covering Task/Execution/Session/Event/Worker/Billing/Approval/Lease/Lock/Memory/Artifact/Division/Workflow/Dispatch/Operations entities

**Top-level `repositories/` (3 files, 577 lines)**: Original 3 files retained

#### 3.2.2 SQLite Infrastructure

| File | Lines | Responsibilities |
| --- | --- | --- |
| `sqlite-database.ts` | 698 | WAL-mode SQLite wrapper, transaction management, migration support |
| `sqlite-migration-plan.ts` | ~500 | Migration plan + checksum validation |
| `sqlite-migration-runtime-part1/2/3.ts` | ~800 | Runtime migration execution |
| `sqlite-migration-compatibility.ts` | ~200 | Schema compatibility check |
| `sqlite-schema-compatibility-gate.ts` | ~200 | Compatibility gate |
| `sqlite-reliability-service.ts` | ~300 | Backup, integrity check, WAL management |
| `query-helper.ts` | ~150 | SQL query helper layer (currently jointly consumed by delegating core and repositories) |

#### 3.2.3 PostgreSQL Adapter

| File | Lines | Notes |
| --- | --- | --- |
| `pg-database.ts` | ~300 | PostgreSQL wrapper |
| `pg-schema.ts` + `pg-schema-support.ts` | ~500 | Schema management |
| `pg-migrations-*.ts` | ~400 | Migrations |
| `phase_1a_schema_ddl_part-1~5.ts` | ~1,200 | DDL definitions |
| `sqlite-database-wrapper.ts` | ~111 | SQLite compatibility wrapper |

**PostgreSQL Adapter Issue**: async/sync incompatibility, `sqlite-database-wrapper.ts` attempts to wrap PostgreSQL asynchronous connection with synchronous API, making true dual-backend switching impossible.

#### 3.2.4 Architecture Evaluation

**Advantages**:

* WAL mode + busy timeout configuration reasonable
* Migration system has checksum validation
* Repository splitting direction correct (40% complete)
* `StorageBackendFactory` provides unified backend creation entry point

**Issues**:

* 13 method files each ~750 lines, method distribution lacks clear classification logic
* PostgreSQL backend unavailable (async/sync incompatibility)
* `sqlite-database-wrapper.ts` located in `postgres/` directory (module attribution confusion)
* Query results have no runtime schema validation

---

### 3.3 `src/core/tools/` - Tool Execution and Security

**Scale**: 36 files, 13,481 lines

#### 3.3.1 Core Files

| File | Lines | Responsibilities |
| --- | --- | --- |
| `command-executor.ts` | 512 | Sandboxed command execution, concurrency limit (max 16), `spawnTracked` integrated |
| `command-security.ts` | 388 | Command risk assessment, metacharacter/Fork bomb detection |
| `patch-dsl-service.ts` | 791 | Patch DSL parsing and application |
| `edit-replacement-service.ts` | ~500 | Intelligent file editing + conflict detection (split to `edit-replacement/` subdirectory) |
| `edit-replacement/` | 6 files | Match, stage, apply, rollback logic |
| `skill-execution-service.ts` | ~500 | Skill execution + caching + model configuration parsing |
| `skill-governance-service.ts` | ~475 | Skill governance |
| `tool-output-sanitizer.ts` | ~459 | Output sanitization, secret redaction, injection detection |
| `tool-parallel-executor.ts` | ~436 | Tool parallel execution |
| `tool-metadata.ts` | ~300 | Tool definition, risk level, timeout configuration |
| `tool-contract-validator.ts` | ~200 | Tool interface validation |
| `tool-argument-coercion.ts` | ~200 | Parameter type coercion (includes 6 `as unknown as`) |
| `mcp-tool-guard.ts` | ~200 | MCP tool protocol validation + sanitization |
| `semantic-repo-map-service.ts` | ~300 | Repository semantic mapping |
| `code-diagnostics-service.ts` | ~300 | Code analysis diagnostics |
| `web-fetch.ts` / `web-search.ts` | ~300 | Web content fetch + search |

#### 3.3.2 Security Chain (7-Layer Defense, Fully Implemented)

```
1. Metacharacter detection: |, >, <, `, &&, ||, ;, $(...), ${...}, \r, \n
2. Command policy: Unknown commands default to deny
3. Parameter validation: Script interpreter must carry script path
4. Remote pipe detection: curl url | bash
5. Fork bomb detection
6. Sandbox path validation (realpath + symlink traversal)
7. Output sanitization (secret redaction + injection detection)
```

---

### 3.4 `src/core/security/` - Security Module

**Scale**: 18 files, 6,976 lines

| Subsystem | Files | Lines | Status |
| --- | --- | --- | --- |
| Sandbox policy | `sandbox-policy.ts` | 327 | Implemented - 3 modes: read_only / workspace_write / danger_full_access |
| Policy engine | `policy-engine.ts` | 320 | Implemented - Decision chain: kill switch → budget → risk → approval → allow |
| Secret management | `secret-management-service.ts` | 510 | Implemented - Multi-Provider registration/rotation/audit |
| Secret provider | `env-secret-provider.ts`, `managed-secret-provider.ts`, `external-secret-provider.ts` | ~400 | Implemented |
| Secret provider (cloud) | `vault-http-secret-provider.ts`, `aws-kms-http-secret-provider.ts`, `gcp-secret-manager-http-secret-provider.ts` | ~750 | Partial - Not production verified |
| CVE intelligence | `cve-intelligence-service.ts` | 748 | Implemented |
| Network egress | `network-egress-policy.ts`, `network-egress-audit.ts`, `outbound-url-policy.ts` | ~600 | Implemented |
| Data classification | `data-classification-service.ts` | ~300 | Implemented - PII/sensitive data classification |
| Audit integrity | `audit-event-integrity.ts` | ~200 | Implemented - Tier-1 audit event chain |
| File freshness | `file-freshness.ts` | ~200 | Implemented |
| Trusted context | `trusted-context-scanner.ts` | ~150 | Implemented |

---

### 3.5 `src/core/observability/` - Observability

**Scale**: 20 files, 6,697 lines

| Subsystem | Core Files | Lines | Status |
| --- | --- | --- | --- |
| Structured logging | `structured-logger.ts` | 278 | Implemented - Ring buffer + file sink |
| Health check | `health-service.ts` | 498 | Implemented - ok → degraded → overloaded → unhealthy |
| Diagnostics | `diagnostics-service.ts` + `diagnostics-support.ts` | 1,165 | Implemented - Snapshot/timeline/reproduction package |
| Inspect | `inspect-service.ts` | ~500 | Implemented - Task/Workflow/Worker inspection |
| Metrics | `metrics-service.ts` | 404 | Implemented - Runtime metrics aggregation |
| Anomaly detection | `anomaly-detection-service.ts` | 796 | Implemented - Statistical anomaly detection |
| Provider health | `provider-health-tracker.ts` | ~150 | Implemented |
| Prometheus | `prometheus-metrics-exporter.ts` | ~167 | Partial - Export logic exists, but no independent HTTP endpoint (exposed in `health-routes.ts`) |
| SLI/SLO | `sli-collection-service.ts`, `slo-alerting-service.ts` | ~600 | Implemented - But integration unverified |
| Tracing | `trace-context.ts` | ~200 | Implemented |
| Retention policy | `observability-retention-service.ts` | ~200 | Implemented |

**Issues**:

* `DiagnosticsService` + support total 1,165 lines, can consider further splitting
* SLI/SLO service production integration status unverified

---

### 3.6 `src/core/events/` - Event Infrastructure

**Scale**: 6 files, 1,291 lines

| File | Lines | Responsibilities |
| --- | --- | --- |
| `durable-event-bus.ts` | 346 | Three-tier event delivery + ack tracking + exponential backoff retry (max 3) |
| `typed-event-bus.ts` | ~186 | Type-safe event bus + `TypedEventPayloadMap` |
| `typed-event-payloads.ts` | ~200 | Event payload type definitions |
| `event-types.ts` | 97 | Tier 1/2/3 event classification |
| `event-registry.ts` | ~330 | Event schema registry |

**Tier semantics**:

* **Tier 1**: DB write + ack record creation must complete before publish, consumers must acknowledge
* **Tier 2**: Event written, ack optional; used for dispatch/worker/recovery
* **Tier 3**: Best effort, no ack record created; used for SSE stream

**Issues**:

* Event registry's event schema validation only does type checking, no runtime payload validation

---

### 3.7 `src/core/providers/` - LLM Provider Abstraction

**Scale**: 9 files, 4,217 lines

| File | Lines | Responsibilities |
| --- | --- | --- |
| `unified-chat-provider.ts` | 452 | Unified chat interface, multi-Provider abstraction (integrated circuit breaker) |
| `base-chat-provider.ts` | 326 | **Abstract base class** - Retry/rate limit parsing/credential failover template methods |
| `circuit-breaker.ts` | 289 | **Circuit breaker** (new in v4) - Prevents Provider continuous failure cascading |
| `model-routing-service.ts` | 674 | Intelligent model selection (route-class → coding/reasoning/classification/writing) |
| `provider-credential-pool.ts` + support | ~750 | Multi-key credential management + rotation |
| `anthropic/anthropic-chat-service.ts` | ~580 | Anthropic Claude |
| `openai/openai-chat-service.ts` | ~617 | OpenAI GPT |
| `minimax/minimax-chat-service.ts` | ~450 | MiniMax |

**Architecture pattern**: Template method pattern - `BaseChatProvider` defines `buildRequest()` / `extractContent()` / `postWithCredentialFailover()` skeleton, each implementation class overrides specialized logic.

**Advantages**:

* Credential pool supports multi-key rotation and failover
* Model routing selects by route-class + risk level, supports fallback lease
* Provider health-aware routing

**Issues**:

* Credential pool lacks dispose method
* Missing Provider-level mock abstraction, tests depend on handwritten mocks

---

### 3.8 `src/gateway/` - Channel Gateway

**Scale**: 11 files, 3,140 lines - Feature implementation complete, engineering form close to production module

| File | Lines | Responsibilities |
| --- | --- | --- |
| `channel-gateway-service.ts` | 633 | Routes messages to Telegram/Slack/Webhook |
| `channel-gateway-delivery-service.ts` | 790 | Delivery guarantee - retry tracking/rate limiting/dead letter/HMAC signature/nonce replay prevention |
| `channel-gateway-delivery-support.ts` | 239 | Types/DDL/configuration/backoff calculation |
| `channel-gateway-retry-executor.ts` | 150 | Background poller - processes retry queue every 15s |
| `storage-port.ts` | 32 | Port interface (hexagonal architecture) |
