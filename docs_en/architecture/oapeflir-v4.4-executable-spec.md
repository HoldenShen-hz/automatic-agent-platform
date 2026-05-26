# OAPEFLIR v4.4 Complete Edition

## Executable Specification Edition: Cognitive/Governance Semantics and Migration Input Specification

> **Version**: v4.4
> **Status**: Reference Draft (Migration Input; Not Authoritative Runtime Baseline)
> **Positioning**: OAPEFLIR v4.4 only retains cognitive/governance semantics, projection views, and migration design inputs; the only executable runtime entry remains `HarnessRuntime`, and the authoritative execution objects remain `HarnessRun / PlanGraphBundle / NodeRun / NodeAttemptReceipt`
> **Core Changes**: Retain design intent for Event Registry, PlanGraph, Deterministic Scheduler, SideEffect, Budget, HITL, Guardrail, Replay, Learning Release, but all executable authoritative semantics must converge to `docs_zh/architecture/00-platform-architecture.md`, ADR-109~112, and canonical executable contracts.

---

## Table of Contents

- [0. v4.4 Core Conclusions](#0-v44-core-conclusions)
- [1. Design Goals](#1-design-goals)
- [2. OAPEFLIR Eight-Phase Definition](#2-oapeflir-eight-phase-definition)
- [3. Overall Runtime Architecture](#3-overall-runtime-architecture)
- [4. Core Runtime Entities](#4-core-runtime-entities)
- [5. NodeRun State Machine](#5-noderun-state-machine)
- [6. Plan Must Be a Graph](#6-plan-must-be-a-graph)
- [7. PlanGraph Contract](#7-plangraph-contract)
- [8. Graph Normalization](#8-graph-normalization)
- [9. Graph Validation](#9-graph-validation)
- [10. Graph Risk Propagation](#10-graph-risk-propagation)
- [11. Graph Worst-Path Analysis](#11-graph-worst-path-analysis)
- [12. Graph Scheduler Deterministic Scheduling](#12-graph-scheduler-deterministic-scheduling)
- [13. GraphPatch and Replan](#13-graphpatch-and-replan)
- [14. Event Registry](#14-event-registry)
- [15. Budget Ledger](#15-budget-ledger)
- [16. SideEffect Manager](#16-sideeffect-manager)
- [17. Reconciliation State Machine](#17-reconciliation-state-machine)
- [18. Context Assembly Contract](#18-context-assembly-contract)
- [19. Prompt Execution Contract](#19-prompt-execution-contract)
- [20. LLM Decision Record and Deterministic Replay](#20-llm-decision-record-and-deterministic-replay)
- [21. Tool Output Taint Model](#21-tool-output-taint-model)
- [22. Memory Write Governance](#22-memory-write-governance)
- [23. Guardrails Five-Layer Execution Model](#23-guardrails-five-layer-execution-model)
- [24. Decision Engine](#24-decision-engine)
- [25. Runtime Profile / Runtime Mode / Autonomy Mode](#25-runtime-profile--runtime-mode--autonomy-mode)
- [26. HITL Runtime](#26-hitl-runtime)
- [27. Final Output Contract](#27-final-output-contract)
- [28. Causal Lineage Query](#28-causal-lineage-query)
- [29. Run Version Lock](#29-run-version-lock)
- [30. Effective Policy Snapshot](#30-effective-policy-snapshot)
- [31. Learning Candidate](#31-learning-candidate)
- [32. Evaluation Harness](#32-evaluation-harness)
- [33. Release Pipeline](#33-release-pipeline)
- [34. Error Code Taxonomy](#34-error-code-taxonomy)
- [35. Observability Metrics](#35-observability-metrics)
- [36. Incident Rules](#36-incident-rules)
- [37. Runtime Capability Matrix](#37-runtime-capability-matrix)
- [38. Runtime Test Matrix](#38-runtime-test-matrix)
- [39. Implementation Directory Recommendations](#39-implementation-directory-recommendations)
- [40. v4.4 Minimum Implementation Roadmap](#40-v44-minimum-implementation-roadmap)
- [41. v4.4 ADR Freeze List](#41-v44-must-freeze-adrs)
- [42. Final Judgment](#42-final-judgment)

---

# 0. v4.4 Core Conclusions

The core purpose of OAPEFLIR v4.4 is:

> **Express the Agent's "Observe, Assess, Plan, Execute, Feedback, Learn, Improve, Release" as a set of controlled cognitive/governance semantics to explain and constrain the `HarnessRuntime` main chain, rather than defining a second execution runtime.**

v4.4 no longer only describes "how the Agent should think", but explicitly defines:

```text
Which state transitions must first be committed as truth by HarnessRuntime / RuntimeStateMachine
Which events and evidence must be interpreted by OAPEFLIR as closed-loop views
Which graph execution, budget, side effects, pause, retry, human takeover rules
must be defined by the main architecture and canonical contracts first, with OAPEFLIR only able to reference and explain them
```

One sentence summary:

```text
OAPEFLIR v4.4 = Controlled Cognitive/Governance Semantics over HarnessRuntime
```

---

# 1. Design Goals

## 1.1 Overall Goal

Build an Agent platform runtime kernel that can run stably for extended periods, solve complex real problems, and deliver productivity value.

It must satisfy:

| Goal | Description |
|---|---|
| Stable | Recoverable after Worker crash, LLM failure, tool failure, external system exception |
| Reliable | Closed state machine, traceable events, confirmable side effects |
| Intelligent | Plan is a Graph, can be replanned, evaluated, learned from |
| Controllable | Risk, budget, tools, permissions, context, output all constrained |
| Auditable | Every decision, tool call, human approval, side effect has evidence chain |
| Recoverable | Supports checkpoint, pause, resume, replay, redrive, repair |
| Evolvable | Prompt, Policy, Tool, Model, Domain, Eval all versioned |
| Operable | Has metrics, incident, DLQ, reconciliation, dashboard |
| Verifiable | Supports state machine testing, property testing, fault injection, replay consistency testing |

---

# 2. OAPEFLIR Eight-Phase Definition

OAPEFLIR maintains eight phases, but v4.4 explicitly defines the engineering boundary for each phase.

```text
Observe
  → Assess
  → Plan
  → Execute
  → Feedback
  → Learn
  → Improve
  → Release
```

## 2.1 Phase Responsibility Summary

| Phase | Responsibility | Output | Can Directly Produce Side Effects |
|---|---|---|---|
| Observe | Observe inputs, events, context, goals | ObservationBundle | No |
| Assess | Risk, permissions, feasibility, budget, strategy assessment | AssessmentBundle | No |
| Plan | Generate executable PlanGraph | PlanGraphBundle | No |
| Execute | Consume node execution facts already advanced by `HarnessRuntime`, and generate stage views | `NodeRun` / `NodeAttemptReceipt` / `oapeflir.view.*` | No (side effects still controlled and submitted by Harness main chain) |
| Feedback | Feedback on execution results, deviations, quality, risk | FeedbackEnvelope | No |
| Learn | Extract candidate experiences from feedback | LearningCandidate | No |
| Improve | Generate Prompt / Policy / Tool / Domain improvement candidates | ImprovementChangeSet | No |
| Release | Evaluate, approve, canary, publish, rollback | ReleaseRecord | Yes, but limited to configuration publishing |

---

# 3. Overall Runtime Architecture

```text
RequestEnvelope
   │
   ▼
┌─────────────────────────────────────────────────────────┐
│          HarnessRuntime Mainline + OAPEFLIR Projection  │
│                                                         │
│  Observe ─→ Assess ─→ PlanGraph ─→ Graph Scheduler       │
│                              │                          │
│                              ▼                          │
│                Canonical Node Execution Mainline         │
│                              │                          │
│             ┌────────────────┼────────────────┐         │
│             ▼                ▼                ▼         │
│       Tool / LLM         HITL Wait        Subgraph       │
│             │                │                │          │
│             ▼                ▼                ▼          │
│       SideEffect        HumanDecision     ChildRun       │
│       Manager              │                │            │
│             └──────────────┼────────────────┘            │
│                            ▼                             │
│                       Evaluator                          │
│                            │                             │
│             ┌──────────────┼───────────────┐             │
│             ▼              ▼               ▼             │
│          accept          retry            replan          │
│             │              │               │             │
│             ▼              ▼               ▼             │
│        next node      new attempt      graph patch        │
│                            │                             │
│                            ▼                             │
│                    Feedback / Learn / Improve             │
│                            │                             │
│                            ▼                             │
│                       Release Gate                        │
└─────────────────────────────────────────────────────────┘
```

---

# 4. Core Runtime Entities

## 4.1 HarnessRun is the Only Authoritative Run

`HarnessRun` is the only authoritative entity for a complete run; this spec no longer treats `OapeflirRun` as an executable truth object. Old `OapeflirRun` is only allowed to appear as a migration alias or explainability projection.

## 4.2 OapeflirTraceProjection

```ts
type OapeflirTraceProjection = {
  projectionId: string;
  harnessRunId: string;
  currentStage:
    | "observe"
    | "assess"
    | "plan"
    | "execute"
    | "feedback"
    | "learn"
    | "improve"
    | "release";
  stageRationaleRefs: string[];
  sourceEventIds: string[];
  evidenceRefs: string[];
  updatedAt: string;
};
```

## 4.3 State Authority Boundaries

```text
1. HarnessRun.status is the only executable Run state source.
2. OAPEFLIR stages only express stage projections, and do not own run status / lease / retry counter / budget state.
3. Any real state transition must go through RuntimeStateMachine.transition(command).
4. replay / redrive / repair can only append new Harness / Node / Attempt / Evidence records, and must not overwrite old truth.
```

---

# 5. NodeRun Lifecycle Projection (References Canonical Contract)

## 5.1 NodeRun

> This section only references the canonical shape from `node-run-attempt-receipt-contract.md` as a migration input summary; the true state set and legal transitions authority for NodeRun are not defined within the OAPEFLIR spec.

```ts
type NodeRun = {
  nodeRunId: string;
  harnessRunId: string;
  planGraphBundleId: string;
  graphVersion: number;
  nodeId: string;

  status: NodeRunStatus;

  attemptLineage: AttemptLineage;

  inputContextRef?: string;
  outputRef?: string;

  leaseRef?: string;
  executorRef?: string;

  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  cancelledAt?: string;

  sideEffectRefs: string[];
  evaluationReportRef?: string;

  error?: AppError;
  evidenceRefs: string[];
};
```

## 5.2 NodeRunStatus

```ts
type NodeRunStatus =
  | "created"
  | "ready"
  | "leased"
  | "running"
  | "retry_wait"
  | "awaiting_hitl"
  | "reconciling"
  | "succeeded"
  | "failed"
  | "skipped"
  | "cancelled"
  | "dependency_failed"
  | "policy_blocked"
  | "aborted";
```

## 5.3 Node State Transitions

```text
created
  → ready

ready
  → leased
  → running

running
  → retry_wait
  → awaiting_hitl
  → reconciling
  → succeeded / failed / skipped / cancelled / dependency_failed / policy_blocked / aborted

retry_wait
  → ready
```

## 5.4 Node Terminal State Closure Rules (Interpretive Constraints)

```text
1. `succeeded / failed / skipped / cancelled / dependency_failed / policy_blocked / aborted` are terminal states and must not transition out.
2. Retry can only be expressed by appending a new attemptId, and must not overwrite the original failure record.
3. After `awaiting_hitl` resumes, it must return to the active execution chain, and must not disguise as a normal `blocked`.
4. `reconciling` only indicates the side effect/external state confirmation phase, and must not be written as `compensating / compensated` — node states owned by OAPEFLIR.
5. Redrive must preserve lineage.
```

## 5.5 AttemptLineage

```ts
type AttemptLineage = {
  originalNodeRunId: string;
  attemptId: string;
  attemptIndex: number;

  previousAttemptId?: string;
  redriveId?: string;

  retryReason?: string;
  triggeredBy:
    | "runtime_retry"
    | "evaluator_retry"
    | "human_redrive"
    | "repair_worker"
    | "replay_simulation";
};
```

---

# 6. Plan Must Be a Graph

## 6.1 Basic Principle

v4.4 explicitly stipulates:

> **Plan is not allowed to be simple linear steps. Plan must be a PlanGraph.**

Reason: Complex real problems typically include:

```text
Parallel tasks
Conditional branches
Human approval
Subgraph delegation
Failure compensation
Rollback paths
External waits
Replanning patches
join / merge
```

Linear steps cannot express these complex structures.

---

# 7. PlanGraph Contract

## 7.1 PlanGraphBundle

```ts
type PlanGraphBundle = {
  planGraphId: string;
  runId: string;
  graphVersion: number;

  graph: PlanGraph;

  normalizationReport: GraphNormalizationReport;
  validationReport: GraphValidationReport;
  riskPropagationReport: GraphRiskPropagationReport;
  worstPathAnalysis: GraphWorstPathAnalysis;

  generatedBy: "planner_agent" | "human_operator" | "template";

  promptExecutionRef?: string;
  modelDecisionRef?: string;

  createdAt: string;
  evidenceRefs: string[];
};
```

## 7.2 PlanGraph

```ts
type PlanGraph = {
  nodes: PlanNode[];
  edges: PlanEdge[];

  entryNodeIds: string[];
  terminalNodeIds: string[];

  variables: GraphVariable[];

  schedulerPolicy: ReadyNodeSchedulingPolicy;

  graphConstraints: {
    maxNodes: number;
    maxDepth: number;
    maxParallelism: number;
    maxLoopIterations: number;
    allowCycles: false;
  };
};
```

## 7.3 PlanNode

```ts
type PlanNode = {
  nodeId: string;

  kind:
    | "llm_call"
    | "tool_call"
    | "verify"
    | "human_gate"
    | "decision"
    | "join"
    | "branch"
    | "subgraph"
    | "sub_agent"
    | "wait"
    | "side_effect_commit"
    | "compensation"
    | "finalize";

  displayName: string;

  inputRefs: string[];
  outputRefs: string[];

  requiredCapabilities: string[];
  requiredTools?: string[];

  riskLevel: RiskLevel;
  dataClass: DataClass;

  timeoutMs: number;
  retryPolicyRef?: string;
  compensationNodeId?: string;

  successCriteria: SuccessCriterion[];

  debug?: {
    category: string;
    expectedDurationMs?: number;
    expectedCost?: number;
    owner?: string;
    troubleshootingGuideRef?: string;
  };
};
```

## 7.4 PlanEdge

```ts
type PlanEdge = {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;

  type:
    | "control"
    | "data"
    | "condition"
    | "error"
    | "compensation"
    | "human_resume";

  condition?: {
    expression: string;
    evaluator: "deterministic" | "policy" | "llm_judge_for_noncritical_only";
  };

  dataMapping?: {
    fromOutput: string;
    toInput: string;
    transform?: string;
  };
};
```

---

# 8. Graph Normalization

Draft graphs generated by LLM or humans must not be executed directly; they must undergo normalization.

## 8.1 Normalization Process

```text
Draft Graph
  → Normalize Node Types
  → Resolve Tool References
  → Resolve Variable References
  → Insert Verify Nodes
  → Insert Human Gate Nodes
  → Insert Compensation Nodes
  → Insert Budget Checkpoints
  → Insert Guardrail Hooks
  → Validate Graph
  → Freeze Graph Version
```

## 8.2 GraphNormalizationReport

```ts
type GraphNormalizationReport = {
  insertedVerifyNodes: string[];
  insertedHumanGateNodes: string[];
  insertedCompensationNodes: string[];
  insertedBudgetCheckNodes: string[];
  insertedGuardrailHooks: string[];

  resolvedToolRefs: string[];
  unresolvedRefs: string[];

  warnings: string[];
  blockingErrors: OapeflirError[];
};
```

---

# 9. Graph Validation

## 9.1 Required Validation Items

```text
1. Must have at least one entry node.
2. Must have at least one terminal node.
3. No undeclared node types allowed.
4. No orphan nodes allowed.
5. No unbounded loops allowed.
6. No wait / human_gate without timeout allowed.
7. No high risk node lacking verification allowed.
8. No irreversible side effect lacking confirmation / reconciliation allowed.
9. No join waiting for branches that will never trigger allowed.
10. No cross-permission data flow allowed.
```

## 9.2 GraphValidationReport

```ts
type GraphValidationReport = {
  valid: boolean;

  errors: OapeflirError[];
  warnings: OapeflirError[];

  detectedDeadlocks: string[];
  detectedUnboundedPaths: string[];
  detectedPermissionViolations: string[];
  detectedMissingCompensations: string[];
};
```

---

# 10. Graph Risk Propagation

## 10.1 Risk Propagation Rules

```text
1. If an upstream node reads restricted data, downstream consumer nodes have risk at least medium.
2. If a node produces irreversible side effect, downstream join / terminal must check confirmation.
3. If a branch contains external write, the entire subgraph risk is not lower than high.
4. If tool output taint = potential_prompt_injection, downstream LLM nodes must isolate context.
5. If any node requires human_gate, subsequent side_effect_commit must not bypass human approval scope.
```

## 10.2 GraphRiskPropagationReport

```ts
type GraphRiskPropagationReport = {
  nodeRiskBefore: Record<string, RiskLevel>;
  nodeRiskAfter: Record<string, RiskLevel>;
  escalationReasons: Record<string, string[]>;
};
```

---

# 11. Graph Worst-Path Analysis

Worst-path must be calculated before complex graph execution.

```ts
type GraphWorstPathAnalysis = {
  longestDurationPath: string[];
  highestCostPath: string[];
  highestRiskPath: string[];
  maxExternalDependencyPath: string[];
  maxHumanWaitPath: string[];
  maxIrreversibleSideEffectPath: string[];

  estimatedMaxCost: number;
  estimatedMaxDurationMs: number;
  estimatedMaxHumanWaitMs: number;

  feasibleWithinBudget: boolean;
  feasibleWithinDeadline: boolean;
};
```

Hard rules:

```text
1. If worst-path budget exceeds limit, PlanGraph must not enter ready state.
2. If highest risk path lacks HITL / verification, PlanGraph must not execute.
3. If irreversible side effect path lacks confirmation, reconciliation must be inserted.
```

---

# 12. Graph Scheduler Deterministic Scheduling

Graph Scheduler belongs to the P4 execution responsibility of `HarnessRuntime`; OAPEFLIR only consumes scheduling facts and generates scheduler rationale / view.

## 12.1 ReadyNodeSchedulingPolicy

```ts
type ReadyNodeSchedulingPolicy = {
  primary:
    | "topological_order"
    | "priority_first"
    | "critical_path_first"
    | "risk_low_first"
    | "deadline_first";

  secondary:
    | "node_id_lexical"
    | "stable_hash"
    | "created_order";

  deterministicTieBreaker: "stable_hash";

  concurrencyLimit: {
    maxGlobalReadyNodes: number;
    maxPerRiskLevel: Record<RiskLevel, number>;
    maxPerTool: Record<string, number>;
    maxPerTenant: number;
  };
};
```

## 12.2 Scheduling Hard Rules

```text
1. Graph Scheduler must be deterministic.
2. Same graph + same runtime seed + same event history must produce identical scheduling order.
3. Parallel nodes must also be stably sorted.
4. Replay must not reselect scheduling order.
5. Scheduling decisions must be recorded as `platform.scheduler.decision_recorded` events.
```

---

# 13. GraphPatch and Replan

## 13.1 GraphPatch

```ts
type GraphPatch = {
  patchId: string;
  runId: string;

  baseGraphVersion: number;
  targetGraphVersion: number;

  operations: GraphPatchOperation[];

  reason:
    | "evaluator_requested_replan"
    | "human_patch"
    | "tool_failure"
    | "policy_change"
    | "budget_constraint"
    | "environment_change";

  compatibilityReport: GraphPatchCompatibilityReport;

  createdBy: PrincipalRef;
  createdAt: string;
};
```

## 13.2 GraphPatchOperation

```ts
type GraphPatchOperation =
  | { op: "add_node"; node: PlanNode }
  | { op: "remove_node"; nodeId: string }
  | { op: "replace_node"; nodeId: string; node: PlanNode }
  | { op: "add_edge"; edge: PlanEdge }
  | { op: "remove_edge"; edgeId: string }
  | { op: "replace_edge"; edgeId: string; edge: PlanEdge }
  | { op: "update_variable"; variable: GraphVariable };
```

## 13.3 GraphPatchCompatibilityReport

```ts
type GraphPatchCompatibilityReport = {
  compatible: boolean;

  completedNodesPreserved: boolean;
  activeNodeMigrationPathExists: boolean;
  checkpointMappingValid: boolean;
  joinSemanticsPreserved: boolean;

  blockedReasons: string[];
};
```

Hard rules:

```text
1. Completed nodes must not be deleted, only marked as superseded.
2. Active nodes must not be replaced unless first paused.
3. After GraphPatch, old checkpoints must be mappable to new graph.
4. Join semantic changes must trigger human review.
```

---

# 14. Event Registry

## 14.1 OapeflirEvent

```ts
type OapeflirEvent = {
  eventId: string;
  eventType: OapeflirEventType;
  eventVersion: number;

  runId: string;
  nodeRunId?: string;

  sequence: number;
  causationId?: string;
  correlationId: string;

  occurredAt: string;
  recordedAt: string;

  principal: PrincipalRef;
  traceId: string;

  payload: unknown;
  payloadHash: string;

  replayBehavior:
    | "replay_state_transition"
    | "replay_decision"
    | "reuse_recorded_result"
    | "ignore_projection_only"
    | "forbidden";

  idempotencyKey: string;
};
```

## 14.2 Event Type Hierarchy

```ts
type PlatformFactEventType =
  | "platform.harness_run.created"
  | "platform.harness_run.admitted"
  | "platform.harness_run.running"
  | "platform.harness_run.completed"
  | "platform.harness_run.failed"
  | "platform.node_run.ready"
  | "platform.node_run.leased"
  | "platform.node_run.running"
  | "platform.node_run.awaiting_hitl"
  | "platform.node_run.reconciling"
  | "platform.node_run.succeeded"
  | "platform.node_run.failed"
  | "platform.side_effect.proposed"
  | "platform.side_effect.committed"
  | "platform.budget.reserved"
  | "platform.budget.consumed";

type OapeflirProjectionEventType =
  | "oapeflir.view.run_lifecycle"
  | "oapeflir.view.stage"
  | "oapeflir.view.graph"
  | "oapeflir.view.node_lifecycle"
  | "oapeflir.view.side_effect"
  | "oapeflir.view.hitl"
  | "oapeflir.view.budget"
  | "oapeflir.rationale.decision";
```

Hard rules:

```text
1. Truth projectors can only consume platform.* facts.
2. OAPEFLIR events must only use `oapeflir.view.*` / `oapeflir.rationale.*`, and must not disguise as `run.*` / `node.*` / `side_effect.*` truth events.
3. Projection events must not反向 drive HarnessRun / NodeRun / Budget / SideEffect truth.
```

## 14.3 Event Hard Rules

```text
1. All state changes must be event-driven.
2. Event append and truth state update must be in the same transaction.
3. Event sequence is monotonically increasing within a run.
4. Event payload must have schema version.
5. Events are not allowed to be physically deleted.
6. Projections can only be rebuilt from Events, and must not反写 truth.
7. Replay must comply with replayBehavior.
```

---

# 15. Budget Ledger

Budget truth belongs to P5/Budget service; HarnessRuntime can only interact with it through `BudgetReservation` / `BudgetSettlement`. OAPEFLIR does not own independent budget state.

## 15.1 BudgetLedger

```ts
type BudgetLedger = {
  harnessRunId: string;

  reservedCost: number;
  actualCost: number;
  remainingCost: number;

  reservedTokens: number;
  actualTokens: number;

  reservedToolCalls: number;
  actualToolCalls: number;

  reservationRecords: BudgetReservation[];

  exhausted: boolean;
};
```

## 15.2 BudgetReservation

```ts
type BudgetReservation = {
  reservationId: string;

  scope:
    | "run"
    | "node"
    | "tool_call"
    | "llm_call"
    | "side_effect"
    | "evaluation";

  amount: number;

  status:
    | "reserved"
    | "consumed"
    | "released"
    | "expired";

  createdAt: string;
  consumedAt?: string;
  releasedAt?: string;
};
```

## 15.3 Budget Hard Rules

```text
1. Budget must be reserved before LLM call.
2. Budget must be reserved before Tool call.
3. Budget must be reserved before SideEffect commit.
4. Evaluation / Judge calls must also be charged.
5. On call failure, consume / release according to strategy.
6. Budget exhausted takes priority over retry / replan.
7. Replan must redo worst-path budget analysis.
```

---

# 16. SideEffect Manager

SideEffect is controlled and advanced by HarnessRuntime in the P4 main chain; OAPEFLIR can only consume side-effect facts and generate explanatory projections, and does not own independent side effect commit authority.

## 16.1 SideEffectRecord

```ts
type SideEffectRecord = {
  sideEffectId: string;
  runId: string;
  nodeRunId: string;

  type: SideEffectType;

  status: SideEffectStatus;

  deliveryContract: SideEffectExecutionContract;
  reversibilityProfile: ReversibilityProfile;

  proposedPayloadRef: string;
  approvedPayloadRef?: string;

  externalRequestId?: string;
  externalReceiptId?: string;

  confirmationRef?: string;
  reconciliationRef?: string;

  compensationRef?: string;

  evidenceRefs: string[];
};
```

## 16.2 SideEffectType

```ts
type SideEffectType =
  | "file_write"
  | "db_write"
  | "api_write"
  | "message_send"
  | "email_send"
  | "sms_send"
  | "payment"
  | "order_submit"
  | "content_publish"
  | "deployment"
  | "permission_change"
  | "credential_rotation"
  | "data_export"
  | "data_delete"
  | "user_notification"
  | "financial_transaction"
  | "production_config_change"
  | "model_release"
  | "policy_release";
```

## 16.3 SideEffectStatus

```ts
type SideEffectStatus =
  | "proposed"
  | "policy_checking"
  | "approval_required"
  | "approved"
  | "denied"
  | "committing"
  | "committed"
  | "confirming"
  | "confirmed"
  | "ambiguous"
  | "failed"
  | "compensating"
  | "compensated"
  | "manual_reconciliation_required";
```

## 16.4 SideEffectExecutionContract

```ts
type SideEffectDeliverySemantics =
  | "at_most_once"
  | "at_least_once"
  | "effectively_once_with_idempotency"
  | "manual_once";

type SideEffectExecutionContract = {
  sideEffectType: SideEffectType;

  deliverySemantics: SideEffectDeliverySemantics;

  idempotencyRequired: boolean;
  externalIdempotencySupported: boolean;

  duplicateDetectionMethod:
    | "idempotency_key"
    | "external_receipt_id"
    | "business_key"
    | "content_hash"
    | "manual_review";

  confirmationMethod:
    | "read_after_write"
    | "webhook_callback"
    | "external_receipt_id"
    | "audit_log_query"
    | "manual_confirmation";

  duplicateResolution:
    | "ignore_duplicate"
    | "merge"
    | "compensate_duplicate"
    | "manual_reconciliation";
};
```

## 16.5 ReversibilityProfile

```ts
type ReversibilityProfile = {
  technicalReversibility:
    | "reversible"
    | "partially_reversible"
    | "irreversible";

  businessReversibility:
    | "reversible"
    | "compensatable"
    | "costly_compensation"
    | "irreversible";

  legalReversibility:
    | "no_legal_effect"
    | "requires_notice"
    | "requires_regulatory_record"
    | "irreversible_legal_effect";
};
```

## 16.6 SideEffect Commit Process

```text
Executor Output
  → proposed side effect
  → policy check
  → approval check
  → preflight / dry-run
  → commit
  → confirm
  → reconciliation if ambiguous
  → compensation if needed
```

Hard rules:

```text
1. Tool execution success does not equal side effect success.
2. SideEffect must first be proposed, then approved, then committed.
3. Irreversible side effect must have confirmationMethod.
4. Ambiguous must not automatically become succeeded.
5. High / critical side effect must support reconciliation.
6. Compensation must not delete original side effect records.
```

---

# 17. Reconciliation State Machine

## 17.1 ReconciliationRecord

```ts
type ReconciliationStatus =
  | "pending"
  | "checking_external_state"
  | "matched_confirmed"
  | "matched_failed"
  | "ambiguous"
  | "requires_manual_review"
  | "resolved"
  | "expired";

type ReconciliationRecord = {
  reconciliationId: string;
  sideEffectId: string;
  runId: string;
  nodeRunId: string;

  status: ReconciliationStatus;

  attempts: number;
  maxAttempts: number;

  externalStateRefs: string[];
  evidenceRefs: string[];

  resolution?:
    | "confirm_side_effect"
    | "mark_failed"
    | "compensate"
    | "manual_resolution"
    | "abort_run"
    | "continue_with_warning";
};
```

## 17.2 Reconciliation Hard Rules

```text
1. Ambiguous must not automatically become confirmed.
2. Irreversible side effect ambiguous must be handled manually.
3. Reconciliation timeout must escalate incident.
4. Reconciliation result must write back to SideEffectRecord.
5. manual_resolution must record HumanResponsibilityRecord.
```

---

# 18. Context Assembly Contract

## 18.1 ContextAssemblyContract

```ts
type ContextAssemblyContract = {
  contextId: string;
  runId: string;
  nodeRunId?: string;

  targetRole:
    | "planner"
    | "generator"
    | "evaluator"
    | "verifier"
    | "judge"
    | "hitl_operator";

  includedRefs: ContextItemRef[];
  excludedRefs: ContextExclusion[];

  tokenBudget: number;
  tokenUsed: number;

  taintPolicyApplied: boolean;
  redactionPolicyApplied: boolean;

  contextHash: string;
};
```

## 18.2 ContextItemRef

```ts
type ContextItemRef = {
  refId: string;

  source:
    | "user_input"
    | "system_state"
    | "tool_output"
    | "memory"
    | "knowledge"
    | "artifact"
    | "prior_decision"
    | "human_feedback";

  dataClass: DataClass;
  taint: ToolOutputTaint;

  includedReason: string;
};
```

## 18.3 Context Hard Rules

```text
1. Planner / Generator / Evaluator must use different ContextAssemblyContract.
2. Context must be hashable and replayable.
3. external_untrusted can only enter user/data zones, and must not enter system/developer zones.
4. Redacted fields must not leak through summary.
5. Restricted data must not enter unauthorized subgraph / subagent.
```

---

# 19. Prompt Execution Contract

## 19.1 PromptExecutionContract

```ts
type PromptExecutionContract = {
  promptId: string;
  promptVersion: string;

  role:
    | "planner"
    | "generator"
    | "evaluator"
    | "judge";

  allowedContextTaintLevels: ToolOutputTaint[];

  outputSchemaRef: string;

  injectionBoundaryPolicy:
    | "strict_role_separation"
    | "quoted_context"
    | "tool_output_boundary"
    | "no_external_context";

  canUseTools: boolean;
  canMakeDecisions: boolean;
  canProposeSideEffects: boolean;
};
```

## 19.2 Prompt Hard Rules

```text
1. Planner / Generator / Evaluator Prompt must be independently versioned.
2. Evaluator Prompt must not be shared with Generator Prompt.
3. Judge Prompt must not access holdout standard answers.
4. Planner Prompt must not receive forbidden_for_planning content.
5. Prompt changes must pass Evaluation Gate.
```

---

# 20. LLM Decision Record and Deterministic Replay

## 20.1 LlmDecisionRecord

```ts
type LlmDecisionRecord = {
  decisionId: string;
  runId: string;
  nodeRunId?: string;

  promptExecutionContractRef: string;
  contextAssemblyContractRef: string;

  provider: string;
  model: string;
  modelVersion?: string;

  requestHash: string;
  responseHash: string;

  temperature: number;
  seed?: string;

  outputSchemaRef: string;
  parsedOutputRef: string;
  rawOutputArtifactRef: string;

  usage: {
    inputTokens: number;
    outputTokens: number;
    cost: number;
    latencyMs: number;
  };

  replayMode:
    | "reuse_recorded_output"
    | "isolated_reexecution_replay"
    | "forbidden";

  createdAt: string;
};
```

## 20.2 DeterministicRuntimeSeed

```ts
type DeterministicRuntimeSeed = {
  runId: string;
  logicalClockStart: string;
  randomSeed: string;
  environmentSnapshotRef: string;
  configVersion: string;
};
```

Hard rules:

```text
1. Replay defaults to reusing recorded LLM output (Trace Replay).
2. Only isolated simulation / sandbox mode allows `isolated_reexecution_replay`, and results must not overwrite original truth/evidence.
3. All non-deterministic inputs must be recorded: time, random numbers, environment variables, config versions.
4. Replay must not produce real side effects.
```

---

# 21. Tool Output Taint Model

## 21.1 ToolOutputTaint

```ts
type ToolOutputTaint =
  | "trusted_verified"
  | "trusted_unverified"
  | "external_untrusted"
  | "user_supplied"
  | "potential_prompt_injection"
  | "secret_bearing"
  | "pii_bearing"
  | "restricted";
```

## 21.2 Taint Propagation Rules

```text
1. external_untrusted must have boundary isolation before entering LLM.
2. potential_prompt_injection must not enter planner system prompt.
3. secret_bearing must not be written to memory / knowledge.
4. pii_bearing must be processed according to data policy.
5. restricted must not propagate across tenant / domain.
```

---

# 22. Memory Write Governance

## 22.1 MemoryWriteRequest

```ts
type MemoryWriteRequest = {
  requestId: string;
  runId: string;
  nodeRunId?: string;

  memoryScope:
    | "working"
    | "long_term"
    | "shared_knowledge";

  contentRef: string;

  source:
    | "user"
    | "tool"
    | "evaluator"
    | "human_operator"
    | "learning_candidate";

  dataClass: DataClass;
  taint: ToolOutputTaint;

  promotionRequired: boolean;
  approvalRequired: boolean;
};
```

## 22.2 Memory Write Hard Rules

```text
1. Tool output must not directly write to `long_term` or `shared_knowledge`.
2. potential_prompt_injection must not write to `long_term` / `shared_knowledge`.
3. Restricted data must not write to `shared_knowledge`.
4. Memory write must pass before_memory_write guardrail.
5. Shared memory promotion must have audit record.
```

---

# 23. Guardrails Five-Layer Execution Model

The five-layer Guardrail is enforced by HarnessRuntime execution chain and P2 control plane together; OAPEFLIR only records guardrail view / rationale, and does not own independent guardrail authority.

## 23.1 Five-Layer Guardrails

| Layer | Execution Timing | Main Checks |
|---|---|---|
| Input Guardrail | After Request enters | Injection, privilege escalation, format, sensitive requests |
| Planning Guardrail | After PlanGraph generated | Forbidden graph structure, unauthorized tools, dangerous paths |
| Tool Guardrail | Before/after Tool calls | Input security, output taint, side effect risk |
| Memory Guardrail | During Memory read/write | Cross-domain leakage, long-term memory contamination |
| Output Guardrail | Before output | Hallucination, unevidenced claims, sensitive information leakage |

## 23.2 GuardrailHookResult

```ts
type GuardrailHookResult = {
  hookId: string;
  layer:
    | "input"
    | "planning"
    | "tool"
    | "memory"
    | "output";

  decision:
    | "allow"
    | "block"
    | "rewrite"
    | "redact"
    | "require_human"
    | "downgrade_mode";

  severity:
    | "info"
    | "warn"
    | "error"
    | "critical";

  reason: string;
  evidenceRefs: string[];
};
```

Hard rules:

```text
1. Critical guardrail block takes priority over evaluator accept.
2. LLM-as-Judge must not override deterministic guardrail failure.
3. Guardrail rewrite must record original input hash.
```

---

# 24. Decision Engine

## 24.1 DecisionInputBundle

```ts
type DecisionInputBundle = {
  verificationResult?: VerificationResult;
  evaluationReport?: EvaluationReport;
  nodeState?: NodeRun;
  hitlState?: HitlLock;
  riskState?: RiskAssessment;
  guardrailFindings: GuardrailHookResult[];
  policyOutcomes: PolicyOutcome[];
  sideEffectStates: SideEffectRecord[];
  budgetState: BudgetLedger;
  runtimeMode: RuntimeMode;
  incidentState?: IncidentState;
};
```

Hard rules:

```text
1. DecisionEngine can only consume DecisionInputBundle.
2. DecisionEngine must not directly read scattered service state.
3. DecisionInputBundle must be frozen before generating decision.
4. Frozen bundle must be hashed and written to evidence.
```

## 24.2 HarnessDecision

```ts
type HarnessDecision =
  | "accept"
  | "retry_same_plan"
  | "replan"
  | "escalate_to_human"
  | "downgrade_mode"
  | "abort";
```

## 24.3 Decision Precedence

From high to low:

```text
1. PlatformPanic / Emergency Directive
2. Security / Compliance hard block
3. Budget exhausted
4. SideEffect ambiguous irreversible
5. Human explicit abort
6. Policy deny
7. Guardrail block
8. Verification deterministic failure
9. Evaluator recommendation
10. Planner preference
```

---

# 25. Runtime Profile / Runtime Mode / Autonomy Mode

## 25.1 Three Distinctions

| Concept | Meaning | Example |
|---|---|---|
| RuntimeProfile | Platform capability tier (injected by Harness/platform governance, not owned by OAPEFLIR) | mvp / hardening / enterprise |
| RuntimeMode | Current runtime protection mode | full_auto / read_only / manual_only |
| AutonomyMode | Agent autonomy level | suggestion / supervised / semi_auto / full_auto |

## 25.2 RuntimeMode

```ts
type RuntimeMode =
  | "full_auto"
  | "supervised_auto"
  | "read_only"
  | "no_write"
  | "no_external_call"
  | "no_rollout"
  | "manual_only"
  | "incident_mode";
```

## 25.3 Effective Autonomy

```text
effectiveAutonomy =
  min(
    agentAutonomyMode,
    runtimeModeCeiling,
    domainCeiling,
    riskCeiling,
    policyCeiling
  )
```

Hard rules:

```text
1. RuntimeMode can lower AutonomyMode, but must not raise it.
2. RiskLevel high and above must limit autonomy.
3. incident_mode prohibits new side effects.
```

---

# 26. HITL Runtime

## 26.1 HITL Capabilities

```text
Inspect
Patch
Override
Takeover
Resume
Reject
Abort
```

## 26.2 HitlLock

```ts
type HitlLock = {
  lockId: string;
  runId: string;
  nodeRunId?: string;

  lockScope:
    | "single_node"
    | "subgraph"
    | "entire_run"
    | "side_effect_only";

  acquiredBy: PrincipalRef;
  acquiredAt: string;
  expiresAt: string;

  status:
    | "active"
    | "released"
    | "expired"
    | "stolen_by_admin";
};
```

## 26.3 HitlEscalationPolicy

```ts
type HitlEscalationPolicy = {
  timeoutMs: number;

  onTimeout:
    | "escalate_to_manager"
    | "delegate"
    | "auto_reject"
    | "abort_run"
    | "continue_readonly";

  escalationChain: string[];
};
```

## 26.4 HumanResponsibilityRecord

```ts
type HumanResponsibilityRecord = {
  operatorId: string;
  action:
    | "inspect"
    | "patch"
    | "override"
    | "approve"
    | "reject"
    | "takeover"
    | "resume"
    | "abort";

  responsibility:
    | "reviewed_only"
    | "approved_agent_action"
    | "modified_plan"
    | "overrode_policy"
    | "manual_takeover";

  acknowledgedRisks: string[];

  approvalScope:
    | "single_node"
    | "subgraph"
    | "entire_run"
    | "side_effect_only";

  expiresAt?: string;
};
```

Hard rules:

```text
1. Human approve only approves current scope.
2. Human override policy must have higher authority.
3. After manual_takeover, Agent must not continue automatically submitting side effects unless resume explicitly allows.
4. All HITL operations must write audit.
```

---

# 27. Final Output Contract

```ts
type FinalOutputContract = {
  outputId: string;
  runId: string;

  audience:
    | "end_user"
    | "operator"
    | "auditor"
    | "system";

  contentRef: string;

  confidence: number;

  limitations: string[];
  citationsRequired: boolean;
  evidenceRefs: string[];

  dataClass: DataClass;

  redactionApplied: boolean;
  safetyLabels: string[];

  allowedActionsAfterOutput:
    | "view_only"
    | "approve"
    | "download"
    | "publish"
    | "execute";
};
```

Hard rules:

```text
1. Critical domain output must include limitations description.
2. Low confidence output must not be presented in definitive tone.
3. High-risk advice without evidence must not be output as executable instructions.
4. User-visible output must pass before_output guardrail.
```

---

# 28. Causal Lineage Query

## 28.1 Query Capabilities

Given `sideEffectId`, must be able to query:

```text
Who triggered it
What observations were used
What assessments were passed
Which PlanNode made the decision
What tools / models were called
What verifications passed
What evaluations supported it
Who approved it
What is the final external confirmation
Whether reconciliation / compensation occurred
```

## 28.2 CausalLineageQuery

```ts
type CausalLineageQuery = {
  target:
    | { runId: string }
    | { nodeRunId: string }
    | { sideEffectId: string }
    | { outputId: string };

  depth:
    | "summary"
    | "full"
    | "forensic";
};
```

---

# 29. Run Version Lock

```ts
type RunVersionLock = {
  runId: string;

  runtimeVersion: string;
  policyBundleVersion: string;
  guardrailBundleVersion: string;
  promptBundleVersion: string;
  modelRoutingVersion: string;
  toolRegistryVersion: string;
  domainDescriptorVersion: string;
  evalRuleVersion: string;

  lockMode:
    | "lock_for_entire_run"
    | "lock_per_segment"
    | "allow_safe_minor_updates";
};
```

Hard rules:

```text
1. Long-running runs must record version lock.
2. High / critical runs default to lock_for_entire_run.
3. Policy hot updates must not silently change resume semantics for paused runs.
4. If version incompatible on resume, must go through ResumeCompatibilityPolicy.
```

---

# 30. Effective Policy Snapshot

## 30.1 Configuration Priority

```text
Platform Policy
< Tenant Policy
< Domain Policy
< Task ConstraintPack

Emergency Directive
  = formal override recorded alongside the 4-level merged snapshot
```

## 30.2 EffectivePolicySnapshot

```ts
type EffectivePolicySnapshot = {
  snapshotId: string;
  runId: string;
  resolvedAt: string;

  sources: {
    level: "platform" | "tenant" | "domain" | "task";
    version: string;
    ref: string;
  }[];

  effectivePolicyHash: string;
};
```

Hard rules:

```text
1. Priority only allows four levels `platform < tenant < domain < task` to stack; must not introduce additional runtime priority axes to bypass ConstraintPack.
2. Emergency Directive has highest priority, but still takes effect through formal directive and snapshot recording.
3. Lower-level config can only tighten, not relax, upper-level security constraints.
4. All final effective config must generate EffectivePolicySnapshot.
```

---

# 31. Learning Candidate

## 31.1 LearningCandidate Types

```ts
type LearningCandidateType =
  | "operational_learning"
  | "prompt_learning"
  | "policy_learning"
  | "domain_learning"
  | "tool_learning"
  | "evaluation_learning";
```

## 31.2 LearningCandidate State Machine

```text
created
  → quarantined
  → validated
  → rejected

validated
  → promoted_to_changeset
  → evaluated
  → approved
  → canary
  → stable

canary / stable
  → rolled_back
```

## 31.3 LearningCandidate

```ts
type LearningCandidate = {
  candidateId: string;
  type: LearningCandidateType;

  sourceRunRefs: string[];
  sourceFeedbackRefs: string[];

  status:
    | "created"
    | "quarantined"
    | "validated"
    | "rejected"
    | "promoted_to_changeset"
    | "evaluated"
    | "approved"
    | "canary"
    | "stable"
    | "rolled_back";

  contaminationCheck: {
    containsHoldoutCase: boolean;
    containsPII: boolean;
    containsSecret: boolean;
    containsPromptInjection: boolean;
  };

  approvalRequired: boolean;
  evaluationRequired: boolean;

  evidenceRefs: string[];
};
```

Hard rules:

```text
1. LearningCandidate must not contain holdout eval cases.
2. Incident regression cases can enter incident_regression, and must not enter prompt few-shot.
3. Policy Learning must not go online automatically.
4. Prompt Learning must pass Evaluation Gate.
5. Domain Learning must be reviewed by domain_owner.
```

---

# 32. Evaluation Harness

## 32.1 EvaluationGate

```ts
type EvaluationGate = {
  gateId: string;

  metric:
    | "success_rate"
    | "quality_score"
    | "cost_delta"
    | "latency_delta"
    | "safety_violation_rate"
    | "human_override_rate"
    | "incident_regression_pass_rate"
    | "critical_case_pass_rate";

  operator:
    | ">="
    | "<="
    | "==";

  threshold: number;

  required: boolean;

  onFail:
    | "block_release"
    | "require_human_review"
    | "allow_with_warning";
};
```

## 32.2 Default Release Gates

```text
critical_case_pass_rate == 100%
incident_regression_pass_rate == 100%
safety_violation_rate == 0%
cost_delta <= +20%
latency_delta <= +20%
quality_score_delta >= -3%
human_override_rate must not significantly increase
```

## 32.3 Evaluation Hard Rules

```text
1. LLM-as-Judge must not override deterministic failure.
2. Evaluation focuses on outcomes, not transcripts.
3. Pre-release evaluation must run in isolated environment.
4. Online canary must compare against stable baseline.
5. Failed cases must enter regression set.
```

---

# 33. Release Pipeline

```text
ImprovementChangeSet
  → Static Validation
  → Offline Evaluation
  → Incident Regression
  → Security Check
  → Human Approval
  → Canary 5%
  → Canary 20%
  → Canary 50%
  → Stable
  → Monitoring
  → Rollback if regression
```

Hard rules:

```text
1. Learn / Improve must not directly change online behavior.
2. Release must pass EvaluationGate.
3. Prompt / Policy / Tool / Domain Descriptor release all require versioning.
4. Rollback must be able to restore previous stable version.
```

---

# 34. Error Code Taxonomy

## 34.1 Naming Convention

```text
PLATFORM.{plane}.{component}.{category}
```

Examples:

```text
PLATFORM.ORCHESTRATION.GRAPH.validation_failed
PLATFORM.EXECUTION.NODE.invalid_transition
PLATFORM.EXECUTION.SIDE_EFFECT.confirmation_timeout
PLATFORM.CONTROL_PLANE.HITL.lock_conflict
PLATFORM.OPS_MATURITY.REPLAY.nondeterministic_input
PLATFORM.OPS_MATURITY.LEARNING.pii_detected
```

## 34.2 OapeflirError

```ts
type OapeflirError = {
  code: string;
  message: string;
  category: string;

  severity:
    | "info"
    | "warn"
    | "error"
    | "critical";

  retryable: boolean;
  userVisible: boolean;

  operatorAction?: string;
  evidenceRefs: string[];
};
```

---

# 35. Observability Metrics

## 35.1 Runtime Metrics

| Metric | Description |
|---|---|
| `harness.run.total` | HarnessRun total count |
| `harness.run.duration_ms` | HarnessRun end-to-end duration |
| `harness.graph.node.count` | Graph node count |
| `harness.graph.replan.count` | Replan count |
| `harness.node.retry.count` | Node retry count |
| `harness.side_effect.ambiguous.count` | Side effect ambiguous count |
| `harness.reconciliation.pending.count` | Pending reconciliation count |
| `harness.hitl.pending.count` | Pending human count |
| `harness.budget.remaining` | Remaining budget |
| `harness.guardrail.block.count` | Guardrail block count |
| `harness.evaluation.score` | Evaluation score |
| `harness.learning.candidate.count` | Learning candidate count |

---

# 36. Incident Rules

| Rule | Condition | Severity | Action |
|---|---|---|---|
| side_effect_ambiguous_irreversible | Irreversible side effect ambiguous | SEV2 | Manual reconciliation + pause related run |
| graph_deadlock_detected | Graph deadlock | SEV3 | abort / replan |
| budget_exhausted_high_priority | High priority task budget exhausted | SEV3 | Manual handling |
| replay_inconsistent | Replay results inconsistent | SEV2 | runtime freeze for affected version |
| guardrail_critical_block | critical guardrail block | SEV2 | incident + quarantine |
| learning_contamination | Learning candidate contamination | SEV2 | reject candidate + audit |

---

# 37. Runtime Capability Matrix

| Capability | Core | Durable | Governed | Enterprise | Learning |
|---|---:|---:|---:|---:|---:|
| PlanGraph | Yes | Yes | Yes | Yes | Yes |
| Event Registry | Yes | Yes | Yes | Yes | Yes |
| Deterministic Scheduler | Yes | Yes | Yes | Yes | Yes |
| Checkpoint | No | Yes | Yes | Yes | Yes |
| Replay | No | Yes | Yes | Yes | Yes |
| SideEffect Manager | No | Partial | Yes | Yes | Yes |
| Reconciliation | No | No | Yes | Yes | Yes |
| HITL Lock | No | No | Yes | Yes | Yes |
| Budget Ledger | Partial | Yes | Yes | Yes | Yes |
| Guardrails Five-Layer | Partial | Partial | Yes | Yes | Yes |
| Delegation / Subgraph | No | Partial | Partial | Yes | Yes |
| Evaluation Harness | No | No | Partial | Yes | Yes |
| Learning Quarantine | No | No | No | Partial | Yes |
| Release Gate | No | No | Partial | Yes | Yes |

---

# 38. Runtime Test Matrix

## 38.1 State Machine Tests

```text
Run valid transition tests
Run invalid transition tests
Node valid transition tests
Node terminal state immutability tests
Retry creates new attempt tests
Redrive lineage tests
```

## 38.2 Graph Tests

```text
DAG validation
Deadlock detection
Join condition validation
Worst-path budget analysis
Risk propagation
GraphPatch compatibility
Deterministic scheduling
Replay schedule consistency
```

## 38.3 SideEffect Tests

```text
proposed → approved → committed → confirmed
committed → ambiguous → reconciliation
irreversible ambiguous requires human
duplicate idempotency key
external timeout after commit
compensation append-only
```

## 38.4 Guardrail / Policy Tests

```text
critical guardrail blocks evaluator accept
policy deny beats planner preference
budget exhausted beats retry
LLM judge cannot override deterministic failure
```

## 38.5 HITL Tests

```text
lock acquisition
lock conflict
timeout escalation
scope-limited approval
manual takeover prevents auto side effect
resume with patched graph
```

## 38.6 Learning / Release Tests

```text
holdout contamination blocked
PII candidate rejected
prompt change eval gate
incident regression gate
canary rollback
```

## 38.7 Fault Injection Tests

```text
worker crash
LLM timeout
tool timeout after external commit
database write conflict
event append failure
projection lag
checkpoint restore
replay mismatch
```

---

# 39. Implementation Directory Recommendations

```text
src/platform/five-plane-orchestration/harness/
  index.ts
  runtime-state-machine.ts
  runtime/
  graph/
  decision/
  replay/

src/platform/five-plane-state-evidence/
  outbox/
  reconciliation/
  side-effect-ledger/
  truth/

src/platform/five-plane-control-plane/
  approval-center/
  incident-control/
  directives/

src/platform/shared/
  observability/
  lifecycle/

src/platform/oapeflir/
  projection/
  rationale/
  adapters/
```

---

# 40. v4.4 Minimum Implementation Roadmap

## Ring 1: MVP

Deliver:

```text
Run State Machine
Node State Machine
Event Registry
PlanGraph
Graph Validator
Deterministic Scheduler
Budget Ledger basic version
```

Acceptance:

```text
Can create run
Can generate graph
Can execute node
Can record event
Can deterministically replay scheduling order
```

## Ring 2: Hardening

Deliver:

```text
SideEffect Manager
SideEffect Delivery Contract
Reconciliation State Machine
Guardrails Five-Layer basic version
DecisionInputBundle
Decision Engine
```

Acceptance:

```text
High-risk side effects can be blocked
ambiguous can enter reconciliation
policy / guardrail / evaluator conflicts can be arbitrated
```

## Ring 2 Extended: Durable + HITL

Deliver:

```text
Checkpoint
Pause / Resume
HITL Lock
HumanResponsibilityRecord
GraphPatch
RunVersionLock
```

Acceptance:

```text
Humans can inspect / patch / approve / resume
Worker crash后可恢复
Long-running run version lock takes effect
```

## Ring 3: Enterprise / Learning

Deliver:

```text
Evaluation Harness
Evaluation Gates
LearningCandidate Quarantine
Release Pipeline
Canary / Rollback
```

Acceptance:

```text
Prompt / Policy improvements cannot go directly online
Release must pass eval gate
Contaminated learning candidates will be blocked
```

---

# 41. v4.4 Must-Freeze ADRs

```text
ADR-OAPEFLIR-Plan-Is-Graph
ADR-OAPEFLIR-Event-Registry-As-Source-Of-Replay
ADR-OAPEFLIR-Deterministic-Graph-Scheduler
ADR-OAPEFLIR-Terminal-State-Immutability
ADR-OAPEFLIR-Retry-Append-Only-Lineage
ADR-OAPEFLIR-SideEffect-Delivery-Semantics
ADR-OAPEFLIR-Reconciliation-For-Ambiguous-External-State
ADR-OAPEFLIR-DecisionInputBundle-Frozen-Before-Decision
ADR-OAPEFLIR-Budget-Reservation-Before-LLM-And-Tool
ADR-OAPEFLIR-ContextAssembly-Per-Role
ADR-OAPEFLIR-Prompt-Role-Isolation
ADR-OAPEFLIR-Memory-Write-Governance
ADR-OAPEFLIR-HITL-Responsibility-Record
ADR-OAPEFLIR-Run-Version-Lock
ADR-OAPEFLIR-Learning-Quarantine-Before-Release
ADR-OAPEFLIR-Evaluation-Gate-Before-Online-Change
ADR-OAPEFLIR-LLM-Judge-Cannot-Override-Deterministic-Failure
ADR-OAPEFLIR-Replay-Never-Produces-Real-SideEffect
```

---

# 42. Final Judgment

The key convergence of OAPEFLIR v4.4 compared with early independent runtime drafts is:

| Dimension | v4.3 | v4.4 |
|---|---|---|
| Role positioning | Once mixed independent runtime draft | Explicitly retreated to cognitive/governance semantics above HarnessRuntime |
| Plan | Could be misread as OAPEFLIR's own execution graph | Acts as `PlanGraphBundle` semantic input used by `HarnessRuntime` |
| Event | Truth / projection boundary mixed | Clearly distinguishes `platform.*` facts from `oapeflir.view.*` / `oapeflir.rationale.*` projections |
| State machine | May overlap with runtime truth | Only describes controlled semantics aligned with `HarnessRun / NodeRun`, and no longer establishes its own truth state machine |
| SideEffect / Budget / HITL | Once written as OAPEFLIR's own capabilities | Clearly reverted to Harness/P2/P5 main chain; OAPEFLIR only interprets and projects |
| Replay / Context / Prompt | Design intent exists | Continues to retain, but as migration input for canonical contracts rather than independent runtime specification |
| Implementation value | Easily misread as direct coding baseline | Suitable as migration design input and semantic supplement, and not independently serves as authoritative implementation baseline |

Final conclusion:

> **OAPEFLIR v4.4 can only be used as cognitive/governance semantics and migration design input, and cannot independently serve as the authoritative Runtime baseline for an enterprise Agent platform.**

It is no longer an "Agent flowchart", but rather:

```text
A set of cognitive/governance semantic supplementary specifications and migration inputs
that converge PlanGraph, Event, Replay, Guardrail, HITL, Learning and other design intents
to the boundary above the `HarnessRuntime` main chain.
```

The next step after v4.4 should not be to continue expanding this document into a second runtime, but rather to enter:

```text
OAPEFLIR v4.4 Implementation Addendum
```

Focus on supplementing:

```text
Database table structures
Zod Schemas
TypeScript interfaces
State transition test cases
Graph Scheduler algorithm pseudocode
SideEffect Adapter contracts
Reconciliation Worker design
Replay Engine design
Evaluation Gate Runner
CI Test Matrix
```


## v4.3 Canonical Compatibility Override

This section fixes OAPEFLIR spec deviations F-1 through F-25 from `platform-architecture-implementation-consistency-audit.md`. The root cause is that during a document merge, this spec simultaneously retained "old independent OAPEFLIR runtime draft" and "supplementary Harness convergence paragraphs", causing the first half to continue treating OAPEFLIR as execution authority while the second half declared Harness as execution authority — internally contradictory within the document itself.

Direct fixes after this revision:

- `§0 / §2 / §3 / §42`: OAPEFLIR reverted to controlled cognitive/governance semantics, `HarnessRuntime` is the only execution entry.
- `§4`: Deleted treating `OapeflirRun` as an authoritative run entity, changed to `HarnessRun` truth + `OapeflirTraceProjection` projection.
- `§5`: `NodeRun` fields and state machine converged to Harness/RuntimeStateMachine authoritative semantics, no longer using `compensating / compensated` as node states.
- `§7`: `PlanNode.type` changed to `kind`, `generatedBy` deleted `repair_worker`.
- `§14`: Event hierarchy changed to `platform.*` facts and `oapeflir.view.* / oapeflir.rationale.*` projections.
- `§15 / §16 / §23 / §25 / §26 / §30`: Budget, side effects, guardrails, runtime profile, HITL, policy priority all explicitly converged to Harness/P2/P5 formal boundaries.
- `§19 / §20 / §22 / §24`: Prompt role, replay method, memory scope, decision bundle converged to current canonical contracts.
- `§34 / §35 / §39 / §40`: Error codes, metrics, implementation directories, rollout roadmap changed to `PLATFORM.*`, `harness.*`, Harness-centric directories and `Ring 1/2/3`.

Supplementary note: HarnessRuntime is the only execution entry.
Supplementary note: OAPEFLIR only produces `oapeflir.view.*` and `oapeflir.rationale.*` projection/explanation events, and does not produce execution truth.

Item-by-item audit closure:

- F-1: Deleted "OAPEFLIR runtime directly drives execution" narrative, unified that `HarnessRuntime` is the only execution entry.
- F-2: Deleted treating `OapeflirRun` as execution truth, unified to `HarnessRun` truth.
- F-3: OAPEFLIR's own positioning changed to cognitive/planning/evaluation loop, not execution state machine.
- F-4: Execution completion, failure, compensation and other terminal states reverted to `HarnessRun` / `NodeRun` / `NodeAttemptReceipt`.
- F-5: Node authoritative state converged to canonical `NodeRun.status`, removed `compensating / compensated`.
- F-6: Orchestration output changed to `PlanGraphBundle` / graph patch, rather than OAPEFLIR's private mutable execution graph.
- F-7: `PlanNode.type` converged to `kind`, avoiding old spec and current code field drift.
- F-8: Deleted `generatedBy=repair_worker` old execution coupling source, retained current generation source semantics.
- F-9: Budget reservation placed back in Harness / billing / state-evidence authoritative chain.
- F-10: Side effect receipt / reconcile placed back in execution plane and state-evidence plane.
- F-11: Guardrail block / allow / escalate final arbitration boundary placed back in P2/P3/P5.
- F-12: Runtime profile constraint converged to Harness runtime profile, rather than OAPEFLIR's private profile.
- F-13: HITL / approval timeout / escalation unified to current approval-and-hitl contract.
- F-14: Prompt role and system / user / tool semantics unified to model gateway / prompt engine.
- F-15: Replay semantics changed to based on factual events and projection rebuild, rather than OAPEFLIR replaying execution itself.
- F-16: Memory scope bound back to canonical memory / knowledge boundary contract.
- F-17: Decision bundle, evidence refs, rationale refs changed to current evidence object model.
- F-18: Event hierarchy changed to `platform.*` facts and `oapeflir.view.*` / `oapeflir.rationale.*` projections.
- F-19: Explicitly OAPEFLIR does not write execution truth, and does not directly publish task / workflow / execution terminal facts.
- F-20: Error code prefix unified to `PLATFORM.*` / `HARNESS.*` authoritative naming, removed spec-private enumeration.
- F-21: Metrics / observability metric prefix unified to `harness.*` and platform observability naming.
- F-22: Implementation directories pointed to current actual code locations in Harness / orchestration / contracts.
- F-23: Rollout / remediation roadmap converged to `Ring 1 / Ring 2 / Ring 3`.
- F-24: Explicitly the boundary between OAPEFLIR and execution plane is "generate proposals / projections / rationale", not "direct execution".
- F-25: Explicitly any legacy OAPEFLIR execution description in this spec can only serve as historical compatibility background, and no longer serves as implementation basis.