# Trace And Root Cause Observability Contract

## 1. Scope

This contract defines the trace/span model, business and technical metric layering, and fault root cause analysis assistance capabilities.

Related documents:

- `observability_contract.md`
- `debug_inspect_health_backpressure_contract.md`
- `diagnostics_snapshot_and_repro_bundle_contract.md`
- `event_registry_and_ops_threshold_contract.md`

## 2. Objectives

- Enable a single task to be linked on trace from entry through step, tool, LLM, and decision.
- Separate business dashboard and technical dashboard governance.
- Automatically generate preliminary RCA clues after faults, rather than just leaving scattered logs.

## 3. Trace Model

Minimum hierarchy:

- One task = one `trace`
- One agent step = one `span`
- One tool call = one `span`
- One LLM call = one `span`
- One decision / escalation = one `span`
- One OAPEFLIR stage = one upper-level `span`

Must-propagate correlation fields:

- `trace_id`
- `span_id`
- `parent_span_id`
- `correlation_id`
- `task_id`
- `execution_id`
- `session_id`

Recommended baggage:

- `tenant_id`
- `workspace_id`
- `organization_id?`
- `agent_id?`
- `user_id?`
- `priority?`
- `oapeflir_stage?`
- `loop_iteration?`
- `domain_id?`

## 4. Trace Carrier and Propagation Rules

Recommended carrier types:

- `http_headers`
- `message_attributes`
- `queue_metadata`
- `worker_runtime_context`

Minimum requirements:

- Gateway ingress must be able to create or extract trace context.
- Runtime / worker / gateway / approval / remote bridge must explicitly inject and extract trace context between each other.
- Trace propagation failure must not interrupt main task execution, but must record observability warning.
- Trace sink, callback, subscriber, or exporter exceptions must not reverse interrupt the main execution chain; observability surface defaults to fail-open, but must preserve warning / dropped event evidence.

Recommended fields:

- `traceparent`
- `tracestate`
- `x-correlation-id`
- `x-tenant-scope`

## 5. Trace Sampling

Recommended rules:

| Condition | Sampling Rate |
| --- | --- |
| debug / operator takeover | `100%` |
| error / dead-letter / stale write | `100%` |
| approval / policy escalation | `100%` |
| normal task | `10%` |
| background / periodic maintenance | `1%` |

## 6. Metric Layering

| Layer | Metric Examples |
| --- | --- |
| `oapeflir` | Loop convergence rate, feedback positive/negative ratio, rollout success rate |
| `business` | Task success rate, approval rate, business unit output, user upgrade rate |
| `platform` | Throughput, queue backlog, recovery success rate, lease回收数 |
| `runtime` | Worker heartbeat, execution duration, retry rate, backpressure trigger rate |
| `infra` | DB latency, cache hit, CPU, memory, event loop latency |

## 7. Root Cause Analysis Assistance

Fault view should automatically aggregate at least:

- Recent related events
- Recent related configuration changes
- Recent related prompt / model / policy changes
- Recent related worker / lease switches
- Recent related cost anomalies
- Recent related feedback / learning / rollout actions

## 8. Anomaly Pattern Detection

Must support identifying at least:

- A certain role stuck consecutively on the same step
- A certain tool's recent failure rate surge
- A certain tenant or business unit's cost abnormal increase
- A certain worker's heartbeat jitter anomaly
- A certain loop not converging for a long time
- A certain rollout consecutively blocked or rolled back

## 9. Visualization Goals

```mermaid
flowchart TD
    A["Task Trace"] --> B["Step Spans"]
    B --> C["Tool / LLM / Decision Spans"]
    C --> D["Metrics + Events + Logs"]
    D --> E["RCA Summary"]
```

## 10. Closure Conclusion

Industrial-grade observability cannot stop at "having logs" and "having healthz".

It must support:

- Trace-level chaining
- Business and technical metric layering
- Automatic convergence of root cause clues after faults
