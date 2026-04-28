# v4.3 Plan Graph And Patch Contract

> v4.3 canonical contract。覆盖 `PlanGraphBundle` / `PlanGraph` / `PlanNode` / `PlanEdge` / `GraphPatch` / `GraphPatchOperation`。

## 1. 范围

`PlanGraphBundle` 是 P3 -> P4 的唯一执行计划契约。所有任务，包括简单任务，都必须以图形式下发；简单任务退化为单节点图。`ExecutionPlan` 只允许作为 deprecated alias。

## 2. PlanGraphBundle 最小字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `planGraphBundleId` | `string` | bundle ID |
| `harnessRunId` | `string` | 所属 run |
| `graphVersion` | `number` | 图版本 |
| `graph` | `PlanGraph` | 图结构 |
| `schedulerPolicy` | `ReadyNodeSchedulingPolicy` | 调度策略 |
| `budget` | `BudgetPlanRef` | 预算计划引用 |
| `riskProfile` | `RiskProfile` | 图级风险 |
| `validationReport` | `GraphValidationReport` | 图校验报告 |
| `artifactRefs` | `ArtifactRef[]` | 大对象引用 |
| `createdAt` | `timestamp` | 创建时间 |

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

- `PlanGraphBundle` 是不可变快照；一旦下发给 P4，`graphVersion` 对应的 `nodes` / `edges` / `schedulerPolicy` / `riskProfile` 不得原地修改。
- canonical contract 禁止以 `appendNode`、`removeNode`、`updateNode` 或任何原地 mutate API 改写既有 `PlanGraph`。
- 任意语义变更都必须表达为 `GraphPatch(baseGraphVersion -> newGraphVersion)`，并生成新的快照版本。
- 已执行节点、已产生 `NodeAttemptReceipt` 的节点、以及已确认副作用关联的路径，只能通过追加补偿或追加修复路径处理，不得回写历史图。

## 5. GraphPatch

Replan 不覆盖旧图，只追加 `GraphPatch`：

```text
PlanGraph(v1) + GraphPatch(v2 operations) -> PlanGraph(v2)
```

最小字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `graphPatchId` | `string` | patch ID |
| `harnessRunId` | `string` | 所属 run |
| `baseGraphVersion` | `number` | 基础版本 |
| `newGraphVersion` | `number` | 新版本 |
| `operations` | `GraphPatchOperation[]` | 闭合操作 |
| `affectedExecutedNodes` | `string[]` | 受影响已执行节点 |
| `affectedSideEffects` | `string[]` | 受影响副作用 |
| `compatibilityClass` | `safe_append \| requires_checkpoint_revalidation \| requires_human_approval \| incompatible_restart_required` | 兼容类别 |
| `compensationPlanRef` | `ArtifactRef?` | 必要补偿计划 |
| `policyProofRef` | `ArtifactRef` | 策略证明 |
| `auditRef` | `ArtifactRef` | 审计引用 |

`GraphPatchOperation` 是闭合枚举：

- `add_node`
- `add_edge`
- `disable_edge`
- `add_compensation_node`
- `add_failure_path`
- `mark_skipped`
- `append_subgraph`

## 6. 安全规则

- 已完成节点、已有 `NodeAttemptReceipt`、confirmed / ambiguous `SideEffectRecord` 的语义不得被改写。
- 已提交不可逆副作用的 node 不得被静默删除；只能追加补偿、跳过后续路径、追加修复节点或人工接管。
- `baseGraphVersion` 必须与当前图版本一致，否则拒绝 patch。
- `incompatible_restart_required` 不得应用到原 run；必须新建 `HarnessRun`。

## 7. Legacy / Deprecated 映射

| 旧名 | v4.3 语义 |
| --- | --- |
| `ExecutionPlan` | deprecated alias，必须映射到 `PlanGraphBundle` |
| 线性 `steps` | 只能作为导入/调试视图；执行前必须 normalize 为 graph |
| `PlanBundle` | 产品或 debug wrapper，不是 P3 -> P4 canonical contract |

## 8. 测试要求

- GraphPatch safety test 覆盖已执行节点、receipt、副作用三类不可改写对象。
- 调度器只消费 `PlanGraphBundle`，拒绝线性 `steps`。
- 单节点任务也必须产生合法 graph。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-8: 合约将 PlanGraph 定义为可变（支持 appendNode），架构§25明确要求 PlanGraphBundle 为不可变快照。根因：早期文档把 in-memory builder 的编辑语义误写成了 runtime canonical contract。修复：正文现明确 `PlanGraphBundle` / `PlanGraph` 为不可变快照，所有变更只能通过 `GraphPatch` 生成新版本。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
