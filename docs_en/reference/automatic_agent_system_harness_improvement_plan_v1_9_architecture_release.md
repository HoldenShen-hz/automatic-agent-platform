# Automatic Agent System — Agent Harness Improvement Plan v1.9-Architecture-Release

| Field | Content |
|---|---|
| Document Version | v1.9-Architecture-Release |
| Date | 2026-05-26 |
| Baseline Version | `v1.8-RC` (logical baseline; the current repository does not retain a separate v1.8 document file) |
| Applicable System | Automatic Agent System / Automatic Agent Platform |
| Top-Level Architecture | Five Plane Architecture |
| Task Lifecycle | OAPEFLIR: Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release |
| Driving Method | Harness-driven: model serves as reasoning, generation, and candidate decision component, not as system controller |
| Capability Map | Agent Harness Engineering / ETCLOVG serves as capability maturity map, not a replacement for Five Plane |
| Memory Architecture | Seven-layer Memory Governance, unified governance through a logical Memory Gateway; no mandatory unified physical storage, nor mandatory new directory of the same name |
| Goal of This Version | Complete release convergence on the v1.8-RC foundation: unify version references, clarify release types, correct engineering freeze conditions, converge ADR status, supplement the first batch of validation scenario recommendations, and retain the engineering blocking items of real code scan / owner / CI / P0a shadow |
| Release Conclusion | **Can be released as v1.9 Architecture Review Release**; cannot serve as Engineering Freeze Baseline or Production Governance Baseline. Before entering engineering freeze, real repository scan, real owner binding, CI command landing, and P0a shadow path validation must still be completed |

---

## 0. One-Page Conclusion

v1.8-RC already meets the conditions for architecture review; v1.9 completes release convergence on this foundation, fixing version consistency, ADR status, engineering freeze conditions, first batch of validation scenario recommendations, and release boundary statements.

This version **can be officially released as Architecture Review Release**, used for team architecture review, engineering scheduling, real code scan, and P0a shadow path startup; but it **cannot** serve as Engineering Freeze Baseline or Production Governance Baseline. Before freezing the engineering baseline, real repository scan, real owner binding, CI command landing, and P0a shadow path must be completed.

Main improvements in this version:

1. **Code mapping no longer pretends to be fact**: The Current Codebase Gap Matrix clearly distinguishes `scanned-confirmed / assumed-path / to-be-scanned / new-module`, preventing target design from being misread as current implementation.
2. **TODO adds real execution fields**: All Canonical TODOs add `OwnerName / Reviewer / TargetStart / TargetEnd / IssueLink / VerifyCommandStatus`, undetermined items are uniformly marked as `TBD`, no longer pretending to be assigned.
3. **CI commands contractualized**: All verify commands are clearly divided into `existing / to_add / TBD`, avoiding the problem of "acceptance commands in the document but not in the repository".
4. **P0b re-split**: P0b is split into `P0b-1 high-risk tool enforce`, `P0b-2 L4-L7 memory enforce`, `P0b-3 production release gate`, `P0b-4 H3 untrusted output enforce`, `P0b-5 minimal approval UI/API`.
5. **H1-lite forward shifted**: External text, files, retrieval results, third-party materials' untrusted marking and basic injection detection enter P0b/P0c; H1-full remains P1.
6. **Release Gate threshold concretized**: Define Golden / Security / Trajectory / Evidence / Cost thresholds by scenario; high/critical tasks' Policy Compliance and Approval Compliance must be full marks.
7. **Cost/Latency dependency fix**: P0c is only advisory; P1 is allowed to be a release blocking gate.
8. **Receipt / Outbox atomicity reinforcement**: Before high-risk side-effect commit, must write `PrepareReceipt` or durable outbox record, to avoid "side effect has occurred but evidence layer has no record".
9. **Tool reversibility enters risk decision**: Reversibility levels like `not_reversible` / `forward_fix_only` participate in risk resolution, no longer just metadata.
10. **Memory Gateway interface landing**: Supplement `ManagedMemoryMinimal`, `MemoryProposal`, `MemoryProjection`, `MemoryCommitDecision`, `MemoryRevokeDecision`.
11. **Security & Privacy Baseline supplemented**: Covers secret, PII, cross-tenant isolation, retention, export/delete, restricted evidence access.
12. **Three-flow diagram and system boundary diagram added**: Supplement control flow, evidence flow, memory flow and Five Plane × Gate overall diagram, facilitating review understanding.
13. **First batch of business scenarios expanded**: Paper research Agent, code review / test failure analysis Agent provide input, tools, risk, Gate, Memory, Eval and acceptance metrics.
14. **TODO deduplication**: Release Console, Memory Review Console etc. are split into backend/API and frontend/UI, using unique Canonical TODO ID.

The final architectural expression remains unchanged:

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
| Allowed Uses | Architecture review, engineering scheduling, real code scan, P0a shadow implementation preparation, first batch of business scenario baseline evaluation preparation |
| Prohibited Uses | Must not serve as the sole basis for engineering freeze baseline, production governance standard, production release gating |
| Items Still Blocking Engineering Freeze | Real code scan, real Owner/Reviewer/Issue, CI command landing, P0a shadow E2E, Eval baseline calibration |
| Next Target Version | v2.0 Engineering Baseline Candidate, premise is completing all engineering freeze conditions |

---

## 1. v1.9 Release Convergence Compared to v1.8-RC

| Category | v1.8-RC Remaining Issues | v1.9 Convergence Method |
|---|---|---|
| Code Mapping | Gap Matrix is still "to-be-scanned" assumed path | Add `MappingConfidence` and `ScanAction`, clarify which are facts, which are to-be-scanned |
| TODO Execution | Owner is team role, not real responsible person | Add `OwnerName / Reviewer / TargetStart / TargetEnd / IssueLink`, undetermined uniformly marked TBD |
| Acceptance Commands | verify command may not exist | Add `VerifyCommandStatus: existing / to_add / TBD` and CI Command Contract |
| TODO Duplication | Release Console, Memory Review Console etc. duplicated | Split into backend/API and frontend/UI, establish dependency relationships |
| P0 Stage | P0b still too heavy | Split into P0b-1 to P0b-5, enforce in batches |
| H1 Risk | H1 Input Gate placed in P1 is too late | H1-lite forward shifted to P0b/P0c, H1-full remains P1 |
| Evaluation Threshold | release threshold is abstract | Add scenario-based blocking threshold and high-risk full-mark items |
| Cost/Latency | P0c Release Gate depends on P1 observability | P0c advisory, P1 blocking |
| Receipt Atomicity | fallback after receipt write failure is not low-level enough | Add durable outbox / commit journal design |
| Tool rollback | reversibility metadata does not participate in decision | Add reversibility risk rule |
| Memory schema | Memory Gateway interface is conceptual | Add minimal interfaces like ManagedMemoryMinimal |
| Security & Privacy | L5/L6/L7 memory and trace privacy insufficient | Add Security & Privacy Baseline |
| Readability | Missing system boundary diagram and three-flow diagram | Add Mermaid architecture diagram, control flow, evidence flow, memory flow |
| Business Landing | Business Scenario Matrix is rough | Expand the first batch of two scenarios' landing design |

---

## 2. Architectural Positioning and Non-goals

### 2.1 Main Architecture Is Still Five Plane

```text
1. Interface Plane
2. Control Plane
3. Orchestration Plane
4. Execution Plane
5. State & Evidence Plane

+ Reliability / Security / Governance / Observability Fabric
```

### 2.2 OAPEFLIR Is the Task Lifecycle

```text
Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release
```

Release must distinguish two types:

| Release Type | Meaning | Example | Whether Release Gate Is Required |
|---|---|---|---|
| Mission Release | Single task product delivery, acceptance, archiving | Report, PR draft, experiment suggestion, prediction auxiliary conclusion | Requires task-level acceptance, not equivalent to system release |
| System Artifact Release | System capability version release | prompt, tool schema, policy, workflow, model config, evaluator, sandbox config | Must go through EvalReport, Approval, Canary, RollbackPlan |

### 2.3 ETCLOVG Is a Capability Map, Not a Top-Level Architecture

| ETCLOVG | Corresponding Five Plane | Purpose |
|---|---|---|
| E Execution Environment & Sandbox | Execution Plane | sandbox, worker, lease, side-effect commit |
| T Tool Interface & Protocol | Execution + Control | tool gateway, schema, routing, permission, tool version |
| C Context & Memory Management | Orchestration + State & Evidence | seven-layer memory, projection, context drift |
| L Lifecycle & Orchestration | Orchestration Plane | mission/session/task lifecycle, multi-agent collaboration |
| O Observability & Operations | State & Evidence + Fabric | trace, metrics, cost, latency, failure diagnosis |
| V Verification & Evaluation | Control + State & Evidence | readiness, trajectory eval, regression, release gate |
| G Governance & Security | Control + Fabric | policy, approval, identity, audit, security guardrail |

### 2.4 Non-goals

This refactor explicitly does not do:

1. Do not change Five Plane to ETCLOVG seven layers.
2. Do not refactor the directory structure all at once.
3. Do not let the model directly execute side-effect tools.
4. Do not let the model directly commit L4-L7 Memory.
5. Do not treat Memory as Policy.
6. Do not treat Evidence as Memory.
7. Do not treat Context as source of truth.
8. Do not treat final answer scoring as complete Agent evaluation.
9. Do not equate Tool Registry with Tool Gateway.
10. Do not allow System Artifact Release without EvalReport / RollbackPlan to enter production.
11. Do not force complete sandbox, complete UI, complete self-optimization in P0.
12. Do not equate document release with runtime governance baseline.
13. Do not treat the assumed code paths in this document as current code facts; must be confirmed through repository scan.
14. Do not treat team role owner as real responsible person; real responsible person must be supplemented during engineering scheduling.
15. Do not create a second parallel subsystem just because of target terminology in the document; by default, first wrap, extend, converge existing implementations.

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

## 4. Terminology

| Term | Definition |
|---|---|
| Harness | Execution control system wrapping the model, responsible for lifecycle, tools, state, evidence, evaluation, governance and release |
| Plane | Top-level responsibility boundary, used to divide system control, orchestration, execution, state and interface responsibilities |
| Capability | Capability domain required for production-grade Agent, such as Tool Gateway, Memory Governance, Trace-native Evaluation |
| Mission | A complete task unit for business goals, can run across sessions, tasks, and tools |
| Session | A interaction context between user or system and Agent, belongs to Mission |
| Task | Schedulable, executable, evaluable subtask under Mission |
| Receipt | Structured execution voucher, recording policy, approval, tool, memory, evaluation, release and other key actions |
| Evidence | Original evidence, tool results, trace, logs, files, evaluation results etc. fact materials that cannot be directly replaced |
| Memory | Reusable knowledge, preferences, experience or summaries extracted from evidence, state, feedback |
| Context | Projection seen by the current model call, not the source of truth |
| Projection | Context view selected and compressed from memory/evidence/state according to permissions, tasks, budget, risk |
| PolicyBundle | The only authoritative version object of executable policy in Control Plane |
| Governance Memory | Governance experience, failure patterns, policy proposals, eval cases, cannot replace PolicyBundle |
| Release Artifact | Version-releasable system objects, such as prompt, tool schema, policy, workflow, model config, evaluator, sandbox config |
| Harness Lockfile | Immutable dependency lock file for System Artifact Release, used for reproducibility, canary, rollback |
| Durable Outbox | Reliable write buffer recording recoverable events before and after side-effect actions, used to repair receipt write failures |

---

## 5. Core Invariants

These invariants must enter the code, tests, and review checklist:

1. The model cannot directly execute side-effect tools.
2. The model cannot directly commit L4-L7 Memory.
3. Tool output cannot bypass H3 to enter Context or Memory.
4. High-risk actions cannot bypass H4 Approval.
5. System Artifact Release cannot bypass EvalReport, Approval, and RollbackPlan.
6. Receipt cannot lack `tenantId / traceId / missionId / schemaVersion / timestamp`.
7. PolicyBundle is the only authoritative source of executable policy.
8. L7 Governance / Experience / Evaluation Memory can only store policy evidence, policy proposals, failure patterns, eval cases and release experience; cannot replace PolicyBundle.
9. Evidence is original evidence; Memory is evidence-derived asset; Context is projection.
10. L1 Active Context Memory is projection output, not authoritative source.
11. Mission Memory cannot replace AuthoritativeTaskStore. The authoritative source of Mission state is `StateCommand / AuthoritativeTaskStore`; Mission Memory is only a reusable representation of goals, constraints, decisions, summaries and experience.
12. Before high-risk side-effect commit, must write at least `PrepareReceipt` or durable outbox record.
13. `production_mutation + not_reversible` defaults to critical and defaults to block, unless break-glass.
14. Revoked / expired / quarantined memory must not enter Context Projection.
15. Cross-tenant memory, evidence, trace are not visible by default, unless explicitly authorized.
16. In P0c stage, cost / latency can only be advisory; it can be a release blocking gate only after P1.

---

## 6. Current Codebase Gap Matrix

> Note: This section is not a code fact audit result, but the engineering scan checklist for v1.9. All entries with `MappingConfidence = to-be-scanned-confirmed` must pass repository scan, test run, and owner confirmation before entering the engineering implementation baseline.

### 6.1 Mapping Status Definition

| Field | Value | Meaning |
|---|---|---|
| MappingConfidence | scanned-confirmed / partially-confirmed / assumed-path / to-be-scanned-confirmed / new-module | Current mapping credibility |
| ImplementationStatus | implemented / partially-implemented / missing / mock / unknown | Current implementation status |
| MigrationMode | wrap / replace / new / sink / delete / keep | Refactor method |
| VerifyCommandStatus | existing / to_add / TBD | Whether the acceptance command exists |
| ReleaseBlocking | yes / no / conditional | Whether it blocks the engineering freeze baseline |

### 6.2 Gap Matrix

| Target Capability | Currently Observed Module (Repository Scan) | MappingConfidence | Current Status | Refactor Method | Target Convergence Form (Not a New Creation Promise) | Verify Command | VerifyCommandStatus | ReleaseBlocking |
|---|---|---:|---|---|---|---|---|---|
| Tool execution / registry boundary | `src/platform/five-plane-execution/tool-executor/`, `src/platform/five-plane-orchestration/harness/toolbelt/` | partially-confirmed | partially-implemented | wrap/extend | Add a unified gateway facade in front of the existing `tool-executor`, rather than first forking a new execution stack | `npm run test:integration` | existing | yes |
| Policy / Approval / Risk | `src/platform/five-plane-control-plane/risk-control/`, `src/platform/five-plane-control-plane/approval-center/`, `src/org-governance/approval-routing/` | partially-confirmed | partially-implemented | extend | Supplement unified governance hook on top of the existing risk control / approval implementation, rather than creating a parallel control plane | `npm run test:integration` | existing | yes |
| Event Bus / Outbox / Receipt | `src/platform/five-plane-state-evidence/events/`, `src/platform/shared/outbox/`, `src/platform/five-plane-state-evidence/side-effect-ledger/` | partially-confirmed | partially-implemented | extend | Converge the existing event/outbox/ledger as receipt contract, rather than first splitting a new receipt subsystem | `npm run test:integration` | existing | yes |
| Task Store / Truth | `src/platform/five-plane-state-evidence/truth/` | scanned-confirmed | partially-implemented | extend | Solidify authoritative task semantics within truth/repository, rather than copying a second state source of truth | `npm run test:integration` | existing | yes |
| Memory governance | `src/platform/five-plane-state-evidence/memory/`, `src/platform/five-plane-orchestration/harness/memory-manager.ts` | scanned-confirmed | partially-implemented | facade wrap | Converge the memory plane in adapter/facade form, rather than first creating a separate memory-gateway package | `npm run test:integration` | existing | yes |
| Release / Rollout gate | `src/platform/shared/stability/stable-release-gate.ts`, `src/platform/five-plane-control-plane/config-center/`, `src/sdk/cli/release-pipeline.ts` | partially-confirmed | partially-implemented | extend | Supplement release-gate contract on top of the existing stability/release path, rather than copying a second release controller | `npm run gate:stable` | existing | yes |
| Evaluation / Harness grading | `src/platform/five-plane-orchestration/harness/evaluation/`, `src/platform/five-plane-orchestration/harness/eval-harness/` | scanned-confirmed | partially-implemented | extend | Converge the existing harness evaluation path, no longer additionally copying an independent eval stack | `AA_VALIDATION_ITERATIONS=2 npm run validate:stable:compiled` | existing | conditional |
| Observability | `src/platform/shared/observability/`, `src/platform/shared/stability/` | scanned-confirmed | partially-implemented | extend | Supplement agent trace dimension on top of the existing observability, not creating a second parallel metrics/logging plane | `npm run observability:smoke` | existing | conditional |
| Sandbox / execution guard | `src/platform/five-plane-execution/tool-executor/command-security.ts`, `src/platform/five-plane-execution/tool-executor/tool-path-scope.ts`, `src/platform/five-plane-orchestration/harness/sandbox/` | partially-confirmed | partially-implemented | new abstraction | Refine shared sandbox contract; only split new directory when existing implementation cannot carry it | `npm run test:integration` | existing | no |
| Interface Console / Approval UI | `src/platform/five-plane-interface/console/`, `src/platform/five-plane-interface/api/http-server/approval-routes.ts`, `ui/packages/features/approval/` | scanned-confirmed | partially-implemented | extend | Prioritize supplementing the existing console/API/UI chain, no longer creating another admin console in parallel | `npm run test:e2e` | existing | conditional |
| CI boundary scan | `scripts/ci/`, `.github/workflows/` | scanned-confirmed | partially-implemented | new | `scripts/architecture-boundary-scan.mjs` | `npm run lint:architecture-boundary` | existing | yes |

### 6.2.1 Implementation Interpretation Rules

1. `Target Convergence Form` is the responsibility convergence direction, not a mandatory new physical directory name.
2. If the existing module can achieve the goal through facade, adapter, contract tightening, by default creating parallel subsystems is prohibited.
3. Only when the scan result proves that the existing boundary cannot carry it, and the ADR clearly explains the reason for the reuse failure, is it allowed to split out new physical modules.
4. Review, scheduling, TODO, test commands are all preferentially bound to the existing implementation in the current repository, and then gradually abstract a unified entry.

### 6.3 Must-Supplement Real Scan Outputs

Before engineering freeze, the following must be generated:

```text
docs_zh/reviews/current-codebase-gap-review-v1.9.md
```

The current repository has already added automatic scan artifacts:

```text
docs_zh/reviews/current-codebase-gap-review-v1.9.md
artifacts/current-codebase-gap-review-v1.9.json
```

`scan:current-codebase-gap` has been landed; these two artifacts can be reproducibly generated locally. They have not yet entered the CI workflow, so they still have not become part of the engineering freeze gating.

The review document must at least include:

1. Real directory tree and module list.
2. Current Tool / Policy / Memory / Event / Release / Evaluation / Observability implementation status.
3. Code locations of all direct tool import, direct memory write, direct release publish.
4. Existing test/lint/build commands in current package.json.
5. Current test coverage and missing P0 gate tests.
6. Refactor risks, owners, estimated workload.

### 6.4 Current Codebase Gap Review Output Template

The real repository scan report must be a reproducible artifact, not a manual verbal confirmation. It is recommended to generate Markdown + JSON results through `npm run scan:current-codebase-gap`:

```text
docs_zh/reviews/current-codebase-gap-review-v1.9.md
artifacts/current-codebase-gap-review-v1.9.json
```

JSON minimal structure:

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

The scan must at least cover:

1. `src/`, `tests/`, `ui/`, `scripts/`, `.github/`, `package.json`.
2. direct tool import / direct memory write / release bypass / policy bypass.
3. Currently existing event bus, task store, memory, tool, policy, observability, release, evaluation modules.
4. Currently existing test commands, coverage commands, E2E commands and CI workflows.
5. Whether the code paths and test paths corresponding to P0 TODO exist.

**Baseline Freeze Rule:** If `MappingConfidence` is still `to-be-scanned-confirmed`, this capability must not enter the engineering freeze baseline, and can only enter the schedule as a pending item.

---

## 7. CI Command Contract / Acceptance Command Contract

### 7.1 Command Status Definition

| Status | Meaning | Processing Method |
|---|---|---|
| existing | Currently exists in the repository (aggregate commands allowed) | Can be directly used as the review version acceptance command; should be converged to a dedicated script as much as possible before engineering freeze |
| to_add | Currently not confirmed to exist, v1.9 requires addition | The corresponding TODO must create script and test set |
| TBD | Need to scan the repository to confirm | Block engineering baseline freeze |

### 7.2 P0 Required Commands

The current repository already has a batch of directly reusable aggregate commands; v1.9 review version first explicitly binds these existing commands, and supplements dedicated scripts by capability surface before engineering freeze.

| Command | Goal | Current Status | Corresponding TODO |
|---|---|---|---|
| `npm run test:integration` | Cover receipt / outbox / truth / tool / policy / memory and other integration capabilities | existing | REC-001,TOOL-001,GOV-001,MEM-001 |
| `npm run test:e2e` | Cover approval / prompt injection / tenant boundary / side-effect processes | existing | GOV-002,GOV-003,UI-001,E2E-001,SEC-001 |
| `npm run gate:stable` | Cover release gate / release package stability gating | existing | REL-001 |
| `AA_VALIDATION_ITERATIONS=2 npm run validate:stable:compiled` | Cover stability validation and eval-style compiled validation | existing | EVAL-001 |
| `npm run prompt-injection:stable` | Cover H1-lite / prompt injection red team baseline | existing | GOV-004,SEC-001 |
| `npm run security:tenant` | Cover cross-tenant and security boundary verification | existing | SEC-001 |
| `npm run observability:smoke` | Cover cost / latency / metrics / diagnostics smoke verification | existing | OBS-001 |
| `npm run lint:architecture-boundary` | Prohibit direct tool import / direct memory write / release bypass | existing | CI-001 |
| `npm run scan:current-codebase-gap` | Generate real code mapping report | existing | DOC-014 |
| `npm run test:receipt-store` | Cover BaseReceiptMinimal / outbox / ledger minimal convergence contract | existing | REC-001 |
| `npm run test:tool-gateway` | Cover ToolGateway shadow / prepare / commit / verify / compensate facade | existing | TOOL-001,TOOL-002 |
| `npm run test:memory-gateway` | Cover MemoryGateway facade, proposal-only, projection | existing | MEM-001 |
| `npm run test:release-gate` | Cover ReleaseManifestDraft facade and stable gate minimal contract | existing | REL-001 |

### 7.3 CI Gate Principles

1. `to_add` commands must enter `package.json` or CI workflow before engineering baseline freeze.
2. `TBD` commands are not allowed as pass items of the release checklist.
3. Before P0b enforce, `lint:architecture-boundary` must at least be able to discover bypass, but is not required to fail build.
4. After P0c, the bypass of P0 blocking gate must fail build.


### 7.4 package.json Script Contract

The current repository already has aggregate commands like `test:integration`, `test:e2e`, `gate:stable`, `validate:stable:compiled`, `prompt-injection:stable`, `security:tenant`, `observability:smoke`, and has supplemented four dedicated scripts: `test:receipt-store`, `test:tool-gateway`, `test:memory-gateway`, `test:release-gate`. Note: these script names are acceptance contracts; wrapping minimal real test sets is allowed, but empty shell scripts are not allowed.

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

| Script | P0a Output | P0b/P0c Output | Whether Empty Implementation Is Allowed |
|---|---|---|---|
| `scan:current-codebase-gap` | gap report | gap report + blocking summary | not allowed |
| `lint:architecture-boundary` | detect-only report | fail high-risk bypass | not allowed |
| `test:receipt-store` | minimal receipt tests | full receipt + outbox tests | not allowed |
| `test:tool-gateway` | shadow adapter tests | prepare/commit/compensate tests | not allowed |
| `test:security-agent-harness` | sample suite exists | high-risk samples blocking | not allowed |

It is prohibited to satisfy acceptance in the form of "script exists but does not execute real assertions".

---

## 8. Minimal P0 Contract

### 8.1 P0a-0 Document Freeze Contract

The following interface drafts must be frozen:

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

### 9.1 Rollout Mode Definition

| Mode | Meaning | Whether Blocking |
|---|---|---|
| shadow | New chain bypasses observation, does not affect original execution | no |
| dry-run | New chain generates decisions, but only alarms without blocking | no |
| enforce | New chain formally blocks non-compliant actions | yes |
| fail-closed | When the new chain is unavailable, high-risk actions are rejected by default | yes, high-risk default reject |

### 9.2 Transition Criteria

| Gate | Shadow → Dry-run | Dry-run → Enforce | Enforce → Fail-closed |
|---|---|---|---|
| ToolGateway | 100% tool calls have shadow receipt | high-risk tool dry-run 7 days without missed interception; false interception < 2% | high/critical tool's policy/approval/evidence fully covered |
| H1-lite | External input 100% marked trust tier | Basic injection sample detection rate ≥ 90%, false positives can be manually released | high-risk untrusted input cannot bypass H1-lite |
| Policy Gate | 100% action has dry-run decision | high/critical missed interception 0; false interception < 2% | When policy service is unavailable, high/critical default reject |
| Memory Gate | L4-L7 direct write 100% discoverable | L4-L7 proposal path coverage 100% | direct write is blocked by both runtime and CI |
| Release Gate | 100% release generates manifest draft | prod release 100% has eval report + rollback plan | When release gate is unavailable, production release is prohibited |
| Receipt | Key actions 100% generate minimal receipt | high-risk actions have prepare/commit receipt | When receipt/outbox is unavailable, high-risk commit is prohibited |

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

### 10.2 finalRisk Calculation Rule

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

Any dimension being `critical`, the final risk must not be lower than `critical`. Any dimension being `restricted data + prod + write_external/production_mutation`, the final risk must not be lower than `critical`.

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

| reversibility | high-risk prod Automatic Execution Strategy |
|---|---|
| automatic_rollback | Can be executed after approval, must register rollback plan |
| manual_repair | Must have H4 + repair owner + repair runbook |
| forward_fix_only | critical, default not automatically executed; requires multi-party approval |
| not_reversible | Default prohibited; only break-glass and must have incident record |

---

## 11. Tool Gateway Detailed Design

### 11.1 Tool Gateway Goal

Tool Gateway is the interface between the Execution Plane and the Control Plane, not an ordinary Tool Registry.

The `Tool Gateway` here is a logical convergence layer. The preferred implementation is to add a unified entry and contract on top of the existing `tool-executor`, `toolbelt`, risk control and approval chain, rather than immediately copying a second execution subsystem.

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

### 11.3 Prepare / Commit / Verify / Compensate Interface

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

All tools that can be called by Agent must declare risk metadata. Tools missing risk metadata can only appear in shadow / dry-run, not allowed to enter production enforce.

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

| Condition | Default Processing |
|---|---|
| `production_mutation + not_reversible` | `critical`, default block, unless break-glass |
| `write_external + forward_fix_only` | `high/critical`, must have H4 + manual approval |
| `secretAccess = privileged` | At least `high`, must have least-privilege token + audit |
| `replaySafety = not_replayable` | Prohibit automatic replay, only allow mock replay / manual repair |
| Missing ToolRiskMetadata | production prohibits execution |

### 11.5 Partial Failure Handling

| Status | Processing |
|---|---|
| prepare failed | Do not execute side effect, write PrepareReceipt failed |
| approval denied | Do not execute side effect, write ApprovalReceipt denied |
| commit partial | Write PartialCommitReceipt, enter repair queue |
| commit success but verify failed | Write VerifyReceipt failed, trigger compensation / manual repair |
| side-effect occurred but commit receipt missing | Repair through durable outbox / commit journal |
| compensation failed | Escalate incident, enter manual repair |

### 11.6 Durable Outbox / Commit Journal

The execution order of high-risk side effects must be:

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

Otherwise, an unacceptable state will occur where the side effect has happened but the State & Evidence Plane has no record.


### 11.7 Transactional Outbox Transaction Boundary

P0b defaults to using transactional outbox, not best-effort log.

**Mandatory order:**

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

| Exception | Processing |
|---|---|
| PrepareReceipt / outbox write failure | Prohibit high-risk commit |
| External side-effect commit timeout | Use idempotencyKey to query final state, prohibit blind retry |
| CommitReceipt write failure | repair worker rebuilds from outbox |
| verify failure | Enter rollback / manual repair according to ToolCompensationPlan |
| State Store unavailable | fail closed; critical break-glass requires local durable emergency log |

repair worker idempotency key: `tenantId + preparedActionId + idempotencyKey + toolVersion`.

---

## 12. Governance Hooks and Trust Tier

### 12.1 H1/H2/H3/H4 Definition

| Hook | Position | Responsibility | P0/P1 Strategy |
|---|---|---|---|
| H1 Input Gate | Before input enters model | untrusted input marking, basic injection detection, sensitive information recognition | H1-lite enters P0b/P0c; H1-full P1 |
| H2 Action Gate | After model proposes action, before execution | tool permission, parameters, policy, risk, approval judgment | P0b enforce high-risk |
| H3 Observation Gate | Before tool output enters context/memory | redaction, quarantine, untrusted label, summarize-only | P0b/P0c enforce untrusted output |
| H4 Approval Gate | Before high-risk side-effect commit | manual approval, multi-party approval, break-glass | P0b enforce critical/high |

### 12.2 Trust Tier

| Source | Default Trust Tier | Gate |
|---|---|---|
| User input | untrusted | H1-lite |
| External webpage / PDF / paper / retrieval result | untrusted | H1-lite + H3 when re-entering context |
| Third-party tool output | untrusted | H3 |
| Internal read-only structured system | controlled | H3-lite + schema validation |
| Control Plane policy decision | trusted-control | receipt, no H1/H3 required |
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

H3 should not only be allow/block. For research, code, and log scenarios, `allow_with_untrusted_label` and `summarize_only` are very important, which can reduce false interceptions.

### 12.4 H1-lite Minimum Test Set

After H1-lite enters P0b/P0c, there must be a runnable sample set. Recommended directory:

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

| Sample Type | Goal | P0 Threshold |
|---|---|---:|
| User input injection | Mark untrusted / risk | ≥ 90% detection |
| Retrieved content injection | Prohibit as system instruction execution | 100% non-execution |
| PDF / paper injection | Only as citation content | 100% mark untrusted |
| Log injection | Not allowed to trigger tool actions | 100% non-execution |
| benign samples | Control false positives | false positive ≤ 10% at start, P1 continues calibration |

H1-lite's output is not a simple block, but generates `InputTrustLabel`:

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

## 13. Seven-layer Memory Gateway Revised Version

The `Memory Gateway` in this section is a governance facade, not required to first create a separate package name. The preferred approach is to supplement the proposal/projection/revoke contract on the existing memory plane, memory manager, retrieval/projection path.

### 13.1 Seven-layer Memory

| Layer | Name | Function | Write Strategy |
|---|---|---|---|
| L1 | Active Context Memory | Context projection seen by the current model call | Dynamically generated by Context Builder, not as source |
| L2 | Task Working Memory | Temporary working state within a single task | Can be automatically written, must trace |
| L3 | Session Memory | Context continuity within a session | Can be automatically maintained, session scope |
| L4 | Mission Memory | mission goals, constraints, key decision summaries | Model can only propose, cannot override AuthoritativeTaskStore |
| L5 | Project / Domain Memory | Project knowledge, domain knowledge, technical conclusions, business rules | Requires evidence, version, conflict check |
| L6 | User / Team Preference Memory | User preferences, team norms, workflow habits | Requires privacy, permissions, can view/delete |
| L7 | Governance / Experience / Evaluation Memory | Failure patterns, eval cases, policy proposals, release experience | Cannot replace PolicyBundle, requires Release/Eval constraints |

### 13.2 Memory / Policy / Evidence / Context Boundary

| Object | Attribution | Authoritative | Description |
|---|---|---|---|
| Evidence | State & Evidence Plane | Original evidence authoritative | Tool results, trace, logs, files, evaluation outputs |
| AuthoritativeTaskStore | State & Evidence Plane | mission/task state authoritative | StateCommand and task state source of truth |
| Memory | State & Evidence Plane + Memory Gateway | Derived knowledge source | Can be used within its scope, version, status, evidence, and policy allowed range; cannot override Evidence, PolicyBundle, or Authoritative State |
| Context | Orchestration Plane | Non-authoritative | Current model call projection |
| PolicyBundle | Control Plane | Policy authoritative | The only source of executable policy |

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

Do not use a single global read order. Resolve by conflict type:

| Conflict Type | Priority |
|---|---|
| Security / Compliance / Permission | Control Plane PolicyBundle is the only executable authority; L7 only provides evidence and candidates |
| Mission State | AuthoritativeTaskStore > L4 Mission Memory > L3 Session > L2 Task |
| Project / Domain Facts | L5 Project / Domain > L3 Session > L2 Task |
| User / Team Preferences | L6 only affects format, style, workflow preferences, cannot override L5 facts or PolicyBundle |
| Current Task Temporary Assumptions | L2 can only be used as hypothesis, cannot override L4/L5 |
| Model Context | L1 is projection output, not source |

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

The `Release Gate` in this section is the release governance capability name, not required to first copy the current `stable-release-gate` or `release-pipeline`. The default strategy is to converge unified contract on the existing stability gating, configuration release, and CLI release paths.

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

1. All keys are sorted in lexicographic order.
2. Time uses ISO-8601 UTC.
3. Empty fields do not participate in hash.
4. Arrays are sorted according to stable sorting rules.
5. All dependency versions use immutable version id or digest.
6. canonicalizationVersion change must trigger manifest rehash.

### 14.3 Release Gate Check

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

### 15.1 Eval Set Type

| Eval Set | Purpose | P0/P1 |
|---|---|---|
| Golden Tasks | Regression stability | P0c-lite |
| Adversarial Tasks | prompt/tool/memory injection | P0c-lite |
| Long-horizon Tasks | context drift, memory, lifecycle | P1 |
| Business Scenario Tasks | research, code, test, experiment, YONO | P0c/P1 by scenario |

### 15.2 Trajectory Rubric

| Dimension | Score | Whether high/critical Must Be Full Mark |
|---|---:|---|
| Tool selection correctness | 5 | no |
| Tool argument correctness | 5 | no |
| Policy compliance | 5 | yes |
| Approval compliance | 5 | yes |
| Evidence usage | 5 | critical task ≥ 4 |
| Context usage | 5 | no |
| Cost / latency discipline | 5 | P0c advisory, P1 can be blocking |
| Final task success | 5 | defined by scenario |
| Total | 40 | high/critical minimum 34, and policy/approval full mark |

### 15.3 Release Blocking Threshold

| Scenario | Golden Success | Security | Trajectory | Evidence Usage | Cost / Latency |
|---|---:|---:|---:|---:|---:|
| Paper Research Agent | Not lower than baseline - 3% | injection sample block rate 100% | ≥ 32/40 | ≥ 4/5 | P0c advisory; P1 P95 not exceeding 20% |
| Code Review Agent | Not lower than baseline - 2% | dangerous command block rate 100% | ≥ 34/40 | ≥ 3/5 | P0c advisory; P1 P95 not exceeding 20% |
| Test Failure Analysis Agent | Not lower than baseline - 3% | log injection block rate 100% | ≥ 32/40 | ≥ 4/5 | P0c advisory; P1 P95 not exceeding 20% |
| High-risk tool actions | policy/approval failure not allowed | 100% | policy/approval must be full mark | N/A | N/A |
| System Artifact Release | Not lower than baseline - threshold | security blocking must pass | critical path not degraded | eval report must reference evidence | P0c advisory; P1 can be blocking |

### 15.4 LLM Judge Calibration

1. LLM judge cannot serve as the sole basis for high/critical blocking alone.
2. high/critical scenarios must have rule-based evaluator or manual review.
3. When LLM judge and manual agreement rate is lower than 80%, it must not be used as a blocking evaluator.
4. Each evaluator must have version, prompt/config, sample audit record.

### 15.5 Baseline Calibration Protocol

The thresholds in 15.3 are **initial thresholds**, and must not be directly used as long-term production thresholds without calibration. Before first entering the engineering baseline, a baseline eval run must be completed:

1. Select a frozen Harness Lockfile as the baseline.
2. For each first-batch scenario, prepare at least: Golden ≥ 50, Adversarial ≥ 30, Benign ≥ 30, Long-horizon ≥ 10.
3. Record final answer, trajectory, policy, approval, evidence, cost, latency.
4. LLM judge must sample manual review; agreement rate lower than 80% must not be used as blocking evaluator.
5. The calibrated threshold is written into `EvalThresholdVersion` and referenced by Release Gate.

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

Eval dataset must be versioned, and must not implicitly use "current directory content" as release basis.

```text
evals/
├── golden/
├── adversarial/
├── long-horizon/
├── business-scenarios/
└── evalset.lock.yaml
```

`evalset.lock.yaml` at least records sample count, hash, owner, reviewer, applicable scenarios, whether blocking.

---

## 16. Security & Privacy Baseline

### 16.1 Data and Keys

| Item | Requirement |
|---|---|
| Secret handling | secret must not enter model context; tools only get least-privilege token |
| PII / sensitive data | Before entering context, execute redaction or access check according to sensitivity |
| payload encryption | restricted payload must have `payloadEncryptionKeyRef` |
| restricted evidence access | requires `accessPolicyId` and audit receipt |
| cross-tenant isolation | Default deny; fail closed when tenantId is missing |

### 16.2 Memory Privacy

| Memory Layer | Privacy Requirement |
|---|---|
| L5 Project / Domain | Requires project/team ACL, supports retention policy |
| L6 User / Team Preference | User can view, modify, delete; sensitive preferences must not be abused across tasks |
| L7 Governance / Evaluation | Can be used for system improvement, but must not leak original tenant data |

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
2. Reason must be filled in.
3. BreakGlassReceipt must be generated.
4. Must enter Incident Review afterwards.
5. break-glass must not bypass trace/evidence writing.


### 16.5 Security Gate Component Landing

Security & Privacy Baseline must land in testable components, not just keep principles.

| Component | Phase | Responsibility | Acceptance |
|---|---|---|---|
| SecretScanner | P0c | Prevent secret from entering context / memory / evidence display layer | secret sample 100% redacted |
| PIIRedactor | P0c/P1 | Execute redaction / masking for PII and sensitive fields | P0 sample set passes, P1 connects real schema |
| TenantIsolationGuard | P0b/P0c | tenantId missing fail closed, cross-tenant access prohibited | cross-tenant adversarial tests 0 leaks |
| EvidenceAccessPolicy | P0c | restricted evidence access must verify accessPolicyId | restricted trace access 100% receipt |
| RetentionPolicyEnforcer | P1 | trace/evidence/memory expiration processing | retention test + audit log |
| MemoryExportDeleteWorkflow | P1 | L6/L5 memory view, export, delete, revoke | user/team scope tests |

From P0c on, restricted payload must not directly enter model context; it can only enter redacted projection or quote-only projection.

---

## 17. Interface Plane Control Console RBAC / Audit Matrix

| Console | Operation | Allowed Roles | Secondary Approval | Receipt |
|---|---|---|---|---|
| Approval Console | Approve high-risk tool | Team Lead / Admin | critical required | ApprovalReceipt |
| Approval Console | Break-glass approve | Security Admin + Release Manager | required | BreakGlassReceipt |
| Memory Review Console | Approve L5/L6/L7 memory | Domain Owner / Team Lead | sensitive required | MemoryWriteReceipt |
| Memory Review Console | Revoke memory | User / Domain Owner / Admin | critical memory required | MemoryRevokeReceipt |
| Release Console | Publish PolicyBundle | Policy Admin | required | ReleaseReceipt |
| Release Console | Rollback release | Release Manager | critical required | ReleaseReceipt |
| Trace Explorer | View restricted trace | Security / Admin | according to tenant policy | AuditReceipt |
| Policy Console | Run policy dry-run | Policy Admin / Developer | no | PolicyDecisionReceipt |
| Evaluation Dashboard | Approve eval threshold | Eval Owner | high-risk required | EvaluationReceipt |
| Incident Console | Close incident | Incident Owner | high/critical required | IncidentReceipt |

---

## 18. Operational Runbooks

### 18.1 Gate False Interception

```text
1. Mark false_positive candidate.
2. Collect PolicyDecisionReceipt, ActionRiskInput, Trace.
3. Enter Policy Dry-run Review.
4. If false interception is confirmed, adjust policy proposal.
5. policy proposal enters Release Gate, does not directly take effect.
```

### 18.2 Memory Contamination

```text
1. quarantine suspected memory.
2. revoke projection and index.
3. Find sourceEvidenceIds / sourceTraceIds.
4. Replay affected mission.
5. Generate MemoryContaminationIncident.
6. Release MemorySchema/Policy fix version if necessary.
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

### 18.4 Tool partial failure

```text
1. Read PartialCommitReceipt.
2. Find ToolCompensationPlan.
3. If automatic_rollback, execute rollback and verify.
4. If manual_repair, dispatch repair owner.
5. If forward_fix_only, escalate incident.
6. If not_reversible, escalate critical incident.
```

### 18.5 Receipt / Evidence Write Failure

```text
1. If it is a high-risk action, must have PrepareReceipt or durable outbox record before commit.
2. When CommitReceipt write fails, repair worker rebuilds from outbox / commit journal.
3. If outbox is unavailable, prohibit high-risk commit.
4. When side effect has occurred but receipt is missing, immediately generate IncidentReceipt; if State Store is unavailable, write local durable emergency log, supplement after recovery.
```

---

## 19. P0 / P1 / P2 Roadmap

### 19.1 P0a: Read-only Dotting and Boundary Scan

| Sub-stage | Content | Goal |
|---|---|---|
| P0a-0 | Document freeze, schema draft, interface contract | Unify team understanding |
| P0a-1 | traceId, missionId, tenantId, BaseReceiptMinimal shadow | Do not change execution behavior |
| P0a-2 | direct tool import, direct memory write, release bypass scan | First discover problems |
| P0a-3 | ToolGateway shadow, Policy dry-run, Capability coverage | Output gap report |

### 19.2 P0b: Enforce in Batches

| Sub-stage | Content | Goal |
|---|---|---|
| P0b-1 | enforce high-risk tool + H4 approval | High-risk tools cannot bypass approval |
| P0b-2 | enforce L4-L7 memory proposal-only | Long-term memory cannot be directly written |
| P0b-3 | enforce production release gate | Production release must have manifest/eval/rollback |
| P0b-4 | enforce H3 for untrusted tool output | Untrusted tool output cannot directly enter context/memory |
| P0b-5 | minimal approval UI/API | Humans can handle H4 approval |

### 19.3 P0c: Closed Loop and Minimum Evaluation

| Content | Goal |
|---|---|
| H1-lite injection detection | External input basic injection prevention |
| ReleaseManifest canonical hash | Release reproducible |
| EvalReport minimal | release has minimum evaluation basis |
| Memory revoke/projection invalidation | memory contamination can be revoked |
| Security P0 test suite | prompt/tool/memory injection basic samples |
| Receipt/outbox repair worker | High-risk side effects can supplement evidence |

### 19.4 P1: Production Enhancement

| Content | Goal |
|---|---|
| H1-full | Complete input governance |
| SandboxProvider | Risk-adaptive execution environment |
| Trace-native Evaluation | Evaluate trajectory rather than just final answer |
| Cost/Latency blocking gate | Cost and latency can block release |
| Memory privacy workflows | export/delete/revoke/access review |
| Full Admin Console | Approval/Memory/Release/Trace/Policy/Eval/Incident |

### 19.5 P2: Platformization Enhancement

| Content | Goal |
|---|---|
| Harness A/B test | Compare prompt/tool/context/evaluator/sandbox combinations |
| Adaptive Harness Simplification | Reduce over-governance cost |
| Multi-agent handoff protocol | agent/tool/human responsibility transfer is traceable |
| Cross-tool interoperability | MCP/OpenAPI/internal tool gateway unified test |
| Automated improvement loop | Feedback → Learn → Improve → Release semi-automatic closed loop |

---

## 20. Canonical TODO List v1.9

> Note: `OwnerName`, `Reviewer`, `TargetStart`, `TargetEnd`, `IssueLink` in this document default to `TBD`, and must be supplemented during the engineering scheduling phase. Team role owner cannot replace the real owner.

### 20.1 TODO Field Definition

| Field | Description |
|---|---|
| ID | Unique Canonical TODO ID |
| Task | Task |
| Priority | P0a/P0b/P0c/P1/P2 |
| TeamOwner | Team role |
| OwnerName | Real responsible person, TBD if not determined |
| Reviewer | Reviewer, TBD if not determined |
| TargetStart / TargetEnd | Planned time, TBD if not determined |
| CodePath | Target code path |
| TestPath | Target test path |
| VerifyCommand | Acceptance command |
| VerifyCommandStatus | existing / to_add / TBD |
| Rollout | shadow / dry-run / enforce / fail-closed |
| Status | completed / implemented / partial / blocked_by_evidence / pending |
| ValidationEvidence | Most recent verifiable evidence or description |
| Blocking | Whether to block engineering baseline |
| DependsOn | Dependent TODO |
| IssueLink | Task link, TBD if not created |

### 20.2 P0 Blocking TODO

| ID | Task | Priority | TeamOwner | OwnerName | Reviewer | CodePath | TestPath | VerifyCommand | VerifyCommandStatus | Rollout | Status | ValidationEvidence | Blocking | DependsOn | IssueLink |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| DOC-014 | Real repository scan and generate Current Codebase Gap Review | P0a | Architecture | TBD | TBD | `scripts/`, `.github/workflows/`, `package.json` | `tests/invariants/architecture/` | `npm run scan:current-codebase-gap` | existing | shadow | completed | `2026-05-26 npm run scan:current-codebase-gap` generates MD + JSON artifacts | yes | - | TBD |
| DOC-018 | Deduplicate TODO, establish canonical TODO ID and dependency relationships | P0a | Architecture | TBD | TBD | `docs_zh/reference/` | N/A | `npm run docs:markdown-render` | existing | N/A | completed | Canonical TODO ID has converged to a single table; `2026-05-26 npm run docs:markdown-render` passed | yes | - | TBD |
| CI-001 | architecture boundary lint: prohibit direct tool import / direct memory write / release bypass | P0a | Platform | TBD | TBD | `scripts/ci/`, `.github/workflows/` | `tests/invariants/architecture/` | `npm run lint:architecture-boundary` | existing | dry-run | completed | `2026-05-26 npm run lint:architecture-boundary` passed; tool/memory/release facade crossing points have converged to 0 finding | yes | DOC-014 | TBD |
| REC-001 | BaseReceiptMinimal schema + receipt shadow write | P0a | State | TBD | TBD | `src/platform/five-plane-state-evidence/receipts/`, `src/platform/five-plane-state-evidence/side-effect-ledger/`, `src/platform/shared/outbox/` | `tests/unit/platform/state-evidence/receipts/` | `npm run test:receipt-store` | existing | shadow | implemented | `2026-05-26 npm run test:receipt-store` passed; `BaseReceiptMinimal`, ledger/outbox shadow receipt facade have been landed in source code | yes | DOC-014 | TBD |
| TOOL-001 | ToolGateway shadow adapter | P0a | Runtime | TBD | TBD | `src/platform/five-plane-execution/tool-executor/`, `src/platform/five-plane-orchestration/harness/toolbelt/` | `tests/unit/platform/execution/tool-executor/`, `tests/integration/platform/execution/tool-executor/` | `npm run test:integration` | existing | shadow | implemented | Existing tool-executor/toolbelt has formed a reusable trunk; unified facade naming continues to be converged | yes | REC-001 | TBD |
| GOV-001 | H2 Action Gate dry-run | P0a | Control | TBD | TBD | `src/platform/five-plane-control-plane/risk-control/`, `src/platform/five-plane-control-plane/approval-center/` | `tests/integration/platform/control-plane/` | `npm run test:integration` | existing | dry-run | implemented | Risk control / approval trunk exists; needs further alignment with document terminology | yes | REC-001 | TBD |
| GOV-002 | H4 Approval enforce for high-risk tool | P0b-1 | Control | TBD | TBD | `src/platform/five-plane-control-plane/approval-center/`, `src/org-governance/approval-routing/` | `tests/e2e/approval-*.test.ts`, `tests/integration/platform/control-plane/approval-center/` | `npm run test:e2e` | existing | enforce | implemented | Existing approval-center + routing + approval e2e main chain exists | yes | TOOL-001,GOV-001 | TBD |
| TOOL-002 | prepare/commit/verify/compensate with durable outbox | P0b-1 | Runtime | TBD | TBD | `src/platform/five-plane-execution/tool-gateway/`, `src/platform/shared/outbox/`, `src/platform/five-plane-state-evidence/receipts/` | `tests/unit/platform/execution/tool-gateway/` | `npm run test:tool-gateway` | existing | enforce | implemented | `2026-05-26 npm run test:tool-gateway` passed; prepare/commit/verify/compensate has converged with durable outbox in facade form | yes | REC-001,TOOL-001 | TBD |
| MEM-001 | MemoryGateway facade + L4-L7 proposal-only | P0b-2 | State | TBD | TBD | `src/platform/five-plane-state-evidence/memory-gateway/`, `src/platform/five-plane-orchestration/harness/memory-manager.ts` | `tests/unit/platform/state-evidence/memory-gateway/` | `npm run test:memory-gateway` | existing | enforce | implemented | `2026-05-26 npm run test:memory-gateway` passed; `ManagedMemoryMinimal` / `MemoryProposal` / projection / higher-layer proposal-only have been landed in source code interfaces | yes | REC-001 | TBD |
| REL-001 | ReleaseManifestDraft + ReleaseGate enforce for prod | P0b-3 | Release | TBD | TBD | `src/platform/shared/stability/release-gate.ts`, `src/sdk/cli/release-pipeline.ts`, `src/platform/five-plane-control-plane/config-center/` | `tests/unit/platform/shared/stability/`, `tests/integration/platform/execution/stable-release-gate.test.ts` | `npm run gate:stable` | existing | enforce | implemented | `2026-05-26 npm run test:release-gate` passed; `2026-05-26 npm run gate:stable` has output blocking report, currently blocked by insufficient evidence rather than missing code chain | yes | REC-001 | TBD |
| GOV-003 | H3 Observation Gate for untrusted tool output | P0b-4 | Control | TBD | TBD | `src/platform/five-plane-execution/tool-executor/tool-output-sanitizer.ts`, `src/platform/five-plane-execution/tool-executor/mcp-tool-guard.ts` | `tests/unit/platform/execution/tool-executor/`, `tests/e2e/prompt-injection-guard*.test.ts` | `npm run prompt-injection:stable` | existing | enforce | completed | `2026-05-26 npm run prompt-injection:stable` 5/5 scenarios passed | yes | TOOL-002 | TBD |
| UI-001 | Minimal Approval UI/API | P0b-5 | UI | TBD | TBD | `ui/packages/features/approval/`, `src/platform/five-plane-interface/api/http-server/approval-routes.ts` | `ui/tests/unit/ui/packages/features/approval/`, `tests/e2e/approval-*.test.ts` | `npm run test:e2e` | existing | enforce | implemented | Existing approval UI/API exists; still needs to be fully aligned with the "minimal approval UI/API" wording in the document | conditional | GOV-002 | TBD |
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
| MAG-001 | Multi-agent handoff protocol | P2 | Orchestration | implemented | `src/platform/five-plane-orchestration/oapeflir/handoff-model.ts` + `handoff-builder.ts` have formed responsibility transfer protocol; `2026-05-26 npm run test:handoff-protocol` passed |

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

## 22. Business Scenario Landing Matrix

### 22.1 Overview

| Scenario | First-Batch Suitability | Required P0 Capabilities | Main Risk |
|---|---:|---|---|
| Paper Research Agent | high | H1-lite, MemoryGateway, Trace/Eval, Evidence | External document injection, wrong conclusion accumulation |
| Code Review / Test Failure Analysis Agent | high | ToolGateway, Sandbox-lite, Receipt, H3, Eval | Dangerous command, wrong patch, log injection |
| Training Experiment Analysis Agent | medium | ToolGateway, Release/Eval, Cost, Memory | GPU resource waste, wrong attribution |
| YONO Prediction Auxiliary Agent | medium-low | Governance, Evaluation, Audit, H4 | Decision responsibility, external output risk |
| Production Database Operation Agent | low | H4, Rollback, Policy, Sandbox, Audit | High-risk side effects, not suitable for first-batch full automation |

### 22.3 Paper Research Agent Landing Design

| Item | Design |
|---|---|
| Input | Paper PDF, arXiv/OpenReview page, user research question, internal experiment record |
| Tools | Search, PDF parser, document summary, knowledge base write, eval case generation |
| Risk | External document prompt injection, wrong paper conclusion entering L5/L7, wrong citation |
| Required Gate | H1-lite, H3, MemoryProposal, Evidence binding, EvalReport |
| Memory Layer | L2 task notes, L3 session summary, L5 domain conclusion, L7 eval/failure pattern |
| Evaluation | Paper recall rate, citation accuracy, conclusion correctness, experiment suggestion executability |
| Release | Mission Release delivers research report; L5/L7 memory needs review before commit |
| Acceptance Metrics | Citation accuracy ≥ 95%; L5 memory 100% has evidence; external injection samples 100% marked untrusted |

### 22.4 Code Review / Test Failure Analysis Agent First-Batch Landing Design

| Item | Design |
|---|---|
| Input | repo, diff, test log, CI result, architecture document |
| Tools | repo read, test runner, static analyzer, patch generator, PR draft |
| Risk | Dangerous command execution, wrong patch, log injection, accidental file deletion |
| Required Gate | H1-lite for logs/docs, H2 for commands, H3 for tool output, ToolGateway, Receipt, Sandbox-lite |
| Memory Layer | L2 task debug notes, L3 session state, L5 project conventions, L7 recurring failure patterns |
| Evaluation | bug finding precision, false positive, test pass rate, dangerous command block rate |
| Release | Mission Release delivers review report or PR draft; code merge still requires manual review |
| Acceptance Metrics | dangerous command block rate 100%; tool call receipt 100%; patch can only be output as draft, cannot auto merge |

---

## 23. ADR Decision Record

| ADR | Decision | Status |
|---|---|---|
| ADR-001 | Keep Five Plane, do not replace with ETCLOVG | accepted |
| ADR-002 | Harness-driven, not model-driven | accepted |
| ADR-003 | Tool Registry upgraded to Tool Gateway | accepted for architecture release; engineering validation pending |
| ADR-004 | Memory unified governance, not unified physical storage | accepted |
| ADR-005 | L7 memory is not equal to PolicyBundle | accepted |
| ADR-006 | Release Artifact Graph must be lockfile'd | accepted for architecture release; engineering validation pending |
| ADR-007 | H1-lite forward shifted to P0b/P0c | accepted for architecture release; engineering validation pending |
| ADR-008 | high-risk side-effect must have durable outbox / PrepareReceipt first | accepted for architecture release; engineering validation pending |
| ADR-009 | cost/latency P0c advisory, P1 blocking | accepted for architecture release; engineering validation pending |
| ADR-010 | Tool reversibility must participate in risk decision | accepted for architecture release; engineering validation pending |

---

## 24. Release Checklist

### 24.1 Document release checklist

| Item | Status |
|---|---|
| Five Plane / ETCLOVG / OAPEFLIR relationship clear | completed |
| Memory / Policy / Evidence / Context boundary clear | completed |
| P0a/P0b/P0c roadmap clear | completed |
| Current Codebase Gap Matrix defined | completed |
| Real repository scan results filled in | completed (automatic scan version); CI gating not connected, still blocking engineering baseline |
| TODO owner real name filled in | not completed, blocking engineering baseline |
| Whether verify command exists marked | completed, and has distinguished existing aggregate from to_add dedicated |
| CI command entered package.json / workflow | not completed, blocking engineering baseline |
| Release blocking threshold defined | completed |
| Security & Privacy Baseline defined | completed |

### 24.2 Engineering Baseline Freeze Conditions

v1.9 document can already serve as Architecture Review Release; before freezing as the engineering implementation baseline, the following must be satisfied:

```text
1. current-codebase-gap-review-v1.9.md has been generated.
2. All P0 Blocking TODO have been bound to real OwnerName / Reviewer.
3. All P0 verify commands have entered package.json or CI workflow.
4. P0a boundary scan can run and output report.
5. ToolGateway shadow / Policy dry-run / Receipt shadow has at least one E2E path.
6. Release Gate's prod bypass can be discovered by lint or runtime guard.
```


---

## 25. v1.9 Release Decision Matrix

### 25.1 Scope That This Version Can Release

| Release Type | Whether Allowed | Description |
|---|---:|---|
| Architecture Review Release | yes | This version can be officially released as the architecture review version, can be used for architecture review, engineering scheduling, real code scan |
| Engineering Planning Input | yes | TODO, risk, Gate, interface are sufficient to support scheduling discussion |
| P0a Implementation Draft | conditional | Need to first supplement dedicated package scripts and scan scripts |
| Engineering Freeze Baseline | no | Real repository scan, real owner, CI commands not yet completed |
| Production Governance Baseline | no | Has not been verified by E2E, security, eval baseline, and P0b enforce |

### 25.2 Necessary Conditions to Upgrade from v1.9 Architecture Review Release to Engineering Freeze Baseline

1. `current-codebase-gap-review-v1.9.md` and JSON scan report have been generated.
2. All P0 Blocking TODO have been bound to real `OwnerName / Reviewer / TargetStart / TargetEnd / IssueLink`.
3. All P0 verify commands have entered `package.json` or CI workflow, and empty implementation is not allowed.
4. P0a runs at least one E2E shadow path: `Receipt shadow + ToolGateway shadow + Policy dry-run + boundary scan`.
5. H1-lite sample set, ToolRiskMetadata, Transactional Outbox, ReleaseManifest hash, ManagedMemoryMinimal all have minimum tests.
6. At least one first-batch scenario enters baseline eval run, and generates `EvalThresholdVersion`.

### 25.3 Items That Still Need External Input

| Item | Why It Cannot Be Done Directly in the Document |
|---|---|
| Real code path baseline | Need to generate reproducible scan artifacts and solidify to review artifact |
| Real owner | Need team scheduling and management decision |
| Dedicated P0 command landing | Existing aggregate commands have been identified, but dedicated scripts still need to be supplemented |
| Evaluation baseline | Need real eval set and baseline run |
| Production security strategy | Need company security/compliance requirements |

---

## 26. Final Recommendation

The positioning of v1.9-Architecture-Release is:

```text
Can serve as:
- Architecture review draft
- Engineering scheduling input
- P0 refactor task book draft
- Real code scan checklist

Should not directly serve as:
- Frozen engineering implementation baseline
- Production governance standard
- release baseline
- Project plan with owner allocation completed
```

The next focus is not to continue adding new modules, but to complete four things:

```text
1. Scan real code, turn the Gap Matrix from "assumed path" to "code fact".
2. Bind real owner, reviewer, issue, target date to P0 TODO.
3. Add verify command to package.json/CI, and at least run P0a.
4. Prioritize code review / test failure analysis Agent as the first validation scenario, paper research Agent as the second validation scenario, and open up a minimum Harness E2E.
```

One-sentence conclusion:

> **v1.9 has converged the release statement, version consistency, ADR status, engineering freeze conditions and first batch of validation paths remaining from v1.8-RC to the extent that "can be officially released as architecture review version"; but it is still not the engineering freeze baseline, nor the production baseline. Before truly entering implementation, the TBD and assumed paths in the document must be replaced with real repository scans and real owner information.**

---

## References

1. "Agent Harness Engineering: A Survey" and its ETCLOVG taxonomy.
2. Automatic Agent System's existing Five Plane / OAPEFLIR / Harness-driven architecture discussion.
3. `automatic_agent_system_harness_improvement_plan_v1_6_reviewed.md`.
4. Issue list of code mapping, owner, CI command, H1-lite, security privacy, receipt/outbox, evaluation threshold, release boundary etc. proposed in v1.6/v1.7/v1.8 review.

---

## Appendix A: v1.9 Release Revision Summary

| Revision Item | Status |
|---|---|
| Add system boundary diagram | completed |
| Add Current Codebase Gap Matrix credibility marking | completed |
| Add CI Command Contract | completed |
| Add P0b-1 to P0b-5 | completed |
| H1-lite forward shifted | completed |
| Release threshold concretized | completed |
| Cost/Latency advisory/blocking stage fix | completed |
| Receipt / durable outbox atomicity | completed |
| Tool reversibility risk rule | completed |
| ManagedMemoryMinimal schema | completed |
| Security & Privacy Baseline | completed |
| First batch of business scenarios expanded | completed |
| TODO deduplication | completed |
| Real code scan | not completed, needs engineering execution |
| Real owner filling | not completed, needs project scheduling |
| CI command landing | not completed, needs engineering execution |
| H1-lite minimum test set definition | completed |
| ToolRiskMetadata required contract | completed |
| Transactional Outbox transaction boundary | completed |
| Eval baseline calibration protocol | completed |
| Security Gate componentization | completed |
| Release Decision Matrix | completed |

---

## Appendix B: Version Revision Record

| Version | Description |
|---|---|
| v1.1 | Initial Harness Improvement Plan |
| v1.2 | Add Seven-layer Memory Revision |
| v1.3 | Memory Gate Independent Enhancement Patch |
| v1.4 | Merge Memory Gate into Main Document |
| v1.5 | Add TODO List, Release / Memory / Policy Boundary Fix |
| v1.6 | Add Current Gap Matrix, Minimal P0, Rollout, Risk Matrix, Runbook, RBAC |
| v1.7 | Fix v1.6 landing issues: real scan marking, CI command status, P0b subdivision, H1-lite, security privacy, receipt/outbox, threshold and business scenarios |
| v1.8 | Fix v1.7 release boundary issues: H1-lite test set, ToolRiskMetadata, Transactional Outbox, Eval baseline calibration, Security Gate componentization, package.json script contract and Release Decision Matrix |
| v1.9 | Architecture Review Release: fix version references, engineering freeze conditions, ADR release status, first batch of validation scenario recommendations, and clarify release type and prohibited uses |
