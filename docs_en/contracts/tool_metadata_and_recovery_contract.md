# Tool Metadata And Recovery Contract

## 1. Scope

This contract drills down tool-level idempotency, recovery strategy, and execution boundary to "what metadata each tool must declare".

Related Documents:

- `tool_skill_plugin_contract.md`
- `tool_and_provider_execution_contract.md`
- `idempotency_and_recovery_matrix_contract.md`
- `file_lock_contract.md`
- `policy_engine_contract.md`

## 2. Goals

This contract answers 3 questions:

- What minimum recovery and security metadata each tool must declare.
- How runtime, policy, FileLock, and recovery consume this metadata.
- Which tool differences must be stated clearly at registration time, not guessed at runtime.

## 3. Core Principles

- Idempotency is not runtime speculation, but part of tool definition.
- Tool metadata must be able to support retry, recovery, approval, output processing, and path protection.
- Any tool missing critical metadata should not enter the official registry.

## 4. `ToolExecutionMetadata`

| Field | Type | Description |
| --- | --- | --- |
| `tool_name` | `string` | Tool name |
| `read_only` | `boolean` | Whether read-only |
| `idempotent` | `boolean` | Whether default to repeatable execution |
| `side_effect_scope` | `none \| local_file \| local_process \| remote_api \| billing \| org_state` | Side effect scope |
| `recovery_strategy` | `retry_safe \| retry_with_check \| skip_if_verified \| manual_resume_required` | Recovery strategy |
| `requires_confirmation` | `boolean` | Whether default requires confirmation |
| `risk_level` | `low \| medium \| high \| critical` | Risk level |
| `needs_file_lock` | `none \| read \| write \| dynamic` | File lock requirement |
| `path_scope_mode` | `none \| declared \| dynamic` | Path scope declaration mode |
| `produces_artifact` | `boolean` | Whether produces artifact |
| `output_kind` | `text \| structured_json \| artifact_ref \| mixed` | Primary output form |
| `supports_streaming_output` | `boolean` | Whether streaming output |
| `provider_dependency` | `none \| optional \| required` | Whether depends on provider |
| `default_timeout_ms` | `number` | Default timeout |
| `max_output_bytes` | `number?` | Output suggestion limit |
| `retryable_error_codes_json` | `json?` | Error code set allowed for executor auto-retry |
| `approval_mode` | `never \| policy_driven \| always` | Approval mode |
| `supports_cancellation` | `boolean` | Whether supports explicit cancellation |
| `cleanup_guarantee` | `none \| best_effort \| required` | Cleanup guarantee after cancel or failure |
| `requires_execution_receipt` | `boolean` | Whether must record receipt for side effect completion |
| `high_risk_patterns_json` | `json?` | Command-level high-risk pattern list |
| `model_overrides_json` | `json?` | Switch logic tools to compatible or more conservative tool variants by model profile/tier/capability |
| `domain_id` | `string?` | Domain this tool belongs to |
| `plugin_source` | `builtin \| plugin_spi \| mcp \| gateway \| division \| external` | Tool source |
| `produces_feedback_signal` | `boolean` | Whether may produce feedback signal |
| `knowledge_scope` | `none \| local \| namespace \| global` | Associated knowledge scope |
| `memory_scope` | `none \| local \| promotable` | Associated memory scope |

## 5. Minimum Declaration Requirements

Phase 1a each tool must declare at minimum:

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

If tool lacks these fields:

- Should not be registered as production-ready tool
- At most can be in experimental or disabled state

## 6. Metadata Consumers

### 6.1 Runtime/Recovery

- Use `idempotent + recovery_strategy` to decide whether to auto-retry
- Use `default_timeout_ms` and `provider_dependency` to decide runtime guardrail
- Use `retryable_error_codes_json` to decide which failures can auto-enter next attempt at executor layer
- Use `supports_cancellation + cleanup_guarantee` to decide cancellation propagation and failure closure requirements
- Use `requires_execution_receipt` to decide when side effect can be judged as "completed"

### 6.2 Policy Engine

- Use `risk_level + approval_mode + side_effect_scope` to decide deny/allow/escalate

### 6.3 FileLock

- Use `needs_file_lock + path_scope_mode` to decide lock mode and path analysis requirements

### 6.4 Output Sanitization

- Use `output_kind + max_output_bytes + produces_artifact` to decide clipping and artifact diversion

### 6.5 Model-Aware Tool Selection

- Use `model_overrides_json` to resolve logical tool to concrete tool compatible with current model profile before execution.
- Override target must still belong to the skill's declared tool set and runtime allowed tools set, cannot use profile switch to implicitly expand permissions.
- Unknown model profile defaults fail-closed, should not silently fall back to undeclared tools.

### 6.6 OAPEFLIR Hub Routing

- Tools with `produces_feedback_signal=true` must allow results to be routed to FeedbackHub.
- Tools with `knowledge_scope != none` must have provenance/sanitization annotation before output enters knowledge chain.
- `memory_scope=promotable` only indicates eligibility for subsequent learn/memory promotion candidate, not equal to automatic promotion.
- Tools with `plugin_source=plugin_spi` must simultaneously be constrained by plugin registration status and execution permission boundaries.

## 7. Typical Tool Family Default Values

| Tool Family | `read_only` | `idempotent` | `recovery_strategy` | `needs_file_lock` |
| --- | --- | --- | --- | --- |
| `read_file / grep / list` | yes | yes | `retry_safe` | `read` or `none` |
| `write_file` | no | depends on overwrite strategy | `retry_with_check` | `write` |
| `edit / patch` | no | depends on target positioning result | `retry_with_check` | `write` |
| `append_file` | no | no | `manual_resume_required` | `write` |
| `bash_readonly` | depends on command | low | `retry_with_check` | `dynamic` |
| `remote_api_read` | yes | usually | `retry_with_check` | `none` |
| `remote_api_write` | no | no | `manual_resume_required` | `none` |
| `llm_call` | yes | yes | `retry_safe` | `none` |

Supplementary Rules:

- `write_file / edit / append_file / remote_api_write` should default to `supports_cancellation=true`, and at minimum `cleanup_guarantee=best_effort`.
- Shell-type tools should explicitly list high-risk patterns like pipe, redirect, command substitution, inline script in `high_risk_patterns_json`.
- `remote_api_write` and other irreversible side effect tools recommend `requires_execution_receipt=true`.

## 8. Registration and Versioning Rules

- Metadata changes affecting recovery, security, or approval semantics must be treated as versioning changes.
- Tool upgrades must not silently change `idempotent` or `side_effect_scope`.
- High-risk changes should synchronize contract and test fixtures.

## 9. Error Semantics

Recommended associated error codes:

- `validation.tool_metadata_missing`
- `validation.tool_metadata_invalid`
- `tool.recovery_strategy_unknown`
- `tool.retryable_error_code_unknown`

Rules:

- Missing critical metadata is a registration error, should not be discovered at execution phase.
- When metadata is inconsistent with actual behavior, should be recorded as high-priority architecture deviation.

## 10. Phase Boundaries

Phase 1a does:

- Tool minimum recovery metadata
- Runtime/policy/file lock consumption boundaries for these fields

Phase 1b does:

- More detailed tool family templates
- Dynamic path scope and complex output diversion

Currently not doing:

- Auto-derive complete metadata from implementation code
- Marketplace-level cross-version compatibility solving

## 11. Closing Conclusion

Whether the tool system is recoverable ultimately does not depend on "whether there are enough tools", but on whether each tool clearly states its side effects, idempotency, and recovery strategy.