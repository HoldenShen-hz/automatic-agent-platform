import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionRecoveryWorker } from "../../../../../src/platform/five-plane-execution/ha/execution-recovery-worker.js";
import type { RuntimeRecoveryCandidate } from "../../../../../src/platform/five-plane-execution/recovery/runtime-recovery-service.js";

function createCandidate(overrides: Partial<RuntimeRecoveryCandidate> = {}): RuntimeRecoveryCandidate {
  return {
    executionId: "execution-1",
    taskId: "task-1",
    divisionId: "division-1",
    taskStatus: "in_progress",
    status: "executing",
    attempt: 1,
    traceId: "trace-1",
    workflowId: null,
    latestErrorCode: null,
    updatedAt: "2026-05-24T00:00:00.000Z",
    lastHeartbeatAt: null,
    pendingApprovalId: null,
    latestPrecheck: null,
    reason: "stale heartbeat",
    suggestedAction: "resume_same_worker",
    ...overrides,
  };
}

function createRecoveryService(overrides: Partial<{
  listBlockedRunsAwaitingApproval: () => RuntimeRecoveryCandidate[];
  listRecoverableExecutingRuns: () => RuntimeRecoveryCandidate[];
  listStaleRuns: () => RuntimeRecoveryCandidate[];
  applyRecoveryDecision: (executionId: string, decidedBy?: string) => Promise<unknown>;
}> = {}) {
  return {
    listBlockedRunsAwaitingApproval: () => [],
    listRecoverableExecutingRuns: () => [],
    listStaleRuns: () => [],
    applyRecoveryDecision: async () => undefined,
    ...overrides,
  };
}

test("ExecutionRecoveryWorker exposes default worker identity and normalized cadence", () => {
  const worker = new ExecutionRecoveryWorker({
    recoveryService: createRecoveryService(),
  });

  const cadence = worker.getRecoveryCadence();
  assert.equal(worker.getWorkerId(), "execution-recovery-worker");
  assert.equal(cadence.priority, "high");
  assert.equal(cadence.maxConcurrent, 1);
});

test("ExecutionRecoveryWorker auto-recovers actionable candidates and deduplicates execution ids", async () => {
  const applied: string[] = [];
  const candidate = createCandidate();
  const worker = new ExecutionRecoveryWorker({
    recoveryService: createRecoveryService({
      listRecoverableExecutingRuns: () => [candidate],
      listStaleRuns: () => [candidate],
      listBlockedRunsAwaitingApproval: () => [createCandidate({ executionId: "blocked-1", pendingApprovalId: "approval-1", suggestedAction: "escalate_takeover" })],
      applyRecoveryDecision: async (executionId) => {
        applied.push(executionId);
      },
    }),
    now: () => "2026-05-24T00:05:00.000Z",
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.workerType, "execution_recovery");
  assert.equal(report.itemsProcessed, 3);
  assert.equal(report.itemsRecovered, 1);
  assert.deepEqual(applied, ["execution-1"]);
});

test("ExecutionRecoveryWorker ignores non-automatic recovery actions", async () => {
  const worker = new ExecutionRecoveryWorker({
    recoveryService: createRecoveryService({
      listRecoverableExecutingRuns: () => [createCandidate({ executionId: "execution-manual", suggestedAction: "escalate_takeover" })],
    }),
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.itemsProcessed, 1);
  assert.equal(report.itemsRecovered, 0);
});

test("ExecutionRecoveryWorker records apply failures without aborting the cycle", async () => {
  const worker = new ExecutionRecoveryWorker({
    recoveryService: createRecoveryService({
      listRecoverableExecutingRuns: () => [createCandidate({ executionId: "execution-error" })],
      applyRecoveryDecision: async () => {
        throw new Error("apply failed");
      },
    }),
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.itemsRecovered, 0);
  assert.ok(report.errors.some((error) => error.code === "execution_recovery.apply_failed"));
});

test("ExecutionRecoveryWorker converts recovery service failures into a cycle report", async () => {
  const worker = new ExecutionRecoveryWorker({
    recoveryService: createRecoveryService({
      listRecoverableExecutingRuns: () => {
        throw new Error("service unavailable");
      },
    }),
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.itemsProcessed, 0);
  assert.ok(report.errors[0]?.message.includes("service unavailable"));
});
