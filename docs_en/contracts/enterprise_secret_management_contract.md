# Enterprise Secret Management Contract

## 1. Scope

This contract defines industrial-grade secret lifecycle, hosting solutions, and usage auditing.

Related documents:

- `sandbox_and_auth_contract.md`
- `policy_engine_contract.md`
- `tenant_and_organization_contract.md`

## 2. Goals

- Secrets must not remain in plaintext in application configuration or worker filesystems for long.
- Secret reads, rotations, scopes, and usage records are auditable.
- Workers must not by default get secrets beyond their own execution scope.

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
| Local development | `.env` for development only |
| Shared test/staging | Secret Manager / Vault |
| Production | Vault / KMS / Cloud Secret Manager |

## 5. Key Rules

- Secrets must have `scope`, at minimum distinguishing system / tenant / workspace / worker.
- Secrets must have rotation policy.
- Workers should only get short-lived, minimum-scope credentials.
- Secret values must not appear in logs, event payloads, artifacts, or memory.
- Secret values must not enter prompts, tool output echoes, debug dumps, or crash snapshots.

## 6. Usage Process

1. Caller declares required secret capability.
2. Policy Engine validates whether the requesting principal has access permission.
3. Secret provider returns temporary credentials or controlled plaintext.
4. Usage behavior writes to audit trail.
5. Expires or is reclaimed after task completion.

Supplementary rules:

- Secret provider must not directly issue long-term plaintext to untrusted workers; prioritize using short-lived credentials or controlled proxy access.
- When provider credential pool / model provider runtime consumes `secret_ref`, should prioritize using provider-issued short-lived lease; must reclaim the lease after request or streaming session ends.
- Break-glass secret acquisition must leave break-glass audit and post-mortem records.
- Release pipeline, deployment matrix, and CI/CD workflow must only propagate `secret_ref` and equivalent masked metadata by default, and must not write registry/deploy secrets in plaintext to bundles, artifacts, CLI stdout, or workflow files.

## 7. Audit Fields

- `secret_ref`
- `scope`
- `requested_by`
- `granted_to`
- `granted_at`
- `expires_at`
- `usage_purpose`

Current baseline implementation supplements:

- Authoritative metadata stored in `secret_registry`
- Usage audit append-only stored in `secret_usage_audits`
- Rotation events append-only stored in `secret_rotation_events`
- Short-lived credential issuance status authoritative stored in `secret_leases`, recording `issued_at / expires_at / revoked_at / revoked_by / revocation_reason_code`
- Current local provider seam allows `environment / vault / kms / secret_manager` to go through unified resolution interface; among them, `vault / kms / secret_manager` now supports provider-specific JSON/file-backed external adapter, and can use `issued_lease` to describe provider-issued short-lived credentials; before real provider integration, can still be backed by env-backed adapter
- `deployment-execution` CLI now resolves registry / deploy secrets through unified secret management seam rather than directly bypassing to read environment variables
- Provider credential pool / `MiniMaxChatService` now supports retaining managed `secret_ref`, issuing and reclaiming leases through `SecretManagementService.issueSecretLease(...)` at runtime rather than long-term retaining plaintext API key at startup

## 8. Rotation Requirements

- Support both scheduled rotation and emergency rotation.
- Rotation failure should trigger alerts.
- Break-glass secrets must be known by two people or triggered by double approval.

## 9. Prohibitions

- Hardcoding production keys into prompts, yaml, fixtures
- Workers persisting long-term key copies
- Directly exposing secrets in CLI output or debug snapshots
- Writing plaintext registry/deploy secrets in release bundles, deployment reports, or workflow artifacts

## 10. Closure Conclusion

The core of industrial-grade secret management is not "having a place to store keys" but:

- Minimum scope
- Temporary credentials
- Rotation
- Auditing
