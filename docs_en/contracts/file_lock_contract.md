# File Lock Contract

---

## OAPEFLIR 关联

本 contract 参vs OAPEFLIR 八阶段循环中的以下阶段：

- **Observe**：信号采集vs聚合
- **Assess**：执lines前评估vs风险判断
- **Plan**：任务分解vs DAG 构建
- **Execute**：步骤执linesvs容错
- **Feedback**：信号收集vs预handle
- **Learn**：模式检测vs知识提取
- **Improve**：改进候选评估vs rollout
- **Release**：受控发布vs回滚

---

## 1. 范围

本 contract defines文件锁的读写语义、租约规则、崩溃回收和vs tool / sandbox 的边界。

相关文档：

- `tool_and_provider_execution_contract.md`
- `sandbox_and_auth_contract.md`
- `storage_schema_contract.md`
- `runtime_repository_and_migration_contract.md`
- `error_code_registry.md`

## 2. 目标

Phase 1a / 1b 至少要做到：

- 同一文件不会被两个写操作同时修改。
- 读写conflicts可检测、可等待、可timeout。
- 崩溃后遗留锁能被启动巡检和恢复链清理。

## 3. 关键对象

### 3.1 `FileLockRequest`

| 字段 | class型 | Description |
|---|-------|--------|
| `lock_scope` | `file` | 当前阶段固定为文件级 |
| `target_path` | `string` | 绝对规范化路径 |
| `mode` | `read \| write` | 锁模式 |
| `task_id` | `string?` | legacy 任务投影 ID |
| `harness_run_id` | `string` | HarnessRun ID |
| `node_run_id` | `string` | NodeRun ID |
| `agent_id` | `string` | agent ID |
| `ttl_seconds` | `number` | 租约 TTL |
| `wait_timeout_ms` | `number` | 等待conflicts释放time |
| `reentrant_token` | `string?` | 同 node run 重入标识 |

### 3.2 `FileLockRecord`

- `lock_id`
- `target_path`
- `normalized_path`
- `mode`
- `holder_task_id?`
- `holder_harness_run_id`
- `holder_node_run_id`
- `holder_agent_id`
- `acquired_at`
- `expires_at`
- `last_renewed_at`

## 4. 兼容矩阵

| 已有锁 | 新request | 结果 |
|---|-------|--------|
| `read` | `read` | 允许共享 |
| `read` | `write` | 阻塞等待或failed |
| `write` | `read` | 阻塞等待或failed |
| `write` | `write` | 排他conflicts |

补充规则：

- 同一 `node_run_id + normalized_path + mode` 的重入request可复用已有锁。
- 同一 node run 已持有 `write` 锁时，再request同文件 `read` 锁应directly复用，不再降级。
- 不允许“两个不同 node run 但同 task”bypassing排他规则。

## 5. 租约vs续约

- Phase 1a defaults to TTL Recommendation为 `60s`。
- 活跃 node run 必须via heartbeat 或显式 `renewLock(...)` 续约。
- 锁过期后不代table自动security可写；恢复链应先确认 holder node run 已 stale 或终止。

## 6. 服务入口

最小接口：

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

## 7. vs工具、沙箱的边界

- `read_file / grep / list` 这class只读工具defaults to可按需获取 `read` 锁。
- `write_file / edit / patch` 这class写工具必须先持有 `write` 锁。
- `bash` 这class不可静态精确推断写集的工具，不得as精细文件锁security；应由更粗的 ExecPolicy 和审批策略守卫。
- FileLock 不替代 sandbox 路径白名单，它只解决同路径concurrentconflicts。

## 8. storagevs恢复边界

- authoritative 锁Status必须持久化，不得只存在内存 Map。
- 启动巡检应清理 `expires_at < now` 且 holder execution 已失活的锁。
- 若 execution 终止但锁仍存在，应由恢复链或清理器释放。

## 9. 错误语义

Recommendation稳定错误码：

- `tool.file_lock_conflict`
- `tool.file_lock_timeout`
- `runtime.stale_lock_detected`

规则：

- 等待timeout应返回conflictsclass错误，而不is笼统 `tool.execution_failed`。
- 发现锁record损坏或 holder inconsistent时，应上报恢复错误并进入巡检handle。

## 10. Phase 边界

Phase 1a 明确做：

- 文件级锁
- SQLite 持久化
- TTL + heartbeat 续约
- 启动回收vs execution 终止回收

当前不做：

- 目录级锁
- 分布式锁服务
- Git worktree 级隔离替代

## 11. 收口Conclusion

文件锁的目标不is“让所有 IO 都自动security”，而is把最危险的concurrent写conflicts压到一个清楚、可审计、可恢复的最小边界里。
