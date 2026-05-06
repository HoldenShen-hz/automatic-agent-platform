# Agent Handoff And Delegation Contract

> v4.3 canonical contract. Covers `DelegationRequest` / `DelegationReceipt` / `ACPMessage` / `AgentHandoff`.

## 1. Scope

This contract defines the authoritative boundaries for multi-agent delegation, collaboration messages, and handoff payloads. It fills the missing dedicated contract between architecture §19, ADR-019, and the current runtime implementation.

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

- Either `toAgentId` or `capabilityRef` must be present
- `DelegationRequest` only describes parent intent, does not indicate permissions have been granted
- New delegation must not directly copy all parent permissions; must go through subset narrowing

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
| `taintLabels` | `string[]` | Data taint labels |
| `policyOutcome` | `string` | Permission/policy narrowing result |
| `dataClass` | `string` | Cross-delegation data classification |

Rules:

- `DelegationReceipt` is the authoritative receipt for the delegation main chain; must not return natural language results missing `delegationId/status/evidenceRefs`
- `completed/failed/cancelled/expired/timed_out` are terminal states; if continuation is needed after terminal state, a new delegation must be created

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
| `capabilityIntersection` | `string[]` | Parent-child capability intersection |
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

- `ACPMessage`'s canonical run chain anchors are `parentRunId / childRunId / delegationId`; must not fall back to `workflow_id`, `execution_id`, or other legacy run keys
- `completion_report` must carry at least `evidence`, `result_summary`, `artifacts`
- `capabilityIntersection`, `budgetCap`, `dataBoundary`, `deadline` are mandatory fields and must not only exist in comments

## 5. AgentHandoff

`AgentHandoff` is the runtime handoff payload; current implementation uses three-layer objects and is trimmed by token budget.

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

- Current runtime canonical handoff uses `AgentHandoff` three-layer objects; ADR-019's L4 full context still belongs to the extension layer and must not be pretended to have become the runtime default payload in documentation
- Handoff fact chain should preferentially reference `NodeAttemptReceipt`, artifacts, and tool call records, rather than bare `StepResult`
- Serializer's trimming priority must maintain `planDelta -> state.summary/blockers -> fact.toolCallRecords -> fact.artifactRefs`

## 6. Depth Governance (C1-C7)

§19's depth governance is frozen as the following constraints in this contract:

- `C1 child_subset_of_parent`: Child delegation permissions must be a subset of parent permissions
- `C2 bounded_depth`: `depth` must be monotonically increasing and constrained by global depth limit
- `C3 bounded_budget`: Each child run must explicitly declare `budgetCap`
- `C4 bounded_time`: Each child run must explicitly declare `deadline` / `expiresAt`
- `C5 bounded_data_boundary`: `dataBoundary` and `dataClass` must propagate along the chain
- `C6 evidence_on_completion`: Completion receipt must include `evidenceRefs` or completion payload `evidence`
- `C7 traceable_lineage`: `delegationId / correlationId / parentRunId / childRunId` must be able to trace the entire lineage

## 7. Legacy / Deprecated Mapping

| Old Name | v4.3 Semantics |
| --- | --- |
| `StepResult` handoff input | Can only be used as compatibility builder input; canonical chain should converge to `NodeAttemptReceipt` / artifact / tool call record |
| `workflow_id` / `execution_id` | Legacy run keys; new delegation/collaboration messages must use `harnessRunId/nodeRunId` or `parentRunId/childRunId` |
| Natural language prior summary | Can be used as projection source for `state.latestSummary`, but must not replace structured handoff/receipt |

## 8. Testing Requirements

- `DelegationRequest` must reject when target agent and capabilityRef are both missing
- `ACPMessage` must reject messages missing `delegationId/childRunId/capabilityIntersection/budgetCap/dataBoundary/deadline`
- Handoff serializer must trim `planDelta` first when budget is constrained, not discard the fact layer first
- Delegation completion receipt must be able to chain back `delegationId -> evidenceRefs / artifactRefs -> childRunId`
