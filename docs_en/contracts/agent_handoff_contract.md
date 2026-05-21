# Agent Handoff And Delegation Contract

> v4.3 canonical contract. Covers `DelegationRequest` / `DelegationReceipt` / `ACPMessage` / `AgentHandoff`.

## 1. Scope

This contract defines the authoritative boundary for multi-Agent delegation, collaboration messages, and handoff payloads. It fills the missing exclusive contract between architecture §19, ADR-019, and current runtime implementation.

Related implementations:

- `src/platform/contracts/delegation-request/index.ts`
- `src/platform/five-plane-orchestration/agent-delegation/delegation-types.ts`
- `src/platform/five-plane-orchestration/agent-delegation/collaboration-protocol/types.ts`
- `src/platform/five-plane-orchestration/oapeflir/handoff-model.ts`
- `src/platform/five-plane-orchestration/oapeflir/handoff-serializer.ts`

## 2. DelegationRequest

Minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `requestId` | `string` | Delegation request ID |
| `taskId` | `string` | Task anchor in parent task or parent run context |
| `fromAgentId` | `string` | Parent agent |
| `toAgentId` | `string?` | Target agent; if empty, capability routing must be used |
| `capabilityRef` | `string?` | Capability target reference |
| `priority` | `low \| normal \| high \| critical` | Delegation priority |
| `reason` | `string` | Delegation reason |
| `contextRef` | `string?` | Context reference |
| `tenantId` | `string?` | Tenant |
| `createdAt` | `timestamp` | Creation time |

Rules:

- At least one of `toAgentId` or `capabilityRef` must exist.
- `DelegationRequest` only describes parent intent; it does not mean permissions are granted.
- New delegation must not directly copy all parent permissions; it must go through subset narrowing.

## 3. DelegationReceipt

`DelegationReceipt` aligns with current runtime `DelegationResult` / `DelegationHandle`.

Minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `delegationId` | `string` | Delegation ID |
| `parentAgentId` | `string` | Parent agent |
| `childAgentId` | `string` | Child agent |
| `depth` | `number` | Current delegation depth |
| `status` | `pending \| pending_approval \| discovery \| bid \| awarded \| active \| completed \| failed \| cancelled \| expired \| timed_out` | Delegation status |
| `correlationId` | `string` | Correlation chain |
| `createdAt` | `timestamp` | Creation time |
| `expiresAt` | `timestamp` | Expiration time |
| `summary` | `string` | Delegation summary |
| `artifactRefs` | `string[]` | Output references |
| `evidenceRefs` | `string[]` | Evidence references |
| `trustLevel` | `number` | Result trust score |
| `taintLabels` | `string[]` | Data contamination labels |
| `policyOutcome` | `string` | Permission/policy narrowing result |
| `dataClass` | `string` | Cross-delegation data classification |

Rules:

- `DelegationReceipt` is the authoritative receipt of the delegation primary chain; returning natural language results without `delegationId/status/evidenceRefs` is not allowed.
- `completed/failed/cancelled/expired/timed_out` are terminal states; to continue after terminal state, a new delegation must be created.

## 4. ACPMessage

Collaboration protocol message minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `messageId` | `string` | Message ID |
| `messageType` | `task_request \| task_offer \| task_accept \| task_reject \| partial_result \| escalation_request \| completion_report \| takeover_notice` | Message type |
| `correlationId` | `string` | Correlation chain |
| `parentRunId` | `string` | Parent run anchor |
| `delegationId` | `string` | Delegation ID |
| `childRunId` | `string` | Child run anchor |
| `capabilityIntersection` | `string[]` | Parent-child permission intersection |
| `budgetCap` | `number` | Child run budget cap |
| `dataBoundary` | `string` | Data boundary |
| `deadline` | `timestamp` | Deadline |
| `depth` | `number` | Current depth |
| `senderAgentId` | `string` | Sender |
| `receiverAgentId` | `string` | Receiver |
| `domainId` | `string` | Domain binding |
| `traceId` | `string` | Trace |
| `payload` | `json` | Message body |
| `timestamp` | `timestamp` | Send time |

Rules:

- The canonical run chain anchor for `ACPMessage` is `parentRunId / childRunId / delegationId`; reverting to `workflow_id`, `execution_id`, or other legacy run keys is not allowed.
- `completion_report` at least should carry `evidence`, `result_summary`, `artifacts`.
- `capabilityIntersection`, `budgetCap`, `dataBoundary`, `deadline` are mandatory fields; they must not only exist in comments.

## 5. AgentHandoff

`AgentHandoff` is the runtime handoff payload; current implementation uses three-layer objects and trims by token budget.

Minimum fields:

| Field | Type | Description |
| --- | --- | --- |
| `handoffId` | `string` | Handoff ID |
| `taskId` | `string` | Task anchor |
| `fromAgentId` | `string` | Sender |
| `toAgentId` | `string` | Receiver |
| `createdAt` | `timestamp` | Creation time |
| `fact.artifactRefs` | `string[]` | Fact layer artifact references |
| `fact.toolCallRecords` | `ToolCallRecord[]` | Tool call records |
| `state.currentPhase` | `string` | Current phase |
| `state.blockers` | `string[]` | Blockers |
| `state.remainingBudgetUsd` | `number?` | Remaining budget |
| `state.latestSummary` | `string` | Latest summary |
| `planDelta.addedSteps` | `string[]` | Added steps |
| `planDelta.removedSteps` | `string[]` | Removed steps |
| `planDelta.changedSteps` | `Array<{ stepId: string; reason: string }>` | Changed steps |
| `primaryRefs` | `string[]` | Primary reference set |

Rules:

- Current runtime canonical handoff uses `AgentHandoff` three-layer object; ADR-019's L4 full context still belongs to extension layer; it should not be pretended as runtime default payload in documentation.
- Fact back-linking of handoff should prioritize referencing `NodeAttemptReceipt`, artifacts, and tool call records, not bare `StepResult`.
- Serializer trim priority must maintain `planDelta -> state.summary/blockers -> fact.toolCallRecords -> fact.artifactRefs`.

## 6. Depth Governance (C1-C7)

Depth governance from `§19` is frozen as the following constraints in current contract:

- `C1 child_subset_of_parent`: Child delegation permissions must be a subset of parent permissions.
- `C2 bounded_depth`: `depth` must monotonically increase and be constrained by global depth limit.
- `C3 bounded_budget`: Each child run must explicitly declare `budgetCap`.
- `C4 bounded_time`: Each child run must explicitly declare `deadline` / `expiresAt`.
- `C5 bounded_data_boundary`: `dataBoundary` and `dataClass` must propagate with the chain.
- `C6 evidence_on_completion`: Completion receipt must include `evidenceRefs` or completion payload `evidence`.
- `C7 traceable_lineage`: `delegationId / correlationId / parentRunId / childRunId` must be able to string together the entire lineage.

## 7. Legacy / Deprecated Mapping

| Old Name | v4.3 Semantics |
| --- | --- |
| `StepResult` handoff input | Can only be used as compatibility builder input; canonical back-chain should converge to `NodeAttemptReceipt` / artifact / tool call record |
| `workflow_id` / `execution_id` | Legacy run keys; new delegation/collaboration message must use `harnessRunId/nodeRunId` or `parentRunId/childRunId` |
| Natural language prior summary | Can be used as `state.latestSummary` projection source, but cannot replace structured handoff / receipt |

## 8. Testing Requirements

- `DelegationRequest` must reject when target agent and capabilityRef are both missing.
- `ACPMessage` must reject messages missing `delegationId/childRunId/capabilityIntersection/budgetCap/dataBoundary/deadline`.
- Handoff serializer must trim `planDelta` first when budget is constrained, not fact layer first.
- Delegation completion receipt must be able to back-chain `delegationId -> evidenceRefs / artifactRefs -> childRunId`.