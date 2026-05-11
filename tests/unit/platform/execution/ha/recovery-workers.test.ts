import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionRecoveryWorker } from "../../../../../src/platform/execution/ha/execution-recovery-worker.js";
import { ProjectionRebuildWorker } from "../../../../../src/platform/execution/ha/projection-rebuild-worker.js";
import { ReplayWorker } from "../../../../../src/platform/execution/ha/replay-worker.js";
import { WorkflowRepairWorker } from "../../../../../src/platform/execution/ha/workflow-repair-worker.js";

test("ExecutionRecoveryWorker summarizes active, stale, and blocked candidates", async () => {
  const appliedExecutionIds: string[] = [];
  const worker = new ExecutionRecoveryWorker({
    recoveryService: {
      listRecoverableExecutingRuns: () => [
        { executionId: "exec-1", suggestedAction: "resume_same_worker" },
        { executionId: "exec-2", suggestedAction: "retry_new_ticket" },
        { executionId: "exec-3", suggestedAction: "escalate_takeover" },
      ],
      listStaleRuns: () => [{ executionId: "exec-1", suggestedAction: "resume_same_worker" }, {}],
      listBlockedRunsAwaitingApproval: () => [{}],
      applyRecoveryDecision: async (executionId: string) => {
        appliedExecutionIds.push(executionId);
      },
    } as never,
    now: () => "2026-04-25T00:00:00.000Z",
    staleThresholdMs: 60_000,
  });

  const report = await worker.runRecoveryCycle();
  assert.equal(report.workerType, "execution_recovery");
  assert.equal(report.itemsProcessed, 6);
  assert.equal(report.itemsRecovered, 2);
  assert.deepEqual(appliedExecutionIds, ["exec-1", "exec-2"]);
});

test("WorkflowRepairWorker applies startup repairs through repair service", async () => {
  const worker = new WorkflowRepairWorker({
    checker: {
      run: () => ({
        checkedAt: "2026-04-25T00:00:00.000Z",
        status: "repairable",
        findings: [{ code: "stale_execution" }],
        repairActions: [{ action: "requeue_execution", targetId: "exec-1", reasonCode: "stale_execution", targetType: "execution" }],
      }),
    } as never,
    repairService: {
      apply: async () => [{ action: "requeue_execution", targetId: "exec-1", applied: true, detail: "execution requeued" }],
    } as never,
    now: () => "2026-04-25T00:00:00.000Z",
  });

  const report = await worker.runRecoveryCycle();
  assert.equal(report.itemsProcessed, 1);
  assert.equal(report.itemsRecovered, 1);
});

test("ProjectionRebuildWorker aggregates projection rebuild results", async () => {
  const worker = new ProjectionRebuildWorker({
    projectionRebuildService: {
      rebuildAll: () => new Map([
        ["task_summary", { eventsProcessed: 2, projectionsUpdated: 1, eventsSkipped: 0, durationMs: 1, errors: [] }],
        ["workflow_summary", { eventsProcessed: 3, projectionsUpdated: 2, eventsSkipped: 0, durationMs: 1, errors: ["bad event"] }],
      ]),
    } as never,
    now: () => "2026-04-25T00:00:00.000Z",
  });

  const report = await worker.runRecoveryCycle();
  assert.equal(report.itemsProcessed, 5);
  assert.equal(report.itemsRecovered, 3);
  assert.equal(report.errors.length, 1);
});

test("ReplayWorker builds replay reports for known tasks", async () => {
  const worker = new ReplayWorker({
    replayService: {
      buildTaskReplayReport: (taskId: string) => ({
        taskId,
        outcome: taskId === "task-1" ? "repair_pending" : "no_recovery_activity",
      }),
    } as never,
    listTaskIds: async () => ["task-1", "task-2"],
    now: () => "2026-04-25T00:00:00.000Z",
  });

  const report = await worker.runRecoveryCycle();
  assert.equal(report.itemsProcessed, 0);
  assert.equal(report.itemsRecovered, 0);
  assert.equal(report.errors[0]?.code, "replay.real_side_effect_blocked");
});
