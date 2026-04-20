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

