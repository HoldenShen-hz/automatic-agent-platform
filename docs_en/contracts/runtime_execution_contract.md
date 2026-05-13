# Runtime Execution Contract

> **v4.3 Compatibility Note**: This file is preserved as historical runtime execution semantics documentation. v4.3 new execution main chain uses `HarnessRun`, `PlanGraphBundle`, `NodeRun`, `NodeAttempt`, and `NodeAttemptReceipt` as canonical contracts. See [harness-run-contract.md](./harness-run-contract.md), [plan-graph-patch-contract.md](./plan-graph-patch-contract.md), and [node-run-attempt-receipt-contract.md](./node-run-attempt-receipt-contract.md).

> **OAPEFLIR Related**: This contract defines the runtime execution layer of OAPEFLIR Execute Hub, corresponding to ADR-016.
> **Last Updated**: 2026-04-17

## 1. Scope

This contract defines the minimum authoritative model for Phase 1a runtime execution layer, including execution envelope, precheck, resource guardrails, retry, heartbeat, blocking, and dead-letter semantics.

The question it answers is not "what is the task status", but "how is a `NodeRun / NodeAttempt` under a `HarnessRun` caught, checked, executed, recovered, and terminated in runtime".

Related documents:

- `runtime_state_machine_contract.md` defines the state machine itself.
- `supervisor_contract.md` defines supervision and alerting boundaries.
- `task_and_workflow_contract.md` defines the task and workflow main chain.
- [ADR-016 OAPEFLIR Eight-Stage Model](../adr/016-oapeflir-loop-model.md)

## 2. Key Objects

- `ExecutionEnvelope`
- `ExecutionPrecheckResult`
- `RuntimeGuardrail`
- `RetryPolicy`
- `DeadLetterRecord`
- `HeartbeatSignal`
- `ExecutionEvidencePacket`

## 3. ExecutionEnvelope Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `harness_run_id` | `string` | Parent HarnessRun |
| `node_run_id` | `string` | Current NodeRun |
| `attempt_id` | `string` | Current NodeAttempt |
| `task_id` | `string?` | Compatible query entry; not truth primary key |
| `workflow_id` | `string?` | Legacy workflow projection reference; must not be used as truth primary key |
| `agent_id` | `string` | Execution subject |
| `role_id` | `string?` | Assumed role |
| `run_kind` | `node_execution \| tool_call \| hitl_resume \| replay \| evaluator \| compensation \| release_gate` | Execution type |
| `plan_graph_bundle_id` | `string` | Current execution graph bundle |
| `graph_version` | `integer` | Current graph version |
| `stage_view_ref` | `string?` | Associated OAPEFLIR stage view; for display/explanation only |
| `loop_iteration_view` | `integer?` | Closed-loop iteration projection; does not drive runtime truth |
| `domain_id` | `string?` | Current domain binding |
| `knowledge_namespace` | `string?` | Current knowledge namespace |
| `strategy_version` | `string?` | Current strategy version |
| `input_ref` | `string?` | Input snapshot or artifact reference |
| `trace_id` | `string` | Trace ID |
| `attempt_no` | `integer` | Attempt number, starting from 1 |
| `timeout_ms` | `integer` | Maximum runtime duration |
| `budget_usd_limit` | `number?` | Budget cap |
| `requires_approval` | `boolean` | Whether approval is required before proceeding |
| `created_at` | `timestamp` | Creation timestamp |

Constraints:

- `attempt_id` must correspond one-to-one with a single explicit `NodeAttempt`.
- The lineage of `harness_run_id`, `node_run_id`, and `attempt_id` must not be replaced or rewritten by the projection layer.
- `attempt_no` can only increment, not overwrite old attempts.
- Phase 1a allows envelope to exist in a combination of DB + in-memory runtime state, but field semantics must be stable.
- `stage_view_ref` can only associate with view / rationale, and must not serve as a state machine advancement condition.

## 4. run_kind Enum

- `node_execution`: Standard node execution.
- `tool_call`: Tool call or external execution step.
- `hitl_resume`: Resume execution after approval.
- `replay`: Replay, recovery, or diagnostic execution.
- `evaluator`: Evaluate output, guardrail check, or acceptance decision.
- `compensation`: Compensation path execution for confirmed side effects.
- `release_gate`: Controlled release / canary / rollback related execution.

Phase 1a does not introduce more complex `job_class` / `job_tier` systems, avoiding premature platformization.

## 5. Precheck Contract

Between `created -> prechecking -> executing`, the runtime must complete at minimum the following checks:

- Input exists and is parseable.
- Current `HarnessRun` / `NodeRun` is not in terminal state.
- Budget, permissions, and required approval conditions are met.
- Working directory, sandbox policy, and tool whitelist are resolved.
- Timeout, retry policy, and trace_id are bound.
- `plan_graph_bundle_id` / `graph_version` binding to `node_run_id` exists and has not drifted.
- `attempt_id` lineage, lease / fencing token, and recovery policy are valid.
- If `knowledge_namespace` is declared, the namespace must exist and the current environment allows access.
- If `domain_id` or `strategy_version` is declared, it must resolve to a registered configuration or candidate version.
- `evaluator` / `compensation` / `release_gate` must not skip preceding evidence dependencies.

`ExecutionPrecheckResult` minimum fields:

- `harness_run_id`
- `node_run_id`
- `attempt_id`
- `allowed`
- `reason_code?`
- `resolved_budget_usd?`
- `resolved_timeout_ms`
- `resolved_sandbox_mode`
- `checked_at`

Behavioral constraints:

- When precheck fails, it must enter `blocked` or `failed`, and must not silently skip checks and execute directly.
- No fallback may bypass budget, approval, and security boundaries.
- `stage_view_ref` or `workflow_id` must not be used instead of `NodeRun` truth for legality judgment.

## 6. Runtime Guardrail

`RuntimeGuardrail` includes at minimum:

- `timeout_ms`
- `max_retries`
- `retry_backoff` (`none | fixed | exponential`)
- `sandbox_mode`
- `allowed_tools`
- `allowed_paths?`
- `budget_usd_limit?`
- `max_output_bytes?`

Phase 1a rules:

- Default: every run must have a timeout.
- Default: every run must have `max_retries`, even if the value is `0`.
- High-risk actions requiring approval must not execute side effect steps before approval.

## 7. Retry Policy

`RetryPolicy` minimum fields:

- `max_retries`
- `backoff_strategy`
- `initial_delay_ms?`
- `max_delay_ms?`
- `retryable_error_codes`
- `provider_retry_header_policy?`

Phase 1a minimum semantics:

- `transient_provider_error`
- `rate_limited`
- `temporary_io_error`

Can be considered retryable by default; the following are not automatically retried:

- `approval_required`
- `permission_denied`
- `invalid_input`
- `budget_exceeded`

Supplementary rules:

- If provider returns `retry-after-ms`, `retry-after`, or equivalent header, provider indication should be respected first, rather than blindly retrying according to local backoff curve.
- If `retry-after` is an HTTP date, it should be converted to relative wait time and constrained by `max_delay_ms` upper limit.
- When provider explicitly returns `is_retryable = false`, authentication failure, capability not supported, or context overflow, automatic retry must not be entered.
- Retry state should distinguish between `transient_retryable`, `provider_throttled`, `permanent_provider_error` to avoid UI and recovery strategy confusion.

## 8. Heartbeat and Runtime Liveness

`HeartbeatSignal` minimum fields:

- `harness_run_id`
- `node_run_id`
- `attempt_id`
- `agent_id`
- `status`
- `sampled_at`
- `progress_message?`
- `cpu_pct?`
- `memory_mb?`

Phase 1a recommended rules:

- Long-running steps should send heartbeat regularly.
- Heartbeat is used for liveness and monitoring by default, not as authoritative business fact source.
- High-frequency heartbeat does not require every message to be written to persistent layer; can be aggregated, sampled for database write, or only retain latest snapshot.
- The final truth of an attempt must be persisted via `NodeAttemptReceipt`; heartbeat cannot replace receipt.

## 9. Blocking, Approval, and Recovery

- If precheck determines external approval is needed, the run should enter `blocked`, and the task enters `awaiting_decision`.
- `hitl_resume` type execution must reference original `node_run_id` / `attempt_id` or its lineage.
- Before resuming execution, a minimal precheck must be redone; cannot directly continue from old in-memory state.

## 10. Dead Letter Semantics

`DeadLetterRecord` minimum fields:

- `harness_run_id`
- `node_run_id`
- `attempt_id`
- `task_id`
- `final_reason_code`
- `retry_count`
- `last_error_message?`
- `moved_at`

Phase 1a recommended reason codes:

- `max_retries_exhausted`
- `timeout_exceeded`
- `budget_exceeded`
- `approval_not_resolved`
- `permission_denied`
- `unexpected_runtime_error`

Rules:

- Dead-letter is a run failure classification, not automatically equal to overall task permanent failure.
- After entering dead-letter, the last `attempt_id`, error code, and attempt count must be traceable.

## 11. Execution Evidence and Audit Binding

`ExecutionEvidencePacket` minimum fields:

- `harness_run_id`
- `node_run_id`
- `attempt_id`
- `task_id`
- `attempt_no`
- `started_at`
- `completed_at?`
- `result_kind` (`success | partial | failed | cancelled | blocked`)
- `output_ref?`
- `artifact_refs`
- `policy_decision_ref?`
- `error_code?`
- `stage_view_ref?`
- `loop_iteration_view?`
- `feedback_signal_refs?`
- `learning_object_refs?`
- `strategy_version_ref?`
- `release_record_ref?`
- `recorded_at`

Rules:

- Before each execution enters terminal state, a minimal evidence packet must first be deposited.
- Evidence packet does not replace logs, but it is the stable handle for subsequent inspect, recovery, and audit.
- `partial` must be explicitly marked and not mixed with `success`.
- If execution is blocked by policy or approval, corresponding evidence should still be deposited to avoid "no execution, no evidence".
- `stage_view_ref` / `loop_iteration_view` are only view layer references and must not replace `NodeAttemptReceipt` result semantics.
- When feedback / learn / improve / release related projections end, at least one closed-loop reference field must be written or `no_artifact_generated` reason must be explicitly stated.

## 12. Relationship with State Machine

- This contract defines runtime run execution semantics.
- `runtime_state_machine_contract.md` defines whether run state transitions are legal.
- Implementation must not privately create another set of execution terminal state meanings outside the state machine.

## 13. Failure Semantics

- After runtime crash recovery, at minimum it should be able to identify which `NodeAttempt` is in progress without `NodeAttemptReceipt`.
- Runs with incomplete precheck cannot be considered as actually executed.
- Retry and manual recovery must preserve lineage, not overwrite old records.

## 14. Supplementary Rules

- When Phase 1b begins introducing lease, handover, and multi-worker semantics, execution attempt and fencing token must remain monotonically increasing.
- Resource isolation must be subdivided at minimum: token budget, wall-clock timeout, worker class, sandbox quota.


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical paragraphs in this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` shall prevail.

- T-15: This document originally wrote `ExecutionEnvelope.stage`, `execution_id`, and `workflow` semantics as runtime primary keys. The root cause was that the old execution model treated OAPEFLIR stages as part of the execution state machine, causing view fields to be mixed into the actual execution package. Fix: The main text now converges the execution subject to `harness_run_id / node_run_id / attempt_id / plan_graph_bundle_id / graph_version`, and demotes `stage_view_ref` to read-only explanation reference.

Mandatory Rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events can only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
