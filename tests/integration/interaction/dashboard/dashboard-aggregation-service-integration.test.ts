import assert from "node:assert/strict";
import test from "node:test";

import {
  DashboardAggregationService,
  type DashboardTaskSource,
  type DashboardSystemSource,
} from "../../../../src/interaction/dashboard/index.js";
import type { TaskBoardItem } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { SystemSituation } from "../../../../src/platform/shared/observability/system-situation-model.js";

function makeTaskBoardItem(overrides: Partial<TaskBoardItem> = {}): TaskBoardItem {
  return {
    taskId: "task-test-1",
    title: "Test Task",
    taskStatus: "done",
    createdAt: "2026-04-19T00:00:00.000Z",
    updatedAt: "2026-04-19T00:00:00.000Z",
    divisionId: "general_ops",
    ...overrides,
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
      size: 5,
      degraded: false,
    },
    eventBusBacklog: {
      tier1PendingAcks: 0,
    },
    findings: [],
    observedAt: Date.parse("2026-04-19T00:00:00.000Z"),
    ...overrides,
  };
}

test("DashboardAggregationService.getSnapshot returns snapshot", async () => {
  const taskSource: DashboardTaskSource = {
    list: () => [makeTaskBoardItem({ taskStatus: "done" })],
  };
  const systemSource: DashboardSystemSource = {
    build: () => makeSystemSituation(),
  };
  const service = new DashboardAggregationService({ taskSource, systemSource });

  const snapshot = await service.getSnapshot();

  assert.ok(snapshot.generatedAt.length > 0);
  assert.equal(snapshot.workflowBacklog, 0);
  assert.equal(snapshot.incidentCount, 0);
});

test("DashboardAggregationService.buildOperatorDashboard returns dashboard", () => {
  const taskSource: DashboardTaskSource = {
    list: () => [
      makeTaskBoardItem({ taskId: "task-1", taskStatus: "done" }),
      makeTaskBoardItem({ taskId: "task-2", taskStatus: "in_progress" }),
      makeTaskBoardItem({ taskId: "task-3", taskStatus: "failed" }),
    ],
  };
  const systemSource: DashboardSystemSource = {
    build: () => makeSystemSituation(),
  };
  const service = new DashboardAggregationService({ taskSource, systemSource });

  const dashboard = service.buildOperatorDashboard();

  assert.ok(dashboard.attentionQueue.length > 0);
  assert.ok(dashboard.dailySummary);
  assert.ok(dashboard.agentHealthCards.length > 0);
  assert.ok(dashboard.costBurn);
});

test("DashboardAggregationService.buildOperatorDashboard includes failed tasks as incidents", () => {
  const taskSource: DashboardTaskSource = {
    list: () => [
      makeTaskBoardItem({ taskId: "task-failed", taskStatus: "failed" }),
    ],
  };
  const systemSource: DashboardSystemSource = {
    build: () => makeSystemSituation(),
  };
  const service = new DashboardAggregationService({ taskSource, systemSource });

  const dashboard = service.buildOperatorDashboard();

  const incidentItems = dashboard.attentionQueue.filter((item) => item.itemType === "incident");
  assert.ok(incidentItems.length > 0);
});

test("DashboardAggregationService.buildOperatorDashboard includes pending tasks as approval_needed", () => {
  const taskSource: DashboardTaskSource = {
    list: () => [
      makeTaskBoardItem({ taskId: "task-pending", taskStatus: "pending" }),
    ],
  };
  const systemSource: DashboardSystemSource = {
    build: () => makeSystemSituation(),
  };
  const service = new DashboardAggregationService({ taskSource, systemSource });

  const dashboard = service.buildOperatorDashboard();

  const approvalItems = dashboard.attentionQueue.filter((item) => item.itemType === "approval_needed");
  assert.ok(approvalItems.length > 0);
});

test("DashboardAggregationService.buildDomainAdminDashboard filters by domain", () => {
  const taskSource: DashboardTaskSource = {
    list: () => [
      makeTaskBoardItem({ taskId: "task-ops", taskStatus: "in_progress", divisionId: "devops" }),
      makeTaskBoardItem({ taskId: "task-eng", taskStatus: "in_progress", divisionId: "engineering" }),
    ],
  };
  const systemSource: DashboardSystemSource = {
    build: () => makeSystemSituation(),
  };
  const service = new DashboardAggregationService({ taskSource, systemSource });

  const dashboard = service.buildDomainAdminDashboard("devops");

  assert.equal(dashboard.domainId, "devops");
  assert.ok(dashboard.agentInventory.length > 0);
});

test("DashboardAggregationService.buildPlatformOpsDashboard returns ops dashboard", () => {
  const taskSource: DashboardTaskSource = {
    list: () => [
      makeTaskBoardItem({ taskId: "task-1", taskStatus: "failed" }),
    ],
  };
  const systemSource: DashboardSystemSource = {
    build: () => makeSystemSituation({ healthStatus: "degraded" }),
  };
  const service = new DashboardAggregationService({ taskSource, systemSource });

  const dashboard = service.buildPlatformOpsDashboard();

  assert.ok(dashboard.infrastructureHealth.length > 0);
  assert.ok(dashboard.queueMetrics.length > 0);
  assert.ok(dashboard.activeIncidents.length > 0);
});

test("DashboardAggregationService.buildFleetDashboard aggregates by division", () => {
  const taskSource: DashboardTaskSource = {
    list: () => [
      makeTaskBoardItem({ taskId: "task-1", taskStatus: "done", divisionId: "devops" }),
      makeTaskBoardItem({ taskId: "task-2", taskStatus: "in_progress", divisionId: "devops" }),
      makeTaskBoardItem({ taskId: "task-3", taskStatus: "done", divisionId: "marketing" }),
    ],
  };
  const systemSource: DashboardSystemSource = {
    build: () => makeSystemSituation(),
  };
  const service = new DashboardAggregationService({ taskSource, systemSource });

  const dashboard = service.buildFleetDashboard();

  assert.ok(dashboard.platformHealth.overall > 0);
  assert.ok(dashboard.departmentOverview.length >= 1);
});

test("DashboardAggregationService includes budget_warning when cost exceeds forecast", () => {
  const taskSource: DashboardTaskSource = {
    list: () => [],
  };
  const systemSource: DashboardSystemSource = {
    build: () => makeSystemSituation(),
  };
  const service = new DashboardAggregationService({
    taskSource,
    systemSource,
    costBurnUsd: 100,
    forecastCostUsd: 50,
  });

  const dashboard = service.buildOperatorDashboard();

  const budgetWarnings = dashboard.attentionQueue.filter((item) => item.itemType === "budget_warning");
  assert.ok(budgetWarnings.length > 0);
});

test("DashboardAggregationService costBurn includes consumed and forecast", () => {
  const taskSource: DashboardTaskSource = {
    list: () => [],
  };
  const systemSource: DashboardSystemSource = {
    build: () => makeSystemSituation(),
  };
  const service = new DashboardAggregationService({
    taskSource,
    systemSource,
    costBurnUsd: 75.50,
    forecastCostUsd: 100,
  });

  const dashboard = service.buildOperatorDashboard();

  assert.equal(dashboard.costBurn.consumedUsd, 75.50);
  assert.equal(dashboard.costBurn.forecastUsd, 100);
});
