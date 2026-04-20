# App Error Contract

## 1. Scope

This contract defines the platform's unified error model.

It requires that all errors propagated to runtime, gateway, approval, recovery, and observability layers must first converge to `AppError`.

## 2. `AppError` Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `code` | `string` | Stable error code |
| `category` | `validation \| policy \| auth \| budget \| provider \| tool \| sandbox \| storage \| workflow \| runtime \| tenant \| monetization \| external \| internal` | Error category |
| `retryable` | `boolean` | Whether automatic retry is allowed |
| `user_message` | `string` | User-facing safe hint |
| `internal_details` | `json?` | Details for internal troubleshooting |
| `source` | `gateway \| runtime \| workflow \| provider \| tool \| storage \| policy` | Primary source |
| `trace_id` | `string?` | Trace ID |
| `task_id?` | `string` | Associated task |
| `execution_id?` | `string` | Associated execution |
| `caused_by?` | `string` | Upstream error code or exception reference |
| `occurred_at` | `timestamp` | Occurrence time |

## 3. Unified Rules

- All errors must have a stable `code`; free-form text must not be thrown alone.
- All errors must explicitly mark `retryable`.
- `user_message` and `internal_details` must be separated.
- Provider / tool native errors must be adapted to `AppError` before entering upper layers.

## 4. Category Semantics

| Category | Meaning | Default Retry Recommendation |
| --- | --- | --- |
| `validation` | Input, schema, or configuration invalid | No |
| `policy` | Policy, approval, or sensitive action denial | No |
| `auth` | Insufficient identity or permissions | No |
| `budget` | Budget, quota, or cost exceeded | No |
| `provider` | LLM provider failure | Depends on error code |
| `tool` | Tool execution failure | Depends on tool and idempotency |
| `sandbox` | Path, network, or isolation denial | Usually no |
| `storage` | Database, file, or indexing failure | Depends on error code |
| `workflow` | Orchestration, dependency, or step inconsistency | Usually no |
| `runtime` | Runtime, sandbox, timeout, or recovery failure | Depends on error code |
| `tenant` | Tenant ownership, isolation, or organization boundary error | Usually no |
| `monetization` | Entitlement, quota, ledger, or billing error | Depends on error code |
| `external` | External system fluctuation | Depends on error code |
| `internal` | Uncategorized internal error | No by default |

## 5. Relationship with Retry and Recovery

- `retryable=true` only indicates permission to enter retry policy; it does not equal mandatory retry.
- Retry still needs to consider `RetryPolicy`, remaining budget, tool idempotency, and execution mode.
- When non-retryable errors enter dead-letter or human escalation, `AppError.code` must be preserved.

## 6. Standard Derived Types

- `ValidationError`
- `PolicyDeniedError`
- `AuthError`
- `BudgetExceededError`
- `ProviderError`
- `ToolExecutionError`
- `SandboxError`
- `StorageError`
- `WorkflowStateError`
- `RuntimeTimeoutError`
- `TenantBoundaryError`
- `MonetizationError`
- `InternalAppError`

## 7. Related Documents

- `error_code_registry.md`
- `runtime_execution_contract.md`
- `approval_and_hitl_contract.md`
- `tool_and_provider_execution_contract.md`

## 8. Closure Conclusion

The core of the error model is not "defining a few more exception classes" but ensuring that failures at any layer of the system can be uniformly classified, uniformly presented, and uniformly recovered.
