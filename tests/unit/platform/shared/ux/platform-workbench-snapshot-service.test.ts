import assert from "node:assert/strict";
import test from "node:test";

import {
  PlatformWorkbenchSnapshotService,
  type WorkbenchApprovalQueueItem,
  type WorkbenchDashboardSnapshot,
  type PlatformWorkbenchSnapshot,
} from "../../../../../src/platform/shared/ux/platform-workbench-snapshot-service.js";

test("PlatformWorkbenchSnapshotService.buildSnapshot creates minimal snapshot", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const snapshot = service.buildSnapshot({});

  assert.ok(snapshot.generatedAt.length > 0);
  assert.equal(snapshot.dashboard, null);
  assert.deepEqual(snapshot.approvalQueue, []);
  assert.equal(snapshot.inventorySummary.benchmarkCount, 0);
  assert.equal(snapshot.inventorySummary.projectionCount, 0);
  assert.equal(snapshot.inventorySummary.deploymentCount, 0);
  assert.equal(snapshot.inventorySummary.judgeCount, 0);
  assert.equal(snapshot.inventorySummary.complianceProgramCount, 0);
});

test("PlatformWorkbenchSnapshotService.buildSnapshot accepts custom generatedAt", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const snapshot = service.buildSnapshot({
    generatedAt: "2024-01-15T10:30:00.000Z",
  });

  assert.equal(snapshot.generatedAt, "2024-01-15T10:30:00.000Z");
});

test("PlatformWorkbenchSnapshotService.buildSnapshot accepts dashboard", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const dashboard: WorkbenchDashboardSnapshot = {
    dailySummary: {
      tasksCompleted: 10,
      tasksInProgress: 2,
      tasksFailed: 1,
      totalCostToday: "$5.00",
      agentUptimePercent: 99.5,
      highlights: ["Good performance"],
      concerns: [],
    },
    attentionQueue: [],
    recentCompletions: [],
    agentHealthCards: [],
    costBurn: { consumedUsd: 5, forecastUsd: 10 },
    activeGoals: [],
    proactiveSuggestions: [],
    metricRegistry: [],
  };

  const snapshot = service.buildSnapshot({ dashboard });

  assert.ok(snapshot.dashboard !== null);
  assert.equal(snapshot.dashboard.dailySummary.tasksCompleted, 10);
});

test("PlatformWorkbenchSnapshotService.buildSnapshot accepts approval queue", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const approvalItem: WorkbenchApprovalQueueItem = {
    approvalId: "approval-1",
    taskId: "task-1",
    riskLevel: "high",
    title: "Execute risky operation",
    status: "pending",
  };

  const snapshot = service.buildSnapshot({
    approvalQueue: [approvalItem],
  });

  assert.equal(snapshot.approvalQueue.length, 1);
  assert.equal(snapshot.approvalQueue[0]!.approvalId, "approval-1");
  assert.equal(snapshot.approvalQueue[0]!.riskLevel, "high");
});

test("PlatformWorkbenchSnapshotService.buildSnapshot accepts partial inventory summary", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const snapshot = service.buildSnapshot({
    inventorySummary: {
      benchmarkCount: 5,
      deploymentCount: 3,
    },
  });

  assert.equal(snapshot.inventorySummary.benchmarkCount, 5);
  assert.equal(snapshot.inventorySummary.deploymentCount, 3);
  assert.equal(snapshot.inventorySummary.projectionCount, 0); // default
  assert.equal(snapshot.inventorySummary.judgeCount, 0); // default
  assert.equal(snapshot.inventorySummary.complianceProgramCount, 0); // default
});

test("PlatformWorkbenchSnapshotService.buildSnapshot defaults generatedAt to now", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const before = new Date().toISOString();
  const snapshot = service.buildSnapshot({});
  const after = new Date().toISOString();

  assert.ok(snapshot.generatedAt >= before);
  assert.ok(snapshot.generatedAt <= after);
});

test("PlatformWorkbenchSnapshotService.buildSnapshot copies approval queue", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const approvals: WorkbenchApprovalQueueItem[] = [
    {
      approvalId: "a1",
      taskId: "t1",
      riskLevel: "low",
      title: "Test 1",
      status: "approved",
    },
    {
      approvalId: "a2",
      taskId: "t2",
      riskLevel: "critical",
      title: "Test 2",
      status: "pending",
    },
  ];

  const snapshot = service.buildSnapshot({ approvalQueue: approvals });

  assert.equal(snapshot.approvalQueue.length, 2);
  // Verify it's a shallow copy, not the same array reference
  assert.ok(snapshot.approvalQueue !== approvals);
});

test("PlatformWorkbenchSnapshotService.buildSnapshot accepts null dashboard", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const snapshot = service.buildSnapshot({
    dashboard: null,
  });

  assert.equal(snapshot.dashboard, null);
});

test("PlatformWorkbenchSnapshotService.buildSnapshot handles full inventory summary", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const snapshot = service.buildSnapshot({
    inventorySummary: {
      benchmarkCount: 10,
      projectionCount: 20,
      deploymentCount: 5,
      judgeCount: 3,
      complianceProgramCount: 7,
    },
  });

  assert.equal(snapshot.inventorySummary.benchmarkCount, 10);
  assert.equal(snapshot.inventorySummary.projectionCount, 20);
  assert.equal(snapshot.inventorySummary.deploymentCount, 5);
  assert.equal(snapshot.inventorySummary.judgeCount, 3);
  assert.equal(snapshot.inventorySummary.complianceProgramCount, 7);
});

test("PlatformWorkbenchSnapshotService.buildSnapshot with all parameters", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const dashboard: WorkbenchDashboardSnapshot = {
    dailySummary: {
      tasksCompleted: 100,
      tasksInProgress: 10,
      tasksFailed: 2,
      totalCostToday: "$50.00",
      agentUptimePercent: 99.9,
      highlights: ["Milestone reached"],
      concerns: ["High load"],
    },
    attentionQueue: [
      {
        itemType: "incident",
        priority: "high",
        title: "Investigate spike",
        description: "Latency increased",
        actionOptions: ["scale", "ignore"],
        createdAt: "2024-01-15T10:00:00Z",
        domainId: "platform",
      },
    ],
    recentCompletions: [
      { taskId: "task-1", taskStatus: "completed" },
    ],
    agentHealthCards: [],
    costBurn: { consumedUsd: 50, forecastUsd: 100 },
    activeGoals: [],
    proactiveSuggestions: [],
    metricRegistry: [],
  };

  const approvals: WorkbenchApprovalQueueItem[] = [
    {
      approvalId: "ap-1",
      taskId: "task-100",
      riskLevel: "medium",
      title: "Deploy to prod",
      status: "pending",
    },
  ];

  const snapshot = service.buildSnapshot({
    generatedAt: "2024-01-15T12:00:00.000Z",
    dashboard,
    approvalQueue: approvals,
    inventorySummary: {
      benchmarkCount: 50,
      projectionCount: 100,
      deploymentCount: 25,
      judgeCount: 10,
      complianceProgramCount: 4,
    },
  });

  assert.equal(snapshot.generatedAt, "2024-01-15T12:00:00.000Z");
  assert.ok(snapshot.dashboard !== null);
  assert.equal(snapshot.dashboard.dailySummary.tasksCompleted, 100);
  assert.equal(snapshot.approvalQueue.length, 1);
  assert.equal(snapshot.inventorySummary.benchmarkCount, 50);
});