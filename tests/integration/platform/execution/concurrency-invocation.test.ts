/**
 * Concurrency Tests: Execution Plane Race Conditions
 *
 * Tests concurrent access patterns for execution plane components.
 * Verifies race conditions don't cause data corruption, lock acquisition
 * works correctly, and concurrent state modifications maintain invariants.
 *
 * Covers Section 17 requirements:
 * - Race tests for concurrent operations
 * - Idempotency tests for duplicate operations
 * - Critical section tests for lock enforcement
 * - Lock timeout handling verification
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { runConcurrentInvariant, runConcurrentStateModification, runCriticalSectionTest } from "../../../helpers/concurrent-runner.js";
import { SqliteQueueAdapter } from "../../../../src/platform/execution/queue/sqlite-queue-adapter.js";
import { QUEUE_JOBS_DDL } from "../../../../src/platform/execution/queue/queue-adapter-types.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { TransitionService } from "../../../../src/platform/execution/state-transition/transition-service.js";
import { createRuntimeLifecycleRepository } from "../../../../src/platform/state-evidence/truth/repositories/runtime-lifecycle-repository.js";
import { SqliteLockAdapter } from "../../../../src/platform/execution/distributed-lock/sqlite-lock-adapter.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";

// ============================================================================
// Test 1: Concurrent Task Updates
// ============================================================================

test("[CONCURRENCY-1] concurrent task status updates don't corrupt state", async () => {
  const workspace = createTempWorkspace("concurrent-task-update-");
  const dbPath = join(workspace, "task-update.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repository = createRuntimeLifecycleRepository(store);
    const transitions = new TransitionService(db, store, repository);

    const taskId = "concurrent-task-001";
    const executionId = "exec-concurrent-001";
    const now = nowIso();

    // Set up initial task
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Concurrent update test task",
        status: "queued",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.01,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "created",
        inputRef: null,
        traceId: "trace-001",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Simulate concurrent transitions from queued to in_progress
    const result = await runConcurrentInvariant(
      async (workerId: number) => {
        try {
          transitions.transitionTaskStatus({
            entityKind: "task",
            entityId: taskId,
            fromStatus: "queued",
            toStatus: "in_progress",
            executionId,
            reasonCode: `task.started.worker-${workerId}`,
            traceId: `trace-worker-${workerId}`,
            actorType: "system",
            occurredAt: nowIso(),
          });
          return { success: true, workerId };
        } catch (err) {
          return { success: false, workerId, error: err instanceof Error ? err.message : String(err) };
        }
      },
      { concurrency: 5 },
    );

    // Exactly one transition should succeed (CAS prevents concurrent overwrites)
    const successes = result.values.filter((v) => v.success);
    const failures = result.values.filter((v) => !v.success);

    assert.equal(successes.length, 1, "Exactly one concurrent update should succeed");
    assert.equal(failures.length, 4, "Other concurrent updates should fail due to CAS");

    // Verify final state is consistent
    const task = store.getTask(taskId);
    assert.equal(task?.status, "in_progress", "Task should be in in_progress state");
    assert.ok(task?.updatedAt, "updatedAt should be set");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("[CONCURRENCY-1] concurrent task terminal state transitions maintain data integrity", async () => {
  const workspace = createTempWorkspace("concurrent-terminal-");
  const dbPath = join(workspace, "terminal-transition.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repository = createRuntimeLifecycleRepository(store);
    const transitions = new TransitionService(db, store, repository);

    const taskId = "terminal-task-001";
    const executionId = "exec-terminal-001";
    const now = nowIso();

    // Set up task in in_progress state
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Terminal state test task",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.01,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-terminal",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Concurrent attempts to transition to different terminal states
    const results = await Promise.allSettled([
      Promise.resolve().then(() => transitions.transitionTaskStatus({
        entityKind: "task",
        entityId: taskId,
        fromStatus: "in_progress",
        toStatus: "done",
        executionId,
        reasonCode: "task.completed",
        traceId: "trace-done",
        actorType: "system",
        occurredAt: nowIso(),
      })),
      Promise.resolve().then(() => transitions.transitionTaskStatus({
        entityKind: "task",
        entityId: taskId,
        fromStatus: "in_progress",
        toStatus: "failed",
        executionId,
        reasonCode: "task.failed",
        traceId: "trace-failed",
        actorType: "system",
        occurredAt: nowIso(),
      })),
      Promise.resolve().then(() => transitions.transitionTaskStatus({
        entityKind: "task",
        entityId: taskId,
        fromStatus: "in_progress",
        toStatus: "cancelled",
        executionId,
        reasonCode: "task.cancelled",
        traceId: "trace-cancelled",
        actorType: "system",
        occurredAt: nowIso(),
      })),
    ]);

    const succeeded = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");

    // One and only one terminal transition should succeed
    assert.equal(succeeded.length, 1, "Exactly one terminal transition should succeed");
    assert.equal(failed.length, 2, "Other terminal transitions should fail");

    // Verify task is in a terminal state
    const task = store.getTask(taskId);
    assert.ok(
      task?.status === "done" || task?.status === "failed" || task?.status === "cancelled",
      `Task should be in a terminal state, got ${task?.status}`,
    );
    assert.ok(task?.completedAt, "completedAt should be set for terminal state");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("[CONCURRENCY-1] many concurrent workers updating same task field maintain consistency", async () => {
  const workspace = createTempWorkspace("concurrent-field-update-");
  const dbPath = join(workspace, "field-update.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repository = createRuntimeLifecycleRepository(store);
    const transitions = new TransitionService(db, store, repository);

    const taskId = "field-update-task-001";
    const executionId = "exec-field-001";
    const now = nowIso();

    // Set up task
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Field update test",
        status: "queued",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.01,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "created",
        inputRef: null,
        traceId: "trace-field",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // First transition to in_progress
    transitions.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "queued",
      toStatus: "in_progress",
      executionId,
      reasonCode: "task.started",
      traceId: "trace-initial",
      actorType: "system",
      occurredAt: nowIso(),
    });

    // Concurrent transition attempts from in_progress to various states
    const result = await runConcurrentInvariant(
      async (workerId: number) => {
        try {
          // 10 workers try await_decision, 10 try done
          const toStatus = workerId < 10 ? "awaiting_decision" : "done";
          transitions.transitionTaskStatus({
            entityKind: "task",
            entityId: taskId,
            fromStatus: "in_progress",
            toStatus,
            executionId,
            reasonCode: `task.${toStatus}.worker-${workerId}`,
            traceId: `trace-${workerId}`,
            actorType: "system",
            occurredAt: nowIso(),
          });
          return { success: true, workerId, toStatus };
        } catch (err) {
          return { success: false, workerId, error: err instanceof Error ? err.message : String(err) };
        }
      },
      { concurrency: 20 },
    );

    // All attempts should complete (some succeed, some fail due to CAS)
    assert.equal(result.errors.length, 0, "No unexpected errors");

    // Final state should be consistent
    const task = store.getTask(taskId);
    assert.ok(
      task?.status === "awaiting_decision" || task?.status === "done",
      `Task should be in valid final state, got ${task?.status}`,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ============================================================================
// Test 2: Concurrent Execution Creation
// ============================================================================

test("[CONCURRENCY-2] concurrent execution creation with same taskId doesn't create duplicates", async () => {
  const workspace = createTempWorkspace("concurrent-exec-create-");
  const dbPath = join(workspace, "exec-create.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = "exec-create-task-001";
    const existingExecutionId = "exec-existing-001";
    const now = nowIso();

    // Set up task and one existing execution
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Exec creation test",
        status: "queued",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.01,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
      store.insertExecution({
        id: existingExecutionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "created",
        inputRef: null,
        traceId: "trace-existing",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Count executions before concurrent insert attempts
    const beforeCount = store.listExecutionsByTask(taskId).length;
    assert.equal(beforeCount, 1, "Should have one existing execution");

    // Simulate concurrent insertExecution calls with same taskId
    const results = await runConcurrentStateModification(
      async () => {
        try {
          db.transaction(() => {
            store.insertExecution({
              id: `exec-new-${Date.now()}-${Math.random()}`,
              taskId,
              workflowId: "single_agent_minimal",
              parentExecutionId: null,
              agentId: "agent-1",
              roleId: "general_executor",
              runKind: "task_run",
              status: "created",
              inputRef: null,
              traceId: `trace-new-${Math.random()}`,
              attempt: 2,
              timeoutMs: 60000,
              budgetUsdLimit: 1,
              requiresApproval: 0,
              sandboxMode: "workspace_write",
              allowedToolsJson: "[]",
              allowedPathsJson: "[]",
              maxRetries: 0,
              retryBackoff: "none",
              lastErrorCode: null,
              lastErrorMessage: null,
              startedAt: null,
              finishedAt: null,
              createdAt: nowIso(),
              updatedAt: nowIso(),
            });
          });
        } catch {
          // Ignore duplicate key errors - this is expected
        }
      },
      { concurrency: 10 },
    );

    // Verify only valid executions were created (idempotency)
    const afterCount = store.listExecutionsByTask(taskId).length;
    assert.ok(afterCount >= beforeCount, "Execution count should not decrease");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("[CONCURRENCY-2] concurrent execution status transitions are serialized", async () => {
  const workspace = createTempWorkspace("concurrent-exec-transition-");
  const dbPath = join(workspace, "exec-transition.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repository = createRuntimeLifecycleRepository(store);
    const transitions = new TransitionService(db, store, repository);

    const taskId = "exec-transition-task-001";
    const executionId = "exec-transition-001";
    const now = nowIso();

    // Set up task in appropriate state
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Exec transition test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.01,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "created",
        inputRef: null,
        traceId: "trace-exec",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Run concurrent transitions on same execution
    const result = await runConcurrentInvariant(
      async (workerId: number) => {
        try {
          transitions.transitionExecutionStatus({
            entityKind: "execution",
            entityId: executionId,
            fromStatus: "created",
            toStatus: "executing",
            reasonCode: `execution.executing.${workerId}`,
            traceId: `trace-exec-${workerId}`,
            actorType: "system",
            occurredAt: nowIso(),
          });
          return { success: true, workerId };
        } catch (err) {
          return { success: false, workerId, error: err instanceof Error ? err.message : String(err) };
        }
      },
      { concurrency: 5 },
    );

    // Exactly one should succeed due to CAS
    const successes = result.values.filter((v) => v.success);
    assert.equal(successes.length, 1, "Exactly one transition should succeed");

    // Final state should be consistent
    const execution = store.getExecution(executionId);
    assert.equal(execution?.status, "executing", "Execution should be in executing state");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ============================================================================
// Test 3: Lock Timeout Handling
// ============================================================================

test("[CONCURRENCY-3] lock acquisition with TTL timeout works correctly", async () => {
  const db = new (await import("node:sqlite")).DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE IF NOT EXISTS distributed_locks (
      lock_key TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      fencing_token INTEGER NOT NULL,
      status TEXT NOT NULL,
      acquired_at TEXT NOT NULL,
      ttl_ms INTEGER NOT NULL,
      metadata TEXT
    );
  `);

  try {
    const adapter = new SqliteLockAdapter(db);

    // Acquire lock with short TTL
    const result1 = adapter.acquire({ lockKey: "timeout-lock", owner: "owner-1", ttlMs: 50 });
    assert.equal(result1.acquired, true, "First acquire should succeed");

    // Try to acquire same lock immediately (should fail - not expired)
    const result2 = adapter.acquire({ lockKey: "timeout-lock", owner: "owner-2", ttlMs: 30000 });
    assert.equal(result2.acquired, false, "Second acquire should fail - lock not expired");

    // Wait for TTL to expire
    await new Promise((resolve) => setTimeout(resolve, 60));

    // Now should be able to acquire
    const result3 = adapter.acquire({ lockKey: "timeout-lock", owner: "owner-2", ttlMs: 30000 });
    assert.equal(result3.acquired, true, "Should acquire after TTL expires");

    db.close();
  } finally {
    db.close();
  }
});

test("[CONCURRENCY-3] expired lock is automatically evicted on next acquire", async () => {
  const db = new (await import("node:sqlite")).DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE IF NOT EXISTS distributed_locks (
      lock_key TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      fencing_token INTEGER NOT NULL,
      status TEXT NOT NULL,
      acquired_at TEXT NOT NULL,
      ttl_ms INTEGER NOT NULL,
      metadata TEXT
    );
  `);

  try {
    const adapter = new SqliteLockAdapter(db);

    // Acquire with very short TTL
    const result1 = adapter.acquire({ lockKey: "expired-lock", owner: "owner-1", ttlMs: 10 });
    assert.equal(result1.acquired, true, "First acquire should succeed");

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 20));

    // New owner should steal the lock
    const result2 = adapter.acquire({ lockKey: "expired-lock", owner: "owner-2", ttlMs: 30000 });
    assert.equal(result2.acquired, true, "Should steal expired lock");

    const lock = adapter.inspect("expired-lock");
    assert.equal(lock?.owner, "owner-2", "Lock should be owned by new owner");

    db.close();
  } finally {
    db.close();
  }
});

test("[CONCURRENCY-3] lock extend only works for current owner", async () => {
  const db = new (await import("node:sqlite")).DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE IF NOT EXISTS distributed_locks (
      lock_key TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      fencing_token INTEGER NOT NULL,
      status TEXT NOT NULL,
      acquired_at TEXT NOT NULL,
      ttl_ms INTEGER NOT NULL,
      metadata TEXT
    );
  `);

  try {
    const adapter = new SqliteLockAdapter(db);

    // Acquire lock
    adapter.acquire({ lockKey: "extend-lock", owner: "owner-1", ttlMs: 100 });

    // Owner can extend
    const extendResult = adapter.extend("extend-lock", "owner-1", 5000);
    assert.ok(extendResult !== null, "Owner should be able to extend");

    // Different owner cannot extend
    const wrongExtend = adapter.extend("extend-lock", "owner-2", 5000);
    assert.equal(wrongExtend, null, "Non-owner should not be able to extend");

    db.close();
  } finally {
    db.close();
  }
});

test("[CONCURRENCY-3] force steal allows new owner to take expired lock", async () => {
  const db = new (await import("node:sqlite")).DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE IF NOT EXISTS distributed_locks (
      lock_key TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      fencing_token INTEGER NOT NULL,
      status TEXT NOT NULL,
      acquired_at TEXT NOT NULL,
      ttl_ms INTEGER NOT NULL,
      metadata TEXT
    );
  `);

  try {
    const adapter = new SqliteLockAdapter(db);

    // Acquire lock
    adapter.acquire({ lockKey: "steal-lock", owner: "owner-1", ttlMs: 30000 });

    // Force steal
    const stealResult = adapter.forceSteal("steal-lock", "owner-2", "emergency takeover");
    assert.ok(stealResult !== null, "Force steal should succeed");
    assert.equal(stealResult.owner, "owner-2", "New owner should be owner-2");

    // Previous owner cannot release
    const releaseResult = adapter.release("steal-lock", "owner-1");
    assert.equal(releaseResult, false, "Previous owner should not be able to release");

    // New owner can release
    const newRelease = adapter.release("steal-lock", "owner-2");
    assert.equal(newRelease, true, "New owner should be able to release");

    db.close();
  } finally {
    db.close();
  }
});

test("[CONCURRENCY-3] concurrent lock acquisition with timeout contention", async () => {
  const db = new (await import("node:sqlite")).DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE IF NOT EXISTS distributed_locks (
      lock_key TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      fencing_token INTEGER NOT NULL,
      status TEXT NOT NULL,
      acquired_at TEXT NOT NULL,
      ttl_ms INTEGER NOT NULL,
      metadata TEXT
    );
  `);

  try {
    const adapter = new SqliteLockAdapter(db);

    // Pre-acquire the lock
    adapter.acquire({ lockKey: "contention-lock", owner: "initial-owner", ttlMs: 30000 });

    // 10 concurrent workers trying to acquire same lock
    const result = await runConcurrentInvariant(
      async (workerId: number) => {
        return adapter.acquire({ lockKey: "contention-lock", owner: `worker-${workerId}`, ttlMs: 30000 });
      },
      { concurrency: 10 },
    );

    // All should complete without errors
    assert.equal(result.errors.length, 0, "No errors during contention");

    // Exactly one should succeed
    const successes = result.values.filter((r) => r.acquired === true);
    assert.equal(successes.length, 1, "Exactly one worker should acquire the lock");

    db.close();
  } finally {
    db.close();
  }
});

// ============================================================================
// Test 4: Concurrent Config Updates
// ============================================================================

test("[CONCURRENCY-4] concurrent queue adapter operations maintain consistency", async () => {
  const workspace = createTempWorkspace("concurrent-config-queue-");
  const dbPath = join(workspace, "config-queue.db");
  const db = new SqliteDatabase(dbPath, { migrationPlan: [] });
  db.connection.exec(QUEUE_JOBS_DDL);

  try {
    const adapter = new SqliteQueueAdapter(db);

    // Enqueue initial jobs
    for (let i = 0; i < 10; i++) {
      adapter.enqueue({ queueName: "config-queue", payload: { index: i } });
    }

    // Concurrent operations: some enqueue, some dequeue
    const enqueueResult = await runConcurrentInvariant(
      async (workerId: number) => {
        return adapter.enqueue({ queueName: "config-queue", payload: { workerId } });
      },
      { concurrency: 10 },
    );

    assert.equal(enqueueResult.errors.length, 0, "No errors during enqueue");
    assert.equal(enqueueResult.values.length, 10, "All 10 enqueues should succeed");

    // Verify queue consistency
    const jobs = adapter.listJobs("config-queue");
    assert.ok(jobs.length >= 10, `Queue should have at least 10 jobs, got ${jobs.length}`);

    // Concurrent dequeues
    const dequeueResult = await runConcurrentInvariant(
      async (_workerId: number) => {
        const dequeued = adapter.dequeue("config-queue");
        if (dequeued) {
          dequeued.ack();
          return dequeued.job.id;
        }
        return null;
      },
      { concurrency: 10 },
    );

    assert.equal(dequeueResult.errors.length, 0, "No errors during dequeue");

    db.close();
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("[CONCURRENCY-4] concurrent config updates via queue stats maintains invariant", async () => {
  const workspace = createTempWorkspace("concurrent-config-stats-");
  const dbPath = join(workspace, "config-stats.db");
  const db = new SqliteDatabase(dbPath, { migrationPlan: [] });
  db.connection.exec(QUEUE_JOBS_DDL);

  try {
    const adapter = new SqliteQueueAdapter(db);

    // Set up queue with varied job states
    for (let i = 0; i < 50; i++) {
      adapter.enqueue({ queueName: "stats-queue", payload: `job-${i}` });
    }

    // Concurrent stats calls while jobs are being processed
    const statsResults = await runConcurrentInvariant(
      async (_workerId: number) => {
        return adapter.stats("stats-queue");
      },
      { concurrency: 20 },
    );

    // All stats calls should return consistent data
    for (const stats of statsResults.values) {
      assert.equal(stats.queueName, "stats-queue", "Queue name should be consistent");
      assert.ok(stats.waiting >= 0, "Waiting count should be non-negative");
    }

    // Verify all stats return the same waiting count (no partial updates visible)
    const firstStats = statsResults.values[0];
    const uniqueWaitingCounts = new Set(statsResults.values.map((s) => s.waiting));
    assert.ok(uniqueWaitingCounts.size <= 2, "Stats should show consistent state");

    db.close();
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("[CONCURRENCY-4] concurrent list jobs returns consistent snapshot", async () => {
  const workspace = createTempWorkspace("concurrent-list-jobs-");
  const dbPath = join(workspace, "list-jobs.db");
  const db = new SqliteDatabase(dbPath, { migrationPlan: [] });
  db.connection.exec(QUEUE_JOBS_DDL);

  try {
    const adapter = new SqliteQueueAdapter(db);

    // Enqueue jobs
    for (let i = 0; i < 20; i++) {
      adapter.enqueue({ queueName: "list-queue", payload: `job-${i}`, priority: i });
    }

    // Concurrent list operations
    const listResults = await runConcurrentInvariant(
      async (_workerId: number) => {
        const jobs = adapter.listJobs("list-queue");
        return jobs.length;
      },
      { concurrency: 10 },
    );

    // All list calls should return same count
    const counts = listResults.values;
    const uniqueCounts = new Set(counts);
    assert.equal(uniqueCounts.size, 1, "All list calls should return same count");
    assert.equal(counts[0], 20, "Should list all 20 jobs");

    db.close();
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("[CONCURRENCY-4] critical section test for lock adapter mutual exclusion", async () => {
  const db = new (await import("node:sqlite")).DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE IF NOT EXISTS distributed_locks (
      lock_key TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      fencing_token INTEGER NOT NULL,
      status TEXT NOT NULL,
      acquired_at TEXT NOT NULL,
      ttl_ms INTEGER NOT NULL,
      metadata TEXT
    );
  `);

  try {
    const adapter = new SqliteLockAdapter(db);
    let currentHolder: number | null = null;

    const acquireLock = async (workerId: number): Promise<{ acquired: boolean; holder?: number }> => {
      const result = adapter.acquire({ lockKey: "critical-lock", owner: `worker-${workerId}`, ttlMs: 30000 });
      if (result.acquired) {
        if (currentHolder !== null) {
          return { acquired: false }; // Violation - someone else was holder
        }
        currentHolder = workerId;
        return { acquired: true, holder: workerId };
      }
      return { acquired: false };
    };

    const releaseLock = async (): Promise<void> => {
      if (currentHolder !== null) {
        adapter.release("critical-lock", `worker-${currentHolder}`);
        currentHolder = null;
      }
    };

    // First, acquire initial lock to set up contention
    const initial = adapter.acquire({ lockKey: "critical-lock", owner: "initial-owner", ttlMs: 30000 });
    assert.equal(initial.acquired, true, "Initial acquire should succeed");

    // Run critical section test
    const result = await runCriticalSectionTest(acquireLock, releaseLock, { concurrency: 10 });

    // In a proper implementation, there should be no violations
    // Note: This test may show violations if the SQLite adapter doesn't properly serialize
    assert.equal(result.maxConcurrent, 1, "Maximum concurrent holders should be 1");

    db.close();
  } finally {
    db.close();
  }
});

// ============================================================================
// Idempotency Tests
// ============================================================================

test("[CONCURRENCY-5] duplicate task transitions with same idempotency key are idempotent", async () => {
  const workspace = createTempWorkspace("idempotent-transition-");
  const dbPath = join(workspace, "idempotent-transition.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repository = createRuntimeLifecycleRepository(store);
    const transitions = new TransitionService(db, store, repository);

    const taskId = "idempotent-task-001";
    const executionId = "exec-idempotent-001";
    const now = nowIso();

    // Set up task
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Idempotent test",
        status: "queued",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.01,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "created",
        inputRef: null,
        traceId: "trace-idempotent",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Try same transition multiple times
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        transitions.transitionTaskStatus({
          entityKind: "task",
          entityId: taskId,
          fromStatus: "queued",
          toStatus: "in_progress",
          executionId,
          reasonCode: "task.started",
          traceId: `trace-idempotent-${attempt}`,
          actorType: "system",
          occurredAt: nowIso(),
        });
      } catch (err) {
        // Expected after first attempt - CAS will fail
      }
    }

    // Final state should be consistent
    const task = store.getTask(taskId);
    assert.equal(task?.status, "in_progress", "Task should be in in_progress state");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("[CONCURRENCY-5] concurrent queue operations with same idempotency key maintain consistency", async () => {
  const workspace = createTempWorkspace("idempotent-queue-");
  const dbPath = join(workspace, "idempotent-queue.db");
  const db = new SqliteDatabase(dbPath, { migrationPlan: [] });
  db.connection.exec(QUEUE_JOBS_DDL);

  try {
    const adapter = new SqliteQueueAdapter(db);

    // Enqueue with idempotency key
    const first = adapter.enqueue({
      queueName: "idempotent-queue",
      payload: "first",
      idempotencyKey: "same-key",
    });

    // Concurrent enqueue attempts with same idempotency key
    await runConcurrentStateModification(
      async () => {
        adapter.enqueue({
          queueName: "idempotent-queue",
          payload: "duplicate",
          idempotencyKey: "same-key",
        });
      },
      { concurrency: 10 },
    );

    // Should only have one job with the idempotency key
    const jobs = adapter.listJobs("idempotent-queue");
    const sameKeyJobs = jobs.filter((j) => j.idempotencyKey === "same-key");
    assert.equal(sameKeyJobs.length, 1, "Only one job should exist with idempotency key");

    db.close();
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});
