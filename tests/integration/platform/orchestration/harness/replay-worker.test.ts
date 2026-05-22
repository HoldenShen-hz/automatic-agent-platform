/**
 * Integration Tests: ReplayWorker
 *
 * Tests ReplayWorker with mock replay service and various replay scenarios.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { ReplayWorker, type ReplaySandboxPolicy } from "../../../../../src/platform/five-plane-execution/ha/replay-worker.js";
import type { RuntimeRecoveryReplayService } from "../../../../../src/platform/five-plane-execution/recovery/runtime-recovery-replay-service-root.js";
import type { TaskRecoveryReplayReport } from "../../../../../../src/platform/five-plane-execution/recovery/runtime-recovery-replay-service-root.js";

function createMockReplayService(fixtures: {
  reports?: Map<string, TaskRecoveryReplayReport>;
  shouldThrow?: boolean;
}): Pick<RuntimeRecoveryReplayService, "buildTaskReplayReport"> {
  return {
    buildTaskReplayReport: (taskId: string, _startedAt: string) => {
      if (fixtures.shouldThrow) {
        throw new Error("Simulated replay service error");
      }
      if (fixtures.reports?.has(taskId)) {
        return fixtures.reports.get(taskId)!;
      }
      return {
        generatedAt: new Date().toISOString(),
        taskId,
        divisionId: null,
        activeExecutionId: null,
        candidateCount: 0,
        requestedApprovalCount: 0,
        deadLetterCount: 0,
        recoveryEventCount: 0,
        outcome: "no_recovery_activity" as const,
        executions: [],
      };
    },
  };
}

test("ReplayWorker integration: runRecoveryCycle with multiple tasks", async () => {
  const worker = new ReplayWorker({
    replayService: createMockReplayService({}),
    listTaskIds: () => ["task-1", "task-2", "task-3"],
    cadence: { intervalMs: 300_000 },
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.workerId, "replay-worker");
  assert.equal(report.workerType, "replay");
  assert.equal(report.itemsProcessed, 3);
  assert.ok(report.durationMs >= 0);
  assert.deepEqual(report.errors, []);
});

test("ReplayWorker integration: async listTaskIds support", async () => {
  const worker = new ReplayWorker({
    replayService: createMockReplayService({}),
    listTaskIds: async () => {
      await new Promise((resolve) => setImmediate(resolve));
      return ["async-task-1", "async-task-2"];
    },
    cadence: { intervalMs: 300_000 },
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.itemsProcessed, 2);
  assert.deepEqual(report.metadata?.replayedTaskIds, ["async-task-1", "async-task-2"]);
});

test("ReplayWorker integration: trace_only mode blocks real side effects", async () => {
  assert.throws(
    () =>
      new ReplayWorker({
        replayService: createMockReplayService({}),
        listTaskIds: () => ["task-real-effect"],
        cadence: { intervalMs: 300_000 },
        replayPolicy: { mode: "trace_only", allowRealSideEffects: true },
      }),
    /allow real side effects/i,
  );
});

test("ReplayWorker integration: isolated_sandbox mode with valid sandboxId", async () => {
  const worker = new ReplayWorker({
    replayService: createMockReplayService({}),
    listTaskIds: () => ["task-sandbox"],
    cadence: { intervalMs: 300_000 },
    replayPolicy: { mode: "isolated_sandbox", sandboxId: "sandbox-abc-123", allowRealSideEffects: false },
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.itemsProcessed, 1);
  assert.equal(report.metadata?.replayPolicyMode, "isolated_sandbox");
  assert.equal(report.metadata?.replaySandboxId, "sandbox-abc-123");
});

test("ReplayWorker integration: isolated_sandbox without sandboxId fails", async () => {
  assert.throws(
    () =>
      new ReplayWorker({
        replayService: createMockReplayService({}),
        listTaskIds: () => ["task-sandbox"],
        cadence: { intervalMs: 300_000 },
        replayPolicy: { mode: "isolated_sandbox", sandboxId: "", allowRealSideEffects: false },
      }),
    /sandbox_id_required/i,
  );
});

test("ReplayWorker integration: replay service error handling", async () => {
  const worker = new ReplayWorker({
    replayService: createMockReplayService({ shouldThrow: true }),
    listTaskIds: () => ["task-error"],
    cadence: { intervalMs: 300_000 },
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.itemsProcessed, 0);
  assert.equal(report.itemsRecovered, 0);
  assert.ok(report.errors.length > 0);
  assert.equal(report.errors[0].code, "replay.cycle_failed");
});

test("ReplayWorker integration: custom worker ID", async () => {
  const worker = new ReplayWorker({
    replayService: createMockReplayService({}),
    listTaskIds: () => [],
    workerId: "custom-replay-worker-001",
    cadence: { intervalMs: 300_000 },
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.workerId, "custom-replay-worker-001");
});

test("ReplayWorker integration: custom now function", async () => {
  const fixedTime = "2024-06-15T14:30:00.000Z";
  const worker = new ReplayWorker({
    replayService: createMockReplayService({}),
    listTaskIds: () => [],
    cadence: { intervalMs: 300_000 },
    now: () => fixedTime,
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.startedAt, fixedTime);
  assert.equal(report.completedAt, fixedTime);
});

test("ReplayWorker integration: cadence respects custom interval", async () => {
  const worker = new ReplayWorker({
    replayService: createMockReplayService({}),
    listTaskIds: () => [],
    cadence: { intervalMs: 60000, maxConcurrent: 3, priority: "high" },
  });

  const cadence = worker.getRecoveryCadence();

  assert.equal(cadence.intervalMs, 60000);
  assert.equal(cadence.maxConcurrent, 3);
  assert.equal(cadence.priority, "high");
});

test("ReplayWorker integration: empty task list", async () => {
  const worker = new ReplayWorker({
    replayService: createMockReplayService({}),
    listTaskIds: () => [],
    cadence: { intervalMs: 300_000 },
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.itemsProcessed, 0);
  assert.equal(report.itemsRecovered, 0);
  assert.deepEqual(report.errors, []);
});

test("ReplayWorker integration: reports recoveryActiveCount from mock service", async () => {
  const reports = new Map<string, TaskRecoveryReplayReport>();
  reports.set("active-task", {
    generatedAt: new Date().toISOString(),
    taskId: "active-task",
    divisionId: null,
    activeExecutionId: "exec-1",
    candidateCount: 1,
    requestedApprovalCount: 0,
    deadLetterCount: 0,
    recoveryEventCount: 1,
    outcome: "active",
    executions: [],
  });
  reports.set("inactive-task", {
    generatedAt: new Date().toISOString(),
    taskId: "inactive-task",
    divisionId: null,
    activeExecutionId: null,
    candidateCount: 0,
    requestedApprovalCount: 0,
    deadLetterCount: 0,
    recoveryEventCount: 0,
    outcome: "no_recovery_activity",
    executions: [],
  });

  const worker = new ReplayWorker({
    replayService: createMockReplayService({ reports }),
    listTaskIds: () => ["active-task", "inactive-task"],
    cadence: { intervalMs: 300_000 },
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.itemsProcessed, 2);
  assert.equal(report.metadata?.recoveryActiveCount, 1);
});

test("ReplayWorker integration: getRecoveryCadence returns default values", () => {
  const worker = new ReplayWorker({
    replayService: createMockReplayService({}),
    listTaskIds: () => [],
    cadence: { intervalMs: 300_000 },
  });

  const cadence = worker.getRecoveryCadence();

  assert.equal(cadence.intervalMs, 300_000);
  assert.equal(cadence.maxConcurrent, 1);
  assert.equal(cadence.priority, "normal");
});

test("ReplayWorker integration: getWorkerId default", () => {
  const worker = new ReplayWorker({
    replayService: createMockReplayService({}),
    listTaskIds: () => [],
    cadence: { intervalMs: 300_000 },
  });

  assert.equal(worker.getWorkerId(), "replay-worker");
});

test("ReplayWorker integration: getWorkerId custom", () => {
  const worker = new ReplayWorker({
    replayService: createMockReplayService({}),
    listTaskIds: () => [],
    workerId: "my-custom-replay-worker",
    cadence: { intervalMs: 300_000 },
  });

  assert.equal(worker.getWorkerId(), "my-custom-replay-worker");
});

test("ReplayWorker integration: metadata includes replayPolicyMode", async () => {
  const worker = new ReplayWorker({
    replayService: createMockReplayService({}),
    listTaskIds: () => ["task-1"],
    cadence: { intervalMs: 300_000 },
    replayPolicy: { mode: "trace_only", allowRealSideEffects: false },
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.metadata?.replayPolicyMode, "trace_only");
});

test("ReplayWorker integration: metadata includes replayedTaskIds", async () => {
  const worker = new ReplayWorker({
    replayService: createMockReplayService({}),
    listTaskIds: () => ["task-A", "task-B", "task-C"],
    cadence: { intervalMs: 300_000 },
  });

  const report = await worker.runRecoveryCycle();

  assert.deepEqual(report.metadata?.replayedTaskIds, ["task-A", "task-B", "task-C"]);
});
