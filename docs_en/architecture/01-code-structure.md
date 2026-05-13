# New Platform Code File Structure Design Document

> **Document Version**: v1.0
> **Document Status**: Draft
> **Related Document**: "Enterprise Agent Platform Overall Technical Architecture Design Document" v2.7 §35 Recommended Code Directory
> **Related Document**: "Old System → New Platform Migration Assessment Document" v1.1
> **Design Date**: 2026-04-19

---

## 1. Document Purpose

This document defines the **complete code file structure** of the new platform and answers three questions:

1. How is the new platform's `src/` directory organized? What goes in each directory?
2. Where does code from the old system (`src/core/` 42 modules) go in the new platform?
3. Where do the 24 brand-new modules of the new platform go?

---

## 2. Design Principles

| # | Principle | Description |
|---|-----------|-------------|
| 1 | **Architecture-Driven Directory** | Top-level directories are organized by the seven-layer architecture + five planes, not by technical concerns (controller/service/repository) |
| 2 | **Bounded Context as Directory** | Each bounded context corresponds to a second-level directory, self-contained with model/service/repository/types inside |
| 3 | **Contracts Centralized** | Inter-plane communication contracts are centralized in `platform/contracts/`, not scattered across plane directories |
| 4 | **Domain Instances Separated from Framework** | `domains/` is divided into "framework infrastructure" and "domain instances" layers; adding a new business domain only requires adding a domain instance directory |
| 5 | **Tests Mirror Source** | The `tests/` directory structure mirrors `src/`, with one-to-one path correspondence |
| 6 | **kebab-case File Naming** | All filenames use kebab-case, class/type names use PascalCase, function names use camelCase |
| 7 | **One index.ts per Directory** | Each second-level directory provides `index.ts` as the public API export; third-level directories are internal implementation details |
| 8 | **Zero Circular Dependencies** | Only upper layers may depend on lower layers (Layer N may depend on Layer N-1); same-layer coupling is resolved through contracts or events |

---

## 3. Top-Level Directory Overview

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
│   └── index.ts            # Platform Entry Point
├── tests/                  # Tests (mirrors src/ structure)
├── config/                 # Versioned Configuration
├── divisions/              # Division Definitions (adapted after migration to DomainDescriptor)
├── doc/                    # Documentation
├── scripts/                # CI/Build Scripts
├── deploy/                 # Deployment Manifests
└── [Top-level config files]  # package.json / tsconfig.json / eslint.config.js / Dockerfile / ...
```

### 3.1 Old System vs. New Platform Top-Level Comparison

| Old System | New Platform | Change Description |
|------------|--------------|-------------------|
| `src/core/` (42 flat modules) | `src/platform/` + `src/domains/` + `src/interaction/` + `src/org-governance/` + `src/scale-ecosystem/` + `src/ops-maturity/` | Flat core/ split into 6 top-level directories organized by seven-layer architecture |
| `src/cli/` (78 scripts) | `src/sdk/cli/` | CLI belongs to SDK layer |
| `src/gateway/` (13 files) | `src/platform/interface/` + `src/interaction/nl-gateway/` | API gateway belongs to P1 Interface, NL gateway belongs to Layer 4 |
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
| `core/config/` | `platform/control-plane/config-center/` | P2 Control Plane |
| `core/storage/` | `platform/state-evidence/truth/` | P5 State & Evidence |
| `core/events/` | `platform/state-evidence/events/` | P5 State & Evidence |
| `core/locking/` | `platform/execution/distributed-lock/` | P4 Execution Plane |
| `core/queue/` | `platform/execution/queue/` | P4 Execution Plane |
| `core/cache/` | `platform/shared/cache/` | Cross-layer Shared |
| `core/api/` | `platform/interface/api/` | P1 Interface Plane |
| `core/resource/` | `platform/execution/resource/` | P4 Execution Plane |
| `core/runtime/` → Dispatch | `platform/execution/dispatcher/` | P4 Execution Plane |
| `core/runtime/` → Lease | `platform/execution/lease/` | P4 Execution Plane |
| `core/runtime/` → Worker | `platform/execution/worker-pool/` | P4 Execution Plane |
| `core/runtime/` → HA | `platform/execution/ha/` | P4 Execution Plane |
| `core/runtime/` → Recovery | `platform/execution/recovery/` | P4 Execution Plane |
| `core/runtime/` → HotUpgrade | `platform/execution/hot-upgrade/` | P4 Execution Plane |
| `core/runtime/` → StateMachine | `platform/execution/state-transition/` | P4 Execution Plane |
| `core/runtime/` → AgentExec | `platform/execution/execution-engine/` | P4 Execution Plane |
| `core/runtime/` → HITL | `platform/orchestration/hitl/` | P3 Orchestration Plane |
| `core/runtime/` → Orchestration | `platform/orchestration/routing/` | P3 Orchestration Plane |
| `core/agent-loop/` | `platform/orchestration/oapeflir/` | P3 Orchestration Plane |
| `core/planning/` | `platform/orchestration/planner/` | P3 Orchestration Plane |
| `core/orchestration/` | `platform/orchestration/routing/` | P3 Orchestration Plane |
| `core/providers/` | `platform/model-gateway/provider-registry/` | AI Operations |
| `core/tools/` | `platform/execution/tool-executor/` | P4 Execution Plane |
| `core/workflow/` | `platform/orchestration/oapeflir/workflow/` | P3 Orchestration Plane |
| `core/artifacts/` | `platform/state-evidence/artifacts/` | P5 State & Evidence |
| `core/feedback/` | `scale-ecosystem/feedback-loop/` | Layer 6 |
| `core/learning/` | `platform/orchestration/oapeflir/learn/` | P3 Orchestration Plane |
| `core/evaluation/` | `platform/prompt-engine/eval/` | AI Operations |
| `core/memory/` | `platform/state-evidence/memory/` | P5 State & Evidence |
| `core/knowledge/` | `platform/state-evidence/knowledge/` | P5 State & Evidence |
| `core/messages/` | `platform/model-gateway/messages/` | AI Operations |
| `core/domain-registry/` | `domains/registry/` | Layer 3 |
| `core/divisions/` | `domains/governance/` | Layer 3 |
| `core/security/` | `platform/control-plane/iam/` | P2 Control Plane |
| `core/approvals/` | `platform/control-plane/approval-center/` | P2 Control Plane |
| `core/compliance/` | `platform/compliance/` | AI Operations |
| `core/cost/` | `platform/model-gateway/cost-tracker/` | AI Operations |
| `core/hr/` | `org-governance/org-model/` | Layer 5 |
| `core/deployment/` | `platform/control-plane/rollout-controller/` | P2 Control Plane |
| `core/improvement/` | `platform/orchestration/oapeflir/improve-rollout/` | P3 Orchestration Plane |
| `core/observability/` | `platform/shared/observability/` | Cross-layer Shared |
| `core/ops/` | `platform/control-plane/incident-control/` | P2 Control Plane |
| `core/stability/` | `platform/shared/stability/` | Cross-layer Shared |
| `core/evolution/` | `ops-maturity/drift-detection/` | Layer 7 |
| `core/reliability/` | `platform/execution/recovery/` | P4 Execution Plane |
| `core/product/` | `scale-ecosystem/marketplace/` | Layer 6 |
| `gateway/` | `platform/interface/` (split) | P1 Interface Plane |
| `plugins/` | `plugins/` | Cross-layer |
| `cli/` | `sdk/cli/` | Cross-layer SDK |

---

## 4. platform/ — Infrastructure Layer + AI Operations Layer

`platform/` corresponds to architecture Layer 1 (Infrastructure) and Layer 2 (AI Operations), containing five planes + cross-cutting concerns.

```
src/platform/
├── interface/              # P1 Interface Plane ── §6 API Contracts
│   ├── api/                #   HTTP API server + OIDC/OAuth + WebSocket
│   │   ├── http-api-server.ts
│   │   ├── api-auth-service.ts
│   │   ├── oidc-oauth-service.ts
│   │   ├── openapi-document.ts
│   │   ├── mission-control-service.ts
│   │   ├── task-websocket-status-relay.ts
│   │   └── index.ts
│   ├── webhook/            #   Webhook Inbound Processing
│   │   ├── webhook-receiver.ts
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
├── control-plane/          # P2 Control Plane ── §24 Configuration / §11 Security / §21 Approval
│   ├── tenant/             #   Tenant Management
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
├── orchestration/          # P3 Orchestration Plane ── §13 OAPEFLIR
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
├── execution/              # P4 Execution Plane ── §14 Runtime
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
│   └── startup/            #   Startup & Preflight
│       ├── startup-preflight.ts
│       ├── startup-consistency-checker.ts
│       ├── graceful-shutdown.ts
│       └── index.ts
│
├── state-evidence/         # P5 State & Evidence Plane ── §25-§29
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

### 4.1 platform/ Statistics

| Subdirectory | Architecture Positioning | Migration Source Files | New Files |
|--------------|-----------------|----------------------|-----------|
| `interface/` | P1 Interface Plane | ~43 (api 30 + gateway 13) | ~5 |
| `control-plane/` | P2 Control Plane | ~72 (config 27 + security 19 + approvals 3 + ops 19 + deployment 2 + compliance 2) | ~8 |
| `orchestration/` | P3 Orchestration Plane | ~64 (agent-loop 14 + planning 9 + orchestration 3 + workflow 4 + learning 14 + improvement 11 + runtime/HITL 2 + runtime/orchestration 7) | ~3 |
| `execution/` | P4 Execution Plane | ~155 (runtime 80 + tools 36 + locking 8 + queue 6 + resource 2 + reliability 8 + startup 3) | ~5 |
| `state-evidence/` | P5 State & Evidence | ~157 (storage 101 + events 8 + artifacts 13 + memory 16 + knowledge 10 + split repo 21) | ~8 |
| `model-gateway/` | AI Operations | ~12 (providers 10 + messages 2) | ~5 |
| `prompt-engine/` | AI Operations | ~6 (evaluation 6) | ~5 |
| `compliance/` | AI Operations | 0 | ~6 |
| `contracts/` | Cross-plane | ~26 (types 21 + errors 1 + constants 2 + results 2) | ~8 |
| `shared/` | Cross-layer Shared | ~73 (utils 2 + lifecycle 3 + cache 12 + observability 36 + stability 31) | 0 |
| **Total** | | **~608** | **~53** |

---

## 5. domains/ — Business Domain Access Layer

`domains/` corresponds to architecture Layer 3 (§37-§38), divided into "domain framework infrastructure" and "domain instance" layers.

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
├── coding/                 # Coding Domain Instance
│   └── index.ts
└── operations/             # Operations Domain Instance
    └── index.ts
```

---

## 6. interaction/ — Intelligent Interaction Layer

`interaction/` corresponds to architecture Layer 4 (§39-§44), all **newly created modules** (old system completely missing).

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

`scale-ecosystem/` corresponds to architecture Layer 6 (§52-§57). `feedback_loop/` migrated from `core/feedback/`, `marketplace/` partially migrated from `core/product/`, and the rest are **newly created modules**.

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

```
src/sdk/
├── pack-sdk/               # Business Pack Development SDK
│   └── index.ts
├── plugin-sdk/             # Plugin Development SDK
│   └── index.ts
├── client-sdk/             # Client SDK (REST/WebSocket)
│   └── index.ts
└── cli/                    # CLI Entry Point (← src/cli/ 78 scripts migrated)
    ├── acceptance-readiness.ts
    ├── api-server.ts
    ├── billing.ts
    ├── channel-gateway.ts
    ├── dispatch-execution.ts
    ├── dispatch-reconcile.ts
    ├── doctor.ts
    ├── inspect.ts
    ├── release-pipeline.ts
    ├── secret-management.ts
    ├── takeover.ts
    ├── task-board.ts
    ├── worker-handshake.ts
    ├── worker-register.ts
    ├── worker-writeback.ts
    ├── ... (remaining 63 CLI scripts, structure unchanged)
    └── index.ts
```

### 10.3 apps/ — Application Entry Points

```
src/apps/
├── api/                    # API Server Entry (assembles platform/interface/ modules)
│   └── index.ts
├── console/                # Console UI Backend Entry
│   └── index.ts
└── workers/                # Worker Process Entry (assembles platform/execution/ modules)
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

## 11. tests/ — Test Directory Structure

Tests **mirror `src/` structure**; each source directory has a corresponding test directory under tests/.

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
│   │   ├── interface/
│   │   │   ├── api/
│   │   │   └── channel-gateway/
│   │   ├── control-plane/
│   │   │   ├── iam/
│   │   │   ├── approval-center/
│   │   │   ├── config-center/
│   │   │   ├── incident-control/
│   │   │   ├── rollout-controller/
│   │   │   └── audit-export/
│   │   ├── orchestration/
│   │   │   ├── oapeflir/
│   │   │   ├── planner/
│   │   │   ├── routing/
│   │   │   └── hitl/
│   │   ├── execution/
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
│   │   ├── state-evidence/
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
├── e2e/                    # End-to-end Tests (← Adapted migration 10 files)
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
├── performance/            # Performance Tests (← Directly migrated 6 files)
│
└── fixtures/               # Test Fixtures (← Adapted migration)
    └── migration/
```

---

## 12. Statistics Summary

### 12.1 Directory Statistics

| Top-level Directory | Architecture Layer | Second-level Directories | Migrated Files | New Files | Total |
|---------------------|-------------------|------------------------|---------------|-----------|-------|
| `platform/` | Layer 1-2 | 10 | ~608 | ~53 | ~661 |
| `domains/` | Layer 3 | 10 | ~18 | ~8 | ~26 |
| `interaction/` | Layer 4 | 6 | 0 | ~24 | ~24 |
| `org-governance/` | Layer 5 | 6 | ~2 | ~18 | ~20 |
| `scale-ecosystem/` | Layer 6 | 6 | ~27 | ~18 | ~45 |
| `ops-maturity/` | Layer 7 | 11 | ~12 | ~44 | ~56 |
| `plugins/` | Cross-layer | 5 | ~20 | 0 | ~20 |
| `sdk/` | Cross-layer | 4 | ~78 | ~5 | ~83 |
| `apps/` | Entry | 3 | 0 | ~3 | ~3 |
| **src/ Total** | | **61** | **~765** | **~173** | **~938** |

### 12.2 Comparison with Old System

| Metric | Old System | New Platform | Change |
|--------|------------|--------------|--------|
| Top-level src/ directory count | 4 (core/cli/gateway/plugins) | 9 (platform/.../sdk/apps/plugins) | +5 |
| Second-level directory count | 43 (flat under core/) | 61 (distributed across seven layers) | +18 |
| Max files in single directory | 101 (core/storage/) | ~40 (largest split directory) | -60% |
| Max lines in single module | 30,348 (core/runtime/) | ~5,000 (split into 12 BCs) | -83% |
| Circular dependency risk | High (42 flat modules) | Low (layered dependencies + contract decoupling) | Significantly improved |

### 12.3 Dependency Direction Rules

```
Layer 7  ops-maturity/     ──→ Can depend on Layer 1-6
Layer 6  scale-ecosystem/  ──→ Can depend on Layer 1-5
Layer 5  org-governance/   ──→ Can depend on Layer 1-4
Layer 4  interaction/      ──→ Can depend on Layer 1-3
Layer 3  domains/          ──→ Can depend on Layer 1-2
Layer 1-2 platform/        ──→ Only depends on platform/contracts/ and platform/shared/
Cross-layer plugins/sdk/apps/ ──→ Can depend on any layer (through interface injection)
```

**Forbidden**: Lower layers depending on upper layers (e.g., platform/ must not import interaction/). Same-layer modules decouple through event bus or platform/contracts/.