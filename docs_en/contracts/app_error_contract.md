# App Error Contract

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

This contract defines the platform's unified error model.

It requires that all errors propagated to runtime, gateway, approval, recovery, and observability layers must first converge to `AppError`.

## 2. `AppError` Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `code` | `string` | Stable error code |
| `category` | `validation \| policy \| auth \| budget \| provider \| tool \| sandbox \| storage \| workflow \| runtime \| tenant \| monetization \| external \| internal` | Error category |
| `retryable` | `boolean` | Whether automatic retry is allowed |
| `user_message` | `string` | User-facing safe hint |
| `internal_details` | `json?` | Internal troubleshooting details |
| `source` | `gateway \| runtime \| workflow \| provider \| tool \| storage \| policy` | Primary source |
| `trace_id` | `string?` | Trace ID |
| `task_id?` | `string` | Associated task |
| `execution_id?` | `string` | Associated execution |
| `caused_by?` | `string` | Upstream error code or exception reference |
| `occurred_at` | `timestamp` | Time of occurrence |

## 3. Unified Rules

- All errors must have a stable `code` and must not throw free-form text only.
- All errors must explicitly mark `retryable`.
- `user_message` and `internal_details` must be separated.
- Provider / tool native errors must first be adapted to `AppError` before entering upper layers.

## 4. Category Semantics

| Category | Meaning | Default Retry Advice |
| --- | --- | --- |
| `validation` | Input, schema, or configuration invalid | No |
| `policy` | Policy, approval, or sensitive action denied | No |
| `auth` | Identity or insufficient permissions | No |
| `budget` | Budget, quota, or cost exceeded | No |
| `provider` | LLM provider failure | Depends on error code |
| `tool` | Tool execution failure | Depends on tool and idempotency |
| `sandbox` | Path, network, or isolation denied | Usually no |
| `storage` | Database, file, or index failure | Depends on error code |
| `workflow` | Orchestration, dependency, or step inconsistency | Usually no |
| `runtime` | Runtime, sandbox, timeout, or recovery failure | Depends on error code |
| `tenant` | Tenant ownership, isolation, or organization boundary error | Usually no |
| `monetization` | Entitlement, quota, ledger, or billing error | Depends on error code |
| `external` | External system fluctuation | Depends on error code |
| `internal` | Uncategorized internal error | Default no |

## 5. Relationship with Retry and Recovery

- `retryable=true` only indicates permission to enter the retry policy and does not equal mandatory retry.
- Retry still needs to consider `RetryPolicy`, remaining budget, tool idempotency, and execution mode.
- Non-retryable errors entering dead-letter or human escalation must preserve the `AppError.code`.

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

The core of the error model is not "defining a few more exception classes", but ensuring that failures at any layer of the system can be uniformly classified, uniformly presented, and uniformly recovered.
