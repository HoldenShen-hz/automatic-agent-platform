# Tool And Provider Execution Contract

> **OAPEFLIR Related**: This contract defines the tool execution layer of the OAPEFLIR Execute Hub, corresponding to ADR-016.
> **Update Date**: 2026-04-17

## 1. Scope

This contract defines the minimum unified interface for LLM provider invocations, tool execution, result encapsulation, error semantics, and budget guards.

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
| `task_id` | `string?` | Compatible query entry; not truth primary key |
| `agent_id` | `string` | Initiating role |
| `stage_view_ref` | `string?` | Current closed-loop stage view reference; does not drive execution semantics |
| `domain_id` | `string?` | Current domain |
| `provider` | `string` | Provider identifier |
| `model` | `string` | Target model |
| `messages` | `Message[]` | Input messages |
| `tools` | `string[]?` | Tools the model is allowed to call |
| `kv_cache_hint` | `json?` | KV cache partition hint |
| `budget_limit_usd` | `number?` | Budget limit for this request |
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

- Provider raw response may be archived, but upper layer only consumes unified model.
- `usage` must contain at minimum input/output token information.
- If response contains tool calls, stable call id must be preserved.
- Tool output sanitization rules before entering messages, events, and summary are defined by `tool_output_sanitization_contract.md`.

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

`status` enum:

- `succeeded`
- `failed`
- `timed_out`
- `blocked`
- `cancelled`

## 7. BudgetReservationDecision

Must contain at minimum:

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

- Before LLM invocation, must create or reuse `BudgetReservation`, not just make a boolean allow decision.
- High-risk tool execution must simultaneously pass budget and permission checks.
- Before workflow step actually executes, if structured input/output constraints exist, should first pass `workflow_io_compatibility_precheck_contract.md`.
- After successful execution, must produce `BudgetSettlement` or explicitly release reservation; failure or cancellation must also have auditable conclusion.

## 8. Error Semantics

`ExecutionError` must contain at minimum:

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

- Provider adapters must not leak vendor-specific fields into upper-layer primary semantics.
- When tools return large files, the main result should become an artifact reference.
- If call request does not explicitly provide `timeout_ms`, executor must first resolve `default_timeout_ms` from tool metadata before executing.
- Retry decisions must be based simultaneously on the tool metadata's recovery strategy and the `retryable` field in the result, not blindly fixed-count retries.
- If call request carries `allowed_path_roots` or execution precheck has already resolved `resolved_paths_json`, tool access paths must satisfy both sandbox and path scope constraints.
- If execution holds `allowed_tools_json`, both direct tool and skill must verify `tool_name` is in the whitelist at runtime; missing execution, malformed JSON, or empty/non-string array items must fail-closed.
- All invocations must be traceable back to `task_id`, `agent_id`, `trace_id`.
- All invocations must first be traceable back to `harness_run_id`, `node_run_id`, `attempt_id`; `task_id` is only a compatible query entry.
- If different tools need to expose additional structured details, should prioritize putting them in stable `data / metadata` fields, rather than letting upper layer guess top-level fields by tool name.
- Target positioning rules for `edit / patch / replace` tools are defined by `edit_replacement_chain_contract.md`.
- Clipping and compaction rules when context approaches token limit are defined by `context_compaction_and_overflow_contract.md`.
- `WebFetch`, `command_exec`, `mcp_call` and similar tools that may produce network egress must resolve and record `egress_targets` before execution, covering at minimum URL, ssh, s3, registry, publish targets.
- Retry on provider/tool side must not each maintain independent limiters; `retry-after`, breaker, provider limiter, tenant limiter, and task limiter should be combined into the same governance plane.
- `question`-type tools must return structured options, recommendations, timeout semantics, and skip semantics, must not degrade to plain text questions.
- `todo_write`-type tools must only modify session-level todo state, must not overstep to modify task primary state.
- If domain tool bundle exists, tool resolution must prioritize the tool set allowed by current `domain_id`; plugin SPI tools must not bypass equivalent sandbox/policy/path constraints.
- `kv_cache_hint` can only provide building suggestions for fixed prefix/domain block/variable suffix, must not directly override budget or clipping strategy.
- If cheap-vs-strong model route exists, routing must be conservative, explainable, and deterministic under the same input and same configuration; must record `routing_reason` or equivalent route trace at minimum.
- Same-provider multi-credential failover should use unified credential pool/cooldown semantics, must not let each adapter privately maintain "local exhausted state".
- If turn-scoped fallback exists, within the current turn fallback lease allows reusing temporary degraded result, but next turn must default to retrying primary profile; fallback lease must not indefinitely stick into new sticky profile.
- For provider throttling and quota signals like `429 / 402 / retry-after / reset_at`, should write unified provider governance state, not just temporarily consume within a single request.
- Tool name resolution should prioritize exact/alias/normalized exact; only allow fuzzy correction when there is a unique candidate, and must preserve correction trace. Ambiguous candidates and suspicious strings must fail-closed.
- If tool argument lenient correction is enabled, must also be limited to type boundaries that schema explicitly declares as safely convergeable; unknown fields, structural ambiguity, and high-risk parameters must not be silently auto-corrected.
- If tool argument correction occurs, correction trace must be exposed to `metadata` or warnings and other auditable result surfaces; high-frequency tools like `command_exec`, `edit_replace`, `question`, `todo_write` must not hide correction in a black box.
- For illegal types or structural ambiguity of high-risk tool parameters, executor must fail-closed with stable error code, must not let underlying implementation crash due to type exceptions.
- If `ModelResponse` / `ToolCallResult` need to pass user summary or learning signals back, must pass through `NodeAttemptReceipt` or its references to chain back; must not directly treat provider/tool raw results as runtime truth.

## 10. Supplementary Rules

- Streaming chunks must unify at minimum: `stream_id`, `sequence`, `event_type`, `payload`.
- Provider fallback observation must record at minimum: original provider, fallback provider, trigger reason, switch time, impact scope.
- Tool sandbox result summary must record at minimum: exit status, sanitized summary, artifact refs, policy notes.
- For user-visible text, tool output, and scraped content, should first do NFC normalize, then clean control characters and Unicode Tags block to avoid steganographic injection and display layer confusion.


## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical paragraphs conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-19: This document previously wrote `task_id / execution_id / agent_id` as provider/tool invocation primary keys, and compressed budget guard into `BudgetCheckResult.allowed` boolean result. The root cause was old execution contract inherited single-request perspective, did not bind invocation ownership to `HarnessRun / NodeRun / NodeAttempt` and budget reservation/settlement lifecycle. Fix: The main text now sets `harness_run_id / node_run_id / attempt_id` as canonical invocation identity, and converges budget objects to `BudgetReservationDecision`.

Mandatory Rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR must only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.