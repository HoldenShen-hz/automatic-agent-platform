# Tool Metadata And Recovery Contract

## 1. Scope

This contract drills down tool-level idempotency, recovery strategy, and execution boundaries to "what metadata each tool must declare".

Related documents:

- `tool_skill_plugin_contract.md`
- `tool_and_provider_execution_contract.md`
- `idempotency_and_recovery_matrix_contract.md`
- `file_lock_contract.md`
- `policy_engine_contract.md`

## 2. Objectives

This contract answers three questions:

- What minimum recovery and security metadata must each tool declare?
- How do runtime, policy, FileLock, and recovery consume this metadata?
- Which tool differences must be clarified at registration, not guessed at runtime?

## 3. Core Principles

- Idempotency is not runtime speculation, but part of the tool definition.
- Tool metadata must support retry, recovery, approval, output processing, and path protection.
- Any tool missing critical metadata should not enter the formal registry.

## 4. `ToolExecutionMetadata`

| Field | Type | Description |
| --- | --- | --- |
| `tool_name` | `string` | Tool name |
| `read_only` | `boolean` | Whether read-only |
| `idempotent` | `boolean` | Whether defaults to being idempotent |
| `side_effect_scope` | `none \| local_file \| local_process \| remote_api \| billing \| org_state` | Side effect scope |
| `recovery_strategy` | `retry_safe \| retry_with_check \| skip_if_verified \| manual_resume_required` | Recovery strategy |
| `requires_confirmation` | `boolean` | Whether requires confirmation by default |
| `risk_level` | `low \| medium \| high \| critical` | Risk level |
| `needs_file_lock` | `none \| read \| write \| dynamic` | File lock requirement |
| `path_scope_mode` | `none \| declared \| dynamic` | Path scope declaration mode |
| `produces_artifact` | `boolean` | Whether produces artifact |
| `output_kind` | `text \| structured_json \| artifact_ref \| mixed` | Output primary form |
| `supports_streaming_output` | `boolean` | Whether streaming output |
| `provider_dependency` | `none \| optional \| required` | Whether depends on provider |
| `default_timeout_ms` | `number` | Default timeout |
| `max_output_bytes` | `number?` | Recommended output upper limit |
| `retryable_error_codes_json` | `json?` | Error code set allowed for executor auto-retry |
| `approval_mode` | `never \| policy_driven \| always` | Approval mode |
| `supports_cancellation` | `boolean` | Whether supports explicit cancellation |
| `cleanup_guarantee` | `none \| best_effort \| required` | Cleanup guarantee after cancellation or failure |
| `requires_execution_receipt` | `boolean` | Whether must record receipt for side effect completion |
| `high_risk_patterns_json` | `json?` | Command-level high-risk pattern list |
| `model_overrides_json` | `json?` | Switch logical tools to compatible or more conservative tool variants by model profile / tier / capability |
| `domain_id` | `string?` | Domain this tool belongs to |
| `plugin_source` | `builtin \| plugin_spi \| mcp \| gateway \| division \| external` | Tool source |
| `produces_feedback_signal` | `boolean` | Whether may produce feedback signal |
| `knowledge_scope` | `none \| local \| namespace \| global` | Associated knowledge scope |
| `memory_scope` | `none \| local \| promotable` | Associated memory scope |

## 5. Minimum Declaration Requirements

Phase 1a each tool must declare at least:

- `read_only`
- `idempotent`
- `side_effect_scope`
- `recovery_strategy`
- `risk_level`
- `needs_file_lock`
- `output_kind`
- `approval_mode`
- `supports_cancellation`
- `cleanup_guarantee`

If a tool is missing these fields:

- Should not be registered as a production-ready tool
- Can only be in experimental or disabled state at most

## 6. Metadata Consumers

### 6.1 Runtime / Recovery

- Use `idempotent + recovery_strategy` to decide whether to auto-retry
- Use `default_timeout_ms` and `provider_dependency` to decide runtime guardrails
- Use `retryable_error_codes_json` to decide which failures can automatically enter the next attempt at the executor layer
- Use `supports_cancellation + cleanup_guarantee` to decide cancellation propagation and failure cleanup requirements
- Use `requires_execution_receipt` to decide when side effects can be judged as "completed"

### 6.2 Policy Engine

- Use `risk_level + approval_mode + side_effect_scope` to decide deny / allow / escalate

### 6.3 FileLock

- Use `needs_file_lock + path_scope_mode` to decide lock mode and path analysis requirements

### 6.4 Output Sanitization

- Use `output_kind + max_output_bytes + produces_artifact` to decide trimming and artifact shunting

### 6.5 Model-Aware Tool Selection

- Use `model_overrides_json` to resolve logical tools into concrete tools compatible with the current model profile before execution.
- Override targets must still belong to the skill's declared tool set and runtime allowed tools set, and must not implicitly expand permissions through profile switching.
- Unknown model profiles default to fail-closed, and should not silently fall back to undeclared tools.

### 6.6 OAPEFLIR Hub Routing

- Tools with `produces_feedback_signal=true` must allow routing their results to FeedbackHub.
- Tools with `knowledge_scope != none` must have provenance / sanitization annotations before their output enters the knowledge chain.
- `memory_scope=promotable` only indicates eligibility for subsequent learn / memory promotion candidates, not equal to automatic promotion.
- Tools with `plugin_source=plugin_spi` must be constrained by both plugin registration status and execution permission boundaries.

## 7. Typical Tool Family Default Values

| Tool Family | `read_only` | `idempotent` | `recovery_strategy` | `needs_file_lock` |
| --- | --- | --- | --- | --- |
| `read_file / grep / list` | Yes | Yes | `retry_safe` | `read` or `none` |
| `write_file` | No | Depends on overwrite strategy | `retry_with_check` | `write` |
| `edit / patch` | No | Depends on target location result | `retry_with_check` | `write` |
| `append_file` | No | No | `manual_resume_required` | `write` |
| `bash_readonly` | Depends on command | Low | `retry_with_check` | `dynamic` |
| `remote_api_read` | Yes | Usually | `retry_with_check` | `none` |
| `remote_api_write` | No | No | `manual_resume_required` | `none` |
| `llm_call` | Yes | Yes | `retry_safe` | `none` |

Supplementary rules:

- `write_file / edit / append_file / remote_api_write` should set `supports_cancellation=true` by default, with at least `cleanup_guarantee=best_effort`.
- Shell-type tools should explicitly list high-risk patterns such as pipes, redirects, command substitutions, and inline scripts in `high_risk_patterns_json`.
- `remote_api_write` and other irreversible side effect tools recommend `requires_execution_receipt=true`.

## 8. Registration and Versioning Rules

- Metadata changes affecting recovery, security, or approval semantics must be treated as versioning changes.
- Tool upgrades must not silently change `idempotent` or `side_effect_scope`.
- High-risk changes should synchronize updates to contracts and test fixtures.

## 9. Error Semantics

Recommended accompanying error codes:

- `validation.tool_metadata_missing`
- `validation.tool_metadata_invalid`
- `tool.recovery_strategy_unknown`
- `tool.retryable_error_code_unknown`

Rules:

- Missing critical metadata is a registration error, and should not be discovered at execution stage.
- When metadata is inconsistent with actual behavior, should be recorded as a high-priority architectural deviation.

## 10. Phase Boundaries

Phase 1a does:

- Tool minimum recovery metadata
- Runtime / policy / file lock consumption boundaries for these fields

Phase 1b does:

- More detailed tool family templates
- Dynamic path scope and complex output shunting

Currently does not do:

- Automatically inferring complete metadata from implementation code
- Marketplace-level cross-version compatibility solving

## 11. Closure Conclusion

Whether the tool system is recoverable ultimately depends not on "having enough tools", but on whether each tool clearly explains its side effects, idempotency, and recovery strategy.