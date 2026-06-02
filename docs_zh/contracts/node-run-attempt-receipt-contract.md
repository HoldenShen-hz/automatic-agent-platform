# v4.3 Node Run Attempt Receipt Contract

> v4.3 canonical contract。覆盖 `NodeRun` / `NodeAttempt` / `AttemptLineage` / `NodeAttemptReceipt`。

## 1. 范围

`NodeRun` 是 `PlanNode` 的可执行实例；`NodeAttempt` 表达 retry / redrive 的一次尝试；`NodeAttemptReceipt` 是 worker、LLM、tool、HITL 或 subgraph 执行后的结构化回执。

## 2. NodeRun 最小字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `nodeRunId` | `string` | 节点运行 ID |
| `harnessRunId` | `string` | 所属 run |
| `planGraphBundleId` | `string` | 所属图 |
| `graphVersion` | `number` | 图版本 |
| `nodeId` | `string` | PlanNode ID |
| `status` | `NodeRunStatus` | 节点状态 |
| `attemptCount` | `number` | 尝试次数 |
| `leaseId` | `string?` | active lease |
| `fencingToken` | `string?` | fencing token |
| `currentSeq` | `number` | CAS 版本 |
| `createdAt` | `timestamp` | 创建时间 |
| `updatedAt` | `timestamp` | 更新时间 |
| `terminalReason` | `string?` | 终态原因 |

`NodeRunStatus`：

- `created`
- `blocked`
- `ready`
- `queued`
- `leased`
- `running`
- `retry_wait`
- `awaiting_hitl`
- `reconciling`
- `succeeded`
- `failed`
- `skipped`
- `cancelled`
- `dependency_failed`
- `policy_blocked`
- `aborted`

终态：`succeeded`、`failed`、`skipped`、`cancelled`、`dependency_failed`、`policy_blocked`、`aborted`。

## 3. NodeAttempt / AttemptLineage

`NodeAttempt` 最小字段：

- `nodeAttemptId`
- `nodeRunId`
- `attemptNo`
- `attemptKind` (`initial | retry | redrive | recovery`)
- `startedAt`
- `completedAt?`
- `executorRef`
- `inputSnapshotRef`
- `receiptId?`

`AttemptLineage` 最小字段：

- `attemptLineageId`
- `nodeRunId`
- `previousAttemptId?`
- `nextAttemptId?`
- `reason`
- `createdBy`
- `createdAt`

规则：

- 重试不得新建 `NodeRun`，除非 `GraphPatch` 明确追加新节点。
- 每个 attempt 必须可回放输入快照、版本锁和约束包。
- redrive 必须追加 lineage，不得覆盖旧 attempt。

## 4. NodeAttemptReceipt

最小字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `nodeAttemptReceiptId` | `string` | receipt ID；当前 executable contract 仍保留该存储形态主键名 |
| `harnessRunId` | `string` | 所属 HarnessRun |
| `planGraphId` | `string` | 所属图 bundle ID |
| `graphVersion` | `number` | 图版本 |
| `nodeAttemptId` | `string` | 对应 attempt |
| `nodeRunId` | `string` | 对应 node run |
| `receiptKind` | `tool \| llm \| hitl \| subgraph \| evaluator \| router` | 回执类别 |
| `status` | `succeeded \| failed \| partial \| blocked` | attempt 结果 |
| `outputRef` | `ArtifactRef?` | 输出引用 |
| `error` | `AppErrorRef?` | 失败原因 |
| `errorDetail` | `string` | 当前 executable contract 要求的诊断文本 |
| `sideEffectRefs` | `string[]` | 关联副作用 |
| `budgetSettlementRefs` | `string[]` | 关联预算结算 |
| `evidenceRefs` | `ArtifactRef[]` | 证据引用 |
| `duration` | `number` | 本次 attempt 耗时，单位毫秒 |
| `producedAt` | `timestamp` | 产生时间 |

## 5. 推进规则

- `NodeRun` 状态推进只通过 `RuntimeStateMachine.transition(command)`。
- worker writeback 必须校验 lease 和 fencing token。
- `NodeAttemptReceipt` 是 append-only；不得更新旧 receipt 表达新结果。
- `retry_wait` 必须有 `wakeAt`、`retryPolicyRef`、`attemptId` 与 backoff reason。

## 6. Legacy / Deprecated 映射

| 旧名 | v4.3 语义 |
| --- | --- |
| `WorkflowStep` | 语义 step；执行前展开为 `PlanNode` / `NodeRun` |
| `ExecutionReceipt` | deprecated alias；新回执使用 `NodeAttemptReceipt` |
| `receiptId` | architecture target alias；当前 executable contract 尚未迁移，canonical v4.3 payload 仍使用 `nodeAttemptReceiptId` |
| `StepOutput` | 可作为 projection 或 output artifact，不是执行回执权威 |

## 7. 测试要求

- 终态不可迁出。
- writeback fencing token 错误必须拒绝。
- retry 只追加 `NodeAttempt` 与 `AttemptLineage`，不覆盖 receipt。
- GraphPatch 不得改写已有 receipt 语义。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-46: 架构文档曾把未来 API 形态提前写成已落地事实。修复：本文回写为当前 executable contract 的真实字段名与必填集；若后续迁移到 `receiptId / planGraphBundleId / durationMs`，需先同步模型、schema、factory 和 fixture。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
