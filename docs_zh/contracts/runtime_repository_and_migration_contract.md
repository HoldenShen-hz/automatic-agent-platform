# Runtime Repository And Migration Contract

---

## OAPEFLIR 关联

本 contract 参与 OAPEFLIR 八阶段循环中的以下阶段：

- **Observe**：信号采集与聚合
- **Assess**：执行前评估与风险判断
- **Plan**：任务分解与 DAG 构建
- **Execute**：步骤执行与容错
- **Feedback**：信号收集与预处理
- **Learn**：模式检测与知识提取
- **Improve**：改进候选评估与 rollout
- **Release**：受控发布与回滚

---

## 1. Scope

This contract defines Phase 1a runtime persistence layer authoritative rules for "code interface layer" and "database migration layer".

It answers two questions:

- Which repository should read and write runtime-related data.
- What rules should schema changes, initial table creation, and subsequent migration comply with.

Related documents:

- `runtime_execution_contract.md` defines runtime run execution semantics.
- `storage_schema_contract.md` defines final table structure, indexes, foreign keys, and transaction boundaries.
- `runtime_state_machine_contract.md` defines whether state transitions are legal.

## 2. Goals

Phase 1a repository layer should satisfy:

- Can reliably create and update `executions` main record.
- Can persist `execution_prechecks`, `dead_letters`, `heartbeat_snapshots`.
- Can rebuild "which runs are executing, which runs are blocked, which runs are dead-letter" after crash recovery.
- Can let migration initialize SQLite in idempotent, auditable, replayable way.

## 3. Repository Boundaries

Phase 1a minimum requires the following repositories:

- `ExecutionRepository`
- `ExecutionPrecheckRepository`
- `DeadLetterRepository`
- `HeartbeatSnapshotRepository`
- `SessionRepository`
- `EventAckRepository`
- `FileLockRepository`
- `RuntimeRecoveryRepository`

Rules:

- Repository is responsible for authoritative persistence, does not undertake business orchestration.
- Workflow orchestration layer must not directly scatter-write SQL to multiple runtime tables bypassing repository.
- Repository return value must be sufficient to support runtime recovery, not just return boolean.

## 4. `ExecutionRepository` Contract

Minimum method set:

- `createExecution(input)`
- `getExecutionById(executionId)`
- `listExecutionsByTask(taskId)`
- `markExecutionStarted(executionId, startedAt)`
- `markExecutionBlocked(executionId, reasonCode, updatedAt)`
- `createRetryExecution(input)`
- `markExecutionSucceeded(executionId, finishedAt)`
- `markExecutionFailed(executionId, errorCode, errorMessage, finishedAt)`
- `markExecutionCancelled(executionId, reasonCode, finishedAt)`
- `attachExecutionError(executionId, errorCode, errorMessage, updatedAt)`

Behavioral constraints:

- `createExecution` must write initial attempt, trace, guardrail parsing result.
- Retry should not be implemented through original execution entering independent `retrying` state, but should create new attempt execution and retain lineage.
- Terminal state methods must not overwrite existing terminal state, unless it is explicitly recovery-generated new execution.
- State progression must align with `runtime_state_machine_contract.md`.

## 5. `ExecutionPrecheckRepository` Contract

Minimum method set:

- `savePrecheckResult(input)`
- `getPrecheckByExecutionId(executionId)`
- `replacePrecheckResult(input)` only available when repository explicitly uses upsert strategy

Rules:

- Phase 1a defaults to keeping only one authoritative precheck result per execution.
- Precheck result must be queryable before execution enters `executing / blocked / failed`.
- Not allowed to only log precheck, with no record in database.

## 6. `DeadLetterRepository` Contract

Minimum method set:

- `moveExecutionToDeadLetter(input)`
- `getDeadLetterByExecutionId(executionId)`
- `listDeadLettersByTask(taskId)`

Rules:

- Same execution can only enter dead-letter once.
- Dead-letter record must retain final error reason, retry count, and timestamp.
- Dead-letter is not a substitute for task main state machine; repository must not implicitly rewrite task terminal state.

## 7. `HeartbeatSnapshotRepository` Contract

Minimum method set:

- `appendHeartbeatSnapshot(input)`
- `getLatestHeartbeat(executionId)`
- `listRecentHeartbeats(executionId, limit)`
- `pruneHeartbeatSnapshots(beforeTimestamp)`

Rules:

- High-frequency heartbeat defaults to writing snapshot, does not guarantee every heartbeat is permanently retained.
- `getLatestHeartbeat` should serve supervisor's liveness judgment.
- `pruneHeartbeatSnapshots` is a maintenance action, must not delete latest snapshot still used for recovery judgment.

## 8. `RuntimeRecoveryRepository` Contract

Minimum method set:

- `listRecoverableExecutingRuns(now)`
- `listBlockedRunsAwaitingApproval()`
- `listStaleRuns(staleBefore)`
- `buildRuntimeRecoveryView(taskId)`

Return result at minimum should contain:

- `execution_id`
- `task_id`
- `status`
- `attempt`
- `trace_id`
- `last_heartbeat_at?`
- `latest_precheck?`
- `latest_error_code?`

Rules:

- This repository can compose reading multiple tables, but exposes unified recovery view to upper layer.
- Its output must be sufficient for runtime to decide "resume / retry / manual takeover / dead-letter".

## 9. `SessionRepository` and `EventAckRepository` Contract

`SessionRepository` minimum method set:

- `createSession(input)`
- `getSessionById(sessionId)`
- `markSessionStreaming(sessionId, updatedAt)`
- `markSessionAwaitingUser(sessionId, updatedAt)`
- `markSessionCompleted(sessionId, updatedAt)`
- `markSessionFailed(sessionId, updatedAt)`
- `markSessionCancelled(sessionId, updatedAt)`

Rules:

- Session status can only express channel interaction progress, must not override task / workflow / execution truth state.
- Session terminal state closure must be consistent with or explainable from task terminal state.

`EventAckRepository` minimum method set:

- `registerConsumerAck(eventId, consumerId)`
- `markEventAcked(eventId, consumerId, ackedAt)`
- `markEventAckFailed(eventId, consumerId, errorCode, attemptedAt)`
- `listPendingAcksByConsumer(consumerId, limit)`

Rules:

- `event_id + consumer_id` must be unique.
- Ack status update must not overwrite other consumer's confirmation result.
- Tier 1 event recovery scan should rely on ack records, not rely on single event-level boolean judgment.

`FileLockRepository` minimum method set:

- `acquireLock(input)`
- `renewLock(lockId, expiresAt)`
- `releaseLock(lockId)`
- `releaseAllByExecution(executionId)`
- `listExpiredLocks(now)`
- `listLocksByPath(normalizedPath)`

Rules:

- Reentrant lock of `normalized_path + holder_execution_id + mode` should be identifiable.
- Write lock mutex constraint must be guaranteed by authoritative persistence layer, not just by in-memory judgment.
- Expired lock cleanup and holder execution stale judgment must be composable in query.

## 10. Transaction Boundaries

The following actions should be completed in the same transaction as much as possible:

- Creating execution + initial status write.
- Saving precheck result + execution state progression.
- Execution entering `blocked` + approval request write.
- Execution entering terminal state + last error message write.
- Execution dead-letter + dead-letter record write.
- Event write + initial consumer ack registration.
- File lock expiration recovery + holder execution stale judgment result write recovery event.

Rules:

- If cannot achieve single transaction, must ensure recovery path can identify "half-completed write" and compensate.
- Repository must not split multi-table critical updates into completely unrelated fire-and-forget operations.

## 11. Migration Directory and Naming Rules

Phase 1a recommends:

- Directory: `src/core/storage/migrations/`
- Filename: `0001_initial_runtime_schema.sql`, `0002_add_runtime_indexes.sql`

Rules:

- Migration number must be monotonically increasing, not allowed to reorder historical numbers.
- Migration already executed in shared environment must not be directly rewritten, only subsequent migration can be added.
- Initial schema and subsequent incremental migration must be distinguishable.

## 12. Migration Content Rules

Each migration must:

- Be idempotent or at least be able to clearly determine whether executed.
- Try to do only one type of change: create table, add index, add column, backfill data.
- Avoid doing structural change and complex data repair in the same migration.

Phase 1a special rules:

- `0001` should be able to independently initialize runtime-related core tables.
- Create table migration must explicitly enable and rely on `PRAGMA foreign_keys = ON` running strategy.
- If SQLite does not support lossless change, explicitly handle through "new table + data migration + replacement" strategy.

## 13. Migration Ledger

System should maintain migration ledger, minimum fields:

- `version`
- `name`
- `applied_at`
- `checksum?`

Rules:

- Runtime start should be able to determine whether current database schema is lagging.
- If missing critical migration is found, default fail-closed, should not run quietly with incomplete schema.

## 14. Rollback and Compatibility Rules

- Phase 1a prioritizes forward fix, does not take "automatic down migration" as default capability.
- Destructive schema change must first add compatibility layer, then do data migration.
- Repository interface change if affecting field semantics, must update contract first, then change implementation.

## 15. Testing and Verification Requirements

At minimum should cover the following verification:

- Migration initializes successfully from empty database.
- Migration repeated execution does not destroy schema.
- Repository can correctly persist execution lifecycle.
- Precheck / dead-letter / heartbeat query interface can support supervisor and recovery process.
- Session state progression does not conflict with task / workflow truth state.
- Event ack query can identify "a consumer has not acknowledged" rather than just identify "event not consumed".
- File lock query can identify shared read lock, exclusive write lock, reentrant lock, and expired lock.
- Under crash recovery scenario, `RuntimeRecoveryRepository` can identify stale / blocked / recoverable run.

## 16. Supplementary Rules

- After PG migration, repositories at minimum split into transaction repositories and queue/lease support repositories.
- Migration checksum must be stably recalculable; if introducing signature, signature only enhances release credibility, does not replace checksum.
- Phase 1b multi-worker scenario should add `LeaseRepository`, and maintain explainable transaction boundary with `ExecutionRepository`.


## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- T-56: Repository方法(markExecutionStarted等)直操作executions表，架构§5.3强制所有状态转换经RuntimeStateMachine.transition()。修复：该语义收敛到 v4.3 canonical contract；旧字段、旧状态、旧 DTO 或旧术语仅允许作为 legacy/deprecated/projection/migration input，不得作为新实现入口。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`。
