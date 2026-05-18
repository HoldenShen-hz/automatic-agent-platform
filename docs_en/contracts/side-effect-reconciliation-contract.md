# Side Effect Reconciliation Contract

> v4.3 canonical contract. Covers `SideEffectRecord` / `ReconciliationRecord` / `CompensationRecord`.

## 1. Scope

Any externally visible write, tool commit, file modification, notification send, transaction, API call, or irreversible action must first register `SideEffectRecord`, then enter delivery, reconciliation, or compensation process.

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

`SideEffectStatus` (16 states, R20-52 aligned):

- `proposed`
- `approved`
- `reserved`
- `committing`
- `committed`
- `confirming` (equivalent to `awaiting_confirmation`)
- `confirmed`
- `ambiguous`
- `reconciling`
- `manual_review_required`
- `compensation_required`
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

- When external state is uncertain, must enter `ambiguous` / `reconciling`, must not disguise as success.
- Reconciliation worker can only advance side effect state through state machine.

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

- Compensation is additive fact, does not delete or rewrite original side effect.
- Uncompensatable side effects must be marked `requires_human` or enter incident.

## 5. Pre-Commit Re-validation

Before side effect commit, must re-validate:

- Active lease and fencing token.
- Policy guard.
- Budget reservation still valid.
- Required `HarnessDecision` and `HumanResponsibilityRecord` for high / critical.
- `RunVersionLock` and tool / connector version have not drifted unauthorized.

## 6. Legacy / Deprecated Mapping

| Old Name | v4.3 Semantics |
| --- | --- |
| tool output side effect flag | Can only serve as `SideEffectRecord` input |
| compensation step | Must be landed as `CompensationRecord` or compensation `PlanNode` |
| best-effort delivery log | Only serves as evidence, not side effect truth |

## 7. Testing Requirements

- Ambiguous external results must not be marked `confirmed`.
- Revoked / expired side effects must not commit.
- Before commit, if approval, budget, lease, fencing any失效 must reject.
- Compensation must not overwrite original `SideEffectRecord`.


## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical paragraphs of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` shall prevail.

- T-2: State machine pending→executing→reconciling→settled 4-step linear, architecture §14.11 requires pending→claimed→executing→awaiting_confirmation→settled/compensating with branches. Fix: This semantics converges to v4.3 canonical contract; old fields, old states, old DTOs, or old terminology only allowed as legacy/deprecated/projection/migration input, must not serve as new implementation entry.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
