# OAPEFLIR v4.4 完整版

## Executable Specification Edition：认知/治理语义与迁移输入规范

> **版本**：v4.4  
> **状态**：Reference Draft（迁移输入；非权威运行时基线）  
> **定位**：OAPEFLIR v4.4 只保留认知/治理语义、投影视图与迁移设计输入；唯一可执行运行时入口仍是 `HarnessRuntime`，权威执行对象仍是 `HarnessRun / PlanGraphBundle / NodeRun / NodeAttemptReceipt`  
> **核心变化**：保留对 Event Registry、PlanGraph、Deterministic Scheduler、SideEffect、Budget、HITL、Guardrail、Replay、Learning Release 的设计意图，但所有可执行权威语义都必须收敛到 `docs_zh/architecture/00-platform-architecture.md`、ADR-109~112 与 canonical executable contracts。

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

> **把 Agent 的“观察、评估、规划、执行、反馈、学习、改进、发布”表达为一套受控认知/治理语义，用来解释和约束 `HarnessRuntime` 主链，而不是再定义第二套执行运行时。**

v4.4 不再只描述“Agent 应该怎么思考”，而是明确：

```text
哪些状态迁移必须由 HarnessRuntime / RuntimeStateMachine 先落 truth
哪些事件与证据必须被 OAPEFLIR 解释为闭环视图
哪些图执行、预算、副作用、暂停、重试、人工接管规则
必须由主架构和 canonical contracts 先定义，OAPEFLIR 只能引用与解释
```

一句话概括：

```text
OAPEFLIR v4.4 = Controlled Cognitive/Governance Semantics over HarnessRuntime
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
| Execute | 消费 `HarnessRuntime` 已推进的节点执行事实，并生成阶段视图 | `NodeRun` / `NodeAttemptReceipt` / `oapeflir.view.*` | 否（副作用仍由 Harness 主链受控提交） |
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

# 4. 核心运行实体

## 4.1 HarnessRun 是唯一权威 Run

`HarnessRun` 才是一次完整运行的唯一权威实体；本 spec 不再把 `OapeflirRun` 当作可执行 truth 对象。旧 `OapeflirRun` 只允许作为 migration alias 或 explainability projection 出现。

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

## 4.3 状态权威边界

```text
1. HarnessRun.status 是唯一可执行 Run 状态来源。
2. OAPEFLIR 阶段只表达 stage projection，不拥有 run status / lease / retry counter / budget state。
3. 任何真实状态迁移都必须经 RuntimeStateMachine.transition(command)。
4. replay / redrive / repair 只能追加新的 Harness / Node / Attempt / Evidence 记录，不得覆盖旧 truth。
```

---

# 5. NodeRun 生命周期投影（引用 canonical contract）

## 5.1 NodeRun

> 本节只引用 `node-run-attempt-receipt-contract.md` 的 canonical 形状作为迁移输入摘要；NodeRun 真正的状态集与合法跃迁权威不在 OAPEFLIR spec 内定义。

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

## 5.3 Node 状态迁移

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

## 5.4 Node 终态封闭规则（解释性约束）

```text
1. `succeeded / failed / skipped / cancelled / dependency_failed / policy_blocked / aborted` 为终态，不得迁出。
2. retry 只能通过追加新的 attemptId 表达，不得覆盖原失败记录。
3. `awaiting_hitl` 恢复后必须回到活跃执行链，不得伪装成普通 `blocked`。
4. `reconciling` 只表示副作用/外部状态确认阶段，不得写成 `compensating / compensated` 这类由 OAPEFLIR 拥有的节点状态。
5. redrive 必须保留 lineage。
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

Graph Scheduler 属于 `HarnessRuntime` 的 P4 执行职责；OAPEFLIR 只消费调度事实并生成 scheduler rationale / view。

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
5. 调度决策必须记录为 `platform.scheduler.decision_recorded` 事件。
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

## 14.2 Event Type 分层

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

硬规则：

```text
1. truth projector 只能消费 platform.* facts。
2. OAPEFLIR 事件只能使用 `oapeflir.view.*` / `oapeflir.rationale.*`，不得伪装成 `run.*` / `node.*` / `side_effect.*` truth 事件。
3. projection event 不得反向驱动 HarnessRun / NodeRun / Budget / SideEffect truth。
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

Budget truth 归属 P5/Budget 服务；HarnessRuntime 只能通过 `BudgetReservation` / `BudgetSettlement` 与之交互。OAPEFLIR 不拥有独立 budget state。

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

SideEffect 由 HarnessRuntime 在 P4 主链中受控推进；OAPEFLIR 只能消费 side-effect fact 并生成解释性投影，不拥有独立 side effect commit authority。

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

硬规则：

```text
1. Replay 默认复用 recorded LLM output（Trace Replay）。
2. 只有隔离 simulation / sandbox 模式允许 `isolated_reexecution_replay`，且结果不得覆盖原始 truth/evidence。
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

## 22.2 Memory 写入硬规则

```text
1. Tool output 不得直接写 `long_term` 或 `shared_knowledge`。
2. potential_prompt_injection 不得写 `long_term` / `shared_knowledge`。
3. restricted 数据不得写 `shared_knowledge`。
4. Memory write 必须经过 before_memory_write guardrail。
5. shared memory 晋升必须有审核记录。
```

---

# 23. Guardrails 五层执行模型

五层 Guardrail 由 HarnessRuntime 执行链与 P2 控制平面共同强制；OAPEFLIR 只记录 guardrail view / rationale，不拥有独立 guardrail authority。

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
| RuntimeProfile | 平台能力层级（由 Harness / 平台治理注入，不归 OAPEFLIR 拥有） | mvp / hardening / enterprise |
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
  | "no_rollout"
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

硬规则：

```text
1. 优先级只允许 `platform < tenant < domain < task` 四级叠加；不得引入额外运行时优先级轴绕过 ConstraintPack。
2. Emergency Directive 最高优先级，但仍通过正式 directive 与 snapshot 记录生效。
3. 下级配置只能收紧，不能放松上级安全约束。
4. 所有最终生效配置必须生成 EffectivePolicySnapshot。
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
PLATFORM.{plane}.{component}.{category}
```

示例：

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

| Metric | 说明 |
|---|---|
| `harness.run.total` | HarnessRun 总数 |
| `harness.run.duration_ms` | HarnessRun 端到端耗时 |
| `harness.graph.node.count` | 图节点数 |
| `harness.graph.replan.count` | 重规划次数 |
| `harness.node.retry.count` | Node 重试次数 |
| `harness.side_effect.ambiguous.count` | 副作用不确定次数 |
| `harness.reconciliation.pending.count` | 待对账数 |
| `harness.hitl.pending.count` | 待人工数 |
| `harness.budget.remaining` | 剩余预算 |
| `harness.guardrail.block.count` | Guardrail 拦截数 |
| `harness.evaluation.score` | 评估分 |
| `harness.learning.candidate.count` | 学习候选数 |

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

# 40. v4.4 最小落地路线

## Ring 1：MVP

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

## Ring 2：Hardening

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

## Ring 2 扩展：Durable + HITL

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

## Ring 3：Enterprise / Learning

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

# 42. 最终定位

OAPEFLIR v4.4 相比早期独立 runtime 草案的关键收敛是：

| 维度 | v4.3 | v4.4 |
|---|---|---|
| 角色定位 | 曾混入独立 runtime 草案 | 明确退回为 HarnessRuntime 之上的认知/治理语义 |
| Plan | 可被误读为 OAPEFLIR 自有执行图 | 作为 `HarnessRuntime` 使用的 `PlanGraphBundle` 语义输入 |
| Event | truth / projection 边界混杂 | 明确区分 `platform.*` facts 与 `oapeflir.view.*` / `oapeflir.rationale.*` projections |
| 状态机 | 可能与运行时 truth 重叠 | 只描述与 `HarnessRun / NodeRun` 对齐的受控语义，不再自立真相状态机 |
| SideEffect / Budget / HITL | 曾被写成 OAPEFLIR 自有能力 | 明确回收至 Harness/P2/P5 主链，OAPEFLIR 仅解释与投影 |
| Replay / Context / Prompt | 设计意图存在 | 继续保留，但作为 canonical contract 的迁移输入而非独立运行时规范 |
| 实现价值 | 易被误读为直接编码基线 | 适合作为迁移设计输入和语义补充，不单独充当权威实现基线 |

最终结论：

> **OAPEFLIR v4.4 只能作为认知/治理语义与迁移设计输入使用，不能单独作为企业级 Agent 平台的权威 Runtime 基线。**

它不再是“Agent 流程图”，而是：

```text
一个把 PlanGraph、Event、Replay、Guardrail、HITL、Learning 等设计意图
收敛到 `HarnessRuntime` 主链边界之上的
认知/治理语义补充规范与迁移输入。
```

v4.4 之后的下一步不应该再把本文扩大成第二套运行时，而应该进入：

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


## v4.3 Canonical Compatibility Override

本节修复 `platform-architecture-implementation-consistency-audit.md` 中 F-1 至 F-25 的 OAPEFLIR spec 偏差。根因是这份 spec 在一次文档并版中同时保留了“旧的独立 OAPEFLIR runtime 草案”和“后补的 Harness 收敛段落”，导致前半部继续把 OAPEFLIR 写成执行权威，后半部又声明 Harness 才是执行权威，正文内部自相矛盾。

本次正文修复后的直接落点：

- `§0 / §2 / §3 / §42`：OAPEFLIR 改回受控认知/治理语义，`HarnessRuntime` 是唯一执行入口。
- `§4`：删除把 `OapeflirRun` 当作权威运行实体的写法，改为 `HarnessRun` truth + `OapeflirTraceProjection` 投影。
- `§5`：`NodeRun` 字段与状态机收敛到 Harness/RuntimeStateMachine 权威语义，不再使用 `compensating / compensated` 作为节点状态。
- `§7`：`PlanNode.type` 改为 `kind`，`generatedBy` 删除 `repair_worker`。
- `§14`：事件分层改为 `platform.*` facts 与 `oapeflir.view.* / oapeflir.rationale.*` projections。
- `§15 / §16 / §23 / §25 / §26 / §30`：预算、副作用、guardrail、runtime profile、HITL、策略优先级都明确收敛到 Harness/P2/P5 正式边界。
- `§19 / §20 / §22 / §24`：prompt 角色、replay 方式、memory scope、decision bundle 收敛到现行 canonical contract。
- `§34 / §35 / §39 / §40`：错误码、指标、实现目录、落地路线改为 `PLATFORM.*`、`harness.*`、Harness 中心目录与 `Ring 1/2/3`。

补充说明：HarnessRuntime 是唯一执行入口。
补充说明：OAPEFLIR 只产生 `oapeflir.view.*` 与 `oapeflir.rationale.*` 这类投影/解释事件，不产生 execution truth。

逐项审计闭环：

- F-1: 删除 “OAPEFLIR runtime 直接驱动执行” 叙述，统一为 `HarnessRuntime` 是唯一执行入口。
- F-2: 删除把 `OapeflirRun` 当作运行 truth 的定义，统一为 `HarnessRun` truth。
- F-3: 将 OAPEFLIR 自身定位为认知/规划/评估循环，而非执行状态机。
- F-4: 将执行完成、失败、补偿等终态归回 `HarnessRun` / `NodeRun` / `NodeAttemptReceipt`。
- F-5: 将节点权威状态收敛到 canonical `NodeRun.status`，移除 `compensating / compensated`。
- F-6: 将编排输出改为 `PlanGraphBundle` / graph patch，而非 OAPEFLIR 私有可变执行图。
- F-7: 将 `PlanNode.type` 收敛为 `kind`，避免旧 spec 与现行代码字段漂移。
- F-8: 删除 `generatedBy=repair_worker` 这类旧执行耦合来源，保留现行生成来源语义。
- F-9: 将 budget reservation 放回 Harness / billing / state-evidence 权威链路。
- F-10: 将 side effect receipt / reconcile 放回 execution plane 与 state-evidence plane。
- F-11: 将 guardrail block / allow / escalate 的最终裁决边界放回 P2/P3/P5。
- F-12: 将 runtime profile 约束收敛到 Harness runtime profile，而非 OAPEFLIR 私有 profile。
- F-13: 将 HITL / approval timeout / escalation 统一到现行 approval-and-hitl contract。
- F-14: 将 prompt role 和 system / user / tool 语义改为与 model gateway / prompt engine 一致。
- F-15: 将 replay 语义改为基于事实事件与 projection rebuild，而不是 OAPEFLIR 自行回放 execution。
- F-16: 将 memory scope 绑定回 canonical memory / knowledge boundary contract。
- F-17: 将 decision bundle、evidence refs、rationale refs 改为现行 evidence 对象模型。
- F-18: 将事件分层改为 `platform.*` facts 与 `oapeflir.view.*` / `oapeflir.rationale.*` projections。
- F-19: 明确 OAPEFLIR 不写 execution truth，不直接发布 task / workflow / execution terminal facts。
- F-20: 将错误码前缀统一为 `PLATFORM.*` / `HARNESS.*` 权威命名，移除 spec 私有枚举。
- F-21: 将 metrics / observability 指标前缀统一到 `harness.*` 与平台观测命名。
- F-22: 将实现目录指向 Harness / orchestration / contracts 当前真实代码位置。
- F-23: 将 rollout / remediation 路线图收敛到 `Ring 1 / Ring 2 / Ring 3`。
- F-24: 明确 OAPEFLIR 与 execution plane 的边界是 “生成提案 / 投影 / rationale”，不是 “直接执行”。
- F-25: 明确本 spec 任何 legacy OAPEFLIR execution 描述仅可作为历史兼容背景，不再作为实现依据。
