# v4.3 Node Run Attempt Receipt Contract

> v4.3 canonical contract. Covers `NodeRun` / `NodeAttempt` / `AttemptLineage` / `NodeAttemptReceipt`.

## 1. Scope

`NodeRun` is the executable instance of `PlanNode`; `NodeAttempt` expresses a single attempt of retry / redrive; `NodeAttemptReceipt` is the structured receipt after execution by worker, LLM, tool, HITL, or subgraph.

## 2. NodeRun Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `nodeRunId` | `string` | Node run ID |
| `harnessRunId` | `string` | Associated run |
| `planGraphBundleId` | `string` | Associated graph |
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

- Retry must not create new `NodeRun` unless `GraphPatch` explicitly appends new node.
- Each attempt must be replayable with input snapshot, version lock, and constraint pack.
- Redrive must append lineage, must not overwrite old attempt.

## 4. NodeAttemptReceipt

Minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `nodeAttemptReceiptId` | `string` | Receipt ID |
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
| `ExecutionReceipt` | Deprecated alias; new receipt uses `NodeAttemptReceipt` |
| `StepOutput` | Can be used as projection or output artifact, not authoritative execution receipt |

## 7. Testing Requirements

- Terminal states cannot transition out.
- Writeback with wrong fencing token must reject.
- Retry only appends `NodeAttempt` and `AttemptLineage`, does not overwrite receipt.
- GraphPatch must not rewrite existing receipt semantics.
