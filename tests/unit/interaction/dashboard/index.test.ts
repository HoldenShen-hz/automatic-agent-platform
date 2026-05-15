import assert from "node:assert/strict";
import test from "node:test";

import { DashboardAggregationService, type AttentionItem } from "../../../../src/interaction/dashboard/index.js";
import type { TaskBoardItem } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { SystemSituation } from "../../../../src/platform/shared/observability/system-situation-model.js";

function makeTask(taskId: string, taskStatus: TaskBoardItem["taskStatus"], divisionId = "general_ops"): TaskBoardItem {
  return {
    taskId,
    title: `Task ${taskId}`,
    priority: "normal",
    taskStatus,
    workflowStatus: taskStatus === "done" ? "completed" : "running",
    divisionId,
    currentStepIndex: 0,
    sessionStatus: "open",
    latestEventAt: "2026-04-19T00:00:00.000Z",
    updatedAt: "2026-04-19T00:00:00.000Z",
  };
}

function makeSystemSituation(overrides: Partial<SystemSituation> = {}): SystemSituation {
  return {
    healthStatus: "degraded",
    providerHealth: {
      status: "degraded",
      successRate: 0.92,
      recentCalls: 50,
    },
    resourceUtilization: {
      memoryRssMb: 512,
      cpuPercent: 45,
      activeProcesses: 8,
    },
    queueBacklog: {
      size: 3,
      degraded: true,
    },
    eventBusBacklog: {
      tier1PendingAcks: 1,
    },
    findings: ["queue backlog elevated"],
    observedAt: Date.parse("2026-04-19T00:00:00.000Z"),
    ...overrides,
  };
}

test("DashboardAggregationService builds operator dashboard with attention queue and cost warning", () => {
  const suggestions: AttentionItem[] = [
    {
      itemType: "suggestion",
      priority: "normal",
      title: "建议优化广告预算",
      description: "CTR 下降，建议调整预算结构。",
      actionOptions: ["open_suggestion"],
      createdAt: "2026-04-19T00:01:00.000Z",
      domainId: "advertising",
    },
  ];

  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "failed", "engineering_ops"),
        makeTask("task_2", "pending", "finance"),
        makeTask("task_3", "done", "engineering_ops"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
    currentTime: () => "2026-04-19T00:02:00.000Z",
    costBurnUsd: 12,
    forecastCostUsd: 10,
    suggestions,
    activeGoals: [{ goalId: "goal_1", progressPercent: 60 }],
  });

  const dashboard = service.buildOperatorDashboard();

  assert.equal(dashboard.dailySummary.tasksFailed, 1);
  assert.ok(dashboard.attentionQueue.some((item) => item.itemType === "incident"));
  assert.ok(dashboard.attentionQueue.some((item) => item.itemType === "budget_warning"));
  assert.equal(dashboard.proactiveSuggestions.length, 1);
});

test("DashboardAggregationService sorts attention queue by priority before recency", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        {
          ...makeTask("task_1", "pending", "finance"),
          updatedAt: "2026-04-19T00:05:00.000Z",
        },
      ],
    },
    systemSource: {
      build: () => makeSystemSituation({ healthStatus: "unhealthy" }),
    },
    currentTime: () => "2026-04-19T00:01:00.000Z",
  });

  const dashboard = service.buildOperatorDashboard();

  assert.equal(dashboard.attentionQueue[0]?.priority, "critical");
  assert.equal(dashboard.attentionQueue[0]?.itemType, "incident");
});

test("DashboardAggregationService snapshot reflects backlog and incidents", async () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "in_progress"),
        makeTask("task_2", "failed"),
        makeTask("task_3", "done"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation({ healthStatus: "ok" }),
    },
    currentTime: () => "2026-04-19T00:00:00.000Z",
  });

  const snapshot = await service.getSnapshot();

  assert.equal(snapshot.workflowBacklog, 2);
  assert.equal(snapshot.incidentCount, 1);
  assert.equal(snapshot.budgetAlerts, 0);
});

test("DashboardAggregationService builds fleet dashboard grouped by division", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "in_progress", "engineering_ops"),
        makeTask("task_2", "failed", "engineering_ops"),
        makeTask("task_3", "pending", "finance"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation({ healthStatus: "unhealthy" }),
    },
  });

  const dashboard = service.buildFleetDashboard();

  assert.equal(dashboard.platformHealth.overall, 58);
  assert.equal(dashboard.departmentOverview.length, 2);
  assert.ok(dashboard.departmentOverview.some((item) => item.departmentId === "engineering_ops"));
});

test("DashboardAggregationService buildDomainAdminDashboard filters by domainId", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "in_progress", "engineering_ops"),
        makeTask("task_2", "pending", "engineering_ops"),
        makeTask("task_3", "done", "finance"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
    currentTime: () => "2026-04-19T00:00:00.000Z",
  });

  const dashboard = service.buildDomainAdminDashboard("engineering_ops");

  assert.equal(dashboard.domainId, "engineering_ops");
  assert.equal(dashboard.activeWorkflows.length, 2);
  assert.equal(dashboard.pendingApprovals.length, 1);
});

test("DashboardAggregationService buildDomainAdminDashboard returns empty for unknown domain", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "in_progress", "engineering_ops"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildDomainAdminDashboard("unknown_domain");

  assert.equal(dashboard.domainId, "unknown_domain");
  assert.equal(dashboard.agentInventory.length, 0);
  assert.equal(dashboard.activeWorkflows.length, 0);
});

test("DashboardAggregationService buildDomainAdminDashboard calculates domain budget", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "in_progress", "engineering_ops"),
        makeTask("task_2", "pending", "engineering_ops"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildDomainAdminDashboard("engineering_ops");

  assert.ok(dashboard.domainBudget.allocated);
  assert.ok(dashboard.domainBudget.consumed);
  assert.ok(dashboard.domainBudget.forecast);
  assert.ok(dashboard.domainBudget.allocated.startsWith("$"));
});

test("DashboardAggregationService buildPlatformOpsDashboard returns infrastructure health", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [],
    },
    systemSource: {
      build: () => makeSystemSituation({ healthStatus: "ok" }),
    },
    currentTime: () => "2026-04-19T00:00:00.000Z",
  });

  const dashboard = service.buildPlatformOpsDashboard();

  assert.equal(dashboard.infrastructureHealth.length, 2);
  assert.ok(dashboard.infrastructureHealth.some((c) => c.component === "platform"));
  assert.ok(dashboard.infrastructureHealth.some((c) => c.component === "model_gateway"));
});

test("DashboardAggregationService buildPlatformOpsDashboard returns queue metrics", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [],
    },
    systemSource: {
      build: () => makeSystemSituation({ healthStatus: "degraded" }),
    },
  });

  const dashboard = service.buildPlatformOpsDashboard();

  assert.equal(dashboard.queueMetrics.length, 1);
  assert.equal(dashboard.queueMetrics[0]!.queueName, "default");
  assert.equal(dashboard.queueMetrics[0]!.dlqCount, 0);
});

test("DashboardAggregationService buildPlatformOpsDashboard includes active incidents", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "failed"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildPlatformOpsDashboard();

  assert.ok(dashboard.activeIncidents.length > 0);
  assert.equal(dashboard.activeIncidents[0]!.itemType, "incident");
});

test("DashboardAggregationService buildPlatformOpsDashboard marks platform as down when unhealthy", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [],
    },
    systemSource: {
      build: () => makeSystemSituation({ healthStatus: "unhealthy" }),
    },
  });

  const dashboard = service.buildPlatformOpsDashboard();

  const platform = dashboard.infrastructureHealth.find((c) => c.component === "platform");
  assert.equal(platform!.status, "down");
  assert.ok(platform!.uptime30d < 99);
});

test("DashboardAggregationService buildPlatformOpsDashboard marks model_gateway as down when provider failed", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [],
    },
    systemSource: {
      build: () => makeSystemSituation({
        providerHealth: { status: "failed", successRate: 0.3, recentCalls: 1000 },
      }),
    },
  });

  const dashboard = service.buildPlatformOpsDashboard();

  const modelGateway = dashboard.infrastructureHealth.find((c) => c.component === "model_gateway");
  assert.equal(modelGateway!.status, "down");
});

test("DashboardAggregationService respects limit parameter for buildOperatorDashboard", () => {
  const tasks = Array.from({ length: 50 }, (_, i) => makeTask(`task_${i}`, i % 3 === 0 ? "done" : "in_progress"));
  const service = new DashboardAggregationService({
    taskSource: { list: (limit) => (limit ? tasks.slice(0, limit) : tasks) },
    systemSource: { build: () => makeSystemSituation({ healthStatus: "ok" }) },
  });

  const dashboard = service.buildOperatorDashboard(10);

  assert.ok(dashboard.agentHealthCards.length > 0);
});

test("DashboardAggregationService respects limit parameter for buildDomainAdminDashboard", () => {
  const tasks = Array.from({ length: 60 }, (_, i) => makeTask(`task_${i}`, "in_progress", "engineering_ops"));
  const service = new DashboardAggregationService({
    taskSource: { list: (limit) => (limit ? tasks.slice(0, limit) : tasks) },
    systemSource: { build: () => makeSystemSituation() },
  });

  const dashboard = service.buildDomainAdminDashboard("engineering_ops", 20);

  assert.ok(dashboard.activeWorkflows.length <= 20);
});

test("DashboardAggregationService getSnapshot returns budgetAlerts when cost exceeds forecast", async () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: { build: () => makeSystemSituation({ healthStatus: "ok" }) },
    costBurnUsd: 100,
    forecastCostUsd: 50,
  });

  const snapshot = await service.getSnapshot();

  assert.equal(snapshot.budgetAlerts, 1);
});

test("DashboardAggregationService getSnapshot returns zero budgetAlerts when cost is within forecast", async () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: { build: () => makeSystemSituation({ healthStatus: "ok" }) },
    costBurnUsd: 50,
    forecastCostUsd: 100,
  });

  const snapshot = await service.getSnapshot();

  assert.equal(snapshot.budgetAlerts, 0);
});

test("DashboardAggregationService getSnapshot returns zero budgetAlerts when forecast is zero", async () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: { build: () => makeSystemSituation({ healthStatus: "ok" }) },
    costBurnUsd: 100,
    forecastCostUsd: 0,
  });

  const snapshot = await service.getSnapshot();

  assert.equal(snapshot.budgetAlerts, 0);
});

test("DashboardAggregationService buildOperatorDashboard includes cost burn data", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: { build: () => makeSystemSituation({ healthStatus: "ok" }) },
    costBurnUsd: 42.50,
    forecastCostUsd: 100,
  });

  const dashboard = service.buildOperatorDashboard();

  assert.equal(dashboard.costBurn.consumedUsd, 42.50);
  assert.equal(dashboard.costBurn.forecastUsd, 100);
});

test("DashboardAggregationService buildOperatorDashboard includes active goals", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: { build: () => makeSystemSituation({ healthStatus: "ok" }) },
    activeGoals: [
      { goalId: "goal_1", progressPercent: 30 },
      { goalId: "goal_2", progressPercent: 75 },
    ],
  });

  const dashboard = service.buildOperatorDashboard();

  assert.equal(dashboard.activeGoals.length, 2);
  assert.equal(dashboard.activeGoals[0]!.progressPercent, 30);
});

test("DashboardAggregationService buildFleetDashboard calculates health scores per department", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "failed", "engineering_ops"),
        makeTask("task_2", "failed", "engineering_ops"),
        makeTask("task_3", "in_progress", "engineering_ops"),
        makeTask("task_4", "pending", "finance"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation({ healthStatus: "ok" }),
    },
  });

  const dashboard = service.buildFleetDashboard();

  const engOps = dashboard.departmentOverview.find((d) => d.departmentId === "engineering_ops");
  assert.ok(engOps);
  assert.equal(engOps!.incidentsOpen, 2);
  // activeWorkflows counts all non-done tasks: 2 failed + 1 in_progress = 3
  assert.equal(engOps!.activeWorkflows, 3);
  // Health score: 100 - (2 * 20) = 60
  assert.equal(engOps!.healthScore, 60);
});

test("DashboardAggregationService buildFleetDashboard handles department with no tasks", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: { build: () => makeSystemSituation({ healthStatus: "ok" }) },
  });

  const dashboard = service.buildFleetDashboard();

  assert.equal(dashboard.platformHealth.overall, 92);
  assert.deepEqual(dashboard.departmentOverview, []);
});

test("DashboardAggregationService buildFleetDashboard degrades overall health for degraded system", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: { build: () => makeSystemSituation({ healthStatus: "degraded" }) },
  });

  const dashboard = service.buildFleetDashboard();

  assert.equal(dashboard.platformHealth.overall, 75);
  assert.ok(dashboard.platformHealth.degradedComponents.length > 0);
});

test("DashboardAggregationService defaults costBurnUsd and forecastCostUsd to 0", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: { build: () => makeSystemSituation() },
  });

  const dashboard = service.buildOperatorDashboard();

  assert.equal(dashboard.costBurn.consumedUsd, 0);
  assert.equal(dashboard.costBurn.forecastUsd, 0);
});

test("DashboardAggregationService defaults activeGoals and suggestions to empty arrays", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: { build: () => makeSystemSituation() },
  });

  const dashboard = service.buildOperatorDashboard();

  assert.equal(dashboard.activeGoals.length, 0);
  assert.equal(dashboard.proactiveSuggestions.length, 0);
});
