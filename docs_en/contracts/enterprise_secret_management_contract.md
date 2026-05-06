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
- **Improve**: Improvement candidate evaluation and release
- **Release**: Controlled release and rollback

---

## 1. Scope

This contract defines industrial-grade secret lifecycle, custody solutions, and usage audit.

Related documents:

- `sandbox_and_auth_contract.md`
- `policy_engine_contract.md`
- `tenant_and_organization_contract.md`

## 2. Goals

- Secrets do not remain in plaintext in application configuration or worker filesystem for long periods.
- Secret reads, rotation, scope, and usage records are auditable.
- Workers by default cannot access secrets beyond their execution scope.

## 3. Secret Classification

- `provider_api_key`
- `tenant_credential`
- `oauth_client_secret`
- `signing_key`
- `db_connection_secret`
- `break_glass_secret`

## 4. Recommended Custody Boundaries

| Scenario | Recommended Solution |
| --- | --- |
| Local development | `.env` only for development |
| Shared test/staging | Secret Manager / Vault |
| Production | Vault / KMS / Cloud Secret Manager |

## 5. Key Rules

- Secrets must have `scope`, distinguishing at least: system / tenant / workspace / worker.
- Secrets must have rotation policy.
- Workers should only get short-lived, minimum-scope credentials.
- Secret injection short-lived credentials must satisfy hard TTL upper limit: `TTL <= 300s`.
- Secret value must not appear in logs, event payload, artifacts, or memory.
- Secret value must not enter prompts, tool output echoes, debug dumps, or crash snapshots.

## 6. Usage Flow

1. Caller declares required secret capability.
2. Policy Engine validates if the request subject has access rights.
3. Secret provider returns temporary credential or controlled plaintext.
4. Usage behavior writes to audit trail.
5. Recycled after expiration or task completion.

Supplementary rules:

- Secret provider should not directly issue long-term plaintext to untrusted workers; prioritize short-lived credentials or controlled proxy access.
- Provider credential pool / model provider runtime consuming `secret_ref` should prioritize provider-issued short-lived lease; must recycle corresponding lease after request or streaming session ends.
- Break-glass secret acquisition must leave break-glass audit and post-incident review records.
- Release pipeline, deployment matrix, CI/CD workflow by default only allow propagating `secret_ref` and equivalent masked metadata; must not write registry / deploy secret plaintext into bundle, artifact, CLI stdout, or workflow files.

## 7. Audit Fields

- `secret_ref`
- `scope`
- `requested_by`
- `granted_to`
- `granted_at`
- `expires_at`
- `ttl_seconds`
- `usage_purpose`

Current baseline implementation supplements:

- Authoritative metadata stored in `secret_registry`
- Usage audit append-only stored in `secret_usage_audits`
- Rotation events append-only stored in `secret_rotation_events`
- Short-lived credential issuance state authoritative stored in `secret_leases`, recording `issued_at / expires_at / revoked_at / revoked_by / revocation_reason_code`
- Current local provider seam allows `environment / vault / kms / secret_manager` to go through unified resolution interface; among these, `vault / kms / secret_manager` now supports provider-specific JSON/file-backed external adapter, and can describe provider-issued short-lived credential through `issued_lease`; before real provider integration, env-backed adapter can serve as fallback
- `deployment-execution` CLI now resolves registry / deploy secrets through unified secret management seam, instead of directly bypassing reading environment variables
- Provider credential pool / `MiniMaxChatService` now supports retaining managed `secret_ref`, issuing through `SecretManagementService.issueSecretLease(...)` at runtime and recycling lease after request completion, rather than long-term retaining plaintext API key at startup

## 8. Rotation Requirements

- Support both planned rotation and emergency rotation.
- Rotation failure should trigger alerts.
- Break-glass secrets require dual knowledge or dual approval to trigger.

## 9. Prohibitions

- Hard-coding production keys into prompts, yaml, fixtures
- Workers persisting long-term key copies
- Directly exposing secrets in CLI output or debug snapshots
- Writing plaintext registry/deploy secrets in release bundle, deployment report, or workflow artifacts

## 10. Conclusion

The core of industrial-grade secret management is not "having a place to store keys", but:

- Minimum scope
- Temporary credentials
- Rotation
- Audit


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical paragraphs of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 to ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-50: This document originally only qualitatively required "short-lived credentials". Root cause: secret contract emphasized custody and audit but did not write the hard upper limit for TTL of runtime-injected secrets as an enforceable constraint. Fix: The text now forcefully converges secret injection short-lived credentials to `TTL <= 300s`, and requires audit fields to explicitly record `ttl_seconds`.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events can only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
