# Runtime Execution Contract

> **v4.3 Compatibility Note**: This file is retained as historical runtime execution semantics documentation. v4.3 new execution main chain uses `HarnessRun`, `PlanGraphBundle`, `NodeRun`, `NodeAttempt`, and `NodeAttemptReceipt` as canonical contracts. See [harness-run-contract.md](./harness-run-contract.md), [plan-graph-patch-contract.md](./plan-graph-patch-contract.md), and [node-run-attempt-receipt-contract.md](./node-run-attempt-receipt-contract.md).

> **OAPEFLIR Related**: This contract defines the runtime execution layer for OAPEFLIR Execute Hub, corresponding to ADR-016.
> **Updated**: 2026-04-17

## 1. Scope

This contract defines the minimum authoritative model for Phase 1a runtime execution layer, including execution envelope, precheck, resource guardrails, retry, heartbeat, blocking, and dead-letter semantics.

It answers not "what is task status" but "how is a `NodeRun / NodeAttempt` under a `HarnessRun` received, checked, executed, recovered, and terminated in runtime".

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
| `workflow_id` | `string?` | Legacy workflow projection reference; must not be truth primary key |
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
| `budget_usd_limit` | `number?` | Budget limit |
| `requires_approval` | `boolean` | Whether approval required to continue |
| `created_at` | `timestamp` | Creation time |

Constraints:

- `attempt_id` must uniquely correspond to one明确的 `NodeAttempt`.
- Lineage of `harness_run_id`, `node_run_id`, `attempt_id` must not be replaced or rewritten by projection layer.
- `attempt_no` can only increment, cannot overwrite old attempts.
- Ring 1 allows envelope to exist in DB + in-memory runtime state combination, but field semantics must be stable.
- `stage_view_ref` can only associate view / rationale, must not be used as state machine advancement condition.

## 4. run_kind Enum

- `node_execution`: Standard node execution.
- `tool_call`: Tool call or external execution step.
- `hitl_resume`: Resume execution after approval.
- `replay`: Replay, recovery, or diagnostic execution.
- `evaluator`: Evaluate output, guardrail check, or acceptance decision.
- `compensation`: Compensation path execution for confirmed side effects.
- `release_gate`: Controlled release / canary / rollback related execution.

Phase 1a does not introduce more complex `job_class` / `job_tier` system, avoiding premature platformization.

## 5. Precheck Contract

Between `created -> prechecking -> executing`, runtime must complete at minimum the following checks:

- Input exists and is parseable.
- Current `HarnessRun` / `NodeRun` is not in terminal state.
- Budget, permissions, and required approval conditions are met.
- Runtime directory, sandbox strategy, and tool whitelist are resolved.
- timeout, retry policy, trace_id are bound.
- `plan_graph_bundle_id` / `graph_version` binding with `node_run_id` exists and has not drifted.
- `attempt_id` lineage, lease / fencing token, and recovery strategy are legal.
- If `knowledge_namespace` is declared, its namespace must exist and current environment allows access.
- If `domain_id` or `strategy_version` is declared, must be resolvable to registered configuration or candidate version.
- `evaluator` / `compensation` / `release_gate` must not skip upstream evidence dependencies.

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

- When precheck fails, must enter `blocked` or `failed`, cannot silently skip check and directly execute.
- No fallback may bypass budget, approval, and security boundaries.
- Must not use `stage_view_ref` or `workflow_id` to replace `NodeRun` truth for legality judgment.

## 6. Runtime Guardrail

`RuntimeGuardrail` must include at minimum:

- `timeout_ms`
- `max_retries`
- `retry_backoff` (`none \| fixed \| exponential`)
- `sandbox_mode`
- `allowed_tools`
- `allowed_paths?`
- `budget_usd_limit?`
- `max_output_bytes?`

Phase 1a rules:

- Default: every run must have timeout.
- Default: every run must have `max_retries`, even if value is `0`.
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

Can default to retryable; the following default to not auto-retryable:

- `approval_required`
- `permission_denied`
- `invalid_input`
- `budget_exceeded`

Supplementary rules:

- If provider returns `retry-after-ms`, `retry-after`, or equivalent header, should prioritize respecting provider indication rather than blindly following local backoff curve.
- If `retry-after` is an HTTP date, should convert to relative wait time and be constrained by `max_delay_ms` upper limit.
- When provider explicitly returns `is_retryable = false`, authentication failure, capability not supported, or context overflow, must not enter auto-retry.
- Retry state should distinguish `transient_retryable`, `provider_throttled`, `permanent_provider_error` to avoid UI and recovery strategy confusion.

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
- Heartbeat defaults to liveness and monitoring, not authoritative business fact source.
- High-frequency heartbeat does not require every message to be written to persistent layer; can aggregate and sample to DB or retain only latest snapshot.
- Attempt's final truth must be persisted via `NodeAttemptReceipt`; heartbeat cannot replace receipt.

## 9. Blocking, Approval, and Recovery

- If precheck determines external approval is needed, run should enter `blocked`, task enters `awaiting_decision`.
- `hitl_resume` type execution must reference original `node_run_id` / `attempt_id` or its lineage.
- Before resuming execution, must redo minimal precheck, cannot continue directly from old in-memory state.

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

- Dead-letter is run failure classification, does not automatically equal task overall permanent failure.
- After entering dead-letter, must be able to trace to last `attempt_id`, error code, and attempt count.

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

- Before every execution enters terminal state, must first precipitate a minimum evidence packet.
- Evidence packet does not replace logs, but it is a stable anchor for subsequent inspect, recovery, and audit.
- `partial` must be explicitly marked, cannot be mixed with `success`.
- If execution is blocked by policy or approval, should also leave corresponding evidence, avoiding "no execution, no evidence".
- `stage_view_ref` / `loop_iteration_view` are view layer references only, must not replace `NodeAttemptReceipt` result semantics.
- When projection related to `feedback` / `learn` / `improve` / `release` ends, must at minimum write one closed-loop reference field or explicitly state `no_artifact_generated` reason.

## 12. Relationship with State Machine

- This contract defines runtime run execution semantics.
- `runtime_state_machine_contract.md` defines whether run state transitions are legal.
- Implementation must not privately create another set of execution terminal state meanings outside the state machine.

## 13. Failure Semantics

- After runtime crash recovery, should at minimum be able to identify which `NodeAttempt`s are in progress without `NodeAttemptReceipt`.
- Runs with incomplete precheck cannot be considered as actually executed.
- Retry and manual recovery must preserve lineage, not overwrite old records.

## 14. Supplementary Rules

- When Phase 1b begins introducing lease, handover, and multi-worker semantics, execution attempt and fencing token must maintain monotonic increment.
- Resource isolation at minimum细分: token budget, wall-clock timeout, worker class, sandbox quota.


## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical paragraphs of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` shall prevail.

- T-15: This document originally wrote `ExecutionEnvelope.stage`, old execution identity fields, and `workflow` semantics as runtime primary keys. Root cause: old execution model treated OAPEFLIR stages as part of execution state machine, causing view fields to mix into real execution envelope. Fix: Body now converges execution subject to `harness_run_id / node_run_id / attempt_id / plan_graph_bundle_id / graph_version`, and demotes `stage_view_ref` to read-only explanatory reference.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
