# v4.3 Harness Run Contract

> v4.3 canonical contract。覆盖 `HarnessRun`。

## 1. 范围

`HarnessRun` is一iterations完整任务运lines的唯一权威 Run。OAPEFLIR 阶段、legacy `workflow_run`、UI timeline 和 diagnostics run 都只能作为 `HarnessRun` 的 projection 或 view。

## 2. 最小字段

| 字段 | class型 | Description |
|---|-------|--------|
| `harnessRunId` | `string` | 运lines ID |
| `tenantId` | `string` | 租户 |
| `confirmedTaskSpecId` | `string` | 来源任务规格 |
| `requestEnvelopeId` | `string` | admission request |
| `requestHash` | `string` | 幂等 hash |
| `status` | `HarnessRunStatus` | 运linesStatus |
| `constraintPackRef` | `ConstraintPackRef` | 运lines约束 |
| `versionLockId` | `string` | `RunVersionLock` |
| `planGraphBundleId` | `string?` | 当前计划图 |
| `budgetLedgerId` | `string` | budget账本 |
| `currentSeq` | `number` | aggregate seq / CAS 版本 |
| `createdAt` | `timestamp` | 创建time |
| `updatedAt` | `timestamp` | 更新time |
| `terminalAt` | `timestamp?` | 终态time |
| `terminalReason` | `string?` | 终态原因 |

## 3. Status枚举

`HarnessRunStatus`：

- `created`
- `admitted`
- `planning`
- `ready`
- `running`
- `pausing`
- `paused`
- `resuming`
- `replanning`
- `compensating`
- `completed`
- `failed`
- `cancelled`
- `aborted`

终态：`completed`、`failed`、`cancelled`、`aborted`。终态不可迁出。

## 4. Status推进规则

- 所有Status推进必须via `RuntimeStateMachine.transition(command)`。
- transition 必须校验 CAS、active lease、fencing token、policy guard、budget precondition vs version lock。
- 每iterations truth mutation 必须同事务追加 `platform.*` fact event。
- `replanning` 只能via `GraphPatch` 追加table达，不得覆盖历史 `PlanGraphBundle`。
- `compensating` 不代table原运linessuccess；补偿事实writes `CompensationRecord`。

## 5. Projection 规则

- `workflow_run` 只允许作为 read model / query projection。
- OAPEFLIR run lifecycle 只能由 `HarnessRun` + `OapeflirViewEvent` 派生。
- UI 可显示阶段Status，但不得反向writes `HarnessRun.status`。

## 6. Legacy / Deprecated 映射

| 旧名 | v4.3 语义 |
| --- | --- |
| `OapeflirRun` | `HarnessRun` 的语义投影，不is truth |
| `workflow_run` | read projection |
| `RunStatus` | `HarnessRun.status` + OAPEFLIR view |
| `HarnessStep` | 语义 step；可展开为一个或多个 `NodeRun` |

## 7. 测试要求

- 终态不可迁出。
- admission 幂等：repeats `RequestEnvelope` 不创建第二个 `HarnessRun`。
- 任何directly repository truth mutation 必须被测试拒绝或限制为内部原语。
- 每iterationsStatus推进必须产生 platform fact event vs audit evidence。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-7: 合约§45.13defines6Status vs Architecture§25.8defines13Status，Architecture文档内部也inconsistent（§25.4列7态 vs §25.8列13态）。修复：该语义收敛到 v4.3 canonical contract；旧字段、旧Status、旧 DTO 或旧术语only允许作为 legacy/deprecated/projection/migration input，不得作为新实现入口。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
