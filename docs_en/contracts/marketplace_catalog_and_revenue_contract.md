# Marketplace Catalog And Revenue Contract

## 1. 范围

本 contract defines `§55` 的市场目录、安装治理、商业元data投影和废弃生命cycle。

## 2. Canonical 对象

- `MarketplaceListing`
- `MarketplaceInstallRecord`
- `CommercialTermsProjection`
- `CertificationRecord`
- `ListingDependency`
- `PluginTrustRoot`
- `PluginProvenanceAttestation`
- `RevokedPluginArtifact`

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

- 商业元data只允许作为 marketplace catalog / invoice / settlement 的投影输入。
- `revenue_share_ref`、`tax_policy_ref`、`refund_policy_ref`、`settlement_cycle_ref` 不得参vs Pack 执linesauthorization、安装security判定或 runtime sandbox Decision。
- marketplace install / activation / deprecation 的执linesvssecurity门禁只能消费 `trust_level`、`capabilities`、relies on约束和authentication结果。

## 5. 规则

- 未authentication条目不得进入 `active`。
- relies on必须显式声明并via兼容性检查。
- 废弃条目必须提供迁移或替代Recommendation。
- `sunset` 条目不得accepts新安装，但允许受控迁移或只读查看。
- `removed` 条目不得被新安装、升级或激活。
- 非 internal publisher 的 artifact 必须能在 `PluginTrustRoot` 中找到匹配信任根。
- artifact 必须保留 provenance attestation，至少contains `source_uri / manifest_checksum / sbom_digest / signature_digest`。
- 被writes `RevokedPluginArtifact` 的 artifact 必须立即阻断新安装vs新激活。
- install gate 必须同时校验 `signature / sbom / sandbox / egress review`，并给出推荐 `required_isolation_mode`。

## 6. 测试要求

- unit：listing schema、dependency validation、commercial projection validation
- integration：install / upgrade / deprecate / sunset / remove lifecycle
- contract：被撤销authentication的条目不得继续新安装



## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-36: 本文原先把 `RevenueSharePolicy` directly列为 canonical marketplace 对象，Root cause: 早期市场合同把商业结算域和运lines时安装/security治理写在同一层，导致结算字段看起来可以参vs Pack 执lines门禁。修复：正文现把该语义降为 `CommercialTermsProjection`，并明确收益分成/税务/退款/结算cycle只能作为商业投影，不得Impact安装security或 runtime Decision。
- T-43: 本文原先把 `draft / submitted / certified / published / deprecated / retired` 全部塞进 `lifecycle_state`，Root cause: 历史文案把“审核流程Status”和“运lines可用生命cycle”混成一个枚举，没有在 v4.3 将 review workflow vs runtime lifecycle 分离。修复：正文现新增 `review_status` 承载 `draft / submitted / certified`，并把 `lifecycle_state` 收敛到 `active / deprecated / sunset / removed`。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
