import assert from "node:assert/strict";
import test from "node:test";

import { PlatformWorkbenchSnapshotService } from "../../../../src/interaction/ux/platform-workbench-snapshot-service.js";

test("PlatformWorkbenchSnapshotService builds aggregated workbench snapshot with default operator actions", () => {
  const service = new PlatformWorkbenchSnapshotService();
  const snapshot = service.buildSnapshot({
    generatedAt: "2026-04-22T10:00:00.000Z",
    onboarding: {
      sessionId: "session-1",
      userRole: "platform_ops",
      currentStep: "connect_data",
      completedSteps: ["welcome"],
      recommendedTemplates: ["ops-template"],
    },
    dashboard: {
      attentionQueue: [
        {
          itemType: "incident",
          priority: "critical",
          title: "Failover drill overdue",
          description: "Regional failover rehearsal is overdue.",
          actionOptions: ["open_takeover_console"],
          createdAt: "2026-04-22T09:00:00.000Z",
          domainId: "platform",
        },
      ],
      dailySummary: {
        tasksCompleted: 4,
        tasksInProgress: 2,
        tasksFailed: 1,
        totalCostToday: "$12.50",
        agentUptimePercent: 99,
        highlights: ["4 tasks completed"],
        concerns: ["1 critical incident"],
      },
      agentHealthCards: [],
      costBurn: { consumedUsd: 12.5, forecastUsd: 14.2 },
      activeGoals: [],
      recentCompletions: [],
      proactiveSuggestions: [],
    },
    approvalQueue: [
      {
        approvalId: "approval-1",
        taskId: "task-1",
        riskLevel: "high",
        title: "Promote rollout",
        status: "requested",
      },
    ],
    sdkShortcuts: [
      {
        shortcutId: "sdk.tasks.list",
        label: "List Tasks",
        kind: "api",
        command: "GET /v1/tasks",
        previewUrl: "https://api.example.com/v1/tasks",
      },
    ],
    inventorySummary: {
      benchmarkCount: 6,
      projectionCount: 9,
      deploymentCount: 4,
      judgeCount: 3,
      complianceProgramCount: 3,
    },
  });

  assert.equal(snapshot.dashboard?.attentionQueue.length, 1);
  assert.equal(snapshot.operatorActions[2]?.actionId, "open_takeover_console");
  assert.equal(snapshot.sdkShortcuts.length, 1);
  assert.equal(snapshot.inventorySummary.projectionCount, 9);
});
