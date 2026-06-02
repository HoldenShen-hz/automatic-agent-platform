# v4.3 Side Effect Reconciliation Contract

> v4.3 canonical contract。覆盖 `SideEffectRecord` / `ReconciliationRecord` / `CompensationRecord`。

## 1. 范围

任何外部可见写入、工具提交、文件修改、通知发送、交易、API 调用或不可逆动作都必须先登记 `SideEffectRecord`，再进入 delivery、reconciliation 或 compensation 流程。

## 2. SideEffectRecord

最小字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `sideEffectId` | `string` | 副作用 ID |
| `harnessRunId` | `string` | 所属 run |
| `nodeRunId` | `string` | 所属 node run |
| `nodeAttemptId` | `string` | 所属 attempt |
| `effectKind` | `file_write \| external_api \| message_send \| transaction \| tool_commit \| other` | 副作用类别 |
| `idempotencyKey` | `string` | 外部幂等键 |
| `status` | `SideEffectStatus` | 状态 |
| `riskClass` | `low \| medium \| high \| critical` | 风险 |
| `leaseId` | `string?` | active lease |
| `fencingToken` | `string?` | fencing token |
| `approvalRef` | `string?` | 必要审批 |
| `preCommitPolicyProofRef` | `ArtifactRef` | commit 前策略证明 |
| `externalRef` | `string?` | 外部系统引用 |
| `deadline` | `timestamp` | commit / reconcile deadline |
| `createdAt` | `timestamp` | 创建时间 |
| `updatedAt` | `timestamp` | 更新时间 |
| `version` | `number` | CAS version |

`SideEffectStatus`（16 states，v4.3 canonical）：

- `proposed`
- `approved`
- `reserved`
- `committing`
- `committed`
- `confirming`
- `confirmed`
- `ambiguous`
- `manual_review_required`
- `reconciling`
- `compensation_required`
- `compensating`
- `compensated`
- `failed`
- `revoked`
- `expired`

状态说明：

- 当前权威转移语义以 runtime state machine 与 truth services 为准；本文列出 canonical 状态集合，不再复述一套可能漂移的线性“5/8 态”图。
- `confirmed -> reconciling/compensating`、`committed -> confirming` 等恢复性边属于当前实现允许的治理路径，不应被旧版线性图误判为非法。

## 3. ReconciliationRecord

最小字段：

- `reconciliationId`
- `sideEffectId`
- `probeKind`
- `externalObservedState`
- `result` (`confirmed | not_found | ambiguous | failed`)
- `evidenceRefs`
- `nextAction` (`mark_confirmed | retry_probe | compensate | escalate_hitl | mark_failed`)
- `createdAt`

规则：

- 外部状态不确定时必须进入 `ambiguous` / `reconciling`，不得伪装成功。
- reconciliation worker 只能通过状态机推进 side effect 状态。

## 4. CompensationRecord

最小字段：

- `compensationId`
- `sideEffectId`
- `harnessRunId`
- `planRef`
- `status` (`planned | running | succeeded | failed | requires_human`)
- `evidenceRefs`
- `createdAt`
- `completedAt?`

规则：

- compensation 是追加事实，不删除或改写原 side effect。
- 不可补偿的副作用必须标记 `requires_human` 或进入 incident。

## 5. Commit 前重校验

副作用 commit 前必须重新校验：

- active lease 与 fencing token。
- policy guard。
- budget reservation 仍有效。
- high / critical 所需 `HarnessDecision` 与 `HumanResponsibilityRecord`。
- `RunVersionLock` 与 tool / connector 版本未发生未授权漂移。

## 6. Legacy / Deprecated 映射

| 旧名 | v4.3 语义 |
| --- | --- |
| tool output side effect flag | 只能作为 `SideEffectRecord` 输入 |
| compensation step | 必须落为 `CompensationRecord` 或 compensation `PlanNode` |
| best-effort delivery log | 只作为 evidence，不是 side effect truth |

## 7. 测试要求

- ambiguous 外部结果不得标记 `confirmed`。
- revoked / expired 副作用不得 commit。
- commit 前审批、预算、lease、fencing 任一失效都必须拒绝。
- compensation 不得覆盖原 `SideEffectRecord`。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-2: 旧 remediation 仍把线性化状态图写进正文，和现行 16 态 side-effect state machine 冲突。修复：本文已收口为当前 canonical 状态集合与最小字段集，避免第三套状态 SOT。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
