# Supervisor Contract

## 1. Scope

This contract defines the minimum supervisory boundaries for the Agent Supervisor regarding runtime instances, health status, heartbeats, alerts, recovery actions, performance, and OAPEFLIR closed-loop proposals.

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

- `current_node_view_ref` can only express semantic projection and must not reintroduce `HarnessStep` / `current_step_id` as runtime truth primary keys.
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

Phase 1a rules:

- Default to `latest_only` or `sampled` to avoid high-frequency heartbeats directly flooding the database.
- When no heartbeat is seen for longer than `stale_after_sec`, the Supervisor should mark the instance as `degraded` or `stalled`, not silently ignore it.

## 6. AlertRecord Minimum Fields

- `alert_id`
- `instance_id`
- `severity` (`SEV1 | SEV2 | SEV3 | SEV4`)
- `code`
- `message`
- `created_at`
- `resolved_at?`

Alert severity recommendations:

- `SEV4`: Local minor, can auto-recover, mainly for observability hints.
- `SEV3`: Single workflow / single worker impact, such as stale heartbeat, high retry count, abnormal runtime.
- `SEV2`: Single business domain / single tenant significantly affected, such as security policy anomaly, batch failure, budget anomaly spread.
- `SEV1`: Platform-level impact / security event / production serious risk.

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

- Supervisor can recommend or trigger controlled recovery actions but must not silently rewrite business output.
- Auto-recovery, cancellation, and escalation must all leave audit records.
- High-risk actions still need to comply with approval and security contracts.

## 8. Behavioral Constraints

- Supervisor is responsible for monitoring and escalation, not directly tampering with business results.
- Any auto-recovery or termination action must leave an audit record.
- Evolution-related recommendations can only form proposals and cannot take effect directly.
- Supervisor's judgments on heartbeat, alert, and recovery should be consistent with the runtime execution contract.

## 9. Relationship with Runtime

- `runtime_execution_contract.md` defines how a single run prechecks, executes, retries, and terminates.
- This contract defines who detects run anomalies and how alerts and recovery actions are formed.
- `event_bus_contract.md` is responsible for how these signals propagate, not for rewriting supervisory semantics.

## 10. Supplementary Rules

- Under Phase 1b multi-worker topology, supervisor should at least distinguish between node-local monitor and control-plane supervisor.
- Performance scores can only form proposals and cannot directly drive prompt / role hot updates; formal effect still requires governance chain approval.

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

- Supervisor can only recommend `skip_stage`, `force_loop_exit`, `rollback_improvement`; execution still requires going through control-plane / policy boundary.
- `feedback.negative_spike` can only serve as governance and recovery signal and cannot be directly equivalent to candidate rejection or rollout rollback.
- If the loop has entered `release`, Supervisor's recovery actions must prioritize protecting rollout audit and evidence integrity.


## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical paragraphs in this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-23: This document previously wrote `current_step_id` and three severity levels (`info / warning / critical`) into supervisor primary objects. Root cause: Early single-process agent supervision model both used business steps as execution primary keys and reused general log levels instead of platform event classification. Fix: The main text now converges instance association keys to `harness_run_id / node_run_id / attempt_id`, and changes alert severity to `SEV1-4`.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.