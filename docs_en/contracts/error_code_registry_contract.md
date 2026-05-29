# Error Code Registry

---

## OAPEFLIR Association

This contract participates in the following stages of the OAPEFLIR eight-stage cycle:

- **Observe**: Signal collection and aggregation
- **Assess**: Pre-execution assessment and risk judgment
- **Plan**: Task decomposition and DAG construction
- **Execute**: Step execution and fault tolerance
- **Feedback**: Signal collection and preprocessing
- **Learn**: Pattern detection and knowledge extraction
- **Improve**: Improvement candidate evaluation and rollout
- **Release**: Controlled release and rollback

---

## 1. Scope

This document defines the stable `AppError.code` registry allowed for use in the current phase.

Rules:

- New external `AppError.code` must be registered here before entering implementation.
- External error codes that have entered implementation must not be freely renamed.
- Startup inspection, internal assertions, one-time migration diagnostics may retain local snake_case / colon style, but must not impersonate external stable API / SDK / runtime contract error code.

## 2. Naming Rules

External stable error codes unified format:

- `<category>.<reason>`

Examples:

- `validation.invalid_input`
- `provider.rate_limited`
- `runtime.recovery_required`

## 3. Baseline Error Codes

| code | category | retryable | description |
| --- | --- | --- | --- |
| `validation.invalid_input` | `validation` | `false` | Input invalid or missing fields |
| `validation.schema_mismatch` | `validation` | `false` | Workflow input/output incompatible |
| `policy.approval_required` | `policy` | `false` | Human approval required |
| `policy.action_denied` | `policy` | `false` | Policy explicitly denied |
| `auth.permission_denied` | `auth` | `false` | Insufficient permissions |
| `mission.not_found` | `mission` | `false` | Mission does not exist |
| `mission.member_not_found` | `mission` | `false` | Mission member does not exist |
| `mission.if_match_required` | `mission` | `false` | Mission write operation missing `If-Match` |
| `mission.version_conflict` | `mission` | `false` | Mission version conflict |
| `budget.budget_exceeded` | `budget` | `false` | Budget exceeded |
| `budget.quota_exceeded` | `budget` | `false` | Quota exceeded |
| `api.not_found` | `api` | `false` | API route does not exist |
| `api.invalid_message` | `api` | `false` | WebSocket / channel message invalid |
| `api.unknown_message` | `api` | `false` | WebSocket / channel message type unknown |
| `api.payload_too_large` | `api` | `false` | API request body too large |
| `api.origin_forbidden` | `api` | `false` | API Origin not in whitelist |
| `api.prompt_bundle_not_found` | `api` | `false` | Prompt bundle does not exist |
| `api.rate_limit_exceeded` | `api` | `true` | API rate limit triggered |
| `api.server_shutting_down` | `api` | `true` | Server is shutting down |
| `api.duplicate_request` | `api` | `false` | API detected duplicate request body or request id |
| `api.idempotency_key_required` | `api` | `false` | Idempotency key missing |
| `api.idempotency_key_conflict` | `api` | `false` | Idempotency key conflicts with historical request |
| `api.idempotency_request_in_flight` | `api` | `true` | Same idempotency key request still processing |
| `api.idempotency_cached_response_too_large` | `api` | `true` | Cached idempotent response too large to replay safely |
| `api.idempotency_cached_response_corrupt` | `api` | `true` | Idempotency cache corrupted |
| `api.openapi_auth_required` | `api` | `false` | OpenAPI documentation access requires authentication |
| `api.unsupported_media_type` | `api` | `false` | Request media type not supported |
| `provider.rate_limited` | `provider` | `true` | provider 429 or equivalent rate limit |
| `provider.temporary_unavailable` | `provider` | `true` | provider temporarily unavailable |
| `provider.compaction_unavailable` | `provider` | `true` | compaction / summarize provider temporarily unavailable |
| `tool.execution_failed` | `tool` | `false` | Tool execution failed and cannot be automatically retried |
| `tool.temporary_io_error` | `tool` | `true` | Tool encountered temporary IO issue |
| `tool.edit_target_not_found` | `tool` | `false` | edit / patch target not found |
| `tool.edit_multiple_candidates` | `tool` | `false` | edit / patch matched multiple candidates |
| `tool.edit_similarity_too_low` | `tool` | `false` | edit / patch fuzzy match similarity insufficient |
| `tool.file_lock_conflict` | `tool` | `true` | File lock conflict, can wait and retry |
| `tool.file_lock_timeout` | `tool` | `true` | File lock wait timeout |
| `sandbox.path_denied` | `sandbox` | `false` | Access path outside whitelist |
| `sandbox.network_denied` | `sandbox` | `false` | Network access denied by policy |
| `sandbox.exec_denied` | `sandbox` | `false` | Process execution denied by sandbox or policy |
| `sandbox.isolation_broken` | `sandbox` | `false` | Isolation constraint cannot be guaranteed |
| `storage.write_failed` | `storage` | `true` | Storage write failed |
| `workflow.dependency_unavailable` | `workflow` | `true` | Upstream dependency temporarily unavailable |
| `runtime.recovery_required` | `runtime` | `true` | Recovery process required |
| `runtime.stale_lock_detected` | `runtime` | `true` | Stale lock or stale execution detected |
| `runtime.context_overflow` | `runtime` | `true` | Context exceeded limit, requires trimming or compression |
| `contract.legacy_surface_used` | `contract` | `false` | Reached legacy contract surface retained only for compatibility |
| `contract.deprecated_surface_used` | `contract` | `false` | Reached deprecated contract surface, needs migration to canonical surface |
| `tenant.not_found` | `tenant` | `false` | Tenant or workspace ownership not found |
| `tenant.boundary_violation` | `tenant` | `false` | Access across tenant boundary |
| `tenant.workspace_mismatch` | `tenant` | `false` | Workspace tenant / org ownership inconsistent |
| `external.service_unavailable` | `external` | `true` | External system temporarily unavailable |
| `internal.unexpected_error` | `internal` | `false` | Unclassified internal error |

## 4. Special Mapping Rules

- provider `429` maps to `provider.rate_limited`
- provider `5xx` maps to `provider.temporary_unavailable`
- File lock acquisition conflict maps to `tool.file_lock_conflict`
- File lock wait timeout maps to `tool.file_lock_timeout`
- Historical compatibility alert `AA_LEGACY_CONTRACT` maps to `contract.legacy_surface_used`
- Historical compatibility alert `AA_DEPRECATED_CONTRACT` maps to `contract.deprecated_surface_used`
- WebSocket / channel message validation failure maps to `api.invalid_message`

## 5. Supplementary Rules

- Extensions of provider, tool, enterprise sub-codes may be appended to registry after implementation; unimplemented entries must not be marked as canonical in advance.
