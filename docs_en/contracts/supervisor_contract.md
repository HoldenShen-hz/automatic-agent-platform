# Supervisor Contract

## 1. Scope

This contract defines the minimum supervision boundary for Agent Supervisor over runtime instances, health status, heartbeats, alerts, recovery actions, performance, and OAPEFLIR closed-loop proposals.

It is not responsible for directly executing tasks, but for observing, judging, escalating, and auditing.

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

- `current_node_view_ref` can only express semantic projection; must not reintroduce `HarnessStep` / `current_step_id` as runtime truth primary key.
- Any supervisor recovery, alert, or takeover action must be traceable back to `harness_run_id / node_run_id / attempt_id`.

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

- Default to `latest_only` or `sampled` to avoid high-frequency heartbeat directly flooding the database.
- When heartbeat is not seen for more than `stale_after_sec`, Supervisor should mark instance as `degraded` or `stalled`, not silently ignore.

## 6. AlertRecord Minimum Fields

- `alert_id`
- `instance_id`
- `severity` (`SEV1 | SEV2 | SEV3 | SEV4`)
- `code`
- `message`
- `created_at`
- `resolved_at?`

Alert severity recommendations:

- `SEV4`: Local minor, auto-recoverable, mainly for observation hints.
- `SEV3`: Single workflow / single worker impact, e.g., stale heartbeat, high retry count, abnormal runtime.
- `SEV2`: Single business domain / single tenant significantly affected, e.g., security policy anomaly, batch failure, budget anomaly spread.
- `SEV1`: Platform-level impact / security incident / production severe risk.

Recommended alert code baseline:

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

- Supervisor can suggest or trigger controlled recovery actions, but must not silently rewrite business output.
- Auto-recovery, cancel, and escalation must all leave audit records.
- High-risk actions must still obey approval and security contracts.

## 8. Behavioral Constraints

- Supervisor is responsible for monitoring and escalation, not directly tampering with business results.
- Any auto-recovery or termination action must leave audit records.
- Evolution-related suggestions can only form proposals, cannot take effect directly.
- Supervisor's judgments on heartbeat, alert, and recovery should be consistent with runtime execution contract.

## 9. Relationship with Runtime

- `runtime_execution_contract.md` defines how a single run prechecks, executes, retries, and terminates.
- This contract defines who discovers run anomalies and how to form alerts and recovery actions.
- `event_bus_contract.md` is responsible for how these signals propagate, not for rewriting supervision semantics.

## 10. Supplementary Rules

- Under Phase 1b multi-worker topology, supervisor should at least distinguish node-local monitor from control-plane supervisor.
- Performance scoring can only form proposals, must not directly drive prompt / role hot updates; formal governance chain approval is still required for activation.

## 10A. OAPEFLIR Loop Monitoring

`LoopHealthSnapshot` minimum fields:

- `harness_run_id`
- `task_id?`
- `loop_iteration_view`
- `current_stage_view`
- `loop_health` (`healthy | drifting | stalled | terminated`)
- `stage_duration_ms?`
- `negative_feedback_count`
- `last_transition_at`

`StageStallAlert` minimum fields:

- `harness_run_id`
- `task_id?`
- `loop_iteration_view`
- `stage_view_ref`
- `stall_reason`
- `created_at`

`FeedbackAccumulator` minimum fields:

- `harness_run_id`
- `task_id?`
- `window_started_at`
- `positive_count`
- `neutral_count`
- `negative_count`
- `correction_count`

Rules:

- Supervisor can only suggest `skip_stage`, `force_loop_exit`, `rollback_improvement`; execution still requires going through control-plane / policy boundary.
- `feedback.negative_spike` can only serve as governance and recovery signal, must not directly equate to candidate rejection or release rollback.
- If loop has entered `release`, Supervisor's recovery actions must prioritize protecting release audit and evidence integrity.


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical sections conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-23: This document originally wrote `current_step_id` and `info / warning / critical` three-tier severity into supervisor main objects. The root cause was early single-process agent supervision model used business steps as execution primary key and continued using generic log levels instead of platform event classification. Fix: The main text now converges instance association keys to `harness_run_id / node_run_id / attempt_id`, and changes alert severity to `SEV1-4`.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR may only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
