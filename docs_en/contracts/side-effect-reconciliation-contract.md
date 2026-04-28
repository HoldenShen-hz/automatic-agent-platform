# v4.3 Side Effect Reconciliation Contract

> v4.3 canonical contract. Covers `SideEffectRecord` / `ReconciliationRecord` / `CompensationRecord`.

## 1. Scope

Any externally visible write, tool submission, file modification, notification sent, transaction, API call, or irreversible action must first register a `SideEffectRecord` before entering the delivery, reconciliation, or compensation flow.

## 2. SideEffectRecord

Minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `sideEffectId` | `string` | Side effect ID |
| `harnessRunId` | `string` | Parent run |
| `nodeRunId` | `string` | Parent node run |
| `nodeAttemptId` | `string` | Parent attempt |
| `effectKind` | `file_write \| external_api \| message_send \| transaction \| tool_commit \| other` | Side effect category |
| `idempotencyKey` | `string` | External idempotency key |
| `status` | `SideEffectStatus` | Status |
| `riskClass` | `low \| medium \| high \| critical` | Risk |
| `approvalRef` | `string?` | Required approval |
| `preCommitPolicyProofRef` | `ArtifactRef` | Pre-commit policy proof |
| `externalRef` | `string?` | External system reference |
| `createdAt` | `timestamp` | Creation time |
| `updatedAt` | `timestamp` | Update time |

`SideEffectStatus`:

- `proposed`
- `reserved`
- `committing`
- `confirmed`
- `ambiguous`
- `reconciling`
- `compensating`
- `compensated`
- `failed`
- `revoked`
- `expired`

## 3. ReconciliationRecord

Minimum fields:

- `reconciliationId`
- `sideEffectId`
- `probeKind`
- `externalObservedState`
- `result` (`confirmed | not_found | ambiguous | failed`)
- `evidenceRefs`
- `nextAction` (`mark_confirmed | retry_probe | compensate | escalate_hitl | mark_failed`)
- `createdAt`

Rules:

- When external state is uncertain, must enter `ambiguous` / `reconciling`, must not feign success.
- Reconciliation worker can only advance side effect status through the state machine.

## 4. CompensationRecord

Minimum fields:

- `compensationId`
- `sideEffectId`
- `harnessRunId`
- `planRef`
- `status` (`planned | running | succeeded | failed | requires_human`)
- `evidenceRefs`
- `createdAt`
- `completedAt?`

Rules:

- Compensation is an append fact; must not delete or rewrite the original side effect.
- Side effects that cannot be compensated must be marked `requires_human` or enter incident.

## 5. Pre-Commit Re-validation

Before committing a side effect, must re-validate:

- Active lease and fencing token.
- Policy guard.
- Budget reservation is still valid.
- `HarnessDecision` and `HumanResponsibilityRecord` required for high / critical.
- `RunVersionLock` and tool / connector versions have not experienced unauthorized drift.

## 6. Legacy / Deprecated Mapping

| Old Name | v4.3 Semantics |
| --- | --- |
| Tool output side effect flag | Only serves as `SideEffectRecord` input |
| Compensation step | Must fall to `CompensationRecord` or compensation `PlanNode` |
| Best-effort delivery log | Only serves as evidence, not side effect truth |

## 7. Test Requirements

- Ambiguous external results must not be marked `confirmed`.
- Revoked / expired side effects must not commit.
- Pre-commit, if any of approval, budget, lease, or fencing becomes invalid, must reject.
- Compensation must not overwrite the original `SideEffectRecord`.


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-2: State machine pending→executing→reconciling→settled is 4-step linear; architecture §14.11 requires pending→claimed→executing→awaiting_confirmation→settled/compensating with branches. Fix: This semantics converges to v4.3 canonical contract; old fields, old states, old DTOs, or old terminology are only permitted as legacy/deprecated/projection/migration input, not as new implementation entry points.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR must only serve as `oapeflir.view.*` / rationale projections; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.