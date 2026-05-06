# Harness Run Contract

> **v4.3 canonical contract**. Covers `HarnessRun`.

## 1. Scope

`HarnessRun` is the unique authoritative Run for a complete task execution. OAPEFLIR stages, legacy `workflow_run`, UI timeline, and diagnostics runs can only be projections or views of `HarnessRun`.

## 2. Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `harnessRunId` | `string` | Run ID |
| `tenantId` | `string` | Tenant |
| `domainId` | `string` | Canonical domain binding; used for risk override, knowledge boundary, prompt/tool selection, and domain-level audit aggregation |
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
| `terminalAt` | `timestamp?` | Terminal state time |
| `terminalReason` | `string?` | Terminal state reason |

## 3. Status Enumeration

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

## 4. State Transition Rules

- All state transitions must go through `RuntimeStateMachine.transition(command)`.
- Transition must validate CAS, active lease, fencing token, policy guard, budget precondition, and version lock.
- Each truth mutation must transactionally append `platform.*` fact event.
- `replanning` can only be expressed through `GraphPatch` append and must not overwrite historical `PlanGraphBundle`.
- `compensating` does not indicate original run succeeded; compensation facts are written to `CompensationRecord`.
- `domainId` is part of run truth and must not be reversely deduced at runtime from `tenantId`, `constraintPackRef`, or UI division projection.

## 5. Projection Rules

- `workflow_run` is only allowed as read model / query projection.
- OAPEFLIR run lifecycle can only be derived from `HarnessRun` + `OapeflirViewEvent`.
- UI can display stage status but must not write back `HarnessRun.status` inversely.
- Projection if displaying `divisionId`, `domainHint`, or business alias must retain explicit mapping of `domainId -> legacy alias` and must not overwrite canonical run binding.

## 6. Legacy / Deprecated Mapping

| Old Name | v4.3 Semantics |
| --- | --- |
| `OapeflirRun` | Semantic projection of `HarnessRun`, not truth |
| `workflow_run` | read projection |
| `RunStatus` | `HarnessRun.status` + OAPEFLIR view |
| `HarnessStep` | Semantic step; can expand to one or more `NodeRun` |

## 7. Test Requirements

- Terminal states cannot transition out.
- Admission idempotency: duplicate `RequestEnvelope` must not create second `HarnessRun`.
- Any direct repository truth mutation must be rejected or restricted to internal primitives by tests.
- Each state transition must produce platform fact event and audit evidence.


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical paragraphs of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 to ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-7: Contract §45.13 defines 6 states vs architecture §25.8 defines 13 states; architecture documents internally also inconsistent (§25.4 lists 7 states vs §25.8 lists 13 states). Fix: This semantics converges to v4.3 canonical contract; old fields, old states, old DTOs, or old terminology are only allowed as legacy/deprecated/projection/migration input and must not be used as new implementation entry.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events can only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
