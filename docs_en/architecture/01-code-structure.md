# New Platform Code File Structure Design Document

> **Document version**: v1.3
> **Document status**: Active (calibrated after code structure review)
> **Related document**: "Enterprise Agent Platform Overall Technical Architecture Design Document" v2.7 §35 recommended code directory
> **Related document**: "Legacy System → New Platform Migration Evaluation Document" v1.1
> **Design date**: 2026-04-19
> **Last revision**: 2026-05-26 (sync P1 public interfaces, federation governance persistence, event reliability, and Electron/UI contract fixes)

---

## 1. Document Purpose

This document defines the **complete code file structure** of the new platform, answering three questions:

1. How is the new platform's `src/` directory organized? What does each directory contain?
2. Which directory in the new platform should the legacy system (`src/core/` 42 modules) code be moved to?
3. Where do newly created modules, Mission/Yono, cross-platform UI, and dedicated tests for the new platform live?

### 1.1 Code Structure Review Conclusions (2026-05-18)

This review is based on actual measurements of the current workspace directory, focusing on the consistency between `src/`, `ui/`, `tests/`, `config/`, `deploy/`, `scripts/` and this document. Conclusions are as follows:

| Conclusion Item | Current Code Fact | Document Treatment |
| ------ | ------------ | -------- |
| Backend seven-layer trunk | `src/platform`, `domains`, `interaction`, `org-governance`, `scale-ecosystem`, `ops-maturity` all exist and are authoritative implementation locations | Maintain the seven-layer structure, update statistics and add new directory descriptions |
| Five-plane implementation | The five `five-plane-*` directories are complete, with new subdomains such as mission, outbox, side-effect-ledger, reconciliation, degradation added | Complete new subdomains in the platform description |
| Legacy core | `src/core` is left only as a runtime compatibility entry point and should not host new capabilities | Retain the compatibility layer positioning, continue to prohibit new business capabilities from entering core |
| Mission | `src/platform/contracts/mission` and `src/platform/five-plane-control-plane/mission` have become long-term goal governance entry points | Add Mission directory responsibilities and dependency rules |
| Yono Business | `src/domains/yono` exists as a business domain instance | Mark as a business domain instance in the domains section, not classified as domain framework infrastructure |
| Cross-platform UI | The `ui/` Monorepo exists, containing apps, packages, tools, tests | Add a top-level UI directory section and dependency boundaries |
| Test structure | `tests/unit`, `integration`, `e2e`, `golden`, `performance`, `invariants`, `leaks` etc. all exist | Update test directory descriptions, complete invariants/leaks |
| Runtime config and deployment | `config/`, `deploy/` already cover environments, domains, risk, security, Helm, Terraform, Prometheus, Chaos, runbooks | Complete in top-level overview and ops directory descriptions |
| Documentation risk | Many statistics may still quickly become outdated as the code evolves | Change statistics table to "structure snapshot", require subsequent script generation |

### 1.2 Recent Structure Sync (2026-05-26)

This round did not change the seven-layer main skeleton, but the most recent batch of code integration has affected the formal interpretation of "how the structure should be understood":

| Sync Topic | Current Code Fact | Document Convention |
| ------ | ------------ | -------- |
| P1 public query interfaces | `dashboard-routes.ts` has completed `/v1/workers`, `/v1/queues`, `/v1/agents`, `/v1/dashboard/metrics`, `/v1/explanations`, `/v1/meta/contract-version` | UI/HTTP public queries default to reading Layer C `/v1/*`, no longer treating `/admin/*` as public data plane |
| P1 Pack / Knowledge / Builder public interfaces | `pack-routes.ts`, `plane-routes.ts`, `task-routes.ts` have completed `/v1/marketplace`, `/v1/knowledge`, `/v1/packs/:packId/versions`, `/v1/workflows/builder` | `platform/five-plane-interface/api/http-server/` is the authoritative public export surface |
| Federation governance persistence | `federation-audit.ts`, `trust-relationship.ts` under `scale-ecosystem/federation/` already have persistence/recovery/archive/policy enforce capabilities | Federation is no longer "pure specification commitment" but a runtime capability already persisted to storage |
| Event reliability | `durable-event-bus-async.ts` has fixed async failure swallowing errors | P5 event main chain continues to prioritize reliable delivery and failure visibility |
| Electron platform bridge | `ui/apps/electron-win/src/preload.ts` and `ui/packages/shared/platform/` have unified the bridge compatibility layer | The desktop shell layer in `ui/` has a formal bridge compatibility contract, not just a smoke shell |

---

## 2. Design Principles

| # | Principle | Description |
|---|------|------|
| 1 | **Architecture-driven directories** | Top-level directories are organized by seven-layer architecture + five planes, not by technical concerns (controller/service/repository) |
| 2 | **Bounded context equals directory** | Each bounded context corresponds to a second-level directory, with self-contained model/service/repository/types inside |
| 3 | **Centralized contracts** | Inter-plane communication contracts are centralized in `platform/contracts/`, not scattered across plane directories |
| 4 | **Domain instance and framework separation** | `domains/` is divided into "framework infrastructure" and "domain instances"; adding a new business domain only requires adding a domain instance directory |
| 5 | **Tests mirror source code** | The `tests/` directory structure mirrors `src/`, with one-to-one path correspondence |
| 6 | **kebab-case file naming** | File names are all kebab-case, class/type names PascalCase, function names camelCase |
| 7 | **One index.ts per directory** | Each second-level directory provides `index.ts` as the public API export; third-level directories are internal implementation details |
| 8 | **Zero circular dependencies** | Only upper layers can depend on lower layers (Layer N can depend on Layer N-1); same-layer decoupling is via contracts or events |

---

## 3. Top-level Directory Overview

> **Current implementation note (2026-05-14)**: In the new platform, `src/core/` is only retained as a Legacy compatibility and migration re-export layer. New runtime, contract, execution, state, and governance capabilities take `src/platform/*`, `src/domains/*`, `src/interaction/*`, `src/org-governance/*`, `src/scale-ecosystem/*`, `src/ops-maturity/*` as the authoritative implementation locations. New code must no longer treat `src/core/` as a new capability entry point.

```
new-platform/
├── src/
│   ├── platform/           # Layer 1-2: Infrastructure layer + AI operations layer (five planes + cross-cutting)
│   ├── domains/            # Layer 3: Business domain access layer
│   ├── interaction/        # Layer 4: Intelligent interaction layer
│   ├── org-governance/     # Layer 5: Organizational governance layer
│   ├── scale-ecosystem/    # Layer 6: Scalable runtime layer + ecosystem layer
│   ├── ops-maturity/       # Layer 7: Operations maturity layer
│   ├── plugins/            # Cross-layer: Plugin ecosystem
│   ├── sdk/                # Cross-layer: SDK and developer experience
│   ├── apps/               # Application entries (API server / Console / Workers)
│   ├── testing/            # Test infrastructure and shared test contracts
│   ├── benchmarks/         # Benchmark entry points and performance samples
│   ├── core/               # Legacy compatibility re-export layer, no new business capabilities allowed
│   └── index.ts            # Platform entry point
├── ui/                     # Cross-platform UI Monorepo (Web / Electron / Tauri / Mobile)
├── tests/                  # Tests (mirroring src/ structure)
├── config/                 # Versioned configuration
├── divisions/              # Division definitions (adapted to DomainDescriptor after migration)
├── docs_zh/                # Chinese documentation
├── docs_en/                # English documentation
├── scripts/                # CI/build scripts
├── deploy/                 # Deployment manifests
└── [top-level config files] # package.json / tsconfig.json / eslint.config.js / Dockerfile / ...
```

### 3.0.1 Top-level Directory Responsibility Boundaries (Current Authoritative)

| Top-level Directory | Code Fact | Responsibility Boundary | Prohibitions |
| -------- | -------- | -------- | -------- |
| `src/platform/` | Backend platform core, currently the largest code area | Five planes, contracts, shared infrastructure, model gateway, Prompt/Eval, compliance, stability | Must not depend on `interaction/`, `domains/` business instances, or UI |
| `src/domains/` | Domain framework + domain instances | Domain descriptors, risk/eval/workflow/tool configurations, Yono and other business domains | Must not host platform runtime, HTTP API, or worker implementations |
| `src/interaction/` | Intelligent interaction layer | NL gateway, goal decomposer, dashboard, proactive, UX/autonomy | Must not bypass platform contracts to write directly to truth store |
| `src/org-governance/` | Organizational governance layer | Org model, approval routing, SSO/SCIM, compliance boundaries, delegated governance | Must not host generic IAM infrastructure; base IAM belongs to control-plane |
| `src/scale-ecosystem/` | Scalability and ecosystem layer | Marketplace, billing, SLA, multi-region, feedback, runtime-services | Must not replace P4/P5 fact-writing links |
| `src/ops-maturity/` | Operations maturity layer | Chaos, debugger, capacity, compliance report, edge, explainability | Must not become the sole dependency of the main execution chain |
| `src/plugins/` | Plugin ecosystem | Plugin manifest, runtime adaptation, marketplace access | Must not bypass sandbox and capability |
| `src/sdk/` | Developer experience | CLI, SDK, pack/plugin tooling | Must not import internal non-public APIs |
| `src/apps/` | Backend application entries | API, console backend, workers bootstrap | Must not accumulate business logic; only composition and startup |
| `src/testing/` | Test common facilities | Test helpers, fixtures, invariant support | Must not be depended on by production code |
| `src/benchmarks/` | Performance sample entries | Performance/capacity benchmark auxiliary code | Must not enter the runtime main chain |
| `ui/` | Frontend monorepo | Web/desktop/mobile UI, shared frontend SDK, feature packages, UI tests | Must not directly import backend `src/*` internal implementations |
| `tests/` | Backend tests | unit/integration/e2e/golden/performance/invariants/leaks | Must not depend on real production credentials |
| `config/` | Versioned configuration | environments, domains, risk, security, runtime, providers | Must not contain secrets in plaintext |
| `deploy/` | Deployment and ops assets | Helm, Terraform, Prometheus, Grafana, Chaos, runbooks, scripts | Must not be a source of business logic |

### 3.1 Legacy System vs New Platform Top-level Comparison

| Legacy System | New Platform | Change Description |
|--------|--------|---------|
| `src/core/` (42 flat modules) | `src/platform/` + `src/domains/` + `src/interaction/` + `src/org-governance/` + `src/scale-ecosystem/` + `src/ops-maturity/` | Flat core/ split into 6 top-level directories organized by seven-layer architecture |
| `src/cli/` (78 scripts) | `src/sdk/cli/` | CLI consolidated into SDK layer |
| `src/gateway/` (13 files) | `src/platform/five-plane-interface/` + `src/interaction/nl-gateway/` | API gateway consolidated into P1 Interface, NL gateway into Layer 4 |
| No independent frontend project | `ui/` | New cross-platform UI Monorepo, hosting Web/desktop/mobile |
| No dedicated test infrastructure | `src/testing/` + `tests/invariants/` + `tests/leaks/` | New test infrastructure, invariants, and leak tests |
| No benchmark entry | `src/benchmarks/` + `tests/performance/` | New performance/capacity benchmark entries |
| `src/plugins/` (20 files) | `src/plugins/` | Maintained independently, structure unchanged |
| `src/index.ts` | `src/index.ts` | Maintained |

### 3.2 Legacy System 42 Modules → New Platform Directory Mapping Quick Reference

| Legacy Module | New Directory | Architecture Layer |
|--------|--------|--------|
| `core/types/` | `platform/contracts/types/` | Cross-layer contract |
| `core/errors.ts` | `platform/contracts/errors.ts` | Cross-layer contract |
| `core/constants/` | `platform/contracts/constants/` | Cross-layer contract |
| `core/results/` | `platform/contracts/result-envelope/` | Cross-layer contract |
| `core/utils/` | `platform/shared/utils/` | Cross-layer shared |
| `core/lifecycle/` | `platform/shared/lifecycle/` | Cross-layer shared |
| `core/config/` | `platform/five-plane-control-plane/config-center/` | P2 Control Plane |
| `core/storage/` | `platform/five-plane-state-evidence/truth/` | P5 State and Evidence |
| `core/events/` | `platform/five-plane-state-evidence/events/` | P5 State and Evidence |
| `core/locking/` | `platform/five-plane-execution/distributed-lock/` | P4 Execution Plane |
| `core/queue/` | `platform/five-plane-execution/queue/` | P4 Execution Plane |
| `core/cache/` | `platform/shared/cache/` | Cross-layer shared |
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
| `core/artifacts/` | `platform/five-plane-state-evidence/artifacts/` | P5 State and Evidence |
| `core/feedback/` | `scale-ecosystem/feedback-loop/` | Layer 6 |
| `core/learning/` | `platform/five-plane-orchestration/oapeflir/learn/` | P3 Orchestration Plane |
| `core/evaluation/` | `platform/prompt-engine/eval/` | AI Operations |
| `core/memory/` | `platform/five-plane-state-evidence/memory/` | P5 State and Evidence |
| `core/knowledge/` | `platform/five-plane-state-evidence/knowledge/` | P5 State and Evidence |
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
| `core/observability/` | `platform/shared/observability/` | Cross-layer shared |
| `core/ops/` | `platform/five-plane-control-plane/incident-control/` | P2 Control Plane |
| `core/stability/` | `platform/shared/stability/` | Cross-layer shared |
| `core/evolution/` | `ops-maturity/drift-detection/` | Layer 7 |
| `core/reliability/` | `platform/five-plane-execution/recovery/` | P4 Execution Plane |
| `core/product/` | `scale-ecosystem/marketplace/` | Layer 6 |
| `gateway/` | `platform/five-plane-interface/` (split) | P1 Interface Plane |
| `plugins/` | `plugins/` | Cross-layer |
| `cli/` | `sdk/cli/` | Cross-layer SDK |

---

## 4. platform/ — Infrastructure Layer + AI Operations Layer

`platform/` corresponds to architecture Layer 1 (infrastructure) and Layer 2 (AI operations), including the five planes + cross-cutting concerns.

> **Five-plane naming convention**: In actual code, the five planes correspond to `five-plane-interface/`, `five-plane-control-plane/`, `five-plane-orchestration/`, `five-plane-execution/`, `five-plane-state-evidence/` — five directories with the `five-plane-` prefix — equivalent to the abbreviations `interface/`, `control-plane/` etc. in the documentation. Both naming styles are valid entries; no ambiguity exists in source code and configuration.

**Supplementary note (revised 2026-05-18)**: The following independent modules also belong to platform/ but not to any of the five planes: `agent-delegation/`, `architecture/`, `compliance/`, `contracts/`, `cost-management/`, `model-gateway/`, `ops-maturity/`, `prompt-engine/`, `prompt-registry/`, `remote-coordination/`, `shared/`, `stability/`, `structure/`. Among these, `contracts/` and `shared/` are the legitimate landing points for inter-plane dependencies.

**Mission structure note (2026-05-18)**: Mission is the root object for long-term goals and governance contexts. Contracts are located in `platform/contracts/mission/`, while lifecycle, resolution, governance, budget, handoff, and other control capabilities are in `platform/five-plane-control-plane/mission/`. The execution plane can only consume missionRef / missionSnapshotRef and must not treat Mission as an executable object.

```
src/platform/
├── five-plane-interface/              # P1 Interface Plane — §6 API Contract
│   ├── api/                #   HTTP API server + OIDC/OAuth + WebSocket
│   │   ├── http-api-server.ts
│   │   ├── api-auth-service.ts
│   │   ├── oidc-oauth-service.ts
│   │   ├── openapi-document.ts
│   │   ├── mission-control-service.ts
│   │   ├── task-websocket-status-relay.ts
│   │   └── index.ts
│   ├── webhook/            #   Webhook inbound handling
│   │   └── index.ts
│   ├── channel-gateway/    #   Channel gateway (Telegram/Slack/Webhook/SSE)
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
│   ├── scheduler/          #   Scheduled dispatch entry (§41 Proactive Agent trigger)
│   │   └── index.ts
│   ├── console-backend/    #   Console UI backend (§43 Dashboard/§44 UX)
│   │   └── index.ts
│   └── ingress/            #   Ingress traffic governance (rate limiting/routing/gray)
│       └── index.ts
│
├── five-plane-control-plane/          # P2 Control Plane — §24 Config / §11 Security / §21 Approval
│   ├── tenant/             #   Tenant management
│   │   └── index.ts
│   ├── mission/            #   Mission long-term goal governance (lifecycle/resolution/budget/LiveGuard/Handoff)
│   │   ├── mission-lifecycle-service.ts
│   │   ├── mission-resolver.ts
│   │   ├── mission-governance-service.ts
│   │   ├── mission-budget-service.ts
│   │   ├── mission-live-guard.ts
│   │   └── index.ts
│   ├── iam/                #   Identity and access management (← core/security/)
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
│   ├── policy-center/      #   Policy center (risk level/security policy/compliance policy centralized management)
│   │   └── index.ts
│   ├── approval-center/    #   Approval center (← core/approvals/)
│   │   ├── approval-service.ts
│   │   ├── approval-timeout-executor.ts
│   │   └── index.ts
│   ├── rollout-controller/  #   Rollout controller (← core/deployment/)
│   │   ├── traffic-routing-service.ts
│   │   └── index.ts
│   ├── incident-control/    #   Incident/ops control (← core/ops/)
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
│   ├── replay-repair-control/ #  Replay/repair control
│   │   └── index.ts
│   ├── config-center/       #   Configuration governance center (← core/config/)
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
│   └── audit-export/        #   Audit export (← core/compliance/)
│       ├── audit-export-service.ts
│       └── index.ts
│
├── five-plane-orchestration/          # P3 Orchestration Plane — §13 OAPEFLIR
│   ├── oapeflir/           #   OAPEFLIR controlled cognitive core (← core/agent-loop/ + core/workflow/)
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
│   │   ├── workflow/       #     Workflow submodule (← core/workflow/)
│   │   │   ├── minimal-workflow.ts
│   │   │   ├── workflow-validator.ts
│   │   │   ├── workflow-step-retry-policy.ts
│   │   │   ├── output-schema.ts
│   │   │   └── index.ts
│   │   ├── learn/          #     Learn stage (← core/learning/)
│   │   │   ├── strategy-learning-service.ts
│   │   │   ├── experience-distillation-service.ts
│   │   │   ├── failure-pattern-miner.ts
│   │   │   ├── knowledge-promotion-service.ts
│   │   │   ├── learning-object-model.ts
│   │   │   ├── learning-object-validator.ts
│   │   │   ├── learning-artifact-model.ts
│   │   │   └── index.ts
│   │   ├── improve-rollout/ #    Improve/Rollout stage (← core/improvement/)
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
│   ├── planner/            #   Planning engine (← core/planning/)
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
│   ├── routing/            #   Routing and orchestration (← core/orchestration/)
│   │   ├── intake-router.ts
│   │   ├── workflow-planner.ts
│   │   ├── agent-team-service.ts
│   │   └── index.ts
│   ├── escalation/         #   Escalation handling
│   │   └── index.ts
│   └── hitl/               #   Human-in-the-loop (← runtime/HITL BC)
│       ├── hitl-explainability-service.ts
│       └── index.ts
│
├── five-plane-execution/              # P4 Execution Plane — §14 Runtime
│   ├── dispatcher/         #   Execution dispatch (← runtime/BC1 Dispatch)
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
│   ├── lease/              #   Lease management (← runtime/BC2 Lease)
│   │   ├── execution-lease-service.ts
│   │   ├── lease-repository.ts
│   │   ├── lease-repository-sqlite.ts
│   │   ├── lease-repository-postgres.ts
│   │   └── index.ts
│   ├── worker-pool/        #   Worker management (← runtime/BC3 Worker)
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
│   ├── execution-engine/   #   Agent execution engine (← runtime/BC9)
│   │   ├── agent-executor.ts
│   │   ├── runtime-factory.ts
│   │   ├── runtime-context.ts
│   │   ├── single-task-execution.ts
│   │   ├── single-task-happy-path.ts
│   │   ├── multi-step-agent-round-loop.ts
│   │   ├── multi-step-supervisor.ts
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
│   ├── state-transition/   #   State machine (← runtime/BC8)
│   │   ├── state-transition-machine.ts
│   │   ├── transition-service.ts
│   │   └── index.ts
│   ├── ha/                 #   High availability coordination (← runtime/BC5 HA)
│   │   ├── ha-coordinator-service.ts
│   │   ├── ha-repository.ts
│   │   ├── ha-repository-sqlite.ts
│   │   ├── ha-repository-postgres.ts
│   │   ├── coordinator-load-balancing-service.ts
│   │   ├── control-plane-load-balancing-schema.ts
│   │   ├── cross-region-deployment-service.ts
│   │   └── index.ts
│   ├── hot-upgrade/        #   Hot upgrade (← runtime/BC6)
│   │   ├── hot-upgrade-service.ts
│   │   ├── hot-upgrade-service-async.ts
│   │   ├── hot-upgrade-factory.ts
│   │   ├── hot-upgrade-repository.ts
│   │   ├── hot-upgrade-repository-sqlite.ts
│   │   ├── hot-upgrade-repository-postgres.ts
│   │   └── index.ts
│   ├── recovery/           #   Recovery and repair (← runtime/BC7 + core/reliability/)
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
│   ├── tool-executor/      #   Tool executor (← core/tools/)
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
│   ├── plugin-executor/    #   Plugin executor (runtime sandbox)
│   │   └── index.ts
│   ├── distributed-lock/   #   Distributed lock (← core/locking/)
│   │   ├── distributed-lock-service.ts
│   │   ├── distributed-lock-factory.ts
│   │   ├── distributed-lock-types.ts
│   │   ├── locking-support.ts
│   │   ├── sqlite-lock-adapter.ts
│   │   ├── pg-advisory-lock-adapter.ts
│   │   ├── redis-lock-adapter.ts
│   │   └── index.ts
│   ├── queue/              #   Message queue (← core/queue/)
│   │   ├── queue-adapter.ts
│   │   ├── queue-adapter-types.ts
│   │   ├── queue-adapter-factory.ts
│   │   ├── sqlite-queue-adapter.ts
│   │   ├── redis-queue-adapter.ts
│   │   └── index.ts
│   ├── resource/           #   Resource tracking (← core/resource/)
│   │   ├── process-tracker.ts
│   │   └── index.ts
│   ├── hibernation/        #   Long-running workflow hibernation/wakeup
│   ├── queue-metrics/      #   Queue metrics and backlog observation
│   ├── oapeflir/           #   Execution-side OAPEFLIR bridge / run record
│   └── startup/            #   Startup and preflight
│       ├── startup-preflight.ts
│       ├── startup-consistency-checker.ts
│       ├── graceful-shutdown.ts
│       └── index.ts
│
├── five-plane-state-evidence/         # P5 State and Evidence Plane — §25-§29
│   ├── truth/              #   Authoritative data storage (← core/storage/ after split)
│   │   ├── sqlite-database.ts
│   │   ├── async-sql-database.ts
│   │   ├── authoritative-sql-database.ts
│   │   ├── storage-backend-factory.ts
│   │   ├── storage-backend-config.ts
│   │   ├── storage-quota-service.ts
│   │   ├── session-dual-storage.ts
│   │   ├── runtime-truth-repository.ts
│   │   ├── migration-runner.ts
│   │   ├── async-repository-registry.ts
│   │   ├── async-query-helper.ts
│   │   ├── repositories/   #     Repositories split by bounded context (§9 split product)
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
│   ├── events/             #   Event bus (← core/events/)
│   │   ├── typed-event-bus.ts
│   │   ├── typed-event-publisher.ts
│   │   ├── typed-event-payloads.ts
│   │   ├── event-types.ts
│   │   ├── event-registry.ts
│   │   ├── event-ops-service.ts
│   │   ├── durable-event-bus.ts
│   │   ├── durable-event-bus-async.ts
│   │   └── index.ts
│   ├── projections/        #   Projection views
│   │   └── index.ts
│   ├── outbox/             #   Reliable publish Outbox
│   ├── side-effect-ledger/ #   External side-effect ledger
│   ├── reconciliation/     #   State/projection/external write reconciliation
│   ├── compaction/         #   Historical event/context compaction
│   ├── artifacts/          #   Artifact management (← core/artifacts/)
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
│   ├── memory/             #   Memory management (← core/memory/)
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
│   ├── knowledge/          #   Knowledge plane (← core/knowledge/)
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
│   ├── audit/              #   Audit log
│   │   └── index.ts
│   ├── incident/           #   Incident records
│   │   └── index.ts
│   ├── checkpoints/        #   Checkpoints
│   │   ├── workflow-step-checkpoint.ts
│   │   └── index.ts
│   └── dlq/                #   Dead letter queue
│       └── index.ts
│
├── model-gateway/          # AI Operations: LLM abstraction layer — §15
│   ├── provider-registry/  #   Provider registration and management (← core/providers/)
│   │   ├── base-chat-provider.ts
│   │   ├── unified-chat-provider.ts
│   │   ├── circuit-breaker.ts
│   │   ├── model-routing-service.ts
│   │   ├── provider-credential-pool.ts
│   │   ├── provider-credential-pool-support.ts
│   │   └── index.ts
│   ├── router/             #   Model routing (cost/latency/capability multi-dimensional)
│   │   └── index.ts
│   ├── cache/              #   KV Cache / Prompt Cache
│   │   └── index.ts
│   ├── cost-tracker/       #   Token metering and cost tracking (← core/cost/)
│   │   ├── budget-guard.ts
│   │   └── index.ts
│   ├── fallback/           #   Provider failover
│   │   └── index.ts
│   ├── degradation/        #   Model/Provider degradation strategy
│   └── messages/           #   Message models (← core/messages/)
│       ├── token-estimator.ts
│       ├── message-parts.ts
│       └── index.ts
│
├── prompt-engine/          # AI Operations: Prompt management — §16-§17
│   ├── registry/           #   Prompt version registry
│   │   └── index.ts
│   ├── renderer/           #   Prompt rendering
│   │   └── index.ts
│   ├── rollout/            #   Prompt gray release
│   │   └── index.ts
│   └── eval/               #   Model evaluation (← core/evaluation/)
│       ├── llm-eval-service.ts
│       ├── execution-outcome-evaluator.ts
│       ├── post-execution-quality-gate.ts
│       ├── prompt-model-policy-governance-service.ts
│       ├── prompt-model-policy-governance-schema.ts
│       └── index.ts
│
├── compliance/             # AI Operations: Compliance and data governance — §23
│   ├── erasure/            #   Data erasure (crypto-shredding)
│   │   └── index.ts
│   ├── encryption/         #   Field-level encryption
│   │   └── index.ts
│   ├── data-residency/     #   Data residency (cross-border compliance)
│   │   └── index.ts
│   └── lineage/            #   Data lineage
│       └── index.ts
│
├── contracts/              # Cross-plane contracts — §5
│   ├── types/              #   Domain types (← core/types/)
│   │   ├── domain.ts
│   │   ├── ids.ts
│   │   ├── status.ts
│   │   └── index.ts
│   ├── errors.ts           #   Error system (← core/errors.ts)
│   ├── constants/          #   Global constants (← core/constants/)
│   │   ├── time.ts
│   │   └── index.ts
│   ├── result-envelope/    #   Result pattern (← core/results/)
│   │   ├── result-envelope.ts
│   │   └── index.ts
│   ├── request-envelope/   #   Request envelope (§5.3)
│   │   └── index.ts
│   ├── control-directive/  #   Control directives (§5.4)
│   │   └── index.ts
│   ├── execution-plan/     #   Execution plan (§5.5)
│   │   └── index.ts
│   ├── execution-receipt/  #   Execution receipt (§5.6)
│   │   └── index.ts
│   ├── mission/            #   Mission contracts (record/membership/snapshot/budget/error/event)
│   │   └── index.ts
│   ├── evidence-record/    #   Evidence record contracts
│   │   └── index.ts
│   ├── executable-contracts/ # Executable contracts and PlanGraph binding
│   │   └── index.ts
│   ├── projection-update/  #   Projection update contracts
│   │   └── index.ts
│   ├── prompt-bundle/      #   Prompt bundle contracts
│   │   └── index.ts
│   ├── state-command/      #   State commands (§5.7)
│   │   └── index.ts
│   ├── delegation-request/ #   Delegation requests (§19)
│   │   └── index.ts
│   └── model-request/      #   Model requests (§15)
│       └── index.ts
│
└── shared/                 # Cross-plane shared infrastructure
    ├── utils/              #   Utilities (← core/utils/)
    │   ├── bounded-cache.ts
    │   └── index.ts
    ├── lifecycle/          #   Service lifecycle (← core/lifecycle/)
    │   ├── service-registry.ts
    │   ├── evolution-mvp-service.ts
    │   └── index.ts
    ├── cache/              #   Multi-level cache (← core/cache/)
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
    └── stability/          #   Stability rehearsal (← core/stability/)
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

| Subdirectory | Architecture Positioning | Current TS File Count | Description |
|--------|---------|---------------|------|
| `five-plane-interface/` | P1 Interface Plane | 90 | API, channel gateway, console, scheduler, webhook |
| `five-plane-control-plane/` | P2 Control Plane | 140 | IAM, approval, config, incident, mission, risk, rollout |
| `five-plane-orchestration/` | P3 Orchestration Plane | 188 | Harness, OAPEFLIR, planner, routing, HITL, learn, rollout |
| `five-plane-execution/` | P4 Execution Plane | 230 | dispatcher, lease, worker, engine, queue, tool, recovery |
| `five-plane-state-evidence/` | P5 State and Evidence | 250 | truth, events, outbox, dlq, memory, knowledge, audit, ledger |
| `shared/` | Cross-plane shared | 130 | cache, observability, events, lifecycle, stability, context |
| `contracts/` | Cross-plane contracts | 60 | request, plan, state, mission, evidence, prompt, projection |
| `model-gateway/` | AI Operations | 28 | provider, router, fallback, degradation, cost, messages |
| `prompt-engine/` | AI Operations | 26 | registry, renderer, rollout, eval |
| `compliance/` | AI Operations | 12 | erasure, encryption, data residency, lineage |
| `stability/` | Stability/Reliability | 48 | reliability and stability drill supplements |
| Other platform independent modules | Cross-cutting/auxiliary | 22 | architecture, agent-delegation, remote-coordination, structure, etc. |
| **Total** | | **1,224** | Current `src/platform/**/*.ts` snapshot |

---

## 5. domains/ — Business Domain Access Layer

`domains/` corresponds to architecture Layer 3 (§37-§38), divided into "domain framework infrastructure" and "domain instances" two layers.

> **Actual domain instance count (revised 2026-05-18)**: `src/domains/` currently contains domain framework infrastructure, domain public services, and 30+ vertical domain instances. Framework infrastructure includes `registry`, `risk-profile`, `knowledge-schema`, `eval-framework`, `prompt-library`, `recipes`, `interaction-policy`, `governance`, `business-pack`, `canonical-meta-model`; vertical domain instances include `academic-research`, `advertising`, `agriculture`, `coding`, `financial-services`, `finance-accounting`, `healthcare`, `legal`, `quant-trading`, `yono`, etc. `yono` is the Yono Business business domain instance and must not be classified as framework infrastructure.

```
src/domains/
├── registry/               # Domain registry (← core/domain-registry/)
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
├── risk-profile/           # Domain risk profile (NEW §37)
│   └── index.ts
├── knowledge-schema/       # Domain knowledge structure (NEW §37)
│   └── index.ts
├── eval-framework/         # Domain evaluation framework (NEW §37)
│   └── index.ts
├── prompt-library/         # Domain prompt library (NEW §37)
│   └── index.ts
├── recipes/                # DomainRecipe prototype templates (NEW §38)
│   └── index.ts
├── interaction-policy/     # Cross-domain interaction policy (NEW §37)
│   └── index.ts
├── governance/             # Domain governance (← core/divisions/)
│   ├── division-loader.ts
│   ├── division-loader-support.ts
│   ├── safe-load-division-registry.ts
│   ├── hr-role-governance-service.ts
│   └── index.ts
├── business-pack/          # Business pack domain framework
│   └── index.ts
├── canonical-meta-model/   # Canonical meta model
│   └── index.ts
├── coding/                 # Code R&D domain instance
│   └── index.ts
├── operations/             # Operations domain instance
│   └── index.ts
├── yono/                   # Yono Business domain instance
│   └── index.ts
├── [30+ vertical domain instances] # academic-research, advertising, agriculture, content-moderation, creative-production, customer-service, data-engineering, ecommerce, education, executive-assistant, facilities, finance-accounting, financial-services, game-dev, game-publishing, healthcare, human-resources, industry-research, it-operations, knowledge-base, legal, live-streaming, manufacturing, marketing, product-management, project-management, quality-assurance, quant-trading, supply-chain, user-operations, etc.
└── [framework and public services] # domain-baseline-catalog.ts, domain-baseline-seeds.ts, domain-descriptor-orchestration-service.ts, domain-eval-framework-service.ts, domain-knowledge-schema-service.ts, domain-module-helper.ts, domain-recipe-service.ts, domain-risk-profile-service.ts, domain-specs.ts, domain-task-design-service.ts, domains-bootstrap.ts
```

---

## 6. interaction/ — Intelligent Interaction Layer

`interaction/` corresponds to architecture Layer 4 (§39-§44), all are **newly created modules** (legacy system is completely missing).

> **Actual submodules (revised 2026-05-18)**: Section 6 of the documentation records 6 subdirectories, while actual code contains 13 subdirectories with deep levels (autonomy, dashboard, goal-decomposer, nl-gateway, proactive-agent, ux each have deep submodules), all reflected in the tree diagram below and the statistics table in section 13.

```
src/interaction/
├── nl-gateway/             # Natural language task entry (NEW §39)
│   ├── intent-parser/      #   Intent parsing
│   │   └── index.ts
│   ├── slot-resolver/      #   Slot extraction
│   │   └── index.ts
│   ├── ambiguity-handler/  #   Ambiguity handling and clarification dialog
│   │   └── index.ts
│   └── index.ts
├── goal-decomposer/        # Goal decomposition engine (NEW §40)
│   ├── planner/            #   Decomposition strategy (template/LLM/hybrid/manual assistance)
│   │   └── index.ts
│   ├── dependency-graph/   #   Task dependency DAG
│   │   └── index.ts
│   ├── validator/          #   Decomposition result validation
│   │   └── index.ts
│   └── index.ts
├── proactive-agent/        # Proactive Agent framework (NEW §41)
│   ├── trigger-engine/     #   Trigger engine (cron/event/threshold)
│   │   └── index.ts
│   ├── schedule-manager/   #   Scheduled dispatch management
│   │   └── index.ts
│   ├── event-watcher/      #   Event-driven wakeup
│   │   └── index.ts
│   └── index.ts
├── autonomy/               # Progressive autonomy model (NEW §42)
│   ├── trust-scorer/       #   Trust scoring
│   │   └── index.ts
│   ├── level-manager/      #   Autonomy level state machine
│   │   └── index.ts
│   ├── promotion-engine/   #   Promotion/demotion rule engine
│   │   └── index.ts
│   └── index.ts
├── dashboard/              # Unified operations dashboard (NEW §43)
│   ├── metric-aggregator/  #   Metric aggregation
│   │   └── index.ts
│   ├── health-scorer/      #   Health scoring
│   │   └── index.ts
│   ├── alert-router/       #   Alert routing
│   │   └── index.ts
│   └── index.ts
└── ux/                     # Non-technical user experience (NEW §44)
    ├── wizard/             #   Visual domain access wizard
    │   └── index.ts
    ├── template-engine/    #   Visual workflow builder
    │   └── index.ts
    ├── onboarding/         #   Guided first-time user experience
    │   └── index.ts
    └── index.ts
```

---

## 7. org-governance/ — Organizational Governance Layer

`org-governance/` corresponds to architecture Layer 5 (§46-§51). Apart from `org-model/` which has a small amount of code migrated from `core/hr/`, the rest are **newly created modules**.

> **Actual submodules (revised 2026-05-18)**: Section 7 of the documentation records 7 subdirectories, while actual code contains 24 subdirectories with deep levels (approval-routing, compliance-engine, delegated-governance, knowledge-boundary, org-model, org-routing, sso-scim each have deep submodules), all reflected in the tree diagram below and the statistics table in section 13.

```
src/org-governance/
├── org-model/              # Organization hierarchy model (NEW §46, ← core/hr/ partial migration)
│   ├── hierarchy/          #   Organization tree (company/division/department/team)
│   │   └── index.ts
│   ├── org-node/           #   OrgNode CRUD + hierarchy inheritance
│   │   └── index.ts
│   ├── sync/               #   Organization change sync (SCIM/HR API/manual)
│   │   └── index.ts
│   ├── hr-role-governance-service.ts  # ← core/hr/
│   └── index.ts
├── approval-routing/       # Organization-chart approval routing (NEW §47)
│   ├── route-engine/       #   Dynamic routing engine (org-chart/amount-based/SoD)
│   │   └── index.ts
│   ├── escalation/         #   Approval escalation
│   │   └── index.ts
│   ├── delegation/         #   Approval delegation (leave proxy)
│   │   └── index.ts
│   └── index.ts
├── sso-scim/               # SSO/SCIM integration (NEW §48)
│   ├── saml/               #   SAML SSO
│   │   └── index.ts
│   ├── oidc/               #   OIDC SSO
│   │   └── index.ts
│   ├── scim-sync/          #   SCIM user/group sync
│   │   └── index.ts
│   └── index.ts
├── compliance-engine/      # Department-specific compliance policy engine (NEW §49)
│   ├── policy-resolver/    #   Policy resolution (inheritance + override)
│   │   └── index.ts
│   ├── inheritance/        #   Policy inheritance rules (child can only tighten, not relax)
│   │   └── index.ts
│   ├── audit-enforcer/     #   Compliance audit enforcement
│   │   └── index.ts
│   └── index.ts
├── knowledge-boundary/     # Knowledge domain isolation and controlled sharing (NEW §50)
│   ├── boundary-manager/   #   Boundary definition (strict/controlled/open)
│   │   └── index.ts
│   ├── sharing-gate/       #   Cross-domain sharing gateway
│   │   └── index.ts
│   ├── access-log/         #   Access audit log
│   │   └── index.ts
│   └── index.ts
└── delegated-governance/   # Hierarchical governance delegation (NEW §51)
    ├── scope-manager/      #   Delegation scope management
    │   └── index.ts
    ├── delegation-registry/ #  Delegation registry
    │   └── index.ts
    └── index.ts
```

---

## 8. scale-ecosystem/ — Scalable Runtime Layer + Ecosystem Layer

`scale-ecosystem/` corresponds to architecture Layer 6 (§52-§57). `feedback-loop/` migrated from `core/feedback/`, `marketplace/` partially migrated from `core/product/`, the rest are **newly created modules**.

> **Actual submodules (revised 2026-05-18)**: Section 8 of the documentation records 6 top-level subdirectories, while actual code contains 46 subdirectories with deep levels (billing, capacity-planning, cost-attribution, enterprise, federation, feedback-loop, integration, intelligence, marketplace, multi-region, operations, resource-manager, runtime-services, sla, sla-engine, tenant-platform each have deep submodules), all reflected in the tree diagram below and the statistics table in section 13.

> **Additional submodules (revised 2026-05-18)**: The number of top-level modules has been expanded from 6 to 16 (10 new additions including billing, capacity-planning, cost-attribution, enterprise, federation, intelligence, operations, runtime-services, sla, tenant-platform), all included in the section 13 statistics.

```
src/scale-ecosystem/
├── multi-region/           # Multi-region deployment (NEW §52)
│   ├── region-router/      #   Region routing decisions
│   │   └── index.ts
│   ├── data-replicator/    #   Cross-region data sync
│   │   └── index.ts
│   ├── failover-controller/ #  Region failover
│   │   └── index.ts
│   └── index.ts
├── resource-manager/       # Resource contention management (NEW §53)
│   ├── fair-queue/         #   Weighted fair queue
│   │   └── index.ts
│   ├── quota-enforcer/     #   Quota enforcement
│   │   └── index.ts
│   ├── preemption/         #   Priority preemption
│   │   └── index.ts
│   └── index.ts
├── sla-engine/             # SLA tier guarantee (NEW §54)
│   ├── tier-resolver/      #   SLA tier resolution
│   │   └── index.ts
│   ├── resource-allocator/ #   Resource allocation
│   │   └── index.ts
│   ├── breach-detector/    #   SLA breach detection
│   │   └── index.ts
│   └── index.ts
├── marketplace/            # Agent marketplace and ecosystem (NEW §55, ← core/product/ partial migration)
│   ├── catalog/            #   Marketplace catalog
│   │   └── index.ts
│   ├── certification/      #   Certification and security scanning
│   │   └── index.ts
│   ├── publisher/          #   Publishing management
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
├── feedback-loop/          # Feedback-driven continuous improvement (§56, ← core/feedback/)
│   ├── collector/          #   Signal collection
│   │   ├── feedback-collector.ts
│   │   ├── feedback-model.ts
│   │   ├── signal-preprocessor.ts
│   │   ├── domain-event-feedback-consumer.ts
│   │   └── index.ts
│   ├── analyzer/           #   Signal analysis (NEW)
│   │   └── index.ts
│   ├── improvement-tracker/ #  Improvement tracking (NEW)
│   │   └── index.ts
│   └── index.ts
└── integration/            # External system integration framework (NEW §57)
    ├── connector-registry/ #   Connector registry
    │   └── index.ts
    ├── connector-runtime/  #   Connector runtime
    │   └── index.ts
    ├── health-monitor/     #   Connector health monitoring
    │   └── index.ts
    └── index.ts
```

---

## 9. ops-maturity/ — Operations Maturity Layer

`ops-maturity/` corresponds to architecture Layer 7 (§59-§70). `drift-detection/` migrated from `core/evolution/`, the rest are **newly created modules**.

> **Actual submodules (revised 2026-05-18)**: Section 9 of the documentation records 11 top-level subdirectories, while actual code contains 66 subdirectories with deep levels (agent-lifecycle, capacity-planner, chaos, compliance-reporter, cost-optimizer, drift-detection, edge-runtime, emergency, explainability, improvement, learning, monitoring, multimodal, platform-ops-agent, version-management, workflow-debugger each have deep submodules), all reflected in the tree diagram below and the statistics table in section 13.

> **Additional submodules (revised 2026-05-18)**: The number of top-level modules has been expanded from 11 to 16 (new additions include learning, monitoring, etc.), all included in the section 13 statistics.

```
src/ops-maturity/
├── explainability/         # Agent explainability (NEW §59)
│   ├── evidence-collector/
│   │   └── index.ts
│   ├── causal-chain-builder/
│   │   └── index.ts
│   ├── explanation-renderer/
│   │   └── index.ts
│   ├── explanation-cache/
│   │   └── index.ts
│   └── index.ts
├── emergency/              # Emergency braking (NEW §60)
│   ├── panic-controller/
│   │   └── index.ts
│   ├── forensic-snapshot/
│   │   └── index.ts
│   ├── resume-protocol/
│   │   └── index.ts
│   └── index.ts
├── agent-lifecycle/        # Agent unified lifecycle (NEW §61)
│   ├── agent-registry/
│   │   └── index.ts
│   ├── version-manager/
│   │   └── index.ts
│   ├── canary-controller/
│   │   └── index.ts
│   ├── retirement/
│   │   └── index.ts
│   └── index.ts
├── edge-runtime/           # Offline and edge deployment (NEW §62)
│   ├── edge-orchestrator/
│   │   └── index.ts
│   ├── edge-executor/
│   │   └── index.ts
│   ├── local-model/
│   │   └── index.ts
│   ├── sync-queue/
│   │   └── index.ts
│   └── index.ts
├── drift-detection/        # Behavior drift detection (§63, ← core/evolution/)
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
├── cost-optimizer/         # Cost attribution and optimization (NEW §64)
│   ├── attribution-engine/
│   │   └── index.ts
│   ├── recommendation-engine/
│   │   └── index.ts
│   ├── simulator/
│   │   └── index.ts
│   └── index.ts
├── workflow-debugger/      # Visual debugger (NEW §65)
│   ├── timeline-renderer/
│   │   └── index.ts
│   ├── breakpoint-manager/
│   │   └── index.ts
│   ├── run-comparator/
│   │   └── index.ts
│   └── index.ts
├── compliance-reporter/    # Compliance report engine (NEW §66)
│   ├── template-registry/
│   │   └── index.ts
│   ├── evidence-mapper/
│   │   └── index.ts
│   ├── report-renderer/
│   │   └── index.ts
│   └── index.ts
├── capacity-planner/       # Capacity planning (NEW §67)
│   ├── trend-analyzer/
│   │   └── index.ts
│   ├── forecaster/
│   │   └── index.ts
│   ├── simulator/
│   │   └── index.ts
│   └── index.ts
├── multimodal/             # Multimodal capabilities (NEW §68)
│   ├── image-processor/
│   │   └── index.ts
│   ├── speech-processor/
│   │   └── index.ts
│   ├── document-parser/
│   │   └── index.ts
│   ├── modality-router/
│   │   └── index.ts
│   └── index.ts
└── platform-ops-agent/     # Platform self-ops Agent (NEW §69)
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

Structure is basically consistent with the legacy system, SPI pattern preserved:

```
src/plugins/
├── index.ts
├── builtin-plugin-registry.ts
├── growth-config.ts
├── operations-config.ts
├── adapters/               # Domain adapters
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

### 10.2 sdk/ — SDK and Developer Experience (§22)

> **Additional submodules (revised 2026-05-18)**: Apart from the 4 modules shown in the documentation, actual code also includes 3 additional modules: `admin-sdk/`, `harness-sdk/`, `workbench/`, all included in the section 13 statistics.

```
src/sdk/
├── pack-sdk/               # Business Pack development SDK
│   └── index.ts
├── plugin-sdk/             # Plugin development SDK
│   └── index.ts
├── client-sdk/             # Client SDK (REST/WebSocket)
│   └── index.ts
├── cli/                    # CLI entry (← src/cli/ 78 scripts migrated)
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
├── admin-sdk/              # Administrator SDK
│   └── index.ts
├── harness-sdk/           # Harness SDK
│   └── index.ts
└── workbench/             # Workbench SDK
    └── index.ts
```

### 10.3 apps/ — Application Entries

```
src/apps/
├── api/                    # API Server entry (composing platform/five-plane-interface/ modules)
│   └── index.ts
├── console/                # Console UI backend entry
│   └── index.ts
└── workers/                # Worker process entry (composing platform/five-plane-execution/ modules)
    └── index.ts
```

### 10.4 Top-level Files

```
src/
└── index.ts                # Platform main entry (startup bootstrap + module registration)
```

### 10.5 Project Root Files (Migrated Directly from Legacy System)

```
new-platform/
├── package.json            # ← Direct migration, clean up unnecessary scripts
├── tsconfig.json           # ← Direct migration
├── tsconfig.build.json     # ← Direct migration
├── eslint.config.js        # ← Direct migration
├── .c8rc.json              # ← Direct migration
├── Dockerfile              # ← Direct migration, add edge deployment variants
├── docker-compose.yml      # ← Direct migration, add Redis cluster variants
├── .env.example            # ← Direct migration, add Layer 4-7 configuration items
├── .github/workflows/      # ← Direct migration 4 CI workflows
├── scripts/                # ← Direct migration CI/build scripts
├── deploy/                 # ← Direct migration deployment manifests
├── config/                 # ← Direct migration 27 configuration files
└── divisions/              # ← Modified migration (adapted to DomainDescriptor)
```

---

## 11. ui/ — Cross-platform UI Monorepo

`ui/` is the current frontend sub-project in the repository, not migrated into the backend `src/`. It interacts with the backend through API-first, DTO → VM → Props, PlatformAdapter, and feature gates. UI code must not directly import backend `src/platform/*` internal implementations; it can only depend on generated contracts, OpenAPI/schema, frontend shared API client, or mock/contract seam.

```
ui/
├── apps/
│   ├── web/                # React + Vite Web SPA, runnable main entry
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
│   │   └── types/          # Frontend public types
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
│   ├── codegen/            # Generate frontend types and endpoint bindings from backend contracts/OpenAPI/schema
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
├── hooks/                  # Query/VM hooks, only returning ViewModel
├── route.ts                # route registration
├── permissions.ts          # feature guard / visibility
├── mapper.ts               # DTO → VM
└── index.ts                # public exports
```

Rules:

- Components must not directly consume backend DTOs; they must go through mappers to be converted to VMs.
- Planned backend capabilities must use feature gate + typed mock + degradation banner.
- Platform-specific capabilities can only be injected through PlatformAdapter; direct calls to Electron/Tauri/RN APIs within features are prohibited.
- UI tests belong to `ui/tests/*` or `tests/unit/ui` / `tests/integration/ui`, and must not be mixed into backend runtime tests.

---

## 12. tests/ — Test Directory Structure

The test directory **mirrors the `src/` structure**, with each source code directory having a corresponding test directory under tests/.

> **Actual test subdirectories (revised 2026-05-18)**: The actual `tests/` includes dedicated directories such as `unit/`, `integration/`, `e2e/`, `golden/`, `performance/`, `invariants/`, `leaks/`, `fixtures/`, `helpers/`. UI also has its own `ui/tests/`. The test directory is no longer just a simple mirror of source code, but also undertakes architecture invariants, memory leaks, deployment, documentation, and UI acceptance.

```
tests/
├── helpers/                # Test infrastructure (← direct migration 19 files)
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
├── unit/                   # Unit tests (mirroring src/ structure)
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
├── integration/            # Integration tests (grouped by concern)
│   ├── platform/
│   │   ├── security/       # 64 security boundary tests
│   │   ├── runtime/        # dispatch/lease/worker/recovery
│   │   ├── storage/        # Data integrity
│   │   ├── contract/       # Contract validation
│   │   ├── reliability/    # Reliability invariants
│   │   ├── concurrency/    # Concurrency tests
│   │   ├── recovery/       # Recovery tests
│   │   └── observability/  # Observability
│   ├── interaction/        # All new
│   ├── org-governance/     # All new
│   ├── scale-ecosystem/
│   ├── ops-maturity/
│   └── sdk/
│       └── cli/            # 32 CLI integration tests
│
├── golden/                 # Golden snapshot tests (← direct migration)
│   ├── diagnostics-bundle.test.ts
│   ├── openapi-document.test.ts
│   ├── release-plan-output.test.ts
│   ├── session-summary.test.ts
│   ├── golden-tasks.test.ts
│   ├── prompt-assembly.test.ts
│   ├── workflow-validation.test.ts
│   ├── cli-help-text.test.ts
│   └── snapshots/
│
├── e2e/                    # End-to-end tests
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
├── performance/            # Performance tests and capacity benchmarks
├── invariants/             # Architecture invariant tests
├── leaks/                  # Memory/handle leak tests
├── unit/ui/                # UI unit test mirror
├── integration/ui/         # UI integration test mirror
│
└── fixtures/               # Test fixtures (← modified migration)
    └── migration/
```

---

## 13. Statistics Summary

### 13.1 Directory Statistics Snapshot (2026-05-18 Third Round Structure Review)

> Note: The numbers below are current workspace snapshots, used for structure review, and are not long-term manually maintained precise metrics. They should be generated by scripts and synced to this document subsequently, to avoid becoming outdated as the code grows.

| Top-level Directory | Architecture Layer | Current TS/TSX File Count | Structure Status | Notes |
|----------|--------|-------------------|----------|------|
| `src/platform/` | Layer 1-2 | 1,224 | Authoritative core area | Five planes + contracts/shared/model-gateway/prompt/compliance |
| `src/domains/` | Layer 3 | 96 | Expanded | Includes canonical meta-model, business domain instances, and `yono/` |
| `src/interaction/` | Layer 4 | 52 | Expanded | NL, goal, dashboard, autonomy, UX |
| `src/org-governance/` | Layer 5 | 52 | Expanded | org model, approval routing, SSO/SCIM, compliance |
| `src/scale-ecosystem/` | Layer 6 | 148 | Expanded | marketplace, billing, SLA, multi-region, runtime-services |
| `src/ops-maturity/` | Layer 7 | 121 | Expanded | chaos, debugger, capacity, edge, explainability |
| `src/plugins/` | Cross-layer | 25 | Stable | Plugin ecosystem |
| `src/sdk/` | Cross-layer | 104 | Expanded | CLI, SDK, pack/plugin, harness/admin/workbench |
| `src/apps/` | Entry | 4 | Stable | API/console/workers |
| `src/core/` | Legacy compatibility | 8 | Compatibility layer | New business capabilities prohibited |
| `src/testing/` | Test infrastructure | 1 | Stable | Production code must not depend |
| `src/benchmarks/` | Performance benchmark | 1 | Stable | Benchmark entry |
| `ui/` | UI Monorepo | 330 | New authoritative area | apps/packages/tools/tests |
| `tests/` | Backend tests | 6,000+ | Expanded | unit/integration/e2e/golden/performance/invariants/leaks |

> **Five-plane submodule count explanation (revised 2026-05-18)**:
> - `five-plane-control-plane/`: approval-center, audit-export, compliance, config-center, cost-alert, iam, incident-control, mission, policy-center, replay-repair-control, risk-control, rollout-controller, tenant + deep-level threat-model, runbook-executor, etc. → 44 directories with deep levels in total
> - `five-plane-execution/`: budget-allocator, compensation-manager, dispatcher, distributed-lock, execution-engine, ha, hibernation, hot-upgrade, lease, oapeflir, plugin-executor, queue, queue-metrics, recovery, reconciliation-worker, resource, runtime-state-machine, side-effect-manager, startup, state-transition, tool-executor, worker-pool → 17 direct subdirectories
> - `five-plane-interface/`: api, channel-gateway, console, console-backend, ingress, scheduler, webhook, etc. → 17 directories with deep levels
> - `five-plane-orchestration/`: agent-delegation, escalation, evaluator, harness, hitl, improve-rollout, learn, oapeflir, observer, planner, replan, routing, etc. → 29 directories with deep levels
> - `five-plane-state-evidence/`: artifacts, audit, checkpoints, compaction, dlq, events, incident, knowledge, memory, outbox, projections, reconciliation, side-effect-ledger, truth, etc. → 20 directories with deep levels

### 13.2 Comparison with Legacy System

| Metric | Legacy System | New Platform | Change |
|------|--------|--------|------|
| Number of top-level src/ directories | 4 (core/cli/gateway/plugins) | 12 (platform/domains/interaction/org/scale/ops/plugins/sdk/apps/core/testing/benchmarks) | +8 |
| Frontend project | No independent monorepo | `ui/` Monorepo | New six-platform UI baseline |
| Number of second-level directories | 43 (flat under core/) | 100+ (distributed across seven layers, five planes, UI packages) | Significantly increased but with clearer boundaries |
| Maximum file count in a single directory | 101 (core/storage/) | ~40 (largest directory after split) | -60% |
| Maximum lines in a single module | 30,348 (core/runtime/) | ~5,000 (split into 12 BCs) | -83% |
| Circular dependency risk | High (42 flat modules) | Low (hierarchical dependencies + contract decoupling) | Significantly improved |

### 13.3 Dependency Direction Rules

```
Layer 7  ops-maturity/     ──→ Can depend on Layer 1-6
Layer 6  scale-ecosystem/  ──→ Can depend on Layer 1-5
Layer 5  org-governance/   ──→ Can depend on Layer 1-4
Layer 4  interaction/      ──→ Can depend on Layer 1-3
Layer 3  domains/          ──→ Can depend on Layer 1-2
Layer 1-2 platform/        ──→ Only depends on platform/contracts/ and platform/shared/
Cross-layer plugins/sdk/apps/ ──→ Can depend on any layer (injected through public interface)
Frontend ui/                ──→ Only depends on public API/OpenAPI/schema/codegen/mock seam
Tests tests/             ──→ Can depend on the tested public API; architecture guard tests can scan source code
```

**Prohibited**: Lower layers depending on upper layers (e.g., platform/ must not import interaction/). Same-layer modules are decoupled through event bus or platform/contracts/.

### 13.4 Current Structure Risks and Follow-up Improvements

| Risk | Description | Recommendation |
| ---- | ---- | ---- |
| Manual statistics easily become outdated | Directory and file counts grow quickly, manual tables easily become inaccurate | Use `scripts/ci/audit-codebase-inventory.mjs` or add a new structure inventory script |
| Dual entry naming coexistence | `five-plane-*` is the authoritative source code directory, but historical documentation still occasionally uses interface/control-plane abbreviations | New documentation should uniformly write `five-plane-*`, with abbreviations only as explanation |
| UI-backend boundary needs continuous guarding | The UI has grown large; directly importing backend internal implementations will break layering | Add contract tests to prohibit `ui/**` from importing `src/**` internal paths |
| Mission/Yono will continue to expand | Mission and Yono have entered the code structure, but business/governance capabilities will still grow | When adding new subdirectories, synchronously update the corresponding section in this file |
| `src/core/` still exists | Reasonable as a compatibility layer, but easily misused | CI guard to prohibit new business code from entering `src/core/` |
