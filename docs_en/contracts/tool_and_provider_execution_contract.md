# Tool And Provider Execution Contract

> **OAPEFLIR Related**: This contract defines the tool execution layer of the OAPEFLIR Execute Hub, corresponding to ADR-016.
> **Last Updated**: 2026-04-17

## 1. Scope

This contract defines the minimal unified interface for LLM provider invocation, tool execution, result encapsulation, error semantics, and budget guarding.

## 2. Key Objects

- `ModelRequest`
- `ModelResponse`
- `ToolCallRequest`
- `ToolCallResult`
- `ExecutionError`
- `BudgetReservationDecision`

## 3. ModelRequest Minimal Fields

| Field | Type | Description |
| --- | --- | --- |
| `request_id` | `string` | Unique request ID |
| `harness_run_id` | `string` | Parent HarnessRun |
| `node_run_id` | `string` | Parent NodeRun |
| `attempt_id` | `string` | Parent NodeAttempt |
| `task_id` | `string?` | Compatible query entry; not a truth primary key |
| `agent_id` | `string` | Originating role |
| `stage_view_ref` | `string?` | Current closed-loop stage view reference; does not drive execution semantics |
| `domain_id` | `string?` | Current domain |
| `provider` | `string` | Provider identifier |
| `model` | `string` | Target model |
| `messages` | `Message[]` | Input messages |
| `tools` | `string[]?` | Tools the model is allowed to call |
| `kv_cache_hint` | `json?` | KV cache partitioning hint |
| `budget_limit_usd` | `number?` | Budget ceiling for this request |
| `timeout_ms` | `number` | Timeout |

## 4. ModelResponse Minimal Fields

- `request_id`
- `provider`
- `model`
- `finish_reason`
- `output_text?`
- `tool_calls?`
- `usage`
- `latency_ms`
- `raw_response_ref?`

Rules:

- Provider raw responses may be archived, but upper layers only consume the unified model.
- `usage` must include at least input/output token information.
- If the response contains tool calls, a stable call ID must be preserved.
- Tool output sanitization rules before entering messages, events, and summaries are defined by `tool_output_sanitization_contract.md`.

## 5. ToolCallRequest Minimal Fields

- `call_id`
- `harness_run_id`
- `node_run_id`
- `attempt_id`
- `task_id?`
- `agent_id`
- `stage_view_ref?`
- `domain_id?`
- `tool_name`
- `arguments`
- `timeout_ms`
- `allowed_path_roots?`
- `requires_approval`
- `egress_targets?`

## 6. ToolCallResult Minimal Fields

- `call_id`
- `tool_name`
- `status`
- `output`
- `success`
- `data?`
- `metadata?`
- `artifacts?`
- `feedback_signals?`
- `knowledge_ref?`
- `duration_ms`
- `error?`
- `follow_up_question?`

`status` enum:

- `succeeded`
- `failed`
- `timed_out`
- `blocked`
- `cancelled`

## 7. BudgetReservationDecision

Must include at minimum:

- `reservation_id`
- `ledger_id`
- `decision` (`reserved | rejected | review_required`)
- `estimated_cost_usd`
- `reserved_amount_usd?`
- `remaining_budget_usd`
- `expires_at?`
- `settlement_required`
- `reason_code?`
- `budget_scope_id?`

Rules:

- Before LLM invocation, a `BudgetReservation` must be created or reused, not just a boolean allow decision.
- High-risk tool execution must pass both budget and permission checks simultaneously.
- Before a workflow step actually executes, if structured input/output constraints exist, `workflow_io_compatibility_precheck_contract.md` should be invoked first.
- After successful execution, a `BudgetSettlement` must be produced or the reservation must be explicitly released; failures or cancellations must also have an auditable conclusion.

## 8. Error Semantics

`ExecutionError` must include at minimum:

- `code`
- `message`
- `retryable`
- `source`
- `details?`

`source` enum:

- `provider`
- `tool`
- `network`
- `security`
- `validation`
- `system`

## 9. Behavioral Constraints

- Provider adapters must not leak provider-specific fields as upper-layer primary semantic dependencies.
- When a tool returns large files, the main result should be converted to an artifact reference.
- If `timeout_ms` is not explicitly provided in the call request, the executor must first resolve `default_timeout_ms` from tool metadata before execution.
- Retry on failure must be based on both the recovery strategy from tool metadata and the `retryable` field in the result; blind fixed-count retries are not allowed.
- If the call request includes `allowed_path_roots` or execution precheck has resolved `resolved_paths_json`, tool access paths must satisfy both sandbox and path scope constraints simultaneously.
- If execution holds `allowed_tools_json`, both direct tools and skills must verify at runtime that `tool_name` is on the whitelist; missing execution, malformed JSON, or null/non-string array items must fail-closed.
- All calls must be traceable back to `task_id`, `agent_id`, and `trace_id`.
- All calls must first be traceable back to `harness_run_id`, `node_run_id`, and `attempt_id`; `task_id` is only a compatible query entry.
- If different tools need to expose additional structured details, these should preferentially go into stable `data / metadata` fields, rather than letting upper layers guess top-level fields by tool name.
- Target location rules for `edit / patch / replace` tools are defined by `edit_replacement_chain_contract.md`.
- Context near token limit clipping and compaction rules are defined by `context_compaction_and_overflow_contract.md`.
- Tools that may produce network egress such as `WebFetch`, `command_exec`, and `mcp_call` must resolve and record `egress_targets` before execution, covering at minimum URL, ssh, s3, registry, and publish targets.
- Provider/tool-side retries must not maintain independent limiters; `retry-after`, breaker, provider limiter, tenant limiter, and task limiter should be combined into the same governance surface.
- `question` tools must return structured options, recommended items, timeout semantics, and skipped semantics; they must not degrade into plain text queries.
- `todo_write` tools must only modify session-level todo state, and must not overstep to modify task primary state.
- If a domain tool bundle exists, tool resolution must prioritize the tool set allowed by the current `domain_id`; plugin SPI tools must not bypass equivalent sandbox / policy / path constraints.
- `kv_cache_hint` can only provide building suggestions for fixed prefix / domain block / variable suffix, and must not directly override budget or clipping strategies.
- If a cheap-vs-strong model route exists, routing must be conservative, explainable, and deterministic under the same input and same configuration; at minimum, `routing_reason` or equivalent route trace must be logged.
- Multi-credential failover within the same provider must use unified credential pool / cooldown semantics, and adapters must not privately maintain "local exhausted state".
- If turn-scoped fallback exists, the current turn allows reuse of temporary degradation results via explicit fallback lease, but the next turn must by default re-attempt the primary profile; fallback lease must not indefinitely stick as a new sticky profile.
- For provider throttling and quota signals such as `429 / 402 / retry-after / reset_at`, these should be written to provider governance state uniformly, not just temporarily consumed within a single request.
- Tool name resolution should prioritize exact / alias / normalized exact; fuzzy correction is only allowed when there is a unique candidate, and correction trace must be preserved. Ambiguous candidates and suspicious strings must fail-closed.
- If tool argument lenient correction is enabled, it must also be limited to type boundaries that the schema explicitly identifies as safely convergent; unknown fields, structural ambiguity, and high-risk parameters must not be silently auto-corrected.
- If tool argument correction occurs, the correction trace must be exposed to auditable result surfaces such as `metadata` or warnings; high-frequency tools such as `command_exec`, `edit_replace`, `question`, and `todo_write` must not hide corrections in a black box.
- For illegal types or structural ambiguity of high-risk tool parameters, the executor must fail-closed with a stable error code, rather than letting the underlying implementation crash from type exceptions.
- If `ModelResponse` / `ToolCallResult` need to pass user summaries or learning signals back, they must do so through `NodeAttemptReceipt` or its reference chain; provider/tool raw results must not be treated directly as runtime truth.

## 10. Supplementary Rules

- Streaming chunks must uniformly include at minimum: `stream_id`, `sequence`, `event_type`, `payload`.
- Provider fallback observation must log at minimum: original provider, fallback provider, trigger reason, switch time, and impact scope.
- Tool sandbox result summary must log at minimum: exit status, sanitized summary, artifact refs, and policy notes.
- For user-visible text, tool output, and scraped content, NFC normalization should be applied first, followed by control character and Unicode Tags block cleanup, to avoid steganographic injection and display-layer confusion.


## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical sections conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-19: This document originally used `task_id / execution_id / agent_id` as provider/tool call primary keys and compressed budget guarding into a `BudgetCheckResult.allowed` boolean result. The root cause was that the old execution contract reused a single-request perspective and did not bind call attribution to `HarnessRun / NodeRun / NodeAttempt` and budget reservation/settlement lifecycles. Fix: The main text now sets `harness_run_id / node_run_id / attempt_id` as the canonical call identity and converges budget objects to `BudgetReservationDecision`.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR must only appear as `oapeflir.view.*` / rationale projections; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
