# v4.3 Plan Graph And Patch Contract

> v4.3 canonical contract。覆盖 `PlanGraphBundle` / `PlanGraph` / `PlanNode` / `PlanEdge` / `GraphPatch` / `GraphPatchOperation`。

## 1. 范围

`PlanGraphBundle` is P3 -> P4 的唯一执lines计划契约。所有任务，includes简单任务，都必须以图形式下发；简单任务退化为单节点图。`ExecutionPlan` 只允许作为 deprecated alias。

## 2. PlanGraphBundle 最小字段

| 字段 | class型 | Description |
|---|-------|--------|
| `planGraphBundleId` | `string` | bundle ID |
| `harnessRunId` | `string` | 所属 run |
| `graphVersion` | `number` | 图版本 |
| `graph` | `PlanGraph` | 图结构 |
| `schedulerPolicy` | `ReadyNodeSchedulingPolicy` | 调度策略 |
| `budget` | `BudgetPlanRef` | budget计划references用 |
| `riskProfile` | `RiskProfile` | 图级风险 |
| `validationReport` | `GraphValidationReport` | 图校验报告 |
| `artifactRefs` | `ArtifactRef[]` | 大对象references用 |
| `createdAt` | `timestamp` | 创建time |

## 3. PlanGraph / PlanNode / PlanEdge

`PlanGraph` 最小字段：

- `graphId`
- `nodes`
- `edges`
- `entryNodeIds`
- `terminalNodeIds`
- `joinStrategy`
- `graphHash`

`PlanNode` 最小字段：

- `nodeId`
- `nodeType` (`tool | llm | hitl_wait | subgraph | evaluator | router | compensation`)
- `inputRefs`
- `outputSchemaRef`
- `riskClass`
- `budgetIntent`
- `sideEffectProfile`
- `retryPolicyRef`
- `timeoutMs`

`PlanEdge` 最小字段：

- `edgeId`
- `fromNodeId`
- `toNodeId`
- `condition`
- `dependencyType` (`hard | soft | compensation | retry | replan`)

## 4. 不可变性约束

- `PlanGraphBundle` is不可变快照；一旦下发给 P4，`graphVersion` 对应的 `nodes` / `edges` / `schedulerPolicy` / `riskProfile` 不得原地修改。
- canonical contract 禁止以 `appendNode`、`removeNode`、`updateNode` 或任何原地 mutate API 改写既有 `PlanGraph`。
- 任意语义变更都必须table达为 `GraphPatch(baseGraphVersion -> newGraphVersion)`，并生成新的快照版本。
- 已执lines节点、已产生 `NodeAttemptReceipt` 的节点、以及已确认副作用关联的路径，只能via追加补偿或追加修复路径handle，不得回写历史图。

## 5. GraphPatch

Replan 不覆盖旧图，只追加 `GraphPatch`：

```text
PlanGraph(v1) + GraphPatch(v2 operations) -> PlanGraph(v2)
```

最小字段：

| 字段 | class型 | Description |
|---|-------|--------|
| `graphPatchId` | `string` | patch ID |
| `harnessRunId` | `string` | 所属 run |
| `baseGraphVersion` | `number` | 基础版本 |
| `newGraphVersion` | `number` | 新版本 |
| `operations` | `GraphPatchOperation[]` | 闭合操作 |
| `affectedExecutedNodes` | `string[]` | 受Impact已执lines节点 |
| `affectedSideEffects` | `string[]` | 受Impact副作用 |
| `compatibilityClass` | `safe_append \| requires_checkpoint_revalidation \| requires_human_approval \| incompatible_restart_required` | 兼容class别 |
| `compensationPlanRef` | `ArtifactRef?` | 必要补偿计划 |
| `policyProofRef` | `ArtifactRef` | 策略证明 |
| `auditRef` | `ArtifactRef` | 审计references用 |

`GraphPatchOperation` is闭合枚举：

- `add_node`
- `add_edge`
- `disable_edge`
- `add_compensation_node`
- `add_failure_path`
- `mark_skipped`
- `append_subgraph`

## 6. security规则

- completed节点、已有 `NodeAttemptReceipt`、confirmed / ambiguous `SideEffectRecord` 的语义不得被改写。
- 已提交不可逆副作用的 node 不得被静默删除；只能追加补偿、跳过后续路径、追加修复节点或人工接管。
- `baseGraphVersion` 必须vs当前图版本一致，no则拒绝 patch。
- `incompatible_restart_required` 不得应用到原 run；必须新建 `HarnessRun`。

## 7. Legacy / Deprecated 映射

| 旧名 | v4.3 语义 |
| --- | --- |
| `ExecutionPlan` | deprecated alias，必须映射到 `PlanGraphBundle` |
| 线性 `steps` | 只能作为import/调试视图；执lines前必须 normalize 为 graph |
| `PlanBundle` | 产品或 debug wrapper，不is P3 -> P4 canonical contract |

## 8. 测试要求

- GraphPatch safety test 覆盖已执lines节点、receipt、副作用三class不可改写对象。
- 调度器只消费 `PlanGraphBundle`，拒绝线性 `steps`。
- 单节点任务也必须产生合法 graph。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-8: 合约将 PlanGraph defines为可变（supported appendNode），Architecture§25明确要求 PlanGraphBundle 为不可变快照。Root Cause：早期文档把 in-memory builder 的编辑语义误写成了 runtime canonical contract。修复：正文现明确 `PlanGraphBundle` / `PlanGraph` 为不可变快照，所有变更只能via `GraphPatch` 生成新版本。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
