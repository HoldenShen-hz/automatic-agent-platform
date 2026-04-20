# Error Code Registry

## 1. Scope

This file defines the currently allowed stable error code registry for this stage.

Rules:

- New error codes must be registered here before entering implementation.
- Once an error code enters implementation, it cannot be arbitrarily renamed.

## 2. Naming Rules

Unified format:

- `<category>.<reason>`

Examples:

- `validation.invalid_input`
- `provider.rate_limited`
- `runtime.timeout_exceeded`

## 3. Baseline Error Codes

| code | category | retryable | Description |
| --- | --- | --- | --- |
| `validation.invalid_input` | `validation` | `false` | Input invalid or missing fields |
| `validation.schema_mismatch` | `validation` | `false` | Workflow input/output incompatible |
| `validation.tool_metadata_missing` | `validation` | `false` | Tool missing key execution metadata |
| `validation.tool_metadata_invalid` | `validation` | `false` | Tool execution metadata invalid |
| `policy.approval_required` | `policy` | `false` | Manual approval required |
| `policy.action_denied` | `policy` | `false` | Policy explicitly denied |
| `auth.permission_denied` | `auth` | `false` | Insufficient permissions |
| `auth.session_expired` | `auth` | `false` | Session expired |
| `budget.budget_exceeded` | `budget` | `false` | Budget exceeded |
| `budget.quota_exceeded` | `budget` | `false` | Quota exceeded |
| `provider.rate_limited` | `provider` | `true` | Provider 429 or equivalent rate limit |
| `provider.temporary_unavailable` | `provider` | `true` | Provider temporarily unavailable |
| `provider.invalid_credentials` | `provider` | `false` | Provider 401/403 or credentials error |
| `provider.capability_unsupported` | `provider` | `false` | Provider or model does not support requested capability |
| `provider.compaction_unavailable` | `provider` | `true` | Compaction/summarize provider temporarily unavailable |
| `tool.execution_failed` | `tool` | `false` | Tool execution failed and not auto-retryable |
| `tool.temporary_io_error` | `tool` | `true` | Tool encountered temporary IO issue |
| `tool.edit_target_not_found` | `tool` | `false` | Edit/patch target not found |
| `tool.edit_multiple_candidates` | `tool` | `false` | Edit/patch hit multiple candidates |
| `tool.edit_similarity_too_low` | `tool` | `false` | Edit/patch fuzzy match similarity insufficient |
| `tool.file_lock_conflict` | `tool` | `true` | File lock conflict, can wait and retry |
| `tool.file_lock_timeout` | `tool` | `true` | File lock wait timeout |
| `tool.output_sanitization_failed` | `tool` | `false` | Tool output sanitization failed |
| `tool.recovery_strategy_unknown` | `tool` | `false` | Tool declared unknown recovery strategy |
| `sandbox.path_denied` | `sandbox` | `false` | Access path exceeds whitelist |
| `sandbox.network_denied` | `sandbox` | `false` | Network access denied by policy |
| `sandbox.exec_denied` | `sandbox` | `false` | Process execution denied by sandbox or policy |
| `sandbox.isolation_broken` | `sandbox` | `false` | Isolation constraint cannot be guaranteed |
| `storage.write_failed` | `storage` | `true` | Write storage failed |
| `storage.integrity_violation` | `storage` | `false` | Foreign key or integrity error |
| `workflow.dependency_unavailable` | `workflow` | `true` | Upstream dependency temporarily unavailable |
| `workflow.invalid_transition` | `workflow` | `false` | Illegal state transition |
| `runtime.timeout_exceeded` | `runtime` | `false` | Execution timeout |
| `runtime.recovery_required` | `runtime` | `true` | Recovery process required |
| `runtime.stale_lock_detected` | `runtime` | `true` | Stale lock or stale execution detected |
| `runtime.context_overflow` | `runtime` | `true` | Context overflow needs trimming or compression |
| `tenant.not_found` | `tenant` | `false` | Tenant or workspace affiliation not found |
| `tenant.boundary_violation` | `tenant` | `false` | Access across tenant boundary |
| `tenant.workspace_mismatch` | `tenant` | `false` | Workspace does not match tenant/org affiliation |
| `monetization.entitlement_denied` | `monetization` | `false` | Entitlement explicitly denied |
| `monetization.quota_counter_stale` | `monetization` | `true` | Quota counter delayed or inconsistent |
| `monetization.ledger_write_failed` | `monetization` | `true` | Ledger write failed |
| `monetization.billing_state_invalid` | `monetization` | `false` | Billing or plan state invalid |
| `external.service_unavailable` | `external` | `true` | External system temporarily unavailable |
| `internal.unexpected_error` | `internal` | `false` | Uncategorized internal error |

## 4. Special Mapping Rules

- Provider `401/403` maps to `provider.invalid_credentials`
- Provider `429` maps to `provider.rate_limited`
- Provider `5xx` maps to `provider.temporary_unavailable`
- Illegal state transition maps to `workflow.invalid_transition`
- File lock acquisition conflict maps to `tool.file_lock_conflict`
- File lock wait timeout maps to `tool.file_lock_timeout`

## 5. Supplementary Rules

- Provider sub-codes at least细分: `provider.context_window_exceeded`, `provider.model_not_available`, `provider.output_truncated`, `provider.capability_unsupported`.
- Enterprise-specific error codes at least reserved: `enterprise.environment_unhealthy`, `enterprise.release_guard_failed`, `enterprise.audit_export_denied`.
