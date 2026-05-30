# v4.3 Side Effect Reconciliation Contract

> v4.3 canonical contract. Covers `SideEffectRecord` / `ReconciliationRecord` / `CompensationRecord`.

## 1. Scope

Any externally visible write, tool submission, file modification, notification send, transaction, API call, or irreversible action must first register a `SideEffectRecord` before entering delivery, reconciliation, or compensation flow.

## 2. SideEffectRecord

Minimum fields:

| Field | Type | Description |
|---|---|---|
| `sideEffectId` | `string` | Side effect ID |
| `harnessRunId` | `string` | Associated run |
| `nodeRunId` | `string` | Associated node run |
| `nodeAttemptId` | `string` | Associated attempt |
| `effectKind` | `file_write \| external_api \| message_send \| transaction \| tool_commit \| other` | Side effect category |
| `idempotencyKey` | `string` | External idempotency key |
| `status` | `SideEffectStatus` | Status |
| `riskClass` | `low \| medium \| high \| critical` | Risk class |
| `approvalRef` | `string?` | Required approval |
| `preCommitPolicyProofRef` | `ArtifactRef` | Pre-commit policy proof |
| `externalRef` | `string?` | External system reference |
| `createdAt` | `timestamp` | Creation time |
| `updatedAt` | `timestamp` | Last update time |

`SideEffectStatus` (16 states, v4.3 canonical):

- `proposed`
- `approved`
- `reserved`
- `committing`
- `committed`
- `confirming`
- `confirmed`
- `ambiguous`
- `manual_review_required`
- `reconciling`
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

- When external state is uncertain, must enter `ambiguous` / `reconciling`; must not fake success.
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

- Compensation is追加事实 (additive fact), does not delete or overwrite original side effect.
- Non-compensatable side effects must be marked `requires_human` or escalated to incident.

## 5. Pre-Commit Re-validation

Before committing a side effect, must re-validate:

- Active lease vs fencing token.
- Policy guard.
- Budget reservation is still valid.
- High / critical requires `HarnessDecision` and `HumanResponsibilityRecord`.
- `RunVersionLock` and tool / connector versions have not drifted unauthorized.

## 6. Legacy / Deprecated Mapping

| Old Name | v4.3 Semantics |
|---|---|
| tool output side effect flag | Can only be used as `SideEffectRecord` input |
| compensation step | Must be implemented as `CompensationRecord` or compensation `PlanNode` |
| best-effort delivery log | Only as evidence, not side effect truth |

## 7. Test Requirements

- Ambiguous external results must not be marked `confirmed`.
- Revoked / expired side effects must not commit.
- If any of approval, budget, lease, or fencing fails before commit, must reject.
- Compensation must not overwrite original `SideEffectRecord`.

## v4.3 Architecture Remediation

This section fixes contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If any historical section of this document conflicts with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-2: State machine pending→executing→reconciling→settled was 4-step linear; architecture §14.11 requires pending→claimed→executing→awaiting_confirmation→settled/compensating with branching. Fix: This semantics converges to v4.3 canonical contract; old fields, old states, old DTOs, or old terminology are only permitted as legacy/deprecated/projection/migration input and must not be used as new implementation entry points.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budget must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.