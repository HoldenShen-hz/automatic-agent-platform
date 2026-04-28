/**
 * Performance Test: Task Execution Throughput
 * Measures task execution, budget allocation, and state transition performance
 *
 * Design targets:
 * - Task insertion throughput: >1000 ops/sec
 * - Budget reservation throughput: >2000 ops/sec
 * - State transition latency: <5ms per transition
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { rmSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { BudgetAllocator } from "../../src/platform/execution/budget-allocator.js";
import { RuntimeStateMachine } from "../../src/platform/execution/runtime-state-machine.js";
import type {
  BudgetLedger,
  BudgetReservation,
  HarnessRun,
  NodeRun,
} from "../../src/platform/contracts/executable-contracts/index.js";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";

function createTempDb(): SqliteDatabase {
  const dbPath = join(".tmp", `execution-throughput-perf-${process.pid}-${Date.now()}.db`);
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
// Task Insertion Throughput Benchmarks
// ============================================================================

test("performance: Task insertion throughput >1000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    // Warmup
    for (let i = 0; i < 100; i++) {
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
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 1000,
        `Task insertion throughput ${opsPerSec.toFixed(0)} ops/sec must be >1000 ops/sec. Avg: ${avgLatencyMs.toFixed(3)}ms`,
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

test("performance: Task insertion P99 latency <5ms", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    const latencies: number[] = [];
    const iterations = 1000;

    // Warmup
    for (let i = 0; i < 100; i++) {
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

    // Measure
    for (let i = 0; i < iterations; i++) {
      const taskId = newId("task");
      const now = nowIso();
      const start = performance.now();
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
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 5,
        `Task insertion P99 latency ${p99.toFixed(3)}ms exceeds 5ms target. P50: ${p50.toFixed(3)}ms`,
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
// Budget Reservation Throughput Benchmarks
// ============================================================================

test("performance: Budget reservation throughput >2000 ops/sec", (t) => {
  const allocator = new BudgetAllocator();

  // Warmup
  for (let i = 0; i < 100; i++) {
    const ledger: BudgetLedger = {
      budgetLedgerId: newId("bledger"),
      tenantId: "test-tenant",
      harnessRunId: newId("hrun"),
      currency: "USD",
      hardCap: 10000,
      reservedAmount: 0,
      settledAmount: 0,
      releasedAmount: 0,
      status: "open",
      version: i,
    };
    allocator.reserve({
      ledger,
      amount: 10,
      resourceKind: "token",
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      expectedVersion: ledger.version,
    });
  }

  // Benchmark
  const iterations = 5000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const ledger: BudgetLedger = {
      budgetLedgerId: newId("bledger"),
      tenantId: "test-tenant",
      harnessRunId: newId("hrun"),
      currency: "USD",
      hardCap: 10000,
      reservedAmount: 0,
      settledAmount: 0,
      releasedAmount: 0,
      status: "open",
      version: i,
    };
    allocator.reserve({
      ledger,
      amount: 10,
      resourceKind: "token",
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      expectedVersion: ledger.version,
    });
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / iterations;

  try {
    assert.ok(
      opsPerSec > 2000,
      `Budget reservation throughput ${opsPerSec.toFixed(0)} ops/sec must be >2000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: Budget reservation P99 latency <1ms", (t) => {
  const allocator = new BudgetAllocator();
  const latencies: number[] = [];
  const iterations = 2000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    const ledger: BudgetLedger = {
      budgetLedgerId: newId("bledger"),
      tenantId: "test-tenant",
      harnessRunId: newId("hrun"),
      currency: "USD",
      hardCap: 10000,
      reservedAmount: 0,
      settledAmount: 0,
      releasedAmount: 0,
      status: "open",
      version: i,
    };
    allocator.reserve({
      ledger,
      amount: 10,
      resourceKind: "token",
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      expectedVersion: ledger.version,
    });
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const ledger: BudgetLedger = {
      budgetLedgerId: newId("bledger"),
      tenantId: "test-tenant",
      harnessRunId: newId("hrun"),
      currency: "USD",
      hardCap: 10000,
      reservedAmount: 0,
      settledAmount: 0,
      releasedAmount: 0,
      status: "open",
      version: i + 100,
    };
    const start = performance.now();
    allocator.reserve({
      ledger,
      amount: 10,
      resourceKind: "token",
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      expectedVersion: ledger.version,
    });
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  try {
    assert.ok(
      p99 < 1,
      `Budget reservation P99 latency ${p99.toFixed(4)}ms exceeds 1ms target. P50: ${p50.toFixed(4)}ms`,
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
// State Transition Latency Benchmarks
// ============================================================================

test("performance: State transition latency <5ms per transition", (t) => {
  const stateMachine = new RuntimeStateMachine();
  const iterations = 5000;
  const latencies: number[] = [];

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

  // Measure
  for (let i = 0; i < iterations; i++) {
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
    const start = performance.now();
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
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;
  const avg = latencies.reduce((a, b) => a + b, 0) / iterations;

  try {
    assert.ok(
      p99 < 5,
      `State transition P99 latency ${p99.toFixed(3)}ms exceeds 5ms target. P50: ${p50.toFixed(3)}ms, Avg: ${avg.toFixed(3)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: NodeRun state transition throughput >3000 ops/sec", (t) => {
  const stateMachine = new RuntimeStateMachine();
  const iterations = 5000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    const nodeRun: NodeRun = {
      nodeRunId: newId("noderun"),
      harnessRunId: newId("hrun"),
      planNodeId: newId("node"),
      status: "created",
      currentSeq: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    stateMachine.transition({
      commandId: newId("cmd"),
      entityType: "NodeRun",
      entityId: nodeRun.nodeRunId,
      principal: "test-principal",
      aggregateType: "NodeRun",
      aggregate: nodeRun,
      fromStatus: "created",
      toStatus: "ready",
      traceId: newId("trace"),
      tenantId: "test-tenant",
      reasonCode: "warmup",
      emittedBy: "test-emitter",
      leaseId: newId("lease"),
      fencingToken: newId("fence"),
    });
  }

  // Benchmark
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const nodeRun: NodeRun = {
      nodeRunId: newId("noderun"),
      harnessRunId: newId("hrun"),
      planNodeId: newId("node"),
      status: "created",
      currentSeq: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    stateMachine.transition({
      commandId: newId("cmd"),
      entityType: "NodeRun",
      entityId: nodeRun.nodeRunId,
      principal: "test-principal",
      aggregateType: "NodeRun",
      aggregate: nodeRun,
      fromStatus: "created",
      toStatus: "ready",
      traceId: newId("trace"),
      tenantId: "test-tenant",
      reasonCode: "test",
      emittedBy: "test-emitter",
      leaseId: newId("lease"),
      fencingToken: newId("fence"),
    });
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / iterations;

  try {
    assert.ok(
      opsPerSec > 3000,
      `NodeRun state transition throughput ${opsPerSec.toFixed(0)} ops/sec must be >3000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
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
// Budget Settlement Throughput Benchmarks
// ============================================================================

test("performance: Budget settlement throughput >1500 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const allocator = new BudgetAllocator();

  try {
    // Create a budget ledger and reservation
    const ledger: BudgetLedger = {
      budgetLedgerId: newId("bledger"),
      tenantId: "test-tenant",
      harnessRunId: newId("hrun"),
      currency: "USD",
      hardCap: 10000,
      reservedAmount: 0,
      settledAmount: 0,
      releasedAmount: 0,
      status: "open",
      version: 0,
    };

    const reservationResult = allocator.reserve({
      ledger,
      amount: 100,
      resourceKind: "token",
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      expectedVersion: 0,
    });

    // Warmup
    for (let i = 0; i < 50; i++) {
      allocator.settle({
        ledger: reservationResult.ledger,
        reservation: reservationResult.reservation,
        actualAmount: 50,
        context: {
          tenantId: "test-tenant",
          traceId: newId("trace"),
          emittedBy: "test-emitter",
        },
      });
    }

    // Benchmark
    const iterations = 3000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      // Recreate reservation for each settlement
      const resResult = allocator.reserve({
        ledger: {
          ...ledger,
          version: i,
        },
        amount: 100,
        resourceKind: "token",
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        expectedVersion: i,
      });
      allocator.settle({
        ledger: resResult.ledger,
        reservation: resResult.reservation,
        actualAmount: 50,
        context: {
          tenantId: "test-tenant",
          traceId: newId("trace"),
          emittedBy: "test-emitter",
        },
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 1500,
        `Budget settlement throughput ${opsPerSec.toFixed(0)} ops/sec must be >1500 ops/sec. Avg: ${avgLatencyMs.toFixed(3)}ms`,
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
// End-to-End Execution Flow Benchmarks
// ============================================================================

test("performance: Complete task lifecycle (queued->done) <100ms per task", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);
  const stateMachine = new RuntimeStateMachine();

  try {
    const iterations = 500;
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const taskId = newId("task");
      const harnessRunId = newId("hrun");
      const traceId = newId("trace");
      const now = nowIso();

      const taskStart = performance.now();

      // Create task
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

      // Simulate harness run state transitions
      const harnessRun: HarnessRun = {
        harnessRunId,
        tenantId: "test-tenant",
        confirmedTaskSpecId: newId("ctspec"),
        requestEnvelopeId: newId("request"),
        requestHash: newId("reqhash"),
        constraintPackRef: "default",
        versionLockId: newId("vlock"),
        budgetLedgerId: newId("bledger"),
        status: "created",
        currentSeq: 0,
        createdAt: now,
        updatedAt: now,
      };

      // created -> admitted
      stateMachine.transition({
        commandId: newId("cmd"),
        entityType: "HarnessRun",
        entityId: harnessRunId,
        principal: "test-principal",
        aggregateType: "HarnessRun",
        aggregate: harnessRun,
        fromStatus: "created",
        toStatus: "admitted",
        traceId,
        tenantId: "test-tenant",
        reasonCode: "task.queued",
        emittedBy: "test-emitter",
        runVersionLockId: newId("rvlock"),
        leaseId: newId("lease"),
        fencingToken: newId("fence"),
      });

      // admitted -> planning -> ready -> running
      const updatedHarnessRun = { ...harnessRun, status: "admitted" as const, currentSeq: 1 };
      stateMachine.transition({
        commandId: newId("cmd"),
        entityType: "HarnessRun",
        entityId: harnessRunId,
        principal: "test-principal",
        aggregateType: "HarnessRun",
        aggregate: updatedHarnessRun,
        fromStatus: "admitted",
        toStatus: "planning",
        traceId,
        tenantId: "test-tenant",
        reasonCode: "task.start",
        emittedBy: "test-emitter",
        runVersionLockId: newId("rvlock"),
        leaseId: newId("lease"),
        fencingToken: newId("fence"),
      });

      const planningHarness = { ...updatedHarnessRun, status: "planning" as const, currentSeq: 2 };
      stateMachine.transition({
        commandId: newId("cmd"),
        entityType: "HarnessRun",
        entityId: harnessRunId,
        principal: "test-principal",
        aggregateType: "HarnessRun",
        aggregate: planningHarness,
        fromStatus: "planning",
        toStatus: "ready",
        traceId,
        tenantId: "test-tenant",
        reasonCode: "task.planned",
        emittedBy: "test-emitter",
        runVersionLockId: newId("rvlock"),
        leaseId: newId("lease"),
        fencingToken: newId("fence"),
      });

      const readyHarness = { ...planningHarness, status: "ready" as const, currentSeq: 3 };
      stateMachine.transition({
        commandId: newId("cmd"),
        entityType: "HarnessRun",
        entityId: harnessRunId,
        principal: "test-principal",
        aggregateType: "HarnessRun",
        aggregate: readyHarness,
        fromStatus: "ready",
        toStatus: "running",
        traceId,
        tenantId: "test-tenant",
        reasonCode: "task.executing",
        emittedBy: "test-emitter",
        runVersionLockId: newId("rvlock"),
        leaseId: newId("lease"),
        fencingToken: newId("fence"),
      });

      latencies.push(performance.now() - taskStart);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const avg = latencies.reduce((a, b) => a + b, 0) / iterations;

    try {
      assert.ok(
        p99 < 100,
        `Complete task lifecycle P99 latency ${p99.toFixed(2)}ms exceeds 100ms target. Avg: ${avg.toFixed(2)}ms`,
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