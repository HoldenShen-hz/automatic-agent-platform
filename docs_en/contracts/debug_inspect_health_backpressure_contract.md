# Debug Inspect Health Backpressure Contract

## 1. Scope

This contract defines runtime debugging entrypoints, inspect queries, health checks, and backpressure strategies.

Related documents:

- `observability_contract.md`
- `api_surface_contract.md`
- `event_registry_and_ops_threshold_contract.md`
- `startup_consistency_and_recovery_drill_contract.md`
- `execution_plane_contract.md`

## 2. Goals

This document answers 4 questions:

- When problems occur, what can developers and operators see.
- How external systems determine if the service is healthy.
- How to check the complete trace of a single task / workflow / execution with one click.
- How the system rejects, queues, or degrades when overloaded, rather than continuing to amplify the problem.

## 3. Key Objects

### 3.1 `HealthStatusReport`

| Field | Type | Description |
| --- | --- | --- |
| `status` | `ok \| degraded \| overloaded \| unhealthy` | Overall health status |
| `uptime_seconds` | `number` | Uptime |
| `db_writable` | `boolean` | Whether DB is writable |
| `provider_health` | `healthy \| degraded \| failed` | Provider aggregated health |
| `active_executions` | `number` | Active execution count |
| `queued_tasks` | `number` | Queued task count |
| `oapeflir_loop_health` | `healthy \| drifting \| stalled \| failed?` | Closed-loop aggregated health |
| `knowledge_plane_health` | `healthy \| degraded \| not_enabled?` | Knowledge Plane health or not enabled |
| `active_rollouts` | `number` | Current active rollout count |
| `event_loop_lag_ms` | `number?` | Event loop lag |
| `memory_rss_mb` | `number?` | RSS memory |
| `tier1_ack_backlog` | `number` | Tier 1 unacknowledged backlog |

### 3.2 `TaskInspectView`

- `task`
- `workflow_state?`
- `executions[]`
- `approvals[]`
- `sessions[]`
- `recent_events[]`
- `artifacts[]`
- `recovery_summary?`
- `current_stage?`
- `loop_iteration?`
- `oapeflir_timeline?`
- `feedback_signals[]?`
- `learning_objects[]?`
- `improvement_candidates[]?`
- `rollout_records[]?`

### 3.3 `DebugDump`

- `trace_id`
- `recent_logs`
- `state_snapshots`
- `event_tail`
- `warnings`
- `warning_summary`

### 3.4 `BackpressurePolicy`

- `max_queued_tasks`
- `max_active_executions`
- `provider_concurrency_limit`
- `memory_high_watermark_mb`
- `event_loop_lag_threshold_ms`
- `degradation_mode`

### 3.5 `QueueGovernanceMetrics`

- `queue_id`
- `fairness_index?`
- `min_share?`
- `max_share?`
- `oldest_wait_seconds`
- `backlog_size`
- `backlog_growth_rate?`
- `starvation_detected`

## 4. Health Checks

### 4.1 Endpoints

Unified health endpoint:

- `GET /healthz`

Compatibility rules:

- `GET /health` can be used as a compatibility alias
- Authoritative contract uses `/healthz` as the standard

### 4.2 Status Semantics

| status | Meaning | Default HTTP |
| --- | --- | --- |
| `ok` | Service healthy, can accept traffic normally | `200` |
| `degraded` | Some capabilities degraded but still serving | `200` |
| `overloaded` | Entering backpressure/degradation state | `429` or `503` |
| `unhealthy` | Core dependencies failed, should not accept traffic | `503` |

### 4.3 Minimum Check Items

Phase 1a mandatory:

- Process alive
- DB writable
- Active execution count
- Queued task count

Phase 1b enhancements:

- Provider success rate in last 5 minutes
- Event loop lag
- RSS / memory pressure
- Tier 1 ack backlog

## 5. Inspect Queries

### 5.1 Minimum Interfaces

- `GET /tasks/:taskId/inspect`
- `GET /executions/:executionId/inspect`
- `GET /approvals/:approvalId/inspect`
- `GET /rollouts/:rolloutId/inspect`
- `GET /knowledge/:namespace/inspect`
- `GET /tasks/:taskId/oapeflir-timeline`

### 5.2 Query Requirements

- `task inspect` should be able to restore the task's primary state, workflow, execution, approvals, sessions, and event tail
- `task inspect` should be able to display current `stage`, `loop_iteration`, and recent feedback / learn / improve / release references
- Inspect output must prioritize reading from authoritative store, not just relying on in-memory state
- Inspect queries must not change business state
- If there is recovery or takeover history, inspect should display the most recent recovery decision, trigger reason, and current active execution ownership
- `oapeflir-timeline` should be able to return each stage status in time order, key evidence refs, approval gates, and rollout actions
- Rollout inspect must be able to restore rollout level, status, metrics, approval, and rollback lineage
- Knowledge inspect is an extended entrypoint; when Knowledge Plane is not enabled, it should return explicit `not_enabled` rather than 404 disguised as resource not existing

```mermaid
flowchart TD
    A["Inspect Request"] --> B["Load Task / Execution"]
    B --> C["Join Workflow / Sessions / Approvals"]
    C --> D["Load Recent Events / Artifacts"]
    D --> E["Build Inspect View"]
    E --> F["Return Read-Only Snapshot"]
```

## 6. Debug Capabilities

Minimum debugging capabilities:

- recent structured logs
- recent event tail
- state snapshots
- warning / error summary

Rules:

- Debug must not expose sensitive content by default
- High-sensitivity payloads need sanitization or permission-controlled display
- Debug dump is only for problem localization and must not be used as a new source of truth
- `warnings` maintains compatible string array output but should deduplicate display by task dimension
- `warning_summary` should aggregate similar alerts, count suppressed duplicates, and provide minimum escalation path

## 7. Backpressure Strategy

### 7.1 Trigger Conditions

At minimum consider:

- `queued_tasks > max_queued_tasks`
- `active_executions > max_active_executions`
- Provider concurrency exceeded
- `memory_rss_mb > memory_high_watermark_mb`
- `event_loop_lag_ms > event_loop_lag_threshold_ms`
- Tier 1 ack backlog continuously exceeding threshold
- Queue fairness continuously deteriorating
- Starvation entry exceeding wait threshold

### 7.2 Actions

| Scenario | Action |
| --- | --- |
| Queue backlog | New tasks queue or reject |
| Provider overload | Rate limit / delay / degrade model |
| Memory pressure | Limit new executions, prioritize keeping current tasks alive |
| Event loop lag | Mark `degraded` or `overloaded` |
| Tier 1 backlog | Pause non-critical traffic, prioritize recovering critical events |
| Queue unfairness / starvation | Adjust priority, promote starved tasks, limit hot tenants or workers |

### 7.3 Degradation Mode

`degradation_mode` enumeration and decision priority (high to low):

| Mode | Trigger Condition | Meaning |
| --- | --- | --- |
| `none` | `status == ok` | No degradation |
| `read_only_operations_only` | DB not writable | Only allow read operations |
| `pause_non_critical` | Tier 1 ack backlog exceeds `overloaded` threshold | Pause non-critical traffic, prioritize recovering critical events |
| `queue_only` | Queue pressure (starvation / backlog / stale busy worker) or severe performance pressure (memory > 110% high watermark or event loop lag > 150% threshold) | New non-high-priority tasks only queue, do not execute directly |
| `fast_only` | Provider unhealthy or general performance pressure (memory > high watermark or event loop lag > threshold) | Degrade model, rate limit, or delay |

Decision logic:

```
if status == ok:           → none
if !db_writable:           → read_only_operations_only
if tier1_ack_overloaded:   → pause_non_critical
if queue_pressure || severe_performance_pressure: → queue_only
if provider_degraded || performance_pressure:     → fast_only
else:                      → queue_only (conservative default)
```

### 7.3.1 Integration of Degradation Mode and Admission Control

`AdmissionController` makes admission decisions based on current `degradation_mode`:

| Degradation Mode | Admission Strategy |
| --- | --- |
| `read_only_operations_only` | Reject all new tasks (`admission.reject_read_only_mode`) |
| `pause_non_critical` | Only allow high-priority tasks (`high` / `urgent`), regular and low-priority tasks rejected (`admission.reject_non_critical_paused`) |
| `queue_only` | High-priority tasks execute directly, regular and low-priority tasks degrade to queuing (`admission.queue_backpressure`) |
| `fast_only` / `none` | Enter normal admission check (budget, backlog, capacity) |

Additional admission protection:

- Reject directly when budget exceeded (`admission.reject_budget_exceeded`)
- Reject low-priority tasks when `starvation_detected` (`admission.reject_starvation_protection`)
- Reject when Tier 1 ack backlog reaches hard limit (`admission.reject_tier1_backlog`)
- Reject or queue when active executions / queued tasks reach limit

Rules:

- Backpressure must not silently discard Tier 1 factual events
- Degradation mode must be observable and auditable
- Admission rejection must return structured `reasonCode` and must not only return generalized errors

### 7.4 Queue Governance

Queue governance should at minimum answer:

- Whether long-term unfair scheduling has occurred
- Whether any entry has been starved for a long time
- Whether backlog is continuously abnormally growing

Recommended thresholds:

- `fairness_index < 0.8`
- `oldest_wait_seconds > starvation_threshold`
- `backlog_growth_rate` continuously exceeding growth window

## 8. Boundary with Execution Plane

- Phase 1a / 1b backpressure is mainly for single-machine runtime
- Queue / worker registry / lease level backpressure belongs to subsequent execution plane
- Current contract only freezes single-machine phase minimum protection strategy

## 9. Phase Boundaries

Phase 1a does:

- `/healthz` baseline
- Basic query for task / execution / approval inspect
- Minimum backpressure thresholds
- Ability to trace last tool call, failure reason, and recovery history by `taskId`
- `oapeflir-timeline` at minimum can return phase1-4 closed-loop stages, feedback, learning, improvement, and release minimum timeline

Phase 1b does:

- debug dump / tail
- provider success rate
- event loop lag / memory pressure metrics
- More detailed degradation mode

Currently does not do:

- Enterprise monitoring and alerting platform
- Cross-machine queue scheduling backpressure
- Complete web UI operations panel

## 10. Closure Conclusion

Without inspect, health, and backpressure, when problems occur in a system, you can only guess; the role of this contract is to first establish formal boundaries for "what to see, when is it abnormal, and how to scale back when overloaded."
