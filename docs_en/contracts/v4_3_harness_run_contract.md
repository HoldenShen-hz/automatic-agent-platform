# v4.3 Harness Run Contract

> v4.3 canonical contract. Covers `HarnessRun`.

## 1. Scope

`HarnessRun` is the sole authoritative Run for a complete task execution. OAPEFLIR stages, legacy `workflow_run`, UI timeline, and diagnostics runs can only be projections or views of `HarnessRun`.

## 2. Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `harnessRunId` | `string` | Run ID |
| `tenantId` | `string` | Tenant |
| `confirmedTaskSpecId` | `string` | Source task spec |
| `requestEnvelopeId` | `string` | Admission request |
| `requestHash` | `string` | Idempotency hash |
| `status` | `HarnessRunStatus` | Run status |
| `constraintPackRef` | `ConstraintPackRef` | Run constraints |
| `versionLockId` | `string` | `RunVersionLock` |
| `planGraphBundleId` | `string?` | Current plan graph |
| `budgetLedgerId` | `string` | Budget ledger |
| `currentSeq` | `number` | Aggregate seq / CAS version |
| `createdAt` | `timestamp` | Creation time |
| `updatedAt` | `timestamp` | Update time |
| `terminalAt` | `timestamp?` | Terminal time |
| `terminalReason` | `string?` | Terminal reason |

## 3. Status Enum

`HarnessRunStatus`:

- `created`
- `admitted`
- `planning`
- `ready`
- `running`
- `pausing`
- `paused`
- `resuming`
- `replanning`
- `compensating`
- `completed`
- `failed`
- `aborted`

Terminal states: `completed`, `failed`, `aborted`. Terminal states cannot transition out.

## 4. Status Transition Rules

- All status transitions must go through `RuntimeStateMachine.transition(command)`.
- Transition must validate CAS, active lease, fencing token, policy guard, budget precondition, and version lock.
- Each truth mutation must append `platform.*` fact event transactionally.
- `replanning` can only be expressed by appending `GraphPatch`, not overwriting historical `PlanGraphBundle`.
- `compensating` does not represent the original run succeeding; compensation facts are written to `CompensationRecord`.

## 5. Projection Rules

- `workflow_run` is only allowed as read model / query projection.
- OAPEFLIR run lifecycle can only be derived from `HarnessRun` + `OapeflirViewEvent`.
- UI can display stage status, but must not write back to `HarnessRun.status`.

## 6. Legacy / Deprecated Mapping

| Old Name | v4.3 Semantics |
| --- | --- |
| `OapeflirRun` | Semantic projection of `HarnessRun`, not truth |
| `workflow_run` | Read projection |
| `RunStatus` | `HarnessRun.status` + OAPEFLIR view |
| `HarnessStep` | Semantic step; can be expanded into one or more `NodeRun` |

## 7. Testing Requirements

- Terminal states cannot transition out.
- Admission idempotency: repeated `RequestEnvelope` does not create a second `HarnessRun`.
- Any direct repository truth mutation must be rejected by tests or limited to internal primitives.
- Each status transition must produce platform fact event and audit evidence.
