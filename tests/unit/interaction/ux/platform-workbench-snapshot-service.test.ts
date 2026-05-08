import assert from "node:assert/strict";
import test from "node:test";

import {
  PlatformWorkbenchSnapshotService,
  type WorkbenchApprovalQueueItem,
  type WorkbenchOperatorAction,
  type PlatformWorkbenchSnapshot,
} from "../../../../src/interaction/ux/platform-workbench-snapshot-service.js";

test("PlatformWorkbenchSnapshotService builds empty snapshot", () => {
  const service = new PlatformWorkbenchSnapshotService();

  const snapshot = service.buildSnapshot({});

  assert.ok(snapshot.generatedAt.length > 0);
  assert.equal(snapshot.onboarding, null);
  assert.equal(snapshot.dashboard, null);
  assert.deepEqual(snapshot.hitlInbox, []);
  assert.deepEqual(snapshot.approvalQueue, []);
  assert.ok(Array.isArray(snapshot.operatorActions));
});

test("buildSnapshot copies arrays to prevent mutation", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const hitlInbox = [{ id: "item-1" }] as any;
  const approvalQueue = [{ approvalId: "app-1" }] as any;

  const snapshot = service.buildSnapshot({ hitlInbox, approvalQueue });

  assert.ok(snapshot.hitlInbox !== hitlInbox);
  assert.ok(snapshot.approvalQueue !== approvalQueue);
  assert.equal(snapshot.hitlInbox.length, 1);
  assert.equal(snapshot.approvalQueue.length, 1);
});

test("buildSnapshot uses custom generatedAt", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const customTime = "2026-01-01T00:00:00.000Z";

  const snapshot = service.buildSnapshot({ generatedAt: customTime });

  assert.equal(snapshot.generatedAt, customTime);
});

test("buildSnapshot uses current time when not provided", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const before = new Date().toISOString();

  const snapshot = service.buildSnapshot({});

  const after = new Date().toISOString();
  assert.ok(snapshot.generatedAt >= before);
  assert.ok(snapshot.generatedAt <= after);
});

test("buildSnapshot defaults inventorySummary values to zero", () => {
  const service = new PlatformWorkbenchSnapshotService();

  const snapshot = service.buildSnapshot({});

  assert.equal(snapshot.inventorySummary.benchmarkCount, 0);
  assert.equal(snapshot.inventorySummary.projectionCount, 0);
  assert.equal(snapshot.inventorySummary.deploymentCount, 0);
  assert.equal(snapshot.inventorySummary.judgeCount, 0);
  assert.equal(snapshot.inventorySummary.complianceProgramCount, 0);
});

test("buildSnapshot allows partial inventorySummary override", () => {
  const service = new PlatformWorkbenchSnapshotService();

  const snapshot = service.buildSnapshot({
    inventorySummary: { benchmarkCount: 5 },
  });

  assert.equal(snapshot.inventorySummary.benchmarkCount, 5);
  assert.equal(snapshot.inventorySummary.projectionCount, 0);
});

test("buildSnapshot selects operator actions based on attention queue", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const attentionQueue = [
    { id: "att-1", priority: "critical", title: "Critical Issue" },
  ] as any;

  const snapshot = service.buildSnapshot({ dashboard: { attentionQueue } as any });

  // With critical attention, should show takeover console action
  const hasTakeover = snapshot.operatorActions.some(
    (a: WorkbenchOperatorAction) => a.actionId === "open_takeover_console",
  );
  assert.ok(hasTakeover);
});

test("buildSnapshot without critical attention shows normal actions", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const attentionQueue = [
    { id: "att-1", priority: "low", title: "Low Issue" },
  ] as any;

  const snapshot = service.buildSnapshot({ dashboard: { attentionQueue } as any });

  const hasTaskBoard = snapshot.operatorActions.some(
    (a: WorkbenchOperatorAction) => a.actionId === "open_task_board",
  );
  assert.ok(hasTaskBoard);
});

test("buildSnapshot preserves operatorActions when provided", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const customActions: WorkbenchOperatorAction[] = [
    { actionId: "custom_action", label: "Custom", route: "/custom", requiredRole: "admin" },
  ];

  const snapshot = service.buildSnapshot({ operatorActions: customActions });

  assert.equal(snapshot.operatorActions.length, 1);
  assert.equal(snapshot.operatorActions[0]!.actionId, "custom_action");
});

test("buildSnapshot preserves sdkShortcuts when provided", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const shortcuts = [{ id: "shortcut-1", label: "Shortcut" }] as any;

  const snapshot = service.buildSnapshot({ sdkShortcuts: shortcuts });

  assert.equal(snapshot.sdkShortcuts.length, 1);
  assert.equal(snapshot.sdkShortcuts[0]!.id, "shortcut-1");
});

test("WorkbenchApprovalQueueItem structure", () => {
  const item: WorkbenchApprovalQueueItem = {
    approvalId: "app-123",
    taskId: "task-456",
    riskLevel: "high",
    title: "Approval Required",
    status: "pending",
  };

  assert.equal(item.approvalId, "app-123");
  assert.equal(item.riskLevel, "high");
});

test("WorkbenchOperatorAction requiredRole validation", () => {
  const viewerAction: WorkbenchOperatorAction = {
    actionId: "viewer_action",
    label: "View",
    route: "/view",
    requiredRole: "viewer",
  };

  const adminAction: WorkbenchOperatorAction = {
    actionId: "admin_action",
    label: "Admin",
    route: "/admin",
    requiredRole: "admin",
  };

  assert.equal(viewerAction.requiredRole, "viewer");
  assert.equal(adminAction.requiredRole, "admin");
});

test("PlatformWorkbenchSnapshot full structure", () => {
  const snapshot: PlatformWorkbenchSnapshot = {
    generatedAt: "2026-04-01T00:00:00.000Z",
    onboarding: null,
    dashboard: null,
    hitlInbox: [],
    approvalQueue: [],
    operatorActions: [],
    sdkShortcuts: [],
    inventorySummary: {
      benchmarkCount: 10,
      projectionCount: 5,
      deploymentCount: 3,
      judgeCount: 2,
      complianceProgramCount: 1,
    },
  };

  assert.equal(snapshot.generatedAt, "2026-04-01T00:00:00.000Z");
  assert.equal(snapshot.inventorySummary.benchmarkCount, 10);
});
