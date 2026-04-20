# Runtime Execution Contract

## 1. Scope

This contract defines the Phase 1a runtime execution layer's minimum authoritative model, including execution envelope, precheck, resource guardrails, retry, heartbeat, blocking, and dead-letter semantics.

It answers not "what is the task state" but "how is an Agent run received, checked, executed, recovered, and terminated in runtime."

Related documents:

- `runtime_state_machine_contract.md` is responsible for the state machine itself.
- `supervisor_contract.md` is responsible for supervision and alerting boundaries.
- `task_and_workflow_contract.md` is responsible for task and workflow primary chain.

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
| `timeout_ms` | `integer` | Maximum runtime |
| `budget_usd_limit` | `number?` | Budget ceiling |
| `requires_approval` | `boolean` | Whether approval is required before continuing |
| `created_at` | `timestamp` | Creation time |

Constraints:

- `execution_id` must one-to-one correspond to a single explicit runtime run.
- `attempt` can only increase and cannot overwrite old attempts.
- Phase 1a allows envelope to exist in DB + in-memory runtime state combination, but field semantics must be stable.

## 4. run_kind Enumeration

- `task_run`: Standard task execution.
- `tool_call`: Tool call or external execution step.
- `approval_resume`: Resume execution after approval passes.
- `replay`: Replay, recovery, or diagnostic execution.
- `feedback_collection`: Collect, normalize, or persist feedback signals after execution.
- `learning_generation`: Generate learning objects from feedback and execution evidence.
- `improvement_evaluation`: Evaluate improvement candidates, guardrail checks, or acceptance decisions.
- `rollout_canary`: Controlled rollout / canary / rollback related execution.

Phase 1a does not introduce more complex `job_class` / `job_tier` system to avoid premature platformization.

## 5. Precheck Contract

Between `created -> prechecking -> executing`, runtime at minimum completes the following checks:

- Input exists and is parseable.
- Current task is not in terminal state.
- Budget, permissions, and required approval conditions are met.
- Runtime directory, sandbox strategy, and tool whitelist are resolved.
- Timeout, retry policy, and trace_id are bound.
- `stage` and workflow current OAPEFLIR stage transition are legal.
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

- When precheck fails, must enter `blocked` or `failed` and cannot silently skip check and execute directly.
- Any fallback must not bypass budget, approval, and security boundaries.

## 6. Runtime Guardrail

`RuntimeGuardrail` at minimum includes:

- `timeout_ms`
- `max_retries`
- `retry_backoff` (`none | fixed | exponential`)
- `sandbox_mode`
- `allowed_tools`
- `allowed_paths?`
- `budget_usd_limit?`
- `max_output_bytes?`

Phase 1a rules:

- Each run must have timeout by default.
- Each run must have `max_retries` by default, even if the value is `0`.
- If high-risk actions require approval, side-effect steps must not be executed before approval.

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

Can default to be retryable; the following default to not auto-retry:

- `approval_required`
- `permission_denied`
- `invalid_input`
- `budget_exceeded`

Supplementary rules:

- If provider returns `retry-after-ms`, `retry-after`, or equivalent header, should prioritize respecting provider instruction rather than blindly retrying according to local backoff curve.
- If `retry-after` is an HTTP date, should convert to relative wait time and be constrained by `max_delay_ms` upper limit.
- When provider explicitly returns `is_retryable = false`, authentication failure, capability not supported, or context overflow, must not enter automatic retry.
- Retry state should distinguish `transient_retryable`, `provider_throttled`, `permanent_provider_error` to avoid UI and recovery strategy confusion.

## 8. Heartbeat and Runtime Liveness

`HeartbeatSignal` minimum fields:

- `execution_id`
- `agent_id`
- `status`
- `sampled_at`
- `progress_message?`
- `cpu_pct?`
- `memory_mb?`

Phase 1a suggested rules:

- Long-running steps should send heartbeat periodically.
- Heartbeat is by default used for liveness and monitoring, not as authoritative business fact source.
- High-frequency heartbeat does not require each one to be written to persistent layer; can be aggregated, sampled and stored or only latest snapshot retained.

## 9. Blocking, Approval, and Recovery

- If precheck determines external approval is needed, run should enter `blocked` and task enters `awaiting_decision`.
- Executions of type `approval_resume` must reference original `execution_id` or its lineage.
- Before resuming execution, must redo minimum precheck and cannot directly continue from old in-memory state.

## 10. Dead Letter Semantics

`DeadLetterRecord` minimum fields:

- `execution_id`
- `task_id`
- `final_reason_code`
- `retry_count`
- `last_error_message?`
- `moved_at`

Phase 1a suggested reason codes:

- `max_retries_exhausted`
- `timeout_exceeded`
- `budget_exceeded`
- `approval_not_resolved`
- `permission_denied`
- `unexpected_runtime_error`

Rules:

- Dead-letter is a classification of execution failure and does not automatically equal permanent task failure.
- After entering dead-letter, must be able to trace back to the last `execution_id`, error code, and attempt count.

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
- Evidence packet does not replace logs, but it is a stable handle for subsequent inspect, recovery, and audit.
- `partial` must be explicitly marked and must not be mixed with `success`.
- If execution is blocked by policy or approval, should also leave corresponding evidence to avoid "no execution and no evidence".
- When runs related to `feedback` / `learn` / `improve` / `release` end, must at minimum write one closed-loop reference field or explicitly state `no_artifact_generated` reason.

## 12. Relationship with State Machine

- This contract defines runtime run execution semantics.
- `runtime_state_machine_contract.md` defines whether run state transitions are legal.
- Implementation must not privately create another set of execution terminal state meanings outside the state machine.

## 13. Failure Semantics

- After runtime crash recovery, should at minimum be able to identify which runs are in `executing` without terminal receipt.
- Runs with unfinished precheck cannot be considered as actually executed.
- Retry and manual recovery must preserve lineage rather than overwrite old records.

## 14. Supplementary Rules

- When Phase 1b begins introducing lease, handover, and multi-worker semantics, execution attempt and fencing token must remain monotonically increasing.
- Resource isolation at minimum distinguishes: token budget, wall-clock timeout, worker class, and sandbox quota.
