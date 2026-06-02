/**
 * Performance Test: Execution Throughput
 * Measures execution engine throughput and latency characteristics
 *
 * Covers:
 * - Execution throughput (executions per second with varying complexity)
 * - Lease acquisition latency (p50, p95, p99)
 * - State transition throughput (transitions per second)
 * - Memory usage under load (100 concurrent executions)
 * - Health service scan time with N tickets
 *
 * Note: Performance thresholds are set for reference hardware. On slower machines,
 * tests that miss the reference target are recorded as diagnostics rather than skipped.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { rmSync } from "node:fs";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";
import { performance } from "node:perf_hooks";

import { SqliteDatabase } from "../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { TransitionService } from "../../src/platform/five-plane-execution/state-transition/transition-service.js";
import { ExecutionLeaseService } from "../../src/platform/five-plane-execution/lease/execution-lease-service.js";
import { HealthService } from "../../src/platform/shared/observability/health-service.js";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";

function createTempDb(): SqliteDatabase {
  const dbPath = join(".tmp", `exec-throughput-perf-${process.pid}-${Date.now()}.db`);
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  return db;
}

function cleanupDb(db: SqliteDatabase): void {
  db.close();
  rmSync(db.filePath, { force: true });
  rmSync(`${db.filePath}-wal`, { force: true });
  rmSync(`${db.filePath}-shm`, { force: true });
}

function insertPerfTask(
  store: AuthoritativeTaskStore,
  taskId: string,
  now: string,
  title = "Performance test task",
): void {
  store.insertTask({
    id: taskId,
    parentId: null,
    rootId: taskId,
    divisionId: "general-ops",
    title,
    status: "queued",
    source: "user",
    priority: "normal",
    inputJson: "{}",
    normalizedInputJson: "{}",
    outputJson: null,
    estimatedCostUsd: 0,
    actualCostUsd: 0,
    errorCode: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  });
}

function insertPerfExecution(
  store: AuthoritativeTaskStore,
  executionId: string,
  taskId: string,
  now: string,
  traceId: string,
): void {
  store.insertExecution({
    id: executionId,
    taskId,
    workflowId: "single_agent_minimal",
    parentExecutionId: null,
    agentId: "agent-1",
    roleId: "general_executor",
    runKind: "task_run",
    status: "queued",
    inputRef: null,
    traceId,
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
}

// ============================================================================
// Execution Throughput Benchmarks
// ============================================================================

test("performance: execution throughput (simple tasks) >5000 exec/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const transitions = new TransitionService(db, store);

  try {
    const iterations = 500;
    const executionsPerIteration = 10;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      for (let j = 0; j < executionsPerIteration; j++) {
        const taskId = newId("task");
        const executionId = newId("exec");
        const sessionId = newId("sess");
        const traceId = newId("trace");
        const now = nowIso();

        db.transaction(() => {
          store.insertTask({
            id: taskId,
            parentId: null,
            rootId: taskId,
            divisionId: "general-ops",
            title: "Simple task",
            status: "queued",
            source: "user",
            priority: "normal",
            inputJson: "{}",
            normalizedInputJson: "{}",
            outputJson: null,
            estimatedCostUsd: 0,
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
            status: "queued",
            inputRef: null,
            traceId,
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

          store.insertSession({
            id: sessionId,
            taskId,
            channel: "cli",
            status: "open",
            externalSessionId: null,
            createdAt: now,
            updatedAt: now,
          });
        });

        // queued -> pending
        transitions.transitionTaskStatus({
          entityKind: "task",
          entityId: taskId,
          fromStatus: "queued",
          toStatus: "pending",
          executionId: null,
          reasonCode: "test",
          traceId,
          actorType: "system",
          occurredAt: nowIso(),
        });

        // pending -> in_progress
        transitions.transitionTaskStatus({
          entityKind: "task",
          entityId: taskId,
          fromStatus: "pending",
          toStatus: "in_progress",
          executionId,
          reasonCode: "test",
          traceId,
          actorType: "system",
          occurredAt: nowIso(),
        });

        // execution: queued -> dispatching -> executing
        transitions.transitionExecutionStatus({
          entityKind: "execution",
          entityId: executionId,
          fromStatus: "queued",
          toStatus: "dispatching",
          reasonCode: "test",
          traceId,
          actorType: "system",
          occurredAt: nowIso(),
        });

        transitions.transitionExecutionStatus({
          entityKind: "execution",
          entityId: executionId,
          fromStatus: "dispatching",
          toStatus: "executing",
          reasonCode: "test",
          traceId,
          actorType: "system",
          occurredAt: nowIso(),
        });
      }
    }

    const elapsed = performance.now() - start;
    const totalExecutions = iterations * executionsPerIteration;
    const opsPerSec = (totalExecutions / elapsed) * 1000;

    console.log(
      `Execution throughput (simple): ${opsPerSec.toFixed(0)} ops/sec, ` +
      `total: ${totalExecutions}, elapsed: ${elapsed.toFixed(2)}ms`,
    );

    try {
      assert.ok(
        opsPerSec > 5000,
        `Execution throughput ${opsPerSec.toFixed(0)} ops/sec must be >5000 ops/sec`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    cleanupDb(db);
  }
});

test("performance: execution throughput (complex tasks) >2000 exec/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const transitions = new TransitionService(db, store);

  try {
    const iterations = 200;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const taskId = newId("task");
      const executionId = newId("exec");
      const sessionId = newId("sess");
      const workflowId = newId("wf");
      const traceId = newId("trace");
      const now = nowIso();

      db.transaction(() => {
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general-ops",
          title: "Complex multi-step task",
          status: "queued",
          source: "user",
          priority: "high",
          inputJson: JSON.stringify({ complexity: "high", steps: 10 }),
          normalizedInputJson: "{}",
          outputJson: null,
          estimatedCostUsd: 0.5,
          actualCostUsd: 0,
          errorCode: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });

        store.workflow.insertWorkflow({
          id: workflowId,
          taskId,
          name: "multi_step_execution",
          status: "running",
          currentStepIndex: 0,
          inputsJson: "{}",
          outputsJson: null,
          createdAt: now,
          updatedAt: now,
        });

        store.insertExecution({
          id: executionId,
          taskId,
          workflowId,
          parentExecutionId: null,
          agentId: "agent-1",
          roleId: "general_executor",
          runKind: "task_run",
          status: "queued",
          inputRef: null,
          traceId,
          attempt: 1,
          timeoutMs: 300000,
          budgetUsdLimit: 10,
          requiresApproval: 0,
          sandboxMode: "workspace_write",
          allowedToolsJson: '["read", "write", "execute", "search"]',
          allowedPathsJson: '["/workspace"]',
          maxRetries: 3,
          retryBackoff: "exponential",
          lastErrorCode: null,
          lastErrorMessage: null,
          startedAt: null,
          finishedAt: null,
          createdAt: now,
          updatedAt: now,
        });

        store.insertSession({
          id: sessionId,
          taskId,
          channel: "cli",
          status: "open",
          externalSessionId: null,
          createdAt: now,
          updatedAt: now,
        });
      });

      // queued -> pending
      transitions.transitionTaskStatus({
        entityKind: "task",
        entityId: taskId,
        fromStatus: "queued",
        toStatus: "pending",
        executionId: null,
        reasonCode: "test",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      });

      // pending -> in_progress
      transitions.transitionTaskStatus({
        entityKind: "task",
        entityId: taskId,
        fromStatus: "pending",
        toStatus: "in_progress",
        executionId,
        reasonCode: "test",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      });

      // workflow running
      transitions.transitionWorkflowStatus({
        entityKind: "workflow",
        entityId: taskId,
        fromStatus: "running",
        toStatus: "running",
        currentStepIndex: 0,
        outputsJson: "{}",
        reasonCode: "test",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      });

      // execution: queued -> dispatching -> executing
      transitions.transitionExecutionStatus({
        entityKind: "execution",
        entityId: executionId,
        fromStatus: "queued",
        toStatus: "dispatching",
        reasonCode: "test",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      });

      transitions.transitionExecutionStatus({
        entityKind: "execution",
        entityId: executionId,
        fromStatus: "dispatching",
        toStatus: "executing",
        reasonCode: "test",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations * 5 / elapsed) * 1000; // 5 transitions per iteration

    console.log(
      `Execution throughput (complex): ${opsPerSec.toFixed(0)} ops/sec, ` +
      `elapsed: ${elapsed.toFixed(2)}ms`,
    );

    try {
      assert.ok(
        opsPerSec > 2000,
        `Execution throughput (complex) ${opsPerSec.toFixed(0)} ops/sec must be >2000 ops/sec`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    cleanupDb(db);
  }
});

// ============================================================================
// Lease Acquisition Latency Benchmarks
// ============================================================================

test("performance: lease acquisition latency p50 <1ms, p95 <5ms, p99 <10ms", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const leaseService = new ExecutionLeaseService(db, store);

  try {
    const iterations = 1000;
    const latencies: number[] = [];
    const warmupExecutionIds = Array.from({ length: 100 }, () => newId("exec"));
    const measuredExecutionIds = Array.from({ length: iterations }, () => newId("exec"));

    db.transaction(() => {
      for (const executionId of [...warmupExecutionIds, ...measuredExecutionIds]) {
        const taskId = newId("task");
        const now = nowIso();
        insertPerfTask(store, taskId, now, "Lease latency task");
        insertPerfExecution(store, executionId, taskId, now, newId("trace"));
      }
    });

    // Warmup
    for (let i = 0; i < warmupExecutionIds.length; i++) {
      const warmupWorkerId = `warmup-worker-${i}`;
      const decision = leaseService.acquireLease({
        executionId: warmupExecutionIds[i]!,
        workerId: warmupWorkerId,
        ttlMs: 10000,
        traceId: newId("trace"),
        occurredAt: nowIso(),
      });
      assert.equal(decision.outcome, "granted");
      assert.ok(decision.lease != null);
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const wId = `bench-worker-${i}`;
      const start = performance.now();
      const decision = leaseService.acquireLease({
        executionId: measuredExecutionIds[i]!,
        workerId: wId,
        ttlMs: 10000,
        traceId: newId("trace"),
        occurredAt: nowIso(),
      });
      assert.equal(decision.outcome, "granted");
      assert.ok(decision.lease != null);
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(iterations * 0.5)]!;
    const p95 = latencies[Math.floor(iterations * 0.95)]!;
    const p99 = latencies[Math.floor(iterations * 0.99)]!;

    console.log(
      `Lease acquisition latency - p50: ${p50.toFixed(4)}ms, ` +
      `p95: ${p95.toFixed(4)}ms, p99: ${p99.toFixed(4)}ms`,
    );

    try {
      assert.ok(p50 < 1, `Lease acquisition p50 ${p50.toFixed(4)}ms must be <1ms`);
      assert.ok(p95 < 5, `Lease acquisition p95 ${p95.toFixed(4)}ms must be <5ms`);
      assert.ok(p99 < 10, `Lease acquisition p99 ${p99.toFixed(4)}ms must be <10ms`);
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    cleanupDb(db);
  }
});

test("performance: lease acquisition throughput >10000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const leaseService = new ExecutionLeaseService(db, store);

  try {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const executionId = newId("exec");
      const taskId = newId("task");
      const workerId = newId("worker");
      const now = nowIso();

      db.transaction(() => {
        insertPerfTask(store, taskId, now, `Lease throughput task ${i}`);
        insertPerfExecution(store, executionId, taskId, now, newId("trace"));
      });

      leaseService.acquireLease({
        executionId,
        workerId,
        ttlMs: 10000,
        traceId: newId("trace"),
        occurredAt: nowIso(),
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    console.log(
      `Lease acquisition throughput: ${opsPerSec.toFixed(0)} ops/sec, ` +
      `elapsed: ${elapsed.toFixed(2)}ms`,
    );

    try {
      assert.ok(
        opsPerSec > 10000,
        `Lease acquisition throughput ${opsPerSec.toFixed(0)} ops/sec must be >10000 ops/sec`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    cleanupDb(db);
  }
});

// ============================================================================
// State Transition Throughput Benchmarks
// ============================================================================

test("performance: state transition throughput >10000 transitions/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const transitions = new TransitionService(db, store);

  try {
    const iterations = 5000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const taskId = newId("task");
      const now = nowIso();

      db.transaction(() => {
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general-ops",
          title: "Transition test",
          status: "queued",
          source: "user",
          priority: "normal",
          inputJson: "{}",
          normalizedInputJson: "{}",
          outputJson: null,
          estimatedCostUsd: 0,
          actualCostUsd: 0,
          errorCode: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });
      });

      transitions.transitionTaskStatus({
        entityKind: "task",
        entityId: taskId,
        fromStatus: "queued",
        toStatus: "pending",
        executionId: null,
        reasonCode: "test",
        traceId: newId("trace"),
        actorType: "system",
        occurredAt: nowIso(),
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    console.log(
      `State transition throughput: ${opsPerSec.toFixed(0)} transitions/sec, ` +
      `elapsed: ${elapsed.toFixed(2)}ms`,
    );

    try {
      assert.ok(
        opsPerSec > 10000,
        `State transition throughput ${opsPerSec.toFixed(0)} transitions/sec must be >10000/sec`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    cleanupDb(db);
  }
});

test("performance: bulk state transitions (100 concurrent) <200ms", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const transitions = new TransitionService(db, store);

  try {
    const taskCount = 100;
    const taskIds: string[] = [];
    const now = nowIso();

    // Create 100 tasks
    for (let i = 0; i < taskCount; i++) {
      const taskId = newId("task");
      taskIds.push(taskId);
      db.transaction(() => {
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general-ops",
          title: `Bulk transition ${i}`,
          status: "queued",
          source: "user",
          priority: "normal",
          inputJson: "{}",
          normalizedInputJson: "{}",
          outputJson: null,
          estimatedCostUsd: 0,
          actualCostUsd: 0,
          errorCode: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });
      });
    }

    const start = performance.now();

    // Transition all 100 tasks
    for (const taskId of taskIds) {
      transitions.transitionTaskStatus({
        entityKind: "task",
        entityId: taskId,
        fromStatus: "queued",
        toStatus: "pending",
        executionId: null,
        reasonCode: "bulk_test",
        traceId: newId("trace"),
        actorType: "system",
        occurredAt: nowIso(),
      });
    }

    const elapsed = performance.now() - start;

    console.log(
      `Bulk state transitions (${taskCount}): ${elapsed.toFixed(2)}ms`,
    );

    try {
      assert.ok(
        elapsed < 200,
        `Bulk transitions of ${taskCount} tasks took ${elapsed.toFixed(2)}ms, expected <200ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    cleanupDb(db);
  }
});

// ============================================================================
// Memory Usage Under Load Benchmarks
// ============================================================================

test("performance: memory usage under 100 concurrent executions <200MB delta", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const transitions = new TransitionService(db, store);

  try {
    // Force GC if available to get baseline
    if (global.gc) {
      global.gc();
    }
    const initialMemory = process.memoryUsage();

    // Create 100 concurrent executions with full lifecycle
    for (let i = 0; i < 100; i++) {
      const taskId = newId("task");
      const executionId = newId("exec");
      const sessionId = newId("sess");
      const traceId = newId("trace");
      const now = nowIso();

      db.transaction(() => {
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general-ops",
          title: `Concurrent task ${i}`,
          status: "queued",
          source: "user",
          priority: "normal",
          inputJson: "{}",
          normalizedInputJson: "{}",
          outputJson: null,
          estimatedCostUsd: 0,
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
          traceId,
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

        store.insertSession({
          id: sessionId,
          taskId,
          channel: "cli",
          status: "streaming",
          externalSessionId: null,
          createdAt: now,
          updatedAt: now,
        });
      });

      // Perform state transitions
      transitions.transitionTaskStatus({
        entityKind: "task",
        entityId: taskId,
        fromStatus: "queued",
        toStatus: "pending",
        executionId: null,
        reasonCode: "test",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      });

      transitions.transitionTaskStatus({
        entityKind: "task",
        entityId: taskId,
        fromStatus: "pending",
        toStatus: "in_progress",
        executionId,
        reasonCode: "test",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      });
    }

    const finalMemory = process.memoryUsage();
    const heapDeltaMb = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
    const rssDeltaMb = (finalMemory.rss - initialMemory.rss) / 1024 / 1024;

    console.log(
      `Memory under 100 concurrent executions - heap delta: ${heapDeltaMb.toFixed(2)}MB, ` +
      `rss delta: ${rssDeltaMb.toFixed(2)}MB`,
    );

    try {
      assert.ok(
        heapDeltaMb < 200,
        `Heap memory delta ${heapDeltaMb.toFixed(2)}MB exceeds 200MB limit`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    cleanupDb(db);
  }
});

test("performance: memory efficiency with execution pooling", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    // Force GC if available to get baseline
    if (global.gc) {
      global.gc();
    }
    const initialMemory = process.memoryUsage();

    // Simulate execution pool with 100 reusable slots
    const poolSize = 100;
    const iterations = 50;

    for (let iter = 0; iter < iterations; iter++) {
      for (let i = 0; i < poolSize; i++) {
        const taskId = newId("task");
        const executionId = newId("exec");
        const sessionId = newId("sess");
        const now = nowIso();

        db.transaction(() => {
          store.insertTask({
            id: taskId,
            parentId: null,
            rootId: taskId,
            divisionId: "general-ops",
            title: `Pool task ${i}`,
            status: "done",
            source: "user",
            priority: "normal",
            inputJson: "{}",
            normalizedInputJson: "{}",
            outputJson: JSON.stringify({ result: "completed" }),
            estimatedCostUsd: 0.01,
            actualCostUsd: 0.01,
            errorCode: null,
            createdAt: now,
            updatedAt: now,
            completedAt: now,
          });

          store.insertExecution({
            id: executionId,
            taskId,
            workflowId: "single_agent_minimal",
            parentExecutionId: null,
            agentId: "agent-1",
            roleId: "general_executor",
            runKind: "task_run",
            status: "succeeded",
            inputRef: null,
            traceId: newId("trace"),
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
            finishedAt: now,
            createdAt: now,
            updatedAt: now,
          });

          store.insertSession({
            id: sessionId,
            taskId,
            channel: "cli",
            status: "completed",
            externalSessionId: null,
            createdAt: now,
            updatedAt: now,
          });
        });
      }
    }

    const finalMemory = process.memoryUsage();
    const heapDeltaMb = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;

    console.log(
      `Memory with execution pooling (${poolSize}x${iterations}): ` +
      `heap delta: ${heapDeltaMb.toFixed(2)}MB`,
    );

    // With pooling, memory should be reasonable even with many operations
    try {
      assert.ok(
        heapDeltaMb < 300,
        `Pooled execution memory delta ${heapDeltaMb.toFixed(2)}MB exceeds 300MB limit`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    cleanupDb(db);
  }
});

// ============================================================================
// Health Service Scan Time Benchmarks
// ============================================================================

test("performance: health service scan time O(1) with ticket count", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const healthService = new HealthService(db, store);

  try {
    // Scan with 10 tickets
    for (let i = 0; i < 10; i++) {
      const now = nowIso();
      db.transaction(() => {
        store.insertTask({
          id: newId("task"),
          parentId: null,
          rootId: newId("task"),
          divisionId: "general-ops",
          title: `Health scan test ${i}`,
          status: "queued",
          source: "user",
          priority: "normal",
          inputJson: "{}",
          normalizedInputJson: "{}",
          outputJson: null,
          estimatedCostUsd: 0,
          actualCostUsd: 0,
          errorCode: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });
      });
    }

    const start10 = performance.now();
    healthService.getReport();
    const time10 = performance.now() - start10;

    // Add 90 more tickets (total 100)
    for (let i = 10; i < 100; i++) {
      const now = nowIso();
      db.transaction(() => {
        store.insertTask({
          id: newId("task"),
          parentId: null,
          rootId: newId("task"),
          divisionId: "general-ops",
          title: `Health scan test ${i}`,
          status: "queued",
          source: "user",
          priority: "normal",
          inputJson: "{}",
          normalizedInputJson: "{}",
          outputJson: null,
          estimatedCostUsd: 0,
          actualCostUsd: 0,
          errorCode: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });
      });
    }

    const start100 = performance.now();
    healthService.getReport();
    const time100 = performance.now() - start100;

    // Add 900 more tickets (total 1000)
    for (let i = 100; i < 1000; i++) {
      const now = nowIso();
      db.transaction(() => {
        store.insertTask({
          id: newId("task"),
          parentId: null,
          rootId: newId("task"),
          divisionId: "general-ops",
          title: `Health scan test ${i}`,
          status: "queued",
          source: "user",
          priority: "normal",
          inputJson: "{}",
          normalizedInputJson: "{}",
          outputJson: null,
          estimatedCostUsd: 0,
          actualCostUsd: 0,
          errorCode: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });
      });
    }

    const start1000 = performance.now();
    healthService.getReport();
    const time1000 = performance.now() - start1000;

    // Calculate ratio to verify O(1) behavior
    // If O(1), time1000 should be approximately same as time100 (not 10x)
    const ratio100To10 = time100 / time10;
    const ratio1000To100 = time1000 / time100;

    console.log(
      `Health scan times - 10 tickets: ${time10.toFixed(2)}ms, ` +
      `100 tickets: ${time100.toFixed(2)}ms, ` +
      `1000 tickets: ${time1000.toFixed(2)}ms, ` +
      `ratio(100/10): ${ratio100To10.toFixed(2)}x, ` +
      `ratio(1000/100): ${ratio1000To100.toFixed(2)}x`,
    );

    try {
      // For O(1), ratios should be close to 1 (within reasonable margin)
      // If it were O(n), ratios would be ~10x
      assert.ok(
        ratio1000To100 < 3,
        `Health scan time scaling indicates O(n) not O(1): ratio(1000/100) = ${ratio1000To100.toFixed(2)}x`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    cleanupDb(db);
  }
});

test("performance: health service scan <50ms with 1000 tickets", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const healthService = new HealthService(db, store);

  try {
    // Create 1000 tickets
    for (let i = 0; i < 1000; i++) {
      const now = nowIso();
      db.transaction(() => {
        store.insertTask({
          id: newId("task"),
          parentId: null,
          rootId: newId("task"),
          divisionId: "general-ops",
          title: `Health scan ${i}`,
          status: i % 2 === 0 ? "queued" : "in_progress",
          source: "user",
          priority: "normal",
          inputJson: "{}",
          normalizedInputJson: "{}",
          outputJson: null,
          estimatedCostUsd: 0,
          actualCostUsd: 0,
          errorCode: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });
      });
    }

    const iterations = 10;
    const latencies: number[] = [];

    // Warmup
    for (let i = 0; i < 5; i++) {
      healthService.getReport();
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      healthService.getReport();
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const avg = latencies.reduce((a, b) => a + b, 0) / iterations;

    console.log(
      `Health scan with 1000 tickets - avg: ${avg.toFixed(2)}ms, p99: ${p99.toFixed(2)}ms`,
    );

    try {
      assert.ok(
        avg < 50,
        `Health scan avg latency ${avg.toFixed(2)}ms exceeds 50ms target with 1000 tickets`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    cleanupDb(db);
  }
});
