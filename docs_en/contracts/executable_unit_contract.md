# Executable Unit Contract

---

## OAPEFLIR Related

This contract participates in the following stages of the OAPEFLIR 8-stage cycle:

- **Observe**: Signal collection and aggregation
- **Assess**: Pre-execution evaluation and risk assessment
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

The purpose of unified executable unit is to enable the following capabilities to reuse the same abstraction:

- Scheduling
- Timeout
- Retry
- Recovery
- Audit
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
| `dependency_refs` | `string[]?` | Dependency units |
| `side_effect_level` | `none \| local \| external \| financial \| org_mutation` | Side effect level |
| `cost_scope_ref` | `string?` | Cost attribution |
| `created_at` | `timestamp` | Creation timestamp |

## 4. Constraints

- Unified executable unit is an abstraction layer and does not replace domain-specific objects.
- `Task` remains the user-facing primary object; `ExecutableUnit` is a cross-object execution view.
- Execution scheduling, timeout, recovery, and audit prioritize consuming the unified executable unit, rather than redefining a set of interfaces for each object.

## 5. Current Phase Mapping

| Domain Object | Mapping |
| --- | --- |
| `Task` | Top-level user-visible execution unit |
| `WorkflowStep` | Workflow-internal execution unit |
| `ToolCall` | Finest-grained atomic execution unit |
| `DecisionRequest` | Blocking-type execution unit |
| `SubTask` | Subtree-type execution unit |
| `Observe / Assess / Feedback / Learn / Improve / Release` | Closed-loop stage execution units |

## 6. Phase Boundaries

Phase 1a / 1b does:

- Documentation and runtime concept unified abstraction
- Design for scheduling, timeout, recovery, and visualization

Currently not doing:

- Creating a separate new storage table to forcibly replace existing task / execution / step tables

## 7. Closure Conclusion

Unified executable unit is not to create another layer of concepts, but to reduce the future cost of "implementing the same class of scheduling logic repeatedly on five or six different objects".