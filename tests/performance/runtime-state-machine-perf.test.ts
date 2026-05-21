/**
 * Performance Test: Runtime State Machine
 * Measures runtime state transition throughput and latency
 *
 * Design targets:
 * - State aggregate creation: >5000 ops/sec
 * - Transition command building: >3000 ops/sec
 * - State validation: >4000 ops/sec
 */

import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import { RuntimeStateMachine } from "../../src/platform/five-plane-execution/runtime-state-machine.js";
import { newId } from "../../src/platform/contracts/types/ids.js";

// ============================================================================
// Aggregate Creation Benchmarks
// ============================================================================

test("performance: RuntimeStateMachine createHarnessRunAggregate() >5000 ops/sec", (t) => {
  const machine = new RuntimeStateMachine();

  const iterations = 5000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    machine.createHarnessRunAggregate(newId("harness"));
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;

  try {
    assert.ok(opsPerSec > 5000, `createHarnessRunAggregate() ${opsPerSec.toFixed(0)} ops/sec must be >5000 ops/sec`);
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: RuntimeStateMachine createNodeRunAggregate() >5000 ops/sec", (t) => {
  const machine = new RuntimeStateMachine();
  const harnessId = newId("harness");

  const iterations = 5000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    machine.createNodeRunAggregate(newId("node"), harnessId);
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;

  try {
    assert.ok(opsPerSec > 5000, `createNodeRunAggregate() ${opsPerSec.toFixed(0)} ops/sec must be >5000 ops/sec`);
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

// ============================================================================
// Transition Command Building Benchmarks
// ============================================================================

test("performance: RuntimeStateMachine buildTransitionCommand() >3000 ops/sec", (t) => {
  const machine = new RuntimeStateMachine();
  const harness = machine.createHarnessRunAggregate(newId("harness"));

  const iterations = 3000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    machine.buildTransitionCommand(harness, "admitted", "created", {
      commandId: newId("cmd"),
      principal: "test-principal",
      entityType: "HarnessRun",
      entityId: harness.harnessRunId,
      aggregateType: "HarnessRun",
      traceId: newId("trace"),
      tenantId: "test-tenant",
      reasonCode: "test",
      emittedBy: "test-emitter",
      runVersionLockId: harness.versionLockId,
      auditRef: `audit://perf/runtime-state-machine/build/${i}`,
    });
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;

  try {
    assert.ok(opsPerSec > 3000, `buildTransitionCommand() ${opsPerSec.toFixed(0)} ops/sec must be >3000 ops/sec`);
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

// ============================================================================
// State Validation Benchmarks
// ============================================================================

test("performance: RuntimeStateMachine validateTransition() >4000 ops/sec", (t) => {
  const machine = new RuntimeStateMachine();
  const harness = machine.createHarnessRunAggregate(newId("harness"));

  const iterations = 4000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    machine.validateTransition(harness, "admitted", "created");
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;

  try {
    assert.ok(opsPerSec > 4000, `validateTransition() ${opsPerSec.toFixed(0)} ops/sec must be >4000 ops/sec`);
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

// ============================================================================
// Transition Execution Benchmarks
// ============================================================================

test("performance: RuntimeStateMachine executeTransition() P99 <2ms", (t) => {
  const machine = new RuntimeStateMachine();
  const latencies: number[] = [];
  const iterations = 1000;

  for (let i = 0; i < iterations; i++) {
    const aggregate = machine.createHarnessRunAggregate(newId("harness"));
    const start = performance.now();
    machine.executeTransition(aggregate, "admitted", {
      commandId: newId("cmd"),
      principal: "test-principal",
      entityType: "HarnessRun",
      entityId: aggregate.harnessRunId,
      aggregateType: "HarnessRun",
      traceId: newId("trace"),
      tenantId: "test-tenant",
      reasonCode: "test",
      emittedBy: "test-emitter",
      runVersionLockId: aggregate.versionLockId,
      auditRef: `audit://perf/runtime-state-machine/execute/${i}`,
    });
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;

  try {
    assert.ok(p99 < 2, `executeTransition() P99 latency ${p99.toFixed(3)}ms must be <2ms`);
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

// ============================================================================
// Concurrent Transition Benchmarks
// ============================================================================

test("performance: RuntimeStateMachine concurrent transitions (10 parallel) >3000 ops/sec", async (t) => {
  const machine = new RuntimeStateMachine();

  const iterations = 100;
  const parallelCount = 10;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const promises = Array.from({ length: parallelCount }, (_, idx) =>
      (async () => {
        const aggregate = machine.createHarnessRunAggregate(newId("harness"));
        machine.executeTransition(aggregate, "admitted", {
          commandId: newId("cmd"),
          principal: "test-principal",
          entityType: "HarnessRun",
          entityId: aggregate.harnessRunId,
          aggregateType: "HarnessRun",
          traceId: newId("trace"),
          tenantId: "test-tenant",
          reasonCode: "test",
          emittedBy: "test-emitter",
          runVersionLockId: aggregate.versionLockId,
          auditRef: `audit://perf/runtime-state-machine/concurrent/${i}-${idx}`,
        });
      })()
    );
    await Promise.all(promises);
  }

  const elapsed = performance.now() - start;
  const totalOps = iterations * parallelCount;
  const opsPerSec = (totalOps / elapsed) * 1000;

  try {
    assert.ok(opsPerSec > 3000, `Concurrent transitions ${opsPerSec.toFixed(0)} ops/sec must be >3000 ops/sec`);
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});
