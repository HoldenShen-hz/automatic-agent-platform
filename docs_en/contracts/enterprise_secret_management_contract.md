# Enterprise Secret Management Contract

---

## OAPEFLIR Association

This contract participates in the following phases of the OAPEFLIR eight-phase loop:

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

This contract defines industrial-grade secret lifecycle, custody solutions, and usage audit.

Related Documents:

- `sandbox_and_auth_contract.md`
- `policy_engine_contract.md`
- `tenant_and_organization_contract.md`

## 2. Goals

- Secrets should not remain in plaintext in application configuration or worker filesystem for long periods.
- Secret reads, rotations, scope, and usage records are auditable.
- Workers by default cannot access secrets beyond their own execution scope.

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
| Local Development | `.env` dev-only |
| Shared Test/Pre-release | Secret Manager / Vault |
| Production | Vault / KMS / Cloud Secret Manager |

## 5. Key Rules

- Secrets must have `scope`, distinguishing at least system / tenant / workspace / worker.
- Secrets must have rotation policy.
- Workers should only get short-lived, minimum-scope credentials.
- Secret values must not appear in logs, event payloads, artifacts, or memory.
- Secret values must not enter prompts, tool output echoes, debug dumps, or crash snapshots.

## 6. Usage Flow

1. Caller declares required secret capability.
2. Policy Engine validates if requesting subject has access rights.
3. Secret provider returns temporary credential or controlled plaintext.
4. Usage behavior writes to audit trail.
5. Recycle after expiration or task completion.

Supplementary rules:

- Secret provider should not directly issue long-term plaintext to untrusted workers; prioritize short-lived credentials or controlled proxy access.
- When provider credential pool / model provider runtime consumes `secret_ref`, should prioritize using provider-issued short-lived lease; must recycle corresponding lease after request or streaming session ends.
- Break-glass secret acquisition must leave break-glass audit and post-mortem records.
- Release pipeline, deployment matrix, CI/CD workflow by default only allow propagating `secret_ref` and equivalent masked metadata; must not write registry / deploy secret plaintext into bundle, artifact, CLI stdout, or workflow files.

## 7. Audit Fields

- `secret_ref`
- `scope`
- `requested_by`
- `granted_to`
- `granted_at`
- `expires_at`
- `usage_purpose`

Current baseline implementation supplement:

- Authoritative metadata stored in `secret_registry`
- Usage audit append-only stored in `secret_usage_audits`
- Rotation events append-only stored in `secret_rotation_events`
- Short-lived credential issuance status authoritative stored in `secret_leases`, recording `issued_at / expires_at / revoked_at / revoked_by / revocation_reason_code`
- Current local provider seam allows `environment / vault / kms / secret_manager` to go through unified resolution interface; among them, `vault / kms / secret_manager` now support provider-specific JSON/file-backed external adapter, and can use `issued_lease` to describe provider-issued short-lived credential; can still be backed by env-backed adapter before real provider integration
- `deployment-execution` CLI now resolves registry / deploy secrets through unified secret management seam, rather than directly bypassing and reading environment variables
- Provider credential pool / `MiniMaxChatService` now support retaining managed `secret_ref`, issuing via `SecretManagementService.issueSecretLease(...)` at runtime and recycling lease after request completion, rather than long-term retaining plaintext API key at startup

## 8. Rotation Requirements

- Support both planned rotation and emergency rotation.
- Rotation failure should trigger alerts.
- Break-glass secrets must be known by two people or triggered by dual approval.

## 9. Prohibited Items

- Hard-coding production keys into prompts, yaml, fixtures
- Workers persisting long-term key copies
- Directly exposing secrets in CLI output or debug snapshots
- Writing plaintext registry/deploy secrets in release bundles, deployment reports, or workflow artifacts

## 10. Closure Conclusion

The core of industrial-grade secret management is not "having a place to store keys", but:

- Minimum scope
- Temporary credentials
- Rotation
- Audit
