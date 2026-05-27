# New Platform Code File Structure Design Document

> **Document Version**: v1.3
> **Document Status**: Active (calibrated after code structure review)
> **Related Document**: "Enterprise Agent Platform Overall Technical Architecture Design Document" v2.7 §35 Recommended Code Directory
> **Related Document**: "Old System → New Platform Migration Assessment Document" v1.1
> **Design Date**: 2026-04-19
> **Last Updated**: 2026-05-26 (synced P1 public interface, federation governance persistence, event reliability, and Electron/UI contract fixes)

---

## 1. Document Purpose

This document defines the **complete code file structure** of the new platform and answers three questions:

1. How is the new platform's `src/` directory organized? What goes in each directory?
2. Where does code from the old system (`src/core/` 42 modules) go in the new platform?
3. Where do the brand-new modules, Mission/Yono, cross-platform UI, and specialty tests of the new platform go?

### 1.1 Code Structure Review Conclusions (2026-05-18)

This review is based on actual directory measurements in the current workspace, focusing on consistency between `src/`, `ui/`, `tests/`, `config/`, `deploy/`, `scripts/` and this document. Conclusions:

| Conclusion Item | Current Code Facts | Document Handling |
|-----------------|-------------------|-------------------|
| Backend seven-layer main structure | `src/platform`, `domains`, `interaction`, `org-governance`, `scale-ecosystem`, `ops-maturity` all exist as authoritative implementation locations | Keep seven-layer structure, update statistics and new directory descriptions |
| Five-plane implementation | `five-plane-*` five directories complete, with new subdomains: mission, outbox, side-effect-ledger, reconciliation, degradation | Supplement new subdomains in platform description |
| Legacy core | `src/core` only has runtime compatibility entry, should not carry new capabilities | Keep compatibility layer positioning, continue to prohibit new business capabilities from entering core |
| Mission | `src/platform/contracts/mission` and `src/platform/five-plane-control-plane/mission` have become long-term goal governance entry points | Add Mission directory responsibilities and dependency rules |
| Yono Business | `src/domains/yono` exists as a business domain instance | Mark as business domain instance in domains chapter, not part of domain framework infrastructure |
| Cross-platform UI | `ui/` Monorepo exists, containing apps, packages, tools, tests | Add UI top-level directory chapter and dependency boundaries |
| Test structure | `tests/unit`, `integration`, `e2e`, `golden`, `performance`, `invariants`, `leaks` etc. all exist | Update test directory description, supplement invariants/leaks |
| Runtime configuration and deployment | `config/`, `deploy/` cover environments, domains, risk, security, Helm, Terraform, Prometheus, Chaos, runbooks | Supplement in top-level overview and ops directory descriptions |
| Documentation risk | Large amount of statistics may become outdated as code changes rapidly | Change statistics table to "structure snapshot", require subsequent script generation |

### 1.2 Recent Structure Sync (2026-05-26)

This round did not change the seven-layer main skeleton, but the latest batch of code closures has affected the formal authority for "how the structure should be understood":

| Sync Topic | Current Code Facts | Documentation Authority |
| ------ | ------------ | -------- |
| P1 Public Query Interface | `dashboard-routes.ts` has supplemented `/v1/workers`, `/v1/queues`, `/v1/agents`, `/v1/dashboard/metrics`, `/v1/explanations`, `/v1/meta/contract-version` | UI/HTTP public queries default to reading Layer C `/v1/*`, no longer treating `/admin/*` as public data plane |
| P1 Pack / Knowledge / Builder Public Interface | `pack-routes.ts`, `plane-routes.ts`, `task-routes.ts` have supplemented `/v1/marketplace`, `/v1/knowledge`, `/v1/packs/:packId/versions`, `/v1/workflows/builder` | `platform/five-plane-interface/api/http-server/` is the current authoritative public export surface |
| Federation Governance Persistence | `scale-ecosystem/federation/` under `federation-audit.ts`, `trust-relationship.ts` already have persistence/recovery/archive/strategy enforce | Federation is no longer "pure spec commitment" but a runtime capability with database backing |
| Event Reliability | `durable-event-bus-async.ts` has fixed async failure swallowing errors | P5 event main chain continues to prioritize reliable delivery and failure visibility |
| Electron Platform Bridge | `ui/apps/electron-win/src/preload.ts` and `ui/packages/shared/platform/` have unified bridge compatibility layer | `ui/` desktop shell layer has formal bridge compatibility contract, not just smoke shell |

---

## 2. Design Principles

| # | Principle | Description |
|---|-----------|-------------|
| 1 | **Architecture-Driven Directory** | Top-level directories are organized by seven-layer architecture + five planes, not by technical concerns (controller/service/repository) |
| 2 | **Bounded Context as Directory** | Each bounded context corresponds to a second-level directory, self-contained with model/service/repository/types inside |
| 3 | **Contracts Centralized** | Inter-plane communication contracts are centralized in `platform/contracts/`, not scattered across plane directories |
| 4 | **Domain Instances Separated from Framework** | `domains/` is divided into "framework infrastructure" and "domain instance" layers; adding a new business domain only requires adding a domain instance directory |
| 5 | **Tests Mirror Source** | The `tests/` directory structure mirrors `src/`, with one-to-one path correspondence |
| 6 | **kebab-case File Naming** | All filenames use kebab-case, class/type names use PascalCase, function names use camelCase |
| 7 | **One index.ts per Directory** | Each second-level directory provides `index.ts` as the public API export; third-level directories are internal implementation details |
| 8 | **Zero Circular Dependencies** | Only upper layers may depend on lower layers (Layer N may depend on Layer N-1); same-layer coupling is resolved through contracts or events |

---

## 3. Top-Level Directory Overview

> **Current Implementation Notes (2026-05-14)**: `src/core/` in the new platform is retained only as a Legacy compatibility and migration re-export layer. The authoritative implementation locations for new runtime, contracts, execution, state, and governance capabilities are `src/platform/*`, `src/domains/*`, `src/interaction/*`, `src/org-governance/*`, `src/scale-ecosystem/*`, `src/ops-maturity/*`. New code must not use `src/core/` as a new capability entry point.

```
new-platform/
├── src/
│   ├── platform/           # Layer 1-2: Infrastructure Layer + AI Operations Layer (five planes + cross-cutting)
│   ├── domains/            # Layer 3: Business Domain Access Layer
│   ├── interaction/        # Layer 4: Intelligent Interaction Layer
│   ├── org-governance/     # Layer 5: Organization Governance Layer
│   ├── scale-ecosystem/    # Layer 6: Scale Operations Layer + Ecosystem Layer
│   ├── ops-maturity/       # Layer 7: Operations Maturity Layer
│   ├── plugins/            # Cross-layer: Plugin Ecosystem
│   ├── sdk/                # Cross-layer: SDK and Developer Experience
│   ├── apps/               # Application Entry Points (API server / Console / Workers)
│   ├── testing/            # Test Infrastructure and Common Test Contracts
│   ├── benchmarks/         # Benchmark Entry and Performance Samples
│   ├── core/               # Legacy Compatibility Re-export Layer, prohibited from new business capabilities
│   └── index.ts            # Platform Entry
├── ui/                     # Cross-Platform UI Monorepo (Web / Electron / Tauri / Mobile)
├── tests/                  # Tests (mirrors src/ structure)
├── config/                 # Versioned Configuration
├── divisions/              # Division Definitions (adapted after migration to DomainDescriptor)
├── docs_zh/                # Chinese Documentation
├── docs_en/                # English Documentation
├── scripts/                # CI/Build Scripts
├── deploy/                 # Deployment Manifests
└── [Top-level config files]  # package.json / tsconfig.json / eslint.config.js / Dockerfile / ...
```

### 3.0.1 Top-Level Directory Responsibility Boundaries (Current Authority)

| Top-level Directory | Code Facts | Responsibility Boundary | Prohibited Items |
|---------------------|------------|--------------------------|------------------|
| `src/platform/` | Backend platform core, current largest code area | Five planes, contracts, shared infrastructure, model gateway, Prompt/Eval, compliance, stability | Must not depend on `interaction/`, `domains/` business instances or UI |
| `src/domains/` | Domain framework + domain instances | Domain descriptor, risk/eval/workflow/tool configuration, Yono and other business domains | Must not place platform runtime, HTTP API, worker implementation |
| `src/interaction/` | Intelligent interaction layer | NL gateway, goal decomposer, dashboard, proactive, UX/autonomy | Must not bypass platform contracts to directly write truth store |
| `src/org-governance/` | Organization governance layer | Organization model, approval routing, SSO/SCIM, compliance boundaries, delegated governance | Must not carry general IAM infrastructure; basic IAM belongs to control-plane |
| `src/scale-ecosystem/` | Scale and ecosystem layer | Marketplace, billing, SLA, multi-region, feedback, runtime-services | Must not replace P4/P5 fact-writing chain |
| `src/ops-maturity/` | Operations maturity layer | Chaos, debugger, capacity, compliance report, edge, explainability | Must not become the sole dependency of the main execution chain |
| `src/plugins/` | Plugin ecosystem | Plugin manifest, runtime adapter, marketplace access | Must not bypass sandbox and capability |
| `src/sdk/` | Developer experience | CLI, SDK, pack/plugin tools | Must not import internal non-public API |
| `src/apps/` | Backend application entry | API, console backend, workers bootstrap | Must not precipitate business logic, only do composition and startup |
| `src/testing/` | Test common facilities | Test helpers, fixtures, invariant support | Must not be depended on by production code |
| `src/benchmarks/` | Performance sample entry | Performance/capacity benchmark helper code | Must not enter runtime main chain |
| `ui/` | Frontend monorepo | Web/desktop/mobile UI, shared frontend SDK, feature packages, UI tests | Must not directly import backend `src/*` internal implementations |
| `tests/` | Backend tests | unit/integration/e2e/golden/performance/invariants/leaks | Must not depend on production environment real credentials |
| `config/` | Versioned configuration | environments, domains, risk, security, runtime, providers | Must not place secret plaintext |
| `deploy/` | Deployment and ops assets | Helm, Terraform, Prometheus, Grafana, Chaos, runbooks, scripts | Must not serve as business logic source |

### 3.1 Old System vs. New Platform Top-Level Comparison

| Old System | New Platform | Change Description |
|------------|--------------|-------------------|
| `src/core/` (42 flat modules) | `src/platform/` + `src/domains/` + `src/interaction/` + `src/org-governance/` + `src/scale-ecosystem/` + `src/ops-maturity/` | Flat core/ split into 6 top-level directories organized by seven-layer architecture |
| `src/cli/` (78 scripts) | `src/sdk/cli/` | CLI belongs to SDK layer |
| `src/gateway/` (13 files) | `src/platform/five-plane-interface/` + `src/interaction/nl-gateway/` | API gateway belongs to P1 Interface, NL gateway belongs to Layer 4 |
| No independent frontend project | `ui/` | New cross-platform UI Monorepo, carrying Web/desktop/mobile |
| No specialty test infrastructure | `src/testing/` + `tests/invariants/` + `tests/leaks/` | New test infrastructure, invariants and leak tests |
| No benchmark entry | `src/benchmarks/` + `tests/performance/` | New performance/capacity benchmark entry |
| `src/plugins/` (20 files) | `src/plugins/` | Remained independent, structure unchanged |
| `src/index.ts` | `src/index.ts` | Retained |

### 3.2 Old System 42 Modules → New Platform Directory Mapping Quick Reference

| Old Module | New Directory | Architecture Layer |
|------------|--------------|-------------------|
| `core/types/` | `platform/contracts/types/` | Cross-layer Contract |
| `core/errors.ts` | `platform/contracts/errors.ts` | Cross-layer Contract |
| `core/constants/` | `platform/contracts/constants/` | Cross-layer Contract |
| `core/results/` | `platform/contracts/result-envelope/` | Cross-layer Contract |
| `core/utils/` | `platform/shared/utils/` | Cross-layer Shared |
| `core/lifecycle/` | `platform/shared/lifecycle/` | Cross-layer Shared |
| `core/config/` | `platform/five-plane-control-plane/config-center/` | P2 Control Plane |
| `core/storage/` | `platform/five-plane-state-evidence/truth/` | P5 State & Evidence |
| `core/events/` | `platform/five-plane-state-evidence/events/` | P5 State & Evidence |
| `core/locking/` | `platform/five-plane-execution/distributed-lock/` | P4 Execution Plane |
| `core/queue/` | `platform/five-plane-execution/queue/` | P4 Execution Plane |
| `core/cache/` | `platform/shared/cache/` | Cross-layer Shared |
| `core/api/` | `platform/five-plane-interface/api/` | P1 Interface Plane |
| `core/resource/` | `platform/five-plane-execution/resource/` | P4 Execution Plane |
| `core/runtime/` → Dispatch | `platform/five-plane-execution/dispatcher/` | P4 Execution Plane |
| `core/runtime/` → Lease | `platform/five-plane-execution/lease/` | P4 Execution Plane |
| `core/runtime/` → Worker | `platform/five-plane-execution/worker-pool/` | P4 Execution Plane |
| `core/runtime/` → HA | `platform/five-plane-execution/ha/` | P4 Execution Plane |
| `core/runtime/` → Recovery | `platform/five-plane-execution/recovery/` | P4 Execution Plane |
| `core/runtime/` → HotUpgrade | `platform/five-plane-execution/hot-upgrade/` | P4 Execution Plane |
| `core/runtime/` → StateMachine | `platform/five-plane-execution/state-transition/` | P4 Execution Plane |
| `core/runtime/` → AgentExec | `platform/five-plane-execution/execution-engine/` | P4 Execution Plane |
| `core/runtime/` → HITL | `platform/five-plane-orchestration/hitl/` | P3 Orchestration Plane |
| `core/runtime/` → Orchestration | `platform/five-plane-orchestration/routing/` | P3 Orchestration Plane |
| `core/agent-loop/` | `platform/five-plane-orchestration/oapeflir/` | P3 Orchestration Plane |
| `core/planning/` | `platform/five-plane-orchestration/planner/` | P3 Orchestration Plane |
| `core/orchestration/` | `platform/five-plane-orchestration/routing/` | P3 Orchestration Plane |
| `core/providers/` | `platform/model-gateway/provider-registry/` | AI Operations |
| `core/tools/` | `platform/five-plane-execution/tool-executor/` | P4 Execution Plane |
| `core/workflow/` | `platform/five-plane-orchestration/oapeflir/workflow/` | P3 Orchestration Plane |
| `core/artifacts/` | `platform/five-plane-state-evidence/artifacts/` | P5 State & Evidence |
| `core/feedback/` | `scale-ecosystem/feedback-loop/` | Layer 6 |
| `core/learning/` | `platform/five-plane-orchestration/oapeflir/learn/` | P3 Orchestration Plane |
| `core/evaluation/` | `platform/prompt-engine/eval/` | AI Operations |
| `core/memory/` | `platform/five-plane-state-evidence/memory/` | P5 State & Evidence |
| `core/knowledge/` | `platform/five-plane-state-evidence/knowledge/` | P5 State & Evidence |
| `core/messages/` | `platform/model-gateway/messages/` | AI Operations |
| `core/domain-registry/` | `domains/registry/` | Layer 3 |
| `core/divisions/` | `domains/governance/` | Layer 3 |
| `core/security/` | `platform/five-plane-control-plane/iam/` | P2 Control Plane |
| `core/approvals/` | `platform/five-plane-control-plane/approval-center/` | P2 Control Plane |
| `core/compliance/` | `platform/compliance/` | AI Operations |
| `core/cost/` | `platform/model-gateway/cost-tracker/` | AI Operations |
| `core/hr/` | `org-governance/org-model/` | Layer 5 |
| `core/deployment/` | `platform/five-plane-control-plane/rollout-controller/` | P2 Control Plane |
| `core/improvement/` | `platform/five-plane-orchestration/oapeflir/improve-rollout/` | P3 Orchestration Plane |
| `core/observability/` | `platform/shared/observability/` | Cross-layer Shared |
| `core/ops/` | `platform/five-plane-control-plane/incident-control/` | P2 Control Plane |
| `core/stability/` | `platform/shared/stability/` | Cross-layer Shared |
| `core/evolution/` | `ops-maturity/drift-detection/` | Layer 7 |
| `core/reliability/` | `platform/five-plane-execution/recovery/` | P4 Execution Plane |
| `core/product/` | `scale-ecosystem/marketplace/` | Layer 6 |
| `gateway/` | `platform/five-plane-interface/` (split) | P1 Interface Plane |
| `plugins/` | `plugins/` | Cross-layer |
| `cli/` | `sdk/cli/` | Cross-layer SDK |

---

## 4. platform/ — Infrastructure Layer + AI Operations Layer

`platform/` corresponds to architecture Layer 1 (Infrastructure) and Layer 2 (AI Operations), containing five planes + cross-cutting concerns.

> **Five-Plane Naming Convention**: In actual code, the five planes correspond to `five-plane-interface/`, `five-plane-control-plane/`, `five-plane-orchestration/`, `five-plane-execution/`, `five-plane-state-evidence/` — five directories with `five-plane-` prefix, equivalent to the abbreviated names `interface/`, `control-plane/` etc. in documentation. Both naming styles are valid entry points with no ambiguity in source code or configuration.

**Supplementary Notes (2026-05-18 update)**: The following independent modules also belong to platform/ but are not part of the five planes: `agent-delegation/`, `architecture/`, `compliance/`, `contracts/`, `cost-management/`, `model-gateway/`, `ops-maturity/`, `prompt-engine/`, `prompt-registry/`, `remote-coordination/`, `shared/`, `stability/`, `structure/`. Among them, `contracts/` and `shared/` are legitimate landing spots for inter-plane dependencies.

**Mission Structure Notes (2026-05-18)**: Mission is the root object for long-term goals and governance context. Contracts are located at `platform/contracts/mission/`. Lifecycle, resolution, governance, budget, handoff and other control capabilities are located at `platform/five-plane-control-plane/mission/`. The execution plane can only consume missionRef / missionSnapshotRef, and must not treat Mission as an executable object.

```
src/platform/
├── five-plane-interface/              # P1 Interface Plane ── §6 API Contracts
│   ├── api/                #   HTTP API server + OIDC/OAuth + WebSocket
│   │   ├── http-api-server.ts
│   │   ├── api-auth-service.ts
│   │   ├── oidc-oauth-service.ts
│   │   ├── openapi-document.ts
│   │   ├── mission-control-service.ts
│   │   ├── task-websocket-status-relay.ts
│   │   └── index.ts
│   ├── webhook/            #   Webhook Inbound Processing
│   │   └── index.ts
│   ├── channel-gateway/    #   Channel Gateway (Telegram/Slack/Webhook/SSE)
│   │   ├── channel-gateway-service.ts
│   │   ├── channel-gateway-delivery-service.ts
│   │   ├── channel-gateway-delivery-support.ts
│   │   ├── channel-gateway-retry-executor.ts
│   │   ├── storage-adapter.ts
│   │   ├── storage-port.ts
│   │   ├── websocket-bridge.ts
│   │   ├── stream-bridge.ts
│   │   ├── gateway-target-directory-service.ts
│   │   ├── errors.ts
│   │   ├── helpers.ts
│   │   ├── types.ts
│   │   └── index.ts
│   ├── scheduler/          #   Scheduled Task Entry (§41 Proactive Agent Trigger)
│   │   └── index.ts
│   ├── console-backend/    #   Console UI Backend (§43 Dashboard/§44 UX)
│   │   └── index.ts
│   └── ingress/            #   Ingress Traffic Management (rate limiting/routing/canary)
│       └── index.ts
│
├── five-plane-control-plane/          # P2 Control Plane ── §24 Configuration / §11 Security / §21 Approval
│   ├── tenant/             #   Tenant Management
│   │   └── index.ts
│   ├── mission/            #   Mission Long-term Goal Governance (lifecycle/resolution/budget/LiveGuard/Handoff)
│   │   ├── mission-lifecycle-service.ts
│   │   ├── mission-resolver.ts
│   │   ├── mission-governance-service.ts
│   │   ├── mission-budget-service.ts
│   │   ├── mission-live-guard.ts
│   │   └── index.ts
│   ├── iam/                #   Identity & Access Management (← core/security/)
│   │   ├── sandbox-policy.ts
│   │   ├── policy-engine.ts
│   │   ├── field-encryption.ts
│   │   ├── data-classification-service.ts
│   │   ├── audit-event-integrity.ts
│   │   ├── trusted-context-scanner.ts
│   │   ├── cve-intelligence-service.ts
│   │   ├── secret-management-service.ts
│   │   ├── secret-management-support.ts
│   │   ├── env-secret-provider.ts
│   │   ├── external-secret-provider.ts
│   │   ├── managed-secret-provider.ts
│   │   ├── vault-http-secret-provider.ts
│   │   ├── aws-kms-http-secret-provider.ts
│   │   ├── gcp-secret-manager-http-secret-provider.ts
│   │   ├── network-egress-policy.ts
│   │   ├── network-egress-audit.ts
│   │   ├── outbound-url-policy.ts
│   │   ├── file-freshness.ts
│   │   └── index.ts
│   ├── policy-center/      #   Policy Center (risk level/security policy/compliance policy centralized management)
│   │   └── index.ts
│   ├── approval-center/    #   Approval Center (← core/approvals/)
│   │   ├── approval-service.ts
│   │   ├── approval-timeout-executor.ts
│   │   └── index.ts
│   ├── rollout-controller/  #   Release Controller (← core/deployment/)
│   │   ├── traffic-routing-service.ts
│   │   └── index.ts
│   ├── incident-control/    #   Incident/Operations Control (← core/ops/)
│   │   ├── doctor-service.ts
│   │   ├── deployment-execution-service.ts
│   │   ├── environment-deployment-service.ts
│   │   ├── human-takeover-service.ts
│   │   ├── human-takeover-service-async.ts
│   │   ├── human-takeover-support.ts
│   │   ├── acceptance-readiness-service.ts
│   │   ├── operations-governance-service.ts
│   │   ├── enterprise-governance-service.ts
│   │   ├── enterprise-governance-schema.ts
│   │   ├── enterprise-governance-support.ts
│   │   ├── industrial-ops-program-service.ts
│   │   ├── release-pipeline-service.ts
│   │   ├── release-pipeline-support.ts
│   │   ├── auto-stop-loss-service.ts
│   │   ├── runtime-version-snapshot.ts
│   │   ├── workflow-dispatch-receipt.ts
│   │   ├── tenant-execution-isolation-service.ts
│   │   └── index.ts
│   ├── replay-repair-control/ #  Replay/Repair Control
│   │   └── index.ts
│   ├── config-center/       #   Configuration Governance Center (← core/config/)
│   │   ├── runtime-env.ts
│   │   ├── api-server-env.ts
│   │   ├── gateway-env.ts
│   │   ├── channel-gateway-env.ts
│   │   ├── postgres-pool-env.ts
│   │   ├── billing-env.ts
│   │   ├── startup-env-schema.ts
│   │   ├── provider-defaults.ts
│   │   ├── model-metadata-registry.ts
│   │   ├── billing-plan-catalog.ts
│   │   ├── resource-ceiling.ts
│   │   ├── profile-home.ts
│   │   ├── config-governance-service.ts
│   │   ├── config-governance-support.ts
│   │   ├── config-override-governance.ts
│   │   ├── protected-governance-integrity-service.ts
│   │   └── index.ts
│   └── audit-export/        #   Audit Export (← core/compliance/)
│       ├── audit-export-service.ts
│       └── index.ts
│
├── five-plane-orchestration/          # P3 Orchestration Plane ── §13 OAPEFLIR
│   ├── oapeflir/           #   OAPEFLIR Controlled Cognitive Kernel (← core/agent-loop/ + core/workflow/)
│   │   ├── oapeflir-loop-service.ts
│   │   ├── execute-bridge.ts
│   │   ├── runtime-execute-bridge.ts
│   │   ├── assessment-service.ts
│   │   ├── handoff-builder.ts
│   │   ├── handoff-model.ts
│   │   ├── handoff-serializer.ts
│   │   ├── stage-timeline.ts
│   │   ├── final-response.ts
│   │   ├── tool-call-record.ts
│   │   ├── dto.ts
│   │   ├── ref-types.ts
│   │   ├── kv-cache-prefix-config.ts
│   │   ├── workflow/       #     Workflow Submodule (← core/workflow/)
│   │   │   ├── minimal-workflow.ts
│   │   │   ├── workflow-validator.ts
│   │   │   ├── workflow-step-retry-policy.ts
│   │   │   ├── output-schema.ts
│   │   │   └── index.ts
│   │   ├── learn/          #     Learn Stage (← core/learning/)
│   │   │   ├── strategy-learning-service.ts
│   │   │   ├── experience-distillation-service.ts
│   │   │   ├── failure-pattern-miner.ts
│   │   │   ├── knowledge-promotion-service.ts
│   │   │   ├── learning-object-model.ts
│   │   │   ├── learning-object-validator.ts
│   │   │   ├── learning-artifact-model.ts
│   │   │   └── index.ts
│   │   ├── improve-rollout/ #    Improve/Rollout Stage (← core/improvement/)
│   │   │   ├── policy-rollout-service.ts
│   │   │   ├── release-policy.ts
│   │   │   ├── strategy-versioning.ts
│   │   │   ├── guardrail-evaluator.ts
│   │   │   ├── canary-traffic-router.ts
│   │   │   ├── auto-rollback-service.ts
│   │   │   ├── autonomy-boundary-policy.ts
│   │   │   ├── improvement-candidate-registry.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── planner/            #   Plan Engine (← core/planning/)
│   │   ├── plan-model.ts
│   │   ├── plan-builder.ts
│   │   ├── plan-evaluator.ts
│   │   ├── plan-repository.ts
│   │   ├── plan-dag-validator.ts
│   │   ├── plan-strategy-selector.ts
│   │   ├── task-decomposition-service.ts
│   │   ├── replanning-service.ts
│   │   └── index.ts
│   ├── replan/             #   Replanning
│   │   └── index.ts
│   ├── routing/            #   Routing & Orchestration (← core/orchestration/)
│   │   ├── intake-router.ts
│   │   ├── workflow-planner.ts
│   │   ├── agent-team-service.ts
│   │   └── index.ts
│   ├── escalation/         #   Escalation Handling
│   │   └── index.ts
│   └── hitl/               #   Human-in-the-Loop (← runtime/HITL BC)
│       ├── hitl-explainability-service.ts
│       └── index.ts
│
├── five-plane-execution/              # P4 Execution Plane ── §14 Runtime
│   ├── dispatcher/         #   Execution Dispatch (← runtime/BC1 Dispatch)
│   │   ├── execution-dispatch-service.ts
│   │   ├── execution-dispatch-service-async.ts
│   │   ├── execution-dispatch-support.ts
│   │   ├── execution-dispatch-reconciliation-service.ts
│   │   ├── admission-controller.ts
│   │   ├── execution-priority-preemption-service.ts
│   │   ├── execution-priority-preemption-service-async.ts
│   │   ├── execution-resource-ceiling-guard.ts
│   │   ├── execution-resource-monitor.ts
│   │   ├── execution-deviation-detector.ts
│   │   └── index.ts
│   ├── lease/              #   Lease Management (← runtime/BC2 Lease)
│   │   ├── execution-lease-service.ts
│   │   ├── lease-repository.ts
│   │   ├── lease-repository-sqlite.ts
│   │   ├── lease-repository-postgres.ts
│   │   └── index.ts
│   ├── worker-pool/        #   Worker Management (← runtime/BC3 Worker)
│   │   ├── worker-registry-service.ts
│   │   ├── worker-load-balancing.ts
│   │   ├── worker-scheduling-status.ts
│   │   ├── remote-worker-registration-service.ts
│   │   ├── remote-session-guard.ts
│   │   ├── execution-worker-handshake-service.ts
│   │   ├── execution-worker-handshake-service-async.ts
│   │   ├── execution-worker-handshake-support.ts
│   │   ├── execution-worker-handshake-types.ts
│   │   ├── execution-worker-writeback-service.ts
│   │   ├── execution-worker-writeback-service-async.ts
│   │   ├── execution-worker-writeback-support.ts
│   │   └── index.ts
│   ├── execution-engine/   #   Agent Execution Engine (← runtime/BC9)
│   │   ├── agent-executor.ts
│   │   ├── runtime-factory.ts
│   │   ├── runtime-context.ts
│   │   ├── single-task-execution.ts
│   │   ├── single-task-happy-path.ts
│   │   ├── phase1a-happy-path.ts
│   │   ├── phase1b-orchestration.ts
│   │   ├── multi-step-orchestration.ts
│   │   ├── model-call-provider.ts
│   │   ├── call-governance.ts
│   │   ├── complexity-router.ts
│   │   ├── loop-detection.ts
│   │   ├── tight-loop-detector.ts
│   │   ├── effect-buffer.ts
│   │   ├── context-compaction-service.ts
│   │   ├── prompt-partition-cache.ts
│   │   ├── output-continuation-service.ts
│   │   ├── session-lifecycle.ts
│   │   ├── middleware-init.ts
│   │   ├── agent-middleware-chain.ts
│   │   └── index.ts
│   ├── state-transition/   #   State Machine (← runtime/BC8)
│   │   ├── state-transition-machine.ts
│   │   ├── transition-service.ts
│   │   └── index.ts
│   ├── ha/                 #   High Availability Coordination (← runtime/BC5 HA)
│   │   ├── ha-coordinator-service.ts
│   │   ├── ha-repository.ts
│   │   ├── ha-repository-sqlite.ts
│   │   ├── ha-repository-postgres.ts
│   │   ├── coordinator-load-balancing-service.ts
│   │   ├── control-plane-load-balancing-schema.ts
│   │   ├── cross-region-deployment-service.ts
│   │   └── index.ts
│   ├── hot-upgrade/        #   Hot Upgrade (← runtime/BC6)
│   │   ├── hot-upgrade-service.ts
│   │   ├── hot-upgrade-service-async.ts
│   │   ├── hot-upgrade-factory.ts
│   │   ├── hot-upgrade-repository.ts
│   │   ├── hot-upgrade-repository-sqlite.ts
│   │   ├── hot-upgrade-repository-postgres.ts
│   │   └── index.ts
│   ├── recovery/           #   Recovery & Repair (← runtime/BC7 + core/reliability/)
│   │   ├── runtime-recovery-service.ts
│   │   ├── runtime-recovery-decision-service.ts
│   │   ├── runtime-recovery-replay-service.ts
│   │   ├── runtime-repair-service.ts
│   │   ├── stalled-execution-detector.ts
│   │   ├── stalled-execution-escalation-service.ts
│   │   ├── validation-repair-loop.ts
│   │   ├── execution-db-queue-disconnect-repair-service.ts
│   │   ├── failure-classification.ts
│   │   ├── repair-pipeline.ts
│   │   ├── task-card.ts
│   │   ├── validation-report.ts
│   │   ├── review-report.ts
│   │   ├── release-record.ts
│   │   ├── patch-bundle.ts
│   │   └── index.ts
│   ├── tool-executor/      #   Tool Executor (← core/tools/)
│   │   ├── command-executor.ts
│   │   ├── command-security.ts
│   │   ├── question-tool.ts
│   │   ├── todo-write-tool.ts
│   │   ├── web-fetch.ts
│   │   ├── web-search.ts
│   │   ├── tool-metadata.ts
│   │   ├── tool-call-result.ts
│   │   ├── tool-parallel-executor.ts
│   │   ├── tool-argument-coercion.ts
│   │   ├── tool-contract-validator.ts
│   │   ├── tool-execution-access.ts
│   │   ├── tool-output-sanitizer.ts
│   │   ├── tool-path-scope.ts
│   │   ├── tool-recommend-service.ts
│   │   ├── skill-execution-service.ts
│   │   ├── skill-execution-core-methods.ts
│   │   ├── skill-execution-cache-methods.ts
│   │   ├── skill-execution-support.ts
│   │   ├── skill-governance-service.ts
│   │   ├── skill-creator-service.ts
│   │   ├── role-tool-exposure-service.ts
│   │   ├── semantic-repo-map-service.ts
│   │   ├── edit-replacement-service.ts
│   │   ├── edit-snapshot-service.ts
│   │   ├── shadow-snapshot-service.ts
│   │   ├── patch-dsl-service.ts
│   │   ├── patch-dsl-support.ts
│   │   ├── code-diagnostics-service.ts
│   │   ├── mcp-tool-guard.ts
│   │   └── index.ts
│   ├── plugin-executor/    #   Plugin Executor (Runtime Sandbox)
│   │   └── index.ts
│   ├── distributed-lock/   #   Distributed Lock (← core/locking/)
│   │   ├── distributed-lock-service.ts
│   │   ├── distributed-lock-factory.ts
│   │   ├── distributed-lock-types.ts
│   │   ├── locking-support.ts
│   │   ├── sqlite-lock-adapter.ts
│   │   ├── pg-advisory-lock-adapter.ts
│   │   ├── redis-lock-adapter.ts
│   │   └── index.ts
│   ├── queue/              #   Message Queue (← core/queue/)
│   │   ├── queue-adapter.ts
│   │   ├── queue-adapter-types.ts
│   │   ├── queue-adapter-factory.ts
│   │   ├── sqlite-queue-adapter.ts
│   │   ├── redis-queue-adapter.ts
│   │   └── index.ts
│   ├── resource/           #   Resource Tracking (← core/resource/)
│   │   ├── process-tracker.ts
│   │   └── index.ts
│   ├── hibernation/        #   Long-running Workflow Hibernation/Wakeup
│   ├── queue-metrics/      #   Queue Metrics and Backlog Observation
│   ├── oapeflir/           #   Execution-side OAPEFLIR Bridge/Execution Record
│   └── startup/            #   Startup & Preflight
│       ├── startup-preflight.ts
│       ├── startup-consistency-checker.ts
│       ├── graceful-shutdown.ts
│       └── index.ts
│
├── five-plane-state-evidence/         # P5 State & Evidence Plane ── §25-§29
│   ├── truth/              #   Authoritative Data Storage (← core/storage/ after split)
│   │   ├── sqlite-database.ts
│   │   ├── async-sql-database.ts
│   │   ├── authoritative-sql-database.ts
│   │   ├── storage-backend-factory.ts
│   │   ├── storage-backend-config.ts
│   │   ├── storage-quota-service.ts
│   │   ├── session-dual-storage.ts
│   │   ├── phase1a-store.ts
│   │   ├── migration-runner.ts
│   │   ├── async-repository-registry.ts
│   │   ├── async-query-helper.ts
│   │   ├── repositories/   #     Repositories Split by Bounded Context (§9 Split Product)
│   │   │   ├── task-repository.ts
│   │   │   ├── workflow-repository.ts
│   │   │   ├── execution-repository.ts
│   │   │   ├── session-repository.ts
│   │   │   ├── worker-repository.ts
│   │   │   ├── dispatch-repository.ts
│   │   │   ├── lease-repository.ts
│   │   │   ├── lock-repository.ts
│   │   │   ├── event-repository.ts
│   │   │   ├── approval-repository.ts
│   │   │   ├── billing-repository.ts
│   │   │   ├── memory-repository.ts
│   │   │   ├── artifact-repository.ts
│   │   │   ├── division-repository.ts
│   │   │   ├── secret-repository.ts
│   │   │   ├── marketplace-repository.ts
│   │   │   ├── release-repository.ts
│   │   │   ├── organization-repository.ts
│   │   │   ├── intelligence-repository.ts
│   │   │   ├── evolution-repository.ts
│   │   │   ├── operations-repository.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── events/             #   Event Bus (← core/events/)
│   │   ├── typed-event-bus.ts
│   │   ├── typed-event-publisher.ts
│   │   ├── typed-event-payloads.ts
│   │   ├── event-types.ts
│   │   ├── event-registry.ts
│   │   ├── event-ops-service.ts
│   │   ├── durable-event-bus.ts
│   │   ├── durable-event-bus-async.ts
│   │   └── index.ts
│   ├── projections/        #   Projection Views
│   │   └── index.ts
│   ├── outbox/             #   Reliable Publish Outbox
│   ├── side-effect-ledger/ #   External Side Effect Ledger
│   ├── reconciliation/     #   State/Projection/External Write Reconciliation
│   ├── compaction/         #   Historical Event/Context Compaction
│   ├── artifacts/          #   Artifact Management (← core/artifacts/)
│   │   ├── artifact-store.ts
│   │   ├── artifact-model.ts
│   │   ├── artifact-resolver.ts
│   │   ├── artifact-versioning.ts
│   │   ├── artifact-linkage.ts
│   │   ├── artifact-publish-service.ts
│   │   ├── artifact-publish-ledger.ts
│   │   ├── artifact-preview-service.ts
│   │   ├── artifact-bundle-service.ts
│   │   ├── artifact-plane-service.ts
│   │   ├── artifact-governance-service.ts
│   │   ├── sensitive-content-scanner.ts
│   │   └── index.ts
│   ├── memory/             #   Memory Management (← core/memory/)
│   │   ├── memory-service.ts
│   │   ├── memory-provider.ts
│   │   ├── builtin-memory-provider.ts
│   │   ├── memory-retrieval-service.ts
│   │   ├── memory-consolidation.ts
│   │   ├── memory-promotion-engine.ts
│   │   ├── memory-quality.ts
│   │   ├── memory-plane-service.ts
│   │   ├── memory-schema.ts
│   │   ├── memory-write-request.ts
│   │   ├── memory-layer-model.ts
│   │   ├── user-memory-store.ts
│   │   ├── project-memory-store.ts
│   │   ├── session-summary-service.ts
│   │   ├── experience-cache-service.ts
│   │   └── index.ts
│   ├── knowledge/          #   Knowledge Plane (← core/knowledge/)
│   │   ├── knowledge-model.ts
│   │   ├── knowledge-query-service.ts
│   │   ├── knowledge-ingestion-pipeline.ts
│   │   ├── knowledge-plane-service.ts
│   │   ├── semantic-knowledge-graph.ts
│   │   ├── semantic-embedding.ts
│   │   ├── semantic-vector-store.ts
│   │   ├── semantic-vector-validation.ts
│   │   ├── keyword-index.ts
│   │   └── index.ts
│   ├── audit/              #   Audit Logs
│   │   └── index.ts
│   ├── incident/           #   Incident Records
│   │   └── index.ts
│   ├── checkpoints/        #   Checkpoints
│   │   ├── workflow-step-checkpoint.ts
│   │   └── index.ts
│   └── dlq/                #   Dead Letter Queue
│       └── index.ts
│
├── model-gateway/          # AI Operations: LLM Abstraction Layer ── §15
│   ├── provider-registry/  #   Provider Registration & Management (← core/providers/)
│   │   ├── base-chat-provider.ts
│   │   ├── unified-chat-provider.ts
│   │   ├── circuit-breaker.ts
│   │   ├── model-routing-service.ts
│   │   ├── provider-credential-pool.ts
│   │   ├── provider-credential-pool-support.ts
│   │   └── index.ts
│   ├── router/             #   Model Routing (cost/latency/capability multi-dimensional routing)
│   │   └── index.ts
│   ├── cache/              #   KV Cache / Prompt Cache
│   │   └── index.ts
│   ├── cost-tracker/       #   Token Metering & Cost Tracking (← core/cost/)
│   │   ├── budget-guard.ts
│   │   └── index.ts
│   ├── fallback/           #   Provider Failover
│   │   └── index.ts
│   ├── degradation/        #   Model/Provider Degradation Strategy
│   └── messages/           #   Message Model (← core/messages/)
│       ├── token-estimator.ts
│       ├── message-parts.ts
│       └── index.ts
│
├── prompt-engine/          # AI Operations: Prompt Management ── §16-§17
│   ├── registry/           #   Prompt Version Registry
│   │   └── index.ts
│   ├── renderer/           #   Prompt Rendering
│   │   └── index.ts
│   ├── rollout/            #   Prompt Canary Release
│   │   └── index.ts
│   └── eval/               #   Model Evaluation (← core/evaluation/)
│       ├── llm-eval-service.ts
│       ├── execution-outcome-evaluator.ts
│       ├── post-execution-quality-gate.ts
│       ├── prompt-model-policy-governance-service.ts
│       ├── prompt-model-policy-governance-schema.ts
│       └── index.ts
│
├── compliance/             # AI Operations: Compliance & Data Governance ── §23
│   ├── erasure/            #   Data Deletion (crypto-shredding)
│   │   └── index.ts
│   ├── encryption/         #   Field-level Encryption
│   │   └── index.ts
│   ├── data-residency/     #   Data Residency (cross-border compliance)
│   │   └── index.ts
│   └── lineage/            #   Data Lineage
│       └── index.ts
│
├── contracts/              #   Cross-plane Contracts ── §5
│   ├── types/              #   Domain Types (← core/types/)
│   │   ├── domain.ts
│   │   ├── ids.ts
│   │   ├── status.ts
│   │   └── index.ts
│   ├── errors.ts           #   Error System (← core/errors.ts)
│   ├── constants/          #   Global Constants (← core/constants/)
│   │   ├── time.ts
│   │   └── index.ts
│   ├── result-envelope/    #   Result Pattern (← core/results/)
│   │   ├── result-envelope.ts
│   │   └── index.ts
│   ├── request-envelope/   #   Request Envelope (§5.3)
│   │   └── index.ts
│   ├── control-directive/  #   Control Directive (§5.4)
│   │   └── index.ts
│   ├── execution-plan/     #   Execution Plan (§5.5)
│   │   └── index.ts
│   ├── execution-receipt/  #   Execution Receipt (§5.6)
│   │   └── index.ts
│   ├── mission/            #   Mission Contract (record/membership/snapshot/budget/error/event)
│   │   └── index.ts
│   ├── evidence-record/    #   Evidence Record Contract
│   │   └── index.ts
│   ├── executable-contracts/ # Executable Contracts and PlanGraph Binding
│   │   └── index.ts
│   ├── projection-update/  #   Projection Update Contract
│   │   └── index.ts
│   ├── prompt-bundle/      #   Prompt Bundle Contract
│   │   └── index.ts
│   ├── state-command/      #   State Command (§5.7)
│   │   └── index.ts
│   ├── delegation-request/ #   Delegation Request (§19)
│   │   └── index.ts
│   └── model-request/      #   Model Request (§15)
│       └── index.ts
│
└── shared/                 #   Cross-plane Shared Infrastructure
    ├── utils/              #   Utilities (← core/utils/)
    │   ├── bounded-cache.ts
    │   └── index.ts
    ├── lifecycle/          #   Service Lifecycle (← core/lifecycle/)
    │   ├── service-registry.ts
    │   ├── evolution-mvp-service.ts
    │   └── index.ts
    ├── cache/              #   Multi-level Cache (← core/cache/)
    │   ├── cache-facade.ts
    │   ├── cache-bootstrap.ts
    │   ├── cache-policy.ts
    │   ├── cache-invalidation.ts
    │   ├── cache-invalidation-broadcast.ts
    │   ├── cache-key-factory.ts
    │   ├── cache-metrics.ts
    │   ├── cache-normalizer.ts
    │   ├── cache-orchestration-service.ts
    │   ├── cache-types.ts
    │   ├── cache-errors.ts
    │   └── index.ts
    ├── observability/      #   Observability (← core/observability/)
    │   ├── structured-logger.ts
    │   ├── log-transport.ts
    │   ├── log-transport-bootstrap.ts
    │   ├── otel-bootstrap.ts
    │   ├── otel-tracer.ts
    │   ├── trace-context.ts
    │   ├── metrics-service.ts
    │   ├── metrics-server.ts
    │   ├── runtime-metrics-registry.ts
    │   ├── prometheus-metrics-exporter.ts
    │   ├── health-service.ts
    │   ├── diagnostics-service.ts
    │   ├── diagnostics-support.ts
    │   ├── diagnostics-export-service.ts
    │   ├── inspect-service.ts
    │   ├── inspect-service-support.ts
    │   ├── task-board-service.ts
    │   ├── task-timeline-service.ts
    │   ├── task-situation-report-service.ts
    │   ├── task-situation-builder.ts
    │   ├── system-situation-model.ts
    │   ├── system-situation-builder.ts
    │   ├── observation-aggregator.ts
    │   ├── sli-collection-service.ts
    │   ├── slo-alerting-service.ts
    │   ├── anomaly-detection-service.ts
    │   ├── observability-retention-service.ts
    │   ├── provider-health-tracker.ts
    │   ├── agent-state-view-service.ts
    │   └── index.ts
    └── stability/          #   Stability Rehearsal (← core/stability/)
        ├── golden-task-runner.ts
        ├── vcr-replay-fixture.ts
        ├── stable-acceptance-line.ts
        ├── stable-runtime-validator.ts
        ├── stable-release-gate.ts
        ├── stable-release-package.ts
        ├── stable-evidence-bundle.ts
        ├── stable-evidence-bundle-support.ts
        ├── stable-evidence-sequence.ts
        ├── stable-evidence-campaign.ts
        ├── stable-dispatch-rehearsal.ts
        ├── stable-dispatch-reconciliation-rehearsal.ts
        ├── stable-worker-handshake-rehearsal.ts
        ├── stable-worker-writeback-rehearsal.ts
        ├── stable-lease-rehearsal.ts
        ├── stable-concurrency-rehearsal.ts
        ├── stable-queue-delivery-rehearsal.ts
        ├── stable-event-replay-rehearsal.ts
        ├── stable-chaos-smoke.ts
        ├── stable-prompt-injection-red-team.ts
        ├── stable-rolling-upgrade-rehearsal.ts
        ├── stable-rollback-rehearsal.ts
        ├── stable-backup-restore-rehearsal.ts
        ├── stable-maintenance-rehearsal.ts
        ├── stable-gray-release-rehearsal.ts
        ├── stable-db-writability-rehearsal.ts
        ├── stable-db-queue-disconnect-rehearsal.ts
        ├── stable-migration-compatibility-rehearsal.ts
        ├── stable-runtime-soak-runner.ts
        ├── stable-cross-division-recovery-drill.ts
        └── index.ts
```

### 4.1 platform/ Statistics Snapshot (2026-05-18)

| Subdirectory | Architecture Positioning | Current TS Files | Description |
|--------------|-----------------|---------------|-------------|
| `five-plane-interface/` | P1 Interface Plane | 90 | API, channel gateway, console, scheduler, webhook |
| `five-plane-control-plane/` | P2 Control Plane | 140 | IAM, approval, config, incident, mission, risk, rollout |
| `five-plane-orchestration/` | P3 Orchestration Plane | 188 | Harness, OAPEFLIR, planner, routing, HITL, learn, rollout |
| `five-plane-execution/` | P4 Execution Plane | 230 | dispatcher, lease, worker, engine, queue, tool, recovery |
| `five-plane-state-evidence/` | P5 State & Evidence | 250 | truth, events, outbox, dlq, memory, knowledge, audit, ledger |
| `shared/` | Cross-plane Shared | 130 | cache, observability, events, lifecycle, stability, context |
| `contracts/` | Cross-plane Contracts | 60 | request, plan, state, mission, evidence, prompt, projection |
| `model-gateway/` | AI Operations | 28 | provider, router, fallback, degradation, cost, messages |
| `prompt-engine/` | AI Operations | 26 | registry, renderer, rollout, eval |
| `compliance/` | AI Operations | 12 | erasure, encryption, data residency, lineage |
| `stability/` | Stability/Reliability | 48 | reliability and stability rehearsal supplements |
| Other platform independent modules | Cross-cutting/auxiliary | 22 | architecture, agent-delegation, remote-coordination, structure etc. |
| **Total** | | **1,224** | Current `src/platform/**/*.ts` snapshot |

---

## 5. domains/ — Business Domain Access Layer

`domains/` corresponds to architecture Layer 3 (§37-§38), divided into "domain framework infrastructure" and "domain instance" layers.

> **Actual Domain Instance Count (2026-05-18 update)**: `src/domains/` currently contains domain framework infrastructure, domain public services, and 30+ vertical domain instances. Framework infrastructure includes `registry`, `risk-profile`, `knowledge-schema`, `eval-framework`, `prompt-library`, `recipes`, `interaction-policy`, `governance`, `business-pack`, `canonical-meta-model`. Vertical domain instances include `academic-research`, `advertising`, `agriculture`, `coding`, `financial-services`, `finance-accounting`, `healthcare`, `legal`, `quant-trading`, `yono`, etc. `yono` is the Yono Business domain instance and cannot be classified as framework infrastructure.

```
src/domains/
├── registry/               # Domain Registry Center (← core/domain-registry/)
│   ├── domain-registry-service.ts
│   ├── domain-model.ts
│   ├── domain-event-payload.ts
│   ├── domain-smoke-test.ts
│   ├── registry-bootstrap.ts
│   ├── contract-registry.ts
│   ├── workflow-registry.ts
│   ├── tool-bundle-registry.ts
│   ├── plugin-spi.ts
│   ├── plugin-spi-registry.ts
│   ├── plugin-runtime-host.ts
│   ├── plugin-runtime-child.ts
│   ├── plugin-runtime-protocol.ts
│   └── index.ts
├── risk-profile/           # Domain Risk Profile (NEW §37)
│   └── index.ts
├── knowledge-schema/       # Domain Knowledge Schema (NEW §37)
│   └── index.ts
├── eval-framework/         # Domain Evaluation Framework (NEW §37)
│   └── index.ts
├── prompt-library/         # Domain Prompt Library (NEW §37)
│   └── index.ts
├── recipes/                # DomainRecipe Prototype Templates (NEW §38)
│   └── index.ts
├── interaction-policy/     # Cross-domain Interaction Policy (NEW §37)
│   └── index.ts
├── governance/             # Domain Governance (← core/divisions/)
│   ├── division-loader.ts
│   ├── division-loader-support.ts
│   ├── safe-load-division-registry.ts
│   ├── hr-role-governance-service.ts
│   └── index.ts
├── business-pack/          # Business Pack Domain Framework
│   └── index.ts
├── canonical-meta-model/   # Canonical Meta Model
│   └── index.ts
├── coding/                 # Coding Domain Instance
│   └── index.ts
├── operations/             # Operations Domain Instance
│   └── index.ts
├── yono/                   # Yono Business Domain Instance
│   └── index.ts
├── [30+ vertical domain instances]         # academic-research, advertising, agriculture, content-moderation, creative-production, customer-service, data-engineering, ecommerce, education, executive-assistant, facilities, finance-accounting, financial-services, game-dev, game-publishing, healthcare, human-resources, industry-research, it-operations, knowledge-base, legal, live-streaming, manufacturing, marketing, product-management, project-management, quality-assurance, quant-trading, supply-chain, user-operations, etc.
└── [framework and public services]         # domain-baseline-catalog.ts, domain-baseline-seeds.ts, domain-descriptor-orchestration-service.ts, domain-eval-framework-service.ts, domain-knowledge-schema-service.ts, domain-module-helper.ts, domain-recipe-service.ts, domain-risk-profile-service.ts, domain-specs.ts, domain-task-design-service.ts, domains-bootstrap.ts
```

---

## 6. interaction/ — Intelligent Interaction Layer

`interaction/` corresponds to architecture Layer 4 (§39-§44), all **newly created modules** (old system completely missing).

> **Actual Submodules (2026-05-18 update)**: Document §6 records 6 subdirectories, actual code contains 13 subdirectories with deep submodules (autonomy, dashboard, goal-decomposer, nl-gateway, proactive-agent, ux each have deep submodules), all reflected in the tree below and §13 statistics table.

```
src/interaction/
├── nl-gateway/             # Natural Language Task Entry (NEW §39)
│   ├── intent-parser/      #   Intent Parsing
│   │   └── index.ts
│   ├── slot-resolver/      #   Slot Extraction
│   │   └── index.ts
│   ├── ambiguity-handler/  #   Ambiguity Handling & Clarification Dialog
│   │   └── index.ts
│   └── index.ts
├── goal-decomposer/        # Goal Decomposition Engine (NEW §40)
│   ├── planner/            #   Decomposition Strategy (template/LLM/hybrid/human-assisted)
│   │   └── index.ts
│   ├── dependency-graph/   #   Task Dependency DAG
│   │   └── index.ts
│   ├── validator/          #   Decomposition Result Validation
│   │   └── index.ts
│   └── index.ts
├── proactive-agent/        # Proactive Agent Framework (NEW §41)
│   ├── trigger-engine/     #   Trigger Engine (cron/event/threshold)
│   │   └── index.ts
│   ├── schedule-manager/   #   Scheduled Task Management
│   │   └── index.ts
│   ├── event-watcher/      #   Event-driven Wake-up
│   │   └── index.ts
│   └── index.ts
├── autonomy/               # Gradual Autonomy Model (NEW §42)
│   ├── trust-scorer/       #   Trust Scoring
│   │   └── index.ts
│   ├── level-manager/      #   Autonomy Level State Machine
│   │   └── index.ts
│   ├── promotion-engine/   #   Promotion/Demotion Rules Engine
│   │   └── index.ts
│   └── index.ts
├── dashboard/              # Unified Operations Dashboard (NEW §43)
│   ├── metric-aggregator/  #   Metric Aggregation
│   │   └── index.ts
│   ├── health-scorer/      #   Health Scoring
│   │   └── index.ts
│   ├── alert-router/       #   Alert Routing
│   │   └── index.ts
│   └── index.ts
└── ux/                     # Non-technical User Experience (NEW §44)
    ├── wizard/             #   Visual Domain Onboarding Wizard
    │   └── index.ts
    ├── template-engine/    #   Visual Workflow Builder
    │   └── index.ts
    ├── onboarding/         #   Guided First-time User Experience
    │   └── index.ts
    └── index.ts
```

---

## 7. org-governance/ — Organization Governance Layer

`org-governance/` corresponds to architecture Layer 5 (§46-§51). Except for a small amount of code migrated from `core/hr/` to `org-model/`, the rest are **newly created modules**.

> **Actual Submodules (2026-05-18 update)**: Document §7 records 7 subdirectories, actual code contains 24 subdirectories with deep submodules (approval-routing, compliance-engine, delegated-governance, knowledge-boundary, org-model, org-routing, sso-scim each have deep submodules), all reflected in the tree below and §13 statistics table.

```
src/org-governance/
├── org-model/              # Organization Hierarchy Model (NEW §46, partially migrated from core/hr/)
│   ├── hierarchy/          #   Organization Tree (company/division/department/team)
│   │   └── index.ts
│   ├── org-node/           #   OrgNode CRUD + Hierarchy Inheritance
│   │   └── index.ts
│   ├── sync/               #   Organization Change Sync (SCIM/HR API/manual)
│   │   └── index.ts
│   ├── hr-role-governance-service.ts  # ← core/hr/
│   └── index.ts
├── approval-routing/       # Organization Architecture Approval Routing (NEW §47)
│   ├── route-engine/       #   Dynamic Routing Engine (org-chart/amount-based/SoD)
│   │   └── index.ts
│   ├── escalation/         #   Approval Escalation
│   │   └── index.ts
│   ├── delegation/         #   Approval Delegation (leave proxy)
│   │   └── index.ts
│   └── index.ts
├── sso-scim/               # SSO/SCIM Integration (NEW §48)
│   ├── saml/               #   SAML SSO
│   │   └── index.ts
│   ├── oidc/               #   OIDC SSO
│   │   └── index.ts
│   ├── scim-sync/          #   SCIM User/Group Sync
│   │   └── index.ts
│   └── index.ts
├── compliance-engine/      # Department-level Compliance Policy Engine (NEW §49)
│   ├── policy-resolver/    #   Policy Resolution (inheritance+override)
│   │   └── index.ts
│   ├── inheritance/        #   Policy Inheritance Rules (children can only tighten, not relax)
│   │   └── index.ts
│   ├── audit-enforcer/     #   Compliance Audit Enforcement
│   │   └── index.ts
│   └── index.ts
├── knowledge-boundary/     # Knowledge Domain Isolation & Controlled Sharing (NEW §50)
│   ├── boundary-manager/   #   Boundary Definition (strict/controlled/open)
│   │   └── index.ts
│   ├── sharing-gate/       #   Cross-domain Sharing Gateway
│   │   └── index.ts
│   ├── access-log/         #   Access Audit Log
│   │   └── index.ts
│   └── index.ts
└── delegated-governance/   # Hierarchical Governance Delegation (NEW §51)
    ├── scope-manager/      #   Delegation Scope Management
    │   └── index.ts
    ├── delegation-registry/ #  Delegation Registry
    │   └── index.ts
    └── index.ts
```

---

## 8. scale-ecosystem/ — Scale Operations Layer + Ecosystem Layer

`scale-ecosystem/` corresponds to architecture Layer 6 (§52-§57). `feedback-loop/` migrated from `core/feedback/`, `marketplace/` partially migrated from `core/product/`, and the rest are **newly created modules**.

> **Actual Submodules (2026-05-18 update)**: Document §8 records 6 top-level subdirectories, actual code contains 46 subdirectories with deep submodules (billing, capacity-planning, cost-attribution, enterprise, federation, feedback-loop, integration, intelligence, marketplace, multi-region, operations, resource-manager, runtime-services, sla, sla-engine, tenant-platform each have deep submodules), all reflected in the tree below and §13 statistics table.

> **Additional Submodules (2026-05-18 update)**: Top-level module count expanded from 6 to 16 (billing, capacity-planning, cost-attribution, enterprise, federation, intelligence, operations, runtime-services, sla, tenant-platform etc. 10 new additions), incorporated into §13 statistics table.

```
src/scale-ecosystem/
├── multi-region/           # Multi-Region Deployment (NEW §52)
│   ├── region-router/      #   Region Routing Decision
│   │   └── index.ts
│   ├── data-replicator/    #   Cross-region Data Sync
│   │   └── index.ts
│   ├── failover-controller/ #  Region Failover
│   │   └── index.ts
│   └── index.ts
├── resource-manager/       # Resource Competition Management (NEW §53)
│   ├── fair-queue/         #   Weighted Fair Queue
│   │   └── index.ts
│   ├── quota-enforcer/     #   Quota Enforcement
│   │   └── index.ts
│   ├── preemption/         #   Priority Preemption
│   │   └── index.ts
│   └── index.ts
├── sla-engine/             # SLA Tier Guarantee (NEW §54)
│   ├── tier-resolver/      #   SLA Tier Resolution
│   │   └── index.ts
│   ├── resource-allocator/ #   Resource Allocation
│   │   └── index.ts
│   ├── breach-detector/    #   SLA Violation Detection
│   │   └── index.ts
│   └── index.ts
├── marketplace/            # Agent Marketplace & Ecosystem (NEW §55, partially migrated from core/product/)
│   ├── catalog/            #   Marketplace Catalog
│   │   └── index.ts
│   ├── certification/      #   Certification & Security Scan
│   │   └── index.ts
│   ├── publisher/          #   Publishing Management
│   │   └── index.ts
│   ├── billing-service.ts
│   ├── billing-service-async.ts
│   ├── billing-payment-gateway.ts
│   ├── cost-estimation-service.ts
│   ├── pmf-validation-service.ts
│   ├── marketplace-governance-service.ts
│   ├── compliance-program-service.ts
│   ├── ha-program-service.ts
│   ├── platform-operator-service.ts
│   ├── tenant-platform-service.ts
│   ├── tenant-platform-service-async.ts
│   ├── enterprise-capability-matrix-service.ts
│   ├── data-plane-flow-service.ts
│   ├── data-plane-flow-service-async.ts
│   ├── perception-service.ts
│   ├── perception-service-async.ts
│   └── index.ts
├── feedback-loop/          # Feedback-driven Continuous Improvement (§56, ← core/feedback/)
│   ├── collector/          #   Signal Collection
│   │   ├── feedback-collector.ts
│   │   ├── feedback-model.ts
│   │   ├── signal-preprocessor.ts
│   │   ├── domain-event-feedback-consumer.ts
│   │   └── index.ts
│   ├── analyzer/           #   Signal Analysis (NEW)
│   │   └── index.ts
│   ├── improvement-tracker/ #  Improvement Tracking (NEW)
│   │   └── index.ts
│   └── index.ts
└── integration/            # External System Integration Framework (NEW §57)
    ├── connector-registry/ #   Connector Registry
    │   └── index.ts
    ├── connector-runtime/  #   Connector Runtime
    │   └── index.ts
    ├── health-monitor/     #   Connector Health Monitoring
    │   └── index.ts
    └── index.ts
```

---

## 9. ops-maturity/ — Operations Maturity Layer

`ops-maturity/` corresponds to architecture Layer 7 (§59-§70). `drift-detection/` migrated from `core/evolution/`, and the rest are **newly created modules**.

> **Actual Submodules (2026-05-18 update)**: Document §9 records 11 top-level subdirectories, actual code contains 66 subdirectories with deep submodules (agent-lifecycle, capacity-planner, chaos, compliance-reporter, cost-optimizer, drift-detection, edge-runtime, emergency, explainability, improvement, learning, monitoring, multimodal, platform-ops-agent, version-management, workflow-debugger each have deep submodules), all reflected in the tree below and §13 statistics table.

> **Additional Submodules (2026-05-18 update)**: Top-level module count expanded from 11 to 16 (learning, monitoring etc. new additions), incorporated into §13 statistics table.

```
src/ops-maturity/
├── explainability/         # Agent Explainability (NEW §59)
│   ├── evidence-collector/
│   │   └── index.ts
│   ├── causal-chain-builder/
│   │   └── index.ts
│   ├── explanation-renderer/
│   │   └── index.ts
│   ├── explanation-cache/
│   │   └── index.ts
│   └── index.ts
├── emergency/              # Emergency Brake (NEW §60)
│   ├── panic-controller/
│   │   └── index.ts
│   ├── forensic-snapshot/
│   │   └── index.ts
│   ├── resume-protocol/
│   │   └── index.ts
│   └── index.ts
├── agent-lifecycle/        # Agent Unified Lifecycle (NEW §61)
│   ├── agent-registry/
│   │   └── index.ts
│   ├── version-manager/
│   │   └── index.ts
│   ├── canary-controller/
│   │   └── index.ts
│   ├── retirement/
│   │   └── index.ts
│   └── index.ts
├── edge-runtime/           # Offline & Edge Deployment (NEW §62)
│   ├── edge-orchestrator/
│   │   └── index.ts
│   ├── edge-executor/
│   │   └── index.ts
│   ├── local-model/
│   │   └── index.ts
│   ├── sync-queue/
│   │   └── index.ts
│   └── index.ts
├── drift-detection/        # Behavior Drift Detection (§63, ← core/evolution/)
│   ├── fingerprint-builder/
│   │   └── index.ts
│   ├── changepoint-detector/
│   │   └── index.ts
│   ├── cross-agent-analyzer/
│   │   └── index.ts
│   ├── evolution-mvp-service.ts
│   ├── evolution-mvp-service-async.ts
│   ├── evolution-mvp-support.ts
│   ├── evolution-integration-service.ts
│   ├── evolution-registry.ts
│   ├── proposal-engine.ts
│   ├── reflection-engine.ts
│   ├── benchmark-runner.ts
│   ├── evidence-store.ts
│   ├── promotion-gate.ts
│   ├── rollout-manager.ts
│   └── index.ts
├── cost-optimizer/         # Cost Attribution & Optimization (NEW §64)
│   ├── attribution-engine/
│   │   └── index.ts
│   ├── recommendation-engine/
│   │   └── index.ts
│   ├── simulator/
│   │   └── index.ts
│   └── index.ts
├── workflow-debugger/      # Visual Debugger (NEW §65)
│   ├── timeline-renderer/
│   │   └── index.ts
│   ├── breakpoint-manager/
│   │   └── index.ts
│   ├── run-comparator/
│   │   └── index.ts
│   └── index.ts
├── compliance-reporter/    # Compliance Report Engine (NEW §66)
│   ├── template-registry/
│   │   └── index.ts
│   ├── evidence-mapper/
│   │   └── index.ts
│   ├── report-renderer/
│   │   └── index.ts
│   └── index.ts
├── capacity-planner/       # Capacity Planning (NEW §67)
│   ├── trend-analyzer/
│   │   └── index.ts
│   ├── forecaster/
│   │   └── index.ts
│   ├── simulator/
│   │   └── index.ts
│   └── index.ts
├── multimodal/             # Multimodal Capabilities (NEW §68)
│   ├── image-processor/
│   │   └── index.ts
│   ├── speech-processor/
│   │   └── index.ts
│   ├── document-parser/
│   │   └── index.ts
│   ├── modality-router/
│   │   └── index.ts
│   └── index.ts
└── platform-ops-agent/     # Platform Self-Ops Agent (NEW §69)
    ├── incident-diagnoser/
    │   └── index.ts
    ├── config-optimizer/
    │   └── index.ts
    ├── capacity-predictor/
    │   └── index.ts
    ├── dev-assistant/
    │   └── index.ts
    ├── health-monitor/
    │   └── index.ts
    └── index.ts
```

---

## 10. plugins/ + sdk/ + apps/ + Top-level Files

### 10.1 plugins/ — Cross-layer Plugin Ecosystem

Structure is basically the same as the old system; SPI pattern retained:

```
src/plugins/
├── index.ts
├── builtin-plugin-registry.ts
├── growth-config.ts
├── operations-config.ts
├── adapters/               # Domain Adapters
│   ├── asset-production-adapter.ts
│   ├── crm-adapter.ts
│   ├── game-dev-adapter.ts
│   ├── github-adapter.ts
│   └── livestream-adapter.ts
├── planners/               # Planners
│   └── basic-planner.ts
├── presenters/             # Presenters
│   ├── coding-presenter.ts
│   ├── growth-presenter.ts
│   └── operations-presenter.ts
├── retrievers/             # Retrievers
│   ├── asset-production-retriever.ts
│   ├── coding-retriever.ts
│   ├── game-dev-retriever.ts
│   ├── growth-retriever.ts
│   ├── livestream-retriever.ts
│   └── operations-retriever.ts
└── validators/             # Validators
    └── basic-evaluator.ts
```

### 10.2 sdk/ — SDK & Developer Experience (§22)

> **Additional Submodules (2026-05-18 update)**: Besides the 4 modules shown in documentation, actual code also contains `admin-sdk/`, `harness-sdk/`, `workbench/` three additional modules, incorporated into §13 statistics.

```
src/sdk/
├── pack-sdk/               # Business Pack Development SDK
│   └── index.ts
├── plugin-sdk/             # Plugin Development SDK
│   └── index.ts
├── client-sdk/             # Client SDK (REST/WebSocket)
│   └── index.ts
├── cli/                    # CLI Entry Point (← src/cli/ 78 scripts migrated)
│   ├── acceptance-readiness.ts
│   ├── api-server.ts
│   ├── billing.ts
│   ├── channel-gateway.ts
│   ├── dispatch-execution.ts
│   ├── dispatch-reconcile.ts
│   ├── doctor.ts
│   ├── inspect.ts
│   ├── release-pipeline.ts
│   ├── secret-management.ts
│   ├── takeover.ts
│   ├── task-board.ts
│   ├── worker-handshake.ts
│   ├── worker-register.ts
│   ├── worker-writeback.ts
│   ├── ... (remaining 63 CLI scripts, structure unchanged)
│   └── index.ts
├── admin-sdk/              # Admin SDK
│   └── index.ts
├── harness-sdk/           # Harness SDK
│   └── index.ts
└── workbench/             # Workbench SDK
    └── index.ts
```

### 10.3 apps/ — Application Entry Points

```
src/apps/
├── api/                    # API Server Entry (assembles platform/five-plane-interface/ modules)
│   └── index.ts
├── console/                # Console UI Backend Entry
│   └── index.ts
└── workers/                # Worker Process Entry (assembles platform/five-plane-execution/ modules)
    └── index.ts
```

### 10.4 Top-level Files

```
src/
└── index.ts                # Platform Main Entry (bootstrapping + module registration)
```

### 10.5 Project Root Files (directly migrated from old system)

```
new-platform/
├── package.json            # ← Directly migrated, clean up unnecessary scripts
├── tsconfig.json           # ← Directly migrated
├── tsconfig.build.json     # ← Directly migrated
├── eslint.config.js        # ← Directly migrated
├── .c8rc.json              # ← Directly migrated
├── Dockerfile              # ← Directly migrated, add edge deployment variant
├── docker-compose.yml      # ← Directly migrated, add Redis cluster variant
├── .env.example            # ← Directly migrated, add Layer 4-7 config items
├── .github/workflows/      # ← Directly migrated 4 CI workflows
├── scripts/                # ← Directly migrated CI/build scripts
├── deploy/                 # ← Directly migrated deployment manifests
├── config/                 # ← Directly migrated 27 config files
└── divisions/              # ← Adapted migration (adapted to DomainDescriptor)
```

---

## 11. ui/ — Cross-Platform UI Monorepo

`ui/` is the frontend sub-project in the current repository, not migrated into backend `src/`. It interacts with the backend through API-first, DTO → VM → Props, PlatformAdapter and feature gate. UI code must not directly import backend `src/platform/*` internal implementations; can only depend on generated contracts, OpenAPI/schema, frontend shared API client, or mock/contract seam.

```
ui/
├── apps/
│   ├── web/                # React + Vite Web SPA, can run main entry
│   ├── electron-win/       # Windows Electron shell
│   ├── tauri-macos/        # macOS Tauri shell
│   ├── tauri-linux/        # Linux Tauri shell
│   └── mobile/             # React Native mobile shell
├── packages/
│   ├── shared/
│   │   ├── api-client/     # REST/WS client, endpoint binding
│   │   ├── auth/           # token/session/auth callback
│   │   ├── state/          # Query/store/offline persistence
│   │   ├── sync/           # offline queue/conflict resolver
│   │   ├── domain/         # DomainUIConfig, permissions, field masking
│   │   ├── platform/       # PlatformAdapter contract + adapters
│   │   ├── telemetry/      # Frontend telemetry
│   │   ├── i18n/           # locale/catalog
│   │   ├── nl-client/      # NL interaction client
│   │   └── types/          # Frontend common types
│   ├── ui-core/            # Web/desktop design system, business components, charts, layout, theme
│   ├── ui-mobile/          # Mobile components, native module seam, navigation
│   ├── features/           # Business feature packages, unified web/mobile/hooks split
│   │   ├── dashboard/
│   │   ├── task-cockpit/
│   │   ├── workflow-cockpit/
│   │   ├── approval/
│   │   ├── hitl/
│   │   ├── settings/
│   │   ├── domain-wizard/
│   │   ├── stability/
│   │   ├── takeover/
│   │   ├── alerts/
│   │   ├── dispatch/
│   │   ├── inspect/
│   │   ├── health/
│   │   ├── incidents/
│   │   ├── conversation/
│   │   ├── feature-flags/
│   │   ├── agent-manager/
│   │   ├── workflow-builder/
│   │   ├── workflow-debugger/
│   │   ├── explainability/
│   │   ├── cost-center/
│   │   ├── marketplace/
│   │   ├── analytics/
│   │   └── governance-compliance/
│   └── storybook/          # Component documentation and visual review
├── tools/
│   ├── codegen/            # Generate frontend types and endpoint binding from backend contracts/OpenAPI/schema
│   ├── mock-server/        # Planned endpoint / WS event typed mock
│   └── e2e/                # UI E2E tooling
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── features/
│   ├── apps/
│   ├── a11y/
│   ├── playwright/
│   └── docs/
└── docs/                   # UI ADR / Storybook documentation
```

### 11.1 UI Feature Directory Rules

Each `ui/packages/features/<feature>/src/` must maintain the same split:

```
src/
├── web/                    # Web/desktop rendering entry
├── mobile/                 # Mobile rendering entry
├── hooks/                  # Query/VM hooks, only return ViewModel
├── route.ts                # route registration
├── permissions.ts          # feature guard / visibility
├── mapper.ts               # DTO → VM
└── index.ts                # public exports
```

Rules:

- Components must not directly consume backend DTO; must go through mapper to VM.
- Planned backend capabilities must use feature gate + typed mock + degradation banner.
- Platform-specific capabilities can only be injected through PlatformAdapter; forbidden to directly call Electron/Tauri/RN API in feature.
- UI tests belong to `ui/tests/*` or `tests/unit/ui` / `tests/integration/ui`; must not mix into backend runtime tests.

---

## 12. tests/ — Test Directory Structure

Tests **mirror `src/` structure**; each source directory has a corresponding test directory under tests/.

> **Actual Test Subdirectories (2026-05-18 update)**: Actual `tests/` contains `unit/`, `integration/`, `e2e/`, `golden/`, `performance/`, `invariants/`, `leaks/`, `fixtures/`, `helpers/` and other specialty directories; UI also has independent `ui/tests/`. Test directories no longer just simply mirror source, but also bear architectural invariants, memory leak, deployment, documentation and UI acceptance.

```
tests/
├── helpers/                # Test Infrastructure (← Directly migrated 19 files)
│   ├── fs.ts
│   ├── seed.ts
│   ├── typed-factories.ts
│   ├── env.ts
│   ├── golden.ts
│   ├── e2e-harness.ts
│   ├── integration-context.ts
│   ├── repository-harness.ts
│   ├── concurrent-runner.ts
│   ├── test-cleanup.ts
│   ├── process-guard.ts
│   ├── fixtures/
│   │   ├── base.ts
│   │   └── composite.ts
│   ├── perception.ts
│   ├── pmf.ts
│   ├── billing.ts
│   ├── api.ts
│   ├── cli.ts
│   └── pg-test-helper.ts
│
├── unit/                   # Unit Tests (mirrors src/ structure)
│   ├── platform/
│   │   ├── five-plane-interface/
│   │   │   ├── api/
│   │   │   └── channel-gateway/
│   │   ├── five-plane-control-plane/
│   │   │   ├── iam/
│   │   │   ├── approval-center/
│   │   │   ├── config-center/
│   │   │   ├── incident-control/
│   │   │   ├── rollout-controller/
│   │   │   └── audit-export/
│   │   ├── five-plane-orchestration/
│   │   │   ├── oapeflir/
│   │   │   ├── planner/
│   │   │   ├── routing/
│   │   │   └── hitl/
│   │   ├── five-plane-execution/
│   │   │   ├── dispatcher/
│   │   │   ├── lease/
│   │   │   ├── worker-pool/
│   │   │   ├── execution-engine/
│   │   │   ├── state-transition/
│   │   │   ├── ha/
│   │   │   ├── hot-upgrade/
│   │   │   ├── recovery/
│   │   │   ├── tool-executor/
│   │   │   ├── distributed-lock/
│   │   │   └── queue/
│   │   ├── five-plane-state-evidence/
│   │   │   ├── truth/
│   │   │   ├── events/
│   │   │   ├── artifacts/
│   │   │   ├── memory/
│   │   │   └── knowledge/
│   │   ├── model-gateway/
│   │   ├── prompt-engine/
│   │   ├── contracts/
│   │   └── shared/
│   │       ├── cache/
│   │       ├── observability/
│   │       └── stability/
│   ├── domains/
│   │   ├── registry/
│   │   └── governance/
│   ├── interaction/        # All new tests
│   │   ├── nl-gateway/
│   │   ├── goal-decomposer/
│   │   ├── proactive-agent/
│   │   ├── autonomy/
│   │   ├── dashboard/
│   │   └── ux/
│   ├── org-governance/     # All new tests
│   │   ├── org-model/
│   │   ├── approval-routing/
│   │   ├── sso-scim/
│   │   ├── compliance-engine/
│   │   ├── knowledge-boundary/
│   │   └── delegated-governance/
│   ├── scale-ecosystem/
│   │   ├── marketplace/
│   │   ├── feedback-loop/
│   │   └── ...
│   ├── ops-maturity/
│   │   ├── drift-detection/
│   │   └── ...
│   ├── plugins/
│   └── sdk/
│       └── cli/
│
├── integration/            # Integration Tests (grouped by concern)
│   ├── platform/
│   │   ├── security/       # 64 security boundary tests
│   │   ├── runtime/        # dispatch/lease/worker/recovery
│   │   ├── storage/        # data integrity
│   │   ├── contract/       # contract verification
│   │   ├── reliability/    # reliability invariants
│   │   ├── concurrency/    # concurrency tests
│   │   ├── recovery/       # recovery tests
│   │   └── observability/  # observability
│   ├── interaction/        # All new
│   ├── org-governance/     # All new
│   ├── scale-ecosystem/
│   ├── ops-maturity/
│   └── sdk/
│       └── cli/            # 32 CLI integration tests
│
├── golden/                 # Golden Snapshot Tests (← Directly migrated)
│   ├── diagnostics-bundle.test.ts
│   ├── openapi-document.test.ts
│   ├── release-plan-output.test.ts
│   ├── session-summary.test.ts
│   ├── phase1a-golden-tasks.test.ts
│   ├── prompt-assembly.test.ts
│   ├── workflow-validation.test.ts
│   ├── cli-help-text.test.ts
│   └── snapshots/
│
├── e2e/                    # End-to-end Tests
│   ├── task-lifecycle.test.ts
│   ├── multi-step-workflow.test.ts
│   ├── lease-recovery.test.ts
│   ├── operator-takeover.test.ts
│   ├── error-propagation.test.ts
│   ├── oapeflir-full-loop.test.ts
│   ├── session-memory-flow.test.ts
│   ├── gateway-webhook-flow.test.ts
│   ├── streaming-response.test.ts
│   └── approval-event-flow.test.ts
│
├── performance/            # Performance Tests and Capacity Benchmark
├── invariants/             # Architectural Invariant Tests
├── leaks/                  # Memory/Handle Leak Tests
├── unit/ui/                # UI Unit Test Mirror
├── integration/ui/         # UI Integration Test Mirror
│
└── fixtures/               # Test Fixtures (← Adapted migration)
    └── migration/
```

---

## 13. Statistics Summary

### 13.1 Directory Statistics Snapshot (2026-05-18 Third Round Structure Review)

> Note: The following numbers are current workspace snapshots used for structure review, not intended as long-term manually maintained precise indicators. Should be generated by scripts and synced to this document to avoid expiration as code grows.

| Top-level Directory | Architecture Layer | Current TS/TSX Files | Structure Status | Notes |
|---------------------|-------------------|-------------------|----------|-------|
| `src/platform/` | Layer 1-2 | 1,224 | Authoritative core area | Five planes + contracts/shared/model-gateway/prompt/compliance |
| `src/domains/` | Layer 3 | 96 | Expanded | Contains canonical meta-model, business domain instances and `yono/` |
| `src/interaction/` | Layer 4 | 52 | Expanded | NL, goal, dashboard, autonomy, UX |
| `src/org-governance/` | Layer 5 | 52 | Expanded | org model, approval routing, SSO/SCIM, compliance |
| `src/scale-ecosystem/` | Layer 6 | 148 | Expanded | marketplace, billing, SLA, multi-region, runtime-services |
| `src/ops-maturity/` | Layer 7 | 121 | Expanded | chaos, debugger, capacity, edge, explainability |
| `src/plugins/` | Cross-layer | 25 | Stable | Plugin ecosystem |
| `src/sdk/` | Cross-layer | 104 | Expanded | CLI, SDK, pack/plugin, harness/admin/workbench |
| `src/apps/` | Entry | 4 | Stable | API/console/workers |
| `src/core/` | Legacy Compatibility | 8 | Compatibility layer | Prohibited from new business capabilities |
| `src/testing/` | Test Infrastructure | 1 | Stable | Must not be depended on by production code |
| `src/benchmarks/` | Performance Benchmark | 1 | Stable | Benchmark entry |
| `ui/` | UI Monorepo | 330 | New authoritative area | apps/packages/tools/tests |
| `tests/` | Backend Tests | 6,000+ | Expanded | unit/integration/e2e/golden/performance/invariants/leaks |

> **Five-Plane Submodule Count Notes (2026-05-18 update)**:
> - `five-plane-control-plane/`: approval-center, audit-export, compliance, config-center, cost-alert, iam, incident-control, mission, policy-center, replay-repair-control, risk-control, rollout-controller, tenant + deep threat-model, runbook-executor etc. → Total 44 directories with deep
> - `five-plane-execution/`: budget-allocator, compensation-manager, dispatcher, distributed-lock, execution-engine, ha, hibernation, hot-upgrade, lease, oapeflir, plugin-executor, queue, queue-metrics, recovery, reconciliation-worker, resource, runtime-state-machine, side-effect-manager, startup, state-transition, tool-executor, worker-pool → 17 direct subdirectories
> - `five-plane-interface/`: api, channel-gateway, console, console-backend, ingress, scheduler, webhook etc. → 17 directories with deep
> - `five-plane-orchestration/`: agent-delegation, escalation, evaluator, harness, hitl, improve-rollout, learn, oapeflir, observer, planner, replan, routing etc. → 29 directories with deep
> - `five-plane-state-evidence/`: artifacts, audit, checkpoints, compaction, dlq, events, incident, knowledge, memory, outbox, projections, reconciliation, side-effect-ledger, truth etc. → 20 directories with deep

### 13.2 Comparison with Old System

| Metric | Old System | New Platform | Change |
|--------|------------|--------------|--------|
| Top-level src/ directory count | 4 (core/cli/gateway/plugins) | 12 (platform/domains/interaction/org/scale/ops/plugins/sdk/apps/core/testing/benchmarks) | +8 |
| Frontend project | No independent monorepo | `ui/` Monorepo | New six-platform UI baseline |
| Second-level directory count | 43 (flat under core/) | 100+ (distributed across seven layers, five planes, UI packages) | Significant increase but clearer boundaries |
| Max files in single directory | 101 (core/storage/) | ~40 (split after largest directory) | -60% |
| Max lines in single module | 30,348 (core/runtime/) | ~5,000 (split into 12 BC) | -83% |
| Circular dependency risk | High (42 flat modules) | Low (layered dependencies + contract decoupling) | Significantly improved |

### 13.3 Dependency Direction Rules

```
Layer 7  ops-maturity/     ──→ Can depend on Layer 1-6
Layer 6  scale-ecosystem/  ──→ Can depend on Layer 1-5
Layer 5  org-governance/   ──→ Can depend on Layer 1-4
Layer 4  interaction/      ──→ Can depend on Layer 1-3
Layer 3  domains/          ──→ Can depend on Layer 1-2
Layer 1-2 platform/        ──→ Only depends on platform/contracts/ and platform/shared/
Cross-layer     plugins/sdk/apps/ ──→ Can depend on any layer (through public interface injection)
Frontend     ui/                ──→ Only depends on public API/OpenAPI/schema/codegen/mock seam
Testing     tests/             ──→ Can depend on tested public API; architectural guardian tests can scan source code
```

**Forbidden**: Lower layers depending on upper layers (e.g., platform/ must not import interaction/). Same-layer modules decouple through event bus or platform/contracts/.

### 13.4 Current Structure Risks and Follow-up Items

| Risk | Description | Recommendation |
| ---- | ---- | ------- |
| Manual statistics easily expire | Directory and file count growth is fast, manually maintained tables easily become inaccurate | Use `scripts/ci/audit-codebase-inventory.mjs` or new structure inventory script to generate |
| Dual-entry naming coexistence | `five-plane-*` is authoritative source directory, historical documents still occasionally see interface/control-plane abbreviations | New documents unified to `five-plane-*`, abbreviations only as explanation |
| UI and backend boundary needs continuous guardianship | UI scale is already large, if directly importing backend internal implementations it will break layering | Add contract test forbidding `ui/**` import `src/**` internal paths |
| Mission/Yono will continue expanding | Mission and Yono have entered code structure, but business/governance capabilities will continue growing | When adding new subdirectories, simultaneously update corresponding chapter in this file |
| `src/core/` still exists | Reasonable as compatibility layer, but easily misused | CI guardian prohibits new business code from entering `src/core/` |