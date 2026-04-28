# Trace And Root Cause Observability Contract

## 1. Scope

This contract defines the trace/span model, business and technical metric stratification, and fault root cause analysis assistance capabilities.

Related documents:

- `observability_contract.md`
- `debug_inspect_health_backpressure_contract.md`
- `diagnostics_snapshot_and_repro_bundle_contract.md`
- `event_registry_and_ops_threshold_contract.md`

## 2. Objectives

- Enable a single `HarnessRun` to be traced end-to-end from entry through nodes, tools, LLMs, and decisions.
- Separate governance of business dashboards and technical dashboards.
- Automatically generate preliminary RCA clues after failures, rather than leaving only scattered logs.

## 3. Trace Model

Minimum hierarchy:

- One `HarnessRun` = one `trace`
- One `NodeRun` = one main execution `span`
- One `NodeAttempt` = one attempt `span`
- One tool call = one `span`
- One LLM call = one `span`
- One decision / escalation = one `span`
- One `oapeflir.view.*` stage explanation may be mapped as an upper-layer view span, but must not serve as runtime truth

Required correlation fields:

- `trace_id`
- `span_id`
- `parent_span_id`
- `correlation_id`
- `harness_run_id`
- `node_run_id?`
- `attempt_id?`
- `task_id?`
- `execution_id?`
- `session_id`

Recommended baggage:

- `tenant_id`
- `workspace_id`
- `organization_id?`
- `agent_id?`
- `user_id?`
- `priority?`
- `stage_view_ref?`
- `loop_iteration?`
- `domain_id?`

## 4. Trace Carrier and Propagation Rules

Recommended carrier types:

- `http_headers`
- `message_attributes`
- `queue_metadata`
- `worker_runtime_context`

Minimum requirements:

- Gateway ingress must create or extract trace context.
- Runtime / worker / gateway / approval / remote bridge must explicitly inject and extract trace context.
- Trace propagation failure must not interrupt main task execution, but must log an observability warning.
- Exceptions from trace sinks, callbacks, subscribers, or exporters must not reverse-interrupt the main execution chain; the observability surface defaults to fail-open, but must preserve warning / dropped event evidence.

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
| normal harness run | `10%` |
| background / periodic maintenance | `1%` |

## 6. Metric Stratification

| Layer | Example Metrics |
| --- | --- |
| `oapeflir` | loop convergence rate, feedback positive/negative ratio, rollout success rate |
| `business` | task success rate, approval rate, division output, user escalation rate |
| `platform` | throughput, queue backlog, recovery success rate, lease reclamation count |
| `runtime` | worker heartbeat, execution duration, retry rate, backpressure trigger rate |
| `infra` | DB latency, cache hit rate, CPU, memory, event loop latency |

## 7. Root Cause Analysis Assistance

The fault view should automatically aggregate at minimum:

- Recent related events
- Recent related configuration changes
- Recent related prompt / model / policy changes
- Recent related worker / lease switches
- Recent related cost anomalies
- Recent related feedback / learning / rollout actions

## 8. Anomaly Pattern Detection

Must support identifying at minimum:

- A role stuck consecutively on the same node
- A tool with recently spiked failure rate
- A tenant or division with anomalous cost increase
- A worker with anomalous heartbeat jitter
- A loop that has not converged for a long time
- A rollout consecutively blocked or rolled back

## 9. Visualization Goals

```mermaid
flowchart TD
    A["HarnessRun Trace"] --> B["NodeRun / NodeAttempt Spans"]
    B --> C["Tool / LLM / Decision Spans"]
    C --> D["Metrics + Events + Logs"]
    D --> E["RCA Summary"]
```

## 10. Closure Conclusion

Industrial-grade observability cannot stop at "having logs" and "having healthz".

It must support:

- HarnessRun-level trace chaining
- Business and technical metric stratification
- Automatic aggregation of root cause clues after failures

## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical sections conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-39: This document originally treated `task` as the trace subject. The root cause was that the observability contract inherited the old task-centric single-machine execution model and was not rewritten along with `HarnessRun / NodeRun / NodeAttempt` becoming runtime truth. Fix: The main text now explicitly states "one HarnessRun = one trace", elevates `harness_run_id / node_run_id / attempt_id` to required correlation fields, and `task_id / execution_id` are retained only as legacy / projection correlation keys.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR may only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
