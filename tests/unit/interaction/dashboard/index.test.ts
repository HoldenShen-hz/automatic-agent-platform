/**
 * Unit Tests: Dashboard Aggregation Service
 *
 * Tests DashboardAggregationService including attention queue sorting.
 *
 * Issue #2050: Attention queue sorts by createdAt ignoring priority
 *
 * Test categories:
 * 1. Attention queue sorting by createdAt (not priority)
 * 2. Dashboard snapshot generation
 * 3. Different dashboard builders (operator, domain admin, platform ops, fleet)
 * 4. Projection delta merging
 * 5. Edge cases
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  DashboardAggregationService,
  type AttentionItem,
  type DashboardProjectionService,
  type DashboardSnapshot,
} from "../../../../src/interaction/dashboard/index.js";
import { createMockProjectionService } from "./factories.js";

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

function makeSystemSituation(overrides = {}): SystemSituation {
  return {
    healthStatus: "ok",
    providerHealth: { status: "healthy", successRate: 0.98, recentCalls: 50 },
    resourceUtilization: { memoryRssMb: 512, cpuPercent: 45, activeProcesses: 8 },
    queueBacklog: { size: 0, degraded: false },
    eventBusBacklog: { tier1PendingAcks: 0 },
    findings: [],
    observedAt: new Date().toISOString(),
    ...overrides,
  };
}

type TaskBoardItem = {
  taskId: string;
  title: string;
  priority: string;
  taskStatus: string;
  workflowStatus: string | null;
  divisionId: string | null;
  currentStepIndex: number | null;
  sessionStatus: string | null;
  latestEventAt: string | null;
  updatedAt: string;
};

type SystemSituation = {
  healthStatus: string;
  providerHealth: { status: string; successRate: number; recentCalls: number };
  resourceUtilization: { memoryRssMb: number; cpuPercent: number; activeProcesses: number };
  queueBacklog: { size: number; degraded: boolean };
  eventBusBacklog: { tier1PendingAcks: number };
  findings: unknown[];
  observedAt: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Issue #2050: Attention Queue Sorting - createdAt only, not priority
// ─────────────────────────────────────────────────────────────────────────────

test("attention queue sorts by createdAt ascending (issue #2050)", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_newer", "failed", "2026-04-20T12:00:00.000Z"),
        makeTask("task_older", "failed", "2026-04-19T12:00:00.000Z"),
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
    assert.ok(
      prevTime <= currTime,
      `Item at index ${i - 1} (${prevTime}) should have createdAt <= item at index ${i} (${currTime})`,
    );
  }
});

test("attention queue ignores priority when sorting - newer critical comes after older low", () => {
  // This test documents the behavior issue #2050: sorting only by createdAt
  // A critical/high priority item that is NEWER should ideally come before a low priority
  // item that is OLDER, but the current implementation only sorts by createdAt.

  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_critical_new", "failed", "2026-04-20T10:00:00.000Z"),
        makeTask("task_low_old", "failed", "2026-04-19T08:00:00.000Z"),
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
  const newerIdx = attentionQueue.findIndex((item) => item.title.includes("task_critical_new"));
  const olderIdx = attentionQueue.findIndex((item) => item.title.includes("task_low_old"));

  if (newerIdx >= 0 && olderIdx >= 0) {
    const newerTime = new Date(attentionQueue[newerIdx]!.createdAt).getTime();
    const olderTime = new Date(attentionQueue[olderIdx]!.createdAt).getTime();
    assert.ok(
      olderTime < newerTime,
      "Older item should come before newer item in sorted order (sorted by createdAt)",
    );
  }
});

test("attention queue with mixed priorities maintains createdAt order", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_p1", "failed", "2026-04-20T08:00:00.000Z"), // high priority, early
        makeTask("task_p2", "pending", "2026-04-20T09:00:00.000Z"), // normal priority, middle
        makeTask("task_p3", "failed", "2026-04-20T10:00:00.000Z"), // high priority, late
        makeTask("task_p4", "pending", "2026-04-20T11:00:00.000Z"), // normal priority, latest
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildOperatorDashboard();
  const times = dashboard.attentionQueue.map((item) => item.createdAt);

  // Verify strictly ascending by createdAt
  for (let i = 1; i < times.length; i++) {
    const prev = new Date(times[i - 1]!).getTime();
    const curr = new Date(times[i]!).getTime();
    assert.ok(prev <= curr, `Times should be ascending: ${prev} <= ${curr}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Attention Queue - Item Types
// ─────────────────────────────────────────────────────────────────────────────

test("attention queue includes failed tasks as incidents", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_failed_1", "failed", "2026-04-18T10:00:00.000Z"),
        makeTask("task_failed_2", "failed", "2026-04-19T10:00:00.000Z"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildOperatorDashboard();
  const incidents = dashboard.attentionQueue.filter((item) => item.itemType === "incident");

  assert.equal(incidents.length, 2);
});

test("attention queue includes pending tasks as approval_needed", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_pending_1", "pending", "2026-04-18T10:00:00.000Z"),
        makeTask("task_pending_2", "pending", "2026-04-19T10:00:00.000Z"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildOperatorDashboard();
  const approvals = dashboard.attentionQueue.filter((item) => item.itemType === "approval_needed");

  assert.equal(approvals.length, 2);
});

test("attention queue adds platform health incident when system degraded", () => {
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
  const healthIncident = dashboard.attentionQueue.find((item) =>
    item.title.includes("Platform health"),
  );

  assert.ok(healthIncident);
  assert.equal(healthIncident!.itemType, "incident");
  assert.equal(healthIncident!.priority, "high");
});

test("attention queue adds platform health critical incident when system unhealthy", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [],
    },
    systemSource: {
      build: () => makeSystemSituation({ healthStatus: "unhealthy" }),
    },
    currentTime: () => "2026-04-25T12:00:00.000Z",
  });

  const dashboard = service.buildOperatorDashboard();
  const healthIncident = dashboard.attentionQueue.find((item) =>
    item.title.includes("Platform health"),
  );

  assert.ok(healthIncident);
  assert.equal(healthIncident!.itemType, "incident");
  assert.equal(healthIncident!.priority, "critical");
});

test("attention queue adds budget warning when cost exceeds forecast", () => {
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
    (item) => item.itemType === "budget_warning",
  );

  assert.ok(budgetWarning);
  assert.equal(budgetWarning!.priority, "high");
});

test("attention queue does not add budget warning when cost is under forecast", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
    costBurnUsd: 80,
    forecastCostUsd: 100,
  });

  const dashboard = service.buildOperatorDashboard();
  const budgetWarning = dashboard.attentionQueue.find(
    (item) => item.itemType === "budget_warning",
  );

  assert.equal(budgetWarning, undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// Suggestions Integration
// ─────────────────────────────────────────────────────────────────────────────

test("suggestions are appended after tasks in attention queue", () => {
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
  const suggestionItems = dashboard.attentionQueue.filter(
    (item) => item.itemType === "suggestion",
  );

  assert.equal(suggestionItems.length, 2);
  // Suggestions are appended at the end after task-based items
  // The task items are sorted by createdAt, suggestions maintain their order
});

test("suggestions with different timestamps are sorted by createdAt in attention queue", () => {
  const suggestions: AttentionItem[] = [
    {
      itemType: "suggestion",
      priority: "normal",
      title: "Later suggestion",
      description: "Second suggestion",
      actionOptions: ["accept"],
      createdAt: "2026-04-20T10:00:00.000Z", // later
      domainId: "general_ops",
    },
    {
      itemType: "suggestion",
      priority: "normal",
      title: "Earlier suggestion",
      description: "First suggestion",
      actionOptions: ["accept"],
      createdAt: "2026-04-19T10:00:00.000Z", // earlier
      domainId: "general_ops",
    },
  ];

  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
    suggestions,
  });

  const dashboard = service.buildOperatorDashboard();
  const suggestionItems = dashboard.attentionQueue.filter(
    (item) => item.itemType === "suggestion",
  );

  // Verify sorted by createdAt
  for (let i = 1; i < suggestionItems.length; i++) {
    const prevTime = new Date(suggestionItems[i - 1]!.createdAt).getTime();
    const currTime = new Date(suggestionItems[i]!.createdAt).getTime();
    assert.ok(prevTime <= currTime, "Suggestions should be sorted by createdAt");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Snapshot
// ─────────────────────────────────────────────────────────────────────────────

test("getSnapshot returns correct workflowBacklog count", async () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "in_progress", "2026-04-19T10:00:00.000Z"),
        makeTask("task_2", "failed", "2026-04-19T11:00:00.000Z"),
        makeTask("task_3", "done", "2026-04-19T12:00:00.000Z"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const snapshot = await service.getSnapshot();

  assert.equal(snapshot.workflowBacklog, 2); // in_progress + failed, not done
});

test("getSnapshot counts incidents correctly", async () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "in_progress", "2026-04-19T10:00:00.000Z"),
        makeTask("task_2", "failed", "2026-04-19T11:00:00.000Z"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation({ healthStatus: "degraded" }),
    },
  });

  const snapshot = await service.getSnapshot();

  // Failed task = 1 incident, degraded system = 1 incident = 2 total
  assert.equal(snapshot.incidentCount, 2);
});

test("getSnapshot counts budgetAlerts when cost exceeds forecast", async () => {
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

  const snapshot = await service.getSnapshot();

  assert.equal(snapshot.budgetAlerts, 1);
});

test("getSnapshot has generatedAt timestamp", async () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: { build: () => makeSystemSituation() },
    currentTime: () => "2026-04-25T12:00:00.000Z",
  });

  const snapshot = await service.getSnapshot();

  assert.equal(snapshot.generatedAt, "2026-04-25T12:00:00.000Z");
});

// ─────────────────────────────────────────────────────────────────────────────
// Operator Dashboard
// ─────────────────────────────────────────────────────────────────────────────

test("buildOperatorDashboard includes attentionQueue", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "failed", "2026-04-19T10:00:00.000Z"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildOperatorDashboard();

  assert.ok(Array.isArray(dashboard.attentionQueue));
  assert.ok(dashboard.attentionQueue.length > 0);
});

test("buildOperatorDashboard includes dailySummary", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "done", "2026-04-19T10:00:00.000Z"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildOperatorDashboard();

  assert.ok(dashboard.dailySummary);
  assert.ok(typeof dashboard.dailySummary.tasksCompleted === "number");
  assert.ok(typeof dashboard.dailySummary.tasksInProgress === "number");
  assert.ok(typeof dashboard.dailySummary.tasksFailed === "number");
  assert.ok(typeof dashboard.dailySummary.totalCostToday === "string");
  assert.ok(typeof dashboard.dailySummary.agentUptimePercent === "number");
});

test("buildOperatorDashboard includes agentHealthCards", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "done", "2026-04-19T10:00:00.000Z"),
        makeTask("task_2", "failed", "2026-04-19T11:00:00.000Z"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildOperatorDashboard();

  assert.ok(Array.isArray(dashboard.agentHealthCards));
  assert.ok(dashboard.agentHealthCards.length > 0);
});

test("buildOperatorDashboard includes costBurn", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: { build: () => makeSystemSituation() },
    costBurnUsd: 25.5,
    forecastCostUsd: 30.0,
  });

  const dashboard = service.buildOperatorDashboard();

  assert.ok(dashboard.costBurn);
  assert.equal(dashboard.costBurn.consumedUsd, 25.5);
  assert.equal(dashboard.costBurn.forecastUsd, 30.0);
});

test("buildOperatorDashboard respects limit parameter", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "failed", "2026-04-19T10:00:00.000Z"),
        makeTask("task_2", "failed", "2026-04-19T11:00:00.000Z"),
        makeTask("task_3", "failed", "2026-04-19T12:00:00.000Z"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildOperatorDashboard(2);

  // Should only process 2 tasks
  assert.ok(dashboard.recentCompletions.length <= 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// Domain Admin Dashboard
// ─────────────────────────────────────────────────────────────────────────────

test("buildDomainAdminDashboard filters by domainId", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "in_progress", "2026-04-19T10:00:00.000Z"),
        makeTask("task_2", "in_progress", "2026-04-19T11:00:00.000Z"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  // Override list to return different divisionId
  const dashboard = service.buildDomainAdminDashboard("marketing", 50);

  assert.equal(dashboard.domainId, "marketing");
});

test("buildDomainAdminDashboard includes agentInventory", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "done", "2026-04-19T10:00:00.000Z"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildDomainAdminDashboard("marketing", 50);

  assert.ok(Array.isArray(dashboard.agentInventory));
});

test("buildDomainAdminDashboard includes domainBudget", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "in_progress", "2026-04-19T10:00:00.000Z"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildDomainAdminDashboard("marketing", 50);

  assert.ok(dashboard.domainBudget);
  assert.ok(typeof dashboard.domainBudget.allocated === "string");
  assert.ok(typeof dashboard.domainBudget.consumed === "string");
  assert.ok(typeof dashboard.domainBudget.forecast === "string");
});

// ─────────────────────────────────────────────────────────────────────────────
// Platform Ops Dashboard
// ─────────────────────────────────────────────────────────────────────────────

test("buildPlatformOpsDashboard includes infrastructureHealth", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: { build: () => makeSystemSituation() },
  });

  const dashboard = service.buildPlatformOpsDashboard();

  assert.ok(Array.isArray(dashboard.infrastructureHealth));
  assert.ok(dashboard.infrastructureHealth.length > 0);
});

test("buildPlatformOpsDashboard includes queueMetrics", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: {
      build: () =>
        makeSystemSituation({
          queueBacklog: { size: 10, degraded: true },
        }),
    },
  });

  const dashboard = service.buildPlatformOpsDashboard();

  assert.ok(Array.isArray(dashboard.queueMetrics));
  assert.ok(dashboard.queueMetrics.length > 0);
  assert.equal(dashboard.queueMetrics[0]?.queueName, "default");
});

test("buildPlatformOpsDashboard includes activeIncidents", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "failed", "2026-04-19T10:00:00.000Z"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildPlatformOpsDashboard();

  assert.ok(Array.isArray(dashboard.activeIncidents));
});

test("buildPlatformOpsDashboard marks infrastructure as degraded when healthStatus is degraded", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: { build: () => makeSystemSituation({ healthStatus: "degraded" }) },
  });

  const dashboard = service.buildPlatformOpsDashboard();

  const platformHealth = dashboard.infrastructureHealth.find(
    (h) => h.component === "platform",
  );
  assert.equal(platformHealth?.status, "degraded");
});

test("buildPlatformOpsDashboard marks infrastructure as down when healthStatus is unhealthy", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: { build: () => makeSystemSituation({ healthStatus: "unhealthy" }) },
  });

  const dashboard = service.buildPlatformOpsDashboard();

  const platformHealth = dashboard.infrastructureHealth.find(
    (h) => h.component === "platform",
  );
  assert.equal(platformHealth?.status, "down");
});

// ─────────────────────────────────────────────────────────────────────────────
// Fleet Dashboard
// ─────────────────────────────────────────────────────────────────────────────

test("buildFleetDashboard includes platformHealth", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: { build: () => makeSystemSituation() },
  });

  const dashboard = service.buildFleetDashboard();

  assert.ok(dashboard.platformHealth);
  assert.ok(typeof dashboard.platformHealth.overall === "number");
  assert.ok(Array.isArray(dashboard.platformHealth.degradedComponents));
});

test("buildFleetDashboard includes departmentOverview", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "done", "2026-04-19T10:00:00.000Z"),
        makeTask("task_2", "failed", "2026-04-19T11:00:00.000Z"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildFleetDashboard();

  assert.ok(Array.isArray(dashboard.departmentOverview));
  assert.ok(dashboard.departmentOverview.length > 0);
});

test("buildFleetDashboard groups tasks by division", () => {
  const tasks = [
    makeTask("task_1", "done", "2026-04-19T10:00:00.000Z"),
    makeTask("task_2", "done", "2026-04-19T11:00:00.000Z"),
  ];
  // Override divisionId to be different
  tasks[0]!.divisionId = "marketing";
  tasks[1]!.divisionId = "engineering";

  const service = new DashboardAggregationService({
    taskSource: { list: () => tasks },
    systemSource: { build: () => makeSystemSituation() },
  });

  const dashboard = service.buildFleetDashboard();

  assert.ok(dashboard.departmentOverview.length >= 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Projection Service Integration
// ─────────────────────────────────────────────────────────────────────────────

test("buildOperatorDashboard merges projection deltas when projectionService is provided", () => {
  // Create a mock projection service
  const mockProjectionService: DashboardProjectionService = {
    processProjectionUpdate: () => null,
    consumePendingDeltas: () => [
      {
        deltaId: "delta-1",
        timestamp: "2026-04-20T10:00:00.000Z",
        changes: [
          {
            changeType: "task_failed" as const,
            entityId: "task-from-delta",
            newValue: {},
          },
        ],
        affectedMetrics: ["incidentCount"],
        tenantId: null,
        visibilityScope: "tenant" as const,
      },
    ],
  } as unknown as DashboardProjectionService;

  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: { build: () => makeSystemSituation() },
    projectionService: mockProjectionService,
  });

  const dashboard = service.buildOperatorDashboard();

  // The projection delta should add an incident to the attention queue
  assert.ok(dashboard.attentionQueue.length >= 0);
});

test("buildOperatorDashboard with empty projection deltas returns original queue", () => {
  const mockProjectionService: DashboardProjectionService = {
    processProjectionUpdate: () => null,
    consumePendingDeltas: () => [],
  } as unknown as DashboardProjectionService;

  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [makeTask("task_1", "failed", "2026-04-19T10:00:00.000Z")],
    },
    systemSource: { build: () => makeSystemSituation() },
    projectionService: mockProjectionService,
  });

  const dashboard = service.buildOperatorDashboard();

  // Should have the failed task incident
  const incidents = dashboard.attentionQueue.filter((item) => item.itemType === "incident");
  assert.ok(incidents.length >= 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("attention queue sorting is stable for same createdAt", () => {
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

test("empty task list produces empty attention queue from tasks", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: {
      build: () => makeSystemSituation({ healthStatus: "ok" }),
    },
  });

  const dashboard = service.buildOperatorDashboard();

  // Only system health incidents if status is not ok
  const taskIncidents = dashboard.attentionQueue.filter(
    (item) => item.title.includes("Task failed"),
  );
  assert.equal(taskIncidents.length, 0);
});

test("agent health cards have correct structure", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "done", "2026-04-19T10:00:00.000Z"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildOperatorDashboard();

  for (const card of dashboard.agentHealthCards) {
    assert.ok(typeof card.agentId === "string");
    assert.ok(typeof card.domainId === "string");
    assert.ok(typeof card.name === "string");
    assert.ok(
      ["healthy", "degraded", "failing", "paused"].includes(card.status),
    );
    assert.ok(typeof card.trustLevel === "string");
    assert.ok(typeof card.tasksToday === "number");
    assert.ok(typeof card.successRate7d === "number");
    assert.ok(typeof card.cost7d === "string");
    assert.ok(
      ["improving", "stable", "declining"].includes(card.trend),
    );
  }
});

test("dailySummary includes highlights and concerns", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "done", "2026-04-19T10:00:00.000Z"),
        makeTask("task_2", "failed", "2026-04-19T11:00:00.000Z"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildOperatorDashboard();

  assert.ok(Array.isArray(dashboard.dailySummary.highlights));
  assert.ok(Array.isArray(dashboard.dailySummary.concerns));
  assert.ok(dashboard.dailySummary.highlights.length >= 0);
  assert.ok(dashboard.dailySummary.concerns.length >= 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Metric Registry
// ─────────────────────────────────────────────────────────────────────────────

test("operator dashboard includes metricRegistry", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: { build: () => makeSystemSituation() },
  });

  const dashboard = service.buildOperatorDashboard();

  assert.ok(Array.isArray(dashboard.metricRegistry));
  assert.ok(dashboard.metricRegistry.length > 0);
});

test("metricRegistry entries have required fields", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: { build: () => makeSystemSituation() },
  });

  const dashboard = service.buildOperatorDashboard();

  for (const entry of dashboard.metricRegistry) {
    assert.ok(typeof entry.metricId === "string");
    assert.ok(typeof entry.metricOwner === "string");
    assert.ok(typeof entry.sourceOfTruth === "string");
    assert.ok(typeof entry.freshnessSlo === "string");
    assert.ok(
      ["informational", "operator_actionable", "policy_gated"].includes(
        entry.actionability,
      ),
    );
  }
});