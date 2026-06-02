# Executable Unit Contract

---

## OAPEFLIR Mapping

This contract participates in the following stages of the OAPEFLIR eight-stage loop:

- **Observe**: signal collection and aggregation
- **Assess**: pre-execution evaluation and risk judgement
- **Plan**: task decomposition and DAG construction
- **Execute**: step execution and fault tolerance
- **Feedback**: signal collection and preprocessing
- **Learn**: pattern detection and knowledge extraction
- **Improve**: improvement candidate evaluation and rollout
- **Release**: controlled release and rollback

---

## 1. Scope

This contract defines a unified "executable unit" semantic view inside the platform. It is used to map heterogeneous objects such as Task, WorkflowStep, Tool Call, HITL decision, and SubTask to a unified observation and visualization layer.

`ExecutableUnit` is not runtime truth. In v4.3, the canonical minimum execution units are `NodeRun` / `NodeAttempt`; `ExecutableUnit` can only act as a semantic projection or import adaptation layer built around them.

Related documents:

- `task_and_workflow_contract.md`
- `runtime_execution_contract.md`
- `transition_service_contract.md`
- `tool_metadata_and_recovery_contract.md`

## 2. Goals

The purpose of a unified execution unit is to let the following capabilities reuse the same semantic view:

- Scheduling
- Timeouts
- Retries
- Recovery
- Auditing
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
| `stage_view_ref` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release?` | Owning loop stage view |
| `ref_id` | `string?` | Associated typed ref |
| `input_ref` | `string \| json` | Input reference or input body |
| `output_ref` | `string?` | Output reference |
| `status_view` | `string` | Lifecycle projection status |
| `retry_policy_ref` | `string?` | Retry policy |
| `timeout_ms` | `number?` | Timeout |
| `dependency_refs` | `string[]?` | Dependent units |
| `side_effect_level` | `none \| local \| external \| financial \| org_mutation` | Side-effect level |
| `cost_scope_ref` | `string?` | Cost attribution |
| `created_at` | `timestamp` | Creation time |

Rules:

- `ExecutableUnit` must be linkable back to `NodeRun` / `NodeAttempt`; new unit objects without `harness_run_id` must not be used as canonical execution layer input.
- `stage_view_ref` and `status_view` are only allowed to express projection semantics; the real execution state is still defined by `RuntimeStateMachine.transition(command)` and `NodeAttemptReceipt`.
- Old `unit_kind` values such as `skill_step`, `decision_request`, `observe_step` may only be used as import mapping and must not appear in the new schema.

## 4. Constraints

- The unified execution unit is an abstraction layer and does not replace specific domain objects.
- `Task` is still the primary user-facing object; `ExecutableUnit` is a cross-object reusable semantic / presentation view.
- Execution scheduling, timeouts, recovery, and truth auditing should prefer to consume `NodeRun` / `NodeAttempt` / `NodeAttemptReceipt`; `ExecutableUnit` is only used for cross-object unified display, retrieval, or import.

## 5. Current Stage Mapping

| Domain Object | Mapping Approach |
| --- | --- |
| `Task` | Top-level user-visible execution unit view |
| `WorkflowStep` | Semantic mapping view of `PlanNode` / `NodeRun` |
| `ToolCall` | Atomic view of `NodeAttemptReceipt(receiptKind=tool)` |
| `DecisionRequest` | `hitl_wait_view`, must be linkable back to `ApprovalRequest` / `DecisionDirective` |
| `SubTask` | Subtree-style run view, must be linkable back to child `HarnessRun` |
| `Observe / Assess / Feedback / Learn / Improve / Release` | OAPEFLIR stage views, not independent truth units |

## 6. Phase Boundary

Phase 1a / 1b do:

- Unify abstraction at the documentation and runtime concept layers
- Use it for scheduling, timeouts, recovery, and visualization design

Currently not doing:

- Creating a separate new storage table to forcibly replace the existing `HarnessRun / NodeRun / NodeAttempt` truth tables

## 7. Closure Conclusion

The unified execution unit is not meant to invent another layer of concepts, but to reduce the future cost of "the same kind of scheduling logic being duplicated across five or six different objects".


## v4.3 Architecture Remediation

The following entries fix the contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If any historical section of this document conflicts with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-20: This document originally described `ExecutableUnit` as a unified execution truth that could directly replace task / workflow_step / tool_call. The root cause was an early attempt to flatten all execution objects under a single abstraction, but it was not downgraded to a projection layer as `NodeRun / NodeAttempt` became the canonical minimum execution units. Fix: The main text now makes clear that `ExecutableUnit` is only a semantic view around `HarnessRun / NodeRun / NodeAttempt`, and old `unit_kind` values are downgraded to import mapping.

Mandatory rules: state transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events may only use `platform.*`; OAPEFLIR may only act as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
