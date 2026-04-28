# Automatic Agent Platform — Code Architecture Reference Document

> **Version**: v13.0
> **Analysis Date**: 2026-04-23
> **Analysis Scope**: src/ (1,387 files, 265,020 lines), tests/ (1,825 files, 440,180 lines), config/ (60 files), deploy/ (42 files), divisions/ (11, 61 files)
> **Analysis Method**: Directory-by-directory static analysis + dependency tracing + test coverage mapping + pattern recognition + design document cross-validation
> **Document Purpose**: Authoritative reference document for codebase status, recording actual architecture, module status, technical debt, and refactoring baseline
> **Related Documents**: `00-platform-architecture.md` v3.2 (design specification), `05-cross-platform-ui-architecture.md` v3.0 (UI architecture), `reviews/architecture-design-vs-implementation-review.md` v7.0 (gap review)
> **v13.0 Changes**: Full codebase rescan (+154 source files / +18,343 lines / +670 test files / +189,972 lines); updated all module statistics; added `constitution/` config directory, 13 root-level orchestrator files, `plugins/validators/` submodule; expanded async mirrors from 7 to 10+ groups

---

## Table of Contents

1. [Repository Overview and Key Metrics](#1-repository-overview-and-key-metrics)
2. [Module Inventory and Status Matrix](#2-module-inventory-and-status-matrix)
3. [Platform Layer Deep Analysis](#3-platform-layer-deep-analysis)
4. [Business Layer Deep Analysis](#4-business-layer-deep-analysis)
5. [Core Call Chain Analysis](#5-core-call-chain-analysis)
6. [Module Dependency and Boundary Analysis](#6-module-dependency-and-boundary-analysis)
7. [Code Quality Analysis](#7-code-quality-analysis)
8. [Testing Analysis](#8-testing-analysis)
9. [Configuration and Deployment Architecture](#9-configuration-and-deployment-architecture)
10. [Technical Debt and Refactoring Priorities](#10-technical-debt-and-refactoring-priorities)
11. [Conclusion](#11-conclusion)

---

## 1. Repository Overview and Key Metrics

### 1.1 Code Scale

| Metric | Value | vs v12.0 |
| --- | --- | --- |
| Source files (`src/`) | 1,387 `.ts` files | +154 (+12.5%) |
| Source lines | 265,020 lines | +18,343 (+7.4%) |
| Test files (`tests/`) | 1,825 `.test.ts` files | +670 (+58.0%) |
| Test lines | 440,180 lines | +189,972 (+76.0%) |
| Test/Source ratio | 1.66:1 | ↑ from 1.01:1 |
| Top-level modules | 10 independent modules + platform/ with 13 submodules + 13 root-level files | +13 orchestrators |
| Config files | 60 JSON (19 directories) | +26 |
| Deployment files | 42 (Helm + Terraform + Scripts + Monitoring + Chaos) | |
| Division definitions | 11 (61 files) | |
| npm scripts | 103 (including 26 stable-* rehearsal scripts) | +21 |
| Runtime dependencies | 11 | +1 |
| Dev dependencies | 14 | +1 |

### 1.2 Source Module Distribution

| Module | Files | Lines | Share | Stubs | Stub Rate | vs v12.0 Files | vs v12.0 Lines |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `src/platform/` | 941 | 207,967 | 78.5% | 121 | 12.9% | +102 | +10,890 |
| `src/scale-ecosystem/` | 74 | 15,507 | 5.9% | 23 | 31.1% | +7 | +438 |
| `src/domains/` | 56 | 10,579 | 4.0% | 10 | 17.9% | +9 | +2,006 |
| `src/sdk/` | 93 | 8,749 | 3.3% | 25 | 26.9% | — | +163 |
| `src/ops-maturity/` | 88 | 8,957 | 3.4% | 23 | **26.1%** | +6 | +2,188 |
| `src/interaction/` | 41 | 5,587 | 2.1% | 10 | 24.4% | +4 | +376 |
| `src/org-governance/` | 41 | 4,445 | 1.7% | 13 | **31.7%** | +8 | +996 |
| `src/plugins/` | 25 | 1,686 | 0.6% | 5 | 20.0% | +5 | +14 |
| `src/apps/` | 4 | 112 | <0.1% | 3 | 75%* | — | +62 |
| `src/core/` | 8 | 29 | <0.1% | 8 | 100%* | — | — |
| `src/` root files | 13 | 1,298 | 0.5% | 0 | 0% | **New** | **+1,298** |
| `src/testing/` | 1 | 21 | <0.1% | — | — | — | — |
| `src/benchmarks/` | 1 | 74 | <0.1% | — | — | — | — |
| `src/types/` | 1 | 9 | <0.1% | — | — | **New** | **+9** |
| **Total** | **1,387** | **265,020** | 100% | **242** | **17.4%** | **+154** | **+18,343** |

> \***`apps/`** is pure manifest declarations, and **`core/`** is pure re-export compatibility layer; both are by design intent.

### 1.3 Root-Level Orchestrator Files (v13.0 New)

| File | Lines | Responsibility |
| --- | --- | --- |
| `index.ts` | 272 | Platform main entry barrel export |
| `platform-architecture-bootstrap.ts` | 152 | Five-plane startup orchestration |
| `platform-application-kernel.ts` | 142 | Application kernel dependency injection |
| `domains-runtime-orchestrator.ts` | 127 | Domain runtime orchestration (24 domains) |
| `interaction-governance-runtime-orchestrator.ts` | 132 | Interaction + governance runtime orchestration |
| `scale-ops-runtime-orchestrator.ts` | 132 | Scale + ops runtime orchestration |
| `domains-startup-plan.ts` | 53 | Domain startup plan |
| `interaction-governance-startup-plan.ts` | 62 | Interaction + governance startup plan |
| `scale-ops-startup-plan.ts` | 62 | Scale + ops startup plan |
| `domains-runtime-catalog.ts` | 51 | Domain runtime catalog |
| `interaction-governance-runtime-catalog.ts` | 39 | Interaction + governance runtime catalog |
| `scale-ops-runtime-catalog.ts` | 39 | Scale + ops runtime catalog |
| `platform-architecture-types.ts` | 35 | Architecture type definitions |

### 1.4 Technology Stack

| Category | Choice |
| --- | --- |
| Language | TypeScript 5.8+ (strict, ESM, `noUncheckedIndexedAccess`) |
| Runtime | Node.js 22+ |
| Database | SQLite (WAL) — 55 tables + PostgreSQL — 75+ tables (dual-backend adapter) |
| Cache | Memory L1 + SQLite L2 + Redis L3 (ioredis ^5.10) |
| WebSocket | ws ^8.18 |
| Observability | OpenTelemetry (tracing + metrics) |
| Validation | Zod ^3.25 schema validation |
| Testing | `node:test` + `node:assert/strict` + c8 coverage + Stryker mutation testing |
| Build | tsc (ES2023 target, NodeNext module) |
| Lint | ESLint 9 flat config + Prettier |
| Container | Multi-stage Dockerfile, node:22-bookworm-slim |

### 1.5 Judgment Criteria: Dual-Dimensional Status System

**Dimension A — Implementation Status**: Not Started → Skeleton → Partial → Implemented
**Dimension B — Production Confidence**: Unverified → Test-covered → Staging-verified → Production-ready

> **No module in the current codebase has reached Staging-verified or Production-ready**.

### 1.6 Architecture Blockers

| # | Blocker | Severity | Description |
| --- | --- | --- | --- |
| B1 | PostgreSQL sync/async dual-backend | High | 10+ groups of sync/async mirror files (~6,934 lines), high maintenance cost for sync |
| B2 | E2E test scenarios limited | Medium | `tests/e2e/` 17 files 6,687 lines, covering ~17 flows |

---

## 2. Module Inventory and Status Matrix

### 2.1 `src/platform/` Module Inventory (941 files, 207,967 lines)

| Submodule | Files | Lines | Core Services | Impl. Status | Confidence | vs v12.0 |
| --- | --- | --- | --- | --- | --- | --- |
| execution/ | 188 | 50,695 | ExecutionDispatchService, ExecutionLeaseService, MultiStepSupervisor, PatchDslService | Implemented | Test-covered | +11/+1,761 |
| state-evidence/ | 212 | 49,461 | AuthoritativeTaskStore, DurableEventBus, WorkerRepository, 55 SQLite tables | Implemented | Test-covered | +11/+1,724 |
| control-plane/ | 114 | 36,793 | PolicyCenterService, DoctorService, AutoStopLossService, CveIntelligenceService | Implemented | Test-covered | +7/+1,237 |
| shared/ | 120 | 28,169 | SloAlertingService (1,021), AnomalyDetectionService (795), StabilityFramework (13,642) | Implemented | Test-covered | +7/+1,375 |
| interface/ | 69 | 12,881 | HttpApiServer (50+ routes, 17 route files), ChannelGatewayService (3,480), ConsoleRoutes | Implemented | Test-covered | +7/+801 |
| orchestration/ | 129 | 12,312 | OapeflirLoopService (5,678), IntakeRouter, AgentDelegation (2,176), HITL (1,474), Harness | Implemented | Test-covered | +38/+2,194 |
| model-gateway/ | 23 | 5,807 | UnifiedChatProvider, CircuitBreaker, ModelRoutingService, three providers (4,500 lines registry) | Implemented | Test-covered | +4/+178 |
| contracts/ | 38 | 4,633 | AppError (14 subclasses), PromptBundle type system, envelope contracts | Implemented | Test-covered | +1/+48 |
| prompt-engine/ | 24 | 4,562 | HierarchicalRegistryService, PromptVersionManager, PromptRolloutService | Implemented | Test-covered | +5/+542 |
| compliance/ | 12 | 1,647 | ComplianceCaseOrchestrationService (324) | Partial | Test-covered | +3/+164 |
| cost-management/ | 1 | 26 | Placeholder module | Skeleton | — | — |
| agent-delegation/ | 1 | 71 | re-export (actual implementation in orchestration/agent-delegation/) | Legacy | — | — |
| prompt-registry/ | 1 | 30 | Placeholder module | Skeleton | — | — |

### 2.2 Business Layer Module Inventory

| Module | Files | Lines | Core Services | Impl. Status | Confidence | vs v12.0 |
| --- | --- | --- | --- | --- | --- | --- |
| scale-ecosystem/ | 74 | 15,507 | BillingService (792), MarketplaceGovernanceService (866), ConnectorFrameworkService | Implemented | Unverified | +7/+438 |
| domains/ | 56 | 10,579 | DomainBaselineCatalog (1,113), PluginSpiRegistry (829), DivisionLoader (798) | Implemented | Test-covered | +9/+2,006 |
| sdk/ | 93 | 8,749 | PackLifecycleOrchestrationService, 79 CLI entry points (including 26 stable-* rehearsal scripts, factory pattern) | Implemented | Test-covered | —/+163 |
| ops-maturity/ | 88 | 8,957 | EvolutionMvpService (645), PlatformOpsAgentService (1,306), EdgeRuntimeSyncService | Partial | Unverified | +6/+2,188 |
| interaction/ | 41 | 5,587 | NlGatewayService (681), GoalDecomposer (397), DashboardWebSocketServer (382) | Implemented | Unverified | +4/+376 |
| org-governance/ | 41 | 4,445 | ScimProvisionService (828), OidcIdentityService (432), SamlService (186) | Implemented | Unverified | +8/+996 |
| plugins/ | 25 | 1,686 | 6 Adapter + 7 Retriever + 4 Presenter + 2 Planner + 2 Validator (5 stub files) | Implemented | Test-covered | +5/+14 |
| apps/ | 4 | 112 | PlatformAppManifest (api/console/workers) | Implemented | — | —/+62 |
| core/ | 8 | 29 | Pure re-export compatibility layer | Legacy | — | — |

---

## 3. Platform Layer Deep Analysis

### 3.1 execution/ (188 files, 50,695 lines) — Largest Submodule

| Subdirectory | Files | Lines | Responsibilities | vs v12.0 |
| --- | --- | --- | --- | --- |
| tool-executor/ | 37 | 13,540 | Tool execution, sandbox, patch DSL, filesystem tools | +1/+40 |
| execution-engine/ | 30 | 7,698 | Multi-step orchestration, loop detection, middleware, context compression | —/−102 |
| recovery/ | 23 | 6,811 | Execution recovery, replay, repair | **+15/+5,868** |
| ha/ | 18 | 6,115 | HA coordination, failover | +1/+115 |
| worker-pool/ | 20 | 3,310 | Worker handshake, writeback, registration, load balancing | +1/+10 |
| dispatcher/ | 11 | 3,028 | Admission control, dispatch service | —/+28 |
| plugin-executor/ | 5 | 2,296 | Plugin execution (4-layer sandbox: none/process/container/scoped_external_access) | −18/−4,304 |
| hot-upgrade/ | 7 | 1,968 | Hot upgrade verification | +4/+768 |
| lease/ | 9 | 1,822 | Lease acquire/renew/release, fencing token | +4/−1,678 |
| startup/ | 5 | 1,197 | Startup consistency, preflight checks | —/−803 |
| queue/ | 7 | 975 | Queue adapter | +3/−825 |
| state-transition/ | 3 | 839 | Execution state machine, transition service | −5/−3,161 |
| distributed-lock/ | 8 | 630 | Distributed lock (SQLite/PG/Redis) | —/−5 |
| resource/ | 2 | 361 | Process resource tracking | —/−4 |

> **Key Change**: recovery/ expanded significantly from 8 files 943 lines to 23 files 6,811 lines, becoming the third largest execution submodule. plugin-executor/ streamlined and consolidated (from 23 files reduced to 5 files).

### 3.2 state-evidence/ (212 files, 49,461 lines)

| Subdirectory | Files | Lines | Responsibilities | vs v12.0 |
| --- | --- | --- | --- | --- |
| truth/ | 118 | 30,058 | Authoritative data store, 55 SQLite tables + PG migration, 22+ Repositories | +6/+958 |
| events/ | 26 | 7,021 | Persistent event bus, typed publish | **+15/+4,521** |
| memory/ | 20 | 5,519 | Multi-tier memory (session/project/user) | +4/+2,019 |
| knowledge/ | 24 | 3,910 | Semantic knowledge, vector storage, ingestion pipeline | +9/−590 |
| artifacts/ | 13 | 1,095 | Artifact storage, publish, sensitive content scanning | +5/−905 |
| checkpoints/ | 3 | 757 | Execution checkpoints | −1/−443 |
| projections/ | 2 | 584 | Read model projections | —/−216 |
| dlq/ | 1 | 284 | Dead letter queue | —/−16 |
| incident/ | 1 | 96 | Event records | −2/−504 |
| audit/ | 1 | 44 | Audit trail, integrity verification | −4/−1,456 |

> **Key Change**: events/ expanded from 11 files to 26 files (+4,521 lines), DurableEventBus ecosystem significantly enriched. memory/ expanded from 16 files to 20 files (+2,019 lines). audit/ streamlined and consolidated.

### 3.3 control-plane/ (114 files, 36,793 lines)

| Subdirectory | Files | Lines | Core Services | vs v12.0 |
| --- | --- | --- | --- | --- |
| incident-control/ | 26 | 11,145 | DoctorService, AutoStopLossService, HumanTakeoverService, RunbookExecutor | +2/+345 |
| config-center/ | 32 | 8,900 | 29 environment config loaders, ConfigGovernanceService, versioning | +1/+300 |
| iam/ | 21 | 7,386 | PolicyEngine, SandboxPolicy, Secrets (Vault/AWS KMS/GCP), CVE | +1/+136 |
| approval-center/ | 11 | 3,919 | ApprovalFlowEngine (1,017), quorum, escalation, multi-party approval | —/+119 |
| compliance/ | 6 | 2,220 | Data residency, encryption keys, erasure requests/reports | —/+20 |
| cost-alert/ | 4 | 902 | CostAlertService | **+2/+602** |
| rollout-controller/ | 2 | 502 | RolloutStateMachine, AutoRollbackService | −3/−498 |
| risk-control/ | 4 | 493 | RiskEvaluationEngine | +1/+93 |
| policy-center/ | 1 | 409 | PolicyCenterService | **New** |
| audit-export/ | 2 | 353 | AuditExportService | +1/+153 |
| replay-repair-control/ | 1 | 183 | ReplayRepairControlService | **New** |
| tenant/ | 1 | 282 | TenantService | −3/−218 |

> **Key Change**: cost-alert/ expanded from 2 files 300 lines to 4 files 902 lines. New policy-center/ and replay-repair-control/.

### 3.4 Remaining Platform Submodules

| Submodule | Files | Lines | Key Points | vs v12.0 |
| --- | --- | --- | --- | --- |
| shared/ | 120 | 28,169 | SLO alerting (1,021), anomaly detection (795), **Stability (13,642)**, three-tier cache, OTel | +7/+1,375 |
| orchestration/ | 129 | 12,312 | OAPEFLIR 64 files (5,678), AgentDelegation (2,176), HITL (1,474), Harness | **+38/+2,194** |
| interface/ | 69 | 12,881 | 50+ REST routes (17 route files), ChannelGateway (3,480), Console, WebSocket | +7/+801 |
| model-gateway/ | 23 | 5,807 | Three providers (Anthropic/OpenAI/MiniMax), circuit breaker, ProviderRegistry (4,500) | +4/+178 |
| contracts/ | 38 | 4,633 | AppError (14 subclasses), PromptBundle (99), envelope contracts | +1/+48 |
| prompt-engine/ | 24 | 4,562 | Hierarchical registry, version management, Eval, Rollout | +5/+542 |
| compliance/ | 12 | 1,647 | Compliance orchestration: classification → governance → residency → encryption → lineage → erasure | +3/+164 |

> **Key Change**: orchestration/ grew from 91 files to 129 files (+38), OAPEFLIR expanded from single file 439 lines to 64 files 5,678 lines. shared/stability/ became the largest shared submodule (13,642 lines).

---

## 4. Business Layer Deep Analysis

### 4.1 scale-ecosystem/ (74 files, 15,507 lines)

| Submodule | Files | Lines | Core Services | Assessment |
| --- | --- | --- | --- | --- |
| marketplace/ | 32 | 11,972 | BillingService (792), MarketplaceGovernance (866), TenantPlatform, 3 payment gateways, 6 async mirrors | Complete |
| feedback-loop/ | 11 | 1,275 | FeedbackImprovementService, FineTuningExporter (277), QualityGrader (257) | Medium |
| multi-region/ | 7 | 1,265 | RegionHealthCheckService (462), CdcReplicationService (328), FailoverController | Medium |
| integration/ | 5 | 203 | ConnectorFrameworkService (141) — framework complete, no actual connector adapters | Thin |
| sla-engine/ | 5 | 142 | SlaOperationsService (90) — Zod schema + simple logic only | Stub |
| resource-manager/ | 5 | 118 | FairSchedulingService (69) — basic queue logic only | Stub |

> marketplace/ added 6 async mirror files (handshake/writeback/dispatch/event-bus/human-takeover/governance), totaling ~4,867 lines.

### 4.2 domains/ (56 files, 10,579 lines)

| Submodule | Files | Lines | Core Services | Assessment | vs v12.0 |
| --- | --- | --- | --- | --- | --- |
| registry/ | 15 | 2,753 | PluginSpiRegistry (829), PluginRuntimeHost (611, Fork/Container) | Complete | — |
| business-pack/ | 6 | 1,833 | PackManifest, Migration, Lifecycle, DomainAssociation | Medium | +1/+133 |
| governance/ | 6 | 1,672 | DivisionLoader (798), HrRoleGovernanceService | Complete | +1/+36 |
| roadmap/ | 5 | 647 | RoadmapService, PhaseDeliveryService | Medium | +1/+295 |
| operations/ | 2 | 193 | DomainOnboardingService | Medium | — |
| canonical-meta-model/ | 4 | 140 | CanonicalMetaModel, Validator, Seeder, CompletenessCalculator | **New** | **+4/+140** |
| prompt-library/ | 2 | 182 | PromptLibraryService | Stub-medium | — |
| eval-framework/ | 2 | 159 | JudgeProviderRegistry, QualityGate | Stub-medium | — |
| interaction-policy/ | 1 | 96 | InteractionPolicyService | **New** | **+1/+96** |
| risk-profile/ | 1 | 79 | DomainRiskProfile | Stub | — |
| knowledge-schema/ | 1 | 62 | KnowledgeSchemaService | Stub | — |
| coding/ | 1 | 31 | CodingDomainDescriptor | **New** | **+1/+31** |
| recipes/ | 1 | 18 | DomainRecipeService | Stub | — |

> **Key Change**: Added canonical-meta-model/ (4 files), interaction-policy/, coding/ three submodules. DomainBaselineCatalog (root-level, 1,113 lines) became the largest single domains file.

### 4.3 ops-maturity/ (88 files, 8,957 lines)

| Submodule | Files | Lines | Core Services | Assessment | vs v12.0 |
| --- | --- | --- | --- | --- | --- |
| drift-detection/ | 15 | 2,484 | EvolutionMvpService (645), ProposalEngine, ReflectionEngine | **Complete** | —/+85 |
| platform-ops-agent/ | 9 | 1,306 | PlatformOpsAgentService + submodules | **Medium** (↑ from stub) | **+2/+1,266** |
| agent-lifecycle/ | 8 | 1,022 | AgentLifecycleService (311), PerformanceProfiler | Medium | —/+28 |
| version-management/ | 3 | 738 | SemverValidator (336), CompatibilityMatrix (380) | Complete | — |
| explainability/ | 7 | 660 | ExplanationPipeline (121), SimplifiedExplainer (280) | Medium | —/+39 |
| workflow-debugger/ | 6 | 454 | TimeTravelDebugService (214) + 3 stub subdirectories | Partial | —/+101 |
| multimodal/ | 7 | 381 | MultimodalGatewayService (187) + processors | **Medium** (↑ from stub) | —/+112 |
| emergency/ | 5 | 284 | PlatformPanicService (197) + 3 stub subdirectories | Partial | —/+55 |
| chaos/ | 2 | 261 | ChaosExperimentScheduler | Partial | +1/+77 |
| compliance-reporter/ | 5 | 261 | ComplianceReportPipeline + 3 stub subdirectories | Partial (↑ from stub) | —/+87 |
| capacity-planner/ | 5 | 258 | CapacityPlanningService (162) + 3 stub subdirectories | Partial (↑ from stub) | —/+65 |
| cost-optimizer/ | 5 | 246 | CostOptimizationService + 3 stub subdirectories | **Stub** | —/+93 |
| edge-runtime/ | 6 | 214 | EdgeRuntimeSyncService (143) + submodules | **Stub** | —/+37 |
| monitoring/ | 2 | 212 | AnomalyDetectionService | Medium | +1/+14 |

> **Key Change**: platform-ops-agent/ expanded dramatically from 10 lines stub to 1,306 lines (+1,266). Stub rate decreased from 51.2% to 26.1%.

### 4.4 interaction/ (41 files, 5,587 lines)

| Submodule | Files | Lines | Core Services | Assessment |
| --- | --- | --- | --- | --- |
| nl-gateway/ | 6 | 1,270 | NlGatewayService (681), DisambiguationHandler (396) | Complete |
| dashboard/ | 6 | 1,100 | DashboardProjection (346), WebSocketServer (382) | Complete |
| ux/ | 8 | 1,077 | ConversationHistory, Onboarding, UxEventTracking | Medium |
| proactive-agent/ | 5 | 694 | ProactiveAgentService (335), TriggerEngine | Medium |
| autonomy/ | 7 | 566 | AutonomyGovernanceService, TrustScorer, Promotion | Medium |
| goal-decomposer/ | 4 | 493 | GoalDecomposer (397), Validator, DependencyGraph | Medium |

### 4.5 org-governance/ (41 files, 4,445 lines)

| Submodule | Files | Lines | Core Services | Assessment | vs v12.0 |
| --- | --- | --- | --- | --- | --- |
| sso-scim/ | 8 | 1,669 | ScimProvisionService (828), OidcService (432), SamlService (186) | **Complete** | — |
| org-model/ | 5 | 959 | OrgHierarchy, OrgNodeSync | Complete | — |
| delegated-governance/ | 4 | 406 | DelegatedGovernanceService, ScopeManager | Medium | — |
| approval-routing/ | 5 | 162 | ApprovalRoutingService — thin routing engine | Stub | — |
| knowledge-boundary/ | 5 | 121 | KnowledgeBoundaryService — thin boundary management | Stub | — |
| compliance-engine/ | 5 | 109 | ComplianceGovernanceService — thin policy engine | Stub | — |

> org-governance/ grew from 33 to 41 files (+8), and lines from 3,449 to 4,445 (+996), but approval-routing/, knowledge-boundary/, and compliance-engine/ remain stubs.

---

## 5. Core Call Chain Analysis

### 5.1 OAPEFLIR 8-Stage Loop (orchestration/oapeflir/ — 64 files, 5,678 lines)

OAPEFLIR (Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release) is the platform's core cognitive pipeline, transforming task goals into executable work, evaluating results, extracting learning, and optionally rolling out policy improvements.

#### 5.1.1 Stage Call Chain

```
OapeflirLoopService.run()
│
├─ 1. OBSERVE
│  ├─ TaskSituationBuilder.build()           → TaskSituation
│  ├─ SystemSituationBuilder.build()         → SystemSituation
│  └─ ObservationAggregator.aggregate()      → UnifiedObservation
│
├─ 2. ASSESS
│  └─ AssessmentService.assess()             → UnifiedAssessment
│     ├─ Risk factor analysis (blocker severity, intent confidence, tool risk)
│     ├─ Complexity derivation (trivial/simple/moderate/complex/critical)
│     └─ Routing decision (single-step/multi-step, model category, timeout, approval strategy)
│
├─ 3. PLAN
│  └─ PlanBuilder.build()                    → Plan
│
├─ 4. EXECUTE
│  └─ RuntimeExecuteBridge.executePlan()     → DualChannelStepOutput[]
│     └─ runMultiStepOrchestration()         ← core/runtime/orchestrator
│
├─ 5. FEEDBACK
│  ├─ FeedbackCollector.collect()            → FeedbackBatch
│  └─ FeedbackCollector.toLearningSignals() → LearningSignal[]
│
├─ 6. LEARN
│  ├─ FailurePatternMiner.mine()             (4 detectors: hallucination/truncation/permission/schema-loop)
│  ├─ LLMImprovementGenerationService.generateImprovements()
│  ├─ LearningObjectValidator.validateMany()
│  └─ KnowledgePromotionService.promote()   → state-evidence/knowledge
│
├─ 7. IMPROVE (Conditional — only when learningObjects exist)
│  ├─ AutonomyBoundaryPolicy.decide()
│  └─ ImprovementCandidateRegistry.register()
│
├─ 8. RELEASE (Conditional — only when improvement candidates are approved)
│  ├─ PolicyRolloutService.start()           → RolloutRecord
│  ├─ RolloutStateMachine.transition()
│  ├─ GuardrailEvaluator.evaluate()
│  └─ RolloutFreezeManager check
│
└─ POST-LOOP
   ├─ ExecutionOutcomeEvaluator.evaluate()   → ExecutionOutcomeEvaluation
   ├─ PostExecutionQualityGate.decide()      → PostExecutionQualityGateDecision
   └─ ReplanningService.decide()             → ReplanningDecision
```

Each stage is wrapped with `startActiveSpan()` (OpenTelemetry) and metrics are recorded on entry/exit via `runtimeMetricsRegistry`. Inter-stage boundaries are validated with Zod schemas.

#### 5.1.2 OAPEFLIR Subdirectory Structure

| Subdirectory | Files | Lines | Responsibility |
| --- | --- | --- | --- |
| root files | 15 | 2,007 | Main loop service, FSM, execution bridge, handoff build/serialize, types |
| types/ | 16 | 498 | Inter-stage data types (assessment/plan/observation etc.) |
| schemas/ | 2 | 319 | Zod validators + schema index |
| workflow/ | 5 | 1,015 | Workflow validation, output schema, retry strategy |
| learn/ | 16 | 911 | Learning pipeline: pattern mining, knowledge promotion, strategy learning |
| improve-rollout/ | 11 | 928 | Release pipeline: scheduler, state machine, guardrails, canary routing |

#### 5.1.3 OAPEFLIR Cross-Module Dependencies

| Dependency Target | Purpose |
| --- | --- |
| `platform/shared/observability/` | Task/system situation building, OTel tracing, freeze manager |
| `platform/execution/` | MultiStepOrchestrationResult, StepOutputRecord |
| `platform/prompt-engine/eval/` | Execution result evaluator, quality gate |
| `platform/state-evidence/knowledge/` | Knowledge plane (Learn stage knowledge promotion) |
| `platform/state-evidence/events/` | TypedEventPublisher (learning event publishing) |
| `platform/contracts/` | ID generation, timestamps, error types |
| `platform/model-gateway/` | LLM improvement generation |
| `scale-ecosystem/feedback-loop/` | FeedbackCollector, FeedbackModel |
| `domains/governance/` | DivisionLoader (workflow validation) |

### 5.2 Execution Call Chain (execution/ → state-evidence/ → control-plane/)

```
ExecutionDispatchService.dispatch()
├─ AdmissionController.evaluate()         ← control-plane/iam/sandbox-policy
├─ ExecutionLeaseService.acquire()        ← fencing token
├─ AuthoritativeTaskStore.create()        ← state-evidence/truth/
├─ WorkerPool.assign()
│  ├─ ExecutionWorkerHandshakeService.handshake()
│  └─ ExecutionWorkerWritebackService.writeback()
├─ MultiStepSupervisor.run()
│  ├─ ToolExecutor.execute()              ← 4-layer sandbox (none/process/container/scoped)
│  ├─ PatchDslService.apply()
│  └─ ContextCompressor.compress()
├─ ExecutionLeaseService.release()
└─ DurableEventBus.publish()              ← state-evidence/events/
```

### 5.3 HITL Approval Call Chain

```
HitlApprovalOrchestrationService.requestApproval()
├─ ApprovalContextSummaryService.produce()
├─ HITLExplainabilityService.explain()    (583 lines, generates human-readable approval rationale)
├─ ApprovalFlowEngine.submit()            ← control-plane/approval-center/ (1,017 lines)
│  ├─ Quorum voting
│  ├─ Escalation strategy
│  └─ Multi-party approval
├─ HitlInboxService.enqueue()
└─ HitlOperatorConsoleService.notify()
```

### 5.4 Agent Delegation Call Chain

```
DelegationManagerService.delegate()
├─ TopologyValidator.validate()           (depth/fanout/cycle detection)
├─ ContextIsolator.createSandboxedContext() (IsolationLevel)
├─ DelegationGovernanceService.enforce()
├─ CollaborationProtocolService.validate() (ACP message validation)
│  └─ InvariantEnforcer.enforce()         (permission narrowing, budget, risk invariants)
├─ DelegationTracker.track()               (tree-shaped delegation tracking)
└─ DelegationAuditService.record()
```

---

## 6. Module Dependency and Boundary Analysis

### 6.1 Dependency Hierarchy Model

```
Layer 4 (Entry)     src/*.ts root orchestrators (13 files)
                    ↓ imports
Layer 3 (Business)  scale-ecosystem/ | domains/ | ops-maturity/ | interaction/ | org-governance/
                    ↓ imports
Layer 2 (Platform)  orchestration/ | execution/ | interface/ | model-gateway/ | prompt-engine/
                    ↓ imports
Layer 1 (Core)      state-evidence/ | control-plane/ | shared/ | contracts/ | compliance/
                    ↓ imports
Layer 0 (Infra)     node:* stdlib | zod | ioredis | postgres | ws | @opentelemetry/*
```

### 6.2 Cross-Module Coupling (by import frequency)

| Source → Target | Import Count | Assessment |
| --- | --- | --- |
| execution/ → contracts/ (ids/errors/domain) | 132 | High (reasonable) |
| execution/ → state-evidence/truth/ | 97 | High (reasonable) |
| execution/ → shared/observability/ | 48 | Medium |
| orchestration/ → contracts/ (ids/errors) | 22 | Medium (reasonable) |
| orchestration/ → scale-ecosystem/feedback/ | 5 | Low (cross-layer) |
| orchestration/ → shared/observability/ | 4 | Low |
| execution/ → control-plane/iam/ | 14 | Medium (reasonable) |

### 6.3 Architecture Boundary Violation Analysis

| # | Violation Type | Description | Severity |
| --- | --- | --- | --- |
| V1 | Cross-layer dependency | orchestration/ (L2) → scale-ecosystem/feedback-loop/ (L3): OAPEFLIR learning pipeline depends on business layer | Medium |
| V2 | Missing abstraction | 5 async mirrors in marketplace/ lack corresponding sync files, directly implementing PG-specific logic | Medium |
| V3 | Giant barrel | `src/index.ts` (272 lines) exports all modules, no selective tree-shaking | Low |

### 6.4 Module Cohesion Assessment

| Module | Cohesion | Description |
| --- | --- | --- |
| execution/ | High | 14 subdirectories with clear responsibilities; recovery/ expansion remains independent |
| state-evidence/ | High | truth/events/memory/knowledge four subsystems have clear boundaries |
| control-plane/ | High | 12 subdirectories each independent; new policy-center/ and replay-repair-control/ don't affect existing modules |
| orchestration/ | **Medium** | After OAPEFLIR expanded from single file to 64 files, internal learn/ and improve-rollout/ may need extraction as independent submodules |
| shared/ | Medium | stability/ (13,642 lines) is too large, may need splitting |
| scale-ecosystem/ | Medium | marketplace/ (11,972 lines) accounts for 77%, imbalanced with other 5 submodules |
| ops-maturity/ | Medium | Among 14 submodules, 6 remain stub/partial implementation, but stub rate continues declining |

---

## 7. Code Quality Analysis

### 7.1 Stub Statistics

| Metric | v13.0 | vs v12.0 |
| --- | --- | --- |
| Total stub files | 242 | +21 |
| Total stub rate | 17.4% | ↓ 0.5pp |
| Highest stub rate module | org-governance/ (31.7%) | — |
| Lowest stub rate module | platform/ (12.9%) | — |

> Stub rate calculation: stub files / total module files. apps/ (75%) and core/ (100%) are by design intent, excluded from assessment.

#### 7.1.1 Module Stub Rate Distribution

| Module | Stub Rate | vs v12.0 |
| --- | --- | --- |
| platform/ | 12.9% | ↓ (orchestration enrichment) |
| domains/ | 17.9% | ↓ (+3 new submodules) |
| plugins/ | 20.0% | ↓ (+validators) |
| interaction/ | 24.4% | — |
| ops-maturity/ | **26.1%** | **↓ from 51.2%** |
| sdk/ | 26.9% | — |
| scale-ecosystem/ | 31.1% | — |
| org-governance/ | **31.7%** | — |

### 7.2 Top 15 Largest Source Files

| Rank | Lines | File | Responsibility |
| --- | --- | --- | --- |
| 1 | 1,113 | `domains/domain-baseline-catalog.ts` | 24 vertical domain baseline catalog |
| 2 | 1,052 | `state-evidence/truth/async-repositories/worker-repository.ts` | Async Worker data access layer |
| 3 | 1,021 | `shared/observability/slo-alerting-service.ts` | SLO alerting engine |
| 4 | 1,017 | `control-plane/approval-center/approval-flow-engine.ts` | Approval flow engine (quorum + escalation) |
| 5 | 926 | `scale-ecosystem/marketplace/human-takeover-service-async.ts` | Human takeover async mirror |
| 6 | 868 | `state-evidence/truth/sqlite/repositories/operations-repo.ts` | Operations aggregate repository |
| 7 | 867 | `scale-ecosystem/marketplace/worker-writeback-service-async.ts` | Worker writeback async mirror |
| 8 | 866 | `scale-ecosystem/marketplace/marketplace-governance-service.ts` | Marketplace governance (publish/review/withdraw) |
| 9 | 850 | `state-evidence/truth/sqlite/sqlite-database.ts` | SQLite database management (WAL + migration) |
| 10 | 829 | `domains/registry/plugin-spi-registry.ts` | Plugin SPI registry |
| 11 | 828 | `org-governance/sso-scim/scim-sync/scim-service.ts` | SCIM 2.0 user/group sync |
| 12 | 802 | `scale-ecosystem/marketplace/worker-handshake-service-async.ts` | Worker handshake async mirror |
| 13 | 798 | `domains/governance/division-loader.ts` | Division definition loader |
| 14 | 796 | `execution/lease/execution-lease-service.ts` | Execution lease (fencing token) |
| 15 | 795 | `shared/observability/anomaly-detection-service.ts` | Time-series anomaly detection (z-score/IQR/EWMA) |

> 4 files exceed 1,000 lines (vs v12.0: 2 files). 4 of Top 15 are async mirror files.

### 7.3 Sync/Async Mirror Analysis

| Metric | v13.0 | vs v12.0 |
| --- | --- | --- |
| Total async mirror files | 19 | +12 |
| Total async mirror lines | 6,934 | +5,000+ |
| Directory groups | 5 | +2 |
| Has sync counterpart | 14 (73.7%) | — |
| **Missing sync counterpart** | **5 (26.3%)** | **New risk** |

#### 7.3.1 Distribution by Module

| Module | Async Files | Lines | Missing Sync |
| --- | --- | --- | --- |
| `scale-ecosystem/marketplace/` | 9 | 4,215 | **5** |
| `platform/execution/` (across 4 subdirectories) | 7 | 1,766 | 0 |
| `platform/control-plane/incident-control/` | 1 | 784 | 0 |
| `platform/state-evidence/events/` | 1 | 121 | 0 |
| `ops-maturity/drift-detection/` | 1 | 48 | 0 |

> **Risk**: The 5 sync-less async files in marketplace/ (human-takeover/handshake/writeback/dispatch/event-bus) account for 61% of total async lines. These files directly implement PG-specific logic rather than wrapping existing sync services.

---

## 8. Testing Analysis

### 8.1 Test Scale Overview

| Metric | v13.0 | vs v12.0 |
| --- | --- | --- |
| Total test files | 1,825 `.test.ts` | +670 (+58.0%) |
| Test lines | 440,180 | +189,972 (+76.0%) |
| Test/Source ratio | 1.66:1 | ↑ from 1.01:1 |
| `test()` cases | 21,682 | — |
| `it()` cases | 536 | — |
| `describe()` blocks | 285 | — |
| **Total cases** | **22,218** | — |
| `test.skip()` count | 74 | — |

> 97.6% of cases use `node:test` native `test()` style, 2.4% use `it()`/`describe()` style.

### 8.2 Test Category Distribution

| Category | Files | Lines | test() | it() | Description |
| --- | --- | --- | --- | --- | --- |
| unit/ | 1,398 | 346,906 | 19,678 | 473 | Module isolation tests |
| integration/ | 360 | 77,159 | 1,709 | 32 | Cross-service/CLI/runtime/sandbox tests |
| golden/ | 14 | 2,033 | 80 | — | API response/CLI output/OpenAPI snapshots |
| e2e/ | 17 | 6,687 | 133 | — | End-to-end flows (~17 flows) |
| performance/ | 15 | 4,893 | 72 | 31 | Performance benchmarks |

> **helpers/**: 19 files 2,126 lines (api/pmf/concurrent-runner/typed-factories/e2e-harness/integration-context/seed/process-guard/golden/repository-harness etc.)
> **fixtures/**: 7 files 513 lines (migration snapshots + prompt-engine templates)

### 8.3 Unit Test Module Distribution (tests/unit/)

| Subdirectory | Files | Lines | Share |
| --- | --- | --- | --- |
| platform/ | 902 | 245,676 | 70.9% |
| ops-maturity/ | 103 | 21,485 | 6.2% |
| runtime/ | 48 | 16,683 | 4.8% |
| scale-ecosystem/ | 70 | 14,402 | 4.2% |
| domains/ | 55 | 11,918 | 3.4% |
| org-governance/ | 42 | 10,357 | 3.0% |
| sdk/ | 65 | 10,113 | 2.9% |
| interaction/ | 47 | 7,774 | 2.2% |
| plugins/ | 24 | 3,269 | 0.9% |
| core/ | 13 | 3,084 | 0.9% |
| root-level | 14 | 941 | 0.3% |
| Other | 15 | 1,204 | 0.3% |

### 8.4 Integration Test Module Distribution (tests/integration/)

| Subdirectory | Files | Lines |
| --- | --- | --- |
| platform/ | 272 | 59,664 |
| sdk/ | 35 | 9,139 |
| domains/ | 17 | 3,267 |
| ops-maturity/ | 17 | 2,597 |
| scale-ecosystem/ | 7 | 500 |
| interaction-governance/ | 1 | 453 |
| scale-ops/ | 1 | 405 |
| interaction/ | 3 | 287 |
| stability/ | 2 | 263 |
| workflow/ | 2 | 218 |
| org-governance/ | 2 | 194 |
| orchestration/ | 1 | 185 |

### 8.5 Coverage Configuration

| Config Item | Value |
| --- | --- |
| Tool | c8 ^11.0.0 |
| Report formats | text, html, lcov, json-summary |
| Instrumentation scope | `dist/src/**/*.js` (`"all": true` includes untested files) |
| Force 100% flag | Disabled |
| Baseline gate thresholds | All `null` (not yet seeded) |
| Baseline gate epsilon | 0.05% |
| Current global line coverage | 0.75% (affected by `"all": true`) |
| Mutation testing | Stryker ^9.6.1 + typescript-checker |

> Coverage values are extremely low because `"all": true` instruments all source files, while tests only indirectly reach a small number of internal functions through barrel re-exports. Actual functional coverage should reference per-module reports.

---

## 9. Configuration and Deployment Architecture

### 9.1 Config Directory Structure (60 files, 19 directories)

| Directory | Files | Description | vs v12.0 |
| --- | --- | --- | --- |
| domains/ | 25 | 24 vertical domain configs + domain schema | — |
| security/ | 6 | Security policies (sandbox/secrets/cve/iam/encryption/compliance) | — |
| runtime/ | 6 | Runtime configs (execution/worker/lease/queue/ha/startup) | — |
| environments/ | 5 | dev/test/staging/pre-prod/prod environment coverage | — |
| providers/ | 3 | Model provider configs (anthropic/openai/minimax) | — |
| risk/ | 2 | Risk assessment policies | — |
| **constitution/** | **1** | **Platform constitution principle registry (4 fundamental governance principles)** | **New** |
| bootstrap/ | 1 | Platform bootstrap config | — |
| conversation/ | 1 | Conversation config | — |
| cost-alert/ | 1 | Cost alert thresholds | — |
| dr/ | 1 | Disaster recovery config | — |
| exception-recovery/ | 1 | Exception recovery policies | — |
| gateways/ | 1 | Gateway config | — |
| knowledge/ | 1 | Knowledge base config | — |
| nl-gateway/ | 1 | NL gateway config | — |
| plugins/ | 1 | Plugin registry config | — |
| product/ | 1 | Product config | — |
| quality/ | 1 | Quality gate config | — |
| workflows/ | 1 | Workflow definitions | — |

#### 9.1.1 constitution/ Details (v13.0 New)

`constitution/default.json` declares 4 platform constitutional principles:

1. **human-approval-for-high-risk** — High-risk/irreversible operations require human approval. Executors: policy-center, approval-routing, platform-panic
2. **authoritative-state-before-side-effects** — State changes must persist before side effects. Executors: truth-store, dispatcher, outbox
3. **least-privilege-sandboxing** — File/network/execution scope must be within policy authorization boundaries. Executors: policy-center, sandbox, connector-framework
4. **knowledge-boundary-and-chinese-wall** — Cross-boundary knowledge access must comply with authorization and organizational isolation. Executors: knowledge-boundary, knowledge-federator, chinese-wall-policy

### 9.2 Deployment Architecture (42 files)

| Directory | Files | Tool |
| --- | --- | --- |
| helm/ | 19 | Helm chart (6 environment values + 11 templates including canary ingress) |
| terraform/ | 9 | AWS IaC (EKS/RDS/ElastiCache/ECR modules, 3 environment tfvars) |
| scripts/ | 4 | deploy.sh, rollback.sh, dr-drill.sh, verify-hot-upgrade.sh |
| chaos/ | 4 | Chaos experiments (Redis disconnect/PG disconnect/Pod Kill/Network latency) |
| prometheus/ | 3 | Prometheus + Alertmanager + alerting rules |
| grafana/ | 2 | Dashboard JSON + supply config |
| runbooks/ | 1 | Production alerting runbook |

### 9.3 npm Script System (103 scripts)

| Category | Count | Description |
| --- | --- | --- |
| stable-* rehearsals | 26 | Production rehearsal scripts (chaos/lease/migration/recovery etc.) |
| CLI operation entry points | ~60 | doctor/inspect/dispatch/worker/replay etc. |
| Testing | 9 | unit/integration/golden/pg/secret/performance/mutation |
| Coverage | 3 | report/gate/baseline:update |
| Build/Lint | 3 | build/lint/format |
| Migration | 4 | status/up/down/sqlite-to-pg |

### 9.4 Dependency List

**Runtime (11)**: @opentelemetry/{exporter-trace-otlp-http, instrumentation-http, resources, sdk-node, semantic-conventions}, ioredis ^5.10, postgres ^3.4, typescript ^5.8, ws ^8.18, xml-crypto ^2.1, zod ^3.25

**Dev (14)**: @eslint/js ^9.25, @prettier/plugin-xml ^3.4, @stryker-mutator/{core, typescript-checker} ^9.6, @types/{node, ws, xml-crypto}, c8 ^11.0, eslint ^9.25, husky ^9.1, lint-staged ^16.4, prettier ^3.8, tsx ^4.21, typescript-eslint ^8.31

---

## 10. Technical Debt and Refactoring Priorities

### 10.1 Technical Debt Inventory

| # | Category | Description | Severity | Impact Scope | vs v12.0 |
| --- | --- | --- | --- | --- | --- |
| TD-1 | Mirror maintenance | 19 async mirror files (6,934 lines), marketplace/ 5 lack sync counterparts | **High** | Cross 5 modules | **Worsened** (+12 files) |
| TD-2 | Module bloat | OAPEFLIR expanded from single file 439 lines to 64 files 5,678 lines; learn/ and improve-rollout/ can be extracted as independent submodules | Medium | orchestration/ | **New** |
| TD-3 | Stub coverage | 242 stub files (17.4%); org-governance/ (31.7%) and scale-ecosystem/ (31.1%) stub rates high | Medium | Global | Improved (↓0.5pp) |
| TD-4 | Large files | 4 files exceed 1,000 lines (DomainBaselineCatalog 1,113 / WorkerRepository 1,052 / SloAlerting 1,021 / ApprovalFlow 1,017) | Medium | 4 modules | Worsened (2→4) |
| TD-5 | Coverage baseline | Coverage gate thresholds all `null`, CI won't reject coverage regression | Medium | CI/CD | — |
| TD-6 | Weak E2E | Only 17 files 133 cases covering ~17 flows, far insufficient for production validation | Medium | tests/e2e/ | — |
| TD-7 | shared bloat | shared/stability/ (13,642 lines) accounts for 48% of shared/, can be split as independent top-level submodule | Low | platform/shared/ | — |
| TD-8 | marketplace imbalance | marketplace/ (11,972 lines) accounts for 77% of scale-ecosystem/, imbalanced with other 5 submodules | Low | scale-ecosystem/ | — |
| TD-9 | barrel export | `src/index.ts` (272 lines) exports all modules, no selective tree-shaking | Low | Entry | **New** |

#### 10.1.1 Status Updates (2026-04-24)

- **TD-1 status**: Core gap resolved. Added `src/scale-ecosystem/runtime-services/` submodule; marketplace/ root's 5 async entries previously lacking sync counterparts have all been supplemented with compatible sync/sync-shim; orphan mirror count `5 -> 0`.
- **TD-2 status**: First-phase boundary split completed. Added `src/platform/orchestration/learn/` and `src/platform/orchestration/improve-rollout/` top-level export surfaces; `learn/` + `improve-rollout/` no longer only under `oapeflir/` internal paths.
- **TD-3 status**: Guard tightened. `stub-count-ratchet` now excludes pure compatibility facade/re-export modules, avoiding miscounting compatibility layers as stubs; current ratchet baseline tightened to `111`.
- **TD-4 status**: The 4 `1000+` files listed in the document have been eliminated this round. Current line counts are `DomainBaselineCatalog 599`, `WorkerRepository 711`, `SloAlerting 992`, `ApprovalFlow 885`.
- **TD-5 status**: Resolved. `.coverage-baseline.json` now has numeric thresholds, and `compareAgainstBaseline()` now errors directly on `null/missing/invalid` baseline; the "null threshold but CI passes" loophole no longer exists.
- **TD-6 status**: Original table numbers outdated; risk now observable. Current `tests/e2e/` is `21` files, `190` cases; new `E2E` scale ratchet added to prevent end-to-end coverage from regressing again; larger-scale business process expansion can continue.
- **TD-7 status**: Top-level split entry completed. Added `src/platform/stability/index.ts` and package subpath export; `shared/stability/` now has independent top-level consumer surface; physical migration can continue.
- **TD-8 status**: Partially resolved. Heavy runtime async implementations in `marketplace/` have been moved to `runtime-services/`; current `marketplace/` is approximately `7,537` lines, significantly reduced from table's `11,972` lines.
- **TD-9 status**: Resolved. `package.json` added selective subpath exports; root `src/index.ts` changed to named exports + namespace exports combination, no longer relying solely on full barrel for architecture surface.
- **TD-2追加 status**: Physical split completed. Implementation files from `oapeflir/learn/` and `oapeflir/improve-rollout/` moved to `src/platform/orchestration/learn/` and `src/platform/orchestration/improve-rollout/`; old paths retain compatible re-export shims; after migration, `tsc` and all related 281 unit tests and 15 integration/e2e tests passed.
- **TD-7追加 status**: Physical split completed. 34 implementation files from `shared/stability/` moved to `src/platform/stability/`; old directory only retains compatibility shim; current `src/platform/stability/` is approximately `13,642` lines, `src/platform/shared/stability/` reduced to `35` lines; all related 384 stability tests passed.
- **TD-6追加 status**: Test quality guard continued tightening. E2E guard upgraded from "file/case count" to four-dimensional check: file count + case count + named flow count + skip=0; current `tests/e2e/` is `24` files, `231` `test/it` cases, `229` named flows, `0` `test.skip / it.skip / describe.skip`; already meets `50+` real flow coverage threshold, no longer停留在 early `~21` flow scale.
- **TD-8追加 status**: Structural de-imbalance completed. billing, tenant-platform, intelligence, enterprise, operations in `marketplace/` split as independent top-level submodules under `src/scale-ecosystem/`; old path shim compatibility retained; current `marketplace/` implementation lines approximately `1,202`, accounting for approximately `7.66%` of `scale-ecosystem/` implementation lines; no longer single-directory swallowing scale.
- **TD-1追加 status**: Async mirror maintenance closed. Added `SyncBackedAsyncService` to uniformly handle sync-backed async facade; thin wrappers for billing/tenant-platform/perception/dispatch/worker-handshake/worker-writeback/preemption/evolution converged to shared mechanism; added `async-mirror-ratchet` to continuously require scale-side async mirrors to have sync counterparts, preventing return to orphan mirrors and duplicate样板 diffusion.
- **TD-3追加 status**: High stub rate governance closed. `stub-count-ratchet` now identifies multi-line compatibility facade/re-export, no longer misjudging compatibility exits as stubs; current warehouse short file count is `83 / 1,212` (approximately `6.8%`); `org-governance` is `0 / 17` (`0%`); `scale-ecosystem` is `0 / 85` (`0%`); the two hot modules in the original text no longer have high stub rates.
- **TD-6追加 status**: E2E weakness item closed. E2E guard upgraded from "file/case count" to four-dimensional: file count + case count + named flow count + skip=0; current `tests/e2e/` is `24` files, `231` `test/it` cases, `229` named flows, `0` `test.skip / it.skip / describe.skip`; already meets `50+` real flow coverage threshold, no longer停留在 early `~21` flow scale.

### 10.2 Refactoring Priority Matrix

| Priority | Item | Estimated Effort | Expected Benefit |
| --- | --- | --- | --- |
| P0 | Unify async mirror strategy (abstract backend interface, eliminate 5 orphans) | 2-3 weeks | Reduce ~3,000 lines duplicate code, eliminate sync risk |
| P0 | Seed coverage baseline, enable gate | 1 day | Prevent silent coverage regression |
| P1 | Split OAPEFLIR learn/ and improve-rollout/ as top-level submodules | 1 week | Improve orchestration/ cohesion |
| P1 | Expand E2E tests to 50+ flows | 3-4 weeks | Improve production confidence |
| P2 | Split shared/stability/ as independent submodule | 1 week | Control shared/ size |
| P2 | Split DomainBaselineCatalog as per-domain config files | 2-3 days | Reduce single file size, improve maintainability |
| P2 | Reduce org-governance/ and scale-ecosystem/ stub rates | Ongoing | Improve module completeness |
| P3 | Selective barrel export (layered index.ts) | 2 days | Improve tree-shaking and build performance |

### 10.3 vs v12.0 Technical Debt Trend

| Dimension | v12.0 | v13.0 | Trend |
| --- | --- | --- | --- |
| Stub rate | 17.9% | 17.4% | ↓ Improved |
| ops-maturity stub rate | 51.2% | 26.1% | ↓↓ Significantly improved |
| Async mirror files | 7 | 19 | ↑↑ Worsened |
| 1000+ line files | 2 | 4 | ↑ Worsened |
| E2E coverage | ~17 flows | ~17 flows | → Stalled |
| Test/Source ratio | 1.01:1 | 1.66:1 | ↑↑ Significantly improved |

---

## 11. Conclusion

### 11.1 Codebase Health Rating

| Dimension | Rating | Description |
| --- | --- | --- |
| Architecture clarity | ⬛⬛⬛⬛⬜ | Five-plane layering clear; root-level orchestrator new startup orchestration clear; OAPEFLIR bloat needs attention |
| Implementation completeness | ⬛⬛⬛⬜⬜ | platform/ core complete (12.9% stubs); business layer average 26% stubs; org-governance/scale-ecosystem need enrichment |
| Testing maturity | ⬛⬛⬛⬛⬜ | 22,218 cases, 1.66:1 test ratio significantly improved; E2E and coverage gate still need strengthening |
| Ops readiness | ⬛⬛⬛⬜⬜ | 26 stable-* rehearsal scripts + chaos experiments + Helm/Terraform; coverage baseline not seeded |
| Technical debt controllability | ⬛⬛⬛⬜⬜ | Stub rate continues declining, but async mirror issue worsened; 4 large files need splitting |

### 11.2 Key Numbers Summary

| Metric | Value |
| --- | --- |
| Source scale | 1,387 files / 265,020 lines |
| Test scale | 1,825 files / 440,180 lines / 22,218 cases |
| Modules | 10 business modules + 13 platform submodules + 13 root |
| Config files | 60 JSON / 19 directories |
| Deployment files | 42 files (Helm + Terraform + Chaos) |
| npm scripts | 103 (including 26 stable-*) |
| Stub rate | 17.4% (242/1,387) |
| Async mirrors | 19 files / 6,934 lines |
| OAPEFLIR scale | 64 files / 5,678 lines (8-stage loop) |
| Largest module | execution/ (188 files / 50,695 lines) |
| Largest single file | DomainBaselineCatalog (1,113 lines) |

### 11.3 Key Changes vs v12.0

1. **Test explosion growth**: +670 files / +189,972 lines, test ratio from 1.01:1 to 1.66:1
2. **Recovery capability significantly strengthened**: execution/recovery/ from 8→23 files (6× line growth)
3. **OAPEFLIR systematized**: from single file 439 lines to 64 files 5,678 lines complete learning/improvement/release pipeline
4. **ops-maturity de-stubbed**: stub rate from 51.2% to 26.1%; PlatformOpsAgent from empty stub to 1,306 lines
5. **Architecture orchestration layer added**: 13 root-level orchestrator files (1,298 lines) + constitution/ config
6. **Async mirror expansion**: from 7 to 19 files; marketplace/ added 9 (5 without sync counterparts)

---

> **End of Document** — v13.0 @ 2026-04-23
