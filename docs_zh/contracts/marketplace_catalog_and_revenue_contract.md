# Marketplace Catalog And Revenue Contract

## 1. 范围

本 contract 定义 `§55` 的市场目录、安装治理、商业元数据投影和废弃生命周期。

## 2. Canonical 对象

- `MarketplaceListing`
- `MarketplaceInstallRecord`
- `CommercialTermsProjection`
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
- `review_status`
- `lifecycle_state`
- `pricing_model`

`review_status`：

- `draft`
- `submitted`
- `certified`

`lifecycle_state`：

- `active`
- `deprecated`
- `sunset`
- `removed`

## 4. 收益分成

`CommercialTermsProjection` 至少声明：

- `policy_id`
- `pricing_model`
- `catalog_price_ref`
- `revenue_share_ref?`
- `tax_policy_ref?`
- `refund_policy_ref?`
- `settlement_cycle_ref?`

规则：

- 商业元数据只允许作为 marketplace catalog / invoice / settlement 的投影输入。
- `revenue_share_ref`、`tax_policy_ref`、`refund_policy_ref`、`settlement_cycle_ref` 不得参与 Pack 执行授权、安装安全判定或 runtime sandbox 决策。
- marketplace install / activation / deprecation 的执行与安全门禁只能消费 `trust_level`、`capabilities`、依赖约束和认证结果。

## 5. 规则

- 未认证条目不得进入 `active`。
- 依赖必须显式声明并通过兼容性检查。
- 废弃条目必须提供迁移或替代建议。
- `sunset` 条目不得接受新安装，但允许受控迁移或只读查看。
- `removed` 条目不得被新安装、升级或激活。

## 6. 测试要求

- unit：listing schema、dependency validation、commercial projection validation
- integration：install / upgrade / deprecate / sunset / remove lifecycle
- contract：被撤销认证的条目不得继续新安装



## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-36: 本文原先把 `RevenueSharePolicy` 直接列为 canonical marketplace 对象，根因是早期市场合同把商业结算域和运行时安装/安全治理写在同一层，导致结算字段看起来可以参与 Pack 执行门禁。修复：正文现把该语义降为 `CommercialTermsProjection`，并明确收益分成/税务/退款/结算周期只能作为商业投影，不得影响安装安全或 runtime 决策。
- T-43: 本文原先把 `draft / submitted / certified / published / deprecated / retired` 全部塞进 `lifecycle_state`，根因是历史文案把“审核流程状态”和“运行可用生命周期”混成一个枚举，没有在 v4.3 将 review workflow 与 runtime lifecycle 分离。修复：正文现新增 `review_status` 承载 `draft / submitted / certified`，并把 `lifecycle_state` 收敛到 `active / deprecated / sunset / removed`。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
