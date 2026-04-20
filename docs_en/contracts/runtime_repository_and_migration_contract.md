# Runtime Repository And Migration Contract

## 1. Scope

This contract defines Phase 1a runtime persistence layer authoritative rules at "code interface layer" and "database migration layer."

It answers two questions:

- Which repositories read/write runtime-related data.
- What rules must schema changes, initial table creation, and subsequent migrations follow.

Related documents:

- `runtime_execution_contract.md` defines runtime run execution semantics.
- `storage_schema_contract.md` defines final table structure, indexes, foreign keys, and transaction boundaries.
- `runtime_state_machine_contract.md` defines whether state transitions are legal.

## 2. Goals

Phase 1a repository layer should satisfy:

- Can reliably create and update `executions` main records.
- Can persist `execution_prechecks`, `dead_letters`, `heartbeat_snapshots`.
- Can reconstruct "which runs are executing, which are blocked, which are dead-lettered" after crash recovery.
- Can initialize SQLite idempotently, auditably, and replayably through migration.

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

- Repository is responsible for authoritative persistence and does not undertake business orchestration.
- Workflow orchestration layer must not directly scatter-write SQL to multiple runtime tables bypassing repository.
- Repository return values must sufficiently support runtime recovery rather than just returning boolean.

## 4. `ExecutionRepository` Contract

Minimum method set:

- `createExecution(input)`
- `getExecutionById(executionId)`
- `listExecutionsByTask(taskId)`
- `markExecutionStarted(executionId, startedAt)`
- `markExecutionBlocked(executionId, reasonCode, updatedAt)`
- `markExecutionRetrying(executionId, retryCount, errorCode, updatedAt)`
- `markExecutionSucceeded(executionId, finishedAt)`
- `markExecutionFailed(executionId, errorCode, errorMessage, finishedAt)`
- `markExecutionCancelled(executionId, reasonCode, finishedAt)`
- `attachExecutionError(executionId, errorCode, errorMessage, updatedAt)`

Behavioral constraints:

- `createExecution` must write initial attempt, trace, guardrail parsing result.
- Terminal state methods must not overwrite existing terminal state unless explicitly recovery-generated new execution.
- State progression must align with `runtime_state_machine_contract.md`.

## 5. `ExecutionPrecheckRepository` Contract

Minimum method set:

- `savePrecheckResult(input)`
- `getPrecheckByExecutionId(executionId)`
- `replacePrecheckResult(input)` only available when repository explicitly uses upsert strategy

Rules:

- Phase 1a defaults to retaining only one authoritative precheck result per execution.
- Precheck result must be queryable before execution enters `executing / blocked / failed`.
- Not allowed to only log precheck without database record.

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

- High-frequency heartbeat defaults to writing snapshots and does not guarantee every heartbeat permanently retained.
- `getLatestHeartbeat` should serve supervisor's liveness judgment.
- `pruneHeartbeatSnapshots` is a maintenance action and must not delete latest snapshot still used for recovery judgment.

## 8. `RuntimeRecoveryRepository` Contract

Minimum method set:

- `listRecoverableExecutingRuns(now)`
- `listBlockedRunsAwaitingApproval()`
- `listStaleRuns(staleBefore)`
- `buildRuntimeRecoveryView(taskId)`

Return results at minimum include:

- `execution_id`
- `task_id`
- `status`
- `attempt`
- `trace_id`
- `last_heartbeat_at?`
- `latest_precheck?`
- `latest_error_code?`

Rules:

- This repository can compositely read multiple tables but exposes unified recovery view to upper layer.
- Its output must be sufficient for runtime to decide "resume / retry / manual takeover / dead-letter".

## 9. `SessionRepository` and `EventAckRepository` Contracts

`SessionRepository` minimum method set:

- `createSession(input)`
- `getSessionById(sessionId)`
- `markSessionStreaming(sessionId, updatedAt)`
- `markSessionAwaitingUser(sessionId, updatedAt)`
- `markSessionCompleted(sessionId, updatedAt)`
- `markSessionFailed(sessionId, updatedAt)`
- `markSessionCancelled(sessionId, updatedAt)`

Rules:

- Session state can only express channel interaction progress and must not overwrite task / workflow / execution truth state.
- Session terminal state closure must be consistent with or explainable by task terminal state.

`EventAckRepository` minimum method set:

- `registerConsumerAck(eventId, consumerId)`
- `markEventAcked(eventId, consumerId, ackedAt)`
- `markEventAckFailed(eventId, consumerId, errorCode, attemptedAt)`
- `listPendingAcksByConsumer(consumerId, limit)`

Rules:

- `event_id + consumer_id` must be unique.
- Ack status update must not overwrite other consumers' acknowledgment results.
- Tier 1 event recovery scan should rely on ack records rather than single event-level boolean judgment.

`FileLockRepository` minimum method set:

- `acquireLock(input)`
- `renewLock(lockId, expiresAt)`
- `releaseLock(lockId)`
- `releaseAllByExecution(executionId)`
- `listExpiredLocks(now)`
- `listLocksByPath(normalizedPath)`

Rules:

- Reentrant lock of `normalized_path + holder_execution_id + mode` should be identifiable.
- Write lock mutual exclusion constraint must be guaranteed by authoritative persistence layer rather than just in-memory judgment.
- Expired lock cleanup and holder execution stale judgment must be composably queryable.

## 10. Transaction Boundaries

The following actions should as much as possible be completed in the same transaction:

- Creating execution + initial state write.
- Saving precheck result + execution state progression.
- Execution entering `blocked` + approval request write.
- Execution entering terminal state + last error message write.
- Execution dead-letter + dead-letter record write.
- Event write + initial consumer ack registration.
- File lock expired recovery + holder execution stale judgment result write recovery event.

Rules:

- If single transaction cannot be achieved, must guarantee recovery path can identify "half-complete write" and compensate.
- Repository must not split multi-table critical updates into completely unrelated fire-and-forget operations.

## 11. Migration Directory and Naming Rules

Phase 1a recommends adopting:

- Directory: `src/core/storage/migrations/`
- Filename: `0001_initial_runtime_schema.sql`, `0002_add_runtime_indexes.sql`

Rules:

- Migration numbers must be monotonically increasing and must not reorder historical numbers.
- Migrations already executed in shared environment must not be directly modified, only new subsequent migration added.
- Initial schema and subsequent incremental migrations must be distinguishable.

## 12. Migration Content Rules

Each migration must:

- Be idempotent or at minimum can clearly determine whether executed.
- Try to do only one type of change: create table, add index, add column, backfill data.
- Avoid doing structural change and complex data repair in the same migration.

Phase 1a special rules:

- `0001` should be able to independently initialize runtime-related core tables.
- Table creation migration must explicitly enable and depend on `PRAGMA foreign_keys = ON` running strategy.
- If SQLite does not support lossless change, should explicitly handle through "new table + data migration + replacement" strategy.

## 13. Migration Ledger

System should maintain migration ledger with minimum fields:

- `version`
- `name`
- `applied_at`
- `checksum?`

Rules:

- Runtime startup should be able to determine whether current database schema is lagging.
- If missing critical migration is found, defaults to fail-closed and should not silently run with incomplete schema.

## 14. Rollback and Compatibility Rules

- Phase 1a prioritizes forward roll (rollforward) repair and does not use "automatic down migration" as default capability.
- Destructive schema changes must first add compatibility layer, then do data migration.
- If repository interface change affects field semantics, must first update contract before changing implementation.

## 15. Testing and Verification Requirements

At minimum cover the following verifications:

- Migration initializes successfully from empty database.
- Migration repeated execution does not corrupt schema.
- Repository can correctly persist execution lifecycle.
- Precheck / dead-letter / heartbeat query interfaces can support supervisor and recovery process.
- Session state progression does not conflict with task / workflow truth state.
- Event ack query can identify "consumer has not acknowledged" rather than just "event not consumed."
- File lock query can identify shared read lock, exclusive write lock, reentrant lock, and expired lock.
- Under crash recovery scenario, `RuntimeRecoveryRepository` can identify stale / blocked / recoverable run.

## 16. Supplementary Rules

- After PG migration, repository at minimum divides into transaction repositories and queue/lease support repositories.
- Migration checksum must be stably recalculable; if introducing signature, signature only enhances publishing credibility and does not replace checksum.
- Phase 1b multi-worker scenario should add `LeaseRepository` and maintain explicable transaction boundaries with `ExecutionRepository`.
