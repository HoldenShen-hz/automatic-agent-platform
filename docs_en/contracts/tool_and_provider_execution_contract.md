# Tool And Provider Execution Contract

## 1. Scope

This contract defines the minimum unified interface for LLM provider calls, tool execution, result encapsulation, error semantics, and budget guards.

## 2. Key Objects

- `ModelRequest`
- `ModelResponse`
- `ToolCallRequest`
- `ToolCallResult`
- `ExecutionError`
- `BudgetCheckResult`

## 3. ModelRequest Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `request_id` | `string` | Request unique ID |
| `task_id` | `string` | Associated task |
| `agent_id` | `string` | Initiating role |
| `provider` | `string` | Provider identifier |
| `model` | `string` | Target model |
| `messages` | `Message[]` | Input messages |
| `tools` | `string[]?` | Tools allowed for model to call |
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

- Provider raw response can be archived, but upper layer only consumes unified model.
- `usage` contains at minimum input/output token information.
- If response contains tool calls, stable call id must be preserved.
- Tool output sanitization rules before entering messages, events, and summary are defined by `tool_output_sanitization_contract.md`.

## 5. ToolCallRequest Minimum Fields

- `call_id`
- `task_id`
- `agent_id`
- `execution_id?`
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
- `duration_ms`
- `error?`
- `follow_up_question?`

`status` enumeration:

- `succeeded`
- `failed`
- `timed_out`
- `blocked`
- `cancelled`

## 7. BudgetCheckResult

Contains at minimum:

- `allowed`
- `estimated_cost_usd`
- `remaining_budget_usd`
- `reason?`

Rules:

- LLM calls must pass through budget guard before execution.
- High-risk tool execution must simultaneously pass budget and permission checks.
- Before a workflow step actually executes, if structured input/output constraints exist, it should first pass `workflow_io_compatibility_precheck_contract.md`.

## 8. Error Semantics

`ExecutionError` contains at minimum:

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

## 9. Behavioral Constraints

- Provider adapter must not leak vendor-specific fields into upper-layer primary semantic dependencies.
- When tool returns a large file, the main result should be changed to an artifact reference.
- If the call request does not explicitly provide `timeout_ms`, executor must first resolve `default_timeout_ms` from tool metadata before executing.
- Failure retry must simultaneously consider tool metadata's recovery strategy and `retryable` in the result; blind fixed-count retry is not allowed.
- If the call request carries `allowed_path_roots` or execution precheck has resolved `resolved_paths_json`, tool access paths must satisfy both sandbox and path scope constraints.
- If execution holds `allowed_tools_json`, both direct tool and skill must validate `tool_name` against the whitelist at runtime; missing execution, malformed JSON, or null/non-string array items must fail-closed.
- All calls must be traceable back to `task_id`, `agent_id`, `trace_id`.
- If different tools need to expose additional structured details, prioritize stable `data / metadata` fields over letting upper layer guess top-level fields by tool name.
- Target locating rules for `edit / patch / replace` tools are defined by `edit_replacement_chain_contract.md`.
- Trimming and compaction rules when context approaches token limit are defined by `context_compaction_and_overflow_contract.md`.
- Tools like `WebFetch`, `command_exec`, and `mcp_call` that may generate network egress must resolve and record `egress_targets` before execution, covering at minimum URL, ssh, s3, registry, and publish targets.
- Provider / tool-side retry must not each maintain independent limiters; `retry-after`, breaker, provider limiter, tenant limiter, and task limiter should be combined into the same governance surface.
- `question` type tools must return structured options, recommended items, timeout semantics, and skipped semantics; they must not degrade into plain text questions.
- `todo_write` type tools must only modify session-level todo state, not cross-authority modify task master state.
- If cheap-vs-strong model routing exists, routing must be conservative, explainable, and deterministic with the same input and same configuration; at minimum `routing_reason` or equivalent route trace must be recorded.
- Multi-credential failover within the same provider should follow unified credential pool / cooldown semantics; adapters must not privately maintain "local exhausted state".
- If turn-scoped fallback exists, within the current turn, temporary degraded results may be reused via explicit fallback lease, but the next turn must by default re-attempt the primary profile; fallback lease must not indefinitely stick as a new sticky profile.
- For provider throttle and quota signals like `429 / 402 / retry-after / reset_at`, they should be uniformly written to provider governance state, not temporarily consumed only within a single request.
- Tool name resolution should prioritize exact / alias / normalized exact; fuzzy correction is only allowed when there is a unique candidate, and correction trace must be preserved. Ambiguous candidates and suspicious strings must fail-closed.
- If tool argument lenient correction is enabled, it must also be limited to type boundaries that schema explicitly states can safely converge; unknown fields, structural ambiguity, and high-risk parameters must not be silently auto-corrected.
- If tool argument correction occurs, correction trace must be exposed to auditable result surfaces such as `metadata` or warnings; high-frequency tools like `command_exec`, `edit_replace`, `question`, and `todo_write` must not hide corrections in a black box.
- For illegal types or structural ambiguity of high-risk tool parameters, executor must fail-closed with stable error code, rather than letting the underlying implementation crash from type exceptions.

## 10. Supplementary Rules

- Streaming chunks contain uniformly at minimum: `stream_id`, `sequence`, `event_type`, `payload`.
- Provider fallback observation records at minimum: original provider, fallback provider, trigger reason, switch time, impact scope.
- Tool sandbox result summary records at minimum: exit status, sanitized summary, artifact refs, policy notes.
- For user-visible text, tool output, and crawled content, NFC normalization should be applied first, then control characters and Unicode Tags block should be cleaned to avoid steganographic injection and display layer confusion.
