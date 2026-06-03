# Dataflow 10: YONO Market → Forecast → Order → Settlement → Reputation

> Per docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §32.2.

## Trust boundaries

```text
[market request]  --(forecast)-->   [predicted outcome]
                                         |
                                         v
[order]           --(risk check)-->  [guarded order]
                                         |
                                         v
[settlement]      --(commit)-->     [external state]
                                         |
                                         v
[reputation]      --(adjust)-->     [reputation record]
```

## Threats

| ID | Threat | Boundary | Failure mode | Required gate |
|---|---|---|---|---|
| THR-10.1 | YONO is enabled in production by default | enablement | prototype becomes production | `audit:domain-coverage` (mode: `production-ready`) |
| THR-10.2 | Order placed without a forecast or with an empty forecast | order | blind order | (P1 yono invariant) |
| THR-10.3 | Settlement commits to an external system without a receipt | commit | unrecoverable | `audit:side-effect-receipt` |
| THR-10.4 | Reputation is lowered without an audit trail | reputation | gaming | `audit:audit-chain` |

## Side-effect boundary

Order and settlement are **external side-effects**. They go through
the same `audit:side-effect-receipt` + `audit:receipt-verification`
machinery as Dataflow 2.

## Evidence boundary

Each market event is appended to the outbox (audit:event-outbox) and
the audit chain (audit:audit-chain).

## YONO is disabled_by_default

Per §15.3, the YONO domain must be marked `disabled_by_default` and
the `audit:domain-coverage --mode=production-ready` gate enforces this.

## Required gates

```text
audit:domain-coverage --mode=production-ready   # §15.3
audit:side-effect-receipt                      # §10.4
audit:receipt-verification                     # §11.2
audit:audit-chain                              # §11.1
audit:event-outbox                             # §11.3
```

## Status

- audit:domain-coverage OK (already present)
- audit:side-effect-receipt OK
- audit:receipt-verification OK
- audit:audit-chain OK
- audit:event-outbox OK
