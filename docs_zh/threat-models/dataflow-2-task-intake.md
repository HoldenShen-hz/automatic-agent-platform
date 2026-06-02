# Dataflow 2: Task Intake → Planner → Execution → Tool → SideEffect → Receipt

> Per docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §32.2.

## Trust boundaries

```text
[user request]  --(intake)-->  [validated TaskIntakeRequest]
                                       |
                                       v
[planner]       --(OAPEFLIR)-->   [Workflow / PlanGraph]
                                       |
                                       v
[dispatcher]    --(admission)-->  [NodeRun + lease]
                                       |
                                       v
[tool gateway]  --(risk policy)-> [tool call + approval if needed]
                                       |
                                       v
[side effect]   --(commit)-->     [external state change]
                                       |
                                       v
[receipt]       --(sign)-->       [verifiable receipt in store]
```

## Threats

| ID | Threat | Boundary | Failure mode | Required gate |
|---|---|---|---|---|
| THR-2.1 | Planner constructs a Workflow that does not satisfy OAPEFLIR boundary | orchestration | ungoverned execution | `tests/invariants/oapeflir-loop-invariants.test.ts` |
| THR-2.2 | NodeRun dispatched without a lease or with a stale fencing token | execution | duplicate side-effects | `audit:lease-fencing` |
| THR-2.3 | Tool called without risk classification or approval | tool | privileged tool misuse | `audit:plugin-security` |
| THR-2.4 | Side effect committed but no receipt emitted | side-effect | unrecoverable / no audit | `audit:side-effect-receipt`, `audit:receipt-verification` |
| THR-2.5 | Receipt missing signature or payloadHash | evidence | forgery | `audit:receipt-verification` |

## Side-effect boundary

The `commit` step is the critical point. The `audit:side-effect-receipt`
scanner verifies the file contains a `withIdempotencyKey` wrapper and
a `compensate`/`rollback`/`repair` handler. The
`audit:receipt-verification` scanner verifies the file contains a
`buildReceipt` factory, HMAC computation, `payloadHash`, and
`schemaVersion`.

## Evidence boundary

Each NodeRun produces a `NodeRunEvent` whose checksum is anchored in
the audit chain (`audit:audit-chain`). Replay must be possible from
the chain alone.

## Required gates

```text
audit:lease-fencing             # §10.3
audit:side-effect-receipt       # §10.4
audit:receipt-verification      # §11.2
audit:audit-chain               # §11.1
audit:event-outbox              # §11.3
audit:plugin-security           # §9.3 / §5.4
test:invariants                 # dispatcher-admission, harness-run-authority
```

## Status

- audit:lease-fencing ✅
- audit:side-effect-receipt ✅
- audit:receipt-verification ✅
- audit:audit-chain ✅
- audit:event-outbox ✅
- audit:plugin-security ✅
