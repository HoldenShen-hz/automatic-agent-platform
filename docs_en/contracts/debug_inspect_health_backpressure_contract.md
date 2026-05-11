# Debug Inspect Health Backpressure Contract

---

## OAPEFLIR Association

This contract participates in the following stages of the OAPEFLIR eight-phase cycle:

- **Observe**: Signal collection and aggregation
- **Assess**: Pre-execution assessment and risk judgment
- **Plan**: Task decomposition and DAG construction
- **Execute**: Step execution and fault tolerance
- **Feedback**: Signal collection and preprocessing
- **Learn**: Pattern detection and knowledge extraction
- **Improve**: Improvement candidate evaluation and rollout
- **Release**: Controlled release and rollback

---

## 1. Scope

This contract defines runtime debug entry points, inspect queries, health checks, and backpressure policies.

Related documents:

- `observability_contract.md`
- `api_surface_contract.md`
- `event_registry_and_ops_threshold_contract.md`
- `startup_consistency_and_recovery_drill_contract.md`
- `execution_plane_contract.md`

## 2. Objectives

This document answers 4 questions:

- When problems occur, what can developers and ops see.
- How external systems determine if a service is healthy.
- How to one-click check the complete trace of a single task / harness run / node run.
- How to reject, queue, or degrade when the system is overloaded, instead of continuing to amplify the problem.

## 3. Key Objects

### 3.1 `HealthStatusReport`

| Field | Type | Description |
| --- | --- | --- |
| `status` | `ok \| degraded \| overloaded \| unhealthy` | Overall health status |
| `uptime_seconds` | `number` | Runtime duration |
| `db_writable` | `boolean` | Whether DB is writable |
| `provider_health` | `healthy \| degraded \| failed` | Provider aggregated health |
| `active_executions` | `number` | Number of active executions |
| `queued_tasks` | `number` | Number of queued tasks |
| `oapeflir_loop_health` | `healthy \| drifting \| stalled \| failed?` | Closed-loop aggregated health |
| `knowledge_plane_health` | `healthy \| degraded \| not_enabled?` | Knowledge Plane health or not enabled |
| `active_rollouts` | `number` | Number of current active rollouts |
| `event_loop_lag_ms` | `number?` | Event loop lag |
| `memory_rss_mb` | `number?` | RSS memory |
| `tier1_ack_backlog` | `number` | Tier 1 unacknowledged backlog |

### 3.2 `TaskInspectView`

- `task`
- `harness_run?`
- `node_runs[]`
- `legacy_workflow_projection?`
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

### 4.1 Endpoint

Unified health endpoint:

- `GET /healthz`

Compatibility rules:

- `GET /health` can be used as a compatibility alias
- The authoritative contract uses `/healthz` as the standard

### 4.2 Status Semantics

| status | Meaning | Default HTTP |
| --- | --- | --- |
| `ok` | Service is healthy, can accept traffic | `200` |
| `degraded` | Partial capability degradation, but still serving | `200` |
| `overloaded` | Entering backpressure/degradation state | `429` or `503` |
| `unhealthy` | Core dependencies failed, should not accept traffic | `503` |

### 4.3 Minimum Check Items

Phase 1a required:

- Process alive
- DB writable
- Number of active executions
- Number of queued tasks

Phase 1b enhanced:

- Provider success rate in the last 5 minutes
- Event loop lag
- RSS / memory pressure
- Tier 1 ack backlog

## 5. Inspect Queries

### 5.1 Minimum Interface

- `GET /tasks/:taskId/inspect`
- `GET /harness-runs/:harnessRunId/inspect`
- `GET /node-runs/:nodeRunId/inspect`
- `GET /executions/:executionId/inspect` (legacy compat alias)
- `GET /approvals/:approvalId/inspect`
- `GET /rollouts/:rolloutId/inspect`
- `GET /knowledge/:namespace/inspect`
- `GET /tasks/:taskId/oapeflir-timeline`

### 5.2 Query Requirements

- `task inspect` should be able to restore the task's main state, harness run, node run, approvals, sessions, and event tail
- `task inspect` should be able to display current `stage`, `loop_iteration`, recent feedback / learn / improve / release references
- Inspect output must prioritize reading from the authoritative store, not just relying on in-memory state
- Inspect queries must not modify business state
- If recovery or takeover history exists, inspect should display the most recent recovery decision, trigger reason, and current active execution ownership
- `oapeflir-timeline` should be able to return each round of stage status, key evidence refs, approval gates, and rollout actions in chronological order
- Rollout inspect must be able to restore rollout level, status, metrics, approval, rollback lineage
- Knowledge inspect is an extended entry point; when Knowledge Plane is not enabled, it should return a clear `not_enabled` rather than a 404 to avoid hiding resource non-existence

```mermaid
flowchart TD
    A["Inspect Request"] --> B["Load Task / Execution"]
    B --> C["Join Workflow / Sessions / Approvals"]
    C --> D["Load Recent Events / Artifacts"]
    D --> E["Build Inspect View"]
    E --> F["Return Read-Only Snapshot"]
```

## v4.3 Contract Remediation

- T-63: This document originally anchored the inspect main view on `workflow_state + executions[]`. The root cause was that the debug contract directly inherited the old workflow/execution observation model and did not follow the runtime truth table family switch. Fix: The main body now closes the inspect main chain to `Task -> HarnessRun -> NodeRun[]`. The old execution entry is retained only as a compatibility alias.

## 6. Debug Capabilities

Minimum debugging capabilities:

- Recent structured logs
- Recent event tail
- State snapshots
- Warning / error summary

Rules:

- Debug must not expose sensitive content by default
- High-sensitivity payloads require desensitization or permission-controlled display
- Debug dump is only for problem diagnosis, must not be used as a new source of truth
- `warnings` maintains a compatible string array output, but should be deduplicated by task dimension
- `warning_summary` should aggregate similar warnings, count suppressed duplicates, and provide a minimal escalation path

## 7. Backpressure Policy

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
| Queue backlog | New tasks queued or rejected |
| Provider overloaded | Rate limit / delay / degrade model |
| Memory pressure | Limit new executions, prioritize keeping current tasks alive |
| Event loop lag | Mark as `degraded` or `overloaded` |
| Tier 1 backlog | Pause non-critical traffic, prioritize recovering critical events |
| Queue unfairness / starvation | Adjust priority, promote starved tasks, limit hot tenants or workers |

### 7.3 Degradation Mode

`degradation_mode` enumeration and decision priority (high to low):

| Mode | Trigger Condition | Meaning |
| --- | --- | --- |
| `none` | `status == ok` | No degradation |
| `read_only_operations_only` | DB not writable | Only allow read operations |
| `pause_non_critical` | Tier 1 ack backlog exceeds `overloaded` threshold | Pause non-critical traffic, prioritize recovering critical events |
| `queue_only` | Queue pressure (starvation / backlog / stale busy worker) or severe performance pressure (memory > 110% high watermark or event loop lag > 150% threshold) | New non-high-priority tasks are queued only, not directly executed |
| `fast_only` | Provider unhealthy or moderate performance pressure (memory > high watermark or event loop lag > threshold) | Degrade models, rate limit or delay |

Decision logic:

```
if status == ok:           → none
if !db_writable:           → read_only_operations_only
if tier1_ack_overloaded:   → pause_non_critical
if queue_pressure || severe_performance_pressure: → queue_only
if provider_degraded || performance_pressure:     → fast_only
else:                      → queue_only (conservative default)
```

### 7.3.1 Interaction Between Degradation Mode and Admission Control

`AdmissionController` makes admission decisions based on the current `degradation_mode`:

| Degradation Mode | Admission Strategy |
| --- | --- |
| `read_only_operations_only` | Reject all new tasks (`admission.reject_read_only_mode`) |
| `pause_non_critical` | Only allow high-priority tasks (`high` / `urgent`), normal and low-priority tasks are rejected (`admission.reject_non_critical_paused`) |
| `queue_only` | High-priority tasks execute directly, normal and low-priority tasks are downgraded to queue (`admission.queue_backpressure`) |
| `fast_only` / `none` | Proceed with normal admission checks (budget, backlog, capacity) |

Additional admission protection:

- Reject directly when budget exceeded (`admission.reject_budget_exceeded`)
- Reject low-priority tasks when `starvation_detected` (`admission.reject_starvation_protection`)
- Reject when Tier 1 ack backlog reaches hard limit (`admission.reject_tier1_backlog`)
- Reject or queue when active executions / queued tasks reach limits

Rules:

- Backpressure must not silently discard Tier 1 factual events
- Degradation mode must be observable and auditable
- Admission rejections must return structured `reasonCode`, not just generic errors

### 7.4 Queue Governance

Queue governance at minimum should answer:

- Whether long-term unfair scheduling has occurred
- Whether any entries have been starved for a long time
- Whether backlog is continuously growing abnormally

Recommended thresholds:

- `fairness_index < 0.8`
- `oldest_wait_seconds > starvation_threshold`
- `backlog_growth_rate` continuously exceeding growth window

## 8. Boundary with Execution Plane

- Phase 1a / 1b backpressure is mainly for single-machine runtime
- Queue / worker registry / lease-level backpressure belongs to subsequent execution plane
- Current contract only freezes minimum protection strategies for single-machine phase

## 9. Phase Boundaries

Phase 1a:

- `/healthz` baseline
- `task / execution / approval inspect` basic queries
- Minimum backpressure thresholds
- Ability to track last tool call, failure reason, and recovery history by `taskId`
- `oapeflir-timeline` should at minimum return phase1-4 closed-loop stages, feedback, learning, improvement, release minimal timeline

Phase 1b:

- Debug dump / tail
- Provider success rate
- Event loop lag / memory pressure metrics
- More granular degradation mode

Currently not doing:

- Enterprise monitoring alerting platform
- Cross-machine queue scheduling backpressure
- Web UI complete operations panel

## 10. Closure Conclusion

A system without inspect, health, and backpressure, once a problem occurs, can only rely on guessing; the purpose of this contract is to formally establish boundaries for "what to look at, when to consider it abnormal, and how to scale back when overloaded."