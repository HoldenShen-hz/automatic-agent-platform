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

This contract defines industrial-grade secret lifecycle, custody solutions, and usage auditing.

Related documents:

- `sandbox_and_auth_contract.md`
- `policy_engine_contract.md`
- `tenant_and_organization_contract.md`

## 2. Goals

- Secrets must not remain in plaintext in application configuration or worker filesystems for extended periods.
- Secret reads, rotations, scope, and usage records must be auditable.
- Workers must not by default access secrets beyond their own execution scope.

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
| Local development | `.env` limited to development only |
| Shared test/pre-prod | Secret Manager / Vault |
| Production | Vault / KMS / Cloud Secret Manager |

## 5. Key Rules

- Secrets must have `scope`, distinguishing at minimum: system / tenant / workspace / worker.
- Secrets must have rotation policy.
- Workers should only receive short-lived, minimum-scope credentials.
- Secret values must not appear in logs, event payloads, artifacts, or memory.
- Secret values must not enter prompts, tool output echoes, debug dumps, or crash snapshots.

## 6. Usage Flow

1. Caller declares desired secret capability.
2. Policy Engine validates if the requester has permission to access.
3. Secret provider returns temporary credential or controlled plaintext.
4. Usage behavior writes to audit trail.
5. Recalled after expiration or task completion.

Supplementary rules:

- Secret provider must not directly issue long-term plaintext to untrusted workers; prioritize short-term credentials or controlled proxy access.
- When provider credential pool / model provider runtime consumes `secret_ref`, it should prioritize provider-issued short-lived lease; the corresponding lease must be reclaimed after the request or streaming session ends.
- Break-glass secret acquisition must leave break-glass audit and post-mortem records.
- Release pipeline, deployment matrix, CI/CD workflow default to only propagating `secret_ref` and equivalent masked metadata, and must not write registry / deploy secret plaintext into bundles, artifacts, CLI stdout, or workflow files.

## 7. Audit Fields

- `secret_ref`
- `scope`
- `requested_by`
- `granted_to`
- `granted_at`
- `expires_at`
- `usage_purpose`

Current baseline implementation supplements:

- Authoritative metadata stored in `secret_registry`.
- Usage audits append-only stored in `secret_usage_audits`.
- Rotation events append-only stored in `secret_rotation_events`.
- Short-lived credential issuance status authoritative stored in `secret_leases`, recording `issued_at / expires_at / revoked_at / revoked_by / revocation_reason_code`.
- Current local provider seam allows `environment / vault / kms / secret_manager` through a unified resolution interface; `vault / kms / secret_manager` currently support provider-specific JSON/file-backed external adapters and can use `issued_lease` to describe provider-issued short-lived credentials; before real provider integration, env-backed adapter can serve as fallback.
- `deployment-execution` CLI now resolves registry / deploy secrets through the unified secret management seam rather than directly bypassing and reading environment variables.
- Provider credential pool / `MiniMaxChatService` now support retaining managed `secret_ref`, issuing and reclaiming leases through `SecretManagementService.issueSecretLease(...)` at runtime rather than retaining long-term plaintext API keys at startup.

## 8. Rotation Requirements

- Support both planned rotation and emergency rotation.
- Rotation failure should trigger alerts.
- Break-glass secrets require dual knowledge or dual approval to trigger.

## 9. Prohibitions

- Hardcoding production keys into prompts, yaml, fixtures.
- Workers persisting long-term key copies.
- Directly exposing secrets in CLI output or debug snapshots.
- Writing plaintext registry/deploy secrets into release bundles, deployment reports, or workflow artifacts.

## 10. Conclusion

The core of industrial-grade secret management is not "having a place to store keys," but rather:

- Minimum scope.
- Temporary credentials.
- Rotation.
- Auditing.
