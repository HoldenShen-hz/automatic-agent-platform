# Executable Unit Contract

---

## OAPEFLIR Association

This contract participates in the following stages of the OAPEFLIR eight-stage cycle:

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

This contract defines a unified "executable unit" semantic view within the platform, used to map heterogeneous objects such as Task, WorkflowStep, Tool Call, HITL Decision, SubTask to a unified observation and visualization layer.

`ExecutableUnit` is not runtime truth. The normative minimum execution unit for v4.3 is `NodeRun` / `NodeAttempt`; `ExecutableUnit` can only serve as a semantic projection or import adapter layer built around them.

Related documents:

- `task_and_workflow_contract.md`
- `runtime_execution_contract.md`
- `transition_service_contract.md`
- `tool_metadata_and_recovery_contract.md`

## 2. Objectives

The purpose of unifying execution units is to enable the following capabilities to reuse the same semantic view:

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
| `unit_kind` | `task_view \| workflow_step_view \| tool_call_view \| hitl_wait_view \| subtask_view \| release_gate_view \| knowledge_retrieval_view \| memory_promotion_view` | Semantic view type |
| `harness_run_id` | `string` | Corresponding HarnessRun |
| `node_run_id` | `string?` | Corresponding NodeRun |
| `attempt_id` | `string?` | Corresponding NodeAttempt |
| `plan_graph_bundle_id` | `string?` | Corresponding execution graph bundle |
| `graph_version` | `number?` | Corresponding graph version |
| `parent_unit_id` | `string?` | Parent execution unit |
| `root_task_id` | `string?` | Root task query entry |
| `stage_view_ref` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release?` | Belonging closed-loop stage view |
| `ref_id` | `string?` | Associated typed ref |
| `input_ref` | `string \| json` | Input reference or input body |
| `output_ref` | `string?` | Output reference |
| `status_view` | `string` | Lifecycle projection status |
| `retry_policy_ref` | `string?` | Retry policy |
| `timeout_ms` | `number?` | Timeout |
| `dependency_refs` | `string[]?` | Dependency units |
| `side_effect_level` | `none \| local \| external \| financial \| org_mutation` | Side effect level |
| `cost_scope_ref` | `string?` | Cost attribution |
| `created_at` | `timestamp` | Creation time |

Rules:

- `ExecutableUnit` must be traceable back to `NodeRun` / `NodeAttempt`; new unit objects without `harness_run_id` must not serve as execution layer canonical input.
- `stage_view_ref`, `status_view` only express projection semantics; real execution state is still defined by `RuntimeStateMachine.transition(command)` and `NodeAttemptReceipt`.
- Old `unit_kind` such as `skill_step`, `decision_request`, `observe_step` can only serve as import mapping, must not appear in new schema.

## 4. Constraints

- Unified execution unit is an abstraction layer, does not replace specific domain objects.
- `Task` remains the user primary object, `ExecutableUnit` is a cross-object reusable semantic/display view.
- Execution scheduling, timeout, recovery, and truth audit prioritize consumption of `NodeRun` / `NodeAttempt` / `NodeAttemptReceipt`; `ExecutableUnit` is only used for cross-object unified display, search, or import.

## 5. Current Stage Mapping

| Domain Object | Mapping Method |
| --- | --- |
| `Task` | Top-level user-visible execution unit view |
| `WorkflowStep` | Semantic mapping view of `PlanNode` / `NodeRun` |
| `ToolCall` | Atomic view of `NodeAttemptReceipt(receiptKind=tool)` |
| `DecisionRequest` | `hitl_wait_view`, must trace back to `ApprovalRequest` / `DecisionDirective` |
| `SubTask` | Subtree runtime view, must trace back to child `HarnessRun` |
| `Observe / Assess / Feedback / Learn / Improve / Release` | OAPEFLIR stage views, not independent truth units |

## 6. Phase Boundaries

Phase 1a / 1b will do:

- Document and runtime concept layer unified abstraction
- Used for scheduling, timeout, recovery, and visualization design

Currently not doing:

- Creating a separate independent storage table to forcibly replace existing `HarnessRun / NodeRun / NodeAttempt` truth tables

## 7. Closure Conclusion

The purpose of unifying execution units is not to create another layer of concepts, but to reduce the future cost of "implementing the same scheduling logic repeatedly on five or six types of objects".


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-20: This document originally wrote `ExecutableUnit` as a unified execution truth that could directly replace task/workflow_step/tool_call. The root cause is that early on, an abstraction was wanted to flatten all execution objects, but it wasn't demoted back to projection layer as `NodeRun / NodeAttempt` became the normative minimum execution unit. Fix: The main text now explicitly states `ExecutableUnit` is only a semantic view around `HarnessRun / NodeRun / NodeAttempt`, and demotes old `unit_kind` to import mapping.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projections; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.