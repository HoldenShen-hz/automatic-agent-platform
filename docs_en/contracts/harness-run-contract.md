# v4.3 Harness Run Contract

> v4.3 canonical contract. Covers `HarnessRun`.

## 1. Scope

`HarnessRun` is the sole authoritative Run for a complete task execution. OAPEFLIR stages, legacy `workflow_run`, UI timeline, and diagnostics run may only serve as `HarnessRun` projections or views.

## 2. Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `harnessRunId` | `string` | Run ID |
| `tenantId` | `string` | Tenant |
| `confirmedTaskSpecId` | `string` | Source task specification |
| `requestEnvelopeId` | `string` | Admission request |
| `requestHash` | `string` | Idempotent hash |
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
- `cancelled`
- `aborted`

Terminal states: `completed`, `failed`, `cancelled`, `aborted`. Terminal states cannot transition out.

## 4. State Transition Rules

- All state transitions must go through `RuntimeStateMachine.transition(command)`.
- Transitions must verify CAS, active lease, fencing token, policy guard, budget precondition, and version lock.
- Each truth mutation must append `platform.*` fact event within the same transaction.
- `replanning` may only be expressed through `GraphPatch` append and must not overwrite historical `PlanGraphBundle`.
- `compensating` does not indicate the original run succeeded; compensation facts are written to `CompensationRecord`.

## 5. Projection Rules

- `workflow_run` is only allowed as read model / query projection.
- OAPEFLIR run lifecycle may only be derived from `HarnessRun` + `OapeflirViewEvent`.
- UI may display stage status but must not write back to `HarnessRun.status`.

## 6. Legacy / Deprecated Mapping

| Old Name | v4.3 Semantics |
| --- | --- |
| `OapeflirRun` | Semantic projection of `HarnessRun`, not truth |
| `workflow_run` | Read projection |
| `RunStatus` | `HarnessRun.status` + OAPEFLIR view |
| `HarnessStep` | Semantic step; may expand to one or more `NodeRun` |

## 7. Test Requirements

- Terminal states cannot transition out.
- Admission idempotency: Duplicate `RequestEnvelope` must not create a second `HarnessRun`.
- Any direct repository truth mutation must be rejected by tests or restricted to internal primitives.
- Each state transition must produce platform fact event and audit evidence.

## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical sections conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-7: Contract §45.13 defines 6 states vs architecture §25.8 defines 13 states; architecture documentation is also inconsistent internally (§25.4 lists 7 states vs §25.8 lists 13 states). Fix: This semantics converges to v4.3 canonical contract; old fields, old states, old DTOs, or old terminology are only allowed as legacy/deprecated/projection/migration input and must not be used as new implementation entry points.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR may only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.