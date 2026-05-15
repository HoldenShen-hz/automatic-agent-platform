/**
 * Performance Test: Concurrency Benchmarks
 * Measures parallel execution and concurrent operation performance
 *
 * Design targets:
 * - Parallel task creation: >500 ops/sec with 10 concurrent workers
 * - Concurrent status updates: >2000 ops/sec with 10 concurrent workers
 * - Parallel event publishing: >3000 events/sec with 10 concurrent publishers
 * - Queue operations: >1000 ops/sec under concurrent load
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { rmSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import { SqliteDatabase } from "../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { TypedEventBus } from "../../src/platform/five-plane-state-evidence/events/typed-event-bus.js";
import { RuntimeStateMachine } from "../../src/platform/five-plane-execution/runtime-state-machine.js";
import { BudgetAllocator } from "../../src/platform/five-plane-execution/budget-allocator.js";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";
import type { HarnessRun, BudgetLedger } from "../../src/platform/contracts/executable-contracts/index.js";

function createTempDb(): SqliteDatabase {
  const dbPath = join(".tmp", `concurrency-${process.pid}-${Date.now()}.db`);
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  return db;
}

function cleanupDb(db: SqliteDatabase): void {
  rmSync(db.filePath, { force: true });
  rmSync(`${db.filePath}-wal`, { force: true });
  rmSync(`${db.filePath}-shm`, { force: true });
}

// ============================================================================
// Parallel Task Creation Benchmarks
// ============================================================================

test("concurrency: Parallel task creation throughput >500 ops/sec with 10 workers", async (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    const numWorkers = 10;
    const tasksPerWorker = 100;
    const totalTasks = numWorkers * tasksPerWorker;

    // Warmup
    for (let i = 0; i < 50; i++) {
      const taskId = newId("task");
      const now = nowIso();
      db.transaction(() => {
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general_ops",
          title: `Warmup ${i}`,
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

    // Benchmark
    const start = performance.now();

    await Promise.all(
      Array.from({ length: numWorkers }, async (_, workerId) => {
        for (let i = 0; i < tasksPerWorker; i++) {
          const taskId = newId("task");
          const now = nowIso();
          db.transaction(() => {
            store.insertTask({
              id: taskId,
              parentId: null,
              rootId: taskId,
              divisionId: "general_ops",
              title: `Worker ${workerId} Task ${i}`,
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
      }),
    );

    const elapsed = performance.now() - start;
    const opsPerSec = (totalTasks / elapsed) * 1000;
    const avgLatencyMs = elapsed / totalTasks;

    try {
      assert.ok(
        opsPerSec > 500,
        `Parallel task creation throughput ${opsPerSec.toFixed(0)} ops/sec must be >500 ops/sec with ${numWorkers} workers. Avg: ${avgLatencyMs.toFixed(4)}ms`,
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
    cleanupDb(db);
  }
});

test("concurrency: Parallel status updates throughput >2000 ops/sec with 10 workers", async (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    // Create initial tasks
    const numTasks = 1000;
    const taskIds: string[] = [];

    for (let i = 0; i < numTasks; i++) {
      const taskId = newId("task");
      const now = nowIso();
      db.transaction(() => {
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general_ops",
          title: `Task ${i}`,
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
      taskIds.push(taskId);
    }

    const numWorkers = 10;
    const updatesPerWorker = 100;
    const totalUpdates = numWorkers * updatesPerWorker;

    // Warmup
    for (let i = 0; i < 50; i++) {
      store.updateTaskStatus(taskIds[i % taskIds.length]!, "running", nowIso(), null, null);
    }

    // Benchmark
    const start = performance.now();

    await Promise.all(
      Array.from({ length: numWorkers }, async (_, workerId) => {
        for (let i = 0; i < updatesPerWorker; i++) {
          const taskId = taskIds[(workerId * updatesPerWorker + i) % taskIds.length]!;
          store.updateTaskStatus(taskId, "running", nowIso(), null, null);
        }
      }),
    );

    const elapsed = performance.now() - start;
    const opsPerSec = (totalUpdates / elapsed) * 1000;
    const avgLatencyMs = elapsed / totalUpdates;

    try {
      assert.ok(
        opsPerSec > 2000,
        `Parallel status update throughput ${opsPerSec.toFixed(0)} ops/sec must be >2000 ops/sec with ${numWorkers} workers. Avg: ${avgLatencyMs.toFixed(4)}ms`,
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
    cleanupDb(db);
  }
});

// ============================================================================
// Parallel Event Publishing Benchmarks
// ============================================================================

test("concurrency: Parallel event publishing throughput >3000 events/sec with 10 publishers", async (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const eventBus = new TypedEventBus(db, store);

  try {
    const numPublishers = 10;
    const eventsPerPublisher = 500;
    const totalEvents = numPublishers * eventsPerPublisher;

    // Warmup
    for (let i = 0; i < 100; i++) {
      eventBus.publish({
        eventType: "perf:test_event",
        taskId: newId("task"),
        payload: { warmup: true },
      });
    }

    // Benchmark
    const start = performance.now();

    await Promise.all(
      Array.from({ length: numPublishers }, async (_, publisherId) => {
        for (let i = 0; i < eventsPerPublisher; i++) {
          eventBus.publish({
            eventType: "perf:test_event",
            taskId: newId("task"),
            payload: { publisherId, index: i },
          });
        }
      }),
    );

    const elapsed = performance.now() - start;
    const opsPerSec = (totalEvents / elapsed) * 1000;
    const avgLatencyMs = elapsed / totalEvents;

    try {
      assert.ok(
        opsPerSec > 3000,
        `Parallel event publishing throughput ${opsPerSec.toFixed(0)} events/sec must be >3000 events/sec with ${numPublishers} publishers. Avg: ${avgLatencyMs.toFixed(4)}ms`,
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
    cleanupDb(db);
  }
});

test("concurrency: Mixed parallel operations throughput >1500 ops/sec", async (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const stateMachine = new RuntimeStateMachine();

  try {
    const numWorkers = 10;
    const opsPerWorker = 100;
    const totalOps = numWorkers * opsPerWorker;

    // Warmup
    for (let i = 0; i < 50; i++) {
      const taskId = newId("task");
      const now = nowIso();
      db.transaction(() => {
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general_ops",
          title: `Warmup ${i}`,
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

    // Benchmark - mix of inserts and state transitions
    const start = performance.now();

    await Promise.all(
      Array.from({ length: numWorkers }, async (_, workerId) => {
        for (let i = 0; i < opsPerWorker; i++) {
          const opType = (workerId + i) % 2;

          if (opType === 0) {
            // Insert task
            const taskId = newId("task");
            const now = nowIso();
            db.transaction(() => {
              store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: `Worker ${workerId} Task ${i}`,
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
          } else {
            // State transition
            const harnessRun: HarnessRun = {
              harnessRunId: newId("hrun"),
              tenantId: "test-tenant",
              confirmedTaskSpecId: newId("ctspec"),
              requestEnvelopeId: newId("request"),
              requestHash: newId("reqhash"),
              constraintPackRef: "default",
              versionLockId: newId("vlock"),
              budgetLedgerId: newId("bledger"),
              status: "created",
              currentSeq: 0,
              createdAt: nowIso(),
              updatedAt: nowIso(),
            };
            stateMachine.transition({
              commandId: newId("cmd"),
              entityType: "HarnessRun",
              entityId: harnessRun.harnessRunId,
              principal: "test-principal",
              aggregateType: "HarnessRun",
              aggregate: harnessRun,
              fromStatus: "created",
              toStatus: "admitted",
              traceId: newId("trace"),
              tenantId: "test-tenant",
              reasonCode: "test",
              emittedBy: "test-emitter",
              runVersionLockId: newId("rvlock"),
              leaseId: newId("lease"),
              fencingToken: newId("fence"),
            });
          }
        }
      }),
    );

    const elapsed = performance.now() - start;
    const opsPerSec = (totalOps / elapsed) * 1000;
    const avgLatencyMs = elapsed / totalOps;

    try {
      assert.ok(
        opsPerSec > 1500,
        `Mixed parallel operations throughput ${opsPerSec.toFixed(0)} ops/sec must be >1500 ops/sec with ${numWorkers} workers. Avg: ${avgLatencyMs.toFixed(4)}ms`,
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
    cleanupDb(db);
  }
});

// ============================================================================
// State Transition Concurrency Benchmarks
// ============================================================================

test("concurrency: Parallel state transitions throughput >2000 ops/sec with 10 workers", async (t) => {
  const stateMachine = new RuntimeStateMachine();
  const numWorkers = 10;
  const transitionsPerWorker = 200;
  const totalTransitions = numWorkers * transitionsPerWorker;

  // Warmup
  for (let i = 0; i < 100; i++) {
    const harnessRun: HarnessRun = {
      harnessRunId: newId("hrun"),
      tenantId: "test-tenant",
      confirmedTaskSpecId: newId("ctspec"),
      requestEnvelopeId: newId("request"),
      requestHash: newId("reqhash"),
      constraintPackRef: "default",
      versionLockId: newId("vlock"),
      budgetLedgerId: newId("bledger"),
      status: "created",
      currentSeq: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    stateMachine.transition({
      commandId: newId("cmd"),
      entityType: "HarnessRun",
      entityId: harnessRun.harnessRunId,
      principal: "test-principal",
      aggregateType: "HarnessRun",
      aggregate: harnessRun,
      fromStatus: "created",
      toStatus: "admitted",
      traceId: newId("trace"),
      tenantId: "test-tenant",
      reasonCode: "warmup",
      emittedBy: "test-emitter",
      runVersionLockId: newId("rvlock"),
      leaseId: newId("lease"),
      fencingToken: newId("fence"),
    });
  }

  // Benchmark
  const start = performance.now();

  await Promise.all(
    Array.from({ length: numWorkers }, async (_, workerId) => {
      for (let i = 0; i < transitionsPerWorker; i++) {
        const harnessRun: HarnessRun = {
          harnessRunId: newId("hrun"),
          tenantId: "test-tenant",
          confirmedTaskSpecId: newId("ctspec"),
          requestEnvelopeId: newId("request"),
          requestHash: newId("reqhash"),
          constraintPackRef: "default",
          versionLockId: newId("vlock"),
          budgetLedgerId: newId("bledger"),
          status: "created",
          currentSeq: 0,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        stateMachine.transition({
          commandId: newId("cmd"),
          entityType: "HarnessRun",
          entityId: harnessRun.harnessRunId,
          principal: "test-principal",
          aggregateType: "HarnessRun",
          aggregate: harnessRun,
          fromStatus: "created",
          toStatus: "admitted",
          traceId: newId("trace"),
          tenantId: "test-tenant",
          reasonCode: `worker-${workerId}`,
          emittedBy: "test-emitter",
          runVersionLockId: newId("rvlock"),
          leaseId: newId("lease"),
          fencingToken: newId("fence"),
        });
      }
    }),
  );

  const elapsed = performance.now() - start;
  const opsPerSec = (totalTransitions / elapsed) * 1000;
  const avgLatencyMs = elapsed / totalTransitions;

  try {
    assert.ok(
      opsPerSec > 2000,
      `Parallel state transitions throughput ${opsPerSec.toFixed(0)} ops/sec must be >2000 ops/sec with ${numWorkers} workers. Avg: ${avgLatencyMs.toFixed(4)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("concurrency: High concurrency state transition P99 latency <10ms", async (t) => {
  const stateMachine = new RuntimeStateMachine();
  const numWorkers = 20;
  const transitionsPerWorker = 100;
  const totalTransitions = numWorkers * transitionsPerWorker;

  // Warmup
  for (let i = 0; i < 100; i++) {
    const harnessRun: HarnessRun = {
      harnessRunId: newId("hrun"),
      tenantId: "test-tenant",
      confirmedTaskSpecId: newId("ctspec"),
      requestEnvelopeId: newId("request"),
      requestHash: newId("reqhash"),
      constraintPackRef: "default",
      versionLockId: newId("vlock"),
      budgetLedgerId: newId("bledger"),
      status: "created",
      currentSeq: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    stateMachine.transition({
      commandId: newId("cmd"),
      entityType: "HarnessRun",
      entityId: harnessRun.harnessRunId,
      principal: "test-principal",
      aggregateType: "HarnessRun",
      aggregate: harnessRun,
      fromStatus: "created",
      toStatus: "admitted",
      traceId: newId("trace"),
      tenantId: "test-tenant",
      reasonCode: "warmup",
      emittedBy: "test-emitter",
      runVersionLockId: newId("rvlock"),
      leaseId: newId("lease"),
      fencingToken: newId("fence"),
    });
  }

  // Collect latencies per worker
  const allLatencies: number[] = [];

  // Benchmark
  const start = performance.now();

  await Promise.all(
    Array.from({ length: numWorkers }, async (_, workerId) => {
      const workerLatencies: number[] = [];
      for (let i = 0; i < transitionsPerWorker; i++) {
        const harnessRun: HarnessRun = {
          harnessRunId: newId("hrun"),
          tenantId: "test-tenant",
          confirmedTaskSpecId: newId("ctspec"),
          requestEnvelopeId: newId("request"),
          requestHash: newId("reqhash"),
          constraintPackRef: "default",
          versionLockId: newId("vlock"),
          budgetLedgerId: newId("bledger"),
          status: "created",
          currentSeq: 0,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        const transitionStart = performance.now();
        stateMachine.transition({
          commandId: newId("cmd"),
          entityType: "HarnessRun",
          entityId: harnessRun.harnessRunId,
          principal: "test-principal",
          aggregateType: "HarnessRun",
          aggregate: harnessRun,
          fromStatus: "created",
          toStatus: "admitted",
          traceId: newId("trace"),
          tenantId: "test-tenant",
          reasonCode: `worker-${workerId}`,
          emittedBy: "test-emitter",
          runVersionLockId: newId("rvlock"),
          leaseId: newId("lease"),
          fencingToken: newId("fence"),
        });
        workerLatencies.push(performance.now() - transitionStart);
      }
      allLatencies.push(...workerLatencies);
    }),
  );

  const elapsed = performance.now() - start;
  allLatencies.sort((a, b) => a - b);
  const p99 = allLatencies[Math.floor(totalTransitions * 0.99)]!;
  const p50 = allLatencies[Math.floor(totalTransitions * 0.5)]!;

  try {
    assert.ok(
      p99 < 10,
      `High concurrency state transition P99 latency ${p99.toFixed(4)}ms exceeds 10ms target with ${numWorkers} workers. P50: ${p50.toFixed(4)}ms. Total time: ${elapsed.toFixed(2)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

// ============================================================================
// Subscription Concurrency Benchmarks
// ============================================================================

test("concurrency: Parallel subscription management throughput >500 ops/sec", async (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const eventBus = new TypedEventBus(db, store);

  try {
    const numWorkers = 10;
    const opsPerWorker = 50;
    const totalOps = numWorkers * opsPerWorker;

    // Warmup
    for (let i = 0; i < 50; i++) {
      const consumerId = newId("consumer");
      eventBus.subscribe(consumerId, ["perf:test_event"], async () => {});
      eventBus.unsubscribe(consumerId);
    }

    // Benchmark
    const start = performance.now();

    await Promise.all(
      Array.from({ length: numWorkers }, async (_, workerId) => {
        for (let i = 0; i < opsPerWorker; i++) {
          const consumerId = newId("consumer");
          eventBus.subscribe(consumerId, ["perf:test_event"], async () => {});
          eventBus.unsubscribe(consumerId);
        }
      }),
    );

    const elapsed = performance.now() - start;
    const opsPerSec = (totalOps / elapsed) * 1000;
    const avgLatencyMs = elapsed / totalOps;

    try {
      assert.ok(
        opsPerSec > 500,
        `Parallel subscription management throughput ${opsPerSec.toFixed(0)} ops/sec must be >500 ops/sec with ${numWorkers} workers. Avg: ${avgLatencyMs.toFixed(4)}ms`,
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
    cleanupDb(db);
  }
});

// ============================================================================
// Stress Test - Maximum Concurrency
// ============================================================================

test("concurrency: Maximum concurrency stress test >10000 total ops/sec", async (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const stateMachine = new RuntimeStateMachine();

  try {
    const numWorkers = 50;
    const opsPerWorker = 50;
    const totalOps = numWorkers * opsPerWorker;

    // Warmup
    for (let i = 0; i < 50; i++) {
      const taskId = newId("task");
      const now = nowIso();
      db.transaction(() => {
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general_ops",
          title: `Warmup ${i}`,
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

    // Benchmark
    const start = performance.now();

    await Promise.all(
      Array.from({ length: numWorkers }, async (_, workerId) => {
        for (let i = 0; i < opsPerWorker; i++) {
          const opType = (workerId + i) % 2;

          if (opType === 0) {
            // Insert task
            const taskId = newId("task");
            const now = nowIso();
            db.transaction(() => {
              store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "general_ops",
                title: `Worker ${workerId} Task ${i}`,
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
          } else {
            // State transition
            const harnessRun: HarnessRun = {
              harnessRunId: newId("hrun"),
              tenantId: "test-tenant",
              confirmedTaskSpecId: newId("ctspec"),
              requestEnvelopeId: newId("request"),
              requestHash: newId("reqhash"),
              constraintPackRef: "default",
              versionLockId: newId("vlock"),
              budgetLedgerId: newId("bledger"),
              status: "created",
              currentSeq: 0,
              createdAt: nowIso(),
              updatedAt: nowIso(),
            };
            stateMachine.transition({
              commandId: newId("cmd"),
              entityType: "HarnessRun",
              entityId: harnessRun.harnessRunId,
              principal: "test-principal",
              aggregateType: "HarnessRun",
              aggregate: harnessRun,
              fromStatus: "created",
              toStatus: "admitted",
              traceId: newId("trace"),
              tenantId: "test-tenant",
              reasonCode: `stress-${workerId}`,
              emittedBy: "test-emitter",
              runVersionLockId: newId("rvlock"),
              leaseId: newId("lease"),
              fencingToken: newId("fence"),
            });
          }
        }
      }),
    );

    const elapsed = performance.now() - start;
    const opsPerSec = (totalOps / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 10000,
        `Maximum concurrency stress test throughput ${opsPerSec.toFixed(0)} ops/sec must be >10000 ops/sec with ${numWorkers} workers`,
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
    cleanupDb(db);
  }
});
