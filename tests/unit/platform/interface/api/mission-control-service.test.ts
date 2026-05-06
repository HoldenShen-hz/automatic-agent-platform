import assert from "node:assert/strict";
import test from "node:test";

import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { createSeededApiContext } from "../../../../helpers/api.js";

test("mission control snapshot aggregates task, approval, pmf, billing, and perception signals", () => {
  const workspace = createTempWorkspace("aa-mission-control-");

  try {
    const context = createSeededApiContext(workspace);
    const snapshot = context.missionControlService.getSnapshot();

    assert.equal(snapshot.health.status, "ok");
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
    assert.equal(stability.health.status, "ok");
    assert.ok(stability.workers.some((worker) => worker.workerId === context.seededWorkerId));

    const admin = context.missionControlService.getAdminTakeoverConsole(context.seededTaskId);
    assert.equal(admin.scope.harnessRunId, context.seededTaskId);
    assert.equal(admin.activeWorker?.workerId, context.seededWorkerId);
    assert.ok(admin.inspect.takeoverSessions.length >= 1);

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
