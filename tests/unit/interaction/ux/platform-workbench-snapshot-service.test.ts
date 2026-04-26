import assert from "node:assert/strict";
import test from "node:test";

import { PlatformWorkbenchSnapshotService } from "../../../src/interaction/ux/platform-workbench-snapshot-service.js";
import type { PlatformWorkbenchSnapshot, WorkbenchApprovalQueueItem, WorkbenchOperatorAction, AttentionItem } from "../../../src/interaction/ux/platform-workbench-snapshot-service.js";

test("PlatformWorkbenchSnapshotService.buildSnapshot with minimal input", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const snapshot = service.buildSnapshot({});

  assert.ok(snapshot.generatedAt !== undefined);
  assert.equal(snapshot.onboarding, null);
  assert.equal(snapshot.dashboard, null);
  assert.deepEqual(snapshot.hitlInbox, []);
  assert.deepEqual(snapshot.approvalQueue, []);
  assert.ok(Array.isArray(snapshot.operatorActions));
  assert.ok(Array.isArray(snapshot.sdkShortcuts));
});

test("PlatformWorkbenchSnapshotService.buildSnapshot with custom generatedAt", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const snapshot = service.buildSnapshot({
    generatedAt: "2026-04-26T00:00:00.000Z",
  });

  assert.equal(snapshot.generatedAt, "2026-04-26T00:00:00.000Z");
});

test("PlatformWorkbenchSnapshotService.buildSnapshot with onboarding session", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const onboarding = {
    sessionId: "onboarding_1",
    userRole: "operator" as const,
    currentStep: "step_1",
    completedSteps: ["welcome"] as const,
    recommendedTemplates: ["tmpl_1"] as const,
  };
  const snapshot = service.buildSnapshot({ onboarding });

  assert.deepEqual(snapshot.onboarding, onboarding);
  assert.equal(snapshot.onboarding?.sessionId, "onboarding_1");
  assert.equal(snapshot.onboarding?.userRole, "operator");
});

test("PlatformWorkbenchSnapshotService.buildSnapshot with dashboard", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const dashboard = {
    attentionQueue: [],
    dailySummary: {
      tasksCompleted: 10,
      tasksInProgress: 3,
      tasksFailed: 1,
      totalCostToday: "$15.00",
      agentUptimePercent: 99.5,
      highlights: ["10 tasks completed"],
      concerns: ["1 failure"],
    },
    recentCompletions: [],
  };
  const snapshot = service.buildSnapshot({ dashboard });

  assert.ok(snapshot.dashboard !== null);
  assert.equal(snapshot.dashboard?.dailySummary.tasksCompleted, 10);
  assert.deepEqual(snapshot.dashboard?.attentionQueue, []);
  assert.deepEqual(snapshot.dashboard?.recentCompletions, []);
});

test("PlatformWorkbenchSnapshotService.buildSnapshot with hitl inbox", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const hitlInbox = [
    { itemId: "hitl_1", taskId: "task_1", status: "pending", createdAt: "2026-04-25T00:00:00Z" },
    { itemId: "hitl_2", taskId: "task_2", status: "pending", createdAt: "2026-04-25T01:00:00Z" },
  ];
  const snapshot = service.buildSnapshot({ hitlInbox });

  assert.equal(snapshot.hitlInbox.length, 2);
  assert.equal(snapshot.hitlInbox[0]?.itemId, "hitl_1");
});

test("PlatformWorkbenchSnapshotService.buildSnapshot with approval queue", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const approvalQueue: readonly WorkbenchApprovalQueueItem[] = [
    { approvalId: "appr_1", taskId: "task_1", riskLevel: "high", title: "Deploy", status: "requested" },
    { approvalId: "appr_2", taskId: "task_2", riskLevel: "medium", title: "Update", status: "approved" },
  ];
  const snapshot = service.buildSnapshot({ approvalQueue });

  assert.equal(snapshot.approvalQueue.length, 2);
  assert.equal(snapshot.approvalQueue[0]?.approvalId, "appr_1");
  assert.equal(snapshot.approvalQueue[0]?.riskLevel, "high");
});

test("PlatformWorkbenchSnapshotService.buildSnapshot with operator actions", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const operatorActions: readonly WorkbenchOperatorAction[] = [
    { actionId: "action_1", label: "Start Workflow", route: "/start", requiredRole: "operator" },
    { actionId: "action_2", label: "Admin Panel", route: "/admin", requiredRole: "admin" },
  ];
  const snapshot = service.buildSnapshot({ operatorActions });

  assert.equal(snapshot.operatorActions.length, 2);
  assert.equal(snapshot.operatorActions[0]?.actionId, "action_1");
  assert.equal(snapshot.operatorActions[0]?.requiredRole, "operator");
});

test("PlatformWorkbenchSnapshotService.buildSnapshot generates default operator actions based on attention queue", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const attentionQueue: readonly AttentionItem[] = [
    { itemType: "incident", priority: "critical", title: "Critical incident", description: "Desc", actionOptions: [], createdAt: "2026-04-26T00:00:00Z", domainId: "platform" },
  ];
  const snapshot = service.buildSnapshot({ dashboard: { attentionQueue, dailySummary: { tasksCompleted: 0, tasksInProgress: 0, tasksFailed: 0, totalCostToday: "$0", agentUptimePercent: 100, highlights: [], concerns: [] }, recentCompletions: [] } });

  // Should have critical attention items, so third action should be open_takeover_console
  const criticalAction = snapshot.operatorActions.find(a => a.actionId === "open_takeover_console");
  assert.ok(criticalAction !== undefined);
  assert.equal(criticalAction?.requiredRole, "admin");
});

test("PlatformWorkbenchSnapshotService.buildSnapshot with sdk shortcuts", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const sdkShortcuts = [
    { shortcutId: "sdk.tasks.create", label: "Create Task", kind: "api" as const, command: "POST /v1/tasks", previewUrl: "https://api.example.com/v1/tasks" },
    { shortcutId: "sdk.tasks.list", label: "List Tasks", kind: "api" as const, command: "GET /v1/tasks", previewUrl: "https://api.example.com/v1/tasks" },
  ];
  const snapshot = service.buildSnapshot({ sdkShortcuts });

  assert.equal(snapshot.sdkShortcuts.length, 2);
  assert.equal(snapshot.sdkShortcuts[0]?.shortcutId, "sdk.tasks.create");
});

test("PlatformWorkbenchSnapshotService.buildSnapshot with inventory summary", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const snapshot = service.buildSnapshot({
    inventorySummary: {
      benchmarkCount: 10,
      projectionCount: 5,
      deploymentCount: 3,
      judgeCount: 2,
      complianceProgramCount: 1,
    },
  });

  assert.equal(snapshot.inventorySummary.benchmarkCount, 10);
  assert.equal(snapshot.inventorySummary.projectionCount, 5);
  assert.equal(snapshot.inventorySummary.deploymentCount, 3);
  assert.equal(snapshot.inventorySummary.judgeCount, 2);
  assert.equal(snapshot.inventorySummary.complianceProgramCount, 1);
});

test("PlatformWorkbenchSnapshotService.buildSnapshot with partial inventory summary", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const snapshot = service.buildSnapshot({
    inventorySummary: {
      benchmarkCount: 7,
    },
  });

  assert.equal(snapshot.inventorySummary.benchmarkCount, 7);
  assert.equal(snapshot.inventorySummary.projectionCount, 0);
  assert.equal(snapshot.inventorySummary.deploymentCount, 0);
  assert.equal(snapshot.inventorySummary.judgeCount, 0);
  assert.equal(snapshot.inventorySummary.complianceProgramCount, 0);
});

test("PlatformWorkbenchSnapshotService.buildSnapshot copies arrays to prevent mutation", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const originalQueue: readonly WorkbenchApprovalQueueItem[] = [
    { approvalId: "appr_1", taskId: "task_1", riskLevel: "low", title: "Test", status: "pending" },
  ];
  const snapshot = service.buildSnapshot({ approvalQueue: originalQueue });

  // Modify the original array
  (originalQueue as WorkbenchApprovalQueueItem[]).push({ approvalId: "appr_2", taskId: "task_2", riskLevel: "high", title: "Test2", status: "pending" });

  // Snapshot should not be affected
  assert.equal(snapshot.approvalQueue.length, 1);
});

test("PlatformWorkbenchSnapshotService.buildSnapshot copies hitl inbox to prevent mutation", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const originalInbox = [{ itemId: "hitl_1", taskId: "task_1", status: "pending", createdAt: "2026-04-25T00:00:00Z" }];
  const snapshot = service.buildSnapshot({ hitlInbox: originalInbox });

  // Modify original
  originalInbox.push({ itemId: "hitl_2", taskId: "task_2", status: "pending", createdAt: "2026-04-25T01:00:00Z" });

  assert.equal(snapshot.hitlInbox.length, 1);
});

test("PlatformWorkbenchSnapshotService.buildSnapshot copies sdk shortcuts to prevent mutation", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const originalShortcuts = [{ shortcutId: "sdk.1", label: "Shortcut 1", kind: "api" as const, command: "cmd1", previewUrl: "url1" }];
  const snapshot = service.buildSnapshot({ sdkShortcuts: originalShortcuts });

  originalShortcuts.push({ shortcutId: "sdk.2", label: "Shortcut 2", kind: "api" as const, command: "cmd2", previewUrl: "url2" });

  assert.equal(snapshot.sdkShortcuts.length, 1);
});

test("PlatformWorkbenchSnapshotService.buildSnapshot default operator actions for non-critical attention", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const attentionQueue: readonly AttentionItem[] = [
    { itemType: "suggestion", priority: "low", title: "Suggestion", description: "Desc", actionOptions: [], createdAt: "2026-04-26T00:00:00Z", domainId: "platform" },
  ];
  const snapshot = service.buildSnapshot({
    dashboard: {
      attentionQueue,
      dailySummary: {
        tasksCompleted: 0,
        tasksInProgress: 0,
        tasksFailed: 0,
        totalCostToday: "$0",
        agentUptimePercent: 100,
        highlights: [],
        concerns: [],
      },
      recentCompletions: [],
    },
  });

  const taskBoardAction = snapshot.operatorActions.find((a) => a.actionId === "open_task_board");
  assert.ok(taskBoardAction !== undefined);
  assert.equal(taskBoardAction?.requiredRole, "operator");
});

test("PlatformWorkbenchSnapshotService.buildSnapshot includes all default operator actions", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const snapshot = service.buildSnapshot({});

  assert.ok(snapshot.operatorActions.length >= 3);
  const actionIds = snapshot.operatorActions.map(a => a.actionId);
  assert.ok(actionIds.includes("open_approvals"));
  assert.ok(actionIds.includes("open_stability"));
});
