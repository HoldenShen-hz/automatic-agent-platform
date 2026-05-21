# Context Propagation Contract

> **OAPEFLIR Association**: This contract defines context propagation across the OAPEFLIR 8 stages, corresponding to ADR-016.
> **Update Date**: 2026-04-17

## 1. Scope

This contract defines runtime context propagation rules based on `AsyncLocalStorage`, avoiding the need to pass `taskId / sessionId / agentId / traceId / workdir` explicitly through deep call chains.

Related documents:

- `runtime_execution_contract.md`
- `app_error_contract.md`
- `observability_contract.md`
- `tool_and_provider_execution_contract.md`
- [ADR-016 OAPEFLIR 8-Stage Model](../adr/016-oapeflir-loop-model.md)

## 2. Goals

Phase 1a context propagation must ensure at minimum:

- Logs, DB, and tool execution can automatically access the current run / node / attempt / trace.
- Cancellation, timeout, and recovery chains can read the same context snapshot.
- Explicit parameters retain only tool-specific configuration, no longer carrying global runtime identity.

## 3. `RuntimeContextSnapshot`

| Field | Type | Description |
| --- | --- | --- |
| `trace_id` | `string` | Trace correlation primary key |
| `span_id` | `string?` | Current span (aligned with `trace_and_root_cause_observability_contract.md` §3) |
| `parent_span_id` | `string?` | Parent span |
| `harness_run_id` | `string` | Current HarnessRun |
| `node_run_id` | `string?` | Current NodeRun |
| `attempt_id` | `string?` | Current NodeAttempt |
| `plan_graph_id` | `string?` | Current execution graph ID |
| `graph_version` | `integer?` | Current execution graph version |
| `task_id` | `string?` | Legacy task query entry |
| `execution_id` | `string?` | Legacy execution query entry |
| `workflow_id` | `string?` | Legacy workflow query entry |
| `session_id` | `string?` | Current session |
| `agent_id` | `string?` | Current agent |
| `division_id` | `string?` | Current division |
| `stage_view_ref` | `string?` | Current loop stage view reference |
| `loop_iteration_view` | `integer?` | Current loop iteration projection |
| `knowledge_namespace` | `string?` | Current knowledge namespace |
| `memory_layer` | `string?` | Current memory layer |
| `domain_id` | `string?` | Current domain |
| `ref_id` | `string?` | Current typed ref |
| `workdir` | `string?` | Current working directory |
| `request_id` | `string?` | Current external request |
| `approval_id` | `string?` | Current approval context |
| `abort_signal_ref` | `string?` | Cancellation signal reference |
| `budget_scope_id` | `string?` | Budget aggregation scope |

Note: `span_id` and `parent_span_id` are used to locate the current execution position in the trace tree. Each time a new `NodeAttempt`, tool call, or LLM call is entered, `span_id` should be updated via `withContextPatch` and the old `span_id` pushed into `parent_span_id`. Phase 1a may not implement a complete span tree, but the field positions must be reserved to avoid future breaking changes.

## 4. Propagation Entry Points

Context must be explicitly `provideContext(...)` at one of the following entry points:

- Gateway receives user request
- Scheduler / runtime creates execution
- Recovery chain re-takes stale run
- Approval resume resumes execution

```mermaid
flowchart TD
    A["Gateway / Scheduler / Recovery Entry"] --> B["provideContext(snapshot, fn)"]
    B --> C["Planner / Orchestrator"]
    C --> D["Tool Executor"]
    C --> E["Provider Adapter"]
    D --> F["Logger / DB / Event Writer"]
    E --> F
```

## 5. API Constraints

Minimum runtime interface recommendations:

- `provideContext(snapshot, fn)`
- `getContext()`
- `getContextOrNull()`
- `withContextPatch(partial, fn)`
- `assertContext(requiredKeys)`

Rules:

- `getContext()` must explicitly throw an error when no context is available, not return a pseudo-default value.
- `withContextPatch` can only overwrite local fields, must not silently lose existing identifiers.
- Background detached tasks must explicitly copy or rebuild context, cannot rely on implicit inheritance.

## 6. Boundary with Explicit Parameters

Content to preserve as explicit parameters:

- `timeout_ms`
- `tool arguments`
- `provider model`
- `sandbox options`
- `output destination`

Content that should NO longer be passed through layers as explicit parameters:

- `harness_run_id`
- `node_run_id`
- `attempt_id`
- `plan_graph_id`
- `graph_version`
- `task_id`
- `session_id`
- `agent_id`
- `trace_id`
- `division_id`
- `stage_view_ref`
- `loop_iteration_view`
- `knowledge_namespace`
- `memory_layer`
- `domain_id`
- `ref_id`

## 7. Cancellation and Recovery Semantics

- The same context snapshot should be associated with a queryable cancellation signal reference.
- When recovering a new attempt, a new `attempt_id` must be created; if node-level recovery occurs, `node_run_id` or its attempt lineage must also be refreshed, while maintaining `harness_run_id / trace_id` continuity.
- Old attempt ALS context must not be reused after recovery.

## 8. Observability and Audit Requirements

All structured logs, events, and DB writes must be able to obtain at minimum from context:

- `trace_id`
- `harness_run_id`
- `node_run_id?`
- `attempt_id?`
- `agent_id?`

Rules:

- If the current operation lacks these critical fields, it should fail early rather than write untraceable records.
- The `actor` in audit logs must not conflict with runtime context fields.
- If the compatibility layer still reads `task_id / execution_id`, it must also be able to trace back to `harness_run_id / node_run_id / attempt_id` from the same snapshot.

## 9. Phase Boundaries

Phase 1a explicitly does:

- Single-process `AsyncLocalStorage`
- Unified read access for runtime, tool, provider, logging, DB

Currently does NOT do:

- Automatic cross-process context propagation
- OpenTelemetry full end-to-end automatic injection
- Remote worker context federation

## 10. Test Requirements

Must cover at minimum:

- Context not lost under nested async calls
- Context not crossed between concurrent tasks
- Detached tasks fail directly if context not explicitly provided
- After recovery attempt, `attempt_id` refreshed but `harness_run_id / trace_id` maintain lineage continuity

## 11. Closure Conclusion

The focus of context propagation is not passing fewer parameters, but making "who is currently executing what" a reliably readable fact at any runtime layer.


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical paragraphs conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-18: This document previously used `task_id / execution_id / workflow_id` as ALS primary identity. The root cause was that context contract directly reused old gateway/runtime parameter passing model and did not upgrade along with `HarnessRun / NodeRun / PlanGraphBundle / NodeAttempt` truth model. Fix: The text now elevates `harness_run_id / node_run_id / attempt_id / plan_graph_id / graph_version` to snapshot primary keys, old fields only retain as compatibility query entries.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events can only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budget must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.