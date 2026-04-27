# OAPEFLIR v4.4 完整版

## Executable Specification Edition：面向生产级 Agent 平台的可执行运行规范

> **版本**：v4.4  
> **状态**：Proposed → 可进入架构评审 / 详细设计 / 实现拆解  
> **定位**：OAPEFLIR 从“受控认知流程”升级为“可编码、可测试、可恢复、可审计、可长期运行”的生产级 Agent Runtime 规范  
> **核心变化**：全面吸收 v4.3 review 改进项，重点补齐 Event Registry、PlanGraph 可执行语义、确定性调度、SideEffect 交付语义、Reconciliation、Budget Ledger、Context Assembly、Version Lock、Memory Governance、Evaluation Gate、HITL 责任边界和测试矩阵。

---

## 目录

- [0. v4.4 核心结论](#0-v44-核心结论)
- [1. 设计目标](#1-设计目标)
- [2. OAPEFLIR 八阶段定义](#2-oapeflir-八阶段定义)
- [3. 总体运行架构](#3-总体运行架构)
- [4. 核心运行实体](#4-核心运行实体)
- [5. NodeRun 状态机](#5-noderun-状态机)
- [6. Plan 必须是 Graph](#6-plan-必须是-graph)
- [7. PlanGraph 契约](#7-plangraph-契约)
- [8. Graph Normalization](#8-graph-normalization)
- [9. Graph Validation](#9-graph-validation)
- [10. Graph Risk Propagation](#10-graph-risk-propagation)
- [11. Graph Worst-Path Analysis](#11-graph-worst-path-analysis)
- [12. Graph Scheduler 确定性调度](#12-graph-scheduler-确定性调度)
- [13. GraphPatch 与 Replan](#13-graphpatch-与-replan)
- [14. Event Registry](#14-event-registry)
- [15. Budget Ledger](#15-budget-ledger)
- [16. SideEffect Manager](#16-sideeffect-manager)
- [17. Reconciliation State Machine](#17-reconciliation-state-machine)
- [18. Context Assembly Contract](#18-context-assembly-contract)
- [19. Prompt Execution Contract](#19-prompt-execution-contract)
- [20. LLM Decision Record 与 Deterministic Replay](#20-llm-decision-record-与-deterministic-replay)
- [21. Tool Output Taint Model](#21-tool-output-taint-model)
- [22. Memory Write Governance](#22-memory-write-governance)
- [23. Guardrails 五层执行模型](#23-guardrails-五层执行模型)
- [24. Decision Engine](#24-decision-engine)
- [25. Runtime Profile / Runtime Mode / Autonomy Mode](#25-runtime-profile--runtime-mode--autonomy-mode)
- [26. HITL Runtime](#26-hitl-runtime)
- [27. Final Output Contract](#27-final-output-contract)
- [28. Causal Lineage Query](#28-causal-lineage-query)
- [29. Run Version Lock](#29-run-version-lock)
- [30. Effective Policy Snapshot](#30-effective-policy-snapshot)
- [31. Learning Candidate](#31-learning-candidate)
- [32. Evaluation Harness](#32-evaluation-harness)
- [33. Release 管线](#33-release-管线)
- [34. Error Code Taxonomy](#34-error-code-taxonomy)
- [35. Observability Metrics](#35-observability-metrics)
- [36. Incident Rules](#36-incident-rules)
- [37. Runtime Capability Matrix](#37-runtime-capability-matrix)
- [38. Runtime Test Matrix](#38-runtime-test-matrix)
- [39. 实现目录建议](#39-实现目录建议)
- [40. v4.4 最小落地路线](#40-v44-最小落地路线)
- [41. v4.4 必须冻结的 ADR](#41-v44-必须冻结的-adr)
- [42. 最终判断](#42-最终判断)

---

# 0. v4.4 核心结论

OAPEFLIR v4.4 的核心定位是：

> **把 Agent 的“观察、评估、规划、执行、反馈、学习、改进、发布”从抽象流程，落成一套可执行的生产级状态机与图运行协议。**

v4.4 不再只描述“Agent 应该怎么思考”，而是明确：

```text
什么状态可以迁移
什么事件必须记录
什么图可以执行
什么副作用可以提交
什么情况下必须暂停
什么情况下可以重试
什么情况下必须人工接管
什么学习结果可以进入线上
什么评测门禁必须阻断发布
什么证据必须永久保存
```

一句话概括：

```text
OAPEFLIR v4.4 = PlanGraph + Event Sourcing + Deterministic Runtime + Governed SideEffect + HITL + Evaluation + Learning Release
```

---

# 1. 设计目标

## 1.1 总目标

构建一个能长期稳定运行、能解决复杂实际问题、具备生产力价值的 Agent 平台运行内核。

它必须满足：

| 目标 | 说明 |
|---|---|
| 稳定 | Worker 崩溃、LLM 失败、工具失败、外部系统异常后可恢复 |
| 可靠 | 状态机封闭、事件可追溯、副作用可确认 |
| 智能 | Plan 是 Graph，可重规划、可评估、可学习 |
| 可控 | 风险、预算、工具、权限、上下文、输出全部受约束 |
| 可审计 | 每次决策、工具调用、人工审批、副作用都有证据链 |
| 可恢复 | 支持 checkpoint、pause、resume、replay、redrive、repair |
| 可演进 | Prompt、Policy、Tool、Model、Domain、Eval 均版本化 |
| 可运营 | 具备 metrics、incident、DLQ、reconciliation、dashboard |
| 可验证 | 支持状态机测试、属性测试、故障注入、回放一致性测试 |

---

# 2. OAPEFLIR 八阶段定义

OAPEFLIR 保持八阶段，但 v4.4 明确每阶段的工程边界。

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

## 2.1 阶段职责总表

| 阶段 | 职责 | 产物 | 是否可直接产生副作用 |
|---|---|---|---|
| Observe | 观察输入、事件、上下文、目标 | ObservationBundle | 否 |
| Assess | 风险、权限、可行性、预算、策略评估 | AssessmentBundle | 否 |
| Plan | 生成可执行 PlanGraph | PlanGraphBundle | 否 |
| Execute | 执行 Graph Node，调用工具 / LLM / 人工等待 | NodeRun / ExecutionReceipt | 受控 |
| Feedback | 对执行结果、偏差、质量、风险进行反馈 | FeedbackEnvelope | 否 |
| Learn | 从反馈中提取候选经验 | LearningCandidate | 否 |
| Improve | 生成 Prompt / Policy / Tool / Domain 改进候选 | ImprovementChangeSet | 否 |
| Release | 评测、审批、灰度、发布、回滚 | ReleaseRecord | 是，但仅限配置发布 |

---

# 3. 总体运行架构

```text
RequestEnvelope
   │
   ▼
┌─────────────────────────────────────────────────────────┐
│                  OAPEFLIR Runtime v4.4                  │
│                                                         │
│  Observe ─→ Assess ─→ PlanGraph ─→ Graph Scheduler       │
│                              │                          │
│                              ▼                          │
│                      Node Execution Runtime              │
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

# 4. 核心运行实体

## 4.1 OapeflirRun

一次完整 OAPEFLIR 运行。

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

## 4.3 Run 状态机

```text
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

任何非终态
  → failed / aborted
```

## 4.4 Run 终态封闭规则

```text
1. completed / failed / aborted 为终态，不允许迁出。
2. terminal run 不允许再次 running。
3. redrive 必须创建新的 runId 或 redriveRunId，不得覆盖原 run。
4. failed run 的 repair 只能追加 RepairRecord，不得修改原始失败事件。
5. aborted run 可被 replay 分析，但不得原地恢复。
6. completed run 只能生成 follow-up run，不得继续追加执行节点。
```

---

# 5. NodeRun 状态机

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

## 5.3 Node 状态迁移

```text
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

## 5.4 Node 终态封闭规则

```text
1. succeeded 不允许重新 running。
2. compensated 不允许变回 succeeded。
3. cancelled 不允许 resume，除非 redrive 创建新的 nodeRunId。
4. failed retry 必须创建新的 attemptId。
5. retry 不得覆盖原失败记录。
6. skipped 必须记录 skipReason。
7. redrive 必须保留 lineage。
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

# 6. Plan 必须是 Graph

## 6.1 基本原则

v4.4 明确规定：

> **Plan 不允许是简单线性 steps。Plan 必须是 PlanGraph。**

原因：复杂实际问题通常包含：

```text
并行任务
条件分支
人工审批
子图委托
失败补偿
回滚路径
外部等待
重规划 patch
join / merge
```

线性 steps 无法表达这些复杂结构。

---

# 7. PlanGraph 契约

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

LLM 或人工生成的 draft graph 不得直接执行，必须经过标准化。

## 8.1 标准化流程

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

## 9.1 必须校验项

```text
1. 必须至少有一个 entry node。
2. 必须至少有一个 terminal node。
3. 不允许未声明的 node type。
4. 不允许孤立节点。
5. 不允许无界循环。
6. 不允许无 timeout 的 wait / human_gate。
7. 不允许 high risk node 缺少 verification。
8. 不允许 irreversible side effect 缺少 confirmation / reconciliation。
9. 不允许 join 等待永远不会触发的分支。
10. 不允许跨权限数据流。
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

## 10.1 风险传播规则

```text
1. 如果上游节点读取 restricted 数据，下游消费节点 risk 至少 medium。
2. 如果节点产生 irreversible side effect，下游 join / terminal 必须检查 confirmation。
3. 如果分支包含 external write，整个 subgraph risk 不低于 high。
4. 如果工具输出 taint = potential_prompt_injection，下游 LLM 节点必须隔离上下文。
5. 如果任一节点需要 human_gate，其后续 side_effect_commit 不得绕过人工批准 scope。
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

复杂图执行前必须计算最坏路径。

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

硬规则：

```text
1. 如果 worst-path budget 超限，PlanGraph 不得进入 ready。
2. 如果最高风险路径缺少 HITL / verification，PlanGraph 不得执行。
3. 如果不可逆副作用路径缺少 confirmation，必须插入 reconciliation。
```

---

# 12. Graph Scheduler 确定性调度

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

## 12.2 调度硬规则

```text
1. Graph Scheduler 必须 deterministic。
2. 同一 graph + 同一 runtime seed + 同一 event history，必须得到相同调度顺序。
3. parallel node 也必须稳定排序。
4. replay 时不得重新选择调度顺序。
5. 调度决策必须记录为 scheduler.decision_recorded 事件。
```

---

# 13. GraphPatch 与 Replan

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

硬规则：

```text
1. 已完成节点不得被删除，只能被标记为 superseded。
2. 正在运行节点不得被替换，除非先 pause。
3. GraphPatch 后旧 checkpoint 必须能映射到新 graph。
4. join 语义变化必须触发人工审核。
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

## 14.3 Event 硬规则

```text
1. 所有状态变更必须由 Event 驱动。
2. Event append 与 truth state 更新必须同事务。
3. Event sequence 在 run 内单调递增。
4. Event payload 必须有 schema version。
5. Event 不允许物理删除。
6. Projection 只能由 Event 重建，不得反写真相。
7. Replay 必须遵守 replayBehavior。
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

## 15.3 Budget 硬规则

```text
1. LLM call 前必须 reserve budget。
2. Tool call 前必须 reserve budget。
3. SideEffect commit 前必须 reserve budget。
4. Evaluation / Judge 调用也必须计费。
5. call 失败后按策略 consume / release。
6. budget exhausted 优先级高于 retry / replan。
7. Replan 必须重新做 worst-path budget analysis。
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

## 16.6 SideEffect 提交流程

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

硬规则：

```text
1. 工具执行成功不等于副作用成功。
2. SideEffect 必须先 proposed，再 approved，再 committed。
3. irreversible side effect 必须有 confirmationMethod。
4. ambiguous 不得自动转 succeeded。
5. high / critical side effect 必须支持 reconciliation。
6. compensation 不得删除原始 side effect 记录。
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

## 17.2 Reconciliation 硬规则

```text
1. ambiguous 不得自动转 confirmed。
2. irreversible side effect ambiguous 必须人工处理。
3. reconciliation 超时必须升级 incident。
4. reconciliation 结果必须反写 SideEffectRecord。
5. manual_resolution 必须记录 HumanResponsibilityRecord。
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

## 18.3 Context 硬规则

```text
1. Planner / Generator / Evaluator 必须使用不同 ContextAssemblyContract。
2. Context 必须可哈希、可回放。
3. external_untrusted 只能进入 user/data 区，不得进入 system/developer 区。
4. redacted 字段不得通过 summary 泄漏。
5. restricted 数据不得进入无权限 subgraph / subagent。
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

## 19.2 Prompt 硬规则

```text
1. Planner / Generator / Evaluator Prompt 必须独立版本化。
2. Evaluator Prompt 不得与 Generator Prompt 共用。
3. Judge Prompt 不得访问 holdout 标准答案。
4. Planner Prompt 不得接收 forbidden_for_planning 内容。
5. Prompt 变更必须经过 Evaluation Gate。
```

---

# 20. LLM Decision Record 与 Deterministic Replay

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

硬规则：

```text
1. Replay 默认复用 recorded LLM output。
2. 只有 simulation 模式允许重新调用 LLM。
3. 所有非确定性输入必须记录：时间、随机数、环境变量、配置版本。
4. Replay 不得产生真实 side effect。
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

## 21.2 Taint 传播规则

```text
1. external_untrusted 进入 LLM 前必须加边界隔离。
2. potential_prompt_injection 不得进入 planner system prompt。
3. secret_bearing 不得写入 memory / knowledge。
4. pii_bearing 必须按 data policy 处理。
5. restricted 不得跨 tenant / domain 传播。
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

## 22.2 Memory 写入硬规则

```text
1. Tool output 不得直接写 long-term memory。
2. potential_prompt_injection 不得写 semantic / procedural memory。
3. restricted 数据不得写 shared memory。
4. Memory write 必须经过 before_memory_write guardrail。
5. shared memory 晋升必须有审核记录。
```

---

# 23. Guardrails 五层执行模型

## 23.1 五层 Guardrails

| 层 | 执行时机 | 主要检查 |
|---|---|---|
| Input Guardrail | Request 进入后 | 注入、越权、格式、敏感请求 |
| Planning Guardrail | PlanGraph 生成后 | 禁止图结构、越权工具、危险路径 |
| Tool Guardrail | Tool 调用前后 | 输入安全、输出 taint、副作用风险 |
| Memory Guardrail | Memory 读写时 | 跨域泄漏、污染长期记忆 |
| Output Guardrail | 输出前 | 幻觉、无证据声明、敏感信息泄露 |

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

硬规则：

```text
1. critical guardrail block 优先级高于 evaluator accept。
2. LLM-as-Judge 不得覆盖确定性 guardrail failure。
3. guardrail rewrite 必须记录原始输入 hash。
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

硬规则：

```text
1. DecisionEngine 只能消费 DecisionInputBundle。
2. DecisionEngine 不允许直接读取分散服务状态。
3. DecisionInputBundle 必须在生成 decision 前冻结。
4. 冻结后的 bundle 必须 hash 并写入 evidence。
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

从高到低：

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

## 25.1 三者区别

| 概念 | 含义 | 示例 |
|---|---|---|
| RuntimeProfile | 平台能力层级 | core / durable / governed / enterprise / learning |
| RuntimeMode | 当前运行保护模式 | full_auto / read_only / manual_only |
| AutonomyMode | Agent 自主权等级 | suggestion / supervised / semi_auto / full_auto |

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

## 25.3 生效自主权

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

硬规则：

```text
1. RuntimeMode 可降低 AutonomyMode，但不得提升。
2. RiskLevel high 以上必须限制 autonomy。
3. incident_mode 下禁止新 side effect。
```

---

# 26. HITL Runtime

## 26.1 HITL 能力

```text
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

硬规则：

```text
1. 人工 approve 只批准当前 scope。
2. 人工 override policy 必须更高权限。
3. manual_takeover 后 Agent 不得继续自动提交副作用，除非 resume 显式允许。
4. 所有 HITL 操作必须写 audit。
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

硬规则：

```text
1. critical domain 输出必须包含限制说明。
2. 低置信度输出不得以确定语气呈现。
3. 无 evidence 的高风险建议不得输出为可执行指令。
4. 用户可见输出必须经过 before_output guardrail。
```

---

# 28. Causal Lineage Query

## 28.1 查询能力

给定 `sideEffectId`，必须能查到：

```text
谁触发
使用了哪些 observation
经过哪些 assessment
由哪个 PlanNode 决定
调用了哪些 tool / model
哪些 verification 通过
哪些 evaluation 支持
谁审批
最终外部确认是什么
是否发生 reconciliation / compensation
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

硬规则：

```text
1. 长时 run 必须记录版本锁。
2. high / critical run 默认 lock_for_entire_run。
3. policy 热更新不能静默改变已暂停 run 的恢复语义。
4. 恢复时如版本不兼容，必须走 ResumeCompatibilityPolicy。
```

---

# 30. Effective Policy Snapshot

## 30.1 配置优先级

```text
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

硬规则：

```text
1. Emergency Directive 最高优先级。
2. 下级配置只能收紧，不能放松上级安全约束。
3. 所有最终生效配置必须生成 EffectivePolicySnapshot。
```

---

# 31. Learning Candidate

## 31.1 LearningCandidate 类型

```ts
type LearningCandidateType =
  | "operational_learning"
  | "prompt_learning"
  | "policy_learning"
  | "domain_learning"
  | "tool_learning"
  | "evaluation_learning";
```

## 31.2 LearningCandidate 状态机

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

硬规则：

```text
1. LearningCandidate 不得包含 holdout eval case。
2. Incident regression case 可进入 incident_regression，不得进入 prompt few-shot。
3. Policy Learning 不得自动上线。
4. Prompt Learning 必须经过 Evaluation Gate。
5. Domain Learning 必须 domain_owner 审核。
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

## 32.2 默认发布门禁

```text
critical_case_pass_rate == 100%
incident_regression_pass_rate == 100%
safety_violation_rate == 0%
cost_delta <= +20%
latency_delta <= +20%
quality_score_delta >= -3%
human_override_rate 不得显著升高
```

## 32.3 Evaluation 硬规则

```text
1. LLM-as-Judge 不能覆盖确定性失败。
2. Evaluation 以 outcome 为主，不以 transcript 为主。
3. 发布前评测必须在隔离环境运行。
4. 线上灰度必须与 stable baseline 对比。
5. 失败样例必须进入 regression set。
```

---

# 33. Release 管线

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

硬规则：

```text
1. Learn / Improve 不得直接改变线上行为。
2. Release 必须通过 EvaluationGate。
3. Prompt / Policy / Tool / Domain Descriptor 发布均需版本化。
4. rollback 必须能恢复上一稳定版本。
```

---

# 34. Error Code Taxonomy

## 34.1 命名规范

```text
OAPEFLIR.{LAYER}.{CATEGORY}.{SPECIFIC}
```

示例：

```text
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

| Metric | 说明 |
|---|---|
| `oapeflir.run.total` | Run 总数 |
| `oapeflir.run.duration_ms` | Run 端到端耗时 |
| `oapeflir.graph.node.count` | 图节点数 |
| `oapeflir.graph.replan.count` | 重规划次数 |
| `oapeflir.node.retry.count` | Node 重试次数 |
| `oapeflir.side_effect.ambiguous.count` | 副作用不确定次数 |
| `oapeflir.reconciliation.pending.count` | 待对账数 |
| `oapeflir.hitl.pending.count` | 待人工数 |
| `oapeflir.budget.remaining` | 剩余预算 |
| `oapeflir.guardrail.block.count` | Guardrail 拦截数 |
| `oapeflir.evaluation.score` | 评估分 |
| `oapeflir.learning.candidate.count` | 学习候选数 |

---

# 36. Incident Rules

| 规则 | 条件 | 级别 | 动作 |
|---|---|---|---|
| side_effect_ambiguous_irreversible | 不可逆副作用 ambiguous | SEV2 | 人工对账 + 暂停相关 run |
| graph_deadlock_detected | Graph deadlock | SEV3 | abort / replan |
| budget_exhausted_high_priority | 高优任务预算耗尽 | SEV3 | 人工处理 |
| replay_inconsistent | Replay 结果不一致 | SEV2 | runtime freeze for affected version |
| guardrail_critical_block | critical guardrail block | SEV2 | incident + quarantine |
| learning_contamination | 学习候选污染 | SEV2 | reject candidate + audit |

---

# 37. Runtime Capability Matrix

| 能力 | Core | Durable | Governed | Enterprise | Learning |
|---|---:|---:|---:|---:|---:|
| PlanGraph | ✅ | ✅ | ✅ | ✅ | ✅ |
| Event Registry | ✅ | ✅ | ✅ | ✅ | ✅ |
| Deterministic Scheduler | ✅ | ✅ | ✅ | ✅ | ✅ |
| Checkpoint | ❌ | ✅ | ✅ | ✅ | ✅ |
| Replay | ❌ | ✅ | ✅ | ✅ | ✅ |
| SideEffect Manager | ❌ | Partial | ✅ | ✅ | ✅ |
| Reconciliation | ❌ | ❌ | ✅ | ✅ | ✅ |
| HITL Lock | ❌ | ❌ | ✅ | ✅ | ✅ |
| Budget Ledger | Partial | ✅ | ✅ | ✅ | ✅ |
| Guardrails 五层 | Partial | Partial | ✅ | ✅ | ✅ |
| Delegation / Subgraph | ❌ | Partial | Partial | ✅ | ✅ |
| Evaluation Harness | ❌ | ❌ | Partial | ✅ | ✅ |
| Learning Quarantine | ❌ | ❌ | ❌ | Partial | ✅ |
| Release Gate | ❌ | ❌ | Partial | ✅ | ✅ |

---

# 38. Runtime Test Matrix

## 38.1 状态机测试

```text
Run valid transition tests
Run invalid transition tests
Node valid transition tests
Node terminal state immutability tests
Retry creates new attempt tests
Redrive lineage tests
```

## 38.2 Graph 测试

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

## 38.3 SideEffect 测试

```text
proposed → approved → committed → confirmed
committed → ambiguous → reconciliation
irreversible ambiguous requires human
duplicate idempotency key
external timeout after commit
compensation append-only
```

## 38.4 Guardrail / Policy 测试

```text
critical guardrail blocks evaluator accept
policy deny beats planner preference
budget exhausted beats retry
LLM judge cannot override deterministic failure
```

## 38.5 HITL 测试

```text
lock acquisition
lock conflict
timeout escalation
scope-limited approval
manual takeover prevents auto side effect
resume with patched graph
```

## 38.6 Learning / Release 测试

```text
holdout contamination blocked
PII candidate rejected
prompt change eval gate
incident regression gate
canary rollback
```

## 38.7 故障注入测试

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

# 39. 实现目录建议

```text
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

# 40. v4.4 最小落地路线

## Phase A：Executable Core

交付：

```text
Run State Machine
Node State Machine
Event Registry
PlanGraph
Graph Validator
Deterministic Scheduler
Budget Ledger 基础版
```

验收：

```text
可创建 run
可生成 graph
可执行 node
可记录 event
可确定性 replay 调度顺序
```

## Phase B：Governed Execution

交付：

```text
SideEffect Manager
SideEffect Delivery Contract
Reconciliation State Machine
Guardrails 五层基础
DecisionInputBundle
Decision Engine
```

验收：

```text
高风险副作用可阻断
ambiguous 可进入 reconciliation
policy / guardrail / evaluator 冲突可裁决
```

## Phase C：Durable + HITL

交付：

```text
Checkpoint
Pause / Resume
HITL Lock
HumanResponsibilityRecord
GraphPatch
RunVersionLock
```

验收：

```text
人工可 inspect / patch / approve / resume
worker crash 后可恢复
长时 run 版本锁生效
```

## Phase D：Evaluation + Learning

交付：

```text
Evaluation Harness
Evaluation Gates
LearningCandidate Quarantine
Release Pipeline
Canary / Rollback
```

验收：

```text
Prompt / Policy 改进不能直接上线
发布必须通过 eval gate
污染学习候选会被阻断
```

---

# 41. v4.4 必须冻结的 ADR

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

# 42. 最终判断

OAPEFLIR v4.4 相比 v4.3 的关键升级是：

| 维度 | v4.3 | v4.4 |
|---|---|---|
| 运行规范 | 生产运行契约 | 可执行规范 |
| Plan | Graph 化 | Graph 可验证、可调度、可 patch |
| Event | 有事件概念 | Event Registry + Replay Semantics |
| 状态机 | 有状态机 | 终态封闭 + retry lineage |
| 调度 | ready node | deterministic scheduler |
| SideEffect | proposed/committed/confirmed | delivery semantics + reconciliation |
| HITL | lock + resolve | scope + SLA + responsibility |
| Replay | 有边界 | runtime seed + no real side effect |
| Context | 有上下文 | per-role context contract |
| Prompt | 分角色 | prompt execution contract |
| Learning | quarantine | candidate state machine + contamination block |
| Evaluation | 有评测 | release gate threshold |
| 实现 | 可设计 | 可编码、可测试、可验证 |

最终结论：

> **OAPEFLIR v4.4 已经可以作为企业级 Agent 平台的核心 Runtime 详细设计基线。**

它不再是“Agent 流程图”，而是：

```text
一个以 PlanGraph 为核心，
以 Event Registry 为事实历史，
以 Deterministic Scheduler 为执行顺序，
以 SideEffect Manager 为风险边界，
以 HITL Runtime 为人工控制面，
以 Evaluation Harness 为质量门禁，
以 Learning Release Pipeline 为演进机制的
生产级 Agent Runtime。
```

v4.4 之后的下一步不建议继续扩大架构范围，而应该进入：

```text
OAPEFLIR v4.4 Implementation Addendum
```

重点补：

```text
数据库表结构
Zod Schema
TypeScript interface
状态迁移测试用例
Graph Scheduler 算法伪代码
SideEffect Adapter 合约
Reconciliation Worker 设计
Replay Engine 设计
Evaluation Gate Runner
CI Test Matrix
```
