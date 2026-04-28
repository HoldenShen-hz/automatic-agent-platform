# SSO SCIM And Identity Sync Contract

## 1. 范围

本 contract 定义 `§48` 的企业身份接入、SCIM 同步与用户生命周期自动化。

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

说明：

- 企业 SSO 必须支持 `OIDC` 与 `SAML 2.0`；`SCIM` 负责身份与组同步，不替代登录协议。

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

## 4. SCIM / 生命周期事件

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

- SSO / SCIM 只同步身份、组和归属，不直接赋予业务治理权限。
- 身份同步必须是幂等的，重复事件不得创建重复主体。
- 被禁用身份必须触发会话失效与自动回收访问能力。
- SCIM / identity sync 无法落地时，事件必须进入 `identity_sync_dlq`，不得静默丢弃。
- `identity_sync_dlq` 必须支持人工重放、幂等重试和按 tenant / provider 检索。

## 6. 测试要求

- unit：attribute mapping、identity link、生命周期转换
- integration：IdP -> SCIM -> 平台身份同步
- contract：删除 / 禁用事件后不得保留活跃授权会话



## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-44: 本文原先把企业身份接入压缩成 `oidc | saml | scim` 的泛化协议集合，且完全没定义同步失败的 dead-letter 处理，根因是合同把“登录协议”与“身份同步通道”混写，同时忽略了企业接入最关键的失败补偿链。修复：正文现明确 `SAML 2.0` 为必选企业 SSO 协议之一，并新增 `IdentitySyncDlqRecord` 与对应 DLQ 规则。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
