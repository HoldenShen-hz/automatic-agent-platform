# Executable Unit Contract

---

## OAPEFLIR Association

This contract participates in the following phases of the OAPEFLIR eight-phase loop:

- **Observe**: Signal collection and aggregation
- **Assess**: Pre-execution assessment and risk judgment
- **Plan**: Task decomposition and DAG construction
- **Execute**: Step execution and fault tolerance
- **Feedback**: Signal collection and preprocessing
- **Learn**: Pattern detection and knowledge extraction
- **Improve**: Improvement candidate evaluation and rollout
- **Release**: Controlled release and rollback

---

## 1. Scope

This contract defines a unified "executable unit" abstraction within the platform, used to converge heterogeneous execution objects such as Task, WorkflowStep, Skill Step, Tool Call, DecisionRequest, SubTask, etc.

Related Documents:

- `task_and_workflow_contract.md`
- `runtime_execution_contract.md`
- `transition_service_contract.md`
- `tool_metadata_and_recovery_contract.md`

## 2. Goals

The purpose of unified execution unit is to enable the following capabilities to reuse the same abstraction:

- Scheduling
- Timeout
- Retry
- Recovery
- Audit
- Billing
- Visualization

## 3. ExecutableUnit

| Field | Type | Description |
| --- | --- | --- |
| `unit_id` | `string` | Unit ID |
| `unit_kind` | `task \| workflow_step \| skill_step \| tool_call \| decision_request \| subtask \| observe_step \| assess_step \| feedback_step \| learn_step \| improve_step \| release_step \| knowledge_retrieval \| memory_promotion` | Unit type |
| `parent_unit_id` | `string?` | Parent execution unit |
| `root_task_id` | `string` | Root task ID |
| `stage` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release?` | Owning closed-loop phase |
| `ref_id` | `string?` | Associated typed ref |
| `input_ref` | `string \| json` | Input reference or input body |
| `output_ref` | `string?` | Output reference |
| `status` | `string` | Lifecycle state |
| `retry_policy_ref` | `string?` | Retry policy |
| `timeout_ms` | `number?` | Timeout |
| `dependency_refs` | `string[]?` | Dependent units |
| `side_effect_level` | `none \| local \| external \| financial \| org_mutation` | Side effect level |
| `cost_scope_ref` | `string?` | Cost attribution |
| `created_at` | `timestamp` | Creation time |

## 4. Constraints

- Unified execution unit is an abstraction layer, does not replace specific domain objects.
- `Task` is still the user primary object, `ExecutableUnit` is a cross-object reusable execution view.
- Execution scheduling, timeout, recovery, and audit prioritize consuming unified execution unit rather than defining a separate set of interfaces for each object.

## 5. Current Phase Mapping

| Domain Object | Mapping Method |
| --- | --- |
| `Task` | Top-level user-visible execution unit |
| `WorkflowStep` | Workflow internal execution unit |
| `ToolCall` | Finest-grained atomic execution unit |
| `DecisionRequest` | Blocking-type execution unit |
| `SubTask` | Subtree-type execution unit |
| `Observe / Assess / Feedback / Learn / Improve / Release` | Closed-loop phase execution units |

## 6. Phase Boundary

Phase 1a / 1b does:

- Documentation and runtime concept layer unified abstraction
- Used for scheduling, timeout, recovery, and visualization design

Currently does not do:

- Separately creating a new independent storage table to forcibly replace existing task / execution / step tables

## 7. Closure Conclusion

Unified execution unit is not to create another layer of concepts, but to reduce the future cost of "the same type of scheduling logic being repeatedly implemented on five or six types of objects".
