# Supervisor Contract

## 1. Scope

This contract defines Agent Supervisor's minimum supervision boundaries for runtime instances, health status, heartbeats, alerts, recovery actions, performance, and OAPEFLIR closed-loop proposals.

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
- `task_id`
- `execution_id?`
- `status`
- `started_at`
- `last_heartbeat_at`
- `current_step_id?`

## 4. HealthSnapshot Minimum Fields

- `instance_id`
- `health` (`healthy \| degraded \| stalled \| failed`)
- `current_stage?`
- `loop_iteration?`
- `negative_feedback_ratio?`
- `reason?`
- `sampled_at`

## 5. HeartbeatPolicy Minimum Fields

- `expected_interval_sec`
- `stale_after_sec`
- `sample_strategy` (`latest_only \| sampled \| all_persisted`)

Phase 1a rules:

- Defaults to `latest_only` or `sampled`, avoiding high-frequency heartbeat directly filling database.
- When heartbeat not seen after exceeding `stale_after_sec`, Supervisor should mark instance as `degraded` or `stalled`, not silently ignore.

## 6. AlertRecord Minimum Fields

- `alert_id`
- `instance_id`
- `severity` (`info \| warning \| critical`)
- `code`
- `message`
- `created_at`
- `resolved_at?`

Alert classification recommendations:

- `info`: Normal recovery, minor jitter, observability hints.
- `warning`: Stale heartbeat, high retry count, abnormal runtime.
- `critical`: Deadlock, continuous failure, budget overrun, permission exception.

Recommended alert code baseline:

- `oapeflir.stage_stalled`
- `oapeflir.loop_diverging`
- `feedback.negative_spike`

## 7. RecoveryAction Minimum Fields

- `action_id`
- `instance_id`
- `action_type` (`mark_stalled \| request_retry \| request_cancel \| escalate_to_human \| skip_stage \| force_loop_exit \| rollback_improvement`)
- `reason`
- `created_at`
- `actor`

Rules:

- Supervisor can suggest or trigger controlled recovery actions, but must not silently overwrite business output.
- Auto recovery, cancel, escalation must all leave audit records.
- Evolution-related suggestions can only form proposals, cannot take effect directly.
- Supervisor's judgments on heartbeat, alert, recovery should be consistent with runtime execution contract.

## 8. Behavioral Constraints

- Supervisor is responsible for monitoring and escalation, does not directly tamper business results.
- Any auto recovery or termination action must leave audit record.
- Evolution-related suggestions can only form proposals, cannot take effect directly.
- Supervisor's judgment on heartbeat, alert, recovery should be consistent with runtime execution contract.

## 9. Relationship with Runtime

- `runtime_execution_contract.md` defines how single run prechecks, executes, retries, and terminates.
- This contract defines who discovers run anomalies, and how to form alerts and recovery actions.
- `event_bus_contract.md` is responsible for how these signals propagate, not responsible for rewriting supervision semantics.

## 10. Supplementary Rules

- Under Phase 1b multi-worker topology, supervisor should at minimum distinguish node-local monitor from control-plane supervisor.
- Performance scoring can only form proposals, must not directly drive prompt / role hot updates; formal effect still requires governance chain approval.

## 10A. OAPEFLIR Loop Monitoring

`LoopHealthSnapshot` minimum fields:

- `task_id`
- `loop_iteration`
- `current_stage`
- `loop_health` (`healthy \| drifting \| stalled \| terminated`)
- `stage_duration_ms?`
- `negative_feedback_count`
- `last_transition_at`

`StageStallAlert` minimum fields:

- `task_id`
- `loop_iteration`
- `stage`
- `stall_reason`
- `created_at`

`FeedbackAccumulator` minimum fields:

- `task_id`
- `window_started_at`
- `positive_count`
- `neutral_count`
- `negative_count`
- `correction_count`

Rules:

- Supervisor can only suggest `skip_stage`, `force_loop_exit`, `rollback_improvement`, whether to execute still requires going through control-plane / policy boundary.
- `feedback.negative_spike` can only serve as governance and recovery signal, cannot be directly equivalent to candidate rejection or rollout rollback.
- If loop has entered `release`, Supervisor's recovery actions must prioritize protecting rollout audit and evidence integrity.
