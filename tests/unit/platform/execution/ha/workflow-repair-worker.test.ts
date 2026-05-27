import test from "node:test";
import assert from "node:assert/strict";

import { WorkflowRepairWorker, type WorkflowRepairWorkerOptions } from "../../../../../src/platform/five-plane-execution/ha/workflow-repair-worker.js";

function createMockStartupConsistencyChecker() {
  return {
    run: (options?: { now?: string }) => ({
      status: "consistent" as const,
      findings: [],
      repairActions: [],
      checkedAt: options?.now ?? "2024-01-01T00:00:00.000Z",
    }),
  };
}

function createMockRepairService() {
  return {
    apply: async (report: { repairActions: Array<{ action: string; targetId: string; detail: string }> }) =>
      report.repairActions.map((a) => ({ action: a.action, targetId: a.targetId, detail: a.detail, applied: true })),
  };
}

test("WorkflowRepairWorker returns correct workerId [workflow-repair-worker]", () => {
  const worker = new WorkflowRepairWorker({
    checker: createMockStartupConsistencyChecker(),
    repairService: createMockRepairService(),
    workerId: "test-repair-worker",
  });

  assert.equal(worker.getWorkerId(), "test-repair-worker");
});

test("WorkflowRepairWorker returns default workerId when not provided [workflow-repair-worker]", () => {
  const worker = new WorkflowRepairWorker({
    checker: createMockStartupConsistencyChecker(),
    repairService: createMockRepairService(),
  });

  assert.equal(worker.getWorkerId(), "workflow-repair-worker");
});

test("WorkflowRepairWorker returns recovery cadence [workflow-repair-worker]", () => {
  const worker = new WorkflowRepairWorker({
    checker: createMockStartupConsistencyChecker(),
    repairService: createMockRepairService(),
    cadence: { intervalMs: 60_000, maxConcurrent: 2, priority: "high" },
  });

  const cadence = worker.getRecoveryCadence();

  assert.equal(cadence.intervalMs, 60_000);
  assert.equal(cadence.maxConcurrent, 2);
  assert.equal(cadence.priority, "high");
});

test("WorkflowRepairWorker uses default cadence when not provided [workflow-repair-worker]", () => {
  const worker = new WorkflowRepairWorker({
    checker: createMockStartupConsistencyChecker(),
    repairService: createMockRepairService(),
  });

  const cadence = worker.getRecoveryCadence();

  assert.equal(cadence.intervalMs, 120_000);
  assert.equal(cadence.maxConcurrent, 1);
  assert.equal(cadence.priority, "high");
});

test("WorkflowRepairWorker runRecoveryCycle returns successful report [workflow-repair-worker]", async () => {
  const checker = createMockStartupConsistencyChecker();
  const repairService = createMockRepairService();
  const now = "2024-06-01T12:00:00.000Z";

  const worker = new WorkflowRepairWorker({
    checker,
    repairService,
    now: () => now,
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.workerId, "workflow-repair-worker");
  assert.equal(report.workerType, "workflow_repair");
  assert.equal(report.startedAt, now);
  assert.equal(report.itemsProcessed, 0);
  assert.equal(report.itemsRecovered, 0);
  assert.deepEqual(report.errors, []);
});

test("WorkflowRepairWorker runRecoveryCycle processes repair actions [workflow-repair-worker]", async () => {
  const checker = {
    run: () => ({
      status: "inconsistent" as const,
      findings: [{ type: "missing_checkpoint", targetId: "task_1" }],
      repairActions: [
        { action: "restore_checkpoint", targetId: "task_1", detail: "Restored checkpoint for task_1" },
      ],
      checkedAt: "2024-06-01T12:00:00.000Z",
    }),
  };
  const repairService = {
    apply: async (report: { repairActions: Array<{ action: string; targetId: string; detail: string }> }) =>
      report.repairActions.map((a) => ({ action: a.action, targetId: a.targetId, detail: a.detail, applied: true })),
  };
  const now = "2024-06-01T12:00:00.000Z";

  const worker = new WorkflowRepairWorker({
    checker,
    repairService: repairService as typeof createMockRepairService,
    now: () => now,
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.itemsProcessed, 1);
  assert.equal(report.itemsRecovered, 1);
  assert.equal(report.metadata.status, "inconsistent");
  assert.equal(report.metadata.findingCount, 1);
});

test("WorkflowRepairWorker runRecoveryCycle handles repair failures [workflow-repair-worker]", async () => {
  const checker = {
    run: () => ({
      status: "inconsistent" as const,
      findings: [{ type: "missing_checkpoint", targetId: "task_1" }],
      repairActions: [
        { action: "restore_checkpoint", targetId: "task_1", detail: "Failed to restore" },
      ],
      checkedAt: "2024-06-01T12:00:00.000Z",
    }),
  };
  const repairService = {
    apply: async (report: { repairActions: Array<{ action: string; targetId: string; detail: string }> }) =>
      report.repairActions.map((a) => ({ action: a.action, targetId: a.targetId, detail: a.detail, applied: false })),
  };
  const now = "2024-06-01T12:00:00.000Z";

  const worker = new WorkflowRepairWorker({
    checker: checker as typeof createMockStartupConsistencyChecker,
    repairService: repairService as typeof createMockRepairService,
    now: () => now,
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.itemsProcessed, 1);
  assert.equal(report.itemsRecovered, 0);
  assert.equal(report.errors.length, 1);
  assert.equal(report.errors[0]!.code, "workflow_repair.restore_checkpoint");
});

test("WorkflowRepairWorker runRecoveryCycle handles checker errors [workflow-repair-worker]", async () => {
  const checker = {
    run: () => {
      throw new Error("Checker failed");
    },
  };
  const repairService = createMockRepairService();
  const now = "2024-06-01T12:00:00.000Z";

  const worker = new WorkflowRepairWorker({
    checker: checker as typeof createMockStartupConsistencyChecker,
    repairService,
    now: () => now,
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.itemsProcessed, 0);
  assert.equal(report.itemsRecovered, 0);
  assert.equal(report.errors.length, 1);
  assert.equal(report.errors[0]!.code, "workflow_repair.cycle_failed");
  assert.equal(report.errors[0]!.message, "Checker failed");
});

test("WorkflowRepairWorker reports include completedAt and duration [workflow-repair-worker]", async () => {
  const checker = createMockStartupConsistencyChecker();
  const repairService = createMockRepairService();
  let callCount = 0;
  const now = () => {
    callCount++;
    return callCount === 1 ? "2024-06-01T12:00:00.000Z" : "2024-06-01T12:00:01.000Z";
  };

  const worker = new WorkflowRepairWorker({
    checker,
    repairService,
    now,
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.startedAt, "2024-06-01T12:00:00.000Z");
  assert.equal(report.completedAt, "2024-06-01T12:00:01.000Z");
  // durationMs is calculated using Date.now(), not the now() function
  // so we just verify it's a positive number
  assert.ok(report.durationMs >= 0);
});
