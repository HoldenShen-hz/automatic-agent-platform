# Enterprise Secret Management Contract

---

## OAPEFLIR Association

This contract participates in the following stages of the OAPEFLIR eight-stage cycle:

- **Observe**: Signal collection and aggregation
- **Assess**: Pre-execution assessment and risk judgment
- **Plan**: Task decomposition and DAG construction
- **Execute**: Step execution and fault tolerance
- **Feedback**: Signal collection and preprocessing
- **Learn**: Pattern detection and knowledge extraction
- **Improve**: Improvement candidate evaluation and rollout
- **Release**: Controlled release and rollback

---

## 1. Scope

This contract defines industrial-grade secret lifecycle, hosting solutions, and usage audit.

Related documents:

- `sandbox_and_auth_contract.md`
- `policy_engine_contract.md`
- `tenant_and_organization_contract.md`

## 2. Goals

- Secrets do not land in application config or worker filesystem as plaintext long-term.
- Secret read, rotation, scope, and usage records are auditable.
- Workers default to not obtaining secrets beyond their own execution scope.

## 3. Secret Classification

- `provider_api_key`
- `tenant_credential`
- `oauth_client_secret`
- `signing_key`
- `db_connection_secret`
- `break_glass_secret`

## 4. Recommended Hosting Boundaries

| Scenario | Recommended Solution |
| --- | --- |
| Local development | `.env` dev-only |
| Shared test/staging | Secret Manager / Vault |
| Production | Vault / KMS / Cloud Secret Manager |

## 5. Key Rules

- Secrets must have `scope`, distinguishing at minimum system / tenant / workspace / worker.
- Secrets must have rotation policy.
- Workers should only get short-lived, minimum-scope credentials.
- Secret injection short-lived credentials must satisfy hard TTL upper limit: `TTL <= 300s`.
- Secret value must not appear in logs, event payload, artifact, or memory.
- Secret value must not enter prompts, tool output echo, debug dump, or crash snapshot.

## 6. Usage Flow

1. Caller declares required secret capability.
2. Policy Engine validates if request subject has access rights.
3. Secret provider returns temporary credential or controlled plaintext.
4. Usage behavior writes audit trail.
5. Recycle after expiration or task completion.

Additional rules:

- Secret provider should not directly issue long-term plaintext to untrusted workers; prefer short-lived credentials or controlled proxy access.
- Provider credential pool / model provider runtime when consuming `secret_ref` should prefer provider-issued short-lived lease; must recycle corresponding lease after request or streaming session ends.
- Emergency mode acquisition of secret must leave break-glass audit and post-incident review record.
- Release pipeline, deployment matrix, CI/CD workflow default to only propagating `secret_ref` and equivalent masked metadata; do not write registry / deploy secret plaintext to bundle, artifact, CLI stdout, or workflow files.

## 7. Audit Fields

- `secret_ref`
- `scope`
- `requested_by`
- `granted_to`
- `granted_at`
- `expires_at`
- `ttl_seconds`
- `usage_purpose`

Current baseline implementation additions:

- Authoritative metadata stored in `secret_registry`
- Usage audit append-only stored in `secret_usage_audits`
- Rotation events append-only stored in `secret_rotation_events`
- Short-lived credential issuance status authoritative stored in `secret_leases`, recording `issued_at / expires_at / revoked_at / revoked_by / revocation_reason_code`
- Current local provider seam allows `environment / vault / kms / secret_manager` to go through unified resolution interface; among these, `vault / kms / secret_manager` now supports provider-specific JSON/file-backed external adapter, and can use `issued_lease` to describe provider-issued short-lived credential; before real provider integration, env-backed adapter can serve as fallback
- `deployment-execution` CLI now parses registry / deploy secret through unified secret management seam, not directly bypassing to read environment variables
- Provider credential pool / `MiniMaxChatService` now supports retaining managed `secret_ref`, issuing via `SecretManagementService.issueSecretLease(...)` at runtime and recycling lease after request completion, not retaining plaintext API key long-term at startup

## 8. Rotation Requirements

- Support planned rotation and emergency rotation.
- Rotation failure should trigger alert.
- Break-glass secret requires dual knowledge or dual approval to trigger.

## 9. Prohibited Items

- Hardcoding production keys into prompts, yaml, fixtures
- Workers persisting long-term key copies
- Directly exposing secrets in CLI output or debug snapshot
- Writing plaintext registry/deploy secret in release bundle, deployment report, or workflow artifact

## 10. Conclusion

Industrial-grade secret management core is not "having a place to store keys", but:

- Minimum scope
- Temporary credentials
- Rotation
- Audit

## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical sections conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-50: This document originally only qualitatively required "short-lived credentials". Root cause: secret contract emphasized hosting and audit, but did not write runtime injection TTL hard upper limit as executable constraint. Fix: Main text now mandatory converges secret injection short-lived credentials to `TTL <= 300s`, and requires audit fields to explicitly record `ttl_seconds`.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.