# v4.3 Side Effect Reconciliation Contract

> v4.3 canonical contract. Covers `SideEffectRecord` / `ReconciliationRecord` / `CompensationRecord`.

## 1. Scope

Any externally visible write, tool commit, file modification, notification sent, transaction, API call, or irreversible action must first register `SideEffectRecord`, then enter delivery, reconciliation, or compensation flow.

## 2. SideEffectRecord

Minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `sideEffectId` | `string` | Side effect ID |
| `harnessRunId` | `string` | Associated run |
| `nodeRunId` | `string` | Associated node run |
| `nodeAttemptId` | `string` | Associated attempt |
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

- When external state is uncertain, must enter `ambiguous` / `reconciling`, must not pretend to be successful.
- Reconciliation worker can only advance side effect status through state machine.

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

- Compensation is appended fact, does not delete or overwrite original side effect.
- Uncompensatable side effects must be marked `requires_human` or enter incident.

## 5. Pre-Commit Re-validation

Before side effect commit, must re-validate:

- Active lease and fencing token.
- Policy guard.
- Budget reservation still valid.
- Required `HarnessDecision` and `HumanResponsibilityRecord` for high / critical.
- `RunVersionLock` and tool / connector versions have not drifted unauthorized.

## 6. Legacy / Deprecated Mapping

| Old Name | v4.3 Semantics |
| --- | --- |
| tool output side effect flag | Can only be used as `SideEffectRecord` input |
| compensation step | Must be implemented as `CompensationRecord` or compensation `PlanNode` |
| best-effort delivery log | Can only be used as evidence, not side effect truth |

## 7. Testing Requirements

- Ambiguous external results must not be marked `confirmed`.
- Revoked / expired side effects must not commit.
- If any of approval, budget, lease, or fencing becomes invalid before commit, must reject.
- Compensation must not overwrite original `SideEffectRecord`.
