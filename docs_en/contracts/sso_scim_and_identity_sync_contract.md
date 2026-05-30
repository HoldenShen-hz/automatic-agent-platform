# SSO SCIM And Identity Sync Contract

## 1. Scope

This contract defines enterprise identity access, SCIM synchronization, and user lifecycle automation for §48.

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

Notes:

- Enterprise SSO must support `OIDC` and `SAML 2.0`; `SCIM` is responsible for identity and group synchronization, not login protocol replacement.

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

`ScimProvisioningEvent.action` is fixed as:

- `user_created`
- `user_updated`
- `user_disabled`
- `user_deleted`
- `group_updated`

`UserLifecycleEvent.status` is fixed as:

- `pending`
- `active`
- `suspended`
- `disabled`
- `deleted`

## 5. Boundary Rules

- SSO / SCIM only synchronizes identity, groups, and affiliations; does not directly grant business governance permissions.
- Identity synchronization must be idempotent; duplicate events must not create duplicate principals.
- Disabled identities must trigger session invalidation and automatic access capability revocation.
- When SCIM / identity sync cannot land, events must enter `identity_sync_dlq`; must not be silently dropped.
- `identity_sync_dlq` must support manual replay, idempotent retry, and retrieval by tenant / provider.

## 6. Test Requirements

- unit: attribute mapping, identity link, lifecycle transitions
- integration: IdP -> SCIM -> platform identity synchronization
- contract: After delete / disable events, no active authorization sessions must remain

## v4.3 Architecture Remediation

This section fixes contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If any historical section of this document conflicts with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-44: This document originally compressed enterprise identity access into a generalized protocol set of `oidc | saml | scim`, and completely lacked dead-letter handling for synchronization failures. Root cause: The contract conflated "login protocol" with "identity sync channel" while ignoring the most critical failure compensation chain for enterprise access. Fix: The main text now explicitly specifies `SAML 2.0` as a required enterprise SSO protocol, and added `IdentitySyncDlqRecord` with corresponding DLQ rules.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budget must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.