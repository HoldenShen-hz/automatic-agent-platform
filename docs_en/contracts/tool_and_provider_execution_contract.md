# Tool And Provider Execution Contract

> **OAPEFLIR Association**: This contract defines the tool execution layer of the OAPEFLIR Execute Hub, corresponding to ADR-016.
> **Update Date**: 2026-04-17

## 1. Scope

This contract defines the minimum unified interface for LLM provider calls, tool execution, result encapsulation, error semantics, and budget guards.

## 2. Key Objects

- `ModelRequest`
- `ModelResponse`
- `ToolCallRequest`
- `ToolCallResult`
- `ExecutionError`
- `BudgetReservationDecision`

## 3. ModelRequest Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `request_id` | `string` | Request unique ID |
| `harness_run_id` | `string` | Associated HarnessRun |
| `node_run_id` | `string` | Associated NodeRun |
| `attempt_id` | `string` | Associated NodeAttempt |
| `task_id` | `string?` | Compatibility query entry; not truth primary key |
| `agent_id` | `string` | Initiating role |
| `stage_view_ref` | `string?` | Current closed-loop stage view reference; does not drive execution semantics |
| `domain_id` | `string?` | Current domain |
| `provider` | `string` | Provider identifier |
| `model` | `string` | Target model |
| `messages` | `Message[]` | Input messages |
| `tools` | `string[]?` | Tools allowed for model to call |
| `kv_cache_hint` | `json?` | KV cache partition hint |
| `budget_limit_usd` | `number?` | Budget ceiling for this request |
| `timeout_ms` | `number` | Timeout |

## 4. ModelResponse Minimum Fields

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

- Provider raw response can be archived, but upper layers only consume the unified model.
- `usage` must contain at least input / output token information.
- If response contains tool calls, stable call IDs must be preserved.
- Tool output sanitization rules before entering messages, events, and summaries are defined by `tool_output_sanitization_contract.md`.

## 5. ToolCallRequest Minimum Fields

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

## 6. ToolCallResult Minimum Fields

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

`status` enumeration:

- `succeeded`
- `failed`
- `timed_out`
- `blocked`
- `cancelled`

## 7. BudgetReservationDecision

Must contain at least:

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

- LLM calls must first create or reuse `BudgetReservation` before execution, not just do boolean allow judgment.
- High-risk tool execution must simultaneously pass budget and permission checks.
- Before workflow step actual execution, if structured input/output constraints exist, must first pass `workflow_io_compatibility_precheck_contract.md`.
- After successful execution must produce `BudgetSettlement` or explicit release of reservation; failure or cancellation must also have auditable conclusion.

## 8. Error Semantics

`ExecutionError` must contain at least:

- `code`
- `message`
- `retryable`
- `source`
- `details?`

`source` enumeration:

- `provider`
- `tool`
- `network`
- `security`
- `validation`
- `system`

## 9. Behavior Constraints

- Provider adapters must not leak vendor-specific fields as upper-layer primary semantic dependencies.
- When tools return large files, the main result should become an artifact reference.
- If `timeout_ms` is not explicitly provided in the call request, executor must first resolve `default_timeout_ms` from tool metadata before execution.
- Failure retry must be based on both the tool metadata's recovery strategy and the `retryable` flag in the result, not blind fixed count.
- If call request carries `allowed_path_roots` or execution precheck has already resolved `resolved_paths_json`, tool access paths must satisfy both sandbox and path scope constraints.
- If execution holds `allowed_tools_json`, both direct tool and skill must verify `tool_name` is in the whitelist at runtime; missing execution, illegal JSON, or empty/non-string array items must fail-closed.
- All calls must be traceable back to `task_id`, `agent_id`, `trace_id`.
- All calls must first be traceable back to `harness_run_id`, `node_run_id`, `attempt_id`; `task_id` only serves as compatibility query entry.
- If different tools need to expose additional structured details, should prioritize stable `data / metadata` fields, rather than having upper layers guess top-level fields by tool name.
- Target location rules for `edit / patch / replace` type tools are defined by `edit_replacement_chain_contract.md`.
- Trimming and compaction rules when context approaches token limit are defined by `context_compaction_and_overflow_contract.md`.
- Tools that may generate network egress such as `WebFetch`, `command_exec`, `mcp_call` must resolve and record `egress_targets` before execution, covering at least URL, ssh, s3, registry, publish targets.
- Provider / tool side retries must not each maintain independent limiters; `retry-after`, breaker, provider limiter, tenant limiter, and task limiter should be combined into the same governance surface.
- `question` type tools must return structured options, recommended items, timeout semantics, and skipped semantics, and must not degrade to ordinary text questions.
- `todo_write` type tools must only modify session-level todo state, and must not cross-authority modify task master state.
- If domain tool bundle exists, tool resolution must prioritize the allowed tool set for current `domain_id`; plugin SPI tools must not bypass equivalent sandbox / policy / path constraints.
- `kv_cache_hint` can only provide construction suggestions for fixed prefix / domain block / variable suffix, and must not directly override budget or trimming strategy.
- If cheap-vs-strong model route exists, routing must be conservative, explainable, and deterministic under the same input and same configuration; must record `routing_reason` or equivalent route trace at least.
- Same-provider multi-credential failover should use unified credential pool / cooldown semantics, and must not let each adapter privately maintain "local exhausted state".
- If turn-scoped fallback exists, the current turn allows reusing temporary degraded results through explicit fallback lease, but the next turn must retry the main profile by default; fallback lease must not indefinitely stick as a new sticky profile.
- For provider throttle and quota signals like `429 / 402 / retry-after / reset_at`, should be uniformly written to provider governance state, not just temporarily consumed within a single request.
- Tool name resolution should prioritize exact / alias / normalized exact; only allow fuzzy correction when there is a unique candidate, and must preserve correction trace; ambiguous candidates and suspicious strings must fail-closed.
- If tool argument lenient correction is enabled, it must also be limited to type boundaries that the schema explicitly declares as safely convergeable; unknown fields, structural ambiguity, and high-risk parameters must not be silently auto-corrected.
- If tool argument correction occurs, correction trace must be exposed to auditable result surfaces such as `metadata` or warnings; high-frequency tools like `command_exec`, `edit_replace`, `question`, `todo_write` must not hide corrections in a black box.
- For illegal types or structural ambiguity of high-risk tool parameters, executor must fail-closed with stable error codes, rather than letting the underlying implementation crash from type exceptions.
- `ModelResponse` / `ToolCallResult` if returning user summary or learning signals, must chain back through `NodeAttemptReceipt` or its reference; must not directly treat provider/tool raw results as runtime truth.

## 10. Supplementary Rules

- Streaming chunks must uniformly contain at least: `stream_id`, `sequence`, `event_type`, `payload`.
- Provider fallback observation must record at least: original provider, fallback provider, trigger reason, switch time, impact scope.
- Tool sandbox result summary must record at least: exit status, sanitized summary, artifact refs, policy notes.
- For user-visible text, tool output, and crawled content, NFC normalization should be done first, then control characters and Unicode Tags block should be cleaned to avoid steganographic injection and display layer confusion.


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical paragraphs conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-19: This document originally wrote `task_id / execution_id / agent_id` as provider/tool call primary keys, and compressed budget guard into `BudgetCheckResult.allowed` boolean result. Root cause: old execution contract沿用了单次请求视角 (adopted single-request perspective), did not bind call ownership to `HarnessRun / NodeRun / NodeAttempt` and budget reservation/settlement lifecycle. Fix: This version sets `harness_run_id / node_run_id / attempt_id` as canonical call identity, and converges budget object to `BudgetReservationDecision`.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budget must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
