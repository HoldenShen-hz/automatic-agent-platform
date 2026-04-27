# OAPEFLIR v4.4 Complete Edition

## Executable Specification Edition: Executable Runtime Specification for Production-Grade Agent Platform

> **Version**: v4.4
> **Status**: Proposed → Ready for Architecture Review / Detailed Design / Implementation Breakdown
> **Purpose**: OAPEFLIR upgrades from "Controlled Cognitive Process" to "Encodable, Testable, Recoverable, Auditable, Long-Running Production-Grade Agent Runtime Specification"
> **Core Changes**: Comprehensively absorb v4.3 review improvements, focusing on Event Registry, PlanGraph Executable Semantics, Deterministic Scheduling, SideEffect Delivery Semantics, Reconciliation, Budget Ledger, Context Assembly, Version Lock, Memory Governance, Evaluation Gate, HITL Responsibility Boundaries, and Test Matrix.

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

> **Transform the Agent's "Observe, Assess, Plan, Execute, Feedback, Learn, Improve, Release" from an abstract process into an executable production-grade state machine and graph execution protocol.**

v4.4 no longer only describes "how the Agent should think", but explicitly defines:

```
what states can transition
what events must be recorded
what graph can execute
what side effects can be committed
what situations require pause
what situations allow retry
what situations require human takeover
what learning results can go online
what evaluation gates must block release
what evidence must be permanently preserved
```

One sentence summary:

```
OAPEFLIR v4.4 = PlanGraph + Event Sourcing + Deterministic Runtime + Governed SideEffect + HITL + Evaluation + Learning Release
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
| Intelligent | Plan is a Graph, replannable, evaluable, learnable |
| Controllable | Risk, budget, tools, permissions, context, output all constrained |
| Auditable | Every decision, tool call, human approval, side effect has evidence chain |
| Recoverable | Supports checkpoint, pause, resume, replay, redrive, repair |
| Evolvable | Prompt, Policy, Tool, Model, Domain, Eval all versioned |
| Operable | Has metrics, incident, DLQ, reconciliation, dashboard |
| Verifiable | Supports state machine testing, property testing, fault injection, replay consistency testing |

---

# 2. OAPEFLIR Eight-Phase Definition

OAPEFLIR maintains eight phases, but v4.4 clarifies the engineering boundaries of each phase.

```
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
| Assess | Risk, permission, feasibility, budget, strategy assessment | AssessmentBundle | No |
| Plan | Generate executable PlanGraph | PlanGraphBundle | No |
| Execute | Execute Graph Node, call tools/LLM/human wait | NodeRun / ExecutionReceipt | Controlled |
| Feedback | Feedback on execution results, deviations, quality, risk | FeedbackEnvelope | No |
| Learn | Extract candidate experiences from feedback | LearningCandidate | No |
| Improve | Generate Prompt/Policy/Tool/Domain improvement candidates | ImprovementChangeSet | No |
| Release | Evaluate, approve, canary, release, rollback | ReleaseRecord | Yes, but only for config release |

---

# 3. Overall Runtime Architecture

```
RequestEnvelope
   │
   ▼
┌─────────────────────────────────────────────────────────┐
│                  OAPEFLIR Runtime v4.4                  │
│                                                         │
│  Observe ─→ Assess ─→ PlanGraph ─→ Graph Scheduler     │
│                              │                          │
│                              ▼                          │
│                      Node Execution Runtime             │
│                              │                          │
│             ┌────────────────┼────────────────┐         │
│             ▼                ▼                ▼         │
│       Tool / LLM         HITL Wait        Subgraph      │
│             │                │                │          │
│             ▼                ▼                ▼          │
│       SideEffect        HumanDecision     ChildRun      │
│       Manager              │                │            │
│             └──────────────┼────────────────┘            │
│                            ▼                             │
│                       Evaluator                          │
│                            │                             │
│             ┌──────────────┼───────────────┐            │
│             ▼              ▼               ▼              │
│          accept          retry            replan         │
│             │              │               │             │
│             ▼              ▼               ▼             │
│        next node      new attempt      graph patch       │
│                            │                             │
│                            ▼                             │
│                    Feedback / Learn / Improve           │
│                            │                             │
│                            ▼                             │
│                       Release Gate                      │
└─────────────────────────────────────────────────────────┘
```

---

# 4. Core Runtime Entities

## 4.1 OapeflirRun

A complete OAPEFLIR execution.

```ts
type OapeflirRun = {
  runId: string;
  tenantId: string;
  domainId: string;
  agentId?: string;

  status: RunStatus;

  requestEnvelopeRef: string;
  constraintPackRef: string;
  effectivePolicySnapshotRef: string;
  runVersionLockRef: string;

  observationBundleRef?: string;
  assessmentBundleRef?: string;
  planGraphBundleRef?: string;

  currentGraphVersion: number;
  currentIteration: number;
  maxIterations: number;

  budgetLedgerRef: string;

  startedAt?: string;
  pausedAt?: string;
  completedAt?: string;
  failedAt?: string;
  abortedAt?: string;

  finalDecision?: HarnessDecision;
  finalOutputRef?: string;

  traceId: string;
  evidenceRefs: string[];
};
```

## 4.2 RunStatus

```ts
type RunStatus =
  | "created"
  | "admitted"
  | "observing"
  | "assessing"
  | "planning"
  | "ready"
  | "running"
  | "pausing"
  | "paused"
  | "resuming"
  | "replanning"
  | "compensating"
  | "completed"
  | "failed"
  | "aborted";
```

## 4.3 Run State Machine

```
created
  → admitted
  → observing
  → assessing
  → planning
  → ready
  → running
  → completed

running
  → pausing
  → paused
  → resuming
  → running

running
  → replanning
  → ready
  → running

running
  → compensating
  → failed / aborted

Any non-terminal state
  → failed / aborted
```

## 4.4 Run Terminal State Closure Rules

```
1. completed / failed / aborted are terminal states and cannot transition out.
2. A terminal run cannot run again.
3. Redrive must create a new runId or redriveRunId, cannot overwrite the original run.
4. Repair of a failed run can only append RepairRecord, cannot modify original failure events.
5. An aborted run can be analyzed by replay, but cannot be recovered in place.
6. A completed run can only generate follow-up runs, cannot continue appending execution nodes.
```

---

# 5. NodeRun State Machine

## 5.1 NodeRun

```ts
type NodeRun = {
  nodeRunId: string;
  runId: string;
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

  error?: OapeflirError;
  evidenceRefs: string[];
};
```

## 5.2 NodeRunStatus

```ts
type NodeRunStatus =
  | "pending"
  | "blocked"
  | "ready"
  | "leased"
  | "running"
  | "waiting"
  | "succeeded"
  | "failed"
  | "retrying"
  | "cancelled"
  | "skipped"
  | "compensating"
  | "compensated";
```

## 5.3 Node State Transitions

```
pending
  → blocked / ready

blocked
  → ready / skipped / cancelled

ready
  → leased
  → running

running
  → waiting
  → running

running
  → succeeded / failed / cancelled

failed
  → retrying
  → ready

succeeded
  → compensating
  → compensated
```

## 5.4 Node Terminal State Closure Rules

```
1. succeeded cannot run again.
2. compensated cannot revert to succeeded.
3. cancelled cannot resume unless redrive creates a new nodeRunId.
4. failed retry must create a new attemptId.
5. Retry must not overwrite original failure records.
6. skipped must record skipReason.
7. Redrive must preserve lineage.
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

```
parallel tasks
conditional branches
human approval
subgraph delegation
failure compensation
rollback paths
external wait
replan patch
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

  generatedBy: "planner_agent" | "human_operator" | "template" | "repair_worker";

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

  type:
    | "observe"
    | "assess"
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

Draft graphs generated by LLM or human cannot be executed directly; they must be normalized.

## 8.1 Normalization Process

```
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

```
1. Must have at least one entry node.
2. Must have at least one terminal node.
3. Undeclared node types are not allowed.
4. Orphan nodes are not allowed.
5. Unbounded loops are not allowed.
6. wait / human_gate without timeout are not allowed.
7. high risk nodes without verification are not allowed.
8. Irreversible side effects without confirmation / reconciliation are not allowed.
9. join waiting for branches that will never trigger are not allowed.
10. Cross-permission data flow is not allowed.
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

```
1. If an upstream node reads restricted data, downstream consumer nodes have risk at least medium.
2. If a node produces irreversible side effects, downstream join / terminal must check confirmation.
3. If a branch contains external write, the entire subgraph risk is not lower than high.
4. If tool output taint = potential_prompt_injection, downstream LLM nodes must isolate context.
5. If any node requires human_gate, subsequent side_effect_commit cannot bypass human approval scope.
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

Complex graphs must calculate worst-path before execution.

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

Hard Rules:

```
1. If worst-path budget exceeds limit, PlanGraph cannot enter ready state.
2. If the highest-risk path lacks HITL / verification, PlanGraph cannot execute.
3. If irreversible side effect path lacks confirmation, reconciliation must be inserted.
```

---

# 12. Graph Scheduler Deterministic Scheduling

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

```
1. Graph Scheduler must be deterministic.
2. Same graph + same runtime seed + same event history must produce the same scheduling order.
3. Parallel nodes must also have stable ordering.
4. During replay, scheduling order must not be re-selected.
5. Scheduling decisions must be recorded as scheduler.decision_recorded events.
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

Hard Rules:

```
1. Completed nodes cannot be deleted, can only be marked as superseded.
2. Running nodes cannot be replaced unless first paused.
3. After GraphPatch, old checkpoints must be mappable to new graph.
4. join semantic changes must trigger human review.
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

## 14.2 OapeflirEventType

```ts
type OapeflirEventType =
  | "run.created"
  | "run.admitted"
  | "run.observing_started"
  | "run.assessing_started"
  | "run.planning_started"
  | "run.ready"
  | "run.running"
  | "run.paused"
  | "run.resumed"
  | "run.replanning_started"
  | "run.completed"
  | "run.failed"
  | "run.aborted"

  | "graph.generated"
  | "graph.normalized"
  | "graph.validated"
  | "graph.risk_propagated"
  | "graph.patch_requested"
  | "graph.patch_applied"
  | "graph.scheduler_decision_recorded"

  | "node.ready"
  | "node.leased"
  | "node.started"
  | "node.waiting"
  | "node.succeeded"
  | "node.failed"
  | "node.retry_scheduled"
  | "node.cancelled"
  | "node.skipped"
  | "node.compensating"
  | "node.compensated"

  | "llm.call_started"
  | "llm.call_completed"
  | "llm.call_failed"

  | "tool.call_started"
  | "tool.call_completed"
  | "tool.call_failed"

  | "side_effect.proposed"
  | "side_effect.approved"
  | "side_effect.committed"
  | "side_effect.confirmed"
  | "side_effect.ambiguous"
  | "side_effect.compensation_started"
  | "side_effect.compensated"

  | "reconciliation.started"
  | "reconciliation.matched_confirmed"
  | "reconciliation.ambiguous"
  | "reconciliation.requires_manual_review"
  | "reconciliation.resolved"

  | "hitl.requested"
  | "hitl.lock_acquired"
  | "hitl.resolved"
  | "hitl.timeout"
  | "hitl.responsibility_recorded"

  | "budget.reserved"
  | "budget.consumed"
  | "budget.released"
  | "budget.exhausted"

  | "memory.write_requested"
  | "memory.write_rejected"
  | "memory.write_committed"

  | "evaluation.started"
  | "evaluation.completed"
  | "evaluation.failed"

  | "learning.candidate_created"
  | "learning.candidate_quarantined"
  | "learning.candidate_validated"
  | "learning.candidate_rejected"
  | "learning.candidate_promoted"

  | "release.eval_started"
  | "release.eval_passed"
  | "release.eval_failed"
  | "release.canary_started"
  | "release.stable"
  | "release.rolled_back"

  | "incident.created"
  | "incident.escalated"
  | "incident.resolved"

  | "redrive.requested"
  | "redrive.started"
  | "redrive.completed"
  | "redrive.failed";
```

## 14.3 Event Hard Rules

```
1. All state changes must be driven by Events.
2. Event append and truth state update must be in the same transaction.
3. Event sequence monotonically increases within a run.
4. Event payload must have schema version.
5. Events are not allowed to be physically deleted.
6. Projections can only be rebuilt from Events, must not write back to truth.
7. Replay must comply with replayBehavior.
```

---

# 15. Budget Ledger

## 15.1 BudgetLedger

```ts
type BudgetLedger = {
  runId: string;

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

```
1. Budget must be reserved before LLM call.
2. Budget must be reserved before Tool call.
3. Budget must be reserved before SideEffect commit.
4. Evaluation / Judge calls also incur charges.
5. On call failure, consume / release according to strategy.
6. Budget exhausted takes priority over retry / replan.
7. Replan must re-do worst-path budget analysis.
```

---

# 16. SideEffect Manager

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

## 16.6 SideEffect Submission Process

```
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

Hard Rules:

```
1. Tool execution success does not equal side effect success.
2. SideEffect must first be proposed, then approved, then committed.
3. Irreversible side effects must have confirmationMethod.
4. ambiguous must not automatically become succeeded.
5. high / critical side effects must support reconciliation.
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

```
1. ambiguous must not automatically become confirmed.
2. Irreversible side effect ambiguous must be handled by humans.
3. Reconciliation timeout must escalate to incident.
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

```
1. Planner / Generator / Evaluator must use different ContextAssemblyContract.
2. Context must be hashable and replayable.
3. external_untrusted can only enter user/data area, cannot enter system/developer area.
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
    | "observe"
    | "planner"
    | "generator"
    | "evaluator"
    | "summarizer"
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

```
1. Planner / Generator / Evaluator Prompts must be independently versioned.
2. Evaluator Prompt must not share with Generator Prompt.
3. Judge Prompt must not access holdout correct answers.
4. Planner Prompt must not receive forbidden_for_planning content.
5. Prompt changes must go through Evaluation Gate.
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
    | "reexecute_with_same_seed"
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

Hard Rules:

```
1. Replay reuses recorded LLM output by default.
2. Only simulation mode allows re-calling LLM.
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

```
1. external_untrusted must have boundary isolation before entering LLM.
2. potential_prompt_injection must not enter planner system prompt.
3. secret_bearing must not be written to memory / knowledge.
4. pii_bearing must be handled according to data policy.
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
    | "session"
    | "episodic"
    | "semantic"
    | "procedural"
    | "shared";

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

```
1. Tool output must not directly write to long-term memory.
2. potential_prompt_injection must not write to semantic / procedural memory.
3. Restricted data must not write to shared memory.
4. Memory write must go through before_memory_write guardrail.
5. Shared memory promotion must have audit record.
```

---

# 23. Guardrails Five-Layer Execution Model

## 23.1 Five-Layer Guardrails

| Layer | Execution Timing | Main Checks |
|---|---|---|
| Input Guardrail | After Request enters | Injection, privilege escalation, format, sensitive requests |
| Planning Guardrail | After PlanGraph generated | Prohibited graph structures, unauthorized tools, dangerous paths |
| Tool Guardrail | Before/after Tool call | Input security, output taint, side effect risk |
| Memory Guardrail | During Memory read/write | Cross-domain leakage, polluting long-term memory |
| Output Guardrail | Before output | Hallucination, no-evidence claims, sensitive info leakage |

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

Hard Rules:

```
1. critical guardrail block takes priority over evaluator accept.
2. LLM-as-Judge cannot override deterministic guardrail failure.
3. guardrail rewrite must record original input hash.
```

---

# 24. Decision Engine

## 24.1 DecisionInputBundle

```ts
type DecisionInputBundle = {
  verificationResult?: VerificationResult;
  evaluationReport?: EvaluationReport;
  guardrailResults: GuardrailHookResult[];
  policyOutcomes: PolicyOutcome[];
  sideEffectStates: SideEffectRecord[];
  budgetState: BudgetLedger;
  runtimeMode: RuntimeMode;
  incidentState?: IncidentState;
};
```

Hard Rules:

```
1. DecisionEngine can only consume DecisionInputBundle.
2. DecisionEngine is not allowed to directly read scattered service state.
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

```
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
| RuntimeProfile | Platform capability tier | core / durable / governed / enterprise / learning |
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
  | "manual_only"
  | "incident_mode";
```

## 25.3 Effective Autonomy

```
effectiveAutonomy =
  min(
    agentAutonomyMode,
    runtimeModeCeiling,
    domainCeiling,
    riskCeiling,
    policyCeiling
  )
```

Hard Rules:

```
1. RuntimeMode can lower AutonomyMode, but cannot raise it.
2. riskLevel high and above must limit autonomy.
3. incident_mode prohibits new side effects.
```

---

# 26. HITL Runtime

## 26.1 HITL Capabilities

```
Inspect
Patch
Override
Takeover
Resume
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

Hard Rules:

```
1. Human approve only approves current scope.
2. Human override policy requires higher authority.
3. After manual_takeover, Agent cannot continue automatically committing side effects unless resume explicitly allows.
4. All HITL operations must write to audit.
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

Hard Rules:

```
1. critical domain output must include limitations description.
2. Low confidence output must not be presented in definitive tone.
3. High-risk recommendations without evidence must not be output as executable instructions.
4. User-visible output must go through before_output guardrail.
```

---

# 28. Causal Lineage Query

## 28.1 Query Capabilities

Given `sideEffectId`, must be able to query:

```
Who triggered it
What observations were used
What assessments were passed through
Which PlanNode made the decision
What tools / models were called
What verifications passed
What evaluations supported
Who approved
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

Hard Rules:

```
1. Long-running runs must record version lock.
2. high / critical runs default to lock_for_entire_run.
3. Policy hot updates cannot silently change recovery semantics of already paused runs.
4. During recovery, if version is incompatible, must go through ResumeCompatibilityPolicy.
```

---

# 30. Effective Policy Snapshot

## 30.1 Configuration Priority

```
Platform Default
< Environment Override
< Tenant Policy
< Org Policy
< Domain Policy
< Pack Policy
< AgentVersion Policy
< Run ConstraintPack
< Emergency Directive
```

## 30.2 EffectivePolicySnapshot

```ts
type EffectivePolicySnapshot = {
  snapshotId: string;
  runId: string;
  resolvedAt: string;

  sources: {
    level: string;
    version: string;
    ref: string;
  }[];

  effectivePolicyHash: string;
};
```

Hard Rules:

```
1. Emergency Directive has highest priority.
2. Lower-level config can only tighten, cannot relax upper-level security constraints.
3. All finally effective config must generate EffectivePolicySnapshot.
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

```
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

Hard Rules:

```
1. LearningCandidate must not contain holdout eval cases.
2. Incident regression cases can enter incident_regression, must not enter prompt few-shot.
3. Policy Learning cannot go online automatically.
4. Prompt Learning must go through Evaluation Gate.
5. Domain Learning requires domain_owner review.
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

```
critical_case_pass_rate == 100%
incident_regression_pass_rate == 100%
safety_violation_rate == 0%
cost_delta <= +20%
latency_delta <= +20%
quality_score_delta >= -3%
human_override_rate must not increase significantly
```

## 32.3 Evaluation Hard Rules

```
1. LLM-as-Judge cannot override deterministic failure.
2. Evaluation focuses on outcome, not transcript.
3. Pre-release evaluation must run in isolated environment.
4. Online canary must compare with stable baseline.
5. Failed samples must enter regression set.
```

---

# 33. Release Pipeline

```
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

Hard Rules:

```
1. Learn / Improve must not directly change online behavior.
2. Release must pass EvaluationGate.
3. Prompt / Policy / Tool / Domain Descriptor release all require versioning.
4. Rollback must be able to restore previous stable version.
```

---

# 34. Error Code Taxonomy

## 34.1 Naming Convention

```
OAPEFLIR.{LAYER}.{CATEGORY}.{SPECIFIC}
```

Examples:

```
OAPEFLIR.GRAPH.VALIDATION.NO_ENTRY_NODE
OAPEFLIR.GRAPH.VALIDATION.UNBOUNDED_LOOP
OAPEFLIR.NODE.STATE.INVALID_TRANSITION
OAPEFLIR.SIDEEFFECT.CONFIRMATION.TIMEOUT
OAPEFLIR.HITL.LOCK.CONFLICT
OAPEFLIR.REPLAY.NONDETERMINISTIC_INPUT
OAPEFLIR.LEARNING.CANDIDATE.PII_DETECTED
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
| `oapeflir.run.total` | Total runs |
| `oapeflir.run.duration_ms` | Run end-to-end duration |
| `oapeflir.graph.node.count` | Graph node count |
| `oapeflir.graph.replan.count` | Replan count |
| `oapeflir.node.retry.count` | Node retry count |
| `oapeflir.side_effect.ambiguous.count` | Side effect ambiguous count |
| `oapeflir.reconciliation.pending.count` | Pending reconciliation count |
| `oapeflir.hitl.pending.count` | Pending human count |
| `oapeflir.budget.remaining` | Remaining budget |
| `oapeflir.guardrail.block.count` | Guardrail block count |
| `oapeflir.evaluation.score` | Evaluation score |
| `oapeflir.learning.candidate.count` | Learning candidate count |

---

# 36. Incident Rules

| Rule | Condition | Severity | Action |
|---|---|---|---|
| side_effect_ambiguous_irreversible | Irreversible side effect ambiguous | SEV2 | Human reconciliation + pause related runs |
| graph_deadlock_detected | Graph deadlock | SEV3 | abort / replan |
| budget_exhausted_high_priority | High priority task budget exhausted | SEV3 | Human handling |
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

```
Run valid transition tests
Run invalid transition tests
Node valid transition tests
Node terminal state immutability tests
Retry creates new attempt tests
Redrive lineage tests
```

## 38.2 Graph Tests

```
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

```
proposed → approved → committed → confirmed
committed → ambiguous → reconciliation
irreversible ambiguous requires human
duplicate idempotency key
external timeout after commit
compensation append-only
```

## 38.4 Guardrail / Policy Tests

```
critical guardrail blocks evaluator accept
policy deny beats planner preference
budget exhausted beats retry
LLM judge cannot override deterministic failure
```

## 38.5 HITL Tests

```
lock acquisition
lock conflict
timeout escalation
scope-limited approval
manual takeover prevents auto side effect
resume with patched graph
```

## 38.6 Learning / Release Tests

```
holdout contamination blocked
PII candidate rejected
prompt change eval gate
incident regression gate
canary rollback
```

## 38.7 Fault Injection Tests

```
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

```
src/platform/oapeflir/
  runtime/
    oapeflir-runtime.ts
    run-state-machine.ts
    node-state-machine.ts

  graph/
    plan-graph.ts
    graph-normalizer.ts
    graph-validator.ts
    graph-risk-propagator.ts
    graph-worst-path-analyzer.ts
    graph-scheduler.ts
    graph-patch.ts

  events/
    event-registry.ts
    event-store.ts
    event-schemas/
    replay-behavior.ts

  budget/
    budget-ledger.ts
    budget-reservation.ts

  context/
    context-assembler.ts
    context-contract.ts
    taint-policy.ts
    redaction-policy.ts

  prompt/
    prompt-execution-contract.ts
    prompt-boundary-policy.ts

  llm/
    llm-decision-record.ts
    deterministic-runtime-seed.ts

  side-effects/
    side-effect-manager.ts
    side-effect-contract.ts
    reversibility-profile.ts
    reconciliation-state-machine.ts
    compensation-manager.ts

  decision/
    decision-input-bundle.ts
    decision-engine.ts
    decision-precedence-policy.ts

  guardrails/
    input-guardrail.ts
    planning-guardrail.ts
    tool-guardrail.ts
    memory-guardrail.ts
    output-guardrail.ts

  hitl/
    hitl-lock.ts
    hitl-escalation-policy.ts
    human-responsibility-record.ts

  memory/
    memory-write-request.ts
    memory-governance.ts

  evaluation/
    evaluation-harness.ts
    evaluation-gate.ts
    outcome-grader.ts
    regression-suite.ts

  learning/
    learning-candidate.ts
    learning-quarantine.ts
    improvement-changeset.ts

  release/
    release-pipeline.ts
    canary-controller.ts
    rollback-controller.ts

  lineage/
    causal-lineage-query.ts
    evidence-collector.ts

  errors/
    oapeflir-error.ts
    error-taxonomy.ts

  observability/
    metrics.ts
    incident-rules.ts
    trace-exporter.ts

  tests/
    state-machine/
    graph/
    side-effects/
    replay/
    hitl/
    learning/
    fault-injection/
```

---

# 40. v4.4 Minimum Implementation Roadmap

## Phase A: Executable Core

Deliverables:

```
Run State Machine
Node State Machine
Event Registry
PlanGraph
Graph Validator
Deterministic Scheduler
Budget Ledger Basic Version
```

Acceptance Criteria:

```
Can create run
Can generate graph
Can execute node
Can record event
Can deterministically replay scheduling order
```

## Phase B: Governed Execution

Deliverables:

```
SideEffect Manager
SideEffect Delivery Contract
Reconciliation State Machine
Guardrails Five-Layer Basic
DecisionInputBundle
Decision Engine
```

Acceptance Criteria:

```
High-risk side effects can be blocked
ambiguous can enter reconciliation
policy / guardrail / evaluator conflicts can be arbitrated
```

## Phase C: Durable + HITL

Deliverables:

```
Checkpoint
Pause / Resume
HITL Lock
HumanResponsibilityRecord
GraphPatch
RunVersionLock
```

Acceptance Criteria:

```
Humans can inspect / patch / approve / resume
Can recover after worker crash
Long-running run version lock takes effect
```

## Phase D: Evaluation + Learning

Deliverables:

```
Evaluation Harness
Evaluation Gates
LearningCandidate Quarantine
Release Pipeline
Canary / Rollback
```

Acceptance Criteria:

```
Prompt / Policy improvements cannot go directly online
Release must pass eval gate
Contaminated learning candidates are blocked
```

---

# 41. v4.4 ADR Freeze List

```
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

The key upgrade of OAPEFLIR v4.4 compared to v4.3 is:

| Dimension | v4.3 | v4.4 |
|---|---|---|
| Runtime Specification | Production Runtime Contract | Executable Specification |
| Plan | Graph-ified | Graph verifiable, schedulable, patchable |
| Event | Has event concept | Event Registry + Replay Semantics |
| State Machine | Has state machine | Terminal state closure + retry lineage |
| Scheduling | ready node | deterministic scheduler |
| SideEffect | proposed/committed/confirmed | delivery semantics + reconciliation |
| HITL | lock + resolve | scope + SLA + responsibility |
| Replay | Has boundaries | runtime seed + no real side effect |
| Context | Has context | per-role context contract |
| Prompt | Role-separated | prompt execution contract |
| Learning | quarantine | candidate state machine + contamination block |
| Evaluation | Has evaluation | release gate threshold |
| Implementation | Designable | Encodable, testable, verifiable |

Final Conclusion:

> **OAPEFLIR v4.4 can already serve as the detailed design baseline for the core Runtime of an enterprise-grade Agent platform.**

It is no longer an "Agent flowchart", but:

```
A production-grade Agent Runtime with:
  PlanGraph as the core,
  Event Registry as the source of truth,
  Deterministic Scheduler as execution order,
  SideEffect Manager as risk boundary,
  HITL Runtime as human control plane,
  Evaluation Harness as quality gate,
  Learning Release Pipeline as evolution mechanism.
```

The next step after v4.4 is not to continue expanding the architecture scope, but to enter:

```
OAPEFLIR v4.4 Implementation Addendum
```

Key supplements:

```
Database table structures
Zod Schema
TypeScript interface
State transition test cases
Graph Scheduler algorithm pseudocode
SideEffect Adapter contracts
Reconciliation Worker design
Replay Engine design
Evaluation Gate Runner
CI Test Matrix
```
