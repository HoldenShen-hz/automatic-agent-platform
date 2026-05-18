# Supervisor Contract

## 1. Scope

This contract defines the minimum supervisory boundaries for the Agent Supervisor with respect to runtime instances, health status, heartbeats, alerts, recovery actions, performance reviews, and OAPEFLIR closed-loop proposals.

It is not responsible for directly executing tasks, but rather for observing, judging, escalating, and auditing.

## 2. Key Objects

- `AgentRuntimeInstance`
- `HealthSnapshot`
- `HeartbeatPolicy`
- `AlertRecord`
- `RecoveryAction`
- `PerformanceReview`
- `EvolutionProposal`
- `LoopHealthSnapshot`
- `StageStallAlert`
- `FeedbackAccumulator`

## 3. AgentRuntimeInstance Minimum Fields

- `instance_id`
- `agent_id`
- `harness_run_id`
- `node_run_id?`
- `attempt_id?`
- `task_id?`
- `status`
- `started_at`
- `last_heartbeat_at`
- `current_node_view_ref?`

Rules:

- `current_node_view_ref` may only express semantic projections; it must not reintroduce `HarnessStep` / `current_step_id` as the runtime truth primary key.
- Any supervisor recovery, alert, or takeover actions must be traceable back to `harness_run_id / node_run_id / attempt_id`.

## 4. HealthSnapshot Minimum Fields

- `instance_id`
- `health` (`healthy | degraded | stalled | failed`)
- `current_stage_view?`
- `loop_iteration_view?`
- `negative_feedback_ratio?`
- `reason?`
- `sampled_at`

## 5. HeartbeatPolicy Minimum Fields

- `expected_interval_sec`
- `stale_after_sec`
- `sample_strategy` (`latest_only | sampled | all_persisted`)

Phase 1a Rules:

- Default to `latest_only` or `sampled` to avoid high-frequency heartbeats from flooding the database.
- When no heartbeat is seen for longer than `stale_after_sec`, the Supervisor should mark the instance as `degraded` or `stalled`, not silently ignore it.

## 6. AlertRecord Minimum Fields

- `alert_id`
- `instance_id`
- `severity` (`SEV1 | SEV2 | SEV3 | SEV4`)
- `code`
- `message`
- `created_at`
- `resolved_at?`

Alert Severity Guidelines:

- `SEV4`: Localized minor issue, auto-recoverable, primarily for observability hints.
- `SEV3`: Single workflow / single worker impact, such as stale heartbeat, high retry count, abnormal runtime.
- `SEV2`: Single business domain / single tenant significantly affected, such as security policy anomaly, batch failure, budget anomaly spread.
- `SEV1`: Platform-level impact / security incident / production serious risk.

Recommended Alert Code Baseline:

- `supervisor.stage_stalled`
- `supervisor.loop_diverging`
- `feedback.negative_spike`

## 7. RecoveryAction Minimum Fields

- `action_id`
- `instance_id`
- `action_type` (`mark_stalled | request_retry | request_cancel | escalate_to_human | skip_stage | force_loop_exit | rollback_improvement`)
- `reason`
- `created_at`
- `actor`

Rules:

- The Supervisor may suggest or trigger controlled recovery actions, but must not silently overwrite business outputs.
- Auto-recovery, cancellation, and escalation must all leave audit records.
- High-risk actions must still comply with approval and security contracts.

## 8. Behavioral Constraints

- The Supervisor is responsible for monitoring and escalation, not for directly tampering with business results.
- Any auto-recovery or termination actions must leave audit records.
- Evolution-related suggestions may only form proposals and cannot take effect directly.
- The Supervisor's judgments on heartbeats, alerts, and recovery must be consistent with the runtime execution contract.

## 9. Relationship with Runtime

- `runtime_execution_contract.md` defines how a single run performs precheck, execution, retry, and termination.
- This contract defines who detects run anomalies and how alerts and recovery actions are formed.
- `event_bus_contract.md` is responsible for how these signals propagate, not for rewriting supervisory semantics.

## 10. Supplementary Rules

- In Phase 1b multi-worker topology, the supervisor should at least distinguish between node-local monitor and control-plane supervisor.
- Performance scores may only form proposals and must not directly drive prompt / role hot updates; formal activation still requires governance chain approval.

## 10A. OAPEFLIR Loop Monitoring

`LoopHealthSnapshot` Minimum Fields:

- `harness_run_id`
- `task_id?`
- `loop_iteration_view`
- `current_stage_view`
- `loop_health` (`healthy | drifting | stalled | terminated`)
- `stage_duration_ms?`
- `negative_feedback_count`
- `last_transition_at`

`StageStallAlert` Minimum Fields:

- `harness_run_id`
- `task_id?`
- `loop_iteration_view`
- `stage_view_ref`
- `stall_reason`
- `created_at`

`FeedbackAccumulator` Minimum Fields:

- `harness_run_id`
- `task_id?`
- `window_started_at`
- `positive_count`
- `neutral_count`
- `negative_count`
- `correction_count`

Rules:

- The Supervisor may only suggest `skip_stage`, `force_loop_exit`, `rollback_improvement`; execution still requires passing through the control-plane / policy boundary.
- `feedback.negative_spike` may only serve as governance and recovery signals and cannot be directly equated with candidate rejection or rollout rollback.
- If the loop has entered `release`, the Supervisor's recovery actions must prioritize protecting rollout audit and evidence integrity.


## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-23: This document originally included `current_step_id` and three severity levels (`info / warning / critical`) in the supervisor main object. The root cause was that the early single-process agent supervision model used business steps as the execution primary key while also adopting generic log levels instead of platform event classification. Fix: The main text now converges instance association keys to `harness_run_id / node_run_id / attempt_id` and changes alert severity to `SEV1-4`.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR may only be used as `oapeflir.view.*` / rationale projections; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.