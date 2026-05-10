# v4.3 Harness Run Contract

> v4.3 canonical contract。覆盖 `HarnessRun`。

## 1. 范围

`HarnessRun` 是一次完整任务运行的唯一权威 Run。OAPEFLIR 阶段、legacy `workflow_run`、UI timeline 和 diagnostics run 都只能作为 `HarnessRun` 的 projection 或 view。

## 2. 最小字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `harnessRunId` | `string` | 运行 ID |
| `tenantId` | `string` | 租户 |
| `confirmedTaskSpecId` | `string` | 来源任务规格 |
| `requestEnvelopeId` | `string` | admission 请求 |
| `requestHash` | `string` | 幂等 hash |
| `status` | `HarnessRunStatus` | 运行状态 |
| `constraintPackRef` | `ConstraintPackRef` | 运行约束 |
| `versionLockId` | `string` | `RunVersionLock` |
| `planGraphBundleId` | `string?` | 当前计划图 |
| `budgetLedgerId` | `string` | 预算账本 |
| `currentSeq` | `number` | aggregate seq / CAS 版本 |
| `createdAt` | `timestamp` | 创建时间 |
| `updatedAt` | `timestamp` | 更新时间 |
| `terminalAt` | `timestamp?` | 终态时间 |
| `terminalReason` | `string?` | 终态原因 |

## 3. 状态枚举

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

## 4. 状态推进规则

- 所有状态推进必须经 `RuntimeStateMachine.transition(command)`。
- transition 必须校验 CAS、active lease、fencing token、policy guard、budget precondition 与 version lock。
- 每次 truth mutation 必须同事务追加 `platform.*` fact event。
- `replanning` 只能通过 `GraphPatch` 追加表达，不得覆盖历史 `PlanGraphBundle`。
- `compensating` 不代表原运行成功；补偿事实写入 `CompensationRecord`。

## 5. Projection 规则

- `workflow_run` 只允许作为 read model / query projection。
- OAPEFLIR run lifecycle 只能由 `HarnessRun` + `OapeflirViewEvent` 派生。
- UI 可显示阶段状态，但不得反向写入 `HarnessRun.status`。

## 6. Legacy / Deprecated 映射

| 旧名 | v4.3 语义 |
| --- | --- |
| `OapeflirRun` | `HarnessRun` 的语义投影，不是 truth |
| `workflow_run` | read projection |
| `RunStatus` | `HarnessRun.status` + OAPEFLIR view |
| `HarnessStep` | 语义 step；可展开为一个或多个 `NodeRun` |

## 7. 测试要求

- 终态不可迁出。
- admission 幂等：重复 `RequestEnvelope` 不创建第二个 `HarnessRun`。
- 任何直接 repository truth mutation 必须被测试拒绝或限制为内部原语。
- 每次状态推进必须产生 platform fact event 与 audit evidence。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-7: 合约§45.13定义6状态 vs 架构§25.8定义13状态，架构文档内部也不一致（§25.4列7态 vs §25.8列13态）。修复：该语义收敛到 v4.3 canonical contract；旧字段、旧状态、旧 DTO 或旧术语仅允许作为 legacy/deprecated/projection/migration input，不得作为新实现入口。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
