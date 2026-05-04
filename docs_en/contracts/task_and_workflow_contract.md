# Task And Workflow Contract

> **v4.3 Compatibility Note**: This file is preserved as historical task / workflow semantics. v4.3 new implementation entry points are based on [task-intake-request-contract.md](./task-intake-request-contract.md), [harness-run-contract.md](./harness-run-contract.md), [plan-graph-patch-contract.md](./plan-graph-patch-contract.md), and [node-run-attempt-receipt-contract.md](./node-run-attempt-receipt-contract.md); `WorkflowStep` / `StepOutput` only serve as legacy / projection semantics.

> **OAPEFLIR Related**: This contract defines OAPEFLIR main chain tasks and workflows, corresponding to ADR-016.
> **Last Updated**: 2026-04-17

## 1. Scope

This contract defines task, sub-task, workflow status, step output, artifact references, and runtime constraints that Phase 1a must stabilize.

For OAPEFLIR Phase 1-4 scope, this contract only defines how task/workflow read model projects closed-loop stages, loop iterations, and feedback objects; actual execution boundaries are held by `HarnessRun`, `PlanGraphBundle`, `NodeRun`, and `NodeAttemptReceipt`.

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
| `parent_id` | `string?` | Parent task ID, used when cross-division splitting |
| `root_id` | `string` | Root task ID |
| `division_id` | `string?` | Target division |
| `title` | `string` | Task title |
| `status` | `TaskStatus` | Task status |
| `source` | `user \| observe \| system` | Task source |
| `priority` | `low \| normal \| high \| urgent` | Priority |
| `input` | `json` | Raw input |
| `normalized_input` | `json?` | Normalized input |
| `output` | `json?` | Final output summary |
| `artifacts` | `ArtifactRef[]` | Artifact references |
| `estimated_cost_usd` | `number?` | Estimated cost |
| `actual_cost_usd` | `number` | Actual cost |
| `error_code` | `string?` | Failure reason code |
| `created_at` | `timestamp` | Created at |
| `updated_at` | `timestamp` | Updated at |
| `completed_at` | `timestamp?` | Completed at |

`TaskStatus` takes precedence from [runtime_state_machine_contract.md](./runtime_state_machine_contract.md).

## 4. Task Runtime Constraints

- `root_id` remains stable throughout entire task tree.
- Empty `parent_id` indicates root task; when non-empty must point to existing task.
- `division_id` can be empty before HQ triage, but must be determined before entering division execution.
- `actual_cost_usd` starts at `0`, only allows accumulate update.
- When entering terminal state must simultaneously write `completed_at` or failure terminal time.

## 5. WorkflowState Projection Fields

| Field | Type | Description |
| --- | --- | --- |
| `task_id` | `string` | Associated task |
| `division_id` | `string` | Division ownership |
| `workflow_id` | `string` | Workflow definition identifier |
| `harness_run_id` | `string` | Corresponding HarnessRun |
| `plan_graph_bundle_id` | `string?` | Current execution graph bundle |
| `graph_version` | `number?` | Current graph version |
| `current_step_index` | `number` | Current step index projection |
| `status` | `WorkflowStatus` | Workflow read model status |
| `current_stage_view` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release` | Current OAPEFLIR stage view |
| `loop_iteration_view` | `number` | Current closed-loop round view, starting from 1 |
| `outputs` | `Record<string, StepOutput>` | Step output mapping |
| `feedback_signals` | `string[]?` | Associated feedback signal ID list |
| `learning_objects` | `string[]?` | Associated learning object ID list |
| `improvement_candidates` | `string[]?` | Associated improvement candidate ID list |
| `release_records` | `string[]?` | Associated release record ID list |
| `last_error_code` | `string?` | Latest error code |
| `retry_count` | `number` | Current cumulative retry count |
| `started_at` | `timestamp` | Started at |
| `updated_at` | `timestamp` | Updated at |
| `resumable_from_step` | `string?` | Resumable step identifier |

Rules:

- `WorkflowState` is a read model derived from `HarnessRun`, `PlanGraphBundle`, `NodeRun`, and `NodeAttemptReceipt`, not runtime truth.
- If `status`, `current_stage_view`, `loop_iteration_view` conflict with truth, projection must be rebuilt, must not reverse-write execution main chain.

## 6. WorkflowStep Authoritative Fields

Each step contains at minimum:

- `step_id` (deprecated - retained for legacy compatibility)
- `node_id` (canonical - PlanNode ID that this step maps to)
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

- `step_id` is deprecated; new implementations should use `node_id` to reference `PlanNode`.
- `input_binding` must be resolvable to upstream output, task input, or system context.
- `output_key` is unique within same workflow.
- `approval_policy` only defines whether escalation is needed, does not carry channel interaction details.

## 6A. OAPEFLIR Workflow Additional Objects

`PlanGraphBundle` is the sole authoritative handover object from plan stage to execute stage, minimum fields:

- `planGraphBundleId`
- `harnessRunId`
- `graphVersion`
- `graph`
- `schedulerPolicy`
- `budget`
- `riskProfile`

`PlanDTO` is only allowed as legacy debug view or import input; must be normalized to `PlanGraphBundle` before execution.

`FeedbackSignal` is a first-class object in workflow, minimum fields:

- `signal_id`
- `kind` (`satisfaction | correction | quality_metric | failure_signal`)
- `sentiment` (`positive | neutral | negative`)
- `source` (`user | system | runtime`)
- `evidence_ref?`
- `recorded_at`

Rules:

- `current_stage_view` and `loop_iteration_view` are workflow projection fields, must not replace runtime truth.
- `FeedbackSignal` can be generated by execute post-collection, user correction, explanation chain, or approval write-back, but must link back to workflow.
- `PlanGraphBundle` is the authoritative handover object from plan stage to execute stage, cannot be replaced by `PlanDTO` or temporary prompt text.

## 7. StepOutput Authoritative Fields

| Field | Type | Description |
| --- | --- | --- |
| `node_run_id` | `string` | Canonical NodeRun ID (replaces deprecated step_id) |
| `step_id` | `string` | Deprecated - retained for legacy compatibility; use node_run_id instead |
| `role_id` | `string` | Execution role |
| `status` | `succeeded \| failed \| partial_success` | Step result |
| `data` | `json` | Main output data |
| `summary` | `string?` | Output summary |
| `artifacts` | `ArtifactRef[]?` | Attachment references |
| `token_cost` | `number` | Token cost |
| `duration_ms` | `number` | Duration |
| `validation` | `json?` | Schema validation result |
| `stage` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release?` | Stage output belongs to |
| `produced_at` | `timestamp` | Produced at |

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
- When artifact is deleted or migrated, must not destroy auditability of completed tasks.

## 9. TaskDependency

Phase 1a allows minimum dependency expression:

- `upstream_task_id`
- `downstream_task_id`
- `dependency_type`, values `hard | soft`
- `created_at`

Phase 1a only requires expressing cross-task wait relationships, does not require complete DAG query capability.

## 10. Behavioral Constraints

- Workflow input binding should be resolved at runtime, cannot rely on string substitution simulation.
- Output must be validated against schema before writing status.
- `partial_success` must be explicitly recorded, cannot be disguised as success.
- Task terminal state and workflow terminal state must remain consistent in recovery logic.
- Workflow's `current_stage_view` must be consistent with OAPEFLIR stage lifecycle in [runtime_state_machine_contract.md](./runtime_state_machine_contract.md).
- `feedback_signals / learning_objects / improvement_candidates / release_records` must at minimum be stably trackable in inspect and audit, cannot remain only in log text.

## 11. Failure Semantics

- Step failure first goes through limited retry.
- After retry limit exceeded, handed to workflow self-healing, escalation, or task failure handling.
- `cancelled` and `failed` must be distinguished.
- Failures caused by illegal input should be marked as non-retryable.

### 11.1 Step Dependency Cascading Failure

When workflow step has dependency relationship (referencing upstream `output_key` through `input_binding`), upstream step failure or skip triggers cascading handling:

| Upstream Step Status | Dependency Type | Downstream Step Handling |
| --- | --- | --- |
| `failed` | `hard` (default) | Downstream step marked as `skipped`, reason_code `upstream_dependency_failed` |
| `failed` | `soft` | Downstream step can still execute, missing input filled with `null` or default value |
| `skipped` | `hard` | Downstream step cascades `skipped` |
| `skipped` | `soft` | Downstream step can still execute |

Rules:

- Cascading `skipped` must propagate along DAG, must not have downstream steps stay indefinitely in `blocked` after intermediate step interruption.
- Cascading judgment should be completed before step scheduling, must not discover input unavailable when step actually starts executing.
- All cascaded skipped steps must record `StepOutput` (status=`skipped`), ensuring workflow output mapping is complete.
- If cascading causes all critical steps to be skipped, workflow should enter `failed`, must not enter `completed`.
- Step dependency cascading is consistent with static analysis rules in `workflow_static_analysis_and_compensation_contract.md` §6.

## 12. Supplementary Rules

- Conditional branch DSL supports at minimum: `equals`, `exists`, `not_exists`, `greater_than`, `all_of`, `any_of`.
- Sub-task aggregation output contains at minimum: `summary`, `successful_children`, `failed_children`, `artifacts`, `warnings`.
- Artifact lifecycle should bind task retention policy, GC must not execute before audit window.

Supplementary notes:

- Unified execution unit abstraction is governed by drill-down document `executable_unit_contract.md`.
- Unified result encapsulation is governed by drill-down document `result_envelope_contract.md`.
- Closed-loop stage and state transition are governed by drill-down document `runtime_state_machine_contract.md`.


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical paragraphs conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-22: This document originally wrote `PlanDTO` and `WorkflowState.current_stage` as authoritative handover/authoritative state of execution main chain. Root cause: early workflow contract tried to simultaneously carry orchestration truth and UI/cognitive view, causing plan handoff and stage view to mix in one object. Fix: This version converges authoritative handover to `PlanGraphBundle`, and explicitly demotes `WorkflowState.current_stage_view` to a projection field.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budget must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
