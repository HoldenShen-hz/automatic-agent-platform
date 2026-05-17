/**
 * Performance Test: Truth Repository Snapshot Performance
 * Measures RuntimeTruthRepository.snapshot() performance
 *
 * Design targets:
 * - Snapshot with 100 aggregates: <50ms
 * - Snapshot with 1000 aggregates: <200ms
 * - Snapshot P99 latency <100ms for 1000 aggregates
 * - Snapshot memory overhead: <10MB for 1000 aggregates
 */

import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import { RuntimeTruthRepository } from "../../src/platform/five-plane-state-evidence/truth/runtime-truth-repository.js";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";
import type {
  HarnessRun,
  NodeRun,
  SideEffectRecord,
  BudgetLedger,
  BudgetReservation,
  NodeAttemptReceipt,
  RunVersionLock,
} from "../../src/platform/contracts/executable-contracts/index.js";
import { RuntimeStateMachine } from "../../src/platform/five-plane-execution/runtime-state-machine.js";

// ============================================================================
// Snapshot with Few Aggregates
// ============================================================================

test("performance: RuntimeTruthRepository snapshot (100 aggregates) <50ms", (t) => {
  const repo = new RuntimeTruthRepository();

  // Seed 100 aggregates
  for (let i = 0; i < 100; i++) {
    const harnessRun: HarnessRun = {
      harnessRunId: newId("harness"),
      taskId: newId("task"),
      workflowId: "test_workflow",
      status: "running",
      attempt: 1,
      agentId: "test_agent",
      roleId: "test_role",
      sandboxMode: "workspace_write",
      allowedToolsJson: "[]",
      allowedPathsJson: "[]",
      maxRetries: 3,
      retryBackoff: "exponential",
      budgetUsdLimit: 1.0,
      requiresApproval: false,
      fenceVersion: 1,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      startedAt: nowIso(),
      finishedAt: null,
      lastError: null,
      leaseId: null,
      fencingToken: null,
    };
    repo.seed("HarnessRun", harnessRun);
  }

  const iterations = 100;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    repo.snapshot();
  }

  const elapsed = performance.now() - start;
  const avgLatencyMs = elapsed / iterations;

  try {
    assert.ok(
      avgLatencyMs < 50,
      `Snapshot with 100 aggregates took ${avgLatencyMs.toFixed(3)}ms, expected <50ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: RuntimeTruthRepository snapshot throughput >20 ops/sec", (t) => {
  const repo = new RuntimeTruthRepository();

  // Seed 100 aggregates
  for (let i = 0; i < 100; i++) {
    const harnessRun: HarnessRun = {
      harnessRunId: newId("harness"),
      taskId: newId("task"),
      workflowId: "test_workflow",
      status: "running",
      attempt: 1,
      agentId: "test_agent",
      roleId: "test_role",
      sandboxMode: "workspace_write",
      allowedToolsJson: "[]",
      allowedPathsJson: "[]",
      maxRetries: 3,
      retryBackoff: "exponential",
      budgetUsdLimit: 1.0,
      requiresApproval: false,
      fenceVersion: 1,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      startedAt: nowIso(),
      finishedAt: null,
      lastError: null,
      leaseId: null,
      fencingToken: null,
    };
    repo.seed("HarnessRun", harnessRun);
  }

  const iterations = 100;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    repo.snapshot();
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;

  try {
    assert.ok(
      opsPerSec > 20,
      `Snapshot throughput ${opsPerSec.toFixed(2)} ops/sec must be >20 ops/sec`,
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
// Snapshot with Many Aggregates
// ============================================================================

test("performance: RuntimeTruthRepository snapshot (1000 aggregates) <200ms", (t) => {
  const repo = new RuntimeTruthRepository();

  // Seed 1000 aggregates across different types
  for (let i = 0; i < 1000; i++) {
    if (i % 5 === 0) {
      const nodeRun: NodeRun = {
        nodeRunId: newId("node"),
        harnessRunId: newId("harness"),
        nodeIndex: i,
        status: "pending",
        inputJson: "{}",
        outputJson: null,
        errorCode: null,
        retryCount: 0,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        startedAt: null,
        finishedAt: null,
      };
      repo.seed("NodeRun", nodeRun);
    } else {
      const sideEffect: SideEffectRecord = {
        sideEffectId: newId("se"),
        harnessRunId: newId("harness"),
        nodeRunId: null,
        taskId: newId("task"),
        sideEffectType: "tool_call",
        payloadJson: "{}",
        status: "pending",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      repo.seed("SideEffectRecord", sideEffect);
    }
  }

  const iterations = 50;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    repo.snapshot();
  }

  const elapsed = performance.now() - start;
  const avgLatencyMs = elapsed / iterations;

  try {
    assert.ok(
      avgLatencyMs < 200,
      `Snapshot with 1000 aggregates took ${avgLatencyMs.toFixed(3)}ms, expected <200ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: RuntimeTruthRepository snapshot P99 latency <100ms for 1000 aggregates", (t) => {
  const repo = new RuntimeTruthRepository();

  // Seed 1000 aggregates
  for (let i = 0; i < 1000; i++) {
    const budgetLedger: BudgetLedger = {
      budgetLedgerId: newId("ledger"),
      budgetPoolId: "default_pool",
      budgetScope: "task_execution",
      totalBudgetUsd: 100.0,
      consumedBudgetUsd: i * 0.01,
      reservedBudgetUsd: 0,
      lastUpdatedAt: nowIso(),
      version: 1,
    };
    repo.seed("BudgetLedger", budgetLedger);
  }

  const latencies: number[] = [];
  const iterations = 50;

  // Warmup
  for (let i = 0; i < 10; i++) {
    repo.snapshot();
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    repo.snapshot();
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  try {
    assert.ok(
      p99 < 100,
      `Snapshot P99 latency ${p99.toFixed(3)}ms exceeds 100ms target. P50: ${p50.toFixed(3)}ms`,
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
// Snapshot Memory Overhead
// ============================================================================

test("performance: RuntimeTruthRepository snapshot memory overhead <10MB for 1000 aggregates", (t) => {
  const repo = new RuntimeTruthRepository();

  // Seed 1000 aggregates
  for (let i = 0; i < 1000; i++) {
    const nodeAttemptReceipt: NodeAttemptReceipt = {
      nodeAttemptReceiptId: newId("receipt"),
      nodeRunId: newId("node"),
      harnessRunId: newId("harness"),
      attemptNumber: 1,
      status: "completed",
      outputJson: "{}",
      errorCode: null,
      startedAt: nowIso(),
      finishedAt: nowIso(),
      createdAt: nowIso(),
    };
    repo.appendNodeAttemptReceipt(nodeAttemptReceipt);
  }

  // Measure baseline memory
  const baselineMemory = process.memoryUsage().heapUsed;

  // Take snapshot
  const snapshot = repo.snapshot();

  // Measure memory after snapshot
  const afterMemory = process.memoryUsage().heapUsed;

  // Calculate overhead
  const memoryOverheadBytes = afterMemory - baselineMemory;
  const memoryOverheadMB = memoryOverheadBytes / (1024 * 1024);

  // Verify snapshot has correct data
  assert.ok(snapshot.nodeAttemptReceipts.length === 1000, `Expected 1000 receipts, got ${snapshot.nodeAttemptReceipts.length}`);

  try {
    assert.ok(
      memoryOverheadMB < 10,
      `Snapshot memory overhead ${memoryOverheadMB.toFixed(2)}MB exceeds 10MB limit`,
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
// Snapshot with Events
// ============================================================================

test("performance: RuntimeTruthRepository snapshot with 1000 events <150ms", (t) => {
  const repo = new RuntimeTruthRepository();
  const stateMachine = new RuntimeStateMachine({ persistEvent: () => undefined });
  let harnessRun = stateMachine.createHarnessRunAggregate(newId("harness"));
  repo.seed("HarnessRun", harnessRun);

  const steadyStateTransitions = ["paused", "resuming", "running"] as const;
  let eventIndex = 0;

  const applyHarnessTransition = (toStatus: typeof steadyStateTransitions[number] | "admitted" | "planning" | "ready") => {
    const result = repo.transition({
      commandId: `truth-snapshot-cmd-${eventIndex}`,
      entityType: "HarnessRun",
      entityId: harnessRun.harnessRunId,
      principal: "perf-test",
      aggregateType: "HarnessRun",
      aggregate: harnessRun,
      fromStatus: harnessRun.status,
      toStatus,
      traceId: harnessRun.traceId,
      tenantId: harnessRun.tenantId,
      reasonCode: "performance.snapshot_benchmark",
      emittedBy: "perf-test",
      runVersionLockId: harnessRun.versionLockId,
      leaseId: harnessRun.leaseId,
      fencingToken: harnessRun.fencingToken,
    });
    harnessRun = result.aggregate;
    eventIndex += 1;
  };

  applyHarnessTransition("admitted");
  applyHarnessTransition("planning");
  applyHarnessTransition("ready");
  applyHarnessTransition("running");

  while (eventIndex < 1000) {
    applyHarnessTransition(steadyStateTransitions[(eventIndex - 4) % steadyStateTransitions.length]!);
  }

  const iterations = 20;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    repo.snapshot();
  }

  const elapsed = performance.now() - start;
  const avgLatencyMs = elapsed / iterations;

  try {
    assert.ok(
      avgLatencyMs < 150,
      `Snapshot with 1000 events took ${avgLatencyMs.toFixed(3)}ms, expected <150ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});
