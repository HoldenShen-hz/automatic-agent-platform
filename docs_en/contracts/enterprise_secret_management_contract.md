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

This contract defines industrial-grade secret lifecycle, hosted solutions, and usage audit.

Related documents:

- `sandbox_and_auth_contract.md`
- `policy_engine_contract.md`
- `tenant_and_organization_contract.md`

## 2. Objectives

- Secrets must not remain in plaintext in application configurations or worker filesystems for extended periods.
- Secret read, rotation, scope, and usage records must be auditable.
- Workers should not obtain secrets beyond their own execution scope by default.

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
| Local Development | `.env` development-only |
| Shared Test/Staging | Secret Manager / Vault |
| Production | Vault / KMS / Cloud Secret Manager |

## 5. Key Rules

- Secrets must have a `scope`, at minimum distinguishing between system / tenant / workspace / worker.
- Secrets must have a rotation policy.
- Workers should only receive short-lived, minimum-scope credentials.
- Secret injection short-lived credentials must satisfy a hard TTL upper limit: `TTL <= 300s`.
- Secret values must not appear in logs, event payloads, artifacts, or memory.
- Secret values must not enter prompts, tool output echoes, debug dumps, or crash snapshots.

## 6. Usage Flow

1. Caller declares required secret capability.
2. Policy Engine validates if the requesting subject has access rights.
3. Secret provider returns temporary credentials or controlled plaintext.
4. Usage behavior is written to audit trail.
5. Credentials are reclaimed after expiration or task completion.

Supplementary rules:

- Secret providers should not directly distribute long-term plaintext to untrusted workers; prioritize using short-lived credentials or controlled proxy access.
- When provider credential pools / model provider runtimes consume `secret_ref`, they should prioritize using provider-issued short-lived leases; leases must be reclaimed after request or streaming session completion.
- Emergency-mode secret acquisition must leave break-glass audit records and post-incident review records.
- Release pipelines, deployment matrices, and CI/CD workflows default to only propagating `secret_ref` and equivalent masked metadata; they must not write registry / deploy secret plaintext into bundles, artifacts, CLI stdout, or workflow files.

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

- Authoritative metadata is stored in `secret_registry`
- Usage audits are append-only stored in `secret_usage_audits`
- Rotation events are append-only stored in `secret_rotation_events`
- Short-lived credential issuance status is authoritatively stored in `secret_leases`, recording `issued_at / expires_at / revoked_at / revoked_by / revocation_reason_code`
- Current local provider seam allows `environment / vault / kms / secret_manager` to go through a unified resolution interface; `vault / kms / secret_manager` now support provider-specific JSON/file-backed external adapters, and can describe provider-issued short-lived credentials via `issued_lease`; before real provider integration, env-backed adapters can serve as fallback
- `deployment-execution` CLI now resolves registry / deploy secrets through the unified secret management seam, rather than directly bypassing to read environment variables
- Provider credential pools / `MiniMaxChatService` now support retaining managed `secret_ref`, issuing leases at runtime via `SecretManagementService.issueSecretLease(...)` and reclaiming leases after request completion, instead of retaining plaintext API keys long-term at startup

## 8. Rotation Requirements

- Support both planned and emergency rotation.
- Rotation failures should trigger alerts.
- Break-glass secrets require dual knowledge or dual approval to trigger.

## 9. Prohibitions

- Hard-coding production keys into prompts, YAML, or fixtures
- Workers persisting long-term key copies
- Directly exposing secrets in CLI output or debug snapshots
- Writing plaintext registry/deploy secrets into release bundles, deployment reports, or workflow artifacts

## 10. Conclusion

Industrial-grade secret management is not about "having a place to store keys," but rather:

- Minimum scope
- Temporary credentials
- Rotation
- Audit


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-50: This document originally only qualitatively required "short-lived credentials"; the root cause was that the secret contract emphasized hosting and audit but failed to write the hard TTL upper limit for runtime injection as an enforceable constraint. Fix: The main text now mandates that secret injection short-lived credentials converge to `TTL <= 300s`, and requires audit fields to explicitly record `ttl_seconds`.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
