# Workflow Debugger Contract

## 1. Scope

This contract defines execution flow debugging, breakpoint APIs, and run comparison for `§65`. Debug targets are HarnessRun, NodeRun, and PlanGraphBundle.

Related documents:
- `runtime_state_machine_contract.md`
- `node-run-attempt-receipt-contract.md`
- `typed_event_bus_contract.md`

## 2. Canonical Objects

- `WorkflowTraceFrame` — runtime trace frame
- `BreakpointDefinition` — breakpoint definition
- `BreakpointHit` — breakpoint hit record
- `RunComparisonReport` — run comparison report
- `HarnessRunSnapshot` — HarnessRun moment snapshot
- `NodeRunTrace` — NodeRun execution trace
- `PlanGraphDiff` — plan graph difference

## 3. `BreakpointDefinition` Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `breakpoint_id` | `string` | Breakpoint unique identifier |
| `harness_run_id` | `string` | Associated HarnessRun (breakpoint anchor root) |
| `node_run_id?` | `string?` | Associated NodeRun (optional, node-specific) |
| `node_selector` | `string?` | PlanGraph node selector (for cross-NodeRun batch breakpoints) |
| `condition` | `string?` | Condition expression, triggers when satisfied |
| `action` | `pause \| snapshot \| compare` | Trigger action |
| `created_at` | `timestamp` | Creation time |
| `created_by` | `string?` | Creator |

Rules:
- `harness_run_id` is the authoritative breakpoint anchor and must not be empty.
- `node_run_id` is for precise breakpoints; `node_selector` is for batch breakpoints. They are mutually exclusive.
- Breakpoints must be associated with specific NodeRun states; old workflow/step terminology is prohibited.

## 4. `WorkflowTraceFrame` Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `frame_id` | `string` | Frame unique identifier |
| `harness_run_id` | `string` | Associated HarnessRun |
| `node_run_id?` | `string?` | Associated NodeRun |
| `plan_graph_id?` | `string?` | Associated PlanGraph |
| `stage` | `string` | OAPEFLIR stage |
| `loop_iteration` | `number` | Loop iteration number |
| `status` | `string` | Status at trigger time |
| `input_snapshot` | `json` | Input snapshot at trigger time |
| `output_snapshot` | `json?` | Output snapshot at trigger time (if executed) |
| `timestamp` | `timestamp` | Frame timestamp |
| `trace_id` | `string?` | Trace ID |

## 5. `HarnessRunSnapshot` Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `harness_run_id` | `string` | HarnessRun identifier |
| `plan_graph_bundle_id` | `string` | PlanGraphBundle identifier |
| `status` | `HarnessRunStatus` | Current status |
| `current_stage` | `string` | Current OAPEFLIR stage |
| `loop_iteration` | `number` | Current loop iteration |
| `node_runs` | `NodeRunTrace[]` | Node run traces |
| `budget_spent_usd` | `number?` | Budget spent |
| `created_at` | `timestamp` | Creation time |
| `completed_at` | `timestamp?` | Completion time (if ended) |

## 6. `NodeRunTrace` Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `node_run_id` | `string` | NodeRun identifier |
| `node_id` | `string` | PlanGraph node ID |
| `status` | `NodeRunStatus` | Node status |
| `attempt_count` | `number` | Attempt count |
| `receipt_id?` | `string?` | NodeAttemptReceipt ID (if any) |
| `started_at` | `timestamp` | Start time |
| `completed_at` | `timestamp?` | Completion time |
| `error?` | `string?` | Error message (if failed) |

## 7. `PlanGraphDiff` Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `diff_id` | `string` | Diff unique identifier |
| `base_harness_run_id` | `string` | Base HarnessRun for comparison |
| `target_harness_run_id` | `string` | Target HarnessRun for comparison |
| `added_nodes` | `string[]` | Added node ID list |
| `removed_nodes` | `string[]` | Removed node ID list |
| `modified_nodes` | `{ nodeId: string; field: string; old: unknown; new: unknown }[]` | Modified fields |
| `added_edges` | `string[]` | Added edge ID list |
| `removed_edges` | `string[]` | Removed edge ID list |
| `graph_version_delta` | `string` | Graph version delta (e.g., "v1->v2") |

## 8. Rules

- Debugging actions must not change the authoritative factual records of business output.
- Comparison reports must be based on replayable evidence (NodeAttemptReceipt + PlanGraphBundle), not UI temporary state.
- Production debugging must be subject to approval and permission control.
- Breakpoint hits must generate `BreakpointHit` records containing `harness_run_id`, `node_run_id`, `timestamp`, `triggered_by`.
- Time-travel debugging must be based on `NodeAttemptReceipt` replay, not direct side effect replay.
- `HarnessRunSnapshot` is for full state backtracking; `WorkflowTraceFrame` is for single-point time series analysis.

## v4.3 Contract Remediation

- T-69: This document originally bound breakpoint anchors to `workflow_id / step_selector`. The root cause was that the debugger contract was built on the old workflow debugger prototype and did not switch to `HarnessRun / NodeRun` debugging semantics. Fix: The main text now uses `harness_run_id / node_run_id / node_selector` as the authoritative anchor, adds `HarnessRunSnapshot`, `NodeRunTrace`, `PlanGraphDiff` complete models, and deprecates old workflow terminology, which is only allowed in projection views.
- R2-61 Fix: The entire document migrated from workflow/step semantics to HarnessRun/NodeRun/PlanGraph semantics; added `HarnessRunSnapshot` for full state backtracking; added `PlanGraphDiff` for plan graph comparison.

## 9. Test Requirements

- unit: breakpoint matching, trace frame normalization, graph diff
- integration: runtime trace -> debugger -> replay/compare
- contract: unauthorized users must not set production breakpoints; breakpoints must not change authoritative state