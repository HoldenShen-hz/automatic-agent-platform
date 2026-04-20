# Runtime Execution Contract

> **OAPEFLIR Related**: This contract defines the runtime execution layer of the OAPEFLIR Execute Hub, corresponding to ADR-016.
> **Last Updated**: 2026-04-17

## 1. Scope

This contract defines the Phase 1a runtime execution layer's minimum authoritative model, including execution envelopes, prechecks, resource guardrails, retries, heartbeats, blocking, and dead-letter semantics.

The question it answers is not "what is the task status", but "how is an Agent run accepted, checked, executed, recovered, and terminated in runtime".

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
| `execution_id` | `string` | Unique ID for this run |
| `task_id` | `string` | Associated task |
| `workflow_id` | `string?` | Associated workflow |
| `agent_id` | `string` | Execution subject |
| `role_id` | `string?` | Assuming role |
| `run_kind` | `task_run \| tool_call \| approval_resume \| replay \| feedback_collection \| learning_generation \| improvement_evaluation \| rollout_canary` | Execution type |
| `stage` | `observe \| assess \| plan \| execute \| feedback \| learn \| improve \| release` | Current OAPEFLIR stage |
| `loop_iteration` | `integer?` | Which round of closed loop |
| `domain_id` | `string?` | Current domain binding |
| `knowledge_namespace` | `string?` | Current knowledge namespace |
| `strategy_version` | `string?` | Current strategy version |
| `input_ref` | `string?` | Input snapshot or artifact reference |
| `trace_id` | `string` | Trace ID |
| `attempt` | `integer` | Attempt number, starting from 1 |
| `timeout_ms` | `integer` | Maximum runtime duration |
| `budget_usd_limit` | `number?` | Budget limit |
| `requires_approval` | `boolean` | Whether approval is required to continue |
| `created_at` | `timestamp` | Created at |

Constraints:

- `execution_id` must correspond one-to-one with a clear runtime run.
- `attempt` can only increment, cannot overwrite old attempts.
- Phase 1a allows envelope to exist in DB + in-memory runtime state combination, but field semantics must be stable.

## 4. run_kind Enum

- `task_run`: Standard task execution.
- `tool_call`: Tool call or external execution step.
- `approval_resume`: Resume execution after approval.
- `replay`: Replay, recovery, or diagnostic execution.
- `feedback_collection`: Collect, normalize, or persist feedback signals after execution.
- `learning_generation`: Generate learning objects from feedback and execution evidence.
- `improvement_evaluation`: Evaluate improvement candidates, guardrail checks, or acceptance decisions.
- `rollout_canary`: Controlled rollout / canary / rollback related runs.

Phase 1a does not introduce more complex `job_class` / `job_tier` system, avoiding premature platformization.

## 5. Precheck Contract

Between `created -> prechecking -> executing`, runtime must complete at minimum the following checks:

- Input exists and is parseable.
- Current task is not in terminal state.
- Budget, permissions, and required approval conditions are met.
- Runtime directory, sandbox policy, and tool whitelist are resolved.
- Timeout, retry policy, trace_id are bound.
- `stage` is legal with current workflow OAPEFLIR stage transition.
- If `knowledge_namespace` is declared, its namespace must exist and current environment allows access.
- If `domain_id` or `strategy_version` is declared, must be resolvable to registered configuration or candidate version.
- `feedback_collection` / `learning_generation` / `improvement_evaluation` / `rollout_canary` must not skip prior evidence dependencies.

`ExecutionPrecheckResult` minimum fields:

- `execution_id`
- `allowed`
- `reason_code?`
- `resolved_budget_usd?`
- `resolved_timeout_ms`
- `resolved_sandbox_mode`
- `checked_at`

Behavioral constraints:

- When precheck fails, must enter `blocked` or `failed`, cannot silently skip check and execute directly.
- No fallback may bypass budget, approval, and security boundaries.

## 6. Runtime Guardrail

`RuntimeGuardrail` at minimum includes:

- `timeout_ms`
- `max_retries`
- `retry_backoff` (`none \| fixed \| exponential`)
- `sandbox_mode`
- `allowed_tools`
- `allowed_paths?`
- `budget_usd_limit?`
- `max_output_bytes?`

Phase 1a rules:

- By default, every run must have a timeout.
- By default, every run must have `max_retries`, even if value is `0`.
- High-risk actions requiring approval must not execute side-effect steps before approval.

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

Can be default retryable; the following are not auto-retryable by default:

- `approval_required`
- `permission_denied`
- `invalid_input`
- `budget_exceeded`

Supplementary rules:

- If provider returns `retry-after-ms`, `retry-after`, or equivalent header, should respect provider instruction, not blindly follow local backoff curve.
- If `retry-after` is HTTP date, should convert to relative wait time, subject to `max_delay_ms` cap.
- When provider explicitly returns `is_retryable = false`, authentication failure, capability not supported, or context overflow, must not enter auto-retry.
- Retry state should distinguish `transient_retryable`, `provider_throttled`, `permanent_provider_error`, avoiding UI and recovery strategy confusion.

## 8. Heartbeat and Runtime Liveness

`HeartbeatSignal` minimum fields:

- `execution_id`
- `agent_id`
- `status`
- `sampled_at`
- `progress_message?`
- `cpu_pct?`
- `memory_mb?`

Phase 1a recommended rules:

- Long-running steps should send heartbeat regularly.
- Heartbeat is by default for liveness and monitoring, not authoritative business fact source.
- High-frequency heartbeat does not require every message to write to persistent layer; can aggregate, sample and store, or keep only latest snapshot.

## 9. Blocking, Approval, and Recovery

- If precheck determines external approval is needed, run should enter `blocked`, task enters `awaiting_decision`.
- `approval_resume` type execution must reference original `execution_id` or its lineage.
- Before resuming execution, must redo minimum precheck, cannot continue directly from old in-memory state.

## 10. Dead Letter Semantics

`DeadLetterRecord` minimum fields:

- `execution_id`
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

- Dead-letter is execution failure classification, does not automatically equal task overall permanent failure.
- After entering dead-letter, must be able to trace back to last `execution_id`, error code, and attempt count.

## 11. Execution Evidence and Audit Binding

`ExecutionEvidencePacket` minimum fields:

- `execution_id`
- `task_id`
- `attempt`
- `started_at`
- `completed_at?`
- `result_kind` (`success | partial | failed | cancelled | blocked`)
- `output_ref?`
- `artifact_refs`
- `policy_decision_ref?`
- `error_code?`
- `stage`
- `loop_iteration?`
- `feedback_signal_refs?`
- `learning_object_refs?`
- `strategy_version_ref?`
- `rollout_record_ref?`
- `recorded_at`

Rules:

- Before each execution enters terminal state, must first deposit a minimum evidence packet.
- Evidence packet does not replace logs, but it is the stable anchor for subsequent inspect, recovery, and audit.
- `partial` must be explicitly marked, cannot be mixed with `success`.
- If execution is blocked by policy or approval, should also leave corresponding evidence, avoiding "no execution, no evidence".
- When `feedback` / `learn` / `improve` / `release` related runs end, must at minimum write one closed-loop reference field or explicitly state `no_artifact_generated` reason.

## 12. Relationship with State Machine

- This contract defines runtime run execution semantics.
- `runtime_state_machine_contract.md` defines whether run state transitions are legal.
- Implementation must not privately create another set of execution terminal state meanings outside the state machine.

## 13. Failure Semantics

- After runtime crash recovery, must be able to identify which runs are in `executing` without terminal receipt.
- Runs with unfinished precheck cannot be considered as actually executed.
- Retry and manual recovery must preserve lineage, not overwrite old records.

## 14. Supplementary Rules

- When Phase 1b introduces lease, handover, and multi-worker semantics, execution attempt and fencing token must remain monotonically increasing.
- Resource isolation at minimum granularity: token budget, wall-clock timeout, worker class, sandbox quota.
