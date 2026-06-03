# Dataflow 8: Backup/Restore → File System → Remote URI → Retention

> Per docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §32.2.

## Trust boundaries

```text
[truth store]   --(snapshot)-->   [local file]
                                        |
                                        v
[checksum]      --(sign)-->        [signed bundle]
                                        |
                                        v
[remote URI]    --(TLS)-->         [object store]
                                        |
                                        v
[retention]     --(policy)-->      [expire / delete]
```

## Threats

| ID | Threat | Boundary | Failure mode | Required gate |
|---|---|---|---|---|
| THR-8.1 | `rmSync` called on a backup path without a `repoRoot` / `realpath` / `startsWith` guard | fs | data loss / arbitrary file delete | `audit:path-safety` (rule: `path_safety.rm_sync`) |
| THR-8.2 | Remote URI is a `file://` reference, not a real object-store | remote | SSRF / local FS escape | `audit:path-safety` (file://) + §9.4 |
| THR-8.3 | Symlink in the backup path is followed without `realpath` | fs | symlink-based escape | `audit:path-safety` (rule: `path_safety.symlink`) |
| THR-8.4 | Bundle is not signed or signature is not verified | remote | tampering | `evidence:bundle:verify` (HMAC-SHA256) |
| THR-8.5 | Retention policy bypasses quota and runs unbounded | retention | storage exhaustion | (operational gate) |
| THR-8.6 | Restore overwrites a more recent snapshot without check | restore | data loss | (operational gate) |

## Side-effect boundary

Backup is a side-effect that touches the FS. The `audit:path-safety`
scanner verifies that `rmSync`, `mv`, `cp`, `writeFileSync` calls
have a nearby `repoRoot` / `realpath` / `startsWith` guard.

## Evidence boundary

Every backup bundle is checksummed and signed. Restore verifies the
signature before applying.

## Required gates

```text
audit:path-safety               # §14.1
evidence:bundle:create          # §16.3
evidence:bundle:verify          # §16.3
audit:audit-chain               # §11.1 (backup event in chain)
```

## Status

- audit:path-safety OK
- evidence:bundle:create OK
- evidence:bundle:verify OK
- audit:audit-chain OK
