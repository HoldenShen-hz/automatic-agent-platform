# Task And Workflow Contract

> **v4.3 Compatibility Note**: This file is retained as historical task / workflow semantics documentation. v4.3 new implementation entry uses [task-intake-request-contract.md](./task-intake-request-contract.md), [harness-run-contract.md](./harness-run-contract.md), [plan-graph-patch-contract.md](./plan-graph-patch-contract.md), and [node-run-attempt-receipt-contract.md](./node-run-attempt-receipt-contract.md) as authoritative; `WorkflowStep` / `StepOutput` only serve as legacy / projection semantics.

> **OAPEFLIR Related**: This contract defines OAPEFLIR main chain tasks and workflows, corresponding to ADR-016.
> **Update Date**: 2026-04-17

## 1. Scope

This contract defines task, subtask, workflow state, step output, artifact references, and mapping constraints between legacy task/workflow read model and v4.3 canonical runtime.

For OAPEFLIR Phase 1-4 scope, this contract only defines how task/workflow read model projects closed-loop stages, loop iterations, and feedback objects; real execution boundaries are held by `HarnessRun`, `PlanGraphBundle`, `NodeRun`, and `NodeAttemptReceipt`.

Related documents:
- [ADR-016 OAPEFLIR Eight-Stage Model](../adr/016-oapeflir-loop-model.md)

## 2. Key Objects

- `Task`
- `WorkflowState`
- `WorkflowStep`
- `StepOutput`
- `ArtifactRef`
- `TaskDependency`
- `ExecutableUnit`
- `ResultEnvelope`

## 3. Task Authoritative Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Task unique identifier |
| `parent_id` | `string?` | Parent task ID, used when splitting across domains |
| `root_id` | `string` | Root task ID |
| `domain_id` | `string?` | Target execution domain; v4.3 canonical binding |
| `legacy_division_alias` | `string?` | Historical business alias; only for compatible display or import normalization |
| `title` | `string` | Task title |
| `status` | `TaskStatus` | Task status |
| `source` | `user \| observe \| system` | Task source |
| `priority` | `low \| normal \| high \| urgent` | Priority |
| `input` | `json` | Raw input |
| `normalized_input` | `json?` | Normalized input |
| `output` | `json?` | Final output summary |
| `artifacts` | `ArtifactRef[]` | Output artifact references |
| `estimated_cost_usd` | `number?` | Estimated cost |
| `actual_cost_usd` | `number` | Actual cost |
| `error_code` | `string?` | Failure reason code |
| `created_at` | `timestamp` | Created at |
| `updated_at` | `timestamp` | Updated at |
| `completed_at` | `timestamp?` | Completed at |

`TaskStatus` follows [runtime_state_machine_contract.md](./runtime_state_machine_contract.md).

## 4. Task Execution Constraints

- `root_id` remains stable throughout entire task tree.
- Empty `parent_id` indicates root task; when non-empty, must point to existing task.
- `domain_id` may be empty before intake normalization, but must be determined before entering execution main chain.
- `legacy_division_alias` must not replace `domain_id` for runtime truth association.
- `actual_cost_usd` starts at `0`, only allows additive updates.
- When entering terminal state, must synchronously write `completed_at` or failure terminal time.

## 5. WorkflowState Projection Fields

| Field | Type | Description |
| --- | --- | --- |
| `task_id` | `string` | Associated task |
| `domain_id` | `string` | Owning execution domain |
| `legacy_division_alias` | `string?` | Historical division / business alias projection |
| `workflow_id` | `string` | Workflow definition identifier |
| `harness_run_id` | `string` | Corresponding HarnessRun |
| `plan_graph_bundle_id` | `string?` | Current execution graph bundle |
| `graph_version` | `number?` | Current graph version |
| `current_step_index` | `number` | Current step index projection |
| `status` | `WorkflowStatus` | Workflow read model status |
| `current_stage_view` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release` | Current OAPEFLIR stage view |
| `loop_iteration_view` | `number` | Current closed-loop iteration view, starting from 1 |
| `outputs` | `Record<string, StepOutput>` | Step output mapping |
| `feedback_signals` | `string[]?` | Associated feedback signal ID list |
| `learning_objects` | `string[]?` | Associated learning object ID list |
| `improvement_candidates` | `string[]?` | Associated improvement candidate ID list |
| `release_records` | `string[]?` | Associated release record ID list |
| `last_error_code` | `string?` | Most recent error code |
| `retry_count` | `number` | Current cumulative retry count |
| `started_at` | `timestamp` | Start time |
| `updated_at` | `timestamp` | Updated at |
| `resumable_from_step` | `string?` | Resumable step identifier |

Rules:

- `WorkflowState` is a read model derived from `HarnessRun`, `PlanGraphBundle`, `NodeRun`, and `NodeAttemptReceipt`, not runtime truth.
- `domain_id` is the sole domain anchor between workflow projection and canonical runtime; if UI or old API still displays `division`, must explicitly map through `legacy_division_alias`.
- If `status`, `current_stage_view`, `loop_iteration_view` conflict with truth, must rebuild projection, must not reverse-write execution main chain.

## 6. WorkflowStep Authoritative Fields

Each step includes at minimum:

- `node_run_id` — canonical primary key (v4.3 uses NodeRun as execution unit)
- `step_id` — only as legacy projection alias
- `role_id`
- `input_binding`
- `output_key`
- `toolset?`
- `parallel?`
- `max_attempts?`
- `timeout_ms?`
- `precondition_check?`
- `approval_policy?`

Rules:

- `input_binding` must be resolvable to upstream output, task input, or system context.
- `output_key` is unique within same workflow.
- `approval_policy` only defines whether escalation is needed, does not carry channel interaction details.
- `node_run_id` is canonical primary key, `step_id` only as legacy projection for old system adaptation.

## 6A. OAPEFLIR Workflow Additional Objects

`PlanGraphBundle` is the sole authoritative handover object from plan stage to execute stage, minimum fields:

- `planGraphBundleId`
- `harnessRunId`
- `graphVersion`
- `graph`
- `schedulerPolicy`
- `budget`
- `riskProfile`

`PlanDTO` is only allowed as legacy debug view or import input; must normalize to `PlanGraphBundle` before execution.

`FeedbackSignal` is a first-class object in workflow, minimum fields:

- `signal_id`
- `kind` (`satisfaction | correction | quality_metric | failure_signal`)
- `sentiment` (`positive | neutral | negative`)
- `source` (`user | system | runtime`)
- `evidence_ref?`
- `recorded_at`

Rules:

- `current_stage_view` and `loop_iteration_view` are workflow projection fields, must not replace runtime truth.
- `FeedbackSignal` can be generated by post-execute collection, user correction, explanation chain, or approval writeback, but must trace back to workflow.
- `PlanGraphBundle` is the sole authoritative handover object from plan stage to execute stage; cannot use `PlanDTO` or temporary prompt text as substitute.

## 7. StepOutput Authoritative Fields

| Field | Type | Description |
| --- | --- | --- |
| `node_run_id` | `string` | Step ID (canonical primary key; v4.3 uses NodeRun as execution unit) |
| `step_id` | `string` | Only as legacy projection alias |
| `role_id` | `string` | Execution role |
| `status` | `succeeded \| failed \| partial_success` | Step result |
| `data` | `json` | Main output data |
| `summary` | `string?` | Output summary |
| `artifacts` | `ArtifactRef[]?` | Attachment references |
| `token_cost` | `number` | Token cost |
| `duration_ms` | `number` | Duration |
| `validation` | `json?` | Schema validation result |
| `stage` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release?` | Stage that produced output |
| `produced_at` | `timestamp` | Production time |

## 8. ArtifactRef Authoritative Fields

- `artifact_id`
- `kind`
- `uri`
- `mime_type?`
- `size_bytes?`
- `checksum?`
- `created_at`

Rules:

- Large text, files, images, and logs prioritize expression through artifact references.
- When artifacts are deleted or migrated, must not destroy auditability of completed tasks.

## 9. TaskDependency

Phase 1a allows minimum dependency expression:

- `upstream_task_id`
- `downstream_task_id`
- `dependency_type`, values `hard | soft`
- `created_at`

Phase 1a only requires expressing cross-task wait relationships, not complete DAG query capability.

## 10. Behavioral Constraints

- Workflow input bindings should be resolved at runtime, cannot rely on string replacement simulation.
- Output must pass schema validation before writing status.
- `partial_success` must be explicitly recorded, cannot be disguised as success.
- Task terminal state and workflow terminal state must remain consistent in recovery logic.
- Workflow's `current_stage_view` must be consistent with OAPEFLIR stage lifecycle projection in [runtime_state_machine_contract.md](./runtime_state_machine_contract.md).
- `feedback_signals / learning_objects / improvement_candidates / release_records` must at least be stably traceable in inspect and audit, not just left in log text.

## 11. Failure Semantics

- Step failures first go through limited retry.
- After retry limit exceeded, hand to workflow self-healing, escalation, or task failure handling.
- `cancelled` and `failed` must be distinguished.
- Failures caused by illegal input should be marked non-retryable.

### 11.1 Step Dependency Cascading Failure

When workflow steps have dependencies (upstream `output_key` referenced by downstream `input_binding`), upstream step failure or skip triggers cascading handling:

| Upstream Step Status | Dependency Type | Downstream Step Handling |
| --- | --- | --- |
| `failed` | `hard` (default) | Downstream step marked `skipped`, reason_code `upstream_dependency_failed` |
| `failed` | `soft` | Downstream step can still execute, missing input filled with `null` or default value |
| `skipped` | `hard` | Downstream step cascades `skipped` |
| `skipped` | `soft` | Downstream step can still execute |

Rules:

- Cascading `skipped` must propagate along DAG, must not stop at intermediate step and leave more downstream steps indefinitely in `blocked`.
- Cascading determination should complete before step scheduling, must not discover input unavailable when step actually starts executing.
- All cascaded-skipped steps must record `StepOutput` (status=`skipped`), ensuring workflow output mapping completeness.
- If cascading causes all critical steps to be skipped, workflow should enter `failed`, must not enter `completed`.
- Step dependency cascading is consistent with static analysis rules in `workflow_static_analysis_and_compensation_contract.md` §6.

## 12. Supplementary Rules

- Conditional branch DSL supports at minimum: `equals`, `exists`, `not_exists`, `greater_than`, `all_of`, `any_of`.
- Subtask aggregate output includes at minimum: `summary`, `successful_children`, `failed_children`, `artifacts`, `warnings`.
- Artifact lifecycle should bind task retention policy; GC must not execute before audit window.

Supplementary notes:

- Unified execution unit abstraction is governed by drill-down document `executable_unit_contract.md`.
- Unified result encapsulation is governed by drill-down document `result_envelope_contract.md`.
- Closed-loop stages and state transitions are governed by drill-down document `runtime_state_machine_contract.md`.


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical sections conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-22: This document originally wrote `PlanDTO` and `WorkflowState.current_stage` as authoritative handover/authoritative state of execution main chain. The root cause was early workflow contract tried to simultaneously carry orchestration truth and UI/cognitive view, causing plan hand-off and stage view to mix in one object. Fix: The main text now converges authoritative handover to `PlanGraphBundle`, and explicitly demotes `WorkflowState.current_stage_view` to projection field.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR may only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
