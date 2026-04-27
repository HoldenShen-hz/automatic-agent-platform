# Context Propagation Contract

> **OAPEFLIR Related**: This contract defines context propagation for OAPEFLIR 8 phases, corresponding to ADR-016.
> **Updated**: 2026-04-17

## 1. Scope

This contract defines runtime context propagation rules based on `AsyncLocalStorage`, avoiding `taskId / sessionId / agentId / traceId / workdir` from being passed layer by layer through deep call chains.

Related Documents:

- `runtime_execution_contract.md`
- `app_error_contract.md`
- `observability_contract.md`
- `tool_and_provider_execution_contract.md`
- [ADR-016 OAPEFLIR Eight-Phase Model](../adr/016-oapeflir-loop-model.md)

## 2. Goals

Phase 1a context propagation must guarantee at least:

- Logs, DB, and tool execution can automatically get current task / execution / trace.
- Cancellation, timeout, and recovery chain can read the same context snapshot.
- Explicit parameters only retain tool-specific configurations, no longer carrying global runtime identity.

## 3. RuntimeContextSnapshot

| Field | Type | Description |
| --- | --- | --- |
| `trace_id` | `string` | Trace ID primary key |
| `span_id` | `string?` | Current span (aligned with `trace_and_root_cause_observability_contract.md` §3) |
| `parent_span_id` | `string?` | Parent span |
| `task_id` | `string` | Current task |
| `execution_id` | `string?` | Current execution |
| `workflow_id` | `string?` | Current workflow |
| `session_id` | `string?` | Current session |
| `agent_id` | `string?` | Current agent |
| `division_id` | `string?` | Current division |
| `oapeflir_stage` | `string?` | Current closed-loop phase |
| `loop_iteration` | `integer?` | Current closed-loop iteration |
| `knowledge_namespace` | `string?` | Current knowledge namespace |
| `memory_layer` | `string?` | Current memory layer |
| `domain_id` | `string?` | Current domain |
| `ref_id` | `string?` | Current typed ref |
| `workdir` | `string?` | Current working directory |
| `request_id` | `string?` | Current external request |
| `approval_id` | `string?` | Current approval context |
| `abort_signal_ref` | `string?` | Cancellation signal reference |
| `budget_scope_id` | `string?` | Budget aggregation scope |

Note: `span_id` and `parent_span_id` are used to locate current execution position in trace tree. Each time entering a new agent step, tool call, or LLM call, `span_id` should be updated via `withContextPatch` and old `span_id` pushed into `parent_span_id`. Phase 1a may not implement complete span tree, but field positions should be preserved to avoid subsequent breaking changes.

## 4. Propagation Entry Points

Must explicitly `provideContext(...)` from one of the following entry points:

- Gateway receives user request
- Scheduler / runtime creates execution
- Recovery chain re-takes over stale run
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

Minimum runtime interface suggestions:

- `provideContext(snapshot, fn)`
- `getContext()`
- `getContextOrNull()`
- `withContextPatch(partial, fn)`
- `assertContext(requiredKeys)`

Rules:

- `getContext()` must explicitly throw error when no context, not return pseudo default value.
- `withContextPatch` can only overwrite partial fields, must not silently lose existing identifiers.
- Background detached tasks must explicitly copy or rebuild context, cannot rely on implicit inheritance.

## 6. Boundary with Explicit Parameters

Contents to keep explicit parameters:

- `timeout_ms`
- `tool arguments`
- `provider model`
- `sandbox options`
- `output destination`

Contents that should no longer be passed layer by layer through explicit parameters:

- `task_id`
- `session_id`
- `agent_id`
- `trace_id`
- `division_id`
- `oapeflir_stage`
- `loop_iteration`
- `knowledge_namespace`
- `memory_layer`
- `domain_id`
- `ref_id`

## 7. Cancellation and Recovery Semantics

- The same context snapshot should be associated with a queryable cancellation signal reference.
- When recovering new execution, new `execution_id` must be created, but same `task_id / trace_id` lineage can be reused.
- Old execution's ALS context must not continue to be reused after recovery.

## 8. Observability and Audit Requirements

All structured logs, events, and DB writes must be able to get from context at least:

- `trace_id`
- `task_id`
- `execution_id?`
- `agent_id?`

Rules:

- If current operation lacks these key fields, should fail early rather than write un关联 records.
- `actor` in audit logs and runtime context fields must not conflict with each other.

## 9. Phase Boundary

Phase 1a explicitly does:

- Single-process `AsyncLocalStorage`
- Unified read entry points for runtime, tool, provider, logging, DB

Currently does not do:

- Cross-process automatic context propagation
- OpenTelemetry full链路 automatic injection
- Remote worker context federation

## 10. Test Requirements

Cover at least:

- Context not lost under nested async calls
- Context not crossed between concurrent tasks
- Detached tasks fail directly if context not explicitly provided
- After recovering execution, `execution_id` refreshed but `task_id / trace_id` maintains lineage continuity

## 11. Closure Conclusion

The focus of context propagation is not passing fewer parameters, but making "who is currently executing what" a fact that any layer at runtime can reliably read.
