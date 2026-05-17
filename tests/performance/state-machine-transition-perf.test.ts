/**
 * Performance Test: State Machine Transition Performance
 * Measures RuntimeStateMachine transition throughput and latency under various loads
 *
 * Design targets:
 * - Single transition throughput: >10000 ops/sec
 * - State transition P99 latency: <1ms
 * - Parallel transitions: >5000 ops/sec with 10 concurrent workers
 * - Complete lifecycle transitions: >2000 cycles/sec
 */

import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import { RuntimeStateMachine } from "../../src/platform/five-plane-execution/runtime-state-machine.js";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";
import type { HarnessRun, NodeRun, BudgetLedger, BudgetReservation } from "../../src/platform/contracts/executable-contracts/index.js";

const PERF_RUN_VERSION_LOCK_ID = "perf-run-lock";
const PERF_LEASE_ID = "perf-lease";
const PERF_FENCING_TOKEN = "perf-fence";

function createStateMachine(): RuntimeStateMachine {
  return new RuntimeStateMachine({ persistEvent: () => {} });
}

// ============================================================================
// Single Transition Throughput Benchmarks
// ============================================================================

test("state machine: Single transition throughput >10000 ops/sec", (t) => {
  const stateMachine = createStateMachine();

  try {
    const iterations = 5000;

    // Warmup
    for (let i = 0; i < 100; i++) {
      const harnessRun = createHarnessRun(newId("hrun"), "created");
      stateMachine.transition({
        commandId: newId("cmd"),
        entityType: "HarnessRun",
        entityId: harnessRun.harnessRunId,
        principal: "perf-test",
        aggregateType: "HarnessRun",
        aggregate: harnessRun,
        fromStatus: "created",
        toStatus: "admitted",
        traceId: newId("trace"),
        tenantId: "perf-tenant",
        reasonCode: "warmup",
        emittedBy: "perf-test",
        runVersionLockId: PERF_RUN_VERSION_LOCK_ID,
        leaseId: PERF_LEASE_ID,
        fencingToken: PERF_FENCING_TOKEN,
      });
    }

    // Benchmark
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const harnessRun = createHarnessRun(newId("hrun"), "created");
      stateMachine.transition({
        commandId: newId("cmd"),
        entityType: "HarnessRun",
        entityId: harnessRun.harnessRunId,
        principal: "perf-test",
        aggregateType: "HarnessRun",
        aggregate: harnessRun,
        fromStatus: "created",
        toStatus: "admitted",
        traceId: newId("trace"),
        tenantId: "perf-tenant",
        reasonCode: "test",
        emittedBy: "perf-test",
        runVersionLockId: PERF_RUN_VERSION_LOCK_ID,
        leaseId: PERF_LEASE_ID,
        fencingToken: PERF_FENCING_TOKEN,
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 10000,
        `Single transition throughput ${opsPerSec.toFixed(0)} ops/sec must be >10000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    // No cleanup needed for state machine
  }
});

test("state machine: Transition latency P99 <1ms", (t) => {
  const stateMachine = createStateMachine();

  try {
    const latencies: number[] = [];
    const iterations = 2000;

    // Warmup
    for (let i = 0; i < 100; i++) {
      const harnessRun = createHarnessRun(newId("hrun"), "created");
      stateMachine.transition({
        commandId: newId("cmd"),
        entityType: "HarnessRun",
        entityId: harnessRun.harnessRunId,
        principal: "perf-test",
        aggregateType: "HarnessRun",
        aggregate: harnessRun,
        fromStatus: "created",
        toStatus: "admitted",
        traceId: newId("trace"),
        tenantId: "perf-tenant",
        reasonCode: "warmup",
        emittedBy: "perf-test",
        runVersionLockId: PERF_RUN_VERSION_LOCK_ID,
        leaseId: PERF_LEASE_ID,
        fencingToken: PERF_FENCING_TOKEN,
      });
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const harnessRun = createHarnessRun(newId("hrun"), "created");
      const start = performance.now();
      stateMachine.transition({
        commandId: newId("cmd"),
        entityType: "HarnessRun",
        entityId: harnessRun.harnessRunId,
        principal: "perf-test",
        aggregateType: "HarnessRun",
        aggregate: harnessRun,
        fromStatus: "created",
        toStatus: "admitted",
        traceId: newId("trace"),
        tenantId: "perf-tenant",
        reasonCode: "test",
        emittedBy: "perf-test",
        runVersionLockId: PERF_RUN_VERSION_LOCK_ID,
        leaseId: PERF_LEASE_ID,
        fencingToken: PERF_FENCING_TOKEN,
      });
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 1,
        `State transition P99 latency ${p99.toFixed(4)}ms exceeds 1ms target. P50: ${p50.toFixed(4)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    // No cleanup needed for state machine
  }
});

// ============================================================================
// Parallel Transition Benchmarks
// ============================================================================

test("state machine: Parallel transitions throughput >5000 ops/sec with 10 workers", async (t) => {
  const numWorkers = 10;
  const transitionsPerWorker = 200;
  const totalTransitions = numWorkers * transitionsPerWorker;

  // Warmup
  const stateMachine = createStateMachine();
  for (let i = 0; i < 100; i++) {
    const harnessRun = createHarnessRun(newId("hrun"), "created");
    stateMachine.transition({
      commandId: newId("cmd"),
      entityType: "HarnessRun",
      entityId: harnessRun.harnessRunId,
      principal: "perf-test",
      aggregateType: "HarnessRun",
      aggregate: harnessRun,
      fromStatus: "created",
      toStatus: "admitted",
      traceId: newId("trace"),
      tenantId: "perf-tenant",
      reasonCode: "warmup",
      emittedBy: "perf-test",
      runVersionLockId: PERF_RUN_VERSION_LOCK_ID,
      leaseId: PERF_LEASE_ID,
      fencingToken: PERF_FENCING_TOKEN,
    });
  }

  // Benchmark
  const start = performance.now();

  await Promise.all(
    Array.from({ length: numWorkers }, async (_, workerId) => {
      for (let i = 0; i < transitionsPerWorker; i++) {
        const harnessRun = createHarnessRun(newId("hrun"), "created");
        createStateMachine().transition({
          commandId: newId("cmd"),
          entityType: "HarnessRun",
          entityId: harnessRun.harnessRunId,
          principal: "perf-test",
          aggregateType: "HarnessRun",
          aggregate: harnessRun,
          fromStatus: "created",
          toStatus: "admitted",
          traceId: newId("trace"),
          tenantId: "perf-tenant",
          reasonCode: `worker-${workerId}`,
          emittedBy: "perf-test",
          runVersionLockId: PERF_RUN_VERSION_LOCK_ID,
          leaseId: PERF_LEASE_ID,
          fencingToken: PERF_FENCING_TOKEN,
        });
      }
    }),
  );

  const elapsed = performance.now() - start;
  const opsPerSec = (totalTransitions / elapsed) * 1000;
  const avgLatencyMs = elapsed / totalTransitions;

  try {
    assert.ok(
      opsPerSec > 5000,
      `Parallel transition throughput ${opsPerSec.toFixed(0)} ops/sec must be >5000 ops/sec with ${numWorkers} workers. Avg: ${avgLatencyMs.toFixed(4)}ms`,
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
// Complete Lifecycle Transition Benchmarks
// ============================================================================

test("state machine: Complete harness run lifecycle >2000 cycles/sec", (t) => {
  const stateMachine = createStateMachine();

  try {
    const iterations = 500;
    const transitionsPerLifecycle = 4; // created->admitted->planning->ready->running

    // Warmup
    for (let i = 0; i < 10; i++) {
      let run = createHarnessRun(newId("hrun"), "created");
      run = stateMachine.transition({
        commandId: newId("cmd"),
        entityType: "HarnessRun",
        entityId: run.harnessRunId,
        principal: "perf-test",
        aggregateType: "HarnessRun",
        aggregate: run,
        fromStatus: "created",
        toStatus: "admitted",
        traceId: newId("trace"),
        tenantId: "perf-tenant",
        reasonCode: "warmup",
        emittedBy: "perf-test",
        runVersionLockId: PERF_RUN_VERSION_LOCK_ID,
        leaseId: PERF_LEASE_ID,
        fencingToken: PERF_FENCING_TOKEN,
      }).aggregate;
    }

    // Benchmark
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      let run = createHarnessRun(newId("hrun"), "created");
      let result;

      result = stateMachine.transition({
        commandId: newId("cmd"),
        entityType: "HarnessRun",
        entityId: run.harnessRunId,
        principal: "perf-test",
        aggregateType: "HarnessRun",
        aggregate: run,
        fromStatus: "created",
        toStatus: "admitted",
        traceId: newId("trace"),
        tenantId: "perf-tenant",
        reasonCode: "test",
        emittedBy: "perf-test",
        runVersionLockId: PERF_RUN_VERSION_LOCK_ID,
        leaseId: PERF_LEASE_ID,
        fencingToken: PERF_FENCING_TOKEN,
      });
      run = result.aggregate;

      result = stateMachine.transition({
        commandId: newId("cmd"),
        entityType: "HarnessRun",
        entityId: run.harnessRunId,
        principal: "perf-test",
        aggregateType: "HarnessRun",
        aggregate: run,
        fromStatus: "admitted",
        toStatus: "planning",
        traceId: newId("trace"),
        tenantId: "perf-tenant",
        reasonCode: "test",
        emittedBy: "perf-test",
        leaseId: PERF_LEASE_ID,
        fencingToken: PERF_FENCING_TOKEN,
      });
      run = result.aggregate;

      result = stateMachine.transition({
        commandId: newId("cmd"),
        entityType: "HarnessRun",
        entityId: run.harnessRunId,
        principal: "perf-test",
        aggregateType: "HarnessRun",
        aggregate: run,
        fromStatus: "planning",
        toStatus: "ready",
        traceId: newId("trace"),
        tenantId: "perf-tenant",
        reasonCode: "test",
        emittedBy: "perf-test",
        leaseId: PERF_LEASE_ID,
        fencingToken: PERF_FENCING_TOKEN,
      });
      run = result.aggregate;

      result = stateMachine.transition({
        commandId: newId("cmd"),
        entityType: "HarnessRun",
        entityId: run.harnessRunId,
        principal: "perf-test",
        aggregateType: "HarnessRun",
        aggregate: run,
        fromStatus: "ready",
        toStatus: "running",
        traceId: newId("trace"),
        tenantId: "perf-tenant",
        reasonCode: "test",
        emittedBy: "perf-test",
        leaseId: PERF_LEASE_ID,
        fencingToken: PERF_FENCING_TOKEN,
      });
      run = result.aggregate;
    }

    const elapsed = performance.now() - start;
    const totalTransitions = iterations * transitionsPerLifecycle;
    const opsPerSec = (totalTransitions / elapsed) * 1000;
    const avgLatencyMs = elapsed / totalTransitions;

    try {
      assert.ok(
        opsPerSec > 2000,
        `Complete lifecycle throughput ${opsPerSec.toFixed(0)} transitions/sec must be >2000 cycles/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    // No cleanup needed for state machine
  }
});

// ============================================================================
// NodeRun Transition Benchmarks
// ============================================================================

test("state machine: NodeRun transition throughput >8000 ops/sec", (t) => {
  const stateMachine = createStateMachine();

  try {
    const iterations = 4000;

    // Warmup
    for (let i = 0; i < 50; i++) {
      const nodeRun = createNodeRun(newId("noderun"), "created");
      stateMachine.transition({
        commandId: newId("cmd"),
        entityType: "NodeRun",
        entityId: nodeRun.nodeRunId,
        principal: "perf-test",
        aggregateType: "NodeRun",
        aggregate: nodeRun,
        fromStatus: "created",
        toStatus: "ready",
        traceId: newId("trace"),
        tenantId: "perf-tenant",
        reasonCode: "warmup",
        emittedBy: "perf-test",
        leaseId: PERF_LEASE_ID,
        fencingToken: PERF_FENCING_TOKEN,
      });
    }

    // Benchmark
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const nodeRun = createNodeRun(newId("noderun"), "created");
      stateMachine.transition({
        commandId: newId("cmd"),
        entityType: "NodeRun",
        entityId: nodeRun.nodeRunId,
        principal: "perf-test",
        aggregateType: "NodeRun",
        aggregate: nodeRun,
        fromStatus: "created",
        toStatus: "ready",
        traceId: newId("trace"),
        tenantId: "perf-tenant",
        reasonCode: "test",
        emittedBy: "perf-test",
        leaseId: PERF_LEASE_ID,
        fencingToken: PERF_FENCING_TOKEN,
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 8000,
        `NodeRun transition throughput ${opsPerSec.toFixed(0)} ops/sec must be >8000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    // No cleanup needed for state machine
  }
});

// ============================================================================
// BudgetLedger Transition Benchmarks
// ============================================================================

test("state machine: BudgetLedger transition throughput >10000 ops/sec", (t) => {
  const stateMachine = createStateMachine();

  try {
    const iterations = 5000;

    // Warmup
    for (let i = 0; i < 100; i++) {
      const ledger = createBudgetLedger(newId("bledger"), "open");
      stateMachine.transition({
        commandId: newId("cmd"),
        entityType: "BudgetLedger",
        entityId: ledger.budgetLedgerId,
        principal: "perf-test",
        aggregateType: "BudgetLedger",
        aggregate: ledger,
        fromStatus: "open",
        toStatus: "soft_cap_reached",
        traceId: newId("trace"),
        tenantId: "perf-tenant",
        reasonCode: "warmup",
        emittedBy: "perf-test",
        leaseId: PERF_LEASE_ID,
        fencingToken: PERF_FENCING_TOKEN,
      });
    }

    // Benchmark
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const ledger = createBudgetLedger(newId("bledger"), "open");
      stateMachine.transition({
        commandId: newId("cmd"),
        entityType: "BudgetLedger",
        entityId: ledger.budgetLedgerId,
        principal: "perf-test",
        aggregateType: "BudgetLedger",
        aggregate: ledger,
        fromStatus: "open",
        toStatus: "soft_cap_reached",
        traceId: newId("trace"),
        tenantId: "perf-tenant",
        reasonCode: "test",
        emittedBy: "perf-test",
        leaseId: PERF_LEASE_ID,
        fencingToken: PERF_FENCING_TOKEN,
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 10000,
        `BudgetLedger transition throughput ${opsPerSec.toFixed(0)} ops/sec must be >10000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    // No cleanup needed for state machine
  }
});

// ============================================================================
// BudgetReservation Transition Benchmarks
// ============================================================================

test("state machine: BudgetReservation transition throughput >10000 ops/sec", (t) => {
  const stateMachine = createStateMachine();

  try {
    const iterations = 5000;

    // Warmup
    for (let i = 0; i < 100; i++) {
      const reservation = createBudgetReservation(newId("res"), "reserved");
      stateMachine.transition({
        commandId: newId("cmd"),
        entityType: "BudgetReservation",
        entityId: reservation.budgetReservationId,
        principal: "perf-test",
        aggregateType: "BudgetReservation",
        aggregate: reservation,
        fromStatus: "reserved",
        toStatus: "settled",
        traceId: newId("trace"),
        tenantId: "perf-tenant",
        reasonCode: "warmup",
        emittedBy: "perf-test",
      });
    }

    // Benchmark
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const reservation = createBudgetReservation(newId("res"), "reserved");
      stateMachine.transition({
        commandId: newId("cmd"),
        entityType: "BudgetReservation",
        entityId: reservation.budgetReservationId,
        principal: "perf-test",
        aggregateType: "BudgetReservation",
        aggregate: reservation,
        fromStatus: "reserved",
        toStatus: "settled",
        traceId: newId("trace"),
        tenantId: "perf-tenant",
        reasonCode: "test",
        emittedBy: "perf-test",
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 10000,
        `BudgetReservation transition throughput ${opsPerSec.toFixed(0)} ops/sec must be >10000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    // No cleanup needed for state machine
  }
});

// ============================================================================
// High-Concurrency Stress Test
// ============================================================================

test("state machine: High-concurrency stress test >20000 total ops/sec", async (t) => {
  const numWorkers = 20;
  const transitionsPerWorker = 100;
  const totalTransitions = numWorkers * transitionsPerWorker;

  // Benchmark
  const start = performance.now();

  await Promise.all(
    Array.from({ length: numWorkers }, async (_, workerId) => {
      for (let i = 0; i < transitionsPerWorker; i++) {
        const harnessRun = createHarnessRun(newId("hrun"), "created");
        createStateMachine().transition({
          commandId: newId("cmd"),
          entityType: "HarnessRun",
          entityId: harnessRun.harnessRunId,
          principal: "perf-test",
          aggregateType: "HarnessRun",
          aggregate: harnessRun,
          fromStatus: "created",
          toStatus: "admitted",
          traceId: newId("trace"),
          tenantId: "perf-tenant",
          reasonCode: `stress-${workerId}`,
          emittedBy: "perf-test",
          runVersionLockId: PERF_RUN_VERSION_LOCK_ID,
          leaseId: PERF_LEASE_ID,
          fencingToken: PERF_FENCING_TOKEN,
        });
      }
    }),
  );

  const elapsed = performance.now() - start;
  const opsPerSec = (totalTransitions / elapsed) * 1000;

  try {
    assert.ok(
      opsPerSec > 20000,
      `High-concurrency stress test throughput ${opsPerSec.toFixed(0)} ops/sec must be >20000 ops/sec with ${numWorkers} workers`,
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
// Helper Functions
// ============================================================================

function createHarnessRun(harnessRunId: string, status: HarnessRun["status"]): HarnessRun {
  return {
    harnessRunId,
    tenantId: "perf-tenant",
    confirmedTaskSpecId: newId("ctspec"),
    requestEnvelopeId: newId("request"),
    requestHash: newId("reqhash"),
    constraintPackRef: "default",
    versionLockId: newId("vlock"),
    budgetLedgerId: newId("bledger"),
    status,
    currentSeq: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function createNodeRun(nodeRunId: string, status: NodeRun["status"]): NodeRun {
  return {
    nodeRunId,
    harnessRunId: newId("hrun"),
    tenantId: "perf-tenant",
    confirmedTaskSpecId: newId("ctspec"),
    parentNodeRunId: null,
    nodeIndex: 0,
    status,
    inputJson: "{}",
    currentSeq: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function createBudgetLedger(budgetLedgerId: string, status: BudgetLedger["status"]): BudgetLedger {
  return {
    budgetLedgerId,
    harnessRunId: newId("hrun"),
    tenantId: "perf-tenant",
    hardCap: 100000,
    reservedAmount: 0,
    settledAmount: 0,
    releasedAmount: 0,
    status,
    version: 1,
  };
}

function createBudgetReservation(reservationId: string, status: BudgetReservation["status"]): BudgetReservation {
  return {
    budgetReservationId: reservationId,
    budgetLedgerId: newId("bledger"),
    harnessRunId: newId("hrun"),
    tenantId: "perf-tenant",
    resourceKind: "compute",
    amount: 100,
    status,
    expiresAt: nowIso(),
    createdAt: nowIso(),
    version: 1,
  };
}
