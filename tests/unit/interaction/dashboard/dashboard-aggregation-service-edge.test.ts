/**
 * Additional edge case tests for DashboardAggregationService
 */

import assert from "node:assert/strict";
import test from "node:test";
import { DashboardAggregationService } from "../../../../src/interaction/dashboard/index.js";
import type { TaskBoardItem } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
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
    latestEventAt: "2026-04-20T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z",
  };
}

function makeSystemSituation(overrides: Partial<SystemSituation> = {}): SystemSituation {
  return {
    healthStatus: "ok",
    providerHealth: {
      status: "healthy",
      successRate: 0.99,
      recentCalls: 100,
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
    observedAt: Date.now(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases for buildFleetDashboard
// ─────────────────────────────────────────────────────────────────────────────

test("buildFleetDashboard healthScore does not go below 20", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "failed", "ops"),
        makeTask("task_2", "failed", "ops"),
        makeTask("task_3", "failed", "ops"),
        makeTask("task_4", "failed", "ops"),
        makeTask("task_5", "failed", "ops"), // 5 incidents would be 100 - 100 = 0, but min is 20
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildFleetDashboard();
  const ops = dashboard.departmentOverview.find((d) => d.departmentId === "ops");

  // healthScore = max(20, 100 - 5*20) = max(20, 0) = 20
  assert.equal(ops!.healthScore, 20);
});

test("buildFleetDashboard agentCount uses general_ops when all tasks have same divisionId", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "done", "finance"),
        makeTask("task_2", "done", "finance"),
        makeTask("task_3", "done", "finance"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildFleetDashboard();
  const finance = dashboard.departmentOverview.find((d) => d.departmentId === "finance");

  // Should have exactly 1 agent for finance
  assert.equal(finance!.agentCount, 1);
});

test("buildFleetDashboard with tasks having undefined divisionId uses general_ops", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        { ...makeTask("task_1", "done"), divisionId: undefined as unknown as string },
        { ...makeTask("task_2", "done"), divisionId: undefined as unknown as string },
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildFleetDashboard();

  // Tasks with undefined divisionId should be grouped under "general_ops"
  const generalOps = dashboard.departmentOverview.find((d) => d.departmentId === "general_ops");
  assert.ok(generalOps);
  assert.equal(generalOps!.agentCount, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases for buildPlatformOpsDashboard
// ─────────────────────────────────────────────────────────────────────────────

test("buildPlatformOpsDashboard with providerHealth having failed status", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: {
      build: () => makeSystemSituation({
        providerHealth: { status: "failed", successRate: 0.1, recentCalls: 1000 },
      }),
    },
  });

  const dashboard = service.buildPlatformOpsDashboard();

  const modelGateway = dashboard.infrastructureHealth.find((c) => c.component === "model_gateway");
  assert.equal(modelGateway!.status, "down");
  assert.ok(modelGateway!.uptime30d < 50);
});

test("buildPlatformOpsDashboard with providerHealth having degraded status", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: {
      build: () => makeSystemSituation({
        providerHealth: { status: "degraded", successRate: 0.7, recentCalls: 500 },
      }),
    },
  });

  const dashboard = service.buildPlatformOpsDashboard();

  const modelGateway = dashboard.infrastructureHealth.find((c) => c.component === "model_gateway");
  assert.equal(modelGateway!.status, "degraded");
  assert.ok(modelGateway!.uptime30d >= 50 && modelGateway!.uptime30d < 100);
});

test("buildPlatformOpsDashboard with empty queue name", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: {
      build: () => makeSystemSituation({ queueBacklog: { size: 0, degraded: false } }),
    },
  });

  const dashboard = service.buildPlatformOpsDashboard();

  assert.equal(dashboard.queueMetrics[0]!.depth, 0);
  assert.equal(dashboard.queueMetrics[0]!.avgWaitMs, 250);
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases for getSnapshot
// ─────────────────────────────────────────────────────────────────────────────

test("getSnapshot returns zero counts when no failed or pending tasks", async () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "done"),
        makeTask("task_2", "in_progress"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation({ healthStatus: "ok" }),
    },
  });

  const snapshot = await service.getSnapshot();

  assert.equal(snapshot.incidentCount, 0);
  assert.equal(snapshot.budgetAlerts, 0);
  assert.equal(snapshot.workflowBacklog, 1); // only in_progress
});

test("getSnapshot counts budget warnings from attention queue", async () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: {
      build: () => makeSystemSituation({ healthStatus: "ok" }),
    },
    costBurnUsd: 100,
    forecastCostUsd: 50,
  });

  const snapshot = await service.getSnapshot();

  assert.equal(snapshot.budgetAlerts, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases for domain budget calculation
// ─────────────────────────────────────────────────────────────────────────────

test("buildDomainAdminDashboard calculates budget even with zero tasks", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildDomainAdminDashboard("new_domain");

  // With 0 tasks: allocated = max(10, 0 * 0.2) = $10.00
  assert.ok(dashboard.domainBudget.allocated.startsWith("$10"));
});

test("buildDomainAdminDashboard budget scales with task count", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => Array.from({ length: 20 }, (_, i) => makeTask(`task_${i}`, "in_progress", "engineering")),
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildDomainAdminDashboard("engineering");

  // consumed = 20 * 0.05 = $1.00
  assert.ok(dashboard.domainBudget.consumed.startsWith("$1"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases for daily summary
// ─────────────────────────────────────────────────────────────────────────────

test("buildOperatorDashboard daily summary with no tasks", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: {
      build: () => makeSystemSituation({ healthStatus: "ok" }),
    },
  });

  const dashboard = service.buildOperatorDashboard();

  assert.equal(dashboard.dailySummary.tasksCompleted, 0);
  assert.equal(dashboard.dailySummary.tasksInProgress, 0);
  assert.equal(dashboard.dailySummary.tasksFailed, 0);
  assert.equal(dashboard.dailySummary.totalCostToday, "$0.00");
  assert.ok(dashboard.dailySummary.highlights.length > 0);
});

test("buildOperatorDashboard highlights include task count", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "done"),
        makeTask("task_2", "done"),
        makeTask("task_3", "done"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation({ queueBacklog: { size: 5, degraded: false } }),
    },
  });

  const dashboard = service.buildOperatorDashboard();

  assert.ok(dashboard.dailySummary.highlights.some((h) => h.includes("3 tasks completed")));
  assert.ok(dashboard.dailySummary.highlights.some((h) => h.includes("5 tasks currently queued")));
});

test("buildOperatorDashboard concerns are limited to 3", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "failed", "ops"),
        makeTask("task_2", "failed", "ops"),
        makeTask("task_3", "failed", "ops"),
        makeTask("task_4", "failed", "ops"),
        makeTask("task_5", "failed", "ops"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildOperatorDashboard();

  assert.ok(dashboard.dailySummary.concerns.length <= 3);
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases for agent health cards
// ─────────────────────────────────────────────────────────────────────────────

test("buildOperatorDashboard agent card has correct trend when no tasks completed", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "in_progress", "ops"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildOperatorDashboard();
  const opsCard = dashboard.agentHealthCards.find((card) => card.domainId === "ops");

  assert.equal(opsCard!.trend, "stable");
});

test("buildOperatorDashboard agent card shows declining trend when tasks failed", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "done", "ops"),
        makeTask("task_2", "failed", "ops"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildOperatorDashboard();
  const opsCard = dashboard.agentHealthCards.find((card) => card.domainId === "ops");

  assert.equal(opsCard!.trend, "declining");
});

test("buildOperatorDashboard agent card shows improving trend when tasks done and no failures", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "done", "ops"),
        makeTask("task_2", "done", "ops"),
        makeTask("task_3", "in_progress", "ops"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildOperatorDashboard();
  const opsCard = dashboard.agentHealthCards.find((card) => card.domainId === "ops");

  assert.equal(opsCard!.trend, "improving");
});

test("buildOperatorDashboard successRate7d is between 0 and 1", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "done", "ops"),
        makeTask("task_2", "done", "ops"),
        makeTask("task_3", "failed", "ops"),
        makeTask("task_4", "in_progress", "ops"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildOperatorDashboard();
  const opsCard = dashboard.agentHealthCards.find((card) => card.domainId === "ops");

  assert.ok(opsCard!.successRate7d >= 0 && opsCard!.successRate7d <= 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases for attention queue ordering
// ─────────────────────────────────────────────────────────────────────────────

test("buildOperatorDashboard attentionQueue keeps newest items first within the same priority", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("late_task", "failed", "ops"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation({ healthStatus: "degraded" }),
    },
  });

  const dashboard = service.buildOperatorDashboard();

  // Failed task and platform incident share high priority; the newer platform incident should sort first.
  const systemIncident = dashboard.attentionQueue[0];
  assert.ok(systemIncident!.title.includes("Platform health degraded"));
});

test("buildOperatorDashboard creates incident for unhealthy system regardless of tasks", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: {
      build: () => makeSystemSituation({ healthStatus: "unhealthy" }),
    },
  });

  const dashboard = service.buildOperatorDashboard();

  const systemIncident = dashboard.attentionQueue.find(
    (item) => item.title.includes("Platform health degraded"),
  );
  assert.ok(systemIncident);
  assert.equal(systemIncident!.priority, "critical");
  assert.equal(systemIncident!.itemType, "incident");
});
