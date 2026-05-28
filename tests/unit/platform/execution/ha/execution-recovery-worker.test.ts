import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionRecoveryWorker } from "../../../../../src/platform/five-plane-execution/ha/execution-recovery-worker.js";

test("ExecutionRecoveryWorker.getWorkerId returns default worker id [execution-recovery-worker]", () => {
  const worker = new ExecutionRecoveryWorker({
    recoveryService: {
      listRecoverableExecutingRuns: () => [],
      listStaleRuns: () => [],
      listBlockedRunsAwaitingApproval: () => [],
      applyRecoveryDecision: async () => undefined,
    },
  });

  assert.equal(worker.getWorkerId(), "execution-recovery-worker");
});

test("ExecutionRecoveryWorker.getWorkerId returns custom worker id [execution-recovery-worker]", () => {
  const worker = new ExecutionRecoveryWorker({
    recoveryService: {
      listRecoverableExecutingRuns: () => [],
      listStaleRuns: () => [],
      listBlockedRunsAwaitingApproval: () => [],
      applyRecoveryDecision: async () => undefined,
    },
    workerId: "custom-recovery-worker",
  });

  assert.equal(worker.getWorkerId(), "custom-recovery-worker");
});

test("ExecutionRecoveryWorker.getRecoveryCadence returns configured cadence [execution-recovery-worker]", () => {
  const worker = new ExecutionRecoveryWorker({
    recoveryService: {
      listRecoverableExecutingRuns: () => [],
      listStaleRuns: () => [],
      listBlockedRunsAwaitingApproval: () => [],
      applyRecoveryDecision: async () => undefined,
    },
    cadence: {
      intervalMs: 30_000,
      maxConcurrent: 2,
      priority: "normal" as const,
    },
  });

  const cadence = worker.getRecoveryCadence();
  assert.equal(cadence.intervalMs, 30_000);
  assert.equal(cadence.maxConcurrent, 2);
  assert.equal(cadence.priority, "normal");
});

test("ExecutionRecoveryWorker.runRecoveryCycle processes all candidate types [execution-recovery-worker]", async () => {
  const appliedExecutionIds: string[] = [];
  const worker = new ExecutionRecoveryWorker({
    recoveryService: {
      listRecoverableExecutingRuns: (startedAt: string) => [
        { executionId: "exec-active-1", suggestedAction: "resume_same_worker" },
        { executionId: "exec-active-2", suggestedAction: "retry_new_ticket" },
      ],
      listStaleRuns: (staleBefore: string) => [
        { executionId: "exec-stale-1", suggestedAction: "escalate_takeover" },
      ],
      listBlockedRunsAwaitingApproval: () => [
        { executionId: "exec-blocked-1", suggestedAction: "none" },
      ],
      applyRecoveryDecision: async (executionId: string) => {
        appliedExecutionIds.push(executionId);
      },
    },
    now: () => "2026-04-14T10:00:00.000Z",
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.workerType, "execution_recovery");
  assert.equal(report.itemsProcessed, 4); // 2 active + 1 stale + 1 blocked
  assert.equal(report.itemsRecovered, 2); // 2 actionable (resume_same_worker + retry_new_ticket)
  assert.equal(report.errors.length, 0);
  assert.equal(report.metadata.activeCandidateCount, 2);
  assert.equal(report.metadata.staleCandidateCount, 1);
  assert.equal(report.metadata.blockedCandidateCount, 1);
  assert.deepEqual(appliedExecutionIds, ["exec-active-1", "exec-active-2"]);
});

test("ExecutionRecoveryWorker.runRecoveryCycle with no candidates [execution-recovery-worker]", async () => {
  const worker = new ExecutionRecoveryWorker({
    recoveryService: {
      listRecoverableExecutingRuns: () => [],
      listStaleRuns: () => [],
      listBlockedRunsAwaitingApproval: () => [],
      applyRecoveryDecision: async () => undefined,
    },
    now: () => "2026-04-14T10:00:00.000Z",
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.workerType, "execution_recovery");
  assert.equal(report.itemsProcessed, 0);
  assert.equal(report.itemsRecovered, 0);
  assert.equal(report.errors.length, 0);
});

test("ExecutionRecoveryWorker.runRecoveryCycle handles errors gracefully [execution-recovery-worker]", async () => {
  const worker = new ExecutionRecoveryWorker({
    recoveryService: {
      listRecoverableExecutingRuns: () => {
        throw new Error("Database connection failed");
      },
      listStaleRuns: () => {
        throw new Error("Database connection failed");
      },
      listBlockedRunsAwaitingApproval: () => {
        throw new Error("Database connection failed");
      },
      applyRecoveryDecision: async () => undefined,
    },
    now: () => "2026-04-14T10:00:00.000Z",
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.workerType, "execution_recovery");
  assert.equal(report.itemsProcessed, 0);
  assert.equal(report.itemsRecovered, 0);
  assert.equal(report.errors.length, 1);
  assert.equal(report.errors[0]!.code, "execution_recovery.cycle_failed");
});

test("ExecutionRecoveryWorker.runRecoveryCycle calculates stale threshold correctly [execution-recovery-worker]", async () => {
  let capturedStartedAt: string | null = null;
  let capturedStaleBefore: string | null = null;
  const worker = new ExecutionRecoveryWorker({
    recoveryService: {
      listRecoverableExecutingRuns: (startedAt: string) => {
        capturedStartedAt = startedAt;
        return [];
      },
      listStaleRuns: (staleBefore: string) => {
        capturedStaleBefore = staleBefore;
        return [];
      },
      listBlockedRunsAwaitingApproval: () => [],
      applyRecoveryDecision: async () => undefined,
    },
    staleThresholdMs: 60000, // 1 minute
    now: () => "2026-04-14T10:00:00.000Z",
  });

  await worker.runRecoveryCycle();
  assert.equal(capturedStartedAt, "2026-04-14T10:00:00.000Z");
  assert.equal(capturedStaleBefore, "2026-04-14T09:59:00.000Z");
});

test("ExecutionRecoveryWorker.runRecoveryCycle with custom stale threshold [execution-recovery-worker]", async () => {
  const worker = new ExecutionRecoveryWorker({
    recoveryService: {
      listRecoverableExecutingRuns: (startedAt: string, tenantId: string | null | undefined) => {
        // Should receive the correct stale threshold
        return [];
      },
      listStaleRuns: (staleBefore: string, tenantId: string | null | undefined) => {
        // staleBefore should be startedAt - 5 minutes (default 5 min threshold)
        return [];
      },
      listBlockedRunsAwaitingApproval: () => [],
      applyRecoveryDecision: async () => undefined,
    },
    staleThresholdMs: 5 * 60 * 1000, // 5 minutes
    now: () => "2026-04-14T10:00:00.000Z",
  });

  const report = await worker.runRecoveryCycle();
  assert.equal(report.itemsProcessed, 0);
});

test("ExecutionRecoveryWorker.runRecoveryCycle counts actionable items correctly [execution-recovery-worker]", async () => {
  const appliedExecutionIds: string[] = [];
  const worker = new ExecutionRecoveryWorker({
    recoveryService: {
      listRecoverableExecutingRuns: (startedAt: string) => [
        { executionId: "exec-1", suggestedAction: "resume_same_worker" },
        { executionId: "exec-2", suggestedAction: "retry_new_ticket" },
        { executionId: "exec-3", suggestedAction: "escalate_takeover" }, // not actionable
      ],
      listStaleRuns: (staleBefore: string) => [
        { executionId: "exec-1", suggestedAction: "resume_same_worker" }, // deduped actionable
        { executionId: "exec-4", suggestedAction: "none" }, // not actionable
      ],
      listBlockedRunsAwaitingApproval: () => [
        { executionId: "exec-5", suggestedAction: "none" }, // not actionable
      ],
      applyRecoveryDecision: async (executionId: string) => {
        appliedExecutionIds.push(executionId);
      },
    },
    now: () => "2026-04-14T10:00:00.000Z",
  });

  const report = await worker.runRecoveryCycle();

  // Items processed: 3 active + 2 stale + 1 blocked = 6
  assert.equal(report.itemsProcessed, 6);
  // Items recovered: only resume_same_worker and retry_new_ticket = 2
  assert.equal(report.itemsRecovered, 2);
  assert.deepEqual(appliedExecutionIds, ["exec-1", "exec-2"]);
});

test("ExecutionRecoveryWorker.runRecoveryCycle reports missing applier for actionable candidates [execution-recovery-worker]", async () => {
  const worker = new ExecutionRecoveryWorker({
    recoveryService: {
      listRecoverableExecutingRuns: () => [
        { executionId: "exec-actionable", suggestedAction: "resume_same_worker" },
      ],
      listStaleRuns: () => [],
      listBlockedRunsAwaitingApproval: () => [],
    },
    now: () => "2026-04-14T10:00:00.000Z",
  });

  const report = await worker.runRecoveryCycle();

  assert.equal(report.itemsRecovered, 0);
  assert.equal(report.errors[0]?.code, "execution_recovery.applier_unavailable");
});
