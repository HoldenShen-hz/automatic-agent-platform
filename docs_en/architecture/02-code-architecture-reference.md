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
| Production-ready  | Confirmed via traffic validation, fault injection, monitoring closed-loop |

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

### 6.6 Singleton Management

`shared/lifecycle/service-registry.ts` (268 lines) manages: division-loader, tool-registry, middleware-context, agent-executor-context, network-egress-audit/policy, output-continuation, model-call-provider, graceful-shutdown, process-tracker.

### 6.7 Sync/Async Dual Mode

Multiple services provide both sync (SQLite) and async (PostgreSQL) versions:
`ExecutionLeaseService`/Async, `HaCoordinatorService`/Async, `HotUpgradeService`/Async, `ExecutionDispatchService`/Async, `ExecutionWorkerHandshakeService`/Async, `ExecutionWorkerWritebackService`/Async, `DurableEventBus`/Async + 21 Async\*Repository.

---

## 7. Code Quality Issues

### 7.1 Type Safety

| Issue                        | Quantity              | Severity |
| ---------------------------- | --------------------- | -------- |
| `as unknown as` type assertions | ~50 occurrences (24 files) | Medium |
| `as any`                    | 3 occurrences          | Low     |
| Query results without schema validation | All store methods | Medium |
| Non-null assertions `!`    | Multiple (uncounted)   | Medium   |

### 7.2 Code Duplication

| Issue                                                                                                                      | Impact         | Severity |
| ------------------------------------------------------------------------------------------------------------------------- | -------------- | -------- |
| `HrRoleGovernanceService` in two places (`domains/governance/` and `org-governance/org-model/`, 571 lines × 2, only 2 import lines different) | 1,142 lines redundant | High   |
| CLI governance files share large chunks of initialization code (doctor/ops-governance/enterprise-governance)                | ~300 lines      | Medium   |
| `trust-scorer/index.ts` (21 lines) duplicates `trustLevelFromScore` + `scoreCapability` in `autonomy/index.ts`             | 21 lines        | Low     |
| Inconsistent CLI output methods (`console.log` vs `process.stdout.write`)                                                    | ~50 occurrences | Low     |

### 7.3 Redundant Code

| Issue                                                       | Lines    | Severity |
| ----------------------------------------------------------- | -------- | -------- |
| `src/core/runtime/` 8 re-export shims                       | 29       | Medium   |
| `platform/shared/lifecycle/evolution-mvp-service.ts` 1-line shim | 1    | Low      |
| 4 incomplete async wrappers (marketplace 3 + drift-detection 1) | ~205 | Medium   |
| 43 empty stub `export {}` files                             | 43 files | Medium   |

### 7.4 Complexity Centers

| File                            | Lines | Module          | Issue                    |
| ------------------------------ | ----- | --------------- | ------------------------ |
| `worker-repository.ts`         | 1,057 | state-evidence  | Largest Repository file  |
| `async worker-repository.ts`   | 1,052 | state-evidence  | Sync version mirror      |
| `operations-repository.ts`     | 868   | state-evidence  | Complex ops data access  |
| `slo-alerting-service.ts`      | 799   | shared          | 5-channel alerting       |
| `execution-lease-service.ts`   | 796   | execution       | Multi-step verification chain |
| `anomaly-detection-service.ts` | 795   | shared          | Complex statistical logic |
| `billing-service.ts`           | 791   | scale-ecosystem | Complete billing engine  |
| `patch-dsl-service.ts`         | 791   | execution       | DSL parsing              |
| `plugin-spi-registry.ts`       | 829   | domains         | Single file too large     |

### 7.5 Outdated Documentation Paths

6 root-level Markdown files (`src/README.md`, `MEMORY.md`, `CLAUDE.md`, `README.md`, `AGENTS.md`, `MIGRATION_BASELINE.md`) still reference non-existent paths like `src/core/`, `src/cli/`, `src/gateway/`.

---

## 8. Security and Reliability Analysis

### 8.1 Security Capability Matrix

| Capability           | Status           | Location                                                        | Assessment             |
| ------------------- | ---------------- | --------------------------------------------------------------- | ---------------------- |
| Sandbox path verification | **Implemented** | `control-plane/iam/sandbox-policy.ts` (327 lines, 3 modes)     | realpath + symlink detection |
| Shell injection defense | **Implemented** | `execution/tool-executor/command-executor.ts` 7-layer defense   | Complete              |
| Command policy       | **Implemented** | deny-by-default, unknown commands rejected                       | Complete              |
| Output sanitization  | **Implemented** | `execution/tool-executor/tool-output-sanitizer.ts`               | secret redaction + injection detection |
| OIDC/OAuth          | **Implemented** | `interface/api/oidc-oauth/`                                     | JWKS + IdP token validation |
| JWT authentication   | **Implemented** | `interface/api/api-auth-service.ts`                             | Algorithm whitelist missing |
| Secret management    | **Implemented** | `control-plane/iam/` (510 lines, 5 Providers)                   | Cloud providers not production-verified |
| CVE intelligence     | **Implemented** | `control-plane/iam/cve-intelligence-service.ts` (748 lines)    | Complete              |
| Network egress control | **Implemented** | `control-plane/iam/` network-egress-* + outbound-url-policy | Complete              |
| Data classification  | **Implemented** | `control-plane/iam/data-classification-service.ts` (730 lines) | PII/sensitive data    |
| Audit integrity      | **Implemented** | `control-plane/iam/audit-event-integrity.ts`                   | Tier-1 audit event chain |
| MCP tool guard      | **Implemented** | `execution/tool-executor/mcp-tool-guard.ts`                    | Complete              |

### 8.2 Reliability Capability Matrix

| Capability              | Status            | Location                                                         | Assessment      |
| --------------------- | ----------------- | ---------------------------------------------------------------- | -------------- |
| Lease + fencing token | **Implemented**   | `execution/lease/` (796 lines, 5-step verification)              | Complete        |
| Transactional state updates | **Implemented** | `db.transaction()` wrapped state changes                     | Complete        |
| Tier-1 event persistence | **Implemented** | `state-evidence/events/durable-event-bus.ts`                   | Complete        |
| Graceful shutdown     | **Implemented**   | `execution/startup/graceful-shutdown.ts` (276 lines)              | Complete        |
| Process tracking      | **Implemented**   | `execution/resource/process-tracker.ts`                          | PID + PGID      |
| Loop detection        | **Implemented**   | `execution/execution-engine/loop-detection.ts` (443 lines)        | Complete        |
| Admission control     | **Implemented**   | `execution/execution-engine/admission-controller.ts`             | Complete        |
| Context compression   | **Implemented**   | `execution/execution-engine/context-compaction-service.ts`      | Complete        |
| Gateway retry + DLQ   | **Implemented**   | Exponential backoff, max 5, rate limiting, dead letter queue     | Complete        |
| Circuit breaker       | **Implemented**   | `model-gateway/provider-registry/circuit-breaker.ts` (289 lines)  | Needs production verification |
| Hot upgrade           | **Experimental**  | `execution/hot-upgrade/` (1,952 lines)                            | Needs verification |
| Cross-region deployment | **Experimental** | `execution/ha/cross-region-deployment-service.ts` (663 lines)  | Needs verification |
| Stability rehearsal   | **Implemented**   | `shared/stability/` (32 files, 13,328 lines, 28+ rehearsal suites) | Complete      |

### 8.3 Observability Capability Matrix

| Capability         | Status           | Location                                                                              |
| ----------------- | ---------------- | ------------------------------------------------------------------------------------- |
| Structured logging | **Implemented** | `shared/observability/structured-logger.ts` (342 lines, ring buffer)                    |
| Health checks      | **Implemented** | 4 levels: ok → degraded → overloaded → unhealthy                                        |
| Prometheus export  | **Implemented** | `shared/observability/prometheus-metrics-exporter.ts`                                   |
| OpenTelemetry      | **Implemented** | `shared/observability/otel-bootstrap.ts` + `otel-tracer.ts`                            |
| Log transmission   | **Implemented** | 3 channels: Stdout / Fluentd / Datadog                                                |
| Diagnostics service | **Implemented** | `shared/observability/diagnostics-service.ts` + `diagnostics-support.ts` (1,165 lines) |
| Anomaly detection  | **Implemented** | `shared/observability/anomaly-detection-service.ts` (795 lines)                        |
| SLI/SLO alerting   | **Implemented** | `shared/observability/slo-alerting-service.ts` (799 lines, 5 channels)                 |
| Distributed tracing | **Implemented** | `shared/observability/trace-context.ts` + OTel integration                             |

---

## §9 Testing System Analysis

### 9.1 Test Scale Overview

| Dimension          | Value                                |
| ----------------- | ------------------------------------ |
| Total test files  | 1,018                                |
| Test code lines   | 206,717                              |
| Test cases        | ~9,255                               |
| Helper files      | 19 (2,120 lines)                     |
| Fixture files     | 4 (459 lines)                        |
| Golden snapshot files | 3 (332 lines)                    |
| Test framework    | `node:test` + `node:assert/strict`   |
| External test deps| None (zero Jest/Mocha/Sinon/Chai)   |
| Concurrency       | `--test-concurrency=12`               |

### 9.2 Distribution by Directory

| Directory          | Files | Lines    |
| ----------------- | -----:| --------:|
| `tests/unit/`     |   704 | 148,154 |
| `tests/integration/` | 289 |  53,317 |
| `tests/e2e/`      |    10 |   2,807 |
| `tests/golden/`   |     8 |   1,330 |
| `tests/performance/` |   6 |     874 |
| `tests/fixtures/` |     1 |     235 |
| **Total**         |**1,018**|**206,717** |

### 9.3 Unit Test Breakdown (704 files, 148,154 lines)

| Sub-area           | Files |   Lines |
| ------------------ | ----: | ------: |
| `unit/platform/`   |   519 | 111,903 |
| `unit/runtime/`   |    45 |  15,050 |
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

**Platform Unit Test Deep Breakdown (519 files, 111,903 lines):**

| Submodule                        | Files |   Lines |
| -------------------------------- | ----: | ------: |
| `unit/platform/state-evidence/`  |   102 |  31,659 |
| `unit/platform/shared/`          |    88 |  15,894 |
| `unit/platform/control-plane/`   |    82 |  14,960 |
| `unit/platform/execution/`       |    63 |  12,921 |
| `unit/platform/orchestration/`   |    59 |  11,634 |
| `unit/platform/interface/`       |    53 |  10,954 |
| `unit/platform/contracts/`       |    33 |   6,482 |
| `unit/platform/model-gateway/`   |    21 |   5,873 |
| `unit/platform/prompt-engine/`   |    11 |   1,262 |
| `unit/platform/compliance/`       |     6 |     244 |

### 9.4 Integration Test Breakdown (289 files, 53,317 lines)

| Sub-area                        | Files |   Lines |
| ------------------------------ | -----: | ------: |
| `integration/platform/`         |   220 |  41,277 |
| `integration/sdk/`              |    35 |   9,165 |
| `integration/ops-maturity/`     |    12 |     783 |
| `integration/domains/`          |     6 |     604 |
| `integration/scale-ecosystem/` |     7 |     499 |
| `integration/stability/`        |     2 |     263 |
| `integration/workflow/`        |     2 |     218 |
| `integration/org-governance/`   |     2 |     188 |
| `integration/orchestration/`    |     1 |     185 |
| `integration/interaction/`      |     2 |     135 |

**Platform Integration Test Deep Breakdown (220 files, 41,277 lines):**

| Submodule                                | Files |   Lines |
| ---------------------------------------- | -----: | ------: |
| `integration/platform/execution/`         |    83 |  15,735 |
| `integration/platform/security/`          |    63 |   9,019 |
| `integration/platform/state-evidence/`    |    19 |   3,749 |
| `integration/platform/contracts/`         |    13 |   3,266 |
| `integration/platform/shared/`            |    13 |   3,124 |
| `integration/platform/control-plane/`     |    10 |   2,842 |
| `integration/platform/interface/`         |     4 |   1,167 |
| `integration/platform/model-gateway/`     |     7 |   1,066 |
| `integration/platform/orchestration/`     |     3 |     855 |
| `integration/platform/prompt-engine/`     |     3 |     320 |
| `integration/platform/compliance/`         |     2 |     134 |

### 9.5 Top 15 Largest Test Files

| Rank | File                                                                          | Lines |
| ---: | ---------------------------------------------------------------------------- | -----: |
|    1 | `integration/sdk/cli/ops-cli.test.ts`                                        | 3,916 |
|    2 | `unit/runtime/execution-handshake.test.ts`                                    | 1,873 |
|    3 | `unit/platform/state-evidence/truth/async-repositories.test.ts`               | 1,699 |
|    4 | `integration/platform/execution/execution-dispatch-service.test.ts`            | 1,684 |
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

### 9.6 Test Framework and Patterns

- **Runner**: `node:test` — imported in 1,015/1,018 files
- **Assertion library**: `node:assert/strict` — imported in 1,009 files
- **Registration pattern**: Flat `test()` predominant (9,116 times), `it()` only 139 times, `describe()` only 8 times
- **Mock**: `node:test` built-in mock objects, used in only 3 files
- **Zero external dependencies**: No Jest / Mocha / Sinon / Chai

### 9.7 Coverage Configuration

**c8 coverage tool (`.c8rc.json`)**:

- Report formats: `text`, `html`, `lcov`, `json-summary`
- Scope: `dist/src/**/*.js`, enabled `all: true` full instrumentation
- Exclude: `dist/tests/`, `node_modules/`, `scripts/`, config files

**Coverage baseline (`.coverage-baseline.json`)**:

| Metric  | Minimum Required |
| ------- | --------------: |
| Lines   |           84.1% |
| Stmts   |           84.1% |
| Funcs   |           82.8% |
| Branch  |           79.8% |

- Tracks independent metrics for **42 source directories**
- CI gate: `scripts/ci/check-coverage-baseline.mjs` — blocks on coverage degradation
- Ratchet update: `scripts/ci/update-coverage-baseline.mjs` — only allows upward adjustment

**Mutation testing (Stryker)**:

- 9 critical path files participate in mutation testing
- Thresholds: high=80, low=60, break=50
- Targets: auth/billing/approval/gateway routing + OAPEFLIR loop + Redis configuration

### 9.8 Test Script Matrix

| Script                        | Purpose                          |
| ----------------------------- | -------------------------------- |
| `npm test`                    | Full regression + coverage gate  |
| `npm run test:unit`           | Unit tests only                  |
| `npm run test:integration`    | Integration tests only           |
| `npm run test:golden`         | Golden snapshot tests only       |
| `npm run test:pg-integration` | PostgreSQL integration (concurrency=1) |
| `npm run test:performance`    | Performance benchmarks (concurrency=1) |
| `npm run test:mutation`       | Stryker mutation testing         |
| `npm run test:secret-providers` | Secret provider isolation tests |

### 9.9 Test Helper System

**`tests/helpers/` (19 files, 2,120 lines) — Key files**:

| File                   | Lines | Purpose                    |
| ---------------------- | ----: | -------------------------- |
| `api.ts`               |   362 | HTTP API test helper       |
| `pmf.ts`               |   251 | PMF scenario builder       |
| `fixtures/composite.ts`|   227 | Composite fixture generation |
| `concurrent-runner.ts` |   158 | Concurrent test runner      |
| `typed-factories.ts`   |   143 | Type-safe factory methods   |
| `integration-context.ts`|   131 | Integration test context    |
| `e2e-harness.ts`       |   131 | E2E test harness            |

### 9.10 Test System Assessment

**Strengths**:

- Test code (206,717 lines) exceeds source code (191,611 lines), test density 1.08:1
- Zero external test dependencies, entirely based on Node.js built-in capabilities
- Coverage baseline gate + mutation testing dual guarantee
- 42 directory-level independent coverage tracking

**Risks**:

- E2E tests only 10 files (2,807 lines), lacking end-to-end scenario coverage
- `tests/unit/runtime/` (45 files) not aligned with new 7-layer structure, should migrate to `unit/platform/`
- `tests/unit/core/` and `tests/unit/apps/` only 1/4 files each, extremely low coverage
- Largest test file (ops-cli.test.ts, 3,916 lines) too large, recommend splitting

---

## §10 Configuration and Deployment Architecture

### 10.1 Configuration System

**27 JSON files, 652 lines, distributed across 9 subdirectories:**

| Directory             | Files | Responsibilities                                         |
| --------------------- | ----: | ------------------------------------------------------- |
| `config/runtime/`     |     6 | Runtime parameters: concurrency / task timeout / step timeout |
| `config/security/`    |     6 | Approval mode / sandbox level / destructive operation control |
| `config/environments/`|     5 | Deployment descriptors: registry / namespace / release strategy |
| `config/providers/`   |     3 | Model providers: OpenAI / Anthropic / MiniMax configuration |
| `config/bootstrap/`   |     1 | Application identity: name / stage gating / core enablement |
| `config/domains/`     |     1 | Domain definitions: Coding workflow / toolkit / model preferences |
| `config/gateways/`    |     1 | Gateway defaults: CLI interface / SSE stream              |
| `config/knowledge/`   |     1 | Knowledge namespace: access policy / capacity limit / freshness |
| `config/plugins/`      |     1 | Plugin list: sandbox constraints for 3 built-in plugins    |
| `config/product/`      |     1 | Billing plans: Community / Pro / Enterprise tiers          |

### 10.2 Environment Gradient (5 Levels)

`dev` → `test` → `staging` → `pre-prod` → `prod`, progressively tightened across 4 configuration layers:

| Dimension         | dev           | test          | staging      | pre-prod         | prod              |
| ---------------- | ------------- | ------------- | ------------ | ---------------- | ----------------- |
| Approval mode    | auto          | supervised    | supervised   | supervised       | **strict**        |
| Max concurrency  | 1             | 2             | 4            | 6                | **8**             |
| Task timeout     | 120s          | 180s          | 240s         | 300s             | **600s**          |
| Release strategy | rolling, canary| rolling, canary| +blue_green | canary, blue_green | canary, blue_green |
| Replica count   | 1             | 1             | 2            | 2                | **3**             |
| HPA             | disabled      | disabled      | 2-5          | 2-6              | **3-10**          |
| PDB             | disabled      | disabled      | min 1        | min 1            | **min 2**         |
| Storage driver  | sqlite        | sqlite        | sqlite       | postgres         | **postgres**      |
| ExternalSecrets | disabled      | disabled      | disabled     | AWS SM           | **AWS SM**        |
| Destructive ops | (not set)     | (not set)     | (not set)    | **false**        | **false**         |

### 10.3 Docker Configuration

**Dockerfile (46 lines)** — Two-stage build:

| Stage     | Base Image             | Purpose                              |
| --------- | ---------------------- | ------------------------------------ |
| `build`   | `node:22-bookworm-slim` | Full dependency install + TypeScript compilation |
| `runtime` | `node:22-bookworm-slim` | Production dependencies only + compiled artifacts |

Security hardening:

- Running as non-root user `node` (UID 1000)
- All files `--chown=node:node`
- Health check: `GET /healthz` (30s interval, 3 retries)
- Exposed port: **3000**

**docker-compose.yml (131 lines)** — 5 services:

| Service      | Image                        | Port | Key Configuration                                             |
| ----------- | ---------------------------- | ---- | ------------------------------------------------------------- |
| `api-server` | local build                  | 3000 | Read-only filesystem, 64MB tmpfs, 1 CPU / 512MB / 256 PIDs, all capabilities dropped |
| `postgres`  | `postgres:16-bookworm`       | 5432 | Persistent volume `automatic-agent-postgres`                   |
| `redis`     | `redis:7-alpine`            | 6379 | AOF disabled, 256MB limit, LRU eviction                       |
| `prometheus`| `prom/prometheus:v2.54.1`    | 9090 | Mounted rules directory read-only                             |
| `alertmanager`| `prom/alertmanager:v0.27.0` | 9093 | Mounted config read-only                                     |

### 10.4 CI/CD Workflows (4)

**ci.yml (133 lines)** — Main CI pipeline, 5 jobs:

| Job              | Trigger      | Responsibilities                                                                  |
| --------------- | ------------ | --------------------------------------------------------------------------------- |
| `validate`       | push/PR      | lint → audit → typecheck → test → coverage gate → stable validation (Node 20+22 matrix) |
| `pg-integration` | push/PR      | PostgreSQL 16 service container, `test:pg-integration`                              |
| `mutation-test`  | push to main | Stryker mutation testing                                                           |
| `security`       | push/PR      | CodeQL TypeScript static analysis                                                 |
| `trivy-scan`     | push/PR      | Docker image CRITICAL/HIGH vulnerability scanning                                   |

**publish-image.yml (70 lines)** — Docker image publishing:

- Manual trigger (`workflow_dispatch`), input: environment / tag / repository
- Pre-check build → GHCR login → Buildx build push (GHA cache)

**deploy-environment.yml (278 lines)** — Environment deployment:

- Manual trigger, 5-level environment selection
- Supports rolling / canary / blue_green three strategies
- AWS OIDC authentication → kubectl + Helm 3.16.3
- Auto rollback: rollback to previous Helm version on deployment failure

**secret-provider-integration.yml (19 lines)** — Secret provider integration testing

### 10.5 Deployment Infrastructure (40 files, ~2,533 lines)

| Category          | Files | Lines | Tool              |
| ---------------- | -----: | ----: | ----------------- |
| Helm Charts       |    18 |   720 | Helm 3.16.3        |
| Terraform modules |     9 |   956 | Terraform + AWS   |
| Prometheus rules  |     3 |    74 | Prometheus v2.54.1 |
| Grafana dashboards|     2 |   348 | Grafana JSON      |
| Chaos engineering |     4 |    59 | Chaos Mesh        |
| Deployment scripts|     3 |   323 | Bash              |
| Operations manual    |     1 |    53 | Markdown           |

**Terraform architecture** (`terraform/main.tf`, 359 lines):

- AWS provider (~> 5.0)
- VPC (3 AZ, public/private subnets, NAT gateway)
- EKS: Kubernetes 1.29, managed node groups
- RDS: PostgreSQL 16.2, encrypted, production multi-AZ
- ElastiCache: Redis 7.1, encrypted, production 3-cluster auto-failover
- ECR: push scanning, 14-day cleanup of untagged images

**Helm Chart** (`automatic-agent` v0.1.0):

- Deployment (rolling update, non-root UID 1000, three probes + preStop hook)
- Service (ClusterIP, http + metrics ports)
- Ingress (nginx, TLS) + Canary Ingress (weight annotations)
- HPA (CPU + memory autoscaling) + PDB
- ExternalSecret (AWS Secrets Manager integration)

**Prometheus alerting rules** (3 rules):

- `AutomaticAgentHighErrorRate`: >5% 5xx for 10min → critical
- `AutomaticAgentTaskFailureRate`: >10% failure for 15min → warning
- `AutomaticAgentMemoryPressure`: RSS > 512MiB for 10min → warning

**Grafana dashboards** ("Automatic Agent Platform", 13 panels):

- Request metrics: rate / P50/P95/P99 latency
- Execution & queue: active executions / queue depth / provider success rate
- OAPEFLIR & knowledge: stage duration / result distribution
- System health: memory / event loop delay / Worker health ratio / DLQ size

**Chaos engineering** (4 scenarios):

- Pod kill (30s), network latency (500ms + 100ms jitter, 2min)
- PostgreSQL disconnect (60s), Redis disconnect (60s)

### 10.6 Script System (10 files, 1,236 lines)

| Script                                 | Lines | Purpose                                 |
| ------------------------------------- | ----: | -------------------------------------- |
| `reorg-code-structure.mjs`             |   754 | Code structure reorganization: old flat → 7-layer architecture |
| `generate-src-module-test-matrix.mjs` |   200 | Generate source-test coverage matrix      |
| `restore-sqlite.sh`                   |    85 | SQLite restore + integrity verification  |
| `backup-sqlite.sh`                    |    84 | WAL safe online backup + retention policy |
| `check-coverage-baseline.mjs`         |    42 | Coverage baseline gate                  |
| `check-changelog.mjs`                |    22 | Changelog version validation            |
| `update-coverage-baseline.mjs`        |    16 | Coverage baseline ratchet update         |
| `clean-dist.mjs`                      |    15 | Build artifact cleanup                  |
| `mutation-critical-tests.sh`           |    10 | Critical path mutation test subset      |
| `generate-coverage-report.mjs`         |     8 | Coverage report generation              |

---

## §11 Refactoring Priorities and Conclusions

### 11.1 P0 — Architecture Blockers (Immediate Action)

| ID   | Issue                            | Impact                                                                        | Recommended Action                                |
| ---- | -------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------ |
| B1   | PostgreSQL async/sync incompatibility | Production environment (pre-prod/prod) must use postgres driver, but many repositories still sync SQLite implementation | Unify async interface, demote SQLite to dev/test backend |
| B2   | `src/core/` legacy shim          | 8 files only 29 lines, all single-line re-exports, adds path confusion    | Delete `src/core/`, directly reference `src/platform/` |
| B3   | E2E coverage insufficient        | Only 10 files / 2,807 lines, cannot verify complete user journey           | Add core scenarios: task submission→dispatch→execution→result delivery→billing |

### 11.2 P1 — Structure Optimization (This Iteration)

| ID   | Issue                            | Recommended Action                                      |
| ---- | -------------------------------- | --------------------------------------------------------|
| S1   | CLI startup entry fragmentation (79 entry points) | Unify CLI framework, subcommand routing instead of independent files |
| S2   | `tests/unit/runtime/` misaligned | Migrate 45 files to corresponding submodules in `tests/unit/platform/` |
| S3   | `shared ↔ control-plane` bidirectional dependency | Extract stability rehearsal as independent module, eliminate reverse references |
| S4   | 26 re-export barrel files         | Evaluate retention value, merge or delete redundant layers |
| S5   | `execution` cross-module coupling (386 lines) | Introduce contracts abstraction, reduce direct dependency on state-evidence |

### 11.3 P2 — Quality Improvement (Next Iteration)

| ID   | Issue                            | Recommended Action                                      |
| ---- | -------------------------------- | --------------------------------------------------------|
| Q1   | `as unknown as` 58 occurrences   | Gradually replace with type guards or generic constraints |
| Q2   | Coverage baseline some directories below 50% | Focus on supplementing `org-governance`, `interaction`, `apps` tests |
| Q3   | HA verification only in stability rehearsal | Add real multi-replica HA integration tests |
| Q4   | Stryker only covers 9 files     | Expand to state-evidence and control-plane critical paths |
| Q5   | ops-cli.test.ts (3,916 lines)   | Split into independent test files by functional domain   |

### 11.4 Execution Phase Recommendations

```
Phase 1 (Week 1-2):  B1 PostgreSQL unification + B2 core/ deletion
Phase 2 (Week 3-4):  S1 CLI unification + S2 test directory alignment + S3 bidirectional dependency elimination
Phase 3 (Week 5-6):  B3 E2E coverage + Q1 type safety + Q2 coverage improvement
Phase 4 (Week 7-8):  S4/S5 structure optimization + Q3/Q4/Q5 quality finalization
```

### 11.5 Comprehensive Assessment

| Dimension          | Score     | Description                                                                                  |
| ---------------- | --------: | -------------------------------------------------------------------------------------------- |
| Architecture layering | **8/10** | 7-layer responsibilities clear, but shared ↔ control-plane bidirectional dependency needs resolution |
| Code scale        |   **9/10** | 1,052 files / 191,611 lines, reasonable module granularity                                   |
| Test density      |   **8/10** | 1.08:1 test/source ratio, 84.1% coverage, insufficient E2E                                   |
| Security hardening |   **9/10** | 12 security capabilities all implemented, Trivy + CodeQL + mutation testing                     |
| Observability      |   **9/10** | 9 capabilities all implemented, OTel + Prometheus + Grafana complete chain                    |
| Reliability        |   **8/10** | 13 capabilities implemented, lacking real multi-replica HA verification                        |
| Deployment maturity|   **9/10** | 5-level environment gradient, Helm + Terraform + Chaos full chain                              |
| Configuration mgmt |   **8/10** | 27 files / 11 categories / 4-layer environment coverage, ratchet gate                           |
| **Overall**       | **8.5/10** | Refactoring from v9 single-layer core/ to v10 seven-layer architecture basically complete, remaining work focused on P0 blockers and test supplementation |

---

## Appendix

### Appendix A: Top 20 Source Files (by Lines)

| Rank | Lines | File Path                                                                         |
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

### Appendix B: `as unknown as` Distribution

| Directory                         | Occurrences |
| ------------------------------ | ----------: |
| `src/platform/execution/`       |          29 |
| `src/platform/state-evidence/`  |          19 |
| `src/domains/governance/`      |           3 |
| `src/platform/shared/`          |           2 |
| `src/sdk/`                     |           2 |
| `src/platform/control-plane/`   |           1 |
| `src/domains/registry/`         |           1 |
| `src/plugins/`                 |           1 |
| **Total**                      |      **58** |

### Appendix C: Cross-Module Coupling Matrix (Platform Layer)

Source module → Target reference line counts:

| Source ↓ / Target → | contracts | state-evidence | shared | control-plane | execution | orchestration | model-gateway | interface | prompt-engine |
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

Coupling ratio (cross-module files/total files):

| Module          | Cross-Module Files | Total Files | Coupling Ratio |
| -------------- | -----------------: | ----------: | -------------: |
| control-plane   |                 64 |          75 |          85.3% |
| prompt-engine   |                  8 |          11 |          72.7% |
| execution       |                121 |         167 |          72.5% |
| compliance      |                  4 |           6 |          66.7% |
| model-gateway   |                 11 |          17 |          64.7% |
| interface       |                 33 |          51 |          64.7% |
| state-evidence  |                 94 |         169 |          55.6% |
| shared          |                 52 |         101 |          51.5% |
| orchestration   |                 22 |          80 |          27.5% |
| contracts       |                  2 |          34 |         **5.9%** |

### Appendix D: Version History

| Version | Date       | Major Changes                                                                                                                                                                                                             |
| ---- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v2   | —          | Initial version, based on `src/core/` single-layer architecture                                                                                                                                                        |
| v3   | —          | Added CLI layer (`src/cli/`)                                                                                                                                                                                             |
| v4   | —          | Added Gateway layer (`src/gateway/`)                                                                                                                                                                                     |
| v5   | —          | Introduced dual-dimensional status system                                                                                                                                                                               |
| v6   | —          | Security matrix expansion                                                                                                                                                                                                 |
| v7   | —          | Configuration and deployment chapter                                                                                                                                                                                     |
| v8   | —          | Testing system analysis                                                                                                                                                                                                   |
| v9   | —          | 1,541 lines, covering core/ + cli/ + gateway/ three-layer complete analysis                                                                                                                                             |
| v10  | 2026-04-20 | **Complete rewrite**: 7-layer architecture (platform/domains/interaction/org-governance/scale-ecosystem/ops-maturity/plugins/sdk/apps), 1,052 files / 191,611 lines source, 1,018 files / 206,717 lines tests, all-new configuration and deployment architecture chapter, cross-module coupling matrix |

---

_Document version: v10 | Generated: 2026-04-20 | Source snapshot: 1,052 files / 191,611 lines | Test snapshot: 1,018 files / 206,717 lines_
