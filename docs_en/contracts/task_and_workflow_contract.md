# Task And Workflow Contract

## 1. Scope

This contract defines tasks, subtasks, workflow states, step outputs, artifact references, and the runtime constraints that Phase 1a needs to stabilize.

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
| `source` | `user \| perception \| system` | Task source |
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

`TaskStatus` is authoritative per [runtime_state_machine_contract.md](./runtime_state_machine_contract.md).

## 4. Task Runtime Constraints

- `root_id` remains stable throughout the entire task tree.
- Empty `parent_id` indicates a root task; when non-empty, it must point to an existing task.
- `division_id` may be empty before HQ triage, but must be determined before entering division execution.
- `actual_cost_usd` starts at `0` and only allows accumulated updates.
- When entering a terminal state, `completed_at` or failure termination time must be written synchronously.

## 5. WorkflowState Authoritative Fields

| Field | Type | Description |
| --- | --- | --- |
| `task_id` | `string` | Associated task |
| `division_id` | `string` | Owning division |
| `workflow_id` | `string` | Workflow definition identifier |
| `current_step_index` | `number` | Current step index |
| `status` | `WorkflowStatus` | Workflow status |
| `outputs` | `Record<string, StepOutput>` | Step output mapping |
| `last_error_code` | `string?` | Most recent error code |
| `retry_count` | `number` | Current accumulated retry count |
| `started_at` | `timestamp` | Start time |
| `updated_at` | `timestamp` | Update time |
| `resumable_from_step` | `string?` | Resumable step identifier |

## 6. WorkflowStep Authoritative Fields

Each step contains at minimum:

- `step_id`
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
- `output_key` is unique within the same workflow.
- `approval_policy` only defines whether escalation is needed, it does not carry channel interaction details.

## 7. StepOutput Authoritative Fields

| Field | Type | Description |
| --- | --- | --- |
| `step_id` | `string` | Step ID |
| `role_id` | `string` | Executing role |
| `status` | `succeeded \| failed \| partial_success` | Step result |
| `data` | `json` | Primary output data |
| `summary` | `string?` | Output summary |
| `artifacts` | `ArtifactRef[]?` | Attachment references |
| `token_cost` | `number` | Token cost |
| `duration_ms` | `number` | Duration |
| `validation` | `json?` | Schema validation result |
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
- When artifacts are deleted or migrated, the auditability of completed tasks must not be broken.

## 9. TaskDependency

Phase 1a allows minimal dependency expression:

- `upstream_task_id`
- `downstream_task_id`
- `dependency_type`, values `hard \| soft`
- `created_at`

Phase 1a only requires expressing cross-task wait relationships, not full DAG query capability.

## 10. Behavioral Constraints

- Workflow input bindings should be resolved at runtime, not simulated by string replacement.
- Outputs must be validated against schema before writing to state.
- `partial_success` must be explicitly recorded and not disguised as success.
- Task terminal state and workflow terminal state must remain consistent in recovery logic.

## 11. Failure Semantics

- Step failures proceed with limited retries first.
- After retry limit is exceeded, hand over to workflow self-healing, escalation, or task failure handling.
- `cancelled` and `failed` must be distinguished.
- Failures caused by invalid input should be marked as non-retryable.

### 11.1 Step Dependency Cascading Failure

When workflow steps have dependencies (referencing upstream `output_key` via `input_binding`), upstream step failure or skip triggers cascading:

| Upstream Step Status | Dependency Type | Downstream Step Handling |
| --- | --- | --- |
| `failed` | `hard` (default) | Downstream step marked as `skipped`, reason_code `upstream_dependency_failed` |
| `failed` | `soft` | Downstream step can still execute, missing input filled with `null` or default value |
| `skipped` | `hard` | Downstream step cascades to `skipped` |
| `skipped` | `soft` | Downstream step can still execute |

Rules:

- Cascading `skipped` must propagate along the DAG, and must not leave more downstream steps indefinitely stuck in `blocked` after an intermediate step is interrupted.
- Cascading determination should be completed before step scheduling, not discovered when the step actually starts executing.
- All cascading skipped steps must record `StepOutput` (status=`skipped`), ensuring workflow output mapping completeness.
- If cascading causes all critical steps to be skipped, workflow should enter `failed`, not `completed`.
- Step dependency cascading is consistent with static analysis rules in `workflow_static_analysis_and_compensation_contract.md` Section 6.

## 12. Supplementary Rules

- Conditional branch DSL supports at minimum: `equals`, `exists`, `not_exists`, `greater_than`, `all_of`, `any_of`.
- Subtask aggregation output includes at minimum: `summary`, `successful_children`, `failed_children`, `artifacts`, `warnings`.
- Artifact lifecycle should be bound to task retention policy; GC must not execute before the audit window.

Supplementary notes:

- Unified executable unit abstraction is authoritative per `executable_unit_contract.md`.
- Unified result envelope is authoritative per `result_envelope_contract.md`.
