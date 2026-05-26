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

This contract defines industrial-grade secret lifecycle, hosting solution and usage audit.

Related documents:

- `sandbox_and_auth_contract.md`
- `policy_engine_contract.md`
- `tenant_and_organization_contract.md`

## 2. Goals

- Secrets must not land in plaintext in application config or worker filesystem for extended periods.
- Secret reads, rotation, scope and usage records are auditable.
- Workers default to not getting secrets beyond their own execution scope.

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
| Shared test / staging | Secret Manager / Vault |
| Production | Vault / KMS / Cloud Secret Manager |

## 5. Key Rules

- Secrets must have `scope`, distinguishing at minimum system / tenant / workspace / worker.
- Secrets must have rotation policy.
- Workers should only get short-lived, minimum-scope credentials.
- Secret injection short-lived credentials must satisfy hard TTL upper bound: `TTL <= 300s`.
- Secret value must not appear in logs, event payload, artifact or memory.
- Secret value must not enter prompt, tool output echo, debug dump or crash snapshot.

## 6. Usage Flow

1. Caller declares required secret capability.
2. Policy Engine validates if request subject has access rights.
3. Secret provider returns temporary credential or controlled plaintext.
4. Usage behavior writes to audit trail.
5. Recycle after expiration or task completion.

Supplementary rules:

- Secret provider should not directly issue long-term plaintext to untrusted worker; prioritize short-lived credentials or controlled proxy access.
- When provider credential pool / model provider runtime consumes `secret_ref`, should prioritize provider-issued short-lived lease; must recycle corresponding lease after request or streaming session ends.
- Emergency mode secret acquisition must leave break-glass audit and post-mortem records.
- Release pipeline, deployment matrix, CI/CD workflow default to only propagating `secret_ref` and equivalent masked metadata; must not write registry / deploy secret plaintext into bundle, artifact, CLI stdout or workflow file.

## 7. Audit Fields

- `secret_ref`
- `scope`
- `requested_by`
- `granted_to`
- `granted_at`
- `expires_at`
- `ttl_seconds`
- `usage_purpose`

Current baseline implementation supplement:

- Authoritative metadata stored in `secret_registry`
- Usage audit append-only stored in `secret_usage_audits`
- Rotation events append-only stored in `secret_rotation_events`
- Short-lived credential issuance status authoritatively stored in `secret_leases`, recording `issued_at / expires_at / revoked_at / revoked_by / revocation_reason_code`
- Current local provider seam allows `environment / vault / kms / secret_manager` to go through unified resolution interface; among them `vault / kms / secret_manager` now supports provider-specific JSON/file-backed external adapter, and can describe provider-issued short-lived credential via `issued_lease`; before real provider integration, can still be backed by env-backed adapter
- `deployment-execution` CLI now resolves registry / deploy secret through unified secret management seam, instead of directly bypassing to read environment variables
- Provider credential pool / `MiniMaxChatService` now supports retaining managed `secret_ref`, issuing via `SecretManagementService.issueSecretLease(...)` at runtime and recycling lease after request completion, rather than long-term retaining plaintext API key at startup

## 8. Rotation Requirements

- Support planned rotation and emergency rotation.
- Rotation failure should trigger alert.
- Break-glass secret must be known by two people or triggered by dual approval.

## 9. Prohibitions

- Hardcoding production keys into prompt, yaml, fixture
- Workers persistently retaining long-term key copies
- Directly exposing secrets in CLI output or debug snapshot
- Writing plaintext registry/deploy secret in release bundle, deployment report or workflow artifact

## 10. Closure Conclusion

Industrial-grade secret management core is not "having a place to store keys", but:

- Minimum scope
- Temporary credentials
- Rotation
- Audit


## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical paragraphs of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-50: This document originally only qualitatively required "short-lived credentials". The root cause was that the secret contract emphasized hosting and audit but did not write the runtime injection TTL hard upper bound as an executable constraint. Fix: The main text now forces secret injection short-lived credentials to converge to `TTL <= 300s`, and requires audit fields to explicitly record `ttl_seconds`.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
