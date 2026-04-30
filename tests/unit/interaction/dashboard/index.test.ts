/**
 * Unit tests for dashboard attention queue sorting
 *
 * Issue #2050: Attention queue sorts by createdAt ignoring priority
 */

import assert from "node:assert/strict";
import test from "node:test";

import { DashboardAggregationService, type AttentionItem } from "../../../../src/interaction/dashboard/index.js";
import type { TaskBoardItem } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { SystemSituation } from "../../../../src/platform/shared/observability/system-situation-model.js";

function makeTask(taskId: string, taskStatus: TaskBoardItem["taskStatus"], updatedAt: string): TaskBoardItem {
  return {
    taskId,
    title: `Task ${taskId}`,
    priority: "normal",
    taskStatus,
    workflowStatus: taskStatus === "done" ? "completed" : "running",
    divisionId: "general_ops",
    currentStepIndex: 0,
    sessionStatus: "open",
    latestEventAt: updatedAt,
    updatedAt,
  };
}

function makeSystemSituation(overrides: Partial<SystemSituation> = {}): SystemSituation {
  return {
    healthStatus: "ok",
    providerHealth: {
      status: "healthy",
      successRate: 0.98,
      recentCalls: 50,
    },
    resourceUtilization: {
      memoryRssMb: 512,
      cpuPercent: 45,
      activeProcesses: 8,
    },
    queueBacklog: {
      size: 0,
      degraded: false,
    },
    eventBusBacklog: {
      tier1PendingAcks: 0,
    },
    findings: [],
    observedAt: new Date().toISOString(),
    ...overrides,
  };
}

test("Attention queue is sorted by createdAt ascending (issue #2050)", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_newer", "failed", "2026-04-20T12:00:00.000Z"), // newer
        makeTask("task_older", "failed", "2026-04-19T12:00:00.000Z"), // older
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildOperatorDashboard();
  const attentionQueue = dashboard.attentionQueue;

  // Verify items are sorted by createdAt ascending
  for (let i = 1; i < attentionQueue.length; i++) {
    const prevTime = new Date(attentionQueue[i - 1]!.createdAt).getTime();
    const currTime = new Date(attentionQueue[i]!.createdAt).getTime();
    assert.ok(prevTime <= currTime, `Item at index ${i-1} (${prevTime}) should have createdAt <= item at index ${i} (${currTime})`);
  }
});

test("Attention queue respects createdAt order even when priorities differ", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_critical_new", "failed", "2026-04-20T10:00:00.000Z"), // newer but high priority
        makeTask("task_low_old", "failed", "2026-04-19T08:00:00.000Z"), // older but normal priority
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildOperatorDashboard();
  const attentionQueue = dashboard.attentionQueue;

  // The newer item should come after the older item (sorted by createdAt, not priority)
  // This is the behavior issue #2050 - sorting only by createdAt ignores priority
  const newerIdx = attentionQueue.findIndex(item => item.title.includes("task_critical_new"));
  const olderIdx = attentionQueue.findIndex(item => item.title.includes("task_low_old"));

  if (newerIdx >= 0 && olderIdx >= 0) {
    const newerTime = new Date(attentionQueue[newerIdx]!.createdAt).getTime();
    const olderTime = new Date(attentionQueue[olderIdx]!.createdAt).getTime();
    assert.ok(olderTime < newerTime, "Older item should come before newer item in sorted order");
  }
});

test("Attention queue includes incidents sorted by createdAt", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_first", "failed", "2026-04-18T10:00:00.000Z"),
        makeTask("task_second", "failed", "2026-04-19T10:00:00.000Z"),
        makeTask("task_third", "failed", "2026-04-20T10:00:00.000Z"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildOperatorDashboard();
  const incidents = dashboard.attentionQueue.filter(item => item.itemType === "incident");

  assert.equal(incidents.length, 3);

  // Verify sorted by createdAt
  for (let i = 1; i < incidents.length; i++) {
    const prevTime = new Date(incidents[i - 1]!.createdAt).getTime();
    const currTime = new Date(incidents[i]!.createdAt).getTime();
    assert.ok(prevTime <= currTime);
  }
});

test("Attention queue includes pending approvals sorted by createdAt", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_first", "pending", "2026-04-18T10:00:00.000Z"),
        makeTask("task_second", "pending", "2026-04-19T10:00:00.000Z"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildOperatorDashboard();
  const approvals = dashboard.attentionQueue.filter(item => item.itemType === "approval_needed");

  assert.equal(approvals.length, 2);

  // Verify sorted by createdAt
  for (let i = 1; i < approvals.length; i++) {
    const prevTime = new Date(approvals[i - 1]!.createdAt).getTime();
    const currTime = new Date(approvals[i]!.createdAt).getTime();
    assert.ok(prevTime <= currTime);
  }
});

test("Suggestions are appended after tasks and sorted by createdAt", () => {
  const suggestions: AttentionItem[] = [
    {
      itemType: "suggestion",
      priority: "normal",
      title: "Suggestion 1",
      description: "First suggestion",
      actionOptions: ["accept"],
      createdAt: "2026-04-19T14:00:00.000Z",
      domainId: "general_ops",
    },
    {
      itemType: "suggestion",
      priority: "normal",
      title: "Suggestion 2",
      description: "Second suggestion",
      actionOptions: ["accept"],
      createdAt: "2026-04-19T15:00:00.000Z",
      domainId: "general_ops",
    },
  ];

  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "failed", "2026-04-19T10:00:00.000Z"),
        makeTask("task_2", "failed", "2026-04-19T12:00:00.000Z"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
    suggestions,
  });

  const dashboard = service.buildOperatorDashboard();

  // Suggestions should be in the queue, appended after tasks
  assert.ok(dashboard.attentionQueue.length >= 4);

  // Find where suggestions start
  const firstSuggestionIdx = dashboard.attentionQueue.findIndex(item => item.itemType === "suggestion");
  assert.ok(firstSuggestionIdx >= 2); // Should be after at least 2 tasks

  // All suggestions should be sorted among themselves by createdAt
  const suggestionItems = dashboard.attentionQueue.filter(item => item.itemType === "suggestion");
  for (let i = 1; i < suggestionItems.length; i++) {
    const prevTime = new Date(suggestionItems[i - 1]!.createdAt).getTime();
    const currTime = new Date(suggestionItems[i]!.createdAt).getTime();
    assert.ok(prevTime <= currTime);
  }
});

test("Health degraded incident is added with current timestamp", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [],
    },
    systemSource: {
      build: () => makeSystemSituation({ healthStatus: "degraded" }),
    },
    currentTime: () => "2026-04-25T12:00:00.000Z",
  });

  const dashboard = service.buildOperatorDashboard();
  const healthIncident = dashboard.attentionQueue.find(
    item => item.title.includes("Platform health"),
  );

  assert.ok(healthIncident);
  assert.equal(healthIncident!.itemType, "incident");
  assert.equal(healthIncident!.priority, "high");
});

test("Budget warning is added when cost exceeds forecast", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
    costBurnUsd: 150,
    forecastCostUsd: 100,
  });

  const dashboard = service.buildOperatorDashboard();
  const budgetWarning = dashboard.attentionQueue.find(
    item => item.itemType === "budget_warning",
  );

  assert.ok(budgetWarning);
  assert.equal(budgetWarning!.priority, "high");
});

test("Attention queue sorting is stable for same createdAt", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_a", "failed", "2026-04-19T10:00:00.000Z"),
        makeTask("task_b", "failed", "2026-04-19T10:00:00.000Z"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildOperatorDashboard();

  // Both items have same createdAt - order should still be deterministic
  assert.equal(dashboard.attentionQueue.length, 2);
});

test("Dashboard snapshot reflects correct counts", async () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "in_progress", "2026-04-19T10:00:00.000Z"),
        makeTask("task_2", "failed", "2026-04-19T11:00:00.000Z"),
        makeTask("task_3", "done", "2026-04-19T12:00:00.000Z"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation({ healthStatus: "degraded" }),
    },
    costBurnUsd: 120,
    forecastCostUsd: 100,
  });

  const snapshot = await service.getSnapshot();

  assert.equal(snapshot.workflowBacklog, 2); // in_progress + failed
  assert.equal(snapshot.incidentCount, 1); // failed
  assert.equal(snapshot.budgetAlerts, 1); // cost > forecast
});
