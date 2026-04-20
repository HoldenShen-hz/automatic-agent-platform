# Tool Metadata And Recovery Contract

## 1. Scope

This contract drills down "what metadata each tool must declare" to tool-level idempotency, recovery strategy, and execution boundaries.

Related documents:

- `tool_skill_plugin_contract.md`
- `tool_and_provider_execution_contract.md`
- `idempotency_and_recovery_matrix_contract.md`
- `file_lock_contract.md`
- `policy_engine_contract.md`

## 2. Goals

This contract answers 3 questions:

- What minimum recovery and security metadata each tool must declare.
- How runtime, policy, FileLock, recovery consume this metadata.
- Which tool differences must be clearly stated at registration and not left for runtime guessing.

## 3. Core Principles

- Idempotency is not runtime speculation but part of tool definition.
- Tool metadata must support retry, recovery, approval, output processing, and path protection.
- Any tool missing key metadata should not enter formal registry.

## 4. `ToolExecutionMetadata`

| Field | Type | Description |
| --- | --- | --- |
| `tool_name` | `string` | Tool name |
| `read_only` | `boolean` | Whether read-only |
| `idempotent` | `boolean` | Whether default repeatable execution |
| `side_effect_scope` | `none \| local_file \| local_process \| remote_api \| billing \| org_state` | Side effect scope |
| `recovery_strategy` | `retry_safe \| retry_with_check \| skip_if_verified \| manual_resume_required` | Recovery strategy |
| `requires_confirmation` | `boolean` | Whether default requires confirmation |
| `risk_level` | `low \| medium \| high \| critical` | Risk level |
| `needs_file_lock` | `none \| read \| write \| dynamic` | File lock requirement |
| `path_scope_mode` | `none \| declared \| dynamic` | Path scope declaration mode |
| `produces_artifact` | `boolean` | Whether produces artifact |
| `output_kind` | `text \| structured_json \| artifact_ref \| mixed` | Output main form |
| `supports_streaming_output` | `boolean` | Whether streaming output |
| `provider_dependency` | `none \| optional \| required` | Whether depends on provider |
| `default_timeout_ms` | `number` | Default timeout |
| `max_output_bytes` | `number?` | Output suggested ceiling |
| `retryable_error_codes_json` | `json?` | Error code set allowed executor auto-retry |
| `approval_mode` | `never \| policy_driven \| always` | Approval mode |
| `supports_cancellation` | `boolean` | Whether supports explicit cancellation |
| `cleanup_guarantee` | `none \| best_effort \| required` | Cleanup guarantee after cancellation or failure |
| `requires_execution_receipt` | `boolean` | Whether must record receipt before side effect considered complete |
| `high_risk_patterns_json` | `json?` | Command-level high-risk pattern list |
| `model_overrides_json` | `json?` | Switch logic tool to compatible or more conservative tool variant by model profile / tier / capability |

## 5. Minimum Declaration Requirements

Phase 1a each tool at minimum must declare:

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

If tool is missing these fields:

- Should not register as production-ready tool
- At most can be in experimental or disabled state

## 6. Metadata Consumers

### 6.1 Runtime / Recovery

- Use `idempotent + recovery_strategy` to decide whether to auto-retry
- Use `default_timeout_ms` and `provider_dependency` to decide runtime guardrail
- Use `retryable_error_codes_json` to decide which failures can auto-enter next attempt at executor layer
- Use `supports_cancellation + cleanup_guarantee` to decide cancellation propagation and failure closure requirements
- Use `requires_execution_receipt` to decide when side effect can be considered "complete"

### 6.2 Policy Engine

- Use `risk_level + approval_mode + side_effect_scope` to decide deny / allow / escalate

### 6.3 FileLock

- Use `needs_file_lock + path_scope_mode` to decide lock mode and path analysis requirements

### 6.4 Output Sanitization

- Use `output_kind + max_output_bytes + produces_artifact` to decide trimming and artifact diversion

### 6.5 Model-Aware Tool Selection

- Use `model_overrides_json` to resolve logic tool to concrete tool compatible with current model profile before execution.
- Override target tool must still belong to that skill's declared tool set and runtime allowed tools set and cannot use profile switch to implicitly expand permissions.
- Unknown model profile defaults to fail-closed and must not silently fall back to undeclared tool.

## 7. Typical Tool Family Defaults

| Tool Family | `read_only` | `idempotent` | `recovery_strategy` | `needs_file_lock` |
| --- | --- | --- | --- | --- |
| `read_file / grep / list` | yes | yes | `retry_safe` | `read` or `none` |
| `write_file` | no | depends on overwrite strategy | `retry_with_check` | `write` |
| `edit / patch` | no | depends on target positioning result | `retry_with_check` | `write` |
| `append_file` | no | no | `manual_resume_required` | `write` |
| `bash_readonly` | depends on command | low | `retry_with_check` | `dynamic` |
| `remote_api_read` | yes | usually yes | `retry_with_check` | `none` |
| `remote_api_write` | no | no | `manual_resume_required` | `none` |
| `llm_call` | yes | yes | `retry_safe` | `none` |

Supplementary rules:

- `write_file / edit / append_file / remote_api_write` should default to `supports_cancellation=true` and at least `cleanup_guarantee=best_effort`.
- Shell-type tools should explicitly list pipeline, redirection, command substitution, inline script and other high-risk patterns in `high_risk_patterns_json`.
- `remote_api_write` and other irreversible side-effect tools suggest `requires_execution_receipt=true`.

## 8. Registration and Versioning Rules

- Metadata changes affecting recovery, security, or approval semantics must be treated as versioning changes.
- Tool upgrades must not silently change `idempotent` or `side_effect_scope`.
- High-risk changes should synchronize contract and test fixtures.

## 9. Error Semantics

Suggested accompanying error codes:

- `validation.tool_metadata_missing`
- `validation.tool_metadata_invalid`
- `tool.recovery_strategy_unknown`
- `tool.retryable_error_code_unknown`

Rules:

- Missing key metadata belongs to registration error and should not be discovered at execution phase.
- When metadata and actual behavior are inconsistent, should record as high-priority architecture deviation.

## 10. Phase Boundaries

Phase 1a does:

- Tool minimum recovery metadata
- Runtime / policy / file lock consumption boundaries for these fields

Phase 1b does:

- More refined tool family templates
- Dynamic path scope and complex output diversion

Currently does not do:

- Auto-infer complete metadata from implementation code
- Marketplace-level cross-version compatibility solving

## 11. Closure Conclusion

Whether tool system is recoverable ultimately depends not on "whether there are enough tools" but on whether each tool clearly states its side effects, idempotency, and recovery strategy.
