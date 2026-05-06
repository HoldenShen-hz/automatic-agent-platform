# v4.3 Task Intake And Request Contract

> v4.3 canonical contract. Covers `TaskDraft` / `ConfirmedTaskSpec` / `RequestEnvelope`.

## 0. Type Definitions

| Type | Definition | Description |
| --- | --- | --- |
| `ConstraintPackRef` | `string` | Constraint pack reference, format `constraint_pack:${id}`, pointing to platform merged immutable constraint pack |
| `PrincipalRef` | `{ principalId: string; tenantId: string; roles: readonly string[] }` | Initiating principal reference |

## 1. Scope

This contract defines the sole intake chain before raw input enters HarnessRuntime:

```text
RawInput -> TaskDraft -> ClarificationSession -> ConfirmedTaskSpec -> RequestEnvelope
```

Natural language, Webhook, UI, CLI, timer triggers, or external events must not directly generate executable requests; only `ConfirmedTaskSpec` can generate `RequestEnvelope`.

## 2. TaskDraft

`TaskDraft` is pre-admission draft, only used for clarification, risk preview, preserving user intent, and forming confirmation materials, must not enter P4 execution.

Minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `taskDraftId` | `string` | Draft ID |
| `tenantId` | `string` | Tenant |
| `principal` | `PrincipalRef` | Initiating principal |
| `source` | `nl \| webhook \| ui \| cli \| scheduler \| external_event` | Input source |
| `rawInputRef` | `ArtifactRef?` | Raw input reference; large text must be artifactized |
| `domainId` | `string` | Normalized execution domain binding; legacy `divisionId/domainHint` only allowed after entry normalization lands as this field |
| `normalizedIntent` | `json` | Structured intent |
| `missingFields` | `string[]` | Fields still needing clarification |
| `riskPreview` | `RiskPreview` | Initial risk judgment |
| `ambiguityPolicy` | `safe_default \| require_confirmation \| reject` | Ambiguity handling strategy |
| `createdAt` | `timestamp` | Created at |
| `expiresAt` | `timestamp?` | Draft expiration |

Constraints:

- `TaskDraft` does not allocate worker, does not create `HarnessRun`, does not occupy execution budget.
- High / critical risk drafts must form explicit confirmation materials.
- After draft expires, must not reuse to generate `RequestEnvelope`; must reconfirm.
- Canonical draft must carry `domainId`; if entry still provides `divisionId`, `domainHint`, or historical domain alias, must normalize before intake admission.

## 3. ConfirmedTaskSpec

`ConfirmedTaskSpec` is the sole pre-object convertible to `RequestEnvelope`.

Minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `confirmedTaskSpecId` | `string` | Confirmed task spec ID |
| `taskDraftId` | `string` | Source draft |
| `tenantId` | `string` | Tenant |
| `principal` | `PrincipalRef` | Initiating principal |
| `domainId` | `string` | Canonical domain binding consistent with draft |
| `goal` | `string` | User-confirmed goal |
| `inputs` | `json` | Confirmed inputs |
| `constraints` | `ConstraintPackRef` | Task-level constraint pack |
| `riskClass` | `low \| medium \| high \| critical` | Risk level |
| `confirmationReceipt` | `UserConfirmationReceipt?` | Required for high / critical |
| `idempotencyKey` | `string` | Idempotency key |
| `traceId` | `string` | End-to-end trace |
| `createdAt` | `timestamp` | Created at |

Constraints:

- When `riskClass=high|critical`, `confirmationReceipt` must exist and not be expired.
- `idempotencyKey` must be stable under same tenant; duplicate submission returns same admission result.
- `constraints` must come from platform, tenant, domain, and task constraint merge immutable reference.
- `domainId` must follow admission-verified canonical binding; must not regress to legacy division identifier at `ConfirmedTaskSpec` stage.

## 4. RequestEnvelope

`RequestEnvelope` is the canonical request passed to P1/P2 HarnessRuntime admission.

Minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `requestId` | `string` | Request ID |
| `confirmedTaskSpecId` | `string` | Confirmed task spec |
| `tenantId` | `string` | Tenant |
| `principal` | `PrincipalRef` | Initiating principal |
| `domainId` | `string` | Canonical domain binding inherited from `ConfirmedTaskSpec` |
| `traceId` | `string` | Trace |
| `idempotencyKey` | `string` | Idempotency key |
| `priority` | `number` | Admission / scheduler priority; must enter canonical schema, not just exist in factory default value |
| `requestHash` | `string` | Admission idempotency check hash |
| `constraintPackRef` | `ConstraintPackRef` | Constraint pack |
| `budgetIntent` | `BudgetIntent` | Budget intent, not reservation |
| `policyContext` | `PolicyContext` | Policy context |
| `artifactRefs` | `ArtifactRef[]` | Input artifacts |
| `submittedAt` | `timestamp` | Submitted at |

Constraints:

- `RequestEnvelope` must not contain unconfirmed natural language original text as sole task definition.
- `budgetIntent` can only enter budget precheck; actual hold must go through `BudgetReservation`.
- After admission success, create `HarnessRun`; failure must record platform fact event and explainable rejection reason.
- `domainId` must be directly copied from `ConfirmedTaskSpec.domainId`; subsequent `HarnessRun`, risk overlay, knowledge boundary, and prompt library selection must not back-calculate from `divisionId`.

## 5. Legacy / Deprecated Mapping

| Old Name | v4.3 Semantics |
| --- | --- |
| `Task` | Query compatibility layer; new execution entry must first form `TaskDraft` or `ConfirmedTaskSpec` |
| `TaskSpec` | Without confirmation receipt, not equivalent to `ConfirmedTaskSpec` |
| `task.created` | legacy event; new fact events use `platform.harness_run.*` or intake-related `platform.*` |
| Raw prompt / raw text | Can only serve as `rawInputRef` or audit evidence, must not reach execution directly |

## 6. Testing Requirements

- High / critical risk without confirmation must reject generating `RequestEnvelope`.
- Same `idempotencyKey + requestHash` duplicate submission must not create multiple `HarnessRun`.
- `TaskDraft` must not be consumed by P4 dispatch.
- Old `/api/v1/tasks` compatibility entry must project to v4.3 intake chain.
