# v4.3 Budget Ledger Contract

> v4.3 canonical contract。覆盖 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。

## 1. 范围

预算是 runtime truth，不是观测统计。所有 token、tool、外部 API、人工、算力和副作用成本必须通过 ledger reservation / settlement 表达，且 hard cap 不允许并发超订。

## 2. BudgetLedger

最小字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `budgetLedgerId` | `string` | 账本 ID |
| `tenantId` | `string` | 租户 |
| `harnessRunId` | `string` | 所属 run |
| `currency` | `string` | 计价货币 |
| `hardCap` | `number` | 硬上限 |
| `softCap` | `number?` | 软上限 |
| `reservedAmount` | `number` | 已预留 |
| `settledAmount` | `number` | 已结算 |
| `releasedAmount` | `number` | 已释放 |
| `status` | `open \| soft_cap_reached \| hard_cap_reached \| closed` | 状态 |
| `version` | `number` | CAS 版本 |

## 3. BudgetReservation

最小字段：

- `budgetReservationId`
- `budgetLedgerId`
- `harnessRunId`
- `nodeRunId?`
- `amount`
- `resourceKind` (`token | tool | api | compute | human | side_effect | other`)
- `status` (`reserved | settled | released | expired | rejected`)
- `expiresAt`
- `createdAt`

规则：

- reservation 必须原子检查 `settledAmount + activeReservedAmount + requestedAmount <= hardCap`。
- 过期 reservation 必须释放，不得继续参与 commit。
- hard cap 达到后只能拒绝新 reservation 或进入人工扩容/降级，不得隐式透支。

## 4. BudgetSettlement

最小字段：

- `budgetSettlementId`
- `budgetReservationId`
- `actualAmount`
- `settlementKind` (`final | partial | release_unused | correction`)
- `evidenceRefs`
- `createdAt`

规则：

- settlement 不能超过 reservation，除非有显式 `correction` 且仍满足 hard cap。
- release unused 必须追加 settlement / release 记录，不得直接改写历史 reservation。

## 5. 状态推进

- `BudgetReservation` / `BudgetSettlement` 的 truth mutation 必须经 `RuntimeStateMachine.transition(command)` 或其预算子命令。
- soft cap 可以触发 policy warning；hard cap 必须阻止执行。
- 预算事件必须写入 `platform.*` fact event。

## 6. Legacy / Deprecated 映射

| 旧名 | v4.3 语义 |
| --- | --- |
| `actual_cost_usd` | projection / report 字段 |
| token cost counter | ledger 派生统计 |
| cost report | read model，不是预算 truth |

## 7. 测试要求

- budget hard-cap concurrency test 必须覆盖并发 reservation。
- settlement 超 reservation 必须拒绝或走 correction gate。
- hard cap 触发后 NodeRun 不得继续拿到新预算。


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-3: 用 "settle" 动词描述预算消费，架构§18统一用 "consume"；resourceKind 枚举仅 token/api_call/compute，架构额外定义 storage/bandwidth/memory。修复：该语义收敛到 v4.3 canonical contract；旧字段、旧状态、旧 DTO 或旧术语仅允许作为 legacy/deprecated/projection/migration input，不得作为新实现入口。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
