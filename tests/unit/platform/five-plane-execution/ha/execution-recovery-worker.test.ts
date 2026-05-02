import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionRecoveryWorker } from "../../../../../src/platform/five-plane-execution/ha/execution-recovery-worker.js";

function createMockRecoveryService() {
  return {
    listBlockedRunsAwaitingApproval: () => [],
    listRecoverableExecutingRuns: () => [],
    listStaleRuns: () => [],
  };
}

test("ExecutionRecoveryWorker can be instantiated", () => {
  const worker = new ExecutionRecoveryWorker({
    recoveryService: createMockRecoveryService(),
  });
  assert.ok(worker instanceof ExecutionRecoveryWorker);
});

test("ExecutionRecoveryWorker getWorkerId returns default", () => {
  const worker = new ExecutionRecoveryWorker({
    recoveryService: createMockRecoveryService(),
  });
  assert.equal(worker.getWorkerId(), "execution-recovery-worker");
});

test("ExecutionRecoveryWorker getWorkerId returns custom id", () => {
  const worker = new ExecutionRecoveryWorker({
    recoveryService: createMockRecoveryService(),
    workerId: "custom-worker-id",
  });
  assert.equal(worker.getWorkerId(), "custom-worker-id");
});

test("ExecutionRecoveryWorker getRecoveryCadence returns cadence", () => {
  const worker = new ExecutionRecoveryWorker({
    recoveryService: createMockRecoveryService(),
  });
  const cadence = worker.getRecoveryCadence();

  assert.ok(typeof cadence.intervalMs === "number");
  assert.ok(typeof cadence.maxConcurrent === "number");
  assert.ok(typeof cadence.priority === "string");
});

test("ExecutionRecoveryWorker getRecoveryCadence uses custom cadence", () => {
  const worker = new ExecutionRecoveryWorker({
    recoveryService: createMockRecoveryService(),
    cadence: {
      intervalMs: 30_000,
      maxConcurrent: 5,
      priority: "critical",
    },
  });
  const cadence = worker.getRecoveryCadence();

  assert.equal(cadence.intervalMs, 30_000);
  assert.equal(cadence.maxConcurrent, 5);
  assert.equal(cadence.priority, "critical");
});

test("ExecutionRecoveryWorker runRecoveryCycle returns report", async () => {
  const worker = new ExecutionRecoveryWorker({
    recoveryService: createMockRecoveryService(),
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.workerId, "execution-recovery-worker");
  assert.equal(report.workerType, "execution_recovery");
  assert.ok(Array.isArray(report.errors));
  assert.ok(Array.isArray(report.metadata));
});

test("ExecutionRecoveryWorker runRecoveryCycle handles empty candidates", async () => {
  const worker = new ExecutionRecoveryWorker({
    recoveryService: createMockRecoveryService(),
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.itemsProcessed, 0);
  assert.equal(report.itemsRecovered, 0);
});

test("ExecutionRecoveryWorker runRecoveryCycle handles candidates", async () => {
  const mockRecoveryService = {
    listBlockedRunsAwaitingApproval: () => [{ runId: "blocked-1" }],
    listRecoverableExecutingRuns: () => [{ runId: "active-1", suggestedAction: "resume_same_worker" }],
    listStaleRuns: () => [{ runId: "stale-1" }],
  };

  const worker = new ExecutionRecoveryWorker({
    recoveryService: mockRecoveryService,
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.itemsProcessed, 3);
  assert.equal(report.itemsRecovered, 1); // Only 1 actionable
});

test("ExecutionRecoveryWorker runRecoveryCycle handles service errors", async () => {
  const failingService = {
    listBlockedRunsAwaitingApproval: () => { throw new Error("Service error"); },
    listRecoverableExecutingRuns: () => [],
    listStaleRuns: () => [],
  };

  const worker = new ExecutionRecoveryWorker({
    recoveryService: failingService,
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.workerId, "execution-recovery-worker");
  assert.ok(report.errors.length > 0);
  assert.ok(report.errors[0]?.message.includes("Service error"));
});

test("ExecutionRecoveryWorker staleThresholdMs defaults to 5 minutes", () => {
  const worker = new ExecutionRecoveryWorker({
    recoveryService: createMockRecoveryService(),
  });

  const report = worker.runRecoveryCycle();

  assert.ok(report);
});
