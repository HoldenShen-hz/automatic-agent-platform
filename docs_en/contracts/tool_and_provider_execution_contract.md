# Tool And Provider Execution Contract

> **OAPEFLIR Association**: This contract defines the tool execution layer of the OAPEFLIR Execute Hub, corresponding to ADR-016.
> **Updated**: 2026-04-17

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
| `harness_run_id` | `string` | Parent HarnessRun |
| `node_run_id` | `string` | Parent NodeRun |
| `attempt_id` | `string` | Parent NodeAttempt |
| `task_id` | `string?` | Compatible query entry; not a truth primary key |
| `agent_id` | `string` | Initiating role |
| `stage_view_ref` | `string?` | Current闭环 stage view reference; does not drive execution semantics |
| `domain_id` | `string?` | Current domain |
| `provider` | `string` | Provider identifier |
| `model` | `string` | Target model |
| `messages` | `Message[]` | Input messages |
| `tools` | `string[]?` | Tools the model is allowed to call |
| `kv_cache_hint` | `json?` | KV cache partitioning hint |
| `budget_limit_usd` | `number?` | Budget upper limit for this request |
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

- Provider raw responses may be archived, but upper layers only consume the unified model.
- `usage` must contain at least input/output token information.
- If response contains tool calls, stable call IDs must be preserved.
- Tool output sanitization rules before entering messages, events, and summaries are defined in `tool_output_sanitization_contract.md`.

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

- LLM calls must first create or reuse `BudgetReservation`, not just make a boolean allow/deny decision.
- High-risk tool executions must pass both budget and permission checks.
- Before workflow steps truly execute, if structured input/output constraints exist, they should first pass through `workflow_io_compatibility_precheck_contract.md`.
- After successful execution, `BudgetSettlement` must be produced or reservation explicitly released; failures or cancellations must have auditable conclusions.

## 8. Error Semantics

`ExecutionError` must contain at minimum:

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

- Provider adapters must not leak provider-specific fields into upper-layer primary semantic dependencies.
- When tools return large files, the main result should become an artifact reference.
- If `timeout_ms` is not explicitly provided in a call request, the executor must first resolve `default_timeout_ms` from tool metadata before execution.
- Retry decisions must be based on both the recovery strategy in tool metadata and `retryable` in the result, not blindly fixed retry counts.
- If a call request carries `allowed_path_roots` or execution precheck has resolved `resolved_paths_json`, tool access paths must satisfy both sandbox and path scope constraints.
- If execution holds `allowed_tools_json`, direct tools and skills must both validate that `tool_name` is on the whitelist at runtime; missing execution, illegal JSON, or empty/non-string array items must fail-closed.
- All calls must be traceable back to `task_id`, `agent_id`, `trace_id`.
- All calls must first be traceable back to `harness_run_id`, `node_run_id`, `attempt_id`; `task_id` serves only as a compatible query entry.
- If different tools need to expose additional structured details, they should first be placed in stable `data/metadata` fields, not have upper layers guess top-level fields by tool name.
- Target定位 rules for `edit/patch/replace` class tools are defined in `edit_replacement_chain_contract.md`.
- Context trimming and compaction rules near token limits are defined in `context_compaction_and_overflow_contract.md`.
- Tools like `WebFetch`, `command_exec`, `mcp_call` that may generate network egress must resolve and record `egress_targets` before execution, covering at minimum URL, ssh, s3, registry, publish targets.
- Retries on the provider/tool side must not each maintain independent limiters; `retry-after`, breaker, provider limiter, tenant limiter, and task limiter should be combined into a single governance surface.
- `question` class tools must return structured options, recommendations, timeout semantics, and skipped semantics, not degrade into plain text questioning.
- `todo_write` class tools must only modify session-level todo state, not arrogate modification of task master state.
- If a domain tool bundle exists, tool parsing must prioritize the current `domain_id`-allowed tool set; plugin SPI tools must not bypass equivalent sandbox/policy/path constraints.
- `kv_cache_hint` can only provide construction suggestions for fixed prefix / domain block / variable suffix, not directly override budget or trimming strategies.
- If cheap-vs-strong model routing exists, routing must be conservative, explainable, and deterministic with the same input and same configuration; at minimum, `routing_reason` or equivalent route trace must be recorded.
- Multi-credential failover for the same provider should go through unified credential pool/cooldown semantics, not let each adapter privately maintain "local exhausted state".
- If turn-scoped fallback exists, the current turn allows reusing temporary degraded results via explicit fallback lease, but the next turn must retry the primary profile by default; fallback lease must not indefinitely stick as a new sticky profile.
- For provider throttle and quota signals like `429 / 402 / retry-after / reset_at`, they should be written to provider governance state, not just temporarily consumed within a single request.
- Tool name parsing should prioritize exact / alias / normalized exact; fuzzy correction is only allowed when there is a unique candidate, and correction trace must be preserved. Ambiguous candidates and suspicious strings must fail-closed.
- If tool argument lenient correction is enabled, it must also be limited to type boundaries that schema explicitly confirms can safely converge; unknown fields, structural ambiguity, and high-risk parameters must not be silently auto-corrected.
- If tool argument correction occurs, correction trace must be exposed to `metadata` or warnings for auditable surfaces; high-frequency tools like `command_exec`, `edit_replace`, `question`, `todo_write` must not hide corrections in a black box.
- For illegal types or structural ambiguity of high-risk tool parameters, the executor must fail-closed with stable error codes, not let the underlying implementation crash from type exceptions.
- If `ModelResponse`/`ToolCallResult` needs to return user summaries or learning signals, it must go through `NodeAttemptReceipt` or its reference for back-chaining; provider/tool raw results must not be directly treated as runtime truth.

## 10. Supplementary Rules

- Streaming chunks must uniformly contain at minimum: `stream_id`, `sequence`, `event_type`, `payload`.
- Provider fallback observation must record at minimum: original provider, fallback provider, trigger reason, switch time, impact scope.
- Tool sandbox result summary must record at minimum: exit status, sanitized summary, artifact refs, policy notes.
- For user-visible text, tool output, and scraped content, NFC normalization should be done first, then control characters and Unicode Tags blocks cleaned to avoid steganographic injection and display layer confusion.

## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-19: This document previously wrote `task_id / execution_id / agent_id` as provider/tool call primary keys and compressed budget guards into `BudgetCheckResult.allowed` boolean results. Root cause: the old execution contract followed a single-request perspective and did not bind call attribution to `HarnessRun / NodeRun / NodeAttempt` and budget reservation/settlement lifecycle. Fix: The main text now sets `harness_run_id / node_run_id / attempt_id` as canonical call identity and converges budget objects to `BudgetReservationDecision`.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR may only be used as `oapeflir.view.*` / rationale projections; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.