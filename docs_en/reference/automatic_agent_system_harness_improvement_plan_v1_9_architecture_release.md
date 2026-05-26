# Automatic Agent System — Agent Harness Improvement Plan v1.9-Architecture-Release

| Field | Content |
|---|---|
| Document Version | v1.9-Architecture-Release |
| Date | 2026-05-26 |
| Baseline Version | `v1.8-RC` (logical baseline; current repository does not retain an independent v1.8 document file) |
| Applicable System | Automatic Agent System / Automatic Agent Platform |
| Top-level Architecture | Five Plane Architecture |
| Task Lifecycle | OAPEFLIR: Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release |
| Driving Model | Harness-driven: model serves as reasoning, generation, and candidate decision component, not as system controller |
| Capability Map | Agent Harness Engineering / ETCLOVG as capability maturity map, not replacement for Five Plane |
| Memory Architecture | Seven-layer Memory Governance, unified governance through logical Memory Gateway, does not mandate unified physical storage nor creation of same-named directories |
| Version Objective | Complete release convergence on v1.8-RC basis: unify version references, clarify release types, fix engineering freeze conditions, converge ADR status, supplement first batch of validation scenario recommendations, and preserve engineering blocking items (real code scan / owner / CI / P0a shadow) |
| Release Conclusion | **Can be released as v1.9 Architecture Review Release**; cannot be used as Engineering Freeze Baseline or Production Governance Baseline. Before entering engineering freeze, must complete real repository scan, real owner binding, CI command delivery, and P0a shadow path verification |

---

## 0. One-page Conclusion

v1.8-RC already has conditions for architecture review; v1.9 completes release pre-convergence on this basis, fixing version consistency, ADR status, engineering freeze conditions, first validation scenario recommendations, and release boundary expressions.

This version **can be officially released as Architecture Review Release**, for team architecture review, engineering scheduling, real code scanning, and P0a shadow chain initiation; but **cannot** be used as Engineering Freeze Baseline or Production Governance Baseline. Before freezing engineering baseline, must complete real repository scan, real owner binding, CI command delivery, P0a shadow path verification.

Main improvements in this version:

1. **Code mapping no longer masquerades as fact**: Current Codebase Gap Matrix clearly distinguishes `scan-confirmed / hypothetical path / pending scan confirmation / new module`, preventing target design from being misread as current implementation.
2. **TODO gains real execution fields**: All Canonical TODOs add `OwnerName / Reviewer / TargetStart / TargetEnd / IssueLink / VerifyCommandStatus`; undefined items uniformly marked as `TBD`, no longer masquerading as assigned.
3. **CI commands contractualized**: All verify commands explicitly divided into `existing / to_add / TBD`, avoiding "verification command exists in documentation but not in repository" issues.
4. **P0b split further**: P0b split into `P0b-1 high-risk tool enforce`, `P0b-2 L4-L7 memory enforce`, `P0b-3 production release gate`, `P0b-4 H3 untrusted output enforce`, `P0b-5 minimal approval UI/API`.
5. **H1-lite moved forward**: Untrusted marking of external text, files, retrieval results, and third-party data with basic injection detection moved to P0b/P0c; H1-full stays at P1.
6. **Release Gate thresholds specified**: Golden / Security / Trajectory / Evidence / Cost thresholds defined per scenario; Policy Compliance and Approval Compliance must be perfect for high/critical tasks.
7. **Cost/Latency dependency corrected**: P0c advisory only; P1 allowed as release blocking gate.
8. **Receipt / Outbox atomicity reinforcement**: High-risk side effects must write `PrepareReceipt` or durable outbox record before commit, avoiding "side effect occurred but no record in evidence layer".
9. **Tool reversibility enters risk decision**: Reversibility levels like `not_reversible` / `forward_fix_only` participate in risk resolution, no longer just metadata.
10. **Memory Gateway interfaces implemented**: Supplemented `ManagedMemoryMinimal`, `MemoryProposal`, `MemoryProjection`, `MemoryCommitDecision`, `MemoryRevokeDecision`.
11. **Security & Privacy Baseline completed**: Covers secret, PII, cross-tenant isolation, retention, export/delete, restricted evidence access.
12. **Added three flow diagrams and system boundary diagram**: Supplemented control flow, evidence flow, Memory flow, and Five Plane × Gate overview diagram for review understanding.
13. **First batch of business scenarios elaborated**: Paper Research Agent, Code Review/Test Failure Analysis Agent given inputs, tools, risks, Gates, Memory, Eval and acceptance metrics.
14. **TODO deduplication**: Release Console, Memory Review Console split into backend/API and frontend/UI, using unique Canonical TODO IDs.

Final architecture expression remains unchanged:

```text
Automatic Agent System
= Five Plane Architecture
+ Harness-driven Runtime
+ OAPEFLIR Task Lifecycle
+ ETCLOVG Capability Maturity Map
+ Seven-layer Memory Governance
+ Trace-native Evaluation
+ Release / Evaluation / Governance Gate
```

### 0.1 v1.9 Release Statement

| Item | Conclusion |
|---|---|
| Release Name | Automatic Agent System — Agent Harness Improvement Plan v1.9-Architecture-Release |
| Release Type | Architecture Review Release |
| Allowed Usage | Architecture review, engineering scheduling, real code scanning, P0a shadow implementation preparation, first batch of business scenario baseline evaluation preparation |
| Prohibited Usage | Must not be used as sole basis for engineering freeze baseline, production governance standard, or production release gate |
| Engineering freeze blocking items | Real code scan, real Owner/Reviewer/Issue, CI command delivery, P0a shadow E2E, Eval baseline calibration |
| Next Target Version | v2.0 Engineering Baseline Candidate,前提是完成所有工程冻结条件 |

---

## 1. Release Pre-convergence from v1.8-RC to v1.9

| Category | v1.8-RC Remaining Issues | v1.9 Convergence Method |
|---|---|---|
| Code Mapping | Gap Matrix still uses "pending scan confirmation" hypothetical paths | Added `MappingConfidence` and `ScanAction`, clarifying which are facts and which are pending scan |
| TODO Execution | Owner is team role, not real responsible party | Added `OwnerName / Reviewer / TargetStart / TargetEnd / IssueLink`, undefined uniformly marked TBD |
| Acceptance Commands | Verify command may not exist | Added `VerifyCommandStatus: existing / to_add / TBD` with CI Command Contract |
| TODO Duplication | Release Console, Memory Review Console duplicated | Split into backend/API and frontend/UI, establishing dependencies |
| P0 Phase | P0b still too heavy | Split into P0b-1 through P0b-5, batched enforcement |
| H1 Risk | H1 Input Gate placed at P1 too late | H1-lite moved to P0b/P0c, H1-full stays at P1 |
| Evaluation Thresholds | Release threshold too abstract | Added scenario-based blocking thresholds and high-risk perfect score items |
| Cost/Latency | P0c Release Gate depends on P1 observability | P0c advisory, P1 blocking |
| Receipt Atomicity | Insufficient fallback after receipt write failure | Added durable outbox / commit journal design |
| Tool Rollback | Reversibility metadata not participating in decisions | Added reversibility risk rule |
| Memory Schema | Memory Gateway interfaces too conceptual | Added ManagedMemoryMinimal and other minimal interfaces |
| Security & Privacy | L5/L6/L7 memory and trace privacy insufficient | Added Security & Privacy Baseline |
| Readability | Missing system boundary diagram and three flow diagrams | Added Mermaid architecture diagrams for control flow, evidence flow, Memory flow |
| Business Implementation | Business Scenario Matrix too coarse | Elaborated implementation design for first two scenarios |

---

## 2. Architecture Positioning and Non-goals

### 2.1 Main Architecture Remains Five Plane

```text
1. Interface Plane
2. Control Plane
3. Orchestration Plane
4. Execution Plane
5. State & Evidence Plane

+ Reliability / Security / Governance / Observability Fabric
```

### 2.2 OAPEFLIR is Task Lifecycle

```text
Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release
```

Release must distinguish two types:

| Release Type | Meaning | Example | Requires Release Gate |
|---|---|---|---|
| Mission Release | Single task product delivery, acceptance, archival | Report, PR draft, experiment suggestions, prediction-assisted conclusions | Requires task-level acceptance, not equivalent to system release |
| System Artifact Release | System capability version release | prompt, tool schema, policy, workflow, model config, evaluator, sandbox config | Must go through EvalReport, Approval, Canary, RollbackPlan |

### 2.3 ETCLOVG is Capability Map, Not Top-level Architecture

| ETCLOVG | Maps to Five Plane | Purpose |
|---|---|---|
| E Execution Environment & Sandbox | Execution Plane | sandbox, worker, lease, side-effect commit |
| T Tool Interface & Protocol | Execution + Control | tool gateway, schema, routing, permission, tool version |
| C Context & Memory Management | Orchestration + State & Evidence | seven-layer memory, projection, context drift |
| L Lifecycle & Orchestration | Orchestration Plane | mission/session/task lifecycle, multi-agent coordination |
| O Observability & Operations | State & Evidence + Fabric | trace, metrics, cost, latency, failure diagnosis |
| V Verification & Evaluation | Control + State & Evidence | readiness, trajectory eval, regression, release gate |
| G Governance & Security | Control + Fabric | policy, approval, identity, audit, security guardrail |

### 2.4 Non-goals

This transformation explicitly does not do:

1. Do not replace Five Plane with ETCLOVG seven layers.
2. Do not refactor directory structure in one shot.
3. Do not let model directly execute side-effect tools.
4. Do not let model directly commit L4-L7 Memory.
5. Do not use Memory as Policy.
6. Do not use Evidence as Memory.
7. Do not use Context as source of truth.
8. Do not use final answer scoring as complete Agent evaluation.
9. Do not equate Tool Registry with Tool Gateway.
10. Do not allow System Artifact Release into production without EvalReport / RollbackPlan.
11. Do not forcibly complete full sandbox, full UI, full self-optimization at P0 stage.
12. Do not equate document release with runtime governance baseline.
13. Do not treat hypothetical code paths in this document as current code facts; must be confirmed via repository scan.
14. Do not treat team role owner as real responsible party; real responsible party must be filled in during engineering scheduling.
15. Do not create a second parallel subsystem because of target nouns in documentation; default to wrapping, extending, converging existing implementations first.

---

## 3. System Boundary Diagram: Five Plane × Gate × Evidence

```mermaid
flowchart TB
    U[User / API / SDK / CLI / Webhook] --> IP

    subgraph IP[Interface Plane]
      UI[Chat / Admin Console / Approval Queue / Trace Explorer]
    end

    IP --> H1[H1 Input Gate<br/>untrusted input screening]
    H1 --> C[Control Plane]

    subgraph C[Control Plane]
      POLICY[PolicyBundle / Permission / Budget / Risk]
      APPROVAL[Approval Gate]
      RELEASE[Release Gate]
      EVALG[Evaluation Gate]
    end

    C --> O[Orchestration Plane]

    subgraph O[Orchestration Plane]
      MISSION[Mission / Session / Task Lifecycle]
      PLAN[Planner / OAPEFLIR Loop]
      CTX[Context Builder / Memory Projection]
    end

    O --> H2[H2 Action Gate<br/>proposed action check]
    H2 --> E[Execution Plane]

    subgraph E[Execution Plane]
      TG[Tool Gateway]
      SB[SandboxProvider]
      WORKER[Worker Runtime]
      LEASE[Lease / Fencing / Idempotency]
      COMMIT[Prepare / Commit / Verify / Compensate]
    end

    E --> H3[H3 Observation Gate<br/>tool output filtering]
    H3 --> S[State & Evidence Plane]

    subgraph S[State & Evidence Plane]
      STORE[AuthoritativeTaskStore]
      BUS[DurableEventBus]
      RECEIPT[Receipt Store]
      EVID[Evidence Store]
      MEM[Seven-layer Memory Store Adapters]
      OUTBOX[Durable Outbox / Commit Journal]
    end

    C --> H4[H4 Approval Gate<br/>high-risk side-effect approval]
    H4 --> COMMIT

    FABRIC[Reliability / Security / Governance / Observability Fabric]
    FABRIC -.-> IP
    FABRIC -.-> C
    FABRIC -.-> O
    FABRIC -.-> E
    FABRIC -.-> S
```

---

## 4. Glossary

| Term | Definition |
|---|---|
| Harness | Execution control system wrapping the model, responsible for lifecycle, tools, state, evidence, evaluation, governance and release |
| Plane | Top-level responsibility boundary, used to partition system control, orchestration, execution, state and interface responsibilities |
| Capability | Production-level Agent capability domain, e.g., Tool Gateway, Memory Governance, Trace-native Evaluation |
| Mission | Complete task unit oriented toward business goals, can span sessions, tasks, and tools |
| Session | One interaction context between user or system and Agent, belongs to Mission |
| Task | Schedulable, executable, evaluable subtask under Mission |
| Receipt | Structured execution credential recording key actions such as policy, approval, tool, memory, evaluation, release |
| Evidence | Raw evidence, tool results, trace, logs, files, evaluation results and other不可直接替代的事实材料 |
| Memory | Reusable knowledge, preferences, experiences or summaries distilled from evidence, state, feedback |
| Context | Projection seen in current model call, not source of truth |
| Projection | Privileged, task, budget, risk-selected and compressed context view from memory/evidence/state |
| PolicyBundle | Single authoritative version object of executable policy in Control Plane |
| Governance Memory | Governance experience, failure patterns, policy proposals, eval cases, cannot replace PolicyBundle |
| Release Artifact | Version-publishable system object such as prompt, tool schema, policy, workflow, model config, evaluator, sandbox config |
| Harness Lockfile | Immutable dependency lock file for System Artifact Release, used for reproducibility, canary, rollback |
| Durable Outbox | Reliable write buffer recording recoverable events before and after side-effect actions, used to fix receipt write failures |

---

## 5. Core Invariants

These invariants must enter code, tests and review checklist:

1. Model cannot directly execute side-effect tools.
2. Model cannot directly commit L4-L7 Memory.
3. Tool output cannot bypass H3 into Context or Memory.
4. High-risk actions cannot bypass H4 Approval.
5. System Artifact Release cannot bypass EvalReport, Approval and RollbackPlan.
6. Receipt cannot lack `tenantId / traceId / missionId / schemaVersion / timestamp`.
7. PolicyBundle is the sole authoritative source of executable policy.
8. L7 Governance / Experience / Evaluation Memory can only store policy evidence, policy proposal, failure pattern, eval case and release experience; cannot replace PolicyBundle.
9. Evidence is raw evidence; Memory is evidence-derived asset; Context is projection.
10. L1 Active Context Memory is projection output, not authoritative source.
11. Mission Memory cannot replace AuthoritativeTaskStore. Authoritative source for Mission state is `StateCommand / AuthoritativeTaskStore`; Mission Memory is only reusable representation of goals, constraints, decisions, summaries and experience.
12. High-risk side-effect commits must write at least `PrepareReceipt` or durable outbox record before commit.
13. `production_mutation + not_reversible` defaults to critical and defaults to block, unless break-glass.
14. Revoked / expired / quarantined memory must not enter Context Projection.
15. Cross-tenant memory, evidence, trace default to invisible unless explicitly authorized.
16. P0c stage cost / latency can only be advisory; P1 and later can be used as release blocking gate.

---

## 6. Current Codebase Gap Matrix

> Note: This section is not a code fact audit result, but an engineering scan checklist for v1.9. All entries with `MappingConfidence = pending scan confirmation` must be confirmed via repository scan, test run and owner confirmation before entering engineering implementation baseline.

### 6.1 Mapping Status Definitions

| Field | Values | Meaning |
|---|---|---|
| MappingConfidence | scan-confirmed / partially-confirmed / hypothetical-path / pending-scan-confirmation / new-module | Current mapping credibility |
| ImplementationStatus | implemented / partially-implemented / missing / mock / unknown | Current implementation status |
| MigrationMode | wrap / replace / extend / new / remove / keep | Transformation approach |
| VerifyCommandStatus | existing / to_add / TBD | Whether verification command exists |
| ReleaseBlocking | yes / no / conditional | Whether blocking engineering freeze baseline |

### 6.2 Gap Matrix

| Target Capability | Currently Observed Modules (Repository Scan) | MappingConfidence | Current Status | Transformation Approach | Target Convergence Form (Not New Construction Commitment) | Verify Command | VerifyCommandStatus | ReleaseBlocking |
|---|---|---:|---|---|---|---|---|---|
| Tool execution / registry boundary | `src/platform/five-plane-execution/tool-executor/`, `src/platform/five-plane-orchestration/harness/toolbelt/` | partially-confirmed | partially-implemented | wrap/extend | Add unified gateway facade before existing `tool-executor`, not fork new execution stack | `npm run test:integration` | existing | yes |
| Policy / Approval / Risk | `src/platform/five-plane-control-plane/risk-control/`, `src/platform/five-plane-control-plane/approval-center/`, `src/org-governance/approval-routing/` | partially-confirmed | partially-implemented | extend | Extend existing risk control/approval implementation with unified governance hook, not create parallel control plane | `npm run test:integration` | existing | yes |
| Event Bus / Outbox / Receipt | `src/platform/five-plane-state-evidence/events/`, `src/platform/shared/outbox/`, `src/platform/five-plane-state-evidence/side-effect-ledger/` | partially-confirmed | partially-implemented | extend | Converge existing event/outbox/ledger as receipt contract, not create new receipt subsystem | `npm run test:integration` | existing | yes |
| Task Store / Truth | `src/platform/five-plane-state-evidence/truth/` | scan-confirmed | partially-implemented | extend | Solidify authoritative task semantics within truth/repository, not copy second state source | `npm run test:integration` | existing | yes |
| Memory governance | `src/platform/five-plane-state-evidence/memory/`, `src/platform/five-plane-orchestration/harness/memory-manager.ts` | scan-confirmed | partially-implemented | facade wrap | Converge memory plane via adapter/facade, not create independent memory-gateway package | `npm run test:integration` | existing | yes |
| Release / Rollout gate | `src/platform/shared/stability/stable-release-gate.ts`, `src/platform/five-plane-control-plane/config-center/`, `src/sdk/cli/release-pipeline.ts` | partially-confirmed | partially-implemented | extend | Extend existing stability/release chain with release-gate contract, not copy second release controller | `npm run gate:stable` | existing | yes |
| Evaluation / Harness grading | `src/platform/five-plane-orchestration/harness/evaluation/`, `src/platform/five-plane-orchestration/harness/eval-harness/` | scan-confirmed | partially-implemented | extend | Converge existing harness evaluation path, no additional independent eval stack | `AA_VALIDATION_ITERATIONS=2 npm run validate:stable:compiled` | existing | conditional |
| Observability | `src/platform/shared/observability/`, `src/platform/shared/stability/` | scan-confirmed | partially-implemented | extend | Extend existing observability with agent trace dimension, not create parallel metrics/logging plane | `npm run observability:smoke` | existing | conditional |
| Sandbox / execution guard | `src/platform/five-plane-execution/tool-executor/command-security.ts`, `src/platform/five-plane-execution/tool-executor/tool-path-scope.ts`, `src/platform/five-plane-orchestration/harness/sandbox/` | partially-confirmed | partially-implemented | new abstraction | Extract shared sandbox contract; only split new directory when existing implementation cannot accommodate | `npm run test:integration` | existing | no |
| Interface Console / Approval UI | `src/platform/five-plane-interface/console/`, `src/platform/five-plane-interface/api/http-server/approval-routes.ts`, `ui/packages/features/approval/` | scan-confirmed | partially-implemented | extend | Prioritize extending existing console/API/UI chain, not build another admin console in parallel | `npm run test:e2e` | existing | conditional |
| CI boundary scan | `scripts/ci/`, `.github/workflows/` | scan-confirmed | partially-implemented | new | `scripts/architecture-boundary-scan.mjs` | `npm run lint:architecture-boundary` | existing | yes |

### 6.2.1 Implementation Interpretation Rules

1. `Target convergence form` is the direction of responsibility convergence, not a physical directory name that must be newly created.
2. If existing modules can achieve goals through facade, adapter, contract tightening, default to prohibiting creation of parallel subsystems.
3. Only when scan results prove existing boundaries cannot accommodate, and ADR explicitly explains reuse failure reasons, allow splitting new physical modules.
4. Reviews, scheduling, TODOs, test commands all prioritize binding to currently existing implementations in repository, then gradually abstract unified entry points.

### 6.3 Required Real Scan Output

Must be generated before engineering freeze:

```text
docs_zh/reviews/current-codebase-gap-review-v1.9.md
```

Current repository has added auto-scan artifacts:

```text
docs_zh/reviews/current-codebase-gap-review-v1.9.md
artifacts/current-codebase-gap-review-v1.9.json
```

`scan:current-codebase-gap` has been implemented; these two artifacts are locally reproducible. They have not yet entered CI workflow, so still block engineering baseline.

This review document must at least contain:

1. Real directory tree and module list.
2. Current Tool / Policy / Memory / Event / Release / Evaluation / Observability implementation status.
3. All direct tool import, direct memory write, direct release publish code locations.
4. Currently existing test/lint/build commands in package.json.
5. Current test coverage and missing P0 gate tests.
6. Transformation risks, owners, estimated effort.

### 6.4 Current Codebase Gap Review Output Template

Real repository scan report must be reproducible artifact, not manual verbal confirmation. Recommended to be generated by `npm run scan:current-codebase-gap` as Markdown + JSON两份结果:

```text
docs_zh/reviews/current-codebase-gap-review-v1.9.md
artifacts/current-codebase-gap-review-v1.9.json
```

JSON minimum structure:

```ts
export interface CodebaseGapReviewItem {
  capability: string;
  expectedPath: string;
  actualPaths: string[];
  implementationStatus: "implemented" | "partial" | "missing" | "mock" | "unknown";
  directBypassLocations: string[];
  testFiles: string[];
  packageScripts: string[];
  migrationMode: "wrap" | "replace" | "extend" | "new" | "remove" | "keep";
  migrationRisk: "low" | "medium" | "high" | "critical";
  estimatedEffort: "S" | "M" | "L" | "XL";
  ownerName?: string;
  reviewer?: string;
}
```

Scan must cover at least:

1. `src/`, `tests/`, `ui/`, `scripts/`, `.github/`, `package.json`.
2. Direct tool import / direct memory write / release bypass / policy bypass.
3. Currently existing event bus, task store, memory, tool, policy, observability, release, evaluation modules.
4. Current test commands, coverage commands, E2E commands, and CI workflow.
5. Whether code paths and test paths corresponding to P0 TODOs exist.

**Baseline Freeze Rule:** If `MappingConfidence` is still `pending scan confirmation`, that capability must not enter engineering freeze baseline, can only enter scheduling as a TODO item.

---

## 7. CI Command Contract

### 7.1 Command Status Definitions

| Status | Meaning | Handling |
|---|---|---|
| existing | Currently exists in repository (may be aggregate command) | Can directly serve as review version acceptance command; should converge to dedicated script before engineering freeze |
| to_add | Not confirmed to exist currently, required to be added in v1.9 | Corresponding TODO must create script and test collection |
| TBD | Requires scanning repository to confirm | Blocks engineering baseline freeze |

### 7.2 P0 Required Commands

Current repository already has a batch of directly reusable aggregate commands; v1.9 review version first explicitly binds these existing commands, then supplements dedicated scripts by capability plane before engineering freeze.

| Command | Target | Current Status | Corresponding TODO |
|---|---|---|---|
| `npm run test:integration` | Covers receipt / outbox / truth / tool / policy / memory integration capabilities | existing | REC-001,TOOL-001,GOV-001,MEM-001 |
| `npm run test:e2e` | Covers approval / prompt injection / tenant boundary / side-effect flows | existing | GOV-002,GOV-003,UI-001,E2E-001,SEC-001 |
| `npm run gate:stable` | Covers release gate / release package stability gates | existing | REL-001 |
| `AA_VALIDATION_ITERATIONS=2 npm run validate:stable:compiled` | Covers stability validation and eval-style compiled validation | existing | EVAL-001 |
| `npm run prompt-injection:stable` | Covers H1-lite / prompt injection red team baseline | existing | GOV-004,SEC-001 |
| `npm run security:tenant` | Covers cross-tenant and security boundary validation | existing | SEC-001 |
| `npm run observability:smoke` | Covers cost / latency / metrics / diagnostics smoke validation | existing | OBS-001 |
| `npm run lint:architecture-boundary` | Prohibits direct tool import / direct memory write / release bypass | existing | CI-001 |
| `npm run scan:current-codebase-gap` | Generates real code mapping report | existing | DOC-014 |
| `npm run test:receipt-store` | Covers BaseReceiptMinimal / outbox / ledger minimum convergence contract | existing | REC-001 |
| `npm run test:tool-gateway` | Covers ToolGateway shadow / prepare / commit / verify / compensate facade | existing | TOOL-001,TOOL-002 |
| `npm run test:memory-gateway` | Covers MemoryGateway facade, proposal-only, projection | existing | MEM-001 |
| `npm run test:release-gate` | Covers ReleaseManifestDraft facade and stable gate minimum contract | existing | REL-001 |

### 7.3 CI Gate Principles

1. `to_add` commands must enter `package.json` or CI workflow before engineering baseline freeze.
2. `TBD` commands must not serve as passing items on release checklist.
3. Before P0b enforce, `lint:architecture-boundary` must at least detect bypass but may not fail build.
4. After P0c, P0 blocking gate bypass must fail build.

### 7.4 package.json Script Contract

Current repository already has aggregate commands like `test:integration`, `test:e2e`, `gate:stable`, `validate:stable:compiled`, `prompt-injection:stable`, `security:tenant`, `observability:smoke`, and has supplemented four dedicated scripts: `test:receipt-store`, `test:tool-gateway`, `test:memory-gateway`, `test:release-gate`. Note: these script names are acceptance contracts, minimum real test collection wrapping is allowed, but empty shell scripts are not allowed.

```json
{
  "scripts": {
    "scan:current-codebase-gap": "node scripts/scan-current-codebase-gap.mjs",
    "lint:architecture-boundary": "node scripts/architecture-boundary-scan.mjs",
    "test:receipt-store": "node --import tsx --test tests/unit/platform/state-evidence/receipts/index.test.ts",
    "test:tool-gateway": "node --import tsx --test tests/unit/platform/execution/tool-gateway/index.test.ts",
    "test:policy-gate": "node --test tests/unit/platform/control-plane/governance-hooks tests/integration/platform/control-plane/governance-hooks",
    "test:memory-gateway": "node --import tsx --test tests/unit/platform/state-evidence/memory-gateway/index.test.ts",
    "test:release-gate": "node --import tsx --test tests/unit/platform/shared/stability/release-gate-facade.test.ts tests/unit/platform/shared/stability/stable-release-gate.test.ts tests/unit/platform/stability/stable-release-gate.test.ts",
    "test:evaluation-gate": "node --test tests/unit/platform/orchestration/harness/evaluation tests/integration/platform/orchestration/harness",
    "test:security-agent-harness": "node --test tests/integration/platform/security tests/e2e/prompt-injection-guard.test.ts",
    "test:e2e:harness-p0b": "node --test tests/e2e/approval-flows.test.ts tests/e2e/webhook-outbox-dispatch.test.ts"
  }
}
```

Script output requirements:

| Script | P0a Output | P0b/P0c Output | Empty Implementation Allowed |
|---|---|---|---|
| `scan:current-codebase-gap` | gap report | gap report + blocking summary | Not allowed |
| `lint:architecture-boundary` | detect-only report | fail high-risk bypass | Not allowed |
| `test:receipt-store` | minimal receipt tests | full receipt + outbox tests | Not allowed |
| `test:tool-gateway` | shadow adapter tests | prepare/commit/compensate tests | Not allowed |
| `test:security-agent-harness` | sample suite exists | high-risk samples blocking | Not allowed |

Using "script exists but does not execute real assertions" to satisfy acceptance is prohibited.

---

## 8. Minimal P0 Contract

### 8.1 P0a-0 Document Freeze Contract

Following interface drafts must be frozen:

```text
HarnessCapabilityDomain
ArchitecturePlane
BaseReceiptMinimal
ToolGatewayShadow
PolicyDryRunDecision
MemoryProposal
ReleaseManifestDraft
ActionRiskInput
```

### 8.2 BaseReceiptMinimal

```ts
export interface BaseReceiptMinimal {
  receiptId: string;
  schemaVersion: string;
  tenantId: string;
  missionId: string;
  sessionId?: string;
  taskId?: string;
  traceId: string;
  actorId: string;
  actionType: string;
  status: "success" | "failed" | "blocked" | "requires_approval" | "prepared" | "committed";
  timestamp: string;
  inputHash?: string;
  outputHash?: string;
  evidenceIds: string[];
}
```

### 8.3 BaseReceiptFull

```ts
export interface BaseReceiptFull extends BaseReceiptMinimal {
  parentReceiptId?: string;
  causalityId: string;
  eventSequence: number;

  canonicalizationVersion: string;
  hashAlgorithm: "sha256";

  capability: HarnessCapabilityDomain;
  plane: ArchitecturePlane;

  policyBundleVersion?: string;
  approvalPolicyId?: string;
  approvalId?: string;
  leaseId?: string;
  fencingToken?: string;
  idempotencyKey?: string;

  redactedPayloadRef?: string;
  payloadEncryptionKeyRef?: string;
  accessPolicyId: string;
  retentionPolicyId: string;

  replaySafety: "safe_to_replay" | "replay_with_mock_only" | "not_replayable";
}
```

### 8.4 PolicyDryRunDecision

```ts
export interface PolicyDryRunDecision {
  decisionId: string;
  traceId: string;
  missionId: string;
  tenantId: string;
  actorId: string;
  action: string;
  finalRisk: RiskLevel;
  wouldAllow: boolean;
  wouldRequireApproval: boolean;
  blockingReasons: string[];
  advisoryWarnings: string[];
  policyBundleVersion: string;
}
```

### 8.5 ReleaseManifestDraft

```ts
export interface ReleaseManifestDraft {
  releaseId: string;
  artifactType: "agent" | "workflow" | "prompt" | "tool" | "policy" | "model" | "evaluator" | "sandbox_config" | "memory_schema";
  artifactId: string;
  artifactVersion: string;
  dependencies: Record<string, string>;
  evalReportId?: string;
  rollbackPlanId?: string;
  createdBy: string;
  createdAt: string;
}
```

---

## 9. Rollout Mode Transition Criteria

### 9.1 Rollout Mode Definitions

| Mode | Meaning | Blocking |
|---|---|---|
| shadow | New chain bypass observation, does not affect original execution | No |
| dry-run | New chain produces decisions but only alerts, does not block | No |
| enforce | New chain formally blocks non-compliant actions | Yes |
| fail-closed | When new chain unavailable, defaults to reject high-risk actions | Yes, high-risk defaults to reject |

### 9.2 Transition Criteria

| Gate | Shadow → Dry-run | Dry-run → Enforce | Enforce → Fail-closed |
|---|---|---|---|
| ToolGateway | 100% tool calls have shadow receipt | high-risk tool dry-run 7 days with no missed blocks; false positive < 2% | high/critical tool policy/approval/evidence fully covered |
| H1-lite | 100% external input marked trust tier | Basic injection sample detection rate ≥ 90%, false positives can be manually released | high-risk untrusted input cannot bypass H1-lite |
| Policy Gate | 100% action has dry-run decision | high/critical missed blocks 0; false positive < 2% | high/critical defaults to reject when policy service unavailable |
| Memory Gate | L4-L7 direct write 100% discoverable | L4-L7 proposal path 100% covered | direct write blocked by runtime and CI dual blocking |
| Release Gate | 100% release generates manifest draft | prod release 100% has eval report + rollback plan | production release prohibited when release gate unavailable |
| Receipt | 100% key actions generate minimal receipt | high-risk actions have prepare/commit receipt | high-risk commit prohibited when receipt/outbox unavailable |

---

## 10. Unified Risk Model and Action Risk Resolution Matrix

### 10.1 Input Dimensions

```ts
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type SideEffectLevel = "none" | "read_only" | "write_internal" | "write_external" | "production_mutation";
export type DataSensitivity = "public" | "internal" | "confidential" | "restricted";
export type TargetEnvironment = "local" | "dev" | "staging" | "prod";
export type ApprovalLevel = "none" | "single_reviewer" | "team_lead" | "security_admin" | "multi_party" | "break_glass";
export type Reversibility = "automatic_rollback" | "manual_repair" | "forward_fix_only" | "not_reversible";
```

### 10.2 finalRisk Calculation Rules

```text
finalRisk = max(
  modelRisk,
  toolRisk,
  dataRisk,
  environmentRisk,
  sideEffectRisk,
  policyRisk,
  reversibilityRisk,
  confidenceRisk
)
```

If any dimension is `critical`, final risk must not be lower than `critical`. If any dimension is `restricted data + prod + write_external/production_mutation`, final risk must not be lower than `critical`.

### 10.3 Action Risk Resolution Matrix

| sideEffectLevel | dataSensitivity | targetEnv | reversibility | Default riskLevel | Default Gate |
|---|---|---|---|---|---|
| none | public/internal | local/dev | N/A | low | H1/H2-lite + receipt |
| read_only | internal | dev/staging | N/A | low/medium | H2 + receipt |
| read_only | confidential | prod | N/A | medium | H2 + access policy + receipt |
| write_internal | internal | staging | automatic_rollback | medium | H2 + idempotency + receipt |
| write_internal | confidential | prod | automatic_rollback/manual_repair | high | H2 + H4 + prepare/commit |
| write_external | confidential | prod | manual_repair/forward_fix_only | high/critical | H2 + H4 + approval + rollback/repair owner |
| production_mutation | any | prod | automatic_rollback | critical | H2 + H4 + multi-party approval + prepare/commit/verify |
| production_mutation | any | prod | not_reversible | critical | default block; break-glass only |
| any write | restricted | prod | any | critical | default block; security admin / multi-party |

### 10.4 Tool Reversibility Risk Rules

| reversibility | high-risk prod auto-execute policy |
|---|---|
| automatic_rollback | Can execute after approval, must register rollback plan |
| manual_repair | Must have H4 + repair owner + repair runbook |
| forward_fix_only | critical, default not auto-execute; requires multi-party approval |
| not_reversible | default prohibited; break-glass only and must have incident record |

---

## 11. Tool Gateway Detailed Design

### 11.1 Tool Gateway Goals

Tool Gateway is the intersection of Execution Plane and Control Plane, not a common Tool Registry.

Here `Tool Gateway` is a logical convergence layer. Priority implementation should add unified entry and contract on top of existing `tool-executor`, `toolbelt`, risk control and approval chains, not immediately copy out a second execution subsystem.

It must uniformly handle:

```text
tool schema validation
permission check
policy check
approval check
risk resolution
idempotency
lease / fencing
prepare / commit / verify
compensation / rollback
trace capture
evidence and receipt write
mock / replay
cost / latency accounting
```

### 11.2 Call Chain

```text
Agent / Planner proposes action
→ H2 Action Gate
→ ToolGateway.prepareToolAction()
→ Schema / Permission / Policy / Risk / Idempotency / Lease
→ H4 Approval if required
→ Durable Outbox / PrepareReceipt
→ ToolGateway.commitToolAction()
→ Tool execution
→ ToolGateway.verifyToolAction()
→ H3 Observation Gate
→ CommitReceipt / Evidence / Trace
→ Compensation or rollback if needed
```

### 11.3 Prepare / Commit / Verify / Compensate Interfaces

```ts
export interface ToolPrepareInput {
  missionId: string;
  sessionId?: string;
  taskId?: string;
  tenantId: string;
  actorId: string;
  toolName: string;
  toolVersion?: string;
  arguments: unknown;
  sideEffectLevel: SideEffectLevel;
  dataSensitivity: DataSensitivity;
  targetEnv: TargetEnvironment;
  proposedBy: "model" | "human" | "system";
}

export interface ToolPrepareResult {
  preparedActionId: string;
  status: "prepared" | "blocked" | "requires_approval";
  finalRisk: RiskLevel;
  requiredApprovalId?: string;
  idempotencyKey: string;
  leaseId?: string;
  fencingToken?: string;
  estimatedBlastRadius: "none" | "low" | "medium" | "high" | "critical";
  compensationPlanId?: string;
  receiptId: string;
}

export interface ToolCommitInput {
  preparedActionId: string;
  approvalId?: string;
  fencingToken?: string;
  idempotencyKey: string;
}

export interface ToolCommitResult {
  status: "committed" | "failed" | "partial" | "blocked";
  output?: unknown;
  receiptId: string;
  evidenceIds: string[];
  compensationRequired: boolean;
}

export interface ToolCompensationPlan {
  compensationPlanId: string;
  preparedActionId: string;
  supported: boolean;
  compensationType: "automatic_rollback" | "manual_repair" | "forward_fix_only" | "not_reversible";
  repairOwner?: string;
  requiredEvidenceIds: string[];
  runbookRef?: string;
}
```

### 11.4 ToolRiskMetadata Required Contract

All tools callable by Agent must declare risk metadata. Tools missing risk metadata can only appear in shadow / dry-run, not allowed to enter production enforce.

```ts
export interface ToolRiskMetadata {
  toolName: string;
  toolVersion: string;
  sideEffectLevel: SideEffectLevel;
  targetEnvironments: TargetEnvironment[];
  allowedDataSensitivity: DataSensitivity[];
  reversibility: "automatic_rollback" | "manual_repair" | "forward_fix_only" | "not_reversible";
  rollbackPlanRequired: boolean;
  compensationSupported: boolean;
  defaultApprovalLevel: "none" | "single_human" | "two_person" | "security_admin" | "break_glass_only";
  replaySafety: "safe_to_replay" | "replay_with_mock_only" | "not_replayable";
  idempotencyRequired: boolean;
  leaseRequired: boolean;
  networkAccess: "none" | "internal_only" | "external";
  secretAccess: "none" | "scoped" | "privileged";
}
```

Risk decision rules:

| Condition | Default Handling |
|---|---|
| `production_mutation + not_reversible` | `critical`, default block, unless break-glass |
| `write_external + forward_fix_only` | `high/critical`, must have H4 + manual approval |
| `secretAccess = privileged` | at least `high`, must have minimum privilege token + audit |
| `replaySafety = not_replayable` | prohibited automatic replay, only mock replay / manual repair allowed |
| Missing ToolRiskMetadata | prohibited from production execution |

### 11.5 Partial Failure Handling

| Status | Handling |
|---|---|
| prepare failed | do not execute side effect, write PrepareReceipt failed |
| approval denied | do not execute side effect, write ApprovalReceipt denied |
| commit partial | write PartialCommitReceipt, enter repair queue |
| commit success but verify failed | write VerifyReceipt failed, trigger compensation / manual repair |
| side-effect occurred but commit receipt missing | repair via durable outbox / commit journal |
| compensation failed | escalate incident, enter manual repair |

### 11.6 Durable Outbox / Commit Journal

High-risk side effect execution sequence must be:

```text
write PrepareReceipt or DurableOutboxRecord
→ commit side effect
→ write CommitReceipt
→ verify side effect
→ write VerifyReceipt
→ repair if any receipt missing
```

Not allowed:

```text
commit side effect
→ best effort write receipt
```

Otherwise, unacceptable state occurs where side effect has occurred but no record exists in State & Evidence Plane.

### 11.7 Transactional Outbox Transaction Boundary

P0b defaults to transactional outbox, not best-effort log.

**Mandatory sequence:**

```text
BEGIN TRANSACTION
  write StateCommand(preparing)
  write PrepareReceipt or DurableOutboxRecord
COMMIT
commit external side effect with idempotencyKey
BEGIN TRANSACTION
  write CommitReceipt
  update StateCommand(committed)
COMMIT
verify side effect
write VerifyReceipt
```

Exception handling:

| Exception | Handling |
|---|---|
| PrepareReceipt / outbox write failed | prohibit high-risk commit |
| External side effect commit timeout | query final state using idempotencyKey, prohibit blind retry |
| CommitReceipt write failed | repair worker rebuilds from outbox |
| verify failed | enter rollback / manual repair per ToolCompensationPlan |
| State Store unavailable | fail closed; critical break-glass needs local durable emergency log |

Repair worker idempotent key: `tenantId + preparedActionId + idempotencyKey + toolVersion`.

---

## 12. Governance Hooks and Trust Tier

### 12.1 H1/H2/H3/H4 Definitions

| Hook | Location | Responsibility | P0/P1 Strategy |
|---|---|---|---|
| H1 Input Gate | Before input enters model | untrusted input marking, basic injection detection, sensitive info identification | H1-lite enters P0b/P0c; H1-full P1 |
| H2 Action Gate | After model proposes action, before execution | tool permissions, parameters, policy, risk, approval judgment | P0b enforce high-risk |
| H3 Observation Gate | Before tool output enters context/memory | redaction, quarantine, untrusted label, summarize-only | P0b/P0c enforce untrusted output |
| H4 Approval Gate | Before high-risk side effect commit | human approval, multi-party approval, break-glass | P0b enforce critical/high |

### 12.2 Trust Tier

| Source | Default Trust Tier | Gate |
|---|---|---|
| User input | untrusted | H1-lite |
| External web page / PDF / paper / retrieval results | untrusted | H1-lite + H3 when re-entering context |
| Third-party tool output | untrusted | H3 |
| Internal read-only structured system | controlled | H3-lite + schema validation |
| Control Plane policy decision | trusted-control | receipt, no H1/H3 needed |
| State & Evidence authoritative state | trusted-state | access policy + receipt |
| Human approved release artifact | trusted-artifact | ReleaseGate + audit |

### 12.3 ObservationGateDecision

```ts
export type ObservationGateDecision =
  | "allow"
  | "allow_with_redaction"
  | "allow_with_untrusted_label"
  | "summarize_only"
  | "quarantine"
  | "block";
```

H3 should not be only allow/block. For research, code, log scenarios, `allow_with_untrusted_label` and `summarize_only` are very important, reducing false positives.

### 12.4 H1-lite Minimum Test Set

After H1-lite enters P0b/P0c, must have runnable sample set. Recommended directory:

```text
tests/integration/platform/security/h1-lite/
├── prompt-injection.md
├── tool-injection.md
├── retrieved-doc-injection.md
├── pdf-injection.md
├── log-injection.md
├── code-comment-injection.md
└── benign-samples.md
```

Minimum coverage:

| Sample Type | Target | P0 Threshold |
|---|---|---:|
| User input injection | mark untrusted / risk | ≥ 90% detection |
| Retrieved content injection | prohibited from executing as system instruction | 100% not executed |
| PDF / paper injection | handled as citation content only | 100% marked untrusted |
| Log injection | not allowed to trigger tool actions | 100% not executed |
| benign samples | control false positive | false positive ≤ 10% initial, P1 continue calibration |

H1-lite output is not simple block, but generates `InputTrustLabel`:

```ts
export interface InputTrustLabel {
  sourceId: string;
  trustTier: "untrusted" | "controlled" | "trusted-state";
  detectedRisks: string[];
  allowedUse: "quote_only" | "summarize_only" | "context_with_label" | "block";
  receiptId: string;
}
```

---

## 13. Seven-layer Memory Gateway Revised

The `Memory Gateway` in this section is a governance facade, not requiring a newly independent package name first. Priority approach is to supplement proposal/projection/revoke contract on existing memory plane, memory manager, retrieval/projection paths.

### 13.1 Seven-layer Memory

| Layer | Name | Purpose | Write Policy |
|---|---|---|---|
| L1 | Active Context Memory | Context projection seen by current model call | Dynamically generated by Context Builder, not as source |
| L2 | Task Working Memory | Temporary working state within single task | Can write automatically, must trace |
| L3 | Session Memory | Context continuity within one session | Can auto-maintain, session scope |
| L4 | Mission Memory | Mission goals, constraints, key decision summaries | Model can only propose, cannot overwrite AuthoritativeTaskStore |
| L5 | Project / Domain Memory | Project knowledge, domain knowledge, technical conclusions, business rules | Requires evidence, version, conflict check |
| L6 | User / Team Preference Memory | User preferences, team norms, workflow habits | Requires privacy, permissions, view/delete |
| L7 | Governance / Experience / Evaluation Memory | Failure patterns, eval cases, policy proposals, release experience | Cannot replace PolicyBundle, requires Release/Eval constraints |

### 13.2 Memory / Policy / Evidence / Context Boundaries

| Object | Belongs | Authoritative | Description |
|---|---|---|---|
| Evidence | State & Evidence Plane | Raw evidence authority | Tool results, trace, logs, files, evaluation outputs |
| AuthoritativeTaskStore | State & Evidence Plane | mission/task state authority | StateCommand and task state source of truth |
| Memory | State & Evidence Plane + Memory Gateway | Derived knowledge source | Usable within its scope, version, status, evidence and policy allowances; cannot overwrite Evidence, PolicyBundle or Authoritative State |
| Context | Orchestration Plane | Non-authoritative | Current model call projection |
| PolicyBundle | Control Plane | Policy authority | Sole source of executable policy |

### 13.3 ManagedMemoryMinimal

```ts
export interface ManagedMemoryMinimal {
  memoryId: string;
  layer: "L1" | "L2" | "L3" | "L4" | "L5" | "L6" | "L7";
  tenantId: string;
  scope: "task" | "session" | "mission" | "project" | "domain" | "user" | "team" | "organization" | "governance";
  status: "proposed" | "active" | "quarantined" | "revoked" | "expired" | "superseded";
  subject: string;
  contentRef: string;
  sourceEvidenceIds: string[];
  sourceTraceIds: string[];
  confidence: number;
  sensitivity: DataSensitivity;
  createdBy: "model" | "human" | "system";
  approvedBy?: string;
  validFrom: string;
  validUntil?: string;
  version: number;
  supersedes?: string[];
  conflictSet?: string[];
  accessPolicyId: string;
  retentionPolicyId: string;
}
```

### 13.4 MemoryProposal / Commit / Revoke

```ts
export interface MemoryProposal {
  proposalId: string;
  missionId: string;
  tenantId: string;
  actorId: string;
  proposedLayer: ManagedMemoryMinimal["layer"];
  proposedScope: ManagedMemoryMinimal["scope"];
  contentRef: string;
  sourceEvidenceIds: string[];
  sourceTraceIds: string[];
  confidence: number;
  sensitivity: DataSensitivity;
  rationale: string;
}

export interface MemoryCommitDecision {
  decisionId: string;
  proposalId: string;
  decision: "approve" | "reject" | "quarantine" | "require_more_evidence";
  committedMemoryId?: string;
  approvalId?: string;
  reasons: string[];
}

export interface MemoryRevokeDecision {
  decisionId: string;
  memoryId: string;
  decision: "revoke" | "expire" | "supersede" | "keep_active";
  reason: string;
  projectionInvalidationRequired: boolean;
  indexInvalidationRequired: boolean;
}
```

### 13.5 MemoryProjection

```ts
export interface MemoryProjection {
  projectionId: string;
  missionId: string;
  sessionId?: string;
  taskId?: string;
  tenantId: string;
  allowedLayers: ManagedMemoryMinimal["layer"][];
  memoryIds: string[];
  evidenceIds: string[];
  tokenBudget: number;
  redactionApplied: boolean;
  projectionHash: string;
  createdAt: string;
}
```

### 13.6 Memory Resolution Rules

Do not use single global read order. Resolve by conflict type:

| Conflict Type | Priority |
|---|---|
| Security / Compliance / Permission | Control Plane PolicyBundle is sole executable authority; L7 only provides evidence and candidates |
| Mission state | AuthoritativeTaskStore > L4 Mission Memory > L3 Session > L2 Task |
| Project / Domain facts | L5 Project / Domain > L3 Session > L2 Task |
| User / Team preferences | L6 only affects format, style, workflow preferences, cannot overwrite L5 facts or PolicyBundle |
| Current task temporary hypothesis | L2 only as hypothesis, cannot overwrite L4/L5 |
| Model context | L1 is projection output, not source |

### 13.7 Memory Flow

```mermaid
flowchart LR
    E[Evidence / Trace / Tool Result / Human Feedback] --> P[MemoryProposal]
    P --> C{MemoryCommitDecision}
    C -- approve --> M[ManagedMemory active]
    C -- quarantine --> Q[Quarantine]
    C -- reject --> R[Rejected]
    M --> IDX[Memory Index]
    M --> PROJ[Context Projection]
    PROJ --> LLM[Model Context]
    M --> REV{Revoke / Expire / Supersede}
    REV --> INV[Index + Projection Invalidation]
```

---

## 14. Release Gate and Harness Lockfile

The `Release Gate` in this section is the release governance capability name, not requiring copying current `stable-release-gate` or `release-pipeline`. Default strategy is to converge unified contract on existing stability gates, config release, CLI release paths.

### 14.1 AgentReleaseManifest / Harness Lockfile

```yaml
releaseId: agent-release-2026-05-26-001
artifactType: agent
agentVersion: v1.9.0
promptVersion: prompt-2026-05-21
modelConfigVersion: modelcfg-2026-05-20
toolRegistryVersion: tools-2026-05-23
policyBundleVersion: policy-2026-05-24
workflowVersion: workflow-2026-05-22
contextBuilderVersion: ctx-2026-05-19
memorySchemaVersion: mem-2026-05-26
evaluatorVersion: eval-2026-05-25
sandboxConfigVersion: sandbox-2026-05-18
evalDatasetVersion: evalset-2026-05-25
rollbackTarget: agent-release-2026-05-20-003
canonicalizationVersion: manifest-canon-v1
hashAlgorithm: sha256
hash: sha256:...
```

### 14.2 Canonical Serialization Spec

ReleaseManifest hash must be reproducible:

1. All keys sorted in lexicographic order.
2. Time uses ISO-8601 UTC.
3. Empty fields not participating in hash.
4. Arrays sorted with stable sorting rules.
5. All dependency versions use immutable version id or digest.
6. canonicalizationVersion change must trigger manifest rehash.

### 14.3 Release Gate Checks

| Check Item | P0c | P1 |
|---|---|---|
| Manifest integrity | blocking | blocking |
| EvalReportId | blocking | blocking |
| RollbackPlanId | blocking | blocking |
| Policy compatibility | blocking | blocking |
| Tool schema compatibility | blocking | blocking |
| Security eval | blocking for high/critical | blocking |
| Cost/Latency | advisory | blocking when budget defined |
| Canary plan | advisory | blocking for production |
| Human approval | high/critical blocking | high/critical blocking |

---

## 15. Evaluation Dataset and Metric Design

### 15.1 Eval Set Types

| Eval Set | Purpose | P0/P1 |
|---|---|---|
| Golden Tasks | Regression stability | P0c-lite |
| Adversarial Tasks | prompt/tool/memory injection | P0c-lite |
| Long-horizon Tasks | context drift, memory, lifecycle | P1 |
| Business Scenario Tasks | research, code, test, experiment, YONO | P0c/P1 build per scenario |

### 15.2 Trajectory Rubric

| Dimension | Score | high/critical must achieve perfect score |
|---|---:|---|
| Tool selection correctness | 5 | No |
| Tool argument correctness | 5 | No |
| Policy compliance | 5 | Yes |
| Approval compliance | 5 | Yes |
| Evidence usage | 5 | Key tasks ≥ 4 |
| Context usage | 5 | No |
| Cost / latency discipline | 5 | P0c advisory, P1 can be blocking |
| Final task success | 5 | Defined per scenario |
| Total | 40 | high/critical minimum 34, and policy/approval must be perfect |

### 15.3 Release Blocking Threshold

| Scenario | Golden Success | Security | Trajectory | Evidence Usage | Cost / Latency |
|---|---:|---:|---:|---:|---:|
| Paper Research Agent | not lower than baseline - 3% | injection sample blocking rate 100% | ≥ 32/40 | ≥ 4/5 | P0c advisory; P1 P95 not exceed 20% |
| Code Review Agent | not lower than baseline - 2% | dangerous command blocking rate 100% | ≥ 34/40 | ≥ 3/5 | P0c advisory; P1 P95 not exceed 20% |
| Test Failure Analysis Agent | not lower than baseline - 3% | log injection blocking rate 100% | ≥ 32/40 | ≥ 4/5 | P0c advisory; P1 P95 not exceed 20% |
| High-risk tool action | policy/approval failure not allowed | 100% | policy/approval must be perfect | N/A | N/A |
| System Artifact Release | not lower than baseline - threshold | security blocking must pass | critical path not degraded | eval report must reference evidence | P0c advisory; P1 can be blocking |

### 15.4 LLM Judge Calibration

1. LLM judge cannot alone serve as sole basis for high/critical blocking.
2. high/critical scenarios must have rule-based evaluator or human review.
3. When LLM judge and human agreement rate is below 80%, cannot serve as blocking evaluator.
4. Each evaluator must have version, prompt/config, sample audit record.

### 15.5 Baseline Calibration Protocol

Thresholds in 15.3 are **initial threshold**, cannot be directly used as long-term production threshold without calibration. Before first entering engineering baseline, must complete baseline eval run:

1. Select a frozen Harness Lockfile as baseline.
2. Each first scenario at least prepare: Golden ≥ 50, Adversarial ≥ 30, Benign ≥ 30, Long-horizon ≥ 10.
3. Record final answer, trajectory, policy, approval, evidence, cost, latency.
4. LLM judge must sample human review; agreement rate below 80% cannot serve as blocking evaluator.
5. Calibrated thresholds written to `EvalThresholdVersion`, referenced by Release Gate.

```ts
export interface EvalThresholdVersion {
  thresholdVersion: string;
  scenario: string;
  baselineReleaseId: string;
  evalDatasetVersion: string;
  goldenMinSuccessDelta: number;
  trajectoryMinScore: number;
  securityRequiredPassRate: number;
  evidenceMinScore?: number;
  costLatencyMode: "advisory" | "blocking";
  approvedBy: string;
}
```

### 15.6 Eval Dataset Version Management

Eval dataset must be versioned, must not use "current directory content" as implicit release basis.

```text
evals/
├── golden/
├── adversarial/
├── long-horizon/
├── business-scenarios/
└── evalset.lock.yaml
```

`evalset.lock.yaml` at least records sample count, hash, owner, reviewer, applicable scenario, whether blocking.

---

## 16. Security & Privacy Baseline

### 16.1 Data and Keys

| Item | Requirements |
|---|---|
| Secret handling | secret must not enter model context; tools only get minimum privilege token |
| PII / sensitive data | before entering context, perform redaction or access check per sensitivity |
| payload encryption | restricted payload must have `payloadEncryptionKeyRef` |
| restricted evidence access | requires `accessPolicyId` and audit receipt |
| cross-tenant isolation | default deny; fail closed when tenantId missing |

### 16.2 Memory Privacy

| Memory Layer | Privacy Requirements |
|---|---|
| L5 Project / Domain | requires project/team ACL, supports retention policy |
| L6 User / Team Preference | user can view, modify, delete; sensitive preferences must not be cross-task abused |
| L7 Governance / Evaluation | can be used for system improvement, must not leak original tenant data |

### 16.3 Export / Delete / Revoke

Must support:

```text
memory export
memory delete / revoke
trace/evidence retention policy
audit log retention
index invalidation
projection rebuild
```

### 16.4 Break-glass

Production emergency scenarios allow break-glass, but must satisfy:

1. Only authorized roles can trigger.
2. Must fill in reason.
3. Must generate BreakGlassReceipt.
4. Must enter Incident Review afterwards.
5. break-glass must not bypass trace/evidence write.

### 16.5 Security Gate Component Implementation

Security & Privacy Baseline must be implemented as testable components, should not just retain principles.

| Component | Stage | Responsibility | Acceptance |
|---|---|---|---|
| SecretScanner | P0c | Prevent secret from entering context / memory / evidence display layer | secret sample 100% redacted |
| PIIRedactor | P0c/P1 | Perform redaction / masking on PII and sensitive fields | P0 sample set passed, P1 connect real schema |
| TenantIsolationGuard | P0b/P0c | tenantId missing fail closed, cross-tenant access prohibited | cross-tenant adversarial tests 0 leakage |
| EvidenceAccessPolicy | P0c | restricted evidence access must validate accessPolicyId | restricted trace access 100% receipt |
| RetentionPolicyEnforcer | P1 | trace/evidence/memory expiration handling | retention test + audit log |
| MemoryExportDeleteWorkflow | P1 | L6/L5 memory view, export, delete, revoke | user/team scope tests |

Starting P0c, restricted payload must not directly enter model context; can only enter redacted projection or quote-only projection.

---

## 17. Interface Plane Control Console RBAC / Audit Matrix

| Console | Operation | Allowed Roles | Second Approval | Receipt |
|---|---|---|---|---|
| Approval Console | Approve high-risk tool | Team Lead / Admin | critical requires | ApprovalReceipt |
| Approval Console | Break-glass approve | Security Admin + Release Manager | required | BreakGlassReceipt |
| Memory Review Console | Approve L5/L6/L7 memory | Domain Owner / Team Lead | sensitive requires | MemoryWriteReceipt |
| Memory Review Console | Revoke memory | User / Domain Owner / Admin | critical memory requires | MemoryRevokeReceipt |
| Release Console | Publish PolicyBundle | Policy Admin | required | ReleaseReceipt |
| Release Console | Rollback release | Release Manager | critical requires | ReleaseReceipt |
| Trace Explorer | View restricted trace | Security / Admin | per tenant policy | AuditReceipt |
| Policy Console | Run policy dry-run | Policy Admin / Developer | No | PolicyDecisionReceipt |
| Evaluation Dashboard | Approve eval threshold | Eval Owner | high-risk requires | EvaluationReceipt |
| Incident Console | Close incident | Incident Owner | high/critical requires | IncidentReceipt |

---

## 18. Operational Runbooks

### 18.1 Gate False Positive

```text
1. Mark false_positive candidate.
2. Collect PolicyDecisionReceipt, ActionRiskInput, Trace.
3. Enter Policy Dry-run Review.
4. If false positive confirmed, adjust policy proposal.
5. Policy proposal enters Release Gate, not take effect directly.
```

### 18.2 Memory Contamination

```text
1. Quarantine suspected memory.
2. Revoke projection and index.
3. Find sourceEvidenceIds / sourceTraceIds.
4. Replay affected missions.
5. Generate MemoryContaminationIncident.
6. If necessary, publish MemorySchema/Policy fix version.
```

### 18.3 Release Rollback

```text
1. Release Gate or online monitor triggers rollback.
2. Read Harness Lockfile.
3. Verify rollbackTarget.
4. Execute canary rollback.
5. Monitor golden/security/latency metrics.
6. Generate RollbackReceipt and postmortem.
```

### 18.4 Tool Partial Failure

```text
1. Read PartialCommitReceipt.
2. Find ToolCompensationPlan.
3. If automatic_rollback, execute rollback and verify.
4. If manual_repair, assign repair owner.
5. If forward_fix_only, escalate incident.
6. If not_reversible, escalate critical incident.
```

### 18.5 Receipt / Evidence Write Failure

```text
1. If high-risk action, must have PrepareReceipt or durable outbox record before commit.
2. When CommitReceipt write fails, repair worker rebuilds from outbox / commit journal.
3. If outbox unavailable, prohibit high-risk commit.
4. If side effect occurred but receipt missing, immediately generate IncidentReceipt; if State Store unavailable, write local durable emergency log, supplement after recovery.
```

---

## 19. P0 / P1 / P2 Roadmap

### 19.1 P0a: Read-only Logging and Boundary Scan

| Sub-phase | Content | Goal |
|---|---|---|
| P0a-0 | Document freeze, schema draft, interface contract | Unify team understanding |
| P0a-1 | traceId, missionId, tenantId, BaseReceiptMinimal shadow | Do not change execution behavior |
| P0a-2 | direct tool import, direct memory write, release bypass scan | Discover problems first |
| P0a-3 | ToolGateway shadow, Policy dry-run, Capability coverage | Output gap report |

### 19.2 P0b: Batched Enforcement

| Sub-phase | Content | Goal |
|---|---|---|
| P0b-1 | enforce high-risk tool + H4 approval | High-risk tools cannot bypass approval |
| P0b-2 | enforce L4-L7 memory proposal-only | Long-term memory cannot write directly |
| P0b-3 | enforce production release gate | Production release must have manifest/eval/rollback |
| P0b-4 | enforce H3 for untrusted tool output | Untrusted tool output cannot directly enter context/memory |
| P0b-5 | minimal approval UI/API | Humans can handle H4 approval |

### 19.3 P0c: Closed Loop and Minimal Evaluation

| Content | Goal |
|---|---|
| H1-lite injection detection | Basic injection prevention for external input |
| ReleaseManifest canonical hash | Release reproducible |
| EvalReport minimal | Release has minimum evaluation basis |
| Memory revoke/projection invalidation | Memory contamination can be revoked |
| Security P0 test suite | prompt/tool/memory injection basic samples |
| Receipt/outbox repair worker | High-risk side effects can supplement evidence |

### 19.4 P1: Production Enhancement

| Content | Goal |
|---|---|
| H1-full | Complete input governance |
| SandboxProvider | Risk-adaptive execution environment |
| Trace-native Evaluation | Evaluate trajectory not just final answer |
| Cost/Latency blocking gate | Cost and latency can block release |
| Memory privacy workflows | export/delete/revoke/access review |
| Full Admin Console | Approval/Memory/Release/Trace/Policy/Eval/Incident |

### 19.5 P2: Platform Enhancement

| Content | Goal |
|---|---|
| Harness A/B test | Compare prompt/tool/context/evaluator/sandbox combinations |
| Adaptive Harness Simplification | Reduce excessive governance cost |
| Multi-agent handoff protocol | Agent/tool/human responsibility transfer traceable |
| Cross-tool interoperability | MCP/OpenAPI/internal tool gateway unified testing |
| Automated improvement loop | Feedback → Learn → Improve → Release semi-automatic closed loop |

---

## 20. Canonical TODO List v1.9

> Note: `OwnerName`, `Reviewer`, `TargetStart`, `TargetEnd`, `IssueLink` default to `TBD` in this document, must be filled in during engineering scheduling phase. Team role owner cannot replace real owner.

### 20.1 TODO Field Definitions

| Field | Description |
|---|---|
| ID | Unique Canonical TODO ID |
| Task | Task |
| Priority | P0a/P0b/P0c/P1/P2 |
| TeamOwner | Team role |
| OwnerName | Real responsible party, TBD if undefined |
| Reviewer | Reviewer, TBD if undefined |
| TargetStart / TargetEnd | Planned time, TBD if undefined |
| CodePath | Target code path |
| TestPath | Target test path |
| VerifyCommand | Acceptance command |
| VerifyCommandStatus | existing / to_add / TBD |
| Rollout | shadow / dry-run / enforce / fail-closed |
| Status | completed / implemented / partial / blocked_by_evidence / pending |
| ValidationEvidence | Most recent verifiable evidence or description |
| Blocking | Whether blocking engineering baseline |
| DependsOn | Depends on TODO |
| IssueLink | Task link, TBD if not created |

### 20.2 P0 Blocking TODO

| ID | Task | Priority | TeamOwner | OwnerName | Reviewer | CodePath | TestPath | VerifyCommand | VerifyCommandStatus | Rollout | Status | ValidationEvidence | Blocking | DependsOn | IssueLink |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| DOC-014 | Real repository scan and generate Current Codebase Gap Review | P0a | Architecture | TBD | TBD | `scripts/`, `.github/workflows/`, `package.json` | `tests/invariants/architecture/` | `npm run scan:current-codebase-gap` | existing | shadow | completed | `2026-05-26 npm run scan:current-codebase-gap` generates MD + JSON artifacts | yes | - | TBD |
| DOC-018 | Deduplicate TODO, establish canonical TODO ID and dependencies | P0a | Architecture | TBD | TBD | `docs_zh/reference/` | N/A | `npm run docs:markdown-render` | existing | N/A | completed | Canonical TODO ID converged to single table; `2026-05-26 npm run docs:markdown-render` passed | yes | - | TBD |
| CI-001 | architecture boundary lint: prohibit direct tool import / direct memory write / release bypass | P0a | Platform | TBD | TBD | `scripts/ci/`, `.github/workflows/` | `tests/invariants/architecture/` | `npm run lint:architecture-boundary` | existing | dry-run | completed | `2026-05-26 npm run lint:architecture-boundary` passed; tool/memory/release facade boundary crossings converged to 0 findings | yes | DOC-014 | TBD |
| REC-001 | BaseReceiptMinimal schema + receipt shadow write | P0a | State | TBD | TBD | `src/platform/five-plane-state-evidence/receipts/`, `src/platform/five-plane-state-evidence/side-effect-ledger/`, `src/platform/shared/outbox/` | `tests/unit/platform/state-evidence/receipts/` | `npm run test:receipt-store` | existing | shadow | implemented | `2026-05-26 npm run test:receipt-store` passed; `BaseReceiptMinimal`, ledger/outbox shadow receipt facade implemented in source | yes | DOC-014 | TBD |
| TOOL-001 | ToolGateway shadow adapter | P0a | Runtime | TBD | TBD | `src/platform/five-plane-execution/tool-executor/`, `src/platform/five-plane-orchestration/harness/toolbelt/` | `tests/unit/platform/execution/tool-executor/`, `tests/integration/platform/execution/tool-executor/` | `npm run test:integration` | existing | shadow | implemented | Existing tool-executor/toolbelt have reusable backbone; continue converging unified facade naming | yes | REC-001 | TBD |
| GOV-001 | H2 Action Gate dry-run | P0a | Control | TBD | TBD | `src/platform/five-plane-control-plane/risk-control/`, `src/platform/five-plane-control-plane/approval-center/` | `tests/integration/platform/control-plane/` | `npm run test:integration` | existing | dry-run | implemented | Risk control/approval backbone exists; need further alignment with document terminology | yes | REC-001 | TBD |
| GOV-002 | H4 Approval enforce for high-risk tool | P0b-1 | Control | TBD | TBD | `src/platform/five-plane-control-plane/approval-center/`, `src/org-governance/approval-routing/` | `tests/e2e/approval-*.test.ts`, `tests/integration/platform/control-plane/approval-center/` | `npm run test:e2e` | existing | enforce | implemented | Existing approval-center + routing + approval e2e main chain exists | yes | TOOL-001,GOV-001 | TBD |
| TOOL-002 | prepare/commit/verify/compensate with durable outbox | P0b-1 | Runtime | TBD | TBD | `src/platform/five-plane-execution/tool-gateway/`, `src/platform/shared/outbox/`, `src/platform/five-plane-state-evidence/receipts/` | `tests/unit/platform/execution/tool-gateway/` | `npm run test:tool-gateway` | existing | enforce | implemented | `2026-05-26 npm run test:tool-gateway` passed; prepare/commit/verify/compensate implemented as facade with durable outbox convergence | yes | REC-001,TOOL-001 | TBD |
| MEM-001 | MemoryGateway facade + L4-L7 proposal-only | P0b-2 | State | TBD | TBD | `src/platform/five-plane-state-evidence/memory-gateway/`, `src/platform/five-plane-orchestration/harness/memory-manager.ts` | `tests/unit/platform/state-evidence/memory-gateway/` | `npm run test:memory-gateway` | existing | enforce | implemented | `2026-05-26 npm run test:memory-gateway` passed; `ManagedMemoryMinimal` / `MemoryProposal` / projection / higher-layer proposal-only implemented in source interfaces | yes | REC-001 | TBD |
| REL-001 | ReleaseManifestDraft + ReleaseGate enforce for prod | P0b-3 | Release | TBD | TBD | `src/platform/shared/stability/release-gate.ts`, `src/sdk/cli/release-pipeline.ts`, `src/platform/five-plane-control-plane/config-center/` | `tests/unit/platform/shared/stability/`, `tests/integration/platform/execution/stable-release-gate.test.ts` | `npm run gate:stable` | existing | enforce | implemented | `2026-05-26 npm run test:release-gate` passed; `2026-05-26 npm run gate:stable` output blocking report, current is insufficient evidence causing business blocked, not code chain missing | yes | REC-001 | TBD |
| GOV-003 | H3 Observation Gate for untrusted tool output | P0b-4 | Control | TBD | TBD | `src/platform/five-plane-execution/tool-executor/tool-output-sanitizer.ts`, `src/platform/five-plane-execution/tool-executor/mcp-tool-guard.ts` | `tests/unit/platform/execution/tool-executor/`, `tests/e2e/prompt-injection-guard*.test.ts` | `npm run prompt-injection:stable` | existing | enforce | completed | `2026-05-26 npm run prompt-injection:stable` 5/5 scenarios passed | yes | TOOL-002 | TBD |
| UI-001 | Minimal Approval UI/API | P0b-5 | UI | TBD | TBD | `ui/packages/features/approval/`, `src/platform/five-plane-interface/api/http-server/approval-routes.ts` | `ui/tests/unit/ui/packages/features/approval/`, `tests/e2e/approval-*.test.ts` | `npm run test:e2e` | existing | enforce | implemented | Existing approval UI/API exists; still need full alignment with "minimal approval UI/API" in document | conditional | GOV-002 | TBD |
| GOV-004 | H1-lite untrusted input marking | P0c | Control | TBD | TBD | `src/platform/prompt-engine/prompt-injection-guard.ts`, `src/platform/shared/stability/stable-prompt-injection-red-team.ts` | `tests/e2e/prompt-injection-guard*.test.ts`, `tests/integration/platform/prompt-engine/prompt-injection-guard.integration.test.ts` | `npm run prompt-injection:stable` | existing | dry-run/enforce for external | completed | `2026-05-26 npm run prompt-injection:stable` 5/5 scenarios passed | yes | DOC-014 | TBD |
| SEC-001 | P0 security suite: prompt/tool/memory injection | P0c | Security | TBD | TBD | `src/platform/prompt-engine/prompt-injection-guard.ts`, `src/platform/five-plane-control-plane/incident-control/tenant-execution-isolation-service.ts` | `tests/e2e/prompt-injection-guard*.test.ts`, `tests/integration/platform/security/` | `npm run test:e2e` | existing | enforce for high-risk | completed | `2026-05-26 npm run security:tenant` passed; `2026-05-26 npm run prompt-injection:stable` passed | yes | GOV-003,GOV-004,MEM-001 | TBD |
| EVAL-001 | Minimal eval report and release blocking threshold | P0c | Eval | TBD | TBD | `src/platform/five-plane-orchestration/harness/evaluation/`, `src/platform/five-plane-orchestration/harness/eval-harness/` | `tests/unit/platform/orchestration/harness/evaluation/`, `tests/integration/platform/orchestration/harness/` | `AA_VALIDATION_ITERATIONS=2 npm run validate:stable:compiled` | existing | enforce for release | completed | `2026-05-26 AA_VALIDATION_ITERATIONS=2 npm run validate:stable:compiled` 14/14 runs passed | yes | REL-001 | TBD |
| OBS-001 | Basic cost/latency tracing advisory | P0c | Observability | TBD | TBD | `src/platform/shared/observability/` | `tests/integration/platform/shared/observability/` | `npm run observability:smoke` | existing | advisory | completed | `2026-05-26 npm run observability:smoke` passed | conditional | REC-001 | TBD |

### 20.3 P1/P2 TODO Summary

| ID | Task | Priority | TeamOwner | Status | Notes |
|---|---|---|---|---|---|
| SAN-001 | SandboxProvider abstraction | P1 | Runtime | implemented | `src/platform/five-plane-execution/sandbox-provider/` already provides local/container/browser/microVM/remote provider abstraction; `2026-05-26 npm run test:sandbox-provider` passed |
| EVAL-002 | Full trajectory evaluator | P1 | Eval | implemented | `src/platform/five-plane-orchestration/evaluator/full-trajectory-evaluator.ts` has converged LLM judge calibration and rule evaluator; `2026-05-26 npm run test:full-trajectory-evaluator` passed |
| OBS-002 | Cost/latency release blocking gate | P1 | Observability | implemented | `src/platform/shared/observability/cost-latency-release-gate.ts` already supports blocking report; `2026-05-26 npm run test:cost-latency-release-gate` passed |
| MEM-002 | Memory export/delete/revoke privacy workflow | P1 | State/Security | implemented | `src/platform/five-plane-state-evidence/memory-gateway/privacy-workflow.ts` already covers export/delete/revoke; `2026-05-26 npm run test:memory-privacy-workflow` passed |
| UI-002 | Memory Review Console frontend | P1 | UI | implemented | `ui/packages/features/memory-review/` already connected to feature registry and frontend tests; `2026-05-26 npm run test:ui-p1-features` passed |
| UI-003 | Release Console frontend | P1 | UI | implemented | `ui/packages/features/release-console/` already connected to feature registry and frontend tests; `2026-05-26 npm run test:ui-p1-features` passed |
| UI-004 | Trace Explorer frontend | P1 | UI | implemented | `ui/packages/features/trace-explorer/` already connected to feature registry and frontend tests; `2026-05-26 npm run test:ui-p1-features` passed |
| OPS-001 | Operational runbook automation | P1 | Ops | implemented | `src/ops-maturity/platform-ops-agent/runbook-automation-service.ts` and incident runbook executor test chain exist; `2026-05-26 npm run test:runbook-automation` passed |
| AB-001 | Harness A/B test | P2 | Eval/Platform | implemented | `src/platform/prompt-engine/eval/llm-eval-service.ts` already supports A/B, significance and independent judge constraints; `2026-05-26 npm run test:ab-eval` passed |
| MAG-001 | Multi-agent handoff protocol | P2 | Orchestration | implemented | `src/platform/five-plane-orchestration/oapeflir/handoff-model.ts` + `handoff-builder.ts` already form responsibility transfer protocol; `2026-05-26 npm run test:handoff-protocol` passed |

---

## 21. CI / Runtime Gate

| Gate | P0a | P0b | P0c | P1 |
|---|---|---|---|---|
| Direct tool import scan | detect only | fail high-risk bypass | fail all production bypass | fail all bypass |
| Direct memory write scan | detect only | fail L4-L7 bypass | fail L3-L7 bypass in prod | fail all unauthorized writes |
| Release bypass scan | detect only | fail prod bypass | fail prod/staging bypass | fail all artifact release bypass |
| Receipt completeness | advisory | high-risk blocking | production blocking | all critical path blocking |
| Security injection suite | N/A | high-risk samples | P0 baseline | full regression |
| Cost/latency | trace only | advisory | advisory | blocking when budget defined |

---

## 22. Business Scenario Implementation Matrix

### 22.1 Overview

| Scenario | First Batch Suitability | Required P0 Capabilities | Main Risks |
|---|---:|---|---|
| Paper Research Agent | High | H1-lite, MemoryGateway, Trace/Eval, Evidence | External document injection, erroneous conclusion settling |
| Code Review / Test Failure Analysis Agent | High | ToolGateway, Sandbox-lite, Receipt, H3, Eval | Dangerous commands, erroneous patches, log injection |
| Training Experiment Analysis Agent | Medium | ToolGateway, Release/Eval, Cost, Memory | GPU resource waste, erroneous attribution |
| YONO Prediction Assistant Agent | Medium-low | Governance, Evaluation, Audit, H4 | Decision responsibility, external output risk |
| Production Database Operation Agent | Low | H4, Rollback, Policy, Sandbox, Audit | High-risk side effects, not suitable for first batch full automation |

### 22.3 Paper Research Agent Implementation Design

| Item | Design |
|---|---|
| Input | Paper PDF, arXiv/OpenReview pages, user research questions, internal experiment records |
| Tools | Search, PDF parser, document summarization, knowledge base write, eval case generation |
| Risks | External document prompt injection, erroneous paper conclusions entering L5/L7, citation errors |
| Required Gates | H1-lite, H3, MemoryProposal, Evidence binding, EvalReport |
| Memory Layers | L2 task notes, L3 session summary, L5 domain conclusion, L7 eval/failure pattern |
| Evaluation | Paper recall rate, citation accuracy rate, conclusion correctness rate, experiment recommendation executability |
| Release | Mission Release delivers research report; L5/L7 memory requires review before commit |
| Acceptance Metrics | Citation accuracy rate ≥ 95%; L5 memory 100% has evidence; external injection samples 100% marked untrusted |

### 22.4 Code Review / Test Failure Analysis Agent First Batch Implementation Design

| Item | Design |
|---|---|
| Input | repo, diff, test logs, CI results, architecture docs |
| Tools | repo read, test runner, static analyzer, patch generator, PR draft |
| Risks | Dangerous command execution, erroneous patches, log injection, accidental file deletion |
| Required Gates | H1-lite for logs/docs, H2 for commands, H3 for tool output, ToolGateway, Receipt, Sandbox-lite |
| Memory Layers | L2 task debug notes, L3 session state, L5 project conventions, L7 recurring failure patterns |
| Evaluation | bug finding precision, false positive, test pass rate, dangerous command block rate |
| Release | Mission Release delivers review report or PR draft; code merge still requires human review |
| Acceptance Metrics | dangerous command block rate 100%; tool call receipt 100%; patches can only output as drafts, cannot auto-merge |

---

## 23. ADR Decision Records

| ADR | Decision | Status |
|---|---|---|
| ADR-001 | Keep Five Plane, do not replace with ETCLOVG | accepted |
| ADR-002 | Harness-driven, do not adopt model-driven | accepted |
| ADR-003 | Tool Registry upgraded to Tool Gateway | accepted for architecture release; engineering validation pending |
| ADR-004 | Memory unified governance, not unified physical storage | accepted |
| ADR-005 | L7 memory does not equal PolicyBundle | accepted |
| ADR-006 | Release Artifact Graph must be lockfile-ized | accepted for architecture release; engineering validation pending |
| ADR-007 | H1-lite moved to P0b/P0c | accepted for architecture release; engineering validation pending |
| ADR-008 | high-risk side-effect must have durable outbox / PrepareReceipt first | accepted for architecture release; engineering validation pending |
| ADR-009 | cost/latency P0c advisory, P1 blocking | accepted for architecture release; engineering validation pending |
| ADR-010 | Tool reversibility must participate in risk decision | accepted for architecture release; engineering validation pending |

---

## 24. Release Checklist

### 24.1 Document Release Checklist

| Item | Status |
|---|---|
| Five Plane / ETCLOVG / OAPEFLIR relationship clear | completed |
| Memory / Policy / Evidence / Context boundaries clear | completed |
| P0a/P0b/P0c roadmap clear | completed |
| Current Codebase Gap Matrix defined | completed |
| Real repository scan results filled in | completed (auto-scan version); CI gate not connected, still blocking engineering baseline |
| TODO owner real names filled in | not completed, blocking engineering baseline |
| Verify command existence marked | completed, distinguished existing aggregate and to_add dedicated |
| CI commands entered package.json / workflow | not completed, blocking engineering baseline |
| Release blocking threshold defined | completed |
| Security & Privacy Baseline defined | completed |

### 24.2 Engineering Baseline Freeze Conditions

v1.9 document can serve as Architecture Review Release; before freezing as engineering implementation baseline must satisfy:

```text
1. current-codebase-gap-review-v1.9.md has been generated.
2. All P0 Blocking TODO have bound real OwnerName / Reviewer.
3. All P0 verify commands have entered package.json or CI workflow.
4. P0a boundary scan can run and output report.
5. ToolGateway shadow / Policy dry-run / Receipt shadow have at least one E2E path.
6. Release Gate prod bypass can be discovered by lint or runtime guard.
```

---

## 25. v1.9 Release Decision Matrix

### 25.1 Scope This Version Can Release

| Release Type | Allowed | Description |
|---|---:|---|
| Architecture Review Release | Yes | This version allowed to officially release as architecture review version, can be used for architecture review, engineering scheduling, real code scanning |
| Engineering Planning Input | Yes | TODO, risks, Gate, interfaces sufficient to support scheduling discussion |
| P0a Implementation Draft | Conditional | Need to supplement dedicated package scripts and scan scripts first |
| Engineering Freeze Baseline | No | Real repository scan, real owner, CI commands not yet completed |
| Production Governance Baseline | No | Not yet verified by E2E, security, eval baseline and P0b enforce |

### 25.2 Necessary Conditions to Upgrade from v1.9 Architecture Review Release to Engineering Freeze Baseline

1. `current-codebase-gap-review-v1.9.md` and JSON scan report have been generated.
2. All P0 Blocking TODO have bound real `OwnerName / Reviewer / TargetStart / TargetEnd / IssueLink`.
3. All P0 verify commands have entered `package.json` or CI workflow, empty implementation not allowed.
4. P0a has run through at least one E2E shadow path: `Receipt shadow + ToolGateway shadow + Policy dry-run + boundary scan`.
5. H1-lite sample set, ToolRiskMetadata, Transactional Outbox, ReleaseManifest hash, ManagedMemoryMinimal all have minimum tests.
6. First scenario at least selected to enter baseline eval run, and generate `EvalThresholdVersion`.

### 25.3 Items Still Requiring External Input

| Item | Why Cannot Be Completed Directly in Document |
|---|---|
| Real code path baseline | Need to generate reproducible scan artifact and solidify to review artifact |
| Real owner | Need team scheduling and management decisions |
| Dedicated P0 command implementation | Existing aggregate commands identified, but dedicated scripts still need supplementation |
| Eval baseline | Need real eval set and baseline run |
| Production security policy | Need company security/compliance requirements |

---

## 26. Final Recommendations

v1.9-Architecture-Release positioning is:

```text
Can be used as:
- Architecture review draft
- Engineering scheduling input
- P0 transformation task book draft
- Real code scanning checklist

Should not be directly used as:
- Frozen engineering implementation baseline
- Production governance standard
- release baseline
- Completed owner-assigned project plan
```

Next focus is not to continue adding new modules, but to complete four things:

```text
1. Scan real code, change Gap Matrix from "hypothetical path" to "code fact".
2. Bind real owner, reviewer, issue, target date to P0 TODO.
3. Add verify command to package.json/CI, and run through P0a at minimum.
4. Prioritize selecting Code Review / Test Failure Analysis Agent as first verification scenario, Paper Research Agent as second verification scenario, open one minimum Harness E2E.
```

One-sentence conclusion:

> **v1.9 has converged v1.8-RC remaining release expression, version consistency, ADR status, engineering freeze conditions, and first verification path to the degree of "can be officially released as architecture review version"; but it is still not an engineering freeze baseline, nor a production baseline. Before truly entering implementation, must replace TBD and hypothetical paths in document with real repository scan and real owner information.**

---

## References

1. "Agent Harness Engineering: A Survey" and its ETCLOVG taxonomy.
2. Automatic Agent System existing Five Plane / OAPEFLIR / Harness-driven architecture discussions.
3. `automatic_agent_system_harness_improvement_plan_v1_6_reviewed.md`.
4. v1.6/v1.7/v1.8 review proposed code mapping, owner, CI commands, H1-lite, security & privacy, receipt/outbox, evaluation threshold, release boundary issue checklists.

---

## Appendix A: v1.9 Release Revision Summary

| Revision Item | Status |
|---|---|
| Added system boundary diagram | completed |
| Added Current Codebase Gap Matrix credibility markers | completed |
| Added CI Command Contract | completed |
| Added P0b-1 through P0b-5 | completed |
| H1-lite moved forward | completed |
| Release threshold specified | completed |
| Cost/Latency advisory/blocking stage correction | completed |
| Receipt / durable outbox atomicity | completed |
| Tool reversibility risk rule | completed |
| ManagedMemoryMinimal schema | completed |
| Security & Privacy Baseline | completed |
| First batch business scenario elaboration | completed |
| TODO deduplication | completed |
| Real code scan | not completed, requires engineering execution |
| Real owner fill-in | not completed, requires project scheduling |
| CI command implementation | not completed, requires engineering execution |
| H1-lite minimum test set definition | completed |
| ToolRiskMetadata required contract | completed |
| Transactional Outbox transaction boundary | completed |
| Eval baseline calibration protocol | completed |
| Security Gate component implementation | completed |
| Release Decision Matrix | completed |

---

## Appendix B: Version Revision History

| Version | Description |
|---|---|
| v1.1 | Initial Harness improvement plan |
| v1.2 | Added Seven-layer Memory revision |
| v1.3 | Memory Gate independent enhancement patch |
| v1.4 | Merged Memory Gate into main document |
| v1.5 | Added TODO List, Release / Memory / Policy boundary fixes |
| v1.6 | Added Current Gap Matrix, Minimal P0, Rollout, Risk Matrix, Runbook, RBAC |
| v1.7 | Fixed v1.6 implementation issues: real scan markers, CI command status, P0b subdivision, H1-lite, security & privacy, receipt/outbox, thresholds, and business scenarios |
| v1.8 | Fixed v1.7 release boundary issues: H1-lite test set, ToolRiskMetadata, Transactional Outbox, Eval baseline calibration, Security Gate componentization, package.json script contract, and Release Decision Matrix |
| v1.9 | Architecture Review Release: Fixed version references, engineering freeze conditions, ADR release status, first validation scenario recommendations, and clarified release types and prohibited uses |