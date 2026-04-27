# v4.3 Task Intake And Request Contract

> v4.3 canonical contract. Covers `TaskDraft` / `ConfirmedTaskSpec` / `RequestEnvelope`.

## 1. Scope

This contract defines the sole intake chain before raw input enters HarnessRuntime:

```
RawInput -> TaskDraft -> ClarificationSession -> ConfirmedTaskSpec -> RequestEnvelope
```

Natural language, Webhook, UI, CLI, scheduled triggers, or external events must not directly generate executable requests; only `ConfirmedTaskSpec` can generate `RequestEnvelope`.

## 2. TaskDraft

`TaskDraft` is a pre-admission draft, used only for clarification, risk preview, preserving user intent, and forming confirmation materials. It must not enter P4 execution.

Minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `taskDraftId` | `string` | Draft ID |
| `tenantId` | `string` | Tenant |
| `principal` | `PrincipalRef` | Originating principal |
| `source` | `nl \| webhook \| ui \| cli \| scheduler \| external_event` | Input source |
| `rawInputRef` | `ArtifactRef?` | Raw input reference; large text must be artifactized |
| `normalizedIntent` | `json` | Structured intent |
| `missingFields` | `string[]` | Fields still needing clarification |
| `riskPreview` | `RiskPreview` | Initial risk assessment |
| `ambiguityPolicy` | `safe_default \| require_confirmation \| reject` | Ambiguity handling policy |
| `createdAt` | `timestamp` | Creation time |
| `expiresAt` | `timestamp?` | Draft expiration time |

Constraints:

- `TaskDraft` does not allocate worker, does not create `HarnessRun`, and does not occupy execution budget.
- High / critical risk drafts must form explicit confirmation materials.
- Expired drafts cannot be reused to generate `RequestEnvelope`; must be reconfirmed.

## 3. ConfirmedTaskSpec

`ConfirmedTaskSpec` is the sole object that can be converted to `RequestEnvelope`.

Minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `confirmedTaskSpecId` | `string` | Confirmed task spec ID |
| `taskDraftId` | `string` | Source draft |
| `tenantId` | `string` | Tenant |
| `principal` | `PrincipalRef` | Originating principal |
| `goal` | `string` | User-confirmed goal |
| `inputs` | `json` | Confirmed inputs |
| `constraints` | `ConstraintPackRef` | Task-level constraint pack |
| `riskClass` | `low \| medium \| high \| critical` | Risk class |
| `confirmationReceipt` | `UserConfirmationReceipt?` | Required for high / critical |
| `idempotencyKey` | `string` | Idempotency key |
| `traceId` | `string` | End-to-end trace |
| `createdAt` | `timestamp` | Creation time |

Constraints:

- When `riskClass=high|critical`, `confirmationReceipt` must exist and not be expired.
- `idempotencyKey` must be stable within the same tenant; repeated submissions return the same admission result.
- `constraints` must come from an immutable reference after merging platform, tenant, domain, and task constraints.

## 4. RequestEnvelope

`RequestEnvelope` is the canonical request passed from P1/P2 to HarnessRuntime admission.

Minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `requestId` | `string` | Request ID |
| `confirmedTaskSpecId` | `string` | Confirmed task spec |
| `tenantId` | `string` | Tenant |
| `principal` | `PrincipalRef` | Originating principal |
| `traceId` | `string` | Trace |
| `idempotencyKey` | `string` | Idempotency key |
| `requestHash` | `string` | Admission idempotency check hash |
| `constraintPackRef` | `ConstraintPackRef` | Constraint pack |
| `budgetIntent` | `BudgetIntent` | Budget intent, not reservation |
| `policyContext` | `PolicyContext` | Policy context |
| `artifactRefs` | `ArtifactRef[]` | Input artifacts |
| `submittedAt` | `timestamp` | Submission time |

Constraints:

- `RequestEnvelope` must not contain unconfirmed natural language original text as the sole task definition.
- `budgetIntent` can only enter budget pre-check; actual hold must go through `BudgetReservation`.
- After admission success, create `HarnessRun`; on failure, must record platform fact event and explainable rejection reason.

## 5. Legacy / Deprecated Mapping

| Old Name | v4.3 Semantics |
| --- | --- |
| `Task` | Query compatibility layer; new execution entry must first form `TaskDraft` or `ConfirmedTaskSpec` |
| `TaskSpec` | Without confirmation receipt, not equivalent to `ConfirmedTaskSpec` |
| `task.created` | Legacy event; new fact events use `platform.harness_run.*` or intake-related `platform.*` |
| Raw prompt / raw text | Can only be `rawInputRef` or audit evidence, must not reach execution directly |

## 6. Testing Requirements

- Reject generation of `RequestEnvelope` when high / critical risk has no confirmation.
- Repeated submission with same `idempotencyKey + requestHash` must not create multiple `HarnessRun`.
- `TaskDraft` must not be consumed by P4 dispatch.
- Legacy `/api/v1/tasks` compatibility entry must project to v4.3 intake chain.
