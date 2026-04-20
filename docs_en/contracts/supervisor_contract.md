# Supervisor Contract

## 1. Scope

This contract defines the minimum supervisory boundaries of Agent Supervisor over runtime instances, health status, heartbeats, alerts, recovery actions, performance, and evolution proposals.

It is not responsible for directly executing tasks, but for observing, judging, escalating, and auditing.

## 2. Key Objects

- `AgentRuntimeInstance`
- `HealthSnapshot`
- `HeartbeatPolicy`
- `AlertRecord`
- `RecoveryAction`
- `PerformanceReview`
- `EvolutionProposal`

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
- `health` (`healthy | degraded | stalled | failed`)
- `reason?`
- `sampled_at`

## 5. HeartbeatPolicy Minimum Fields

- `expected_interval_sec`
- `stale_after_sec`
- `sample_strategy` (`latest_only | sampled | all_persisted`)

Phase 1a rules:

- Default to `latest_only` or `sampled` to avoid high-frequency heartbeats directly filling the database.
- If no heartbeat is seen after exceeding `stale_after_sec`, Supervisor should mark the instance as `degraded` or `stalled`, not silently ignore it.

## 6. AlertRecord Minimum Fields

- `alert_id`
- `instance_id`
- `severity` (`info | warning | critical`)
- `code`
- `message`
- `created_at`
- `resolved_at?`

Alert severity suggestions:

- `info`: Normal recovery, minor jitter, observability hints.
- `warning`: Stale heartbeat, high retry count, abnormal runtime.
- `critical`: Deadlock, continuous failure, budget overrun, permission exception.

## 7. RecoveryAction Minimum Fields

- `action_id`
- `instance_id`
- `action_type` (`mark_stalled | request_retry | request_cancel | escalate_to_human`)
- `reason`
- `created_at`
- `actor`

Rules:

- Supervisor can suggest or trigger controlled recovery actions, but must not silently overwrite business output.
- Automatic recovery, cancellation, and escalation must all leave audit records.
- High-risk actions must still comply with approval and security contracts.

## 8. Behavioral Constraints

- Supervisor is responsible for monitoring and escalation, not directly tampering with business results.
- Any automatic recovery or termination actions must leave audit records.
- Evolution-related suggestions can only form proposals and cannot take effect directly.
- Supervisor judgments on heartbeat, alert, and recovery should be consistent with the runtime execution contract.

## 9. Relationship with Runtime

- `runtime_execution_contract.md` defines how a single run is checked, executed, retried, and terminated.
- This contract defines who discovers run abnormalities and how alerts and recovery actions are formed.
- `event_bus_contract.md` is responsible for how these signals propagate, not for rewriting supervisory semantics.

## 10. Supplementary Rules

- Under Phase 1b multi-worker topology, supervisor should at least distinguish between node-local monitor and control-plane supervisor.
- Performance scores can only form proposals and must not directly drive prompt / role hot updates; formal effect still requires governance chain approval.
