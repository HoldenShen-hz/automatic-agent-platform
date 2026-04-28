# v4.3 Node Run Attempt Receipt Contract

> v4.3 canonical contract. Covers `NodeRun` / `NodeAttempt` / `AttemptLineage` / `NodeAttemptReceipt`.

## 1. Scope

`NodeRun` is the executable instance of `PlanNode`; `NodeAttempt` represents a single attempt of retry/redrive; `NodeAttemptReceipt` is the structured receipt after worker, LLM, tool, HITL, or subgraph execution.

## 2. NodeRun Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `nodeRunId` | `string` | Node run ID |
| `harnessRunId` | `string` | Parent run |
| `planGraphBundleId` | `string` | Parent graph |
| `graphVersion` | `number` | Graph version |
| `nodeId` | `string` | PlanNode ID |
| `status` | `NodeRunStatus` | Node status |
| `attemptCount` | `number` | Attempt count |
| `leaseId` | `string?` | Active lease |
| `fencingToken` | `string?` | Fencing token |
| `currentSeq` | `number` | CAS version |
| `createdAt` | `timestamp` | Creation time |
| `updatedAt` | `timestamp` | Update time |
| `terminalReason` | `string?` | Terminal reason |

`NodeRunStatus`:

- `created`
- `blocked`
- `ready`
- `queued`
- `leased`
- `running`
- `retry_wait`
- `awaiting_hitl`
- `reconciling`
- `succeeded`
- `failed`
- `skipped`
- `cancelled`
- `dependency_failed`
- `policy_blocked`
- `aborted`

Terminal states: `succeeded`, `failed`, `skipped`, `cancelled`, `dependency_failed`, `policy_blocked`, `aborted`.

## 3. NodeAttempt / AttemptLineage

`NodeAttempt` minimum fields:

- `nodeAttemptId`
- `nodeRunId`
- `attemptNo`
- `attemptKind` (`initial | retry | redrive | recovery`)
- `startedAt`
- `completedAt?`
- `executorRef`
- `inputSnapshotRef`
- `receiptId?`

`AttemptLineage` minimum fields:

- `attemptLineageId`
- `nodeRunId`
- `previousAttemptId?`
- `nextAttemptId?`
- `reason`
- `createdBy`
- `createdAt`

Rules:

- Retries must not create new `NodeRun` unless `GraphPatch` explicitly appends new nodes.
- Each attempt must be replayable with input snapshot, version lock, and constraint bundle.
- Redrive must append lineage and must not overwrite old attempt.

## 4. NodeAttemptReceipt

Minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `receiptId` | `string` | Receipt ID |
| `nodeAttemptId` | `string` | Corresponding attempt |
| `nodeRunId` | `string` | Corresponding node run |
| `receiptKind` | `tool \| llm \| hitl \| subgraph \| evaluator \| router` | Receipt category |
| `status` | `succeeded \| failed \| partial \| blocked` | Attempt result |
| `outputRef` | `ArtifactRef?` | Output reference |
| `error` | `AppError?` | Failure reason |
| `sideEffectRefs` | `string[]` | Associated side effects |
| `budgetSettlementRefs` | `string[]` | Associated budget settlements |
| `evidenceRefs` | `ArtifactRef[]` | Evidence references |
| `producedAt` | `timestamp` | Production time |

## 5. Advancement Rules

- `NodeRun` status advancement only through `RuntimeStateMachine.transition(command)`.
- Worker writeback must validate lease and fencing token.
- `NodeAttemptReceipt` is append-only; must not update old receipt to express new result.
- `retry_wait` must have `wakeAt`, `retryPolicyRef`, `attemptId`, and backoff reason.

## 6. Legacy / Deprecated Mapping

| Old Name | v4.3 Semantics |
| --- | --- |
| `WorkflowStep` | Semantic step; expanded to `PlanNode` / `NodeRun` before execution |
| `ExecutionReceipt` | Deprecated alias; new receipts use `NodeAttemptReceipt` |
| `nodeAttemptReceiptId` | Deprecated storage-shaped key; canonical API field uses `receiptId` |
| `StepOutput` | May serve as projection or output artifact, not execution receipt authority |

## 7. Test Requirements

- Terminal states cannot transition out.
- Writeback with incorrect fencing token must be rejected.
- Retry only appends `NodeAttempt` and `AttemptLineage`, does not overwrite receipt.
- GraphPatch must not rewrite existing receipt semantics.


## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` shall prevail.

- T-46: This document originally wrote the receipt primary key as `nodeAttemptReceiptId`. Root cause: contract directly followed underlying storage naming habits and exposed table-shaped field names, without maintaining the canonical API shape of v4.3 executable contracts. Fix: The main text now converges the primary key to `receiptId`, and demotes `nodeAttemptReceiptId` to deprecated storage-shaped key.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR may only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
