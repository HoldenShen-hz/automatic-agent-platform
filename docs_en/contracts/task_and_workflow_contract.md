# Task And Workflow Contract

> **v4.3 Compatibility Note**: This file is preserved as historical task / workflow semantics documentation. v4.3 new implementation entry points are [task-intake-request-contract.md](./task-intake-request-contract.md), [harness-run-contract.md](./harness-run-contract.md), [plan-graph-patch-contract.md](./plan-graph-patch-contract.md) and [node-run-attempt-receipt-contract.md](./node-run-attempt-receipt-contract.md); `WorkflowStep` / `StepOutput` only serve as legacy / projection semantics.

> **OAPEFLIR Association**: This contract defines OAPEFLIR main-chain tasks and workflows, corresponding to ADR-016.
> **Updated**: 2026-04-17

## 1. Scope

This contract defines tasks, subtasks, workflow status, step outputs, artifact references, and Phase 1a runtime constraints that need to be stabilized.

For OAPEFLIR Phase 1-4 scope, this contract only defines how task/workflow read models project closed-loop stages, loop iterations, and feedback objects; the actual execution boundaries are held by `HarnessRun`, `PlanGraphBundle`, `NodeRun` and `NodeAttemptReceipt`.

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
| `parent_id` | `string?` | Parent task ID, used when splitting across divisions |
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
| `created_at` | `timestamp` | Creation time |
| `updated_at` | `timestamp` | Update time |
| `completed_at` | `timestamp?` | Completion time |

`TaskStatus` follows [runtime_state_machine_contract.md](./runtime_state_machine_contract.md).

## 4. Task Runtime Constraints

- `root_id` remains stable throughout the entire task tree.
- Empty `parent_id` indicates root task; when non-empty, must point to an existing task.
- `division_id` can be empty before HQ triage, but must be determined before entering division execution.
- `actual_cost_usd` starts at `0` and only allows cumulative updates.
- When entering terminal state, `completed_at` or failure termination time must be written synchronously.

## 5. WorkflowState Projection Fields

| Field | Type | Description |
| --- | --- | --- |
| `task_id` | `string` | Associated task |
| `division_id` | `string` | Owning division |
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
| `updated_at` | `timestamp` | Update time |
| `resumable_from_step` | `string?` | Resumable step identifier |

Rules:

- `WorkflowState` is a read model derived from `HarnessRun`, `PlanGraphBundle`, `NodeRun` and `NodeAttemptReceipt`, not runtime truth.
- If `status`, `current_stage_view`, `loop_iteration_view` conflict with truth, projections must be rebuilt and must not rewrite the execution main chain in reverse.

## 6. WorkflowStep Authoritative Fields

Each step contains at minimum:

- `node_run_id`
- `harness_run_id`
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

- `node_run_id` is the unique primary key of the step, associated with `NodeRun` truth.
- `input_binding` must be resolvable to upstream output, task input, or system context.
- `output_key` is unique within the same workflow.
- `approval_policy` only defines whether escalation is needed and does not carry channel interaction details.

## 6A. OAPEFLIR Workflow Additional Objects

`PlanGraphBundle` is the unique authoritative handover object from plan phase to execute phase, minimum fields:

- `planGraphBundleId`
- `harnessRunId`
- `graphVersion`
- `graph`
- `schedulerPolicy`
- `budget`
- `riskProfile`

`PlanDTO` is only allowed as a legacy debug view or import input; before execution, it must be normalized to `PlanGraphBundle`.

`FeedbackSignal` is a first-class object in workflow, minimum fields:

- `signal_id`
- `kind` (`satisfaction | correction | quality_metric | failure_signal`)
- `sentiment` (`positive | neutral | negative`)
- `source` (`user | system | runtime`)
- `evidence_ref?`
- `recorded_at`

Rules:

- `current_stage_view` and `loop_iteration_view` are workflow projection fields and must not replace runtime truth.
- `FeedbackSignal` can be collected by execute post-processing, user correction, explanation chain, or approval writeback, but must be traceable back to workflow.
- `PlanGraphBundle` is the authoritative handover object from plan phase to execute phase and cannot be replaced by `PlanDTO` or temporary prompt text.

## 7. StepOutput Authoritative Fields

| Field | Type | Description |
| --- | --- | --- |
| `node_run_id` | `string` | Associated NodeRun ID |
| `harness_run_id` | `string` | Associated HarnessRun ID |
| `attempt_id` | `string` | Associated NodeAttempt ID |
| `role_id` | `string` | Execution role |
| `status` | `succeeded \| failed \| partial_success \| skipped` | Step result |
| `data` | `json` | Main output data |
| `summary` | `string?` | Output summary |
| `artifacts` | `ArtifactRef[]?` | Attachment references |
| `token_cost` | `number` | Token cost |
| `duration_ms` | `number` | Duration |
| `validation` | `json?` | Schema validation result |
| `stage` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release?` | Output stage |
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

- Large text, files, images, and logs are preferably expressed through artifact references.
- When artifacts are deleted or migrated, the auditability of completed tasks must not be destroyed.

## 9. TaskDependency

Phase 1a allows minimal dependency expression:

- `upstream_task_id`
- `downstream_task_id`
- `dependency_type`, values `hard | soft`
- `created_at`

Phase 1a only requires expressing cross-task wait relationships, not complete DAG query capability.

## 10. Behavioral Constraints

- Workflow input bindings should be resolved at runtime and cannot be simulated by string replacement.
- Output must be validated against schema before writing status.
- `partial_success` must be explicitly recorded and cannot be伪装成 success.
- Task terminal state and workflow terminal state must remain consistent in recovery logic.
- Workflow's `current_stage_view` must be consistent with OAPEFLIR stage lifecycle projection in [runtime_state_machine_contract.md](./runtime_state_machine_contract.md).
- `feedback_signals / learning_objects / improvement_candidates / release_records` must be stably traceable in inspect and audit at minimum, and must not remain only in log text.

## 11. Failure Semantics

- Step failure first goes through limited retry.
- After retry limit exceeded, handover to workflow self-healing, escalation, or task failure handling.
- `cancelled` and `failed` must be distinguished.
- Failures caused by illegal input should be marked as non-retryable.

### 11.1 Step Dependency Cascading Failure

When workflow steps have dependency relationships (upstream `output_key` referenced via `input_binding`), upstream step failure or skip triggers cascading handling:

| Upstream Step Status | Dependency Type | Downstream Step Handling |
| --- | --- | --- |
| `failed` | `hard` (default) | Downstream step marked as `skipped`, reason_code `upstream_dependency_failed` |
| `failed` | `soft` | Downstream step can still execute, missing input filled with `null` or default value |
| `skipped` | `hard` | Downstream step cascaded `skipped` |
| `skipped` | `soft` | Downstream step can still execute |

Rules:

- Cascaded `skipped` must propagate along the DAG and must not leave downstream steps indefinitely in `blocked` after intermediate steps are interrupted.
- Cascading determination should be completed before step scheduling, not discovered when step actually starts executing and input is unavailable.
- All cascaded-skipped steps must record `StepOutput` (status=`skipped`) to ensure workflow output mapping completeness.
- If cascading causes all critical steps to be skipped, workflow should enter `failed`, not `completed`.
- Step dependency cascading remains consistent with static analysis rules in `workflow_static_analysis_and_compensation_contract.md` §6.

## 12. Supplementary Rules

- Conditional branch DSL supports at minimum: `equals`, `exists`, `not_exists`, `greater_than`, `all_of`, `any_of`.
- Subtask aggregated output includes at minimum: `summary`, `successful_children`, `failed_children`, `artifacts`, `warnings`.
- Artifact lifecycle should be bound to task retention policy; GC must not execute before audit window.

Supplementary notes:

- Unified execution unit abstraction follows `executable_unit_contract.md`.
- Unified result envelope follows `result_envelope_contract.md`.
- Closed-loop stages and state transitions follow `runtime_state_machine_contract.md`.


## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical paragraphs in this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-22: This document previously wrote `PlanDTO` and `WorkflowState.current_stage` as the authoritative handover/authoritative state of the execution main chain. Root cause: Early workflow contract tried to simultaneously carry orchestration truth and UI/cognitive view, causing plan handoff and stage view to be mixed in one object. Fix: The main text now converges authoritative handover to `PlanGraphBundle`, and explicitly demotes `WorkflowState.current_stage_view` to a projection field.
- T-18: Original `WorkflowStep` / `StepOutput` used `step_id` as the semantic primary key (legacy workflow step remnant), but v4.3 execution truth uses `node_run_id` as the standard. Fix: §6 clarifies `node_run_id` as the unique primary key of the step, associated with `NodeRun` truth; §7 `StepOutput` associated fields have converged to `node_run_id / harness_run_id / attempt_id`. Old `step_id` only serves as legacy projection trace field.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.