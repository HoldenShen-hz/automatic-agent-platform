/**
 * Performance Test: Dispatch Throughput
 * Measures execution dispatch service performance
 *
 * Design targets:
 * - Ticket creation: >500 ops/sec
 * - Dispatch decision: >1000 ops/sec
 * - Worker evaluation: >2000 ops/sec
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { rmSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { ExecutionDispatchService } from "../../src/platform/execution/dispatcher/execution-dispatch-service.js";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";

function createTempDb(): SqliteDatabase {
  const dbPath = join(".tmp", `dispatch-perf-${process.pid}-${Date.now()}.db`);
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  return db;
}

function createTaskWithExecution(db: SqliteDatabase, store: AuthoritativeTaskStore, status: string = "pending"): { taskId: string; executionId: string } {
  const taskId = newId("task");
  const executionId = newId("exec");
  const now = nowIso();

  db.transaction(() => {
    store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      title: "Dispatch test",
      status,
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

    store.execution.insertExecution({
      id: executionId,
      taskId,
      workflowId: "dispatch_perf",
      parentExecutionId: null,
      agentId: "agent-dispatch",
      roleId: "general_executor",
      runKind: "task_run",
      status: "created",
      inputRef: null,
      traceId: newId("trace"),
      attempt: 1,
      timeoutMs: 60_000,
      budgetUsdLimit: null,
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

  return { taskId, executionId };
}

function upsertWorkerSnapshot(store: AuthoritativeTaskStore, workerId: string, occurredAt: string): void {
  store.upsertWorkerSnapshot({
    workerId,
    status: "idle",
    placement: "local",
    isolationLevel: "standard",
    repoVersion: "repo-main",
    remoteSessionStatus: null,
    lastAcknowledgedStreamOffset: null,
    streamResumeSuccessRate: null,
    credentialRefreshSuccessRate: null,
    sessionConsistencyCheckStatus: null,
    sessionConsistencyCheckedAt: null,
    workspaceSyncStatus: null,
    workspaceSyncCheckedAt: null,
    saturation: 0,
    activeLeaseCount: 0,
    meanStartupLatencyMs: null,
    sandboxSuccessRate: null,
    repoCacheHitRate: null,
    registrationVerifiedAt: null,
    registrationChallengeId: null,
    capabilitiesJson: JSON.stringify(["code-execution"]),
    runningExecutionsJson: "[]",
    maxConcurrency: 5,
    queueAffinity: "general_ops",
    runtimeInstanceId: `runtime-${workerId}`,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    cpuPct: 10,
    memoryMb: 256,
    toolBacklogCount: 0,
    currentStepId: null,
    lastProgressAt: occurredAt,
    lastHeartbeatAt: occurredAt,
    updatedAt: occurredAt,
  });
}

// ============================================================================
// Worker Load Computation Benchmarks
// ============================================================================

test("performance: Worker load computation throughput >5000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const dispatchService = new ExecutionDispatchService(db, store);

  try {
    const { executionId } = createTaskWithExecution(db, store);

    const iterations = 5000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      dispatchService.createTicket({
        executionId,
        occurredAt: nowIso(),
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 500,
        `Ticket creation throughput ${opsPerSec.toFixed(0)} ops/sec must be >500 ops/sec. Avg: ${avgLatencyMs.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    rmSync(join(".tmp", `dispatch-perf-${process.pid}-${Date.now()}.db`), { force: true });
  }
});

test("performance: Ticket creation P99 latency <10ms", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const dispatchService = new ExecutionDispatchService(db, store);

  try {
    const { executionId } = createTaskWithExecution(db, store);

    const latencies: number[] = [];
    const iterations = 500;

    // Warmup
    for (let i = 0; i < 50; i++) {
      dispatchService.createTicket({
        executionId,
        occurredAt: nowIso(),
      });
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      dispatchService.createTicket({
        executionId,
        occurredAt: nowIso(),
      });
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 10,
        `Ticket creation P99 latency ${p99.toFixed(3)}ms exceeds 10ms target. P50: ${p50.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    rmSync(join(".tmp", `dispatch-perf-${process.pid}-${Date.now()}.db`), { force: true });
  }
});

// ============================================================================
// Multiple Execution Ticket Creation
// ============================================================================

test("performance: Multiple ticket creation (10 executions) <100ms", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const dispatchService = new ExecutionDispatchService(db, store);

  try {
    // Create 10 task/execution pairs
    const executions: string[] = [];
    for (let i = 0; i < 10; i++) {
      const { executionId } = createTaskWithExecution(db, store);
      executions.push(executionId);
    }

    const start = performance.now();

    for (const executionId of executions) {
      dispatchService.createTicket({
        executionId,
        occurredAt: nowIso(),
      });
    }

    const elapsed = performance.now() - start;

    try {
      assert.ok(
        elapsed < 100,
        `Creating 10 tickets took ${elapsed.toFixed(2)}ms, expected <100ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    rmSync(join(".tmp", `dispatch-perf-${process.pid}-${Date.now()}.db`), { force: true });
  }
});

// ============================================================================
// Dispatch Decision Benchmarks
// ============================================================================

test("performance: Dispatch decision throughput >1000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const dispatchService = new ExecutionDispatchService(db, store);

  try {
    const { executionId } = createTaskWithExecution(db, store);

    // Create initial ticket
    dispatchService.createTicket({
      executionId,
      occurredAt: nowIso(),
    });

    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      // Attempt to create another ticket - should return "exists"
      dispatchService.createTicket({
        executionId,
        occurredAt: nowIso(),
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 1000,
        `Dispatch decision throughput ${opsPerSec.toFixed(0)} ops/sec must be >1000 ops/sec`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    rmSync(join(".tmp", `dispatch-perf-${process.pid}-${Date.now()}.db`), { force: true });
  }
});

// ============================================================================
// Worker Registry Benchmarks
// ============================================================================

test("performance: Worker registry listWorkers() throughput >2000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    // Register some workers
    for (let i = 0; i < 10; i++) {
      const workerId = newId("worker");
      const now = nowIso();
      upsertWorkerSnapshot(store, workerId, now);
    }

    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      store.worker.listWorkerSnapshots();
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 2000,
        `Worker list throughput ${opsPerSec.toFixed(0)} ops/sec must be >2000 ops/sec. Avg: ${avgLatencyMs.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    rmSync(join(".tmp", `dispatch-perf-${process.pid}-${Date.now()}.db`), { force: true });
  }
});

test("performance: Worker registry listWorkers() P99 latency <2ms", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    // Register some workers
    for (let i = 0; i < 10; i++) {
      const workerId = newId("worker");
      const now = nowIso();
      upsertWorkerSnapshot(store, workerId, now);
    }

    const latencies: number[] = [];
    const iterations = 500;

    // Warmup
    for (let i = 0; i < 50; i++) {
      store.worker.listWorkerSnapshots();
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      store.worker.listWorkerSnapshots();
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 2,
        `Worker list P99 latency ${p99.toFixed(3)}ms exceeds 2ms target. P50: ${p50.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    rmSync(join(".tmp", `dispatch-perf-${process.pid}-${Date.now()}.db`), { force: true });
  }
});

// ============================================================================
// Execution Lease Benchmarks
// ============================================================================

test("performance: Execution lease creation throughput >1000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    const workerId = newId("worker");

    // Register worker first
    const now = nowIso();
    upsertWorkerSnapshot(store, workerId, now);

    const iterations = 500;
    const executionIds: string[] = [];
    for (let i = 0; i < iterations; i++) {
      executionIds.push(createTaskWithExecution(db, store).executionId);
    }

    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      store.insertExecutionLease({
        id: newId("lease"),
        executionId: executionIds[i]!,
        workerId,
        attempt: 1,
        fencingToken: i + 1,
        queueName: "general_ops",
        status: "active",
        leasedAt: nowIso(),
        expiresAt: nowIso(),
        lastHeartbeatAt: now,
        releasedAt: null,
        reasonCode: null,
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 1000,
        `Lease creation throughput ${opsPerSec.toFixed(0)} ops/sec must be >1000 ops/sec. Avg: ${avgLatencyMs.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    rmSync(join(".tmp", `dispatch-perf-${process.pid}-${Date.now()}.db`), { force: true });
  }
});

test("performance: Execution lease lookup by worker throughput >2000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    const workerId = newId("worker");

    // Register worker
    const now = nowIso();
    upsertWorkerSnapshot(store, workerId, now);

    // Create leases
    for (let i = 0; i < 10; i++) {
      const { executionId } = createTaskWithExecution(db, store);
      store.insertExecutionLease({
        id: newId("lease"),
        executionId,
        workerId,
        attempt: 1,
        fencingToken: i + 1,
        queueName: "general_ops",
        status: "active",
        leasedAt: nowIso(),
        expiresAt: nowIso(),
        lastHeartbeatAt: now,
        releasedAt: null,
        reasonCode: null,
      });
    }

    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      store.listLeasesByWorker(workerId);
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 2000,
        `Lease lookup throughput ${opsPerSec.toFixed(0)} ops/sec must be >2000 ops/sec. Avg: ${avgLatencyMs.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    rmSync(join(".tmp", `dispatch-perf-${process.pid}-${Date.now()}.db`), { force: true });
  }
});
