import test from "node:test";
import assert from "node:assert/strict";
import { ReplayWorker, type ReplaySandboxPolicy } from "../../../../../src/platform/five-plane-execution/ha/replay-worker.js";
import { ReplayBoundaryGuard } from "../../../../../src/platform/five-plane-execution/recovery/replay-boundary-guard.js";
import type { RuntimeRecoveryReplayService } from "../../../../../src/platform/five-plane-execution/recovery/runtime-recovery-replay-service-root.js";

// Mock RuntimeRecoveryReplayService for testing
function createMockReplayService(): Pick<RuntimeRecoveryReplayService, "buildTaskReplayReport"> {
  return {
    buildTaskReplayReport: (_taskId: string, _startedAt: string) => ({
      generatedAt: new Date().toISOString(),
      taskId: _taskId,
      divisionId: null,
      activeExecutionId: null,
      candidateCount: 0,
      requestedApprovalCount: 0,
      deadLetterCount: 0,
      recoveryEventCount: 0,
      outcome: "no_recovery_activity" as const,
      executions: [],
    }),
  };
}

test("ReplayWorker.getWorkerId returns configured worker ID", () => {
  const worker = new ReplayWorker({
    replayService: createMockReplayService(),
    listTaskIds: () => [],
    workerId: "test-replay-worker-001",
    cadence: { intervalMs: 300_000 },
  });

  assert.equal(worker.getWorkerId(), "test-replay-worker-001");
});

test("ReplayWorker.getWorkerId returns default worker ID when not configured", () => {
  const worker = new ReplayWorker({
    replayService: createMockReplayService(),
    listTaskIds: () => [],
    cadence: { intervalMs: 300_000 },
  });

  assert.equal(worker.getWorkerId(), "replay-worker");
});

test("ReplayWorker.getRecoveryCadence returns configured cadence", () => {
  const worker = new ReplayWorker({
    replayService: createMockReplayService(),
    listTaskIds: () => [],
    cadence: { intervalMs: 60_000, maxConcurrent: 5, priority: "high" },
  });

  const cadence = worker.getRecoveryCadence();
  assert.equal(cadence.intervalMs, 60_000);
  assert.equal(cadence.maxConcurrent, 5);
  assert.equal(cadence.priority, "high");
});

test("ReplayWorker.getRecoveryCadence uses default maxConcurrent of 1", () => {
  const worker = new ReplayWorker({
    replayService: createMockReplayService(),
    listTaskIds: () => [],
    cadence: { intervalMs: 300_000 },
  });

  const cadence = worker.getRecoveryCadence();
  assert.equal(cadence.maxConcurrent, 1);
});

test("ReplayWorker.getRecoveryCadence uses default priority of normal", () => {
  const worker = new ReplayWorker({
    replayService: createMockReplayService(),
    listTaskIds: () => [],
    cadence: { intervalMs: 300_000 },
  });

  const cadence = worker.getRecoveryCadence();
  assert.equal(cadence.priority, "normal");
});

test("ReplayWorker.runRecoveryCycle processes empty task list", async () => {
  const worker = new ReplayWorker({
    replayService: createMockReplayService(),
    listTaskIds: () => [],
    cadence: { intervalMs: 300_000 },
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.workerId, "replay-worker");
  assert.equal(report.workerType, "replay");
  assert.equal(report.itemsProcessed, 0);
  assert.equal(report.itemsRecovered, 0);
  assert.deepEqual(report.errors, []);
});

test("ReplayWorker.runRecoveryCycle processes task list", async () => {
  const worker = new ReplayWorker({
    replayService: createMockReplayService(),
    listTaskIds: () => ["task-1", "task-2", "task-3"],
    cadence: { intervalMs: 300_000 },
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.itemsProcessed, 3);
  assert.ok(report.durationMs >= 0);
  assert.deepEqual(report.errors, []);
});

test("ReplayWorker.runRecoveryCycle supports async listTaskIds", async () => {
  const worker = new ReplayWorker({
    replayService: createMockReplayService(),
    listTaskIds: async () => {
      await new Promise((resolve) => setImmediate(resolve));
      return ["task-async-1", "task-async-2"];
    },
    cadence: { intervalMs: 300_000 },
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.itemsProcessed, 2);
});

test("ReplayWorker.runRecoveryCycle respects trace_only mode (default)", async () => {
  const worker = new ReplayWorker({
    replayService: createMockReplayService(),
    listTaskIds: () => ["task-1"],
    cadence: { intervalMs: 300_000 },
    replayPolicy: { mode: "trace_only", allowRealSideEffects: false },
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.itemsProcessed, 1);
  assert.equal(report.metadata?.replayPolicyMode, "trace_only");
});

test("ReplayWorker.runRecoveryCycle respects isolated_sandbox mode", async () => {
  const worker = new ReplayWorker({
    replayService: createMockReplayService(),
    listTaskIds: () => ["task-1"],
    cadence: { intervalMs: 300_000 },
    replayPolicy: { mode: "isolated_sandbox", sandboxId: "sandbox-123", allowRealSideEffects: false },
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.itemsProcessed, 1);
  assert.equal(report.metadata?.replayPolicyMode, "isolated_sandbox");
  assert.equal(report.metadata?.replaySandboxId, "sandbox-123");
});

test("ReplayWorker.runRecoveryCycle blocks real side effects in trace_only mode", async () => {
  const worker = new ReplayWorker({
    replayService: createMockReplayService(),
    listTaskIds: () => ["task-1"],
    cadence: { intervalMs: 300_000 },
    replayPolicy: { mode: "trace_only", allowRealSideEffects: true }, // Should be blocked
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.itemsProcessed, 0);
  assert.ok(report.errors.length > 0);
  assert.ok(report.errors[0].code.includes("real_side_effect"));
});

test("ReplayWorker.runRecoveryCycle requires sandboxId for isolated_sandbox mode", async () => {
  const worker = new ReplayWorker({
    replayService: createMockReplayService(),
    listTaskIds: () => ["task-1"],
    cadence: { intervalMs: 300_000 },
    replayPolicy: { mode: "isolated_sandbox", sandboxId: "", allowRealSideEffects: false },
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.itemsProcessed, 0);
  assert.ok(report.errors.length > 0);
});

test("ReplayWorker rejects replay policy with allowRealSideEffects true", () => {
  assert.throws(
    () =>
      new ReplayWorker({
        replayService: createMockReplayService(),
        listTaskIds: () => [],
        cadence: { intervalMs: 300_000 },
        replayPolicy: { mode: "trace_only", allowRealSideEffects: true },
      }),
    /replay.*real.*side.*effects/,
  );
});

test("ReplayWorker rejects isolated_sandbox without sandboxId", () => {
  assert.throws(
    () =>
      new ReplayWorker({
        replayService: createMockReplayService(),
        listTaskIds: () => [],
        cadence: { intervalMs: 300_000 },
        replayPolicy: { mode: "isolated_sandbox", allowRealSideEffects: false },
      }),
    /sandboxId/,
  );
});

test("ReplayWorker.runRecoveryCycle records replayedTaskIds in metadata", async () => {
  const worker = new ReplayWorker({
    replayService: createMockReplayService(),
    listTaskIds: () => ["task-A", "task-B"],
    cadence: { intervalMs: 300_000 },
  });

  const report = await worker.runRecoveryCycle();

  assert.deepEqual(report.metadata?.replayedTaskIds, ["task-A", "task-B"]);
});

test("ReplayWorker.runRecoveryCycle reports recoveryActiveCount in metadata", async () => {
  const mockService = {
    buildTaskReplayReport: (taskId: string) => ({
      generatedAt: new Date().toISOString(),
      taskId,
      divisionId: null,
      activeExecutionId: taskId === "task-active" ? "exec-1" : null,
      candidateCount: taskId === "task-active" ? 1 : 0,
      requestedApprovalCount: 0,
      deadLetterCount: 0,
      recoveryEventCount: 0,
      outcome: taskId === "task-active" ? "active" : "no_recovery_activity" as const,
      executions: [],
    }),
  };

  const worker = new ReplayWorker({
    replayService: mockService,
    listTaskIds: () => ["task-active", "task-inactive"],
    cadence: { intervalMs: 300_000 },
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.metadata?.recoveryActiveCount, 1);
});

test("ReplayWorker.runRecoveryCycle handles replay service errors", async () => {
  const failingService = {
    buildTaskReplayReport: (_taskId: string) => {
      throw new Error("Simulated replay service failure");
    },
  };

  const worker = new ReplayWorker({
    replayService: failingService,
    listTaskIds: () => ["task-1"],
    cadence: { intervalMs: 300_000 },
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.itemsProcessed, 0);
  assert.equal(report.itemsRecovered, 0);
  assert.ok(report.errors.length > 0);
  assert.ok(report.errors[0].message.includes("Simulated replay service failure"));
});

test("ReplayWorker uses custom now function for timestamps", async () => {
  const fixedTime = "2024-01-15T12:00:00.000Z";
  const worker = new ReplayWorker({
    replayService: createMockReplayService(),
    listTaskIds: () => [],
    cadence: { intervalMs: 300_000 },
    now: () => fixedTime,
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.startedAt, fixedTime);
  assert.equal(report.completedAt, fixedTime);
});

test("ReplayWorker handles boundary guard blocking operations", async () => {
  const mockService = {
    buildTaskReplayReport: (taskId: string) => ({
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
    }),
  };

  // The worker should block trace_replay with allowRealSideEffects
  const worker = new ReplayWorker({
    replayService: mockService,
    listTaskIds: () => ["task-1"],
    cadence: { intervalMs: 300_000 },
    replayPolicy: { mode: "trace_only", allowRealSideEffects: false },
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.itemsProcessed, 1);
  assert.equal(report.errors.length, 0);
});

test("ReplayBoundaryGuard.evaluate blocks real side effects in trace_replay mode", () => {
  const guard = new ReplayBoundaryGuard();

  const decision = guard.evaluate("trace_replay", [
    { operationId: "op-1", resourceKind: "tool", hasRealSideEffect: true, tombstoneReplay: false },
  ]);

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "replay.real_side_effect_blocked");
  assert.deepEqual(decision.blockedOperationIds, ["op-1"]);
});

test("ReplayBoundaryGuard.evaluate allows operations without real side effects in trace_replay", () => {
  const guard = new ReplayBoundaryGuard();

  const decision = guard.evaluate("trace_replay", [
    { operationId: "op-1", resourceKind: "tool", hasRealSideEffect: false, tombstoneReplay: false },
  ]);

  assert.equal(decision.allowed, true);
  assert.deepEqual(decision.blockedOperationIds, []);
});

test("ReplayBoundaryGuard.evaluate blocks tombstone violations on non-projection in reexecution_replay", () => {
  const guard = new ReplayBoundaryGuard();

  const decision = guard.evaluate("reexecution_replay", [
    { operationId: "op-1", resourceKind: "tool", hasRealSideEffect: false, tombstoneReplay: true },
  ]);

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "replay.tombstone_boundary_violation");
});

test("ReplayBoundaryGuard.evaluate allows tombstone on projection in reexecution_replay", () => {
  const guard = new ReplayBoundaryGuard();

  const decision = guard.evaluate("reexecution_replay", [
    { operationId: "op-1", resourceKind: "projection", hasRealSideEffect: false, tombstoneReplay: true },
  ]);

  assert.equal(decision.allowed, true);
});

test("ReplayBoundaryGuard.evaluate allows real side effects in reexecution_replay", () => {
  const guard = new ReplayBoundaryGuard();

  const decision = guard.evaluate("reexecution_replay", [
    { operationId: "op-1", resourceKind: "tool", hasRealSideEffect: true, tombstoneReplay: false },
  ]);

  assert.equal(decision.allowed, true);
});

test("ReplayBoundaryGuard.evaluate blocks non-projection real side effects in projection_replay", () => {
  const guard = new ReplayBoundaryGuard();

  const decision = guard.evaluate("projection_replay", [
    { operationId: "op-1", resourceKind: "tool", hasRealSideEffect: true, tombstoneReplay: false },
  ]);

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "replay.real_side_effect_blocked");
});

test("ReplayBoundaryGuard.evaluate allows projection real side effects in projection_replay", () => {
  const guard = new ReplayBoundaryGuard();

  const decision = guard.evaluate("projection_replay", [
    { operationId: "op-1", resourceKind: "projection", hasRealSideEffect: true, tombstoneReplay: false },
  ]);

  assert.equal(decision.allowed, true);
});

test("ReplayBoundaryGuard.evaluate handles multiple operations", () => {
  const guard = new ReplayBoundaryGuard();

  const decision = guard.evaluate("trace_replay", [
    { operationId: "op-1", resourceKind: "tool", hasRealSideEffect: true, tombstoneReplay: false },
    { operationId: "op-2", resourceKind: "llm", hasRealSideEffect: false, tombstoneReplay: false },
    { operationId: "op-3", resourceKind: "tool", hasRealSideEffect: true, tombstoneReplay: false },
  ]);

  assert.equal(decision.allowed, false);
  assert.deepEqual(decision.blockedOperationIds, ["op-1", "op-3"]);
});