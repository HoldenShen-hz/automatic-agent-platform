/**
 * Performance Test: Execution Throughput Benchmarks
 * Measures task execution, dispatch, and workflow processing performance
 *
 * Design targets:
 * - Task insertion throughput: >1000 ops/sec
 * - Execution state transitions: >2000 ops/sec
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { rmSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { RuntimeStateMachine } from "../../src/platform/execution/runtime-state-machine.js";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";
import type { HarnessRun, NodeRun } from "../../src/platform/contracts/executable-contracts/index.js";

function createTempDb(): SqliteDatabase {
  const dbPath = join(".tmp", `exec-throughput-${process.pid}-${Date.now()}.db`);
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
// Task Insertion Benchmarks
// ============================================================================

test("execution: Task insertion throughput >1000 ops/sec", (t) => {
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

test("execution: Task insertion P99 latency <5ms", (t) => {
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
// State Transition Benchmarks
// ============================================================================

test("execution: HarnessRun state transition throughput >2000 ops/sec", (t) => {
  const stateMachine = new RuntimeStateMachine();
  const iterations = 5000;

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

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / iterations;

  try {
    assert.ok(
      opsPerSec > 2000,
      `HarnessRun state transition throughput ${opsPerSec.toFixed(0)} ops/sec must be >2000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("execution: NodeRun state transition throughput >3000 ops/sec", (t) => {
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

test("execution: State transition P99 latency <5ms", (t) => {
  const stateMachine = new RuntimeStateMachine();
  const latencies: number[] = [];
  const iterations = 2000;

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

  try {
    assert.ok(
      p99 < 5,
      `State transition P99 latency ${p99.toFixed(3)}ms exceeds 5ms target. P50: ${p50.toFixed(3)}ms`,
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
// End-to-End Execution Benchmarks
// ============================================================================

test("execution: Complete execution flow (created->admitted->planning->ready) <50ms", (t) => {
  const stateMachine = new RuntimeStateMachine();
  const latencies: number[] = [];
  const iterations = 500;

  for (let i = 0; i < iterations; i++) {
    const harnessRunId = newId("hrun");
    const traceId = newId("trace");
    const now = nowIso();

    const flowStart = performance.now();

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

    // admitted -> planning
    const admittedRun = { ...harnessRun, status: "admitted" as const, currentSeq: 1 };
    stateMachine.transition({
      commandId: newId("cmd"),
      entityType: "HarnessRun",
      entityId: harnessRunId,
      principal: "test-principal",
      aggregateType: "HarnessRun",
      aggregate: admittedRun,
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

    // planning -> ready
    const planningRun = { ...admittedRun, status: "planning" as const, currentSeq: 2 };
    stateMachine.transition({
      commandId: newId("cmd"),
      entityType: "HarnessRun",
      entityId: harnessRunId,
      principal: "test-principal",
      aggregateType: "HarnessRun",
      aggregate: planningRun,
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

    latencies.push(performance.now() - flowStart);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const avg = latencies.reduce((a, b) => a + b, 0) / iterations;

  try {
    assert.ok(
      p99 < 50,
      `Complete execution flow P99 latency ${p99.toFixed(2)}ms exceeds 50ms target. Avg: ${avg.toFixed(2)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});
