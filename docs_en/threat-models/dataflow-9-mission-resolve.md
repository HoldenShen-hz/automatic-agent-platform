# Dataflow 9: Mission Resolve → Mission Guard → NodeRun → Runtime Transition

> Per docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §32.2.

## Trust boundaries

```text
[mission request]  --(resolve)-->   [mission plan]
                                         |
                                         v
[mission guard]    --(allow/deny)--> [guarded plan]
                                         |
                                         v
[node run]         --(transition)--> [runtime state]
                                         |
                                         v
[audit chain]      --(append)-->    [durable record]
```

## Threats

| ID | Threat | Boundary | Failure mode | Required gate |
|---|---|---|---|---|
| THR-9.1 | Mission is resolved without checking budget / quota | resolve | resource exhaustion | (P1 mission-step-governance invariant) |
| THR-9.2 | Mission guard bypassed (no permission check) | guard | privilege escalation | `tests/invariants/mission-step-governance.test.ts` |
| THR-9.3 | NodeRun transitions to a terminal state without going through `TransitionService` | runtime | state divergence | `tests/invariants/state-transition-service-invariants.test.ts` |
| THR-9.4 | Mission event sequence skips a required step | sequence | partial mission | (P1 mission-step-governance) |

## Side-effect boundary

A mission step is a side-effect; it must go through the same
`audit:side-effect-receipt` machinery as Dataflow 2.

## Evidence boundary

Each mission transition appends an `EventEnvelope` to the outbox
(audit:event-outbox) and the audit chain (audit:audit-chain).

## Required gates

```text
audit:side-effect-receipt       # §10.4
audit:audit-chain               # §11.1
audit:event-outbox              # §11.3
test:invariants                 # mission-step-governance, state-transition-service
```

## Status

- audit:side-effect-receipt OK
- audit:audit-chain OK
- audit:event-outbox OK
- test:invariants/mission-step-governance OK (present)
- test:invariants/state-transition-service-invariants OK (present)
