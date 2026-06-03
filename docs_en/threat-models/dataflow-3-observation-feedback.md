# Dataflow 3: Observation → Feedback → Learning → Knowledge Promotion → Memory/Knowledge

> Per docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §32.2.

## Trust boundaries

```text
[observation]    --(sanitize)-->    [feedback record]
                                         |
                                         v
[learning]       --(aggregate)-->    [learning object]
                                         |
                                         v
[promotion gate] --(guardrails)-->   [knowledge store]
                                         |
                                         v
[memory]         --(privacy review)-> [long-term memory]
```

## Threats

| ID | Threat | Boundary | Failure mode | Required gate |
|---|---|---|---|---|
| THR-3.1 | Observation contains PII / secret | sanitize | data leak | `audit:secret-sinks` (output span attributes) |
| THR-3.2 | Learning object is promoted without a guard | promotion | contaminated knowledge | `audit:event-outbox` (audit chain) |
| THR-3.3 | Memory carries across tenant boundary | privacy | cross-tenant leakage | `audit:tenant-isolation` |
| THR-3.4 | Promotion does not write a receipt | evidence | no rollback | `audit:receipt-verification` |

## Side-effect boundary

Promotion writes to a knowledge store; the write is a side-effect and
must go through the same receipt + idempotency machinery as external
tool calls (audit:side-effect-receipt).

## Evidence boundary

Each learning object gets a unique `knowledgeId` and is appended to
the audit chain (audit:audit-chain). Replay reconstructs the learning
trail.

## Required gates

```text
audit:secret-sinks              # §9.2
audit:tenant-isolation          # §9.1
audit:event-outbox              # §11.3
audit:audit-chain               # §11.1
audit:receipt-verification      # §11.2
```

## Status

- audit:secret-sinks OK
- audit:tenant-isolation OK
- audit:event-outbox OK
- audit:audit-chain OK
- audit:receipt-verification OK
