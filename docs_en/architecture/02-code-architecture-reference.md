# Automatic Agent Platform — Code Architecture Analysis Reference Document

> **Analysis Date**: 2026-04-20 (Version 10, full rescan after 7-layer architecture reorganization)
> **Analysis Scope**: src/ (1,052 files, 191,611 lines), tests/ (1,018 files, 206,717 lines), config/, deploy/, scripts/
> **Analysis Method**: Directory-by-directory static analysis + dependency tracing + test coverage mapping + pattern recognition
> **Document Purpose**: Source code status, call chains, technical debt, refactoring basis; not directly indicative of production readiness
> **Document Nature**: Internal audit document, not production-ready proof

---

## Table of Contents

1. [Repository Overview and Key Metrics](#1-repository-overview-and-key-metrics)
2. [Seven-Layer Architecture Module Inventory and Status Matrix](#2-seven-layer-architecture-module-inventory-and-status-matrix)
3. [Platform Layer Module-by-Module Deep Analysis](#3-platform-layer-module-by-module-deep-analysis)
4. [Business and Interaction Layer Module-by-Module Deep Analysis](#4-business-and-interaction-layer-module-by-module-deep-analysis)
5. [Core Call Chain Analysis](#5-core-call-chain-analysis)
6. [Module Dependency and Boundary Analysis](#6-module-dependency-and-boundary-analysis)
7. [Code Quality Issues](#7-code-quality-issues)
8. [Security and Reliability Analysis](#8-security-and-reliability-analysis)
9. [Testing Analysis](#9-testing-analysis)
10. [Configuration and Deployment Architecture](#10-configuration-and-deployment-architecture)
11. [Refactoring Priorities and Conclusions](#11-refactoring-priorities-and-conclusions)
12. [Appendix](#appendix)

---

## 1. Repository Overview and Key Metrics

### 1.1 Code Scale

| Metric                   | Value                                                    |
| ------------------------ | -------------------------------------------------------- |
| Source files (`src/`)    | 1,052 `.ts` files                                        |
| Source lines             | 191,611 lines                                            |
| Test files (`tests/`)    | 1,018 `.ts` files                                        |
| Test lines               | 206,717 lines                                            |
| Test cases               | ~9,141 (`test()` 9,109 + `it()` 32)                     |
| Test/Source ratio        | 1.08:1                                                   |
| Top-level src/ modules   | 10 (seven-layer architecture + apps/core/sdk)            |
| Runtime dependencies     | 5 (`typescript`, `zod`, `ioredis`, `ws`, `postgres`)    |
| Division definitions     | 10 (56 files)                                            |
| Config files             | 27 (11 configuration categories)                          |
| Deployment files         | 41 (Helm/Terraform/Prometheus/Grafana/Chaos)             |
| npm scripts              | 110+                                                     |

### 1.2 Seven-Layer Architecture Code Distribution

| Layer                   | Directory                  | Files    | Lines      | Share    |
| ----------------------- | -------------------------- | -------- | ---------- | -------- |
| **Infrastructure Layer**| `src/platform/`            | 712      | 160,122    | 83.6%    |
| **Scale Ecosystem Layer**| `src/scale-ecosystem/`     | 57       | 9,167      | 4.8%     |
| **SDK/CLI Layer**       | `src/sdk/`                 | 87       | 7,268      | 3.8%     |
| **Business Domain Layer**| `src/domains/`            | 34       | 5,076      | 2.6%     |
| **Ops Maturity Layer**  | `src/ops-maturity/`        | 72       | 4,397      | 2.3%     |
| **Intelligent Interaction Layer**| `src/interaction/` | 28       | 2,608      | 1.4%     |
| **Plugin Layer**        | `src/plugins/`             | 20       | 1,672      | 0.9%     |
| **Org Governance Layer**| `src/org-governance/`      | 30       | 1,222      | 0.6%     |
| Application Entry       | `src/apps/`                | 4        | 50         | 0.0%     |
| Legacy Shim             | `src/core/`                | 8        | 29         | 0.0%     |
| **Total**               |                            | **1,052**| **191,611**| **100%** |

### 1.3 Technology Stack

| Category       | Technology Choice                                               |
| -------------- | --------------------------------------------------------------- |
| Language       | TypeScript 5.8+ (strict mode + ESM)                            |
| Runtime        | Node.js 22+                                                    |
| Database       | SQLite (WAL mode, ~52 tables) + PostgreSQL (in adaptation)     |
| Cache          | Memory + SQLite + Redis (ioredis ^5.10.1)                      |
| WebSocket      | ws ^8.18.0                                                     |
| Schema Valid.  | Zod ^3.25                                                      |
| Observability  | OpenTelemetry SDK + Prometheus + custom structured logging     |
| Testing        | `node:test` + `node:assert/strict` + `c8` coverage              |
| Build          | `tsc` (build vs build:test separation)                         |
| Lint           | ESLint 9.x flat config + Prettier                              |
| Mutation Test  | Stryker Mutator                                                |
| Container      | Multi-stage Dockerfile, `node:22-bookworm-slim`               |
| CI             | GitHub Actions (matrix: Node 20/22)                            |
| Deployment     | Helm + Terraform (EKS/ECR/RDS/ElastiCache)                    |

### 1.4 Judgment Criteria: Dual-Dimensional Status System

**Dimension A — Implementation Status**

| Status      | Meaning                                                      |
| ----------- | ------------------------------------------------------------ |
| Not Started | Zero code or only `export {}` placeholder files              |
| Skeleton    | Interfaces/types defined, core logic empty or TODO           |
| Partial     | Main path implemented, secondary paths or edge cases missing |
| Implemented | Functional code complete, compiles successfully             |

**Dimension B — Production Confidence**

| Level             | Meaning                                                      |
| ----------------- | ------------------------------------------------------------ |
| Unverified        | No dedicated tests, or only compilation passes               |
| Test-covered      | Unit/integration tests cover main paths                      |
| Staging-verified  | Verified in staging-like environment                         |
| Production-ready  | Confirmed via traffic validation, fault injection, monitoring闭环 |

> **No module in the current codebase has reached Staging-verified or Production-ready**.

### 1.5 Architecture Blockers

| #   | Blocker                          | Severity | Location                                                           | Description                                                |
| --- | -------------------------------- | -------- | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| B1  | **PostgreSQL async/sync incompatibility** | Blocking | `platform/state-evidence/truth/postgres/sqlite-database-wrapper.ts` | Sync API wraps async PG connection, dual backend cannot switch |
| B2  | **src/core/ legacy shim**        | Medium   | `src/core/runtime/` (8 files, 29 lines)                            | Pure re-export shim, should delete and update consumers    |
| B3  | **E2E test coverage insufficient** | Medium   | `tests/e2e/` (10 files, 2,807 lines)                              | Coverage needs significant expansion                         |

---

## 2. Seven-Layer Architecture Module Inventory and Status Matrix

### 2.1 Platform Layer (`src/platform/` — 712 files, 160,122 lines)

| Submodule         | Files | Lines  | Core Services                                                                                          | Impl. Status | Prod. Confidence |
| ----------------- | ----- | ------ | ------------------------------------------------------------------------------------------------------ | ----------- | --------------- |
| `execution/`      | 167   | 44,641 | `AgentExecutor`, `ExecutionDispatchService`, `ExecutionLeaseService`, `CommandExecutor`               | Implemented | Test-covered    |
| `state-evidence/` | 169   | 36,787 | `AuthoritativeTaskStore` (delegation chain), `MemoryService`, `KnowledgePlaneService`, `TypedEventBus`| Implemented | Test-covered    |
| `shared/`         | 101   | 24,618 | `StructuredLogger`, `HealthService`, `CacheFacade`, 28+ stability rehearsal suites                    | Implemented | Test-covered    |
| `control-plane/`  | 75    | 24,309 | `DoctorService`, `PolicyEngine`, `SecretManagementService`, `ConfigGovernanceService`                 | Implemented | Test-covered    |
| `interface/`      | 51    | 9,563  | `HttpApiServer`, `ChannelGatewayService`, `DistributedRateLimiter`                                    | Implemented | Test-covered    |
| `orchestration/`  | 80    | 7,602  | `OapeflirLoopService`, `IntakeRouter`, `HitlApprovalOrchestrationService`                             | Implemented | Unverified      |
| `model-gateway/`  | 17    | 5,137  | `UnifiedChatProvider`, `ModelRoutingService`, `CircuitBreaker`                                        | Implemented | Test-covered    |
| `contracts/`      | 34    | 4,337  | `AppError` + 14 subclasses, Domain types, IDs                                                        | Implemented | Test-covered    |
| `prompt-engine/`  | 11    | 2,521  | `LlmEvalService`, `PromptRolloutService`, `PromptTemplateRegistryService`                             | Implemented | Test-covered    |
| `compliance/`     | 6     | 591    | `ComplianceCaseOrchestrationService`, `DataResidencyPolicyService`                                    | Implemented | Unverified      |

### 2.2 Non-Platform Layer Module Inventory

| Layer        | Module                                | Files | Lines  | Core Services                                                                  | Impl. Status | Prod. Confidence |
| ------------ | ------------------------------------- | ----- | ------ | ------------------------------------------------------------------------------ | ------------ | ---------------- |
| Scale        | `scale-ecosystem/marketplace/`        | 26    | 7,737  | `BillingService`, `TenantPlatformService`, `PmfValidationService`             | Implemented  | Test-covered     |
| Scale        | `scale-ecosystem/feedback-loop/`      | 9     | 739    | `FeedbackImprovementService`, `SignalPreprocessor`                             | Implemented  | Unverified       |
| Scale        | `scale-ecosystem/integration/`        | 5     | 203    | `ConnectorFrameworkService`                                                     | Implemented  | Unverified       |
| Scale        | `scale-ecosystem/sla-engine/`         | 5     | 142    | `SlaOperationsService`                                                          | Implemented  | Unverified       |
| Scale        | `scale-ecosystem/multi-region/`       | 5     | 134    | `CrossRegionRoutingService`                                                     | Partial      | Unverified       |
| Scale        | `scale-ecosystem/resource-manager/`   | 5     | 118    | `FairSchedulingService`                                                         | Partial      | Unverified       |
| Domain       | `domains/registry/`                   | 15    | 2,612  | `PluginSpiRegistry` (829 lines), `PluginRuntimeHost` (611 lines)               | Implemented  | Unverified       |
| Domain       | `domains/governance/`                 | 5     | 1,636  | `DivisionLoader` (798 lines), `HrRoleGovernanceService` (571 lines)            | Implemented  | Test-covered     |
| Domain       | `domains/other 8 submodules`          | 14    | 828    | Domain models, Prompt library, Eval framework, Risk profiles                   | Implemented  | Unverified       |
| Ops Maturity | `ops-maturity/drift-detection/`      | 15    | 2,399  | `EvolutionMvpService` (645 lines), `SimpleProposalEngine`                     | Implemented  | Unverified       |
| Ops Maturity | `ops-maturity/other 10 submodules`    | 57    | 1,998  | Lifecycle/capacity/cost/explainability/debugger/edge/emergency/multimodal/compliance reporter/Ops Agent | Implemented | Unverified |
| Interaction  | `interaction/nl-gateway/`              | 4     | 553    | `NlEntryService` (505 lines)                                                    | Implemented  | Unverified       |
| Interaction  | `interaction/other 6 submodules`     | 24    | 2,055  | Goal decomposition, proactive agent, dashboard, autonomy, UX                   | Implemented  | Unverified       |
| Org Gov.     | `org-governance/org-model/`           | 5     | 639    | `HrRoleGovernanceService` (571 lines, duplicate)                              | Implemented  | Unverified       |
| Org Gov.     | `org-governance/other 5 submodules`   | 25    | 583    | Approval routing, compliance engine, knowledge boundary, SSO/SCIM, delegated governance | Implemented | Unverified |
| Plugin       | `plugins/`                            | 20    | 1,672  | 6 retrievers, 5 adapters, 3 presenters, 1 planner, 1 validator                 | Implemented  | Unverified       |
| SDK          | `sdk/cli/`                            | 79    | 6,231  | 78 CLI entry points (ops/governance/rehearsal/product/API)                     | Implemented  | Test-covered     |
| SDK          | `sdk/pack-sdk/`                       | 4     | 819    | `PackLifecycleOrchestrationService` (490 lines)                               | Implemented  | Unverified       |
| SDK          | `sdk/other`                           | 4     | 218    | workbench, plugin-sdk, client-sdk                                             | Partial      | Unverified       |
| App          | `apps/`                               | 4     | 50     | `PlatformAppManifest` (api/console/worker)                                     | Implemented  | Unverified       |
| Legacy       | `core/`                               | 8     | 29     | Pure re-export shim → `platform/`                                              | **To Delete** | —               |

### 2.3 v9 → v10 Key Structural Changes

| Change                | v9                                                        | v10                                                                                          |
| --------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Directory structure   | `src/core/` (42 subdirs) + `src/cli/` + `src/gateway/`   | Seven-layer architecture: `platform/` + 6 business layers + `sdk/` + `apps/`                  |
| `src/core/` files/lines | 698 / 164,428                                           | **8 / 29** (pure re-export shim)                                                             |
| `src/platform/`       | Does not exist                                            | **712 / 160,122**                                                                            |
| `src/` total files/lines | 797 / 174,585                                         | **1,052 / 191,611** (+255 files, +17,026 lines)                                               |
| `tests/` total files/lines | 985 / 205,811                                      | **1,018 / 206,717** (+33 files, +906 lines)                                                   |
| New top-level modules | `plugins/` (7 files)                                      | `domains/`, `interaction/`, `org-governance/`, `scale-ecosystem/`, `ops-maturity/`, `apps/`   |
| Plugin file count    | 7                                                          | **20** (+13: domain config, multiple retriever/adapter/presenter)                            |
| CLI location         | `src/cli/` (76 files)                                     | `src/sdk/cli/` (79 files)                                                                     |
| Gateway location     | `src/gateway/` (13 files)                                | `src/platform/interface/channel-gateway/` (13 files)                                         |
| Runtime dependencies | 4                                                          | **5** (added `postgres`)                                                                     |

---

## 3. Platform Layer Module-by-Module Deep Analysis

### 3.1 `platform/execution/` — Execution Engine (167 files, 44,641 lines)

The largest and most complex module in the codebase. 14 subdirectories:

| Subdirectory        | Files | Lines  | Responsibilities                                                                   |
| ------------------- | ----- | ------ | ---------------------------------------------------------------------------------- |
| `tool-executor/`    | 36    | 13,500 | Command execution, Patch DSL, Skill create/execute/govern, semantic repo map, tool recommendation, shadow snapshot |
| `execution-engine/` | 30    | 7,812  | Agent executor, middleware chain, call governance, loop detection, effect buffering, context compression, model invocation |
| `recovery/`         | 21    | 6,264  | Runtime recovery/decision/replay/repair, hang detection/upgrade, DB queue disconnect repair |
| `ha/`               | 12    | 3,218  | HA coordinator (sync/async), cross-region deployment, load balancing             |
| `worker-pool/`      | 19    | 3,288  | Worker handshake/writeback (sync/async), registration/discovery/load balancing   |
| `dispatcher/`       | 11    | 2,980  | Ticket dispatch, admission control, priority preemption, reconciliation, resource monitoring |
| `hot-upgrade/`      | 6     | 1,952  | Hot upgrade (SQLite/PG storage + sync/async)                                      |
| `lease/`            | 8     | 1,807  | Execution lease (fencing token 5-step verification)                              |
| `startup/`          | 4     | 1,195  | Graceful shutdown, startup consistency check, preflight check                      |
| `state-transition/` | 2     | 788    | State machines (Task/Workflow/Session/Execution/Approval 5 sets)                  |
| `queue/`            | 6     | 771    | Queue adapter (SQLite/Redis) + factory                                            |
| `distributed-lock/` | 8     | 635    | Distributed lock (SQLite/PG Advisory/Redis) + factory                             |
| `resource/`         | 2     | 361    | Process tracking (PID + PGID)                                                      |
| `plugin-executor/`  | 1     | 48     | Plugin execution service (thin layer)                                              |

**Security Chain (7 Layers of Defense)**:

1. Metacharacter detection → 2. Command policy (deny-by-default) → 3. Parameter validation → 4. Remote pipe detection → 5. Fork bomb detection → 6. Sandbox path verification (realpath + symlink) → 7. Output sanitization (secret redaction + injection detection)

### 3.2 `platform/state-evidence/` — State and Evidence Layer (169 files, 36,787 lines)

| Subdirectory                                       | Files | Lines   | Responsibilities                                                        |
| -------------------------------------------------- | ----- | ------- | ----------------------------------------------------------------------- |
| `truth/sqlite/`                                    | 47    | 13,934  | SQLite engine, AuthoritativeTaskStore delegation chain, 22 repositories |
| `truth/async-repositories/`                        | 22    | 6,585   | 21 Async\*Repository (PG-compatible async access)                        |
| `truth/postgres/`                                  | 11    | 2,200   | PgDatabase, Schema management                                           |
| `truth/other`                                      | 22    | 3,405   | Migration runner, storage quota, dual storage session, backend factory  |
| `memory/`                                          | 16    | 3,335   | Tiered memory: MemoryService, Promotion, Retrieval, ExperienceCache     |
| `knowledge/`                                       | 23    | 3,443   | Knowledge plane: BM25 + vector hybrid retrieval, ingestion pipeline, governance, archival |
| `events/`                                          | 10    | 2,149   | Three-tier event delivery (Tier 1/2/3), TypedEventBus, DurableEventBus |
| `artifacts/`                                      | 13    | 1,095   | Artifact lifecycle: storage→scan→preview→publish→govern→archive          |
| `checkpoints/`                                    | 1     | 324     | Workflow step checkpoints                                               |
| `dlq/` + `incident/` + `projections/` + `audit/` | 4     | 317     | DLQ, event projections, audit, incident management                     |

**AuthoritativeTaskStore Delegation Chain**:
`core → compat → delegating-governance → delegating-runtime → delegating-core → facade`
Legacy compat reduced from 8,469 lines in v5 to 308 lines (-96%), 22 repositories total 8,497 lines as primary data access layer.

### 3.3 `platform/shared/` — Shared Infrastructure (101 files, 24,618 lines)

| Subdirectory    | Files | Lines   | Responsibilities                                                                              |
| --------------- | ----- | ------- | --------------------------------------------------------------------------------------------- |
| `stability/`    | 32    | 13,328  | **Largest submodule**. 28+ rehearsal suites + VCR + evidence system + release gate            |
| `observability/`| 36    | 8,175   | StructuredLogger, Health, Metrics, SLI/SLO alerting (5 channels), anomaly detection, diagnostics, OTel |
| `cache/`        | 27    | 2,518   | Three-tier cache L1/L2/L3: Memory/SQLite/Redis/MultiLevel + strategy + governance            |
| `utils/`        | 3     | 321     | BoundedCache, Redis connection config                                                         |
| `lifecycle/`    | 3     | 276     | ServiceRegistry (dependency injection/service location)                                        |

### 3.4 `platform/control-plane/` — Control Plane (75 files, 24,309 lines)

| Subdirectory             | Files | Lines | Responsibilities                                                                              |
| ------------------------ | ----- | ----- | --------------------------------------------------------------------------------------------- |
| `incident-control/`      | 19    | 8,308 | DoctorService, EnterpriseGovernance, AutoStopLoss, DeploymentExecution, HumanTakeover        |
| `iam/`                   | 19    | 7,125 | PolicyEngine, SecretManagement (5 Providers), network egress, data classification, CVE intel, sandbox policy |
| `config-center/`         | 27    | 6,776 | ConfigGovernance, model metadata registration, startup Schema, 20+ CLI environment loaders   |
| `rollout-controller/`    | 2     | 502   | TrafficRoutingService (blue-green/canary)                                                    |
| `approval-center/`       | 3     | 495   | ApprovalService + timeout executor                                                            |
| `audit-export/`          | 2     | 346   | AuditExportService                                                                            |
| `policy-center/`         | 1     | 298   | PolicyCenterService                                                                           |
| `tenant/`                | 1     | 276   | TenantBoundaryRegistryService                                                                 |
| `replay-repair-control/` | 1     | 183   | ReplayRepairControlService                                                                    |

### 3.5 `platform/interface/` — Interface Layer (51 files, 9,563 lines)

| Subdirectory      | Files | Lines | Responsibilities                                                               |
| ----------------- | ----- | ----- | ------------------------------------------------------------------------------ |
| `api/`            | 31    | 5,141 | HttpApiServer, ApiAuth, MissionControl, OIDC/OAuth, middleware                |
| `channel-gateway/`| 13    | 3,472 | Channel gateway delivery (retry/rate-limit/DLQ/HMAC), WebSocket/SSE Bridge, target directory |
| `console-backend/`| 1     | 253   | OperatorConsoleBackendService                                                  |
| `scheduler/`      | 2     | 253   | LongRunningWorkflowService                                                    |
| `ingress/`        | 3     | 225   | RedisRateLimiter, DistributedRateLimiter                                      |
| `webhook/`        | 1     | 219   | WebhookIngressService                                                         |

### 3.6 `platform/orchestration/` — Orchestration Layer (80 files, 7,602 lines)

| Subdirectory | Files | Lines | Responsibilities                                                                               |
| ------------ | ----- | ----- | --------------------------------------------------------------------------------------------- |
| `oapeflir/`  | 62    | 5,159 | **OAPEFLIR Loop**: O→A→P→E→F→L→I→R eight stages. Contains learn/, improve-rollout/, workflow/, schemas/ |
| `routing/`   | 4     | 1,057 | IntakeRouter (keyword+trigger+intent routing), WorkflowPlanner, AgentTeamService              |
| `hitl/`      | 3     | 1,020 | HITL approval orchestration, operator console, explainability                                    |
| `planner/`   | 9     | 314   | DAG planning: PlanBuilder, DagValidator, Evaluator, Replanning, TaskDecomposition              |
| `escalation/`| 1     | 51    | EscalationService                                                                              |
| `replan/`    | 1     | 1     | re-export barrel                                                                               |

### 3.7 `platform/model-gateway/` — Model Gateway (17 files, 5,137 lines)

| Subdirectory                      | Files | Lines | Responsibilities                                                                                     |
| --------------------------------- | ----- | ----- | --------------------------------------------------------------------------------------------------- |
| `provider-registry/`               | 10    | 4,441 | UnifiedChatProvider, BaseChatProvider (template method), CircuitBreaker, 3 Providers (OpenAI/Anthropic/MiniMax), credential pool |
| `messages/`                        | 2     | 509   | Token estimation, message parsing                                                                    |
| `cost-tracker/`                    | 2     | 64    | BudgetGuard                                                                                         |
| `cache/` + `fallback/` + `router/` | 3     | 123   | Gateway cache, fallback, routing                                                                     |

### 3.8 `platform/contracts/` — Contracts Layer (34 files, 4,337 lines)

| Subdirectory           | Files | Lines | Responsibilities                                                                     |
| --------------------- | ----- | ----- | ----------------------------------------------------------------------------------- |
| `types/`             | 22    | 3,138 | TaskSnapshot, SessionRecord, WorkflowRecord and other Domain types + IDs + state enums |
| `errors.ts`          | 1     | 497   | AppError + 14 subclasses                                                            |
| `result-envelope/`   | 2     | 390   | Standardized result envelope                                                         |
| 7 envelope subdirs   | 7     | ~300  | Control commands, delegation requests, execution plan/receipt, model requests, request envelope, state commands |

### 3.9 `platform/prompt-engine/` — Prompt Engine (11 files, 2,521 lines)

| Subdirectory | Files | Lines | Responsibilities                                                                                                     |
| ------------ | ----- | ----- | ------------------------------------------------------------------------------------------------------------------- |
| `eval/`     | 7     | 2,087 | LlmEvalService, EvalDatasetJudge, ExecutionOutcomeEvaluator, PostExecutionQualityGate, PromptModelPolicyGovernance |
| `rollout/`  | 2     | 243   | PromptRolloutService, PlatformPromptReleaseOrchestration                                                              |
| `registry/` | 1     | 129   | PromptTemplateRegistryService                                                                                         |
| `renderer/` | 1     | 62    | PromptRendererService                                                                                                 |

### 3.10 `platform/compliance/` — Compliance (6 files, 591 lines)

| File                                | Lines | Responsibilities    |
| ----------------------------------- | ----- | ------------------- |
| `ComplianceCaseOrchestrationService`| ~200  | Compliance case orchestration |
| `DataResidencyPolicyService`        | ~100  | Data residency policy |
| `FieldEncryptionService`            | ~100  | Field encryption     |
| `ErasurePlanningService`            | ~100  | Erasure planning     |
| `DataLineageService`                | ~80   | Data lineage         |

---

## 4. Business and Interaction Layer Module-by-Module Deep Analysis

### 4.1 `scale-ecosystem/marketplace/` — Marketplace and Billing (26 files, 7,737 lines)

| Core Services                         | Lines | Responsibilities                                                              |
| ------------------------------------- | ----- | --------------------------------------------------------------------------- |
| `BillingService`                      | 791   | Complete billing: account/quota/metering/invoice/payment session/credit management |
| `MarketplaceGovernanceService`        | 788   | Extension package registration/review/publish/withdrawal/directory governance |
| `PerceptionService`                   | 656   | Intelligence source registration, intelligence ingestion, brief construction, action recommendations |
| `DataPlaneFlowService`               | 649   | Analyze facts, archive packages, replay datasets, data migration             |
| `EnterpriseCapabilityMatrixService`  | 641   | Capability matrix, environment readiness, tiered gating                    |
| `TenantPlatformService`               | 586   | Tenant/organization/workspace CRUD + deployment binding                      |
| `LicenseEnforcementService`           | 584   | License check, feature gating, usage metering                               |
| `PmfValidationService`               | 578   | PMF validation: survey/metrics/adjudication calculation                      |
| `BillingPaymentGateway`              | 549   | 3 gateway implementations (Manual/Stripe/Paddle)                            |
| `PlatformOperatorService`            | 531   | Operations report, execution plane summary, stable version management       |

### 4.2 `scale-ecosystem/feedback-loop/` — Feedback Loop (9 files, 739 lines)

Signal collection → preprocessing → trend analysis → improvement candidates → review → closed loop. `SignalPreprocessor` (239 lines) normalization/deduplication/scoring; `DomainEventFeedbackConsumer` (206 lines) subscribes to TypedEventBus to convert domain events into feedback signals.

### 4.3 `domains/` — Business Domains (34 files, 5,076 lines)

| Submodule        | Files | Lines | Core                                                                                          |
| ---------------- | ----- | ----- | --------------------------------------------------------------------------------------------- |
| `registry/`       | 15    | 2,612 | `PluginSpiRegistry` (829 lines, complete SPI lifecycle), `PluginRuntimeHost` (611 lines, subprocess isolation) |
| `governance/`     | 5     | 1,636 | `DivisionLoader` (798 lines, YAML definition loading/validation), `HrRoleGovernanceService` (571 lines) |
| `prompt-library/` | 2     | 182   | Prompt template parsing + governance (review/rollout/rollback)                                 |
| `operations/`     | 2     | 153   | DomainOnboardingService (4-stage gating)                                                     |
| `eval-framework/` | 2     | 126   | Evaluation gating + regression suite                                                         |
| Other 5 submodules| 8     | 367   | Risk profiles, coding presets, interaction strategies, knowledge Schema, Recipes               |

### 4.4 `interaction/` — Intelligent Interaction (28 files, 2,608 lines)

| Submodule          | Files | Lines | Core Services                                                                      |
| ------------------ | ----- | ----- | --------------------------------------------------------------------------------- |
| `nl-gateway/`      | 4     | 553   | `NlEntryService` (505 lines): intent extraction, entity parsing, ambiguity detection, risk preview, cost estimation |
| `goal-decomposer/`| 4     | 427   | `GoalDecompositionService`: high-level goal → task DAG + dependencies + cost      |
| `proactive-agent/` | 4     | 379   | `ProactiveAgentService`: schedule/event/threshold/webhook triggering               |
| `dashboard/`       | 4     | 372   | `DashboardAggregationService`: 5 dashboard views + watchlist + health cards       |
| `ux/`              | 6     | 537   | Guided wizard, template engine, workflow builder, UX orchestration                 |
| `autonomy/`        | 5     | 328   | Progressive autonomy (5 levels), trust scoring, promotion engine, autonomy governance |

### 4.5 `ops-maturity/` — Operations Maturity (72 files, 4,397 lines)

| Submodule            | Files | Lines  | Core                                                                                  |
| ------------------- | ----- | ------ | ------------------------------------------------------------------------------------- |
| `drift-detection/`  | 15    | 2,399  | `EvolutionMvpService` (645 lines, complete evolution lifecycle), proposal/reflection/baseline/promotion/release management |
| `platform-ops-agent/`| 7     | 291    | Autonomous ops Agent: signal classification, action recommendations, maturity gating  |
| `emergency/`       | 5     | 229    | Platform panic: 4 freeze modes, propagation, recovery                                 |
| `agent-lifecycle/`  | 6     | 221    | Agent version management, canary binding, retirement                                  |
| `multimodal/`       | 6     | 214    | Image/audio/document processing, modality routing                                    |
| `capacity-planner/` | 5     | 193    | Prediction, trend analysis, scenario simulation                                       |
| `edge-runtime/`     | 6     | 177    | Offline execution, sync queue, local model                                           |
| `compliance-reporter/`| 5   | 174    | Report pipeline, templates, evidence mapping                                         |
| `explainability/`   | 6     | 160    | Causal chains, evidence collection, explanation cache                                 |
| `cost-optimizer/`   | 5     | 153    | Cost attribution, simulation, recommendations                                        |
| `workflow-debugger/` | 5     | 139    | Breakpoint debugging, timeline rendering, run comparison                              |

### 4.6 `org-governance/` — Organization Governance (30 files, 1,222 lines)

| Submodule              | Files | Lines | Core                                                                              |
| ---------------------- | ----- | ----- | --------------------------------------------------------------------------------- |
| `org-model/`            | 5     | 639   | Organization node hierarchy, `HrRoleGovernanceService` (571 lines, **duplicate with domains/**) |
| `approval-routing/`     | 5     | 162   | Approval routing engine + escalation + delegation                                  |
| `knowledge-boundary/`   | 5     | 121   | Knowledge boundary management, access logs, sharing gate                           |
| `compliance-engine/`    | 5     | 109   | Policy parsing, inheritance, audit execution                                      |
| `sso-scim/`            | 5     | 90    | OIDC/SAML/SCIM identity sync                                                     |
| `delegated-governance/` | 4     | 78    | Delegation registry, scope management                                             |

### 4.7 `plugins/` — Plugins (20 files, 1,672 lines)

5 SPI types: Retriever(6), Adapter(5), Presenter(3), Planner(1), Validator(1).
Registered via `builtin-plugin-registry.ts`, running in subprocess sandbox. 2 domain configuration files (growth 208 lines, operations 185 lines).

### 4.8 `sdk/` — SDK and CLI (87 files, 7,268 lines)

- **CLI** (79 files, 6,231 lines): 78 entry points. 3 bootstrap modes (`withCliStorage`, `createStableCli()`, top-level command style). Largest: `authoritative-storage.ts` (406 lines), `api-server.ts` (307 lines)
- **pack-sdk/** (4 files, 819 lines): `PackLifecycleOrchestrationService` (490 lines) — business package registration/test/certification/publish/deprecation
- **workbench/** (1 file, 134 lines), **plugin-sdk/** (1 file, 41 lines), **client-sdk/** (1 file, 38 lines)

### 4.9 `apps/` and `core/`

- **apps/** (4 files, 50 lines): 3 `PlatformAppManifest` (api:8004, console:3000, worker:no port)
- **core/** (8 files, 29 lines): Pure re-export shim pointing to `platform/execution/` and `platform/state-evidence/`, **should be deleted**

---

## 5. Core Call Chain Analysis

### 5.1 Request Ingestion Chain

```
User Request (CLI/SDK/SSE/API)
    ↓
IntakeRouter.route()
  [platform/orchestration/routing/intake-router.ts]
    - Input normalization → Intent classification (query/create/modify/approve/cancel/clarify)
    - Trigger matching selects Division (by priority descending)
    - Determine if multi-step orchestration is needed
    ↓
DivisionLoader.loadAll() → DivisionRegistry
  [domains/governance/division-loader.ts]
    ↓
OapeflirLoopService.runLoop()
  [platform/orchestration/oapeflir/oapeflir-loop-service.ts]
    - Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Rollout
    ↓
RuntimeExecuteBridge.execute()
  [platform/orchestration/oapeflir/runtime-execute-bridge.ts]
    ↓
AgentExecutor.executeAgentRound()
  [platform/execution/execution-engine/agent-executor.ts]
    - before_agent → before_model → wrap_model_call → after_model → after_agent
    ↓
TransitionService.transition() — 5 sets of state machines
  [platform/execution/state-transition/transition-service.ts]
    ↓
DurableEventBus.publish() → dispatch:ticket_created (Tier-2)
  [platform/state-evidence/events/durable-event-bus.ts]
```

### 5.2 Dispatch Chain

```
ExecutionDispatchService.dispatchNext()
  [platform/execution/dispatcher/execution-dispatch-service.ts]
    ↓
evaluateWorkersForTicket() — Worker eligibility check + load skew analysis
    ↓
ExecutionLeaseService.acquireLease()
  [platform/execution/lease/execution-lease-service.ts]
    - fencing_token = latest + 1, 5-step verification
    ↓
DurableEventBus.publish() → dispatch:ticket_claimed (Tier-2)
```

### 5.3 Tool Execution Chain

```
SkillExecutionService.execute()
  [platform/execution/tool-executor/skill-execution-service.ts]
    ↓
Cache lookup (SHA256 + gitHead) → For each step:
    CommandExecutor.execute()
      [platform/execution/tool-executor/command-executor.ts]
        1. Concurrency check (max 16)
        2. CommandSecurity 7-layer evaluation
        3. Sandbox path verification (realpath + symlink)
        4. spawnTracked()
        5. sanitizeToolOutput()
          [platform/execution/tool-executor/tool-output-sanitizer.ts]
```

### 5.4 Event Delivery Chain

```
DurableEventBus.publish({ eventType, payload, tier })
  [platform/state-evidence/events/durable-event-bus.ts]
    ↓
db.transaction(): Insert EventRecord → Create ack records (Tier 1/2)
    ↓
scheduleFanOut() → deliverPending() → deliverSingleEvent()
    MAX_DELIVERY_RETRIES=3, calculateBackoff()
    ↓
Consumer ack() or status:"failed"
```

### 5.5 Gateway Delivery Chain

```
ChannelGatewayService.sendMessage()
  [platform/interface/channel-gateway/channel-gateway-service.ts]
    ↓
GatewayTargetDirectoryService.resolveTarget() — 6-level resolution
  [platform/interface/channel-gateway/gateway-target-directory-service.ts]
    ↓
deliverResolvedTarget() — Telegram/Slack/Webhook (HMAC-SHA256)
    ↓
On failure: recordDeliveryFailure() → retry (backoff, max 5) or dead letter
    ↓
ChannelGatewayRetryExecutor (every 15s): batch 25, rate limit → re-deliver
```

### 5.6 Recovery Replay Chain

```
RuntimeRecoveryService.buildRuntimeRecoveryView()
  [platform/execution/recovery/runtime-recovery-service.ts]
    ↓
RuntimeRecoveryDecisionService.decide()
    ↓
RuntimeRecoveryReplayService.buildTaskReplayReport()
    - Read Tier-1 events → replay in time order → rebuild consistent state
    ↓
ExecutionLeaseService.acquireLease() — reclaim expired leases
    ↓
TransitionService.transition() — fix state
```

---

## 6. Module Dependency and Boundary Analysis

### 6.1 Seven-Layer Dependency Flow

```
contracts  ←── Foundation, imported by all modules
    │
shared/observability  ←── Imported by most modules
    │
state-evidence ←──→ execution ←──→ orchestration
    │                  │                │
    v                  │                v
control-plane ←────────┘          prompt-engine
    │
    v
interface
    │
model-gateway
    │
compliance (relatively independent)
```

### 6.2 Cross-Layer Dependency Matrix

```
platform/  ←────── core/ (pure re-export)
    ^
    │  ┌──── domains/ ────── plugins/ (bidirectional: plugin SPI)
    │  │         │
    │  │         └──→ scale-ecosystem/ (connector framework)
    │  │
    ├──┤──── interaction/ ──→ scale-ecosystem/ (cost estimation)
    │  │
    ├──┤──── ops-maturity/ (only depends on platform/)
    │  │
    ├──┤──── org-governance/ ──→ domains/ (division loader)
    │  │
    ├──┤──── scale-ecosystem/ (only depends on platform/)
    │  │
    └──┴──── sdk/ ──→ scale-ecosystem/, plugins/, domains/
```

### 6.3 Platform Internal Bidirectional Dependencies

| Dependency Pair                 | Direction | Import Count | Description                               |
| ------------------------------ | --------- | ------------ | ----------------------------------------- |
| execution ↔ state-evidence     | Bidirectional | 16 + 3    | Expected: execution engine reads/writes state |
| execution ↔ orchestration      | Bidirectional | 7 + 1     | Execution engine needs orchestration types   |
| shared ↔ control-plane         | Bidirectional | 5 + 13    | stability/ rehearsal modules need control-plane services |
| state-evidence → model-gateway | Unidirectional | 2         | token estimation                            |
| state-evidence → prompt-engine | Unidirectional | 2         | eval schema                                 |
| state-evidence → domains       | Cross-layer | 3           | plugin-spi, domain-registry               |

### 6.4 Leaf Modules (Zero Internal Dependencies)

| Module                   | Lines |
| ------------------------ | ----- |
| `contracts/errors.ts`    | 497   |
| `contracts/constants/`   | 16    |
| `contracts/types/ids.ts` | 47    |
| `shared/utils/`          | 321   |
| `apps/`                  | 50    |

### 6.5 Factory Pattern

| Factory                  | Optional Backends                | Location                    |
| ------------------------ | ------------------------------- | -------------------------- |
| `StorageBackendFactory`  | SQLite / PostgreSQL             | `state-evidence/truth/`    |
| `QueueAdapterFactory`    | SQLite / Redis               | `execution/queue/`            |
| `DistributedLockFactory` | SQLite / PG Advisory / Redis | `execution/distributed-lock/` |

### 6.6 单例管理

`shared/lifecycle/service-registry.ts`（268 行）管理: division-loader、tool-registry、middleware-context、agent-executor-context、network-egress-audit/policy、output-continuation、model-call-provider、graceful-shutdown、process-tracker。

### 6.7 Sync/Async 双模式

多个服务同时提供同步（SQLite）和异步（PostgreSQL）版本:
`ExecutionLeaseService`/Async、`HaCoordinatorService`/Async、`HotUpgradeService`/Async、`ExecutionDispatchService`/Async、`ExecutionWorkerHandshakeService`/Async、`ExecutionWorkerWritebackService`/Async、`DurableEventBus`/Async + 21 个 Async\*Repository。

---

## 7. 代码质量问题

### 7.1 类型安全

| 问题                     | 数量              | 严重度 |
| ------------------------ | ----------------- | ------ |
| `as unknown as` 类型断言 | ~50 处（24 文件） | 中     |
| `as any`                 | 3 处              | 低     |
| 无 schema 校验的查询结果 | 全部 store 方法   | 中     |
| 空值断言 `!`             | 多处（未统计）    | 中     |

### 7.2 代码重复

| 问题                                                                                                                    | 影响         | 严重度 |
| ----------------------------------------------------------------------------------------------------------------------- | ------------ | ------ |
| `HrRoleGovernanceService` 两份（`domains/governance/` 和 `org-governance/org-model/`，571 行 × 2，仅 2 行 import 不同） | 1,142 行冗余 | 高     |
| CLI 治理文件共享大块初始化代码（doctor/ops-governance/enterprise-governance）                                           | ~300 行      | 中     |
| `trust-scorer/index.ts`（21 行）与 `autonomy/index.ts` 中 `trustLevelFromScore` + `scoreCapability` 重复                | 21 行        | 低     |
| CLI 输出方式不一致（`console.log` vs `process.stdout.write`）                                                           | ~50 处       | 低     |

### 7.3 冗余代码

| 问题                                                          | 行数    | 严重度 |
| ------------------------------------------------------------- | ------- | ------ |
| `src/core/runtime/` 8 个 re-export 垫片                       | 29      | 中     |
| `platform/shared/lifecycle/evolution-mvp-service.ts` 1 行垫片 | 1       | 低     |
| 4 个不完整 async 包装（marketplace 3 + drift-detection 1）    | ~205    | 中     |
| 43 个空桩 `export {}` 文件                                    | 43 文件 | 中     |

### 7.4 复杂度中心

| 文件                           | 行数  | 模块            | 问题                |
| ------------------------------ | ----- | --------------- | ------------------- |
| `worker-repository.ts`         | 1,057 | state-evidence  | Repository 最大文件 |
| `async worker-repository.ts`   | 1,052 | state-evidence  | 同步版镜像          |
| `operations-repository.ts`     | 868   | state-evidence  | 运维数据访问复杂    |
| `slo-alerting-service.ts`      | 799   | shared          | 5 通道告警          |
| `execution-lease-service.ts`   | 796   | execution       | 多重验证链          |
| `anomaly-detection-service.ts` | 795   | shared          | 统计逻辑复杂        |
| `billing-service.ts`           | 791   | scale-ecosystem | 完整计费引擎        |
| `patch-dsl-service.ts`         | 791   | execution       | DSL 解析            |
| `plugin-spi-registry.ts`       | 829   | domains         | 单文件偏大          |

### 7.5 文档路径过时

6 个根级 Markdown（`src/README.md`、`MEMORY.md`、`CLAUDE.md`、`README.md`、`AGENTS.md`、`MIGRATION_BASELINE.md`）仍引用 `src/core/`、`src/cli/`、`src/gateway/` 等不存在路径。

---

## 8. 安全与可靠性分析

### 8.1 安全能力矩阵

| 能力             | 状态            | 位置                                                         | 评价                    |
| ---------------- | --------------- | ------------------------------------------------------------ | ----------------------- |
| Sandbox 路径验证 | **Implemented** | `control-plane/iam/sandbox-policy.ts` (327 行, 3 模式)       | realpath + symlink 检测 |
| Shell 注入防御   | **Implemented** | `execution/tool-executor/command-executor.ts` 7 层防御       | 完整                    |
| 命令策略         | **Implemented** | deny-by-default, 未知命令拒绝                                | 完整                    |
| 输出清理         | **Implemented** | `execution/tool-executor/tool-output-sanitizer.ts`           | secret 脱敏 + 注入检测  |
| OIDC/OAuth       | **Implemented** | `interface/api/oidc-oauth/`                                  | JWKS + IdP 令牌校验     |
| JWT 认证         | **Implemented** | `interface/api/api-auth-service.ts`                          | 缺少算法白名单          |
| Secret 管理      | **Implemented** | `control-plane/iam/` (510 行, 5 Provider)                    | 云 Provider 未生产验证  |
| CVE 情报         | **Implemented** | `control-plane/iam/cve-intelligence-service.ts` (748 行)     | 完整                    |
| 网络出口控制     | **Implemented** | `control-plane/iam/` network-egress-\* + outbound-url-policy | 完整                    |
| 数据分类         | **Implemented** | `control-plane/iam/data-classification-service.ts` (730 行)  | PII/敏感数据            |
| 审计完整性       | **Implemented** | `control-plane/iam/audit-event-integrity.ts`                 | Tier-1 审计事件链       |
| MCP 工具防护     | **Implemented** | `execution/tool-executor/mcp-tool-guard.ts`                  | 完整                    |

### 8.2 可靠性能力矩阵

| 能力                 | 状态             | 位置                                                          | 评价       |
| -------------------- | ---------------- | ------------------------------------------------------------- | ---------- |
| 租约 + fencing token | **Implemented**  | `execution/lease/` (796 行, 5 步验证)                         | 完整       |
| 事务性状态更新       | **Implemented**  | `db.transaction()` 包裹状态变更                               | 完整       |
| Tier-1 事件持久化    | **Implemented**  | `state-evidence/events/durable-event-bus.ts`                  | 完整       |
| 优雅关闭             | **Implemented**  | `execution/startup/graceful-shutdown.ts` (276 行)             | 完整       |
| 进程追踪             | **Implemented**  | `execution/resource/process-tracker.ts`                       | PID + PGID |
| 循环检测             | **Implemented**  | `execution/execution-engine/loop-detection.ts` (443 行)       | 完整       |
| 准入控制             | **Implemented**  | `execution/execution-engine/admission-controller.ts`          | 完整       |
| 上下文压缩           | **Implemented**  | `execution/execution-engine/context-compaction-service.ts`    | 完整       |
| Gateway 重试 + DLQ   | **Implemented**  | 指数退避, max 5 次, 限流, 死信队列                            | 完整       |
| 断路器               | **Implemented**  | `model-gateway/provider-registry/circuit-breaker.ts` (289 行) | 需生产验证 |
| 热升级               | **Experimental** | `execution/hot-upgrade/` (1,952 行)                           | 需验证     |
| 跨区域部署           | **Experimental** | `execution/ha/cross-region-deployment-service.ts` (663 行)    | 需验证     |
| 稳定性排练           | **Implemented**  | `shared/stability/` (32 文件, 13,328 行, 28+ 排练套件)        | 完整       |

### 8.3 可观测性能力矩阵

| 能力            | 状态            | 位置                                                                                |
| --------------- | --------------- | ----------------------------------------------------------------------------------- |
| 结构化日志      | **Implemented** | `shared/observability/structured-logger.ts` (342 行, 环形缓冲)                      |
| 健康检查        | **Implemented** | 4 级: ok → degraded → overloaded → unhealthy                                        |
| Prometheus 导出 | **Implemented** | `shared/observability/prometheus-metrics-exporter.ts`                               |
| OpenTelemetry   | **Implemented** | `shared/observability/otel-bootstrap.ts` + `otel-tracer.ts`                         |
| 日志传输        | **Implemented** | 3 通道: Stdout / Fluentd / Datadog                                                  |
| 诊断服务        | **Implemented** | `shared/observability/diagnostics-service.ts` + `diagnostics-support.ts` (1,165 行) |
| 异常检测        | **Implemented** | `shared/observability/anomaly-detection-service.ts` (795 行)                        |
| SLI/SLO 告警    | **Implemented** | `shared/observability/slo-alerting-service.ts` (799 行, 5 通道)                     |
| 分布式追踪      | **Implemented** | `shared/observability/trace-context.ts` + OTel 集成                                 |

---

## §9 测试体系分析

### 9.1 测试规模总览

| 维度         | 数值                               |
| ------------ | ---------------------------------- |
| 测试文件总数 | 1,018                              |
| 测试代码行数 | 206,717                            |
| 测试用例数   | ~9,255                             |
| 辅助文件     | 19 (2,120 行)                      |
| 夹具文件     | 4 (459 行)                         |
| 黄金快照文件 | 3 (332 行)                         |
| 测试框架     | `node:test` + `node:assert/strict` |
| 外部测试依赖 | 无 (零 Jest/Mocha/Sinon/Chai)      |
| 并发度       | `--test-concurrency=12`            |

### 9.2 按目录分布

| 目录                 |    文件数 |        行数 |
| -------------------- | --------: | ----------: |
| `tests/unit/`        |       704 |     148,154 |
| `tests/integration/` |       289 |      53,317 |
| `tests/e2e/`         |        10 |       2,807 |
| `tests/golden/`      |         8 |       1,330 |
| `tests/performance/` |         6 |         874 |
| `tests/fixtures/`    |         1 |         235 |
| **合计**             | **1,018** | **206,717** |

### 9.3 单元测试细分 (704 文件, 148,154 行)

| 子区域                  | 文件数 |    行数 |
| ----------------------- | -----: | ------: |
| `unit/platform/`        |    519 | 111,903 |
| `unit/runtime/`         |     45 |  15,050 |
| `unit/scale-ecosystem/` |     37 |   7,917 |
| `unit/domains/`         |     25 |   4,520 |
| `unit/ops-maturity/`    |     27 |   3,776 |
| `unit/plugins/`         |     18 |   2,644 |
| `unit/sdk/`             |     10 |     915 |
| `unit/interaction/`     |      9 |     659 |
| `unit/org-governance/`  |      8 |     585 |
| `unit/apps/`            |      4 |      39 |
| `unit/docs/`            |      1 |     120 |
| `unit/core/`            |      1 |      26 |

**Platform 单元测试深度拆分 (519 文件, 111,903 行):**

| 子模块                          | 文件数 |   行数 |
| ------------------------------- | -----: | -----: |
| `unit/platform/state-evidence/` |    102 | 31,659 |
| `unit/platform/shared/`         |     88 | 15,894 |
| `unit/platform/control-plane/`  |     82 | 14,960 |
| `unit/platform/execution/`      |     63 | 12,921 |
| `unit/platform/orchestration/`  |     59 | 11,634 |
| `unit/platform/interface/`      |     53 | 10,954 |
| `unit/platform/contracts/`      |     33 |  6,482 |
| `unit/platform/model-gateway/`  |     21 |  5,873 |
| `unit/platform/prompt-engine/`  |     11 |  1,262 |
| `unit/platform/compliance/`     |      6 |    244 |

### 9.4 集成测试细分 (289 文件, 53,317 行)

| 子区域                         | 文件数 |   行数 |
| ------------------------------ | -----: | -----: |
| `integration/platform/`        |    220 | 41,277 |
| `integration/sdk/`             |     35 |  9,165 |
| `integration/ops-maturity/`    |     12 |    783 |
| `integration/domains/`         |      6 |    604 |
| `integration/scale-ecosystem/` |      7 |    499 |
| `integration/stability/`       |      2 |    263 |
| `integration/workflow/`        |      2 |    218 |
| `integration/org-governance/`  |      2 |    188 |
| `integration/orchestration/`   |      1 |    185 |
| `integration/interaction/`     |      2 |    135 |

**Platform 集成测试深度拆分 (220 文件, 41,277 行):**

| 子模块                                 | 文件数 |   行数 |
| -------------------------------------- | -----: | -----: |
| `integration/platform/execution/`      |     83 | 15,735 |
| `integration/platform/security/`       |     63 |  9,019 |
| `integration/platform/state-evidence/` |     19 |  3,749 |
| `integration/platform/contracts/`      |     13 |  3,266 |
| `integration/platform/shared/`         |     13 |  3,124 |
| `integration/platform/control-plane/`  |     10 |  2,842 |
| `integration/platform/interface/`      |      4 |  1,167 |
| `integration/platform/model-gateway/`  |      7 |  1,066 |
| `integration/platform/orchestration/`  |      3 |    855 |
| `integration/platform/prompt-engine/`  |      3 |    320 |
| `integration/platform/compliance/`     |      2 |    134 |

### 9.5 Top 15 最大测试文件

| 排名 | 文件                                                                              |  行数 |
| ---: | --------------------------------------------------------------------------------- | ----: |
|    1 | `integration/sdk/cli/ops-cli.test.ts`                                             | 3,916 |
|    2 | `unit/runtime/execution-handshake.test.ts`                                        | 1,873 |
|    3 | `unit/platform/state-evidence/truth/async-repositories.test.ts`                   | 1,699 |
|    4 | `integration/platform/execution/execution-dispatch-service.test.ts`               | 1,684 |
|    5 | `unit/platform/interface/api/http-api-server.test.ts`                             | 1,557 |
|    6 | `unit/runtime/execution-dispatch-service.test.ts`                                 | 1,378 |
|    7 | `unit/runtime/execution-lease-service.test.ts`                                    | 1,251 |
|    8 | `integration/platform/control-plane/incident-control/doctor.test.ts`              | 1,212 |
|    9 | `unit/platform/model-gateway/provider-registry/openai-chat-service.test.ts`       | 1,195 |
|   10 | `unit/scale-ecosystem/marketplace/billing-payment-gateway.test.ts`                | 1,146 |
|   11 | `unit/platform/state-evidence/memory/memory-service.test.ts`                      | 1,104 |
|   12 | `unit/platform/model-gateway/provider-registry/anthropic-chat-service.test.ts`    | 1,060 |
|   13 | `integration/platform/execution/startup-consistency-recovery.test.ts`             | 1,027 |
|   14 | `unit/platform/state-evidence/truth/repositories/organization-repository.test.ts` | 1,022 |
|   15 | `integration/platform/contracts/v2-7-extension-contracts.test.ts`                 |   983 |

### 9.6 测试框架与模式

- **运行器**: `node:test` — 1,015/1,018 文件导入
- **断言库**: `node:assert/strict` — 1,009 文件导入
- **注册模式**: 扁平 `test()` 为主 (9,116 次), `it()` 仅 139 次, `describe()` 仅 8 次
- **Mock**: `node:test` 内置 mock 对象, 仅 3 文件使用
- **零外部依赖**: 不使用 Jest / Mocha / Sinon / Chai

### 9.7 覆盖率配置

**c8 覆盖率工具 (`.c8rc.json`)**:

- 报告格式: `text`, `html`, `lcov`, `json-summary`
- 范围: `dist/src/**/*.js`, 启用 `all: true` 全量插桩
- 排除: `dist/tests/`, `node_modules/`, `scripts/`, 配置文件

**覆盖率基线 (`.coverage-baseline.json`)**:

| 指标   | 最低要求 |
| ------ | -------: |
| Lines  |    84.1% |
| Stmts  |    84.1% |
| Funcs  |    82.8% |
| Branch |    79.8% |

- 跟踪 **42 个源码目录** 的独立指标
- CI 门控: `scripts/ci/check-coverage-baseline.mjs` — 覆盖率下降即阻断
- 棘轮更新: `scripts/ci/update-coverage-baseline.mjs` — 只允许向上调整

**变异测试 (Stryker)**:

- 9 个关键路径文件参与变异测试
- 阈值: high=80, low=60, break=50
- 目标: auth/billing/approval/gateway 路由 + OAPEFLIR 循环 + Redis 配置

### 9.8 测试脚本矩阵

| 脚本                            | 用途                     |
| ------------------------------- | ------------------------ |
| `npm test`                      | 全量回归 + 覆盖率门控    |
| `npm run test:unit`             | 仅单元测试               |
| `npm run test:integration`      | 仅集成测试               |
| `npm run test:golden`           | 仅黄金快照测试           |
| `npm run test:pg-integration`   | PostgreSQL 集成 (并发=1) |
| `npm run test:performance`      | 性能基准 (并发=1)        |
| `npm run test:mutation`         | Stryker 变异测试         |
| `npm run test:secret-providers` | 密钥提供者隔离测试       |

### 9.9 测试辅助体系

**`tests/helpers/` (19 文件, 2,120 行)** — 关键文件:

| 文件                     | 行数 | 用途              |
| ------------------------ | ---: | ----------------- |
| `api.ts`                 |  362 | HTTP API 测试辅助 |
| `pmf.ts`                 |  251 | PMF 场景构建器    |
| `fixtures/composite.ts`  |  227 | 复合夹具生成      |
| `concurrent-runner.ts`   |  158 | 并发测试运行器    |
| `typed-factories.ts`     |  143 | 类型安全工厂方法  |
| `integration-context.ts` |  131 | 集成测试上下文    |
| `e2e-harness.ts`         |  131 | E2E 测试工具      |

### 9.10 测试体系评估

**优势**:

- 测试代码量 (206,717 行) 超过源码量 (191,611 行), 测试密度 1.08:1
- 零外部测试依赖, 完全基于 Node.js 内置能力
- 覆盖率基线门控 + 变异测试双重保障
- 42 个目录级独立覆盖率追踪

**风险**:

- E2E 测试仅 10 文件 (2,807 行), 缺少端到端场景覆盖
- `tests/unit/runtime/` (45 文件) 未对齐到新 7 层结构, 应迁移至 `unit/platform/`
- `tests/unit/core/` 和 `tests/unit/apps/` 各仅 1/4 文件, 覆盖率极低
- 最大测试文件 (ops-cli.test.ts, 3,916 行) 过于庞大, 建议拆分

---

## §10 配置与部署架构

### 10.1 配置体系

**27 个 JSON 文件, 652 行, 分布于 9 个子目录:**

| 目录                   | 文件数 | 职责                                          |
| ---------------------- | -----: | --------------------------------------------- |
| `config/runtime/`      |      6 | 运行时参数: 并发数 / 任务超时 / 步骤超时      |
| `config/security/`     |      6 | 审批模式 / 沙箱级别 / 破坏性操作控制          |
| `config/environments/` |      5 | 部署描述符: 注册表 / 命名空间 / 发布策略      |
| `config/providers/`    |      3 | 模型提供者: OpenAI / Anthropic / MiniMax 配置 |
| `config/bootstrap/`    |      1 | 应用身份: 名称 / 阶段门控 / 核心启用          |
| `config/domains/`      |      1 | 领域定义: Coding 工作流 / 工具包 / 模型偏好   |
| `config/gateways/`     |      1 | 网关默认值: CLI 接口 / SSE 流                 |
| `config/knowledge/`    |      1 | 知识命名空间: 访问策略 / 容量限制 / 新鲜度    |
| `config/plugins/`      |      1 | 插件清单: 3 个内置插件的沙箱约束              |
| `config/product/`      |      1 | 计费方案: Community / Pro / Enterprise 三档   |

### 10.2 环境梯度 (5 级)

`dev` → `test` → `staging` → `pre-prod` → `prod`, 在 4 层配置中逐级收紧:

| 维度            | dev             | test            | staging     | pre-prod           | prod               |
| --------------- | --------------- | --------------- | ----------- | ------------------ | ------------------ |
| 审批模式        | auto            | supervised      | supervised  | supervised         | **strict**         |
| 最大并发        | 1               | 2               | 4           | 6                  | **8**              |
| 任务超时        | 120s            | 180s            | 240s        | 300s               | **600s**           |
| 发布策略        | rolling, canary | rolling, canary | +blue_green | canary, blue_green | canary, blue_green |
| 副本数          | 1               | 1               | 2           | 2                  | **3**              |
| HPA             | 禁用            | 禁用            | 2-5         | 2-6                | **3-10**           |
| PDB             | 禁用            | 禁用            | min 1       | min 1              | **min 2**          |
| 存储驱动        | sqlite          | sqlite          | sqlite      | postgres           | **postgres**       |
| ExternalSecrets | 禁用            | 禁用            | 禁用        | AWS SM             | **AWS SM**         |
| 破坏性操作      | (未设)          | (未设)          | (未设)      | **false**          | **false**          |

### 10.3 Docker 配置

**Dockerfile (46 行)** — 两阶段构建:

| 阶段      | 基础镜像                | 用途                           |
| --------- | ----------------------- | ------------------------------ |
| `build`   | `node:22-bookworm-slim` | 全量依赖安装 + TypeScript 编译 |
| `runtime` | `node:22-bookworm-slim` | 仅生产依赖 + 编译产物          |

安全加固:

- 非 root 用户 `node` (UID 1000) 运行
- 所有文件 `--chown=node:node`
- 健康检查: `GET /healthz` (30s 间隔, 3 次重试)
- 暴露端口: **3000**

**docker-compose.yml (131 行)** — 5 个服务:

| 服务           | 镜像                        | 端口 | 关键配置                                                       |
| -------------- | --------------------------- | ---- | -------------------------------------------------------------- |
| `api-server`   | 本地构建                    | 3000 | 只读文件系统, 64MB tmpfs, 1 CPU / 512MB / 256 PIDs, 全能力丢弃 |
| `postgres`     | `postgres:16-bookworm`      | 5432 | 持久卷 `automatic-agent-postgres`                              |
| `redis`        | `redis:7-alpine`            | 6379 | AOF 禁用, 256MB 上限, LRU 淘汰                                 |
| `prometheus`   | `prom/prometheus:v2.54.1`   | 9090 | 挂载规则目录只读                                               |
| `alertmanager` | `prom/alertmanager:v0.27.0` | 9093 | 挂载配置只读                                                   |

### 10.4 CI/CD 工作流 (4 个)

**ci.yml (133 行)** — 主 CI 管线, 5 个作业:

| 作业             | 触发条件     | 职责                                                                                  |
| ---------------- | ------------ | ------------------------------------------------------------------------------------- |
| `validate`       | push/PR      | lint → audit → typecheck → test → coverage gate → stable validation (Node 20+22 矩阵) |
| `pg-integration` | push/PR      | PostgreSQL 16 服务容器, `test:pg-integration`                                         |
| `mutation-test`  | push to main | Stryker 变异测试                                                                      |
| `security`       | push/PR      | CodeQL TypeScript 静态分析                                                            |
| `trivy-scan`     | push/PR      | Docker 镜像 CRITICAL/HIGH 漏洞扫描                                                    |

**publish-image.yml (70 行)** — Docker 镜像发布:

- 手动触发 (`workflow_dispatch`), 输入: 环境 / 标签 / 仓库
- 预检 build → GHCR 登录 → Buildx 构建推送 (GHA 缓存)

**deploy-environment.yml (278 行)** — 环境部署:

- 手动触发, 5 级环境选择
- 支持 rolling / canary / blue_green 三策略
- AWS OIDC 认证 → kubectl + Helm 3.16.3
- 自动回滚: 部署失败时回退到上一 Helm 版本

**secret-provider-integration.yml (19 行)** — 密钥提供者集成测试

### 10.5 部署基础设施 (40 文件, ~2,533 行)

| 类别            | 文件数 | 行数 | 工具               |
| --------------- | -----: | ---: | ------------------ |
| Helm Charts     |     18 |  720 | Helm 3.16.3        |
| Terraform 模块  |      9 |  956 | Terraform + AWS    |
| Prometheus 规则 |      3 |   74 | Prometheus v2.54.1 |
| Grafana 仪表盘  |      2 |  348 | Grafana JSON       |
| Chaos 工程      |      4 |   59 | Chaos Mesh         |
| 部署脚本        |      3 |  323 | Bash               |
| 运维手册        |      1 |   53 | Markdown           |

**Terraform 架构** (`terraform/main.tf`, 359 行):

- AWS 提供者 (~> 5.0)
- VPC (3 AZ, 公有/私有子网, NAT 网关)
- EKS: Kubernetes 1.29, 托管节点组
- RDS: PostgreSQL 16.2, 加密, 生产多 AZ
- ElastiCache: Redis 7.1, 加密, 生产 3 集群自动故障转移
- ECR: 推送扫描, 14 天清理未标记镜像

**Helm Chart** (`automatic-agent` v0.1.0):

- Deployment (滚动更新, 非 root UID 1000, 三探针 + preStop 钩子)
- Service (ClusterIP, http + metrics 端口)
- Ingress (nginx, TLS) + Canary Ingress (权重注解)
- HPA (CPU + 内存自动伸缩) + PDB
- ExternalSecret (AWS Secrets Manager 集成)

**Prometheus 告警规则** (3 条):

- `AutomaticAgentHighErrorRate`: >5% 5xx 持续 10min → critical
- `AutomaticAgentTaskFailureRate`: >10% 失败持续 15min → warning
- `AutomaticAgentMemoryPressure`: RSS > 512MiB 持续 10min → warning

**Grafana 仪表盘** ("Automatic Agent Platform", 13 面板):

- 请求指标: 速率 / P50/P95/P99 延迟
- 执行与队列: 活跃执行 / 队列深度 / 提供者成功率
- OAPEFLIR 与知识: 阶段耗时 / 结果分布
- 系统健康: 内存 / 事件循环延迟 / Worker 健康比 / DLQ 大小

**Chaos 工程** (4 场景):

- Pod 杀死 (30s), 网络延迟 (500ms + 100ms 抖动, 2min)
- PostgreSQL 断连 (60s), Redis 断连 (60s)

### 10.6 脚本体系 (10 文件, 1,236 行)

| 脚本                                  | 行数 | 用途                            |
| ------------------------------------- | ---: | ------------------------------- |
| `reorg-code-structure.mjs`            |  754 | 代码结构重组: 旧平面 → 7 层架构 |
| `generate-src-module-test-matrix.mjs` |  200 | 生成源码-测试覆盖矩阵           |
| `restore-sqlite.sh`                   |   85 | SQLite 恢复 + 完整性校验        |
| `backup-sqlite.sh`                    |   84 | WAL 安全在线备份 + 保留策略     |
| `check-coverage-baseline.mjs`         |   42 | 覆盖率基线门控                  |
| `check-changelog.mjs`                 |   22 | 变更日志版本校验                |
| `update-coverage-baseline.mjs`        |   16 | 覆盖率基线棘轮更新              |
| `clean-dist.mjs`                      |   15 | 构建产物清理                    |
| `mutation-critical-tests.sh`          |   10 | 关键路径变异测试子集            |
| `generate-coverage-report.mjs`        |    8 | 覆盖率报告生成                  |

---

## §11 重构优先级与结论

### 11.1 P0 — 架构阻断项 (立即处理)

| 编号 | 问题                       | 影响                                                                            | 建议操作                                       |
| ---- | -------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------- |
| B1   | PostgreSQL 异步/同步不兼容 | 生产环境 (pre-prod/prod) 必须使用 postgres 驱动, 但大量仓储仍为同步 SQLite 实现 | 统一异步接口, 将 SQLite 降级为开发/测试后端    |
| B2   | `src/core/` 遗留垫片       | 8 个文件仅 29 行, 全部为单行 re-export, 增加路径混乱                            | 删除 `src/core/`, 直接引用 `src/platform/`     |
| B3   | E2E 覆盖率不足             | 仅 10 文件 / 2,807 行, 无法验证完整用户旅程                                     | 补充核心场景: 任务提交→调度→执行→结果交付→计费 |

### 11.2 P1 — 结构优化 (本迭代)

| 编号 | 问题                              | 建议操作                                              |
| ---- | --------------------------------- | ----------------------------------------------------- |
| S1   | CLI 启动入口碎片化 (79 个入口)    | 统一 CLI 框架, 子命令路由替代独立文件                 |
| S2   | `tests/unit/runtime/` 未对齐      | 迁移 45 文件至 `tests/unit/platform/` 对应子模块      |
| S3   | `shared ↔ control-plane` 双向依赖 | 提取稳定性排演为独立模块, 消除反向引用                |
| S4   | 26 个 re-export 桶文件            | 评估保留价值, 合并或删除冗余层                        |
| S5   | `execution` 跨模块耦合 (386 行)   | 引入 contracts 抽象, 减少对 state-evidence 的直接依赖 |

### 11.3 P2 — 质量提升 (下迭代)

| 编号 | 问题                       | 建议操作                                              |
| ---- | -------------------------- | ----------------------------------------------------- |
| Q1   | `as unknown as` 58 处      | 逐步替换为类型守卫或泛型约束                          |
| Q2   | 覆盖率基线部分目录低于 50% | 重点补充 `org-governance`, `interaction`, `apps` 测试 |
| Q3   | HA 验证仅在稳定性排演中    | 补充真实多副本 HA 集成测试                            |
| Q4   | Stryker 仅覆盖 9 个文件    | 扩展至 state-evidence 和 control-plane 关键路径       |
| Q5   | ops-cli.test.ts (3,916 行) | 拆分为按功能域的独立测试文件                          |

### 11.4 执行阶段建议

```
Phase 1 (Week 1-2):  B1 PostgreSQL 统一 + B2 core/ 删除
Phase 2 (Week 3-4):  S1 CLI 统一 + S2 测试目录对齐 + S3 双向依赖消除
Phase 3 (Week 5-6):  B3 E2E 覆盖 + Q1 类型安全 + Q2 覆盖率提升
Phase 4 (Week 7-8):  S4/S5 结构优化 + Q3/Q4/Q5 质量收尾
```

### 11.5 综合评估

| 维度       |       评分 | 说明                                                                                 |
| ---------- | ---------: | ------------------------------------------------------------------------------------ |
| 架构分层   |   **8/10** | 7 层职责清晰, 但 shared ↔ control-plane 双向依赖待解                                 |
| 代码规模   |   **9/10** | 1,052 文件 / 191,611 行, 模块粒度合理                                                |
| 测试密度   |   **8/10** | 1.08:1 测试/源码比, 覆盖率 84.1%, E2E 不足                                           |
| 安全加固   |   **9/10** | 12 项安全能力全部已实现, Trivy + CodeQL + 变异测试                                   |
| 可观测性   |   **9/10** | 9 项能力全部已实现, OTel + Prometheus + Grafana 完整链路                             |
| 可靠性     |   **8/10** | 13 项能力已实现, 缺少真实多副本 HA 验证                                              |
| 部署成熟度 |   **9/10** | 5 级环境梯度, Helm + Terraform + Chaos 全链路                                        |
| 配置管理   |   **8/10** | 27 文件 / 11 类别 / 4 层环境覆盖, 棘轮门控                                           |
| **综合**   | **8.5/10** | 从 v9 单层 core/ 到 v10 七层架构的重构已基本完成, 剩余工作集中在 P0 阻断项和测试补充 |

---

## 附录

### 附录 A: Top 20 源码文件 (按行数)

| 排名 |  行数 | 文件路径                                                                         |
| ---: | ----: | -------------------------------------------------------------------------------- |
|    1 | 1,057 | `src/platform/state-evidence/truth/sqlite/repositories/worker-repository.ts`     |
|    2 | 1,052 | `src/platform/state-evidence/truth/async-repositories/worker-repository.ts`      |
|    3 |   868 | `src/platform/state-evidence/truth/sqlite/repositories/operations-repository.ts` |
|    4 |   829 | `src/domains/registry/plugin-spi-registry.ts`                                    |
|    5 |   799 | `src/platform/shared/observability/slo-alerting-service.ts`                      |
|    6 |   798 | `src/domains/governance/division-loader.ts`                                      |
|    7 |   796 | `src/platform/execution/lease/execution-lease-service.ts`                        |
|    8 |   795 | `src/platform/shared/observability/anomaly-detection-service.ts`                 |
|    9 |   793 | `src/platform/state-evidence/truth/sqlite/repositories/billing-repository.ts`    |
|   10 |   791 | `src/scale-ecosystem/marketplace/billing-service.ts`                             |
|   11 |   791 | `src/platform/execution/tool-executor/patch-dsl-service.ts`                      |
|   12 |   789 | `src/platform/execution/worker-pool/execution-worker-handshake-service.ts`       |
|   13 |   788 | `src/scale-ecosystem/marketplace/marketplace-governance-service.ts`              |
|   14 |   786 | `src/platform/interface/channel-gateway/channel-gateway-delivery-service.ts`     |
|   15 |   782 | `src/platform/shared/observability/diagnostics-support.ts`                       |
|   16 |   782 | `src/platform/control-plane/incident-control/doctor-service.ts`                  |
|   17 |   779 | `src/platform/execution/execution-engine/multi-step-supervisor.ts`               |
|   18 |   774 | `src/platform/control-plane/config-center/remaining-cli-env-support.ts`          |
|   19 |   773 | `src/platform/control-plane/incident-control/enterprise-governance-service.ts`   |
|   20 |   768 | `src/platform/control-plane/incident-control/auto-stop-loss-service.ts`          |

### 附录 B: `as unknown as` 分布

| 目录                           | 出现次数 |
| ------------------------------ | -------: |
| `src/platform/execution/`      |       29 |
| `src/platform/state-evidence/` |       19 |
| `src/domains/governance/`      |        3 |
| `src/platform/shared/`         |        2 |
| `src/sdk/`                     |        2 |
| `src/platform/control-plane/`  |        1 |
| `src/domains/registry/`        |        1 |
| `src/plugins/`                 |        1 |
| **合计**                       |   **58** |

### 附录 C: 跨模块耦合矩阵 (Platform 层)

源模块 → 目标引用行数:

| 源模块 ↓ / 目标 →  | contracts | state-evidence | shared | control-plane | execution | orchestration | model-gateway | interface | prompt-engine |
| ------------------ | --------: | -------------: | -----: | ------------: | --------: | ------------: | ------------: | --------: | ------------: |
| **execution**      |       140 |            127 |     63 |            34 |         — |            12 |             6 |         4 |             — |
| **shared**         |        48 |             63 |      — |            15 |        80 |             4 |             — |         1 |             — |
| **control-plane**  |        94 |             45 |     24 |             — |        12 |             2 |             4 |         1 |             2 |
| **state-evidence** |       114 |              — |     16 |            10 |         4 |             1 |             4 |         — |             2 |
| **interface**      |        38 |             14 |     25 |             5 |         3 |             — |             — |         — |             — |
| **orchestration**  |        20 |              4 |      9 |             1 |         1 |             — |             — |         — |             4 |
| **model-gateway**  |        10 |              — |      8 |             8 |         — |             — |             — |         — |             1 |
| **prompt-engine**  |        12 |              2 |      — |             — |         — |             1 |             — |         — |             — |
| **compliance**     |         5 |              — |      — |             2 |         — |             — |             — |         — |             — |
| **contracts**      |         — |              — |      1 |             — |         — |             1 |             — |         — |             — |

耦合比 (跨模块文件/总文件):

| 模块           | 跨模块文件 | 总文件 |   耦合比 |
| -------------- | ---------: | -----: | -------: |
| control-plane  |         64 |     75 |    85.3% |
| prompt-engine  |          8 |     11 |    72.7% |
| execution      |        121 |    167 |    72.5% |
| compliance     |          4 |      6 |    66.7% |
| model-gateway  |         11 |     17 |    64.7% |
| interface      |         33 |     51 |    64.7% |
| state-evidence |         94 |    169 |    55.6% |
| shared         |         52 |    101 |    51.5% |
| orchestration  |         22 |     80 |    27.5% |
| contracts      |          2 |     34 | **5.9%** |

### 附录 D: 版本历史

| 版本 | 日期       | 主要变更                                                                                                                                                                                                             |
| ---- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v2   | —          | 初始版本, 基于 `src/core/` 单层架构                                                                                                                                                                                  |
| v3   | —          | 添加 CLI 层 (`src/cli/`)                                                                                                                                                                                             |
| v4   | —          | 添加 Gateway 层 (`src/gateway/`)                                                                                                                                                                                     |
| v5   | —          | 引入双维度状态系统                                                                                                                                                                                                   |
| v6   | —          | 安全矩阵扩展                                                                                                                                                                                                         |
| v7   | —          | 配置与部署章节                                                                                                                                                                                                       |
| v8   | —          | 测试体系分析                                                                                                                                                                                                         |
| v9   | —          | 1,541 行, 覆盖 core/ + cli/ + gateway/ 三层完整分析                                                                                                                                                                  |
| v10  | 2026-04-20 | **完全重写**: 7 层架构 (platform/domains/interaction/org-governance/scale-ecosystem/ops-maturity/plugins/sdk/apps), 1,052 文件 / 191,611 行源码, 1,018 文件 / 206,717 行测试, 全新配置与部署架构章节, 跨模块耦合矩阵 |

---

_文档版本: v10 | 生成日期: 2026-04-20 | 源码快照: 1,052 文件 / 191,611 行 | 测试快照: 1,018 文件 / 206,717 行_
