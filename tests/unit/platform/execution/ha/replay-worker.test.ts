import test from "node:test";
import assert from "node:assert/strict";

import { ReplayWorker, type ReplayWorkerOptions } from "../../../../../src/platform/five-plane-execution/ha/replay-worker.js";

function createMockReplayService() {
  return {
    buildTaskReplayReport: (taskId: string, startedAt: string) => ({
      taskId,
      outcome: "no_recovery_activity" as const,
      eventsReplayed: 0,
      checkpointsRestored: 0,
    }),
  };
}

test("ReplayWorker returns correct workerId", () => {
  const worker = new ReplayWorker({
    replayService: createMockReplayService(),
    workerId: "test-replay-worker",
    listTaskIds: () => [],
  });

  assert.equal(worker.getWorkerId(), "test-replay-worker");
});

test("ReplayWorker returns default workerId when not provided", () => {
  const worker = new ReplayWorker({
    replayService: createMockReplayService(),
    listTaskIds: () => [],
  });

  assert.equal(worker.getWorkerId(), "replay-worker");
});

test("ReplayWorker returns recovery cadence", () => {
  const worker = new ReplayWorker({
    replayService: createMockReplayService(),
    listTaskIds: () => [],
    cadence: { intervalMs: 60_000, maxConcurrent: 4, priority: "high" },
  });

  const cadence = worker.getRecoveryCadence();

  assert.equal(cadence.intervalMs, 60_000);
  assert.equal(cadence.maxConcurrent, 4);
  assert.equal(cadence.priority, "high");
});

test("ReplayWorker uses default cadence when not provided", () => {
  const worker = new ReplayWorker({
    replayService: createMockReplayService(),
    listTaskIds: () => [],
  });

  const cadence = worker.getRecoveryCadence();

  assert.equal(cadence.intervalMs, 300_000);
  assert.equal(cadence.maxConcurrent, 1);
  assert.equal(cadence.priority, "normal");
});

test("ReplayWorker runRecoveryCycle returns successful report with no tasks", async () => {
  const worker = new ReplayWorker({
    replayService: createMockReplayService(),
    listTaskIds: () => [],
    now: () => "2024-06-01T12:00:00.000Z",
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.workerId, "replay-worker");
  assert.equal(report.workerType, "replay");
  assert.equal(report.itemsProcessed, 0);
  assert.equal(report.itemsRecovered, 0);
  assert.deepEqual(report.errors, []);
});

test("ReplayWorker runRecoveryCycle processes task ids from listTaskIds", async () => {
  const replayService = {
    buildTaskReplayReport: (taskId: string, startedAt: string) => ({
      taskId,
      outcome: "no_recovery_activity" as const,
      eventsReplayed: 0,
      checkpointsRestored: 0,
    }),
  };
  const now = "2024-06-01T12:00:00.000Z";

  const worker = new ReplayWorker({
    replayService,
    listTaskIds: () => ["task_1", "task_2", "task_3"],
    now: () => now,
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.itemsProcessed, 3);
  assert.equal(report.itemsRecovered, 0);
  assert.deepEqual(report.metadata.replayedTaskIds, ["task_1", "task_2", "task_3"]);
});

test("ReplayWorker runRecoveryCycle counts recovery_active outcomes", async () => {
  const replayService = {
    buildTaskReplayReport: (taskId: string, startedAt: string) => {
      if (taskId === "task_1") {
        return { taskId, outcome: "replayed" as const, eventsReplayed: 5, checkpointsRestored: 1 };
      }
      if (taskId === "task_2") {
        return { taskId, outcome: "no_recovery_activity" as const, eventsReplayed: 0, checkpointsRestored: 0 };
      }
      return { taskId, outcome: "checkpoint_restored" as const, eventsReplayed: 0, checkpointsRestored: 2 };
    },
  };
  const now = "2024-06-01T12:00:00.000Z";

  const worker = new ReplayWorker({
    replayService,
    listTaskIds: () => ["task_1", "task_2", "task_3"],
    now: () => now,
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.itemsProcessed, 3);
  assert.equal(report.itemsRecovered, 2); // task_1 and task_3 have recovery activity
  assert.equal(report.metadata.recoveryActiveCount, 2);
});

test("ReplayWorker runRecoveryCycle handles async listTaskIds", async () => {
  const worker = new ReplayWorker({
    replayService: createMockReplayService(),
    listTaskIds: async () => ["task_async_1", "task_async_2"],
    now: () => "2024-06-01T12:00:00.000Z",
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.itemsProcessed, 2);
});

test("ReplayWorker runRecoveryCycle handles replay service errors", async () => {
  const replayService = {
    buildTaskReplayReport: (taskId: string, startedAt: string) => {
      throw new Error("Replay service unavailable");
    },
  };
  const now = "2024-06-01T12:00:00.000Z";

  const worker = new ReplayWorker({
    replayService,
    listTaskIds: () => ["task_1"],
    now: () => now,
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.itemsProcessed, 0);
  assert.equal(report.itemsRecovered, 0);
  assert.equal(report.errors.length, 1);
  assert.equal(report.errors[0]!.code, "replay.cycle_failed");
  assert.equal(report.errors[0]!.message, "Replay service unavailable");
});

test("ReplayWorker reports include timing information", async () => {
  const replayService = createMockReplayService();
  let callCount = 0;
  const now = () => {
    callCount++;
    return callCount === 1 ? "2024-06-01T12:00:00.000Z" : "2024-06-01T12:00:02.000Z";
  };

  const worker = new ReplayWorker({
    replayService,
    listTaskIds: () => ["task_1"],
    now,
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.startedAt, "2024-06-01T12:00:00.000Z");
  assert.equal(report.completedAt, "2024-06-01T12:00:02.000Z");
  // durationMs is calculated using Date.now(), not the now() function
  // so we just verify it's a non-negative number
  assert.ok(report.durationMs >= 0);
});

test("ReplayWorker rejects replay policies that allow real side effects", async () => {
  assert.throws(
    () =>
      new ReplayWorker({
        replayService: createMockReplayService(),
        listTaskIds: () => ["task_1"],
        replayPolicy: {
          mode: "trace_only",
          allowRealSideEffects: true,
        },
      }),
    /allow real side effects/,
  );
});

test("ReplayWorker requires sandboxId for isolated sandbox replay", async () => {
  assert.throws(
    () =>
      new ReplayWorker({
        replayService: createMockReplayService(),
        listTaskIds: () => ["task_1"],
        replayPolicy: {
          mode: "isolated_sandbox",
          allowRealSideEffects: false,
        },
      }),
    /requires sandboxId/,
  );
});

test("ReplayWorker records isolated sandbox replay metadata when explicitly allowed", async () => {
  const worker = new ReplayWorker({
    replayService: createMockReplayService(),
    listTaskIds: () => ["task_1"],
    replayPolicy: {
      mode: "isolated_sandbox",
      sandboxId: "replay-sandbox-1",
      allowRealSideEffects: false,
    },
  });

  const report = await worker.runRecoveryCycle();
  assert.equal(report.metadata.replayPolicyMode, "isolated_sandbox");
  assert.equal(report.metadata.replaySandboxId, "replay-sandbox-1");
});
