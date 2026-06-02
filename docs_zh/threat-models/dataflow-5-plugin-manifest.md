# Dataflow 5: Plugin Manifest → Signature → SBOM → Registry → Execution

> Per docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §32.2.

## Trust boundaries

```text
[plugin author]    --(manifest)-->   [signature]
                                          |
                                          v
[SBOM]            --(SPDX)-->         [registry]
                                          |
                                          v
[policy]          --(allow/deny)-->   [verifier]
                                          |
                                          v
[plugin runtime]  --(load)-->         [execution context]
```

## Threats

| ID | Threat | Boundary | Failure mode | Required gate |
|---|---|---|---|---|
| THR-5.1 | Manifest is unsigned or signature verification is skipped | signature | supply-chain attack | `audit:plugin-security` (rule: `plugin.load_without_verify`, `continue_on_signature_missing`) |
| THR-5.2 | SBOM check branch returns pass without inspecting the SBOM | SBOM | untracked dependencies | `audit:plugin-security` (rule: `plugin.sbom_check_skipped`) |
| THR-5.3 | `allowUnsigned: true` is set as default | policy | backdoor | `audit:plugin-security` (rule: `plugin.unsigned_permitted`) |
| THR-5.4 | Verification error caught with empty handler | policy | silent fail-open | `audit:plugin-security` (rule: `plugin.catch_swallow_verify`) |

## Side-effect boundary

Loading a plugin may write to the registry (cache) and to the audit
chain. Both must be receipted.

## Evidence boundary

The manifest's signature, payload hash, and SBOM checksum are anchored
in the audit chain before the plugin becomes loadable.

## Required gates

```text
audit:plugin-security           # §9.3 / §5.4
audit:audit-chain               # §11.1
audit:receipt-verification      # §11.2
audit:event-outbox              # §11.3
```

## Status

- audit:plugin-security ✅
- audit:audit-chain ✅
- audit:receipt-verification ✅
- audit:event-outbox ✅
