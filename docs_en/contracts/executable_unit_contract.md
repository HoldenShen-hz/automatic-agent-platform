# Executable Unit Contract

## 1. Scope

This contract defines a unified "executable unit" abstraction within the platform, used to converge heterogeneous execution objects such as Task, WorkflowStep, Skill Step, Tool Call, DecisionRequest, and SubTask.

Related documents:

- `task_and_workflow_contract.md`
- `runtime_execution_contract.md`
- `transition_service_contract.md`
- `tool_metadata_and_recovery_contract.md`

## 2. Goals

The purpose of a unified executable unit is to reuse the same abstraction for the following capabilities:

- Scheduling
- Timeout
- Retry
- Recovery
- Auditing
- Billing
- Visualization

## 3. `ExecutableUnit`

| Field | Type | Description |
| --- | --- | --- |
| `unit_id` | `string` | Unit ID |
| `unit_kind` | `task \| workflow_step \| skill_step \| tool_call \| decision_request \| subtask \| observe_step \| assess_step \| feedback_step \| learn_step \| improve_step \| release_step \| knowledge_retrieval \| memory_promotion` | Unit type |
| `parent_unit_id` | `string?` | Parent execution unit |
| `root_task_id` | `string` | Root task ID |
| `stage` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release?` | Closed-loop stage |
| `ref_id` | `string?` | Associated typed ref |
| `input_ref` | `string \| json` | Input reference or body |
| `output_ref` | `string?` | Output reference |
| `status` | `string` | Lifecycle status |
| `retry_policy_ref` | `string?` | Retry policy |
| `timeout_ms` | `number?` | Timeout |
| `dependency_refs` | `string[]?` | Dependent units |
| `side_effect_level` | `none \| local \| external \| financial \| org_mutation` | Side effect level |
| `cost_scope_ref` | `string?` | Cost attribution |
| `created_at` | `timestamp` | Creation time |

## 4. Constraints

- Unified executable unit is an abstraction layer and does not replace specific domain objects.
- `Task` is still the user primary object, and `ExecutableUnit` is an execution view reused across objects.
- Execution scheduling, timeout, recovery, and auditing prioritize consuming unified executable units rather than repeatedly defining a set of interfaces for each object.

## 5. Current Phase Mapping

| Domain Object | Mapping Method |
| --- | --- |
| `Task` | Top-level user-visible execution unit |
| `WorkflowStep` | Workflow internal execution unit |
| `ToolCall` | Finest-grained atomic execution unit |
| `DecisionRequest` | Blocking execution unit |
| `SubTask` | Subtree execution unit |
| `Observe / Assess / Feedback / Learn / Improve / Release` | Closed-loop stage execution units |

## 6. Phase Boundaries

Phase 1a / 1b does:

- Document and runtime concept layer unified abstraction
- Used for scheduling, timeout, recovery, and visualization design

Currently does not do:

- Separately creating a new independent storage table to forcibly replace existing task / execution / step tables

## 7. Closure Conclusion

The unified executable unit is not to create another layer of concepts but to reduce the future cost of "implementing the same type of scheduling logic repeatedly on five or six types of objects."
