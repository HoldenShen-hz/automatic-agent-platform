# Marketplace Catalog And Revenue Contract

## 1. 范围

本 contract 定义 `§55` 的市场目录、安装治理、分成和废弃生命周期。

## 2. Canonical 对象

- `MarketplaceListing`
- `MarketplaceInstallRecord`
- `RevenueSharePolicy`
- `CertificationRecord`
- `ListingDependency`

## 3. `MarketplaceListing` 最小字段

- `listing_id`
- `publisher_id`
- `artifact_type`
- `artifact_ref`
- `version`
- `capabilities`
- `trust_level`
- `lifecycle_state`
- `pricing_model`

`lifecycle_state`：

- `draft`
- `submitted`
- `certified`
- `published`
- `deprecated`
- `retired`

## 4. 收益分成

`RevenueSharePolicy` 至少声明：

- `policy_id`
- `gross_split`
- `tax_handling`
- `refund_policy`
- `settlement_cycle`

## 5. 规则

- 未认证条目不得进入 `published`。
- 依赖必须显式声明并通过兼容性检查。
- 废弃条目必须提供迁移或替代建议。

## 6. 测试要求

- unit：listing schema、dependency validation、settlement calculation
- integration：install / upgrade / retire lifecycle
- contract：被撤销认证的条目不得继续新安装



## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-36: 定义RevenueSharePolicy含结算/分成字段，架构§55.4明确"收益分成/计费结算不属于核心运行架构"禁止影响Pack执行/安全。修复：该语义收敛到 v4.3 canonical contract；旧字段、旧状态、旧 DTO 或旧术语仅允许作为 legacy/deprecated/projection/migration input，不得作为新实现入口。
- T-43: lifecycle_state用draft/submitted/certified/published/deprecated/retired，架构§55.5用active/deprecated/sunset/removed，不兼容。修复：该语义收敛到 v4.3 canonical contract；旧字段、旧状态、旧 DTO 或旧术语仅允许作为 legacy/deprecated/projection/migration input，不得作为新实现入口。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
