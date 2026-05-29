# SSO SCIM And Identity Sync Contract

## 1. 范围

本 contract defines `§48` 的企业身份接入、SCIM synchronousvsuser生命cycle自动化。

## 2. Canonical 对象

- `IdentityProviderConfig`
- `SsoSession`
- `ScimProvisioningEvent`
- `IdentitySyncDlqRecord`
- `IdentityLink`
- `UserLifecycleEvent`

## 3. `IdentityProviderConfig` 最小字段

- `provider_id`
- `protocol`: `oidc | saml2 | scim`
- `tenant_id`
- `issuer`
- `client_id`
- `attribute_mapping`
- `enabled`

Description：

- 企业 SSO 必须supported `OIDC` vs `SAML 2.0`；`SCIM` 负责身份vs组synchronous，不替代登录协议。

## 3A. `IdentitySyncDlqRecord` 最小字段

- `dlq_id`
- `tenant_id`
- `provider_id`
- `event_type`
- `payload_ref`
- `failure_code`
- `failure_detail?`
- `retry_count`
- `first_failed_at`
- `last_failed_at`
- `resolved_at?`

## 4. SCIM / 生命cycle事件

`ScimProvisioningEvent.action` 固定为：

- `user_created`
- `user_updated`
- `user_disabled`
- `user_deleted`
- `group_updated`

`UserLifecycleEvent.status` 固定为：

- `pending`
- `active`
- `suspended`
- `disabled`
- `deleted`

## 5. 边界规则

- SSO / SCIM 只synchronous身份、组和归属，不directly赋予业务治理permission。
- 身份synchronous必须is幂等的，repeats事件不得创建repeats主体。
- 被disabled身份必须触发会话失效vs自动回收访问能力。
- SCIM / identity sync no法落地时，事件必须进入 `identity_sync_dlq`，不得静默丢弃。
- `identity_sync_dlq` 必须supported人工重放、幂等重试和按 tenant / provider 检索。

## 6. 测试要求

- unit：attribute mapping、identity link、生命cycle转换
- integration：IdP -> SCIM -> 平台身份synchronous
- contract：删除 / disabled事件后不得保留活跃authorization会话



## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中record的 contract 偏差。本文档历史段落如vs本节conflicts，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-44: 本文原先把企业身份接入压缩成 `oidc | saml | scim` 的泛化协议集合，且完全没definessynchronousfailed的 dead-letter handle，Root cause: 合同把“登录协议”vs“身份synchronous通道”混写，同时忽略了企业接入最关键的failed补偿链。修复：正文现明确 `SAML 2.0` 为必选企业 SSO 协议之一，并新增 `IdentitySyncDlqRecord` vs对应 DLQ 规则。

mandatory规则：Status迁移必须via `RuntimeStateMachine.transition(command)`；执lines计划必须uses `PlanGraphBundle`；执lines结果必须uses `NodeAttemptReceipt`；truth event 只能uses `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；budget必须uses `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
