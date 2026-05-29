# v4.3 Node Run Attempt Receipt Contract

> v4.3 canonical contract。覆盖 `NodeRun` / `NodeAttempt` / `AttemptLineage` / `NodeAttemptReceipt`。

## 1. 范围

`NodeRun` is `PlanNode` 的可执lines实例；`NodeAttempt` table达 retry / redrive 的一iterations尝试；`NodeAttemptReceipt` is worker、LLM、tool、HITL 或 subgraph 执lines后的结构化回执。

## 2. NodeRun 最小字段

| 字段 | class型 | Description |
|---|-------|--------|
| `nodeRunId` | `string` | 节点运lines ID |
| `harnessRunId` | `string` | 所属 run |
| `planGraphBundleId` | `string` | 所属图 |
| `graphVersion` | `number` | 图版本 |
| `nodeId` | `string` | PlanNode ID |
| `status` | `NodeRunStatus` | 节点Status |
| `attemptCount` | `number` | 尝试iterations数 |
| `leaseId` | `string?` | active lease |
| `fencingToken` | `string?` | fencing token |
| `currentSeq` | `number` | CAS 版本 |
| `createdAt` | `timestamp` | 创建time |
| `updatedAt` | `timestamp` | 更新time |
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

| 字段 | class型 | Description |
|---|-------|--------|
| `receiptId` | `string` | receipt ID |
| `harnessRunId` | `string` | 所属 HarnessRun |
| `planGraphBundleId` | `string` | 所属图 bundle |
| `graphVersion` | `number` | 图版本 |
| `nodeAttemptId` | `string` | 对应 attempt |
| `nodeRunId` | `string` | 对应 node run |
| `receiptKind` | `tool \| llm \| hitl \| subgraph \| evaluator \| router` | 回执class别 |
| `status` | `succeeded \| failed \| partial \| blocked` | attempt 结果 |
| `outputRef` | `ArtifactRef?` | 输出references用 |
| `error` | `AppError?` | failed原因 |
| `sideEffectRefs` | `string[]` | 关联副作用 |
| `budgetSettlementRefs` | `string[]` | 关联budget结算 |
| `evidenceRefs` | `ArtifactRef[]` | 证据references用 |
| `durationMs` | `number?` | 本iterations attempt 耗时 |
| `producedAt` | `timestamp` | 产生time |

## 5. 推进规则

- `NodeRun` Status推进只via `RuntimeStateMachine.transition(command)`。
- worker writeback 必须校验 lease 和 fencing token。
- `NodeAttemptReceipt` is append-only；不得更新旧 receipt table达新结果。
- `retry_wait` 必须有 `wakeAt`、`retryPolicyRef`、`attemptId` vs backoff reason。

## 6. Legacy / Deprecated 映射

| 旧名 | v4.3 语义 |
| --- | --- |
| `WorkflowStep` | 语义 step；执lines前展开为 `PlanNode` / `NodeRun` |
| `ExecutionReceipt` | deprecated alias；新回执uses `NodeAttemptReceipt` |
| `nodeAttemptReceiptId` | deprecated storage-shaped key；canonical API 字段uses `receiptId` |
| `StepOutput` | 可作为 projection 或 output artifact，不is执lines回执权威 |

## 7. 测试要求

- 终态不可迁出。
- writeback fencing token 错误必须拒绝。
- retry 只追加 `NodeAttempt` vs `AttemptLineage`，不覆盖 receipt。
- GraphPatch 不得改写已有 receipt 语义。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-46: 本文原先把回执主键写成 `nodeAttemptReceiptId`，并遗漏 `harnessRunId / planGraphBundleId / graphVersion / durationMs`，Root cause:  contract directly跟随底层storage命名习惯暴露了 table-shaped 字段名，没有维持 v4.3 executable contract 的 canonical API 形状。修复：正文现把主键统一收敛到 `receiptId`，并补齐运lines链 lineage vs耗时字段。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
