# File Lock Contract

---

## OAPEFLIR Related

This contract participates in the following stages of the OAPEFLIR 8-stage cycle:

- **Observe**: Signal collection and aggregation
- **Assess**: Pre-execution evaluation and risk assessment
- **Plan**: Task decomposition and DAG construction
- **Execute**: Step execution and fault tolerance
- **Feedback**: Signal collection and preprocessing
- **Learn**: Pattern detection and knowledge extraction
- **Improve**: Improvement candidate evaluation and rollout
- **Release**: Controlled release and rollback

---

## 1. Scope

This contract defines read/write semantics, lease rules, crash recovery, and boundary with tool / sandbox for file locks.

Related Documents:

- `tool_and_provider_execution_contract.md`
- `sandbox_and_auth_contract.md`
- `storage_schema_contract.md`
- `runtime_repository_and_migration_contract.md`
- `error_code_registry.md`

## 2. Goals

Phase 1a / 1b minimum must achieve:

- Same file not modified by two write operations simultaneously.
- Read/write conflicts detectable, waitable, timeoutable.
- Post-crash orphaned locks can be cleaned up by startup scan and recovery chain.

## 3. Key Objects

### 3.1 `FileLockRequest`

| Field | Type | Description |
| --- | --- | --- |
| `lock_scope` | `file` | Fixed to file-level for current phase |
| `target_path` | `string` | Absolute normalized path |
| `mode` | `read \| write` | Lock mode |
| `task_id` | `string` | Task ID |
| `execution_id` | `string` | Execution ID |
| `agent_id` | `string` | Agent ID |
| `ttl_seconds` | `number` | Lease TTL |
| `wait_timeout_ms` | `number` | Wait time for conflict release |
| `reentrant_token` | `string?` | Reentrant identifier for same execution |

### 3.2 `FileLockRecord`

- `lock_id`
- `target_path`
- `normalized_path`
- `mode`
- `holder_task_id`
- `holder_execution_id`
- `holder_agent_id`
- `acquired_at`
- `expires_at`
- `last_renewed_at`

## 4. Compatibility Matrix

| Existing Lock | New Request | Result |
| --- | --- | --- |
| `read` | `read` | Shared allowed |
| `read` | `write` | Block or fail |
| `write` | `read` | Block or fail |
| `write` | `write` | Exclusive conflict |

Supplementary rules:

- Reentrant request for same `execution_id + normalized_path + mode` may reuse existing lock.
- When same execution already holds `write` lock, requesting `read` lock for same file should directly reuse, not downgrade.
- Not allowed: "two different executions but same task" bypassing exclusive rules.

## 5. Lease And Renewal

- Phase 1a default TTL suggestion is `60s`.
- Active execution must renew via heartbeat or explicit `renewLock(...)`.
- Lock expiration does not mean automatically safe to write; recovery chain should first confirm holder execution is stale or terminated.

## 6. Service Entry Points

Minimum interface:

- `acquireLock(request)`
- `renewLock(lockId, now)`
- `releaseLock(lockId)`
- `releaseAllByExecution(executionId)`
- `listLocksByExecution(executionId)`
- `listExpiredLocks(now)`
- `reapExpiredLocks(now)`

```mermaid
flowchart TD
    A["Tool / Sandbox Wants File Access"] --> B{"Need Write?"}
    B -- "No" --> C["Acquire Read Lock If Writer Exists"]
    B -- "Yes" --> D["Acquire Write Lock"]
    C --> E{"Conflict?"}
    D --> E
    E -- "No" --> F["Execute Tool"]
    E -- "Yes" --> G["Wait / Timeout / Conflict Error"]
    F --> H["Release Or Renew"]
```

## 7. Boundary With Tool And Sandbox

- Read-only tools like `read_file / grep / list` can acquire `read` lock on demand by default.
- Write tools like `write_file / edit / patch` must hold `write` lock first.
- Tools like `bash` whose write set cannot be statically precisely inferred must not impersonate fine-grained file lock safety; should be guarded by coarser ExecPolicy and approval policy.
- FileLock does not replace sandbox path whitelist; it only solves same-path concurrency conflicts.

## 8. Storage And Recovery Boundary

- Authoritative lock state must be persisted; must not exist only in memory Map.
- Startup scan should clean locks where `expires_at < now` and holder execution is inactive.
- If execution terminates but lock still exists, recovery chain or cleaner should release.

## 9. Error Semantics

Suggested stable error codes:

- `tool.file_lock_conflict`
- `tool.file_lock_timeout`
- `runtime.stale_lock_detected`

Rules:

- Wait timeout should return conflict-type error, not generic `tool.execution_failed`.
- When lock record corruption or holder inconsistency detected, should report recovery error and enter scan processing.

## 10. Phase Boundaries

Phase 1a explicitly does:

- File-level lock
- SQLite persistence
- TTL + heartbeat renewal
- Startup reclaim and execution termination reclaim

Currently not doing:

- Directory-level lock
- Distributed lock service
- Git worktree-level isolation replacement

## 11. Closure Conclusion

The goal of file lock is not "make all IO automatically safe", but to compress the most dangerous concurrent write conflicts into a clear, auditable, recoverable minimum boundary.