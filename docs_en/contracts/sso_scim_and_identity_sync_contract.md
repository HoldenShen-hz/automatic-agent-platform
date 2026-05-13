# SSO SCIM And Identity Sync Contract

## 1. Scope

This contract defines enterprise identity access, SCIM synchronization, and user lifecycle automation for `§48`.

## 2. Canonical Objects

- `IdentityProviderConfig`
- `SsoSession`
- `ScimProvisioningEvent`
- `IdentitySyncDlqRecord`
- `IdentityLink`
- `UserLifecycleEvent`

## 3. `IdentityProviderConfig` Minimum Fields

- `provider_id`
- `protocol`: `oidc | saml2 | scim`
- `tenant_id`
- `issuer`
- `client_id`
- `attribute_mapping`
- `enabled`

Note:

- Enterprise SSO must support `OIDC` and `SAML 2.0`; `SCIM` is responsible for identity and group synchronization, not a replacement for login protocol.

## 3A. `IdentitySyncDlqRecord` Minimum Fields

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

## 4. SCIM / Lifecycle Events

`ScimProvisioningEvent.action` fixed as:

- `user_created`
- `user_updated`
- `user_disabled`
- `user_deleted`
- `group_updated`

`UserLifecycleEvent.status` fixed as:

- `pending`
- `active`
- `suspended`
- `disabled`
- `deleted`

## 5. Boundary Rules

- SSO / SCIM only synchronizes identity, group, and affiliation, does not directly grant business governance permissions.
- Identity synchronization must be idempotent; duplicate events must not create duplicate subjects.
- Disabled identity must trigger session invalidation and automatic recovery of access capabilities.
- When SCIM / identity sync cannot be persisted, event must enter `identity_sync_dlq`, must not be silently dropped.
- `identity_sync_dlq` must support manual replay, idempotent retry, and retrieval by tenant / provider.

## 6. Testing Requirements

- unit: attribute mapping, identity link, lifecycle transitions
- integration: IdP -> SCIM -> platform identity synchronization
- contract: After delete / disable events, no active authorization session should remain


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical paragraphs in this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` shall prevail.

- T-44: This document originally compressed enterprise identity access into a generalized protocol collection of `oidc | saml | scim`, and completely did not define dead-letter handling for sync failures. The root cause was that the contract mixed "login protocol" and "identity synchronization channel", while ignoring the most critical failure compensation chain for enterprise access. Fix: The main text now explicitly defines `SAML 2.0` as one of the required enterprise SSO protocols, and adds `IdentitySyncDlqRecord` with corresponding DLQ rules.

Mandatory Rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events can only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.