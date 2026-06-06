import assert from "node:assert/strict";
import test from "node:test";

import { WorkflowStateError } from "../../../../../src/platform/contracts/errors.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { createSeededApiContext } from "../../../../helpers/api.js";

test("mission control snapshot aggregates task, approval, pmf, billing, and perception signals", () => {
  const workspace = createTempWorkspace("aa-mission-control-");

  try {
    const context = createSeededApiContext(workspace);
    const snapshot = context.missionControlService.getSnapshot();

    assert.ok(["ok", "degraded"].includes(snapshot.health.status));
    assert.ok(snapshot.taskBoard.length >= 1);
    assert.ok(snapshot.pendingApprovals.some((approval) => approval.id === context.approvalId));
    assert.equal(snapshot.productSignals.billingAccounts.length, 1);
    assert.equal(snapshot.productSignals.latestPmfReport?.profileName, "phase3_default");
    assert.ok(snapshot.productSignals.perceptionBriefs.length >= 1);
    assert.ok(snapshot.gatewayTargets.some((target) => target.displayName === "Finance Team"));

    const workflows = context.missionControlService.listWorkflowCockpits(10);
    assert.ok(workflows.some((workflow) => workflow.taskId === context.seededTaskId));

    const workflowCockpit = context.missionControlService.getWorkflowCockpit(context.seededTaskId);
    assert.equal(workflowCockpit.summary.taskId, context.seededTaskId);
    assert.ok(workflowCockpit.timeline.entries.length >= 1);

    const stability = context.missionControlService.getStabilityPanel(10);
    assert.ok(["ok", "degraded"].includes(stability.health.status));
    assert.ok(stability.workers.some((worker) => worker.workerId === context.seededWorkerId));

    const admin = context.missionControlService.getAdminTakeoverConsole(context.seededTaskId);
    assert.equal(admin.scope.taskId, context.seededTaskId);
    assert.equal(admin.activeWorker?.workerId, context.seededWorkerId);
    assert.ok(admin.inspect.takeoverSessions.length >= 1);

    context.db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("mission control snapshot activeAgents excludes offline workers even when executions remain active", () => {
  const workspace = createTempWorkspace("aa-mission-control-active-agents-");

  try {
    const context = createSeededApiContext(workspace);
    const existingWorker = context.store.worker.getWorkerSnapshot(context.seededWorkerId);
    assert.ok(existingWorker);

    context.store.worker.upsertWorkerSnapshot({
      ...existingWorker,
      version: existingWorker.version,
      status: "offline",
      updatedAt: new Date().toISOString(),
    });

    const snapshot = context.missionControlService.getSnapshot();
    assert.equal(snapshot.health.workerHealth.offlineWorkers, 1);
    assert.equal(snapshot.activeAgents, 0);

    context.db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("mission control global views fail-close when a tenant scope is requested", () => {
  const workspace = createTempWorkspace("aa-mission-control-tenant-");

  try {
    const context = createSeededApiContext(workspace);

    assert.throws(
      () => context.missionControlService.getSnapshot("tenant-scoped"),
      /mission_control\.snapshot_not_tenant_scoped/,
    );
    assert.throws(
      () => context.missionControlService.getStabilityPanel(10, "tenant-scoped"),
      /mission_control\.stability_not_tenant_scoped/,
    );
    assert.throws(
      () => context.missionControlService.getAdminTakeoverConsole(context.seededTaskId, "tenant-scoped"),
      /mission_control\.admin_console_not_tenant_scoped/,
    );

    context.db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("mission control getWorkflowCockpit returns timeline entries with correct structure", () => {
  const workspace = createTempWorkspace("aa-mission-control-timeline-");

  try {
    const context = createSeededApiContext(workspace);
    const cockpit = context.missionControlService.getWorkflowCockpit(context.seededTaskId);

    assert.ok(Array.isArray(cockpit.timeline.entries));
    if (cockpit.timeline.entries.length > 0) {
      const entry = cockpit.timeline.entries[0]!;
      assert.ok(entry.kind !== undefined);
      assert.ok(entry.traceId !== undefined);
      assert.ok(entry.occurredAt !== undefined);
    }

    context.db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("mission control getWorkflowCockpit classifies missing workflow as workflow state error", () => {
  const workspace = createTempWorkspace("aa-mission-control-missing-");

  try {
    const context = createSeededApiContext(workspace);

    assert.throws(
      () => context.missionControlService.getWorkflowCockpit("task-missing"),
      (error: unknown) =>
        error instanceof WorkflowStateError
        && error.code === "workflow.not_found"
        && error.category === "workflow",
    );

    context.db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("mission control task cockpit expands real-model metadata from task output json", () => {
  const workspace = createTempWorkspace("aa-mission-control-task-output-");

  try {
    const context = createSeededApiContext(workspace);
    const updatedAt = new Date().toISOString();
    context.store.task.updateTaskOutput(
      context.seededTaskId,
      JSON.stringify({
        executionMode: "real_model",
        modelCallStatus: "succeeded",
        modelProvider: "minimax",
        modelName: "minimax-m2.7",
        outputSummary: "real output summary",
        outputUri: "/tmp/report.md",
      }),
      updatedAt,
    );

    const cockpit = context.missionControlService.getTaskCockpit(context.seededTaskId);
    const snapshotTask = cockpit.snapshot.task as typeof cockpit.snapshot.task & {
      executionMode?: string;
      modelCallStatus?: string;
      modelProvider?: string;
      modelName?: string;
      outputSummary?: string | null;
      outputUri?: string | null;
    };

    assert.equal(snapshotTask.executionMode, "real_model");
    assert.equal(snapshotTask.modelCallStatus, "succeeded");
    assert.equal(snapshotTask.modelProvider, "minimax");
    assert.equal(snapshotTask.modelName, "minimax-m2.7");
    assert.equal(snapshotTask.outputSummary, "real output summary");
    assert.equal(snapshotTask.outputUri, "/tmp/report.md");

    context.db.close();
  } finally {
    cleanupPath(workspace);
  }
});
