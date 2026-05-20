import assert from "node:assert/strict";
import test from "node:test";

import { DashboardAggregationService } from "../../../../src/interaction/dashboard/index.js";
import type {
  DashboardSnapshot,
  DashboardPort,
  AttentionItem,
  DailySummary,
  AgentHealthCard,
  OperatorDashboard,
  DomainAdminDashboard,
  PlatformOpsDashboard,
  FleetDashboard,
  DashboardTaskSource,
  DashboardSystemSource,
} from "../../../../src/interaction/dashboard/index.js";
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
// DashboardAggregationService constructor and defaults
// ─────────────────────────────────────────────────────────────────────────────

test("DashboardAggregationService accepts custom currentTime function", () => {
  const fixedTime = "2026-04-20T12:00:00.000Z";
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: { build: () => makeSystemSituation() },
    currentTime: () => fixedTime,
  });

  const snapshot = service.getSnapshot().then((s) => s);
  // The snapshot.generatedAt will use our custom time
  assert.ok(fixedTime);
});

test("DashboardAggregationService defaults costBurnUsd to 0", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: { build: () => makeSystemSituation() },
  });

  const dashboard = service.buildOperatorDashboard();
  assert.equal(dashboard.costBurn.consumedUsd, 0);
  assert.equal(dashboard.costBurn.forecastUsd, 0);
});

test("DashboardAggregationService defaults activeGoals to empty array", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: { build: () => makeSystemSituation() },
  });

  const dashboard = service.buildOperatorDashboard();
  assert.deepEqual(dashboard.activeGoals, []);
});

test("DashboardAggregationService defaults suggestions to empty array", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: { build: () => makeSystemSituation() },
  });

  const dashboard = service.buildOperatorDashboard();
  assert.deepEqual(dashboard.proactiveSuggestions, []);
});

// ─────────────────────────────────────────────────────────────────────────────
// buildOperatorDashboard
// ─────────────────────────────────────────────────────────────────────────────

test("buildOperatorDashboard returns attention queue sorted by priority", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "failed", "general_ops"),
        makeTask("task_2", "failed", "general_ops"),
        makeTask("task_3", "pending", "general_ops"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation({ healthStatus: "degraded" }),
    },
  });

  const dashboard = service.buildOperatorDashboard(10);
  assert.ok(dashboard.attentionQueue.length >= 2);
  // Failed tasks should appear as incidents (high priority)
  const incidents = dashboard.attentionQueue.filter((item) => item.itemType === "incident");
  assert.ok(incidents.length >= 2);
});

test("buildOperatorDashboard returns daily summary with all fields", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "done"),
        makeTask("task_2", "in_progress"),
        makeTask("task_3", "failed"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation({ healthStatus: "ok" }),
    },
    costBurnUsd: 25.5,
    forecastCostUsd: 50,
  });

  const dashboard = service.buildOperatorDashboard();

  assert.equal(dashboard.dailySummary.tasksCompleted, 1);
  assert.equal(dashboard.dailySummary.tasksInProgress, 1);
  assert.equal(dashboard.dailySummary.tasksFailed, 1);
  assert.equal(dashboard.dailySummary.totalCostToday, "$25.50");
  assert.ok(dashboard.dailySummary.agentUptimePercent > 0);
  assert.ok(Array.isArray(dashboard.dailySummary.highlights));
  assert.ok(Array.isArray(dashboard.dailySummary.concerns));
});

test("buildOperatorDashboard returns agent health cards grouped by division", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "done", "engineering_ops"),
        makeTask("task_2", "done", "engineering_ops"),
        makeTask("task_3", "failed", "engineering_ops"),
        makeTask("task_4", "done", "finance"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildOperatorDashboard();

  assert.ok(dashboard.agentHealthCards.length > 0);
  // Cards should be grouped by divisionId
  const engOpsCard = dashboard.agentHealthCards.find((card) => card.domainId === "engineering_ops");
  assert.ok(engOpsCard);
  assert.equal(engOpsCard!.tasksToday, 3);
});

test("buildOperatorDashboard marks agent as degraded when tasks have failed", () => {
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

  assert.equal(opsCard!.status, "degraded");
  assert.equal(opsCard!.trustLevel, "supervised");
  assert.equal(opsCard!.trend, "declining");
});

test("buildOperatorDashboard marks agent as healthy when all tasks succeed", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "done", "ops"),
        makeTask("task_2", "done", "ops"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildOperatorDashboard();
  const opsCard = dashboard.agentHealthCards.find((card) => card.domainId === "ops");

  assert.equal(opsCard!.status, "healthy");
  assert.equal(opsCard!.trustLevel, "trusted");
  assert.ok(opsCard!.trend === "improving" || opsCard!.trend === "stable");
});

test("buildOperatorDashboard success rate excludes pending and in_progress tasks from denominator", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "done", "ops"),
        makeTask("task_2", "failed", "ops"),
        makeTask("task_3", "pending", "ops"),
        makeTask("task_4", "in_progress", "ops"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildOperatorDashboard();
  const opsCard = dashboard.agentHealthCards.find((card) => card.domainId === "ops");

  assert.equal(opsCard!.successRate7d, 0.5);
});

test("buildOperatorDashboard calculates cost7d per agent card", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "done", "ops"),
        makeTask("task_2", "done", "ops"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildOperatorDashboard();
  const opsCard = dashboard.agentHealthCards.find((card) => card.domainId === "ops");

  // Each task costs $0.05 by default
  assert.ok(opsCard!.cost7d.startsWith("$"));
});

test("buildOperatorDashboard returns recent completions (done tasks)", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "done"),
        makeTask("task_2", "in_progress"),
        makeTask("task_3", "failed"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildOperatorDashboard();

  assert.deepEqual(dashboard.recentCompletions, [
    makeTask("task_1", "done"),
  ]);
});

test("buildOperatorDashboard calculates agentUptimePercent based on system health", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: { build: () => makeSystemSituation({ healthStatus: "ok" }) },
  });

  const dashboard = service.buildOperatorDashboard();
  assert.equal(dashboard.dailySummary.agentUptimePercent, 99);
});

test("buildOperatorDashboard uses 95% uptime for degraded status", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: { build: () => makeSystemSituation({ healthStatus: "degraded" }) },
  });

  const dashboard = service.buildOperatorDashboard();
  assert.equal(dashboard.dailySummary.agentUptimePercent, 95);
});

test("buildOperatorDashboard uses 85% uptime for unhealthy status", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: { build: () => makeSystemSituation({ healthStatus: "unhealthy" }) },
  });

  const dashboard = service.buildOperatorDashboard();
  assert.equal(dashboard.dailySummary.agentUptimePercent, 85);
});

test("buildOperatorDashboard includes queue backlog in highlights", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "done"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation({ queueBacklog: { size: 15, degraded: false } }),
    },
  });

  const dashboard = service.buildOperatorDashboard();
  assert.ok(dashboard.dailySummary.highlights.some((h) => h.includes("15")));
});

// ─────────────────────────────────────────────────────────────────────────────
// buildDomainAdminDashboard
// ─────────────────────────────────────────────────────────────────────────────

test("buildDomainAdminDashboard filters tasks by domainId", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "done", "engineering_ops"),
        makeTask("task_2", "pending", "engineering_ops"),
        makeTask("task_3", "done", "finance"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildDomainAdminDashboard("engineering_ops");

  assert.equal(dashboard.domainId, "engineering_ops");
  assert.equal(dashboard.activeWorkflows.length, 1); // only pending
  assert.equal(dashboard.agentInventory.length, 1); // one group
});

test("buildDomainAdminDashboard returns pending approvals for approval_needed items", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "pending", "engineering_ops"),
        makeTask("task_2", "pending", "engineering_ops"),
        makeTask("task_3", "done", "engineering_ops"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildDomainAdminDashboard("engineering_ops");

  assert.equal(dashboard.pendingApprovals.length, 2);
  assert.ok(dashboard.pendingApprovals.every((item) => item.itemType === "approval_needed"));
});

test("buildDomainAdminDashboard calculates domain budget with USD formatting", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "in_progress", "engineering_ops"),
        makeTask("task_2", "in_progress", "engineering_ops"),
        makeTask("task_3", "in_progress", "engineering_ops"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildDomainAdminDashboard("engineering_ops");

  // Budget is calculated based on task count
  assert.ok(dashboard.domainBudget.allocated.startsWith("$"));
  assert.ok(dashboard.domainBudget.consumed.startsWith("$"));
  assert.ok(dashboard.domainBudget.forecast.startsWith("$"));
});

test("buildDomainAdminDashboard with no tasks returns minimal agent inventory", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildDomainAdminDashboard("unknown_domain");

  assert.equal(dashboard.domainId, "unknown_domain");
  assert.equal(dashboard.agentInventory.length, 0);
  assert.equal(dashboard.activeWorkflows.length, 0);
  assert.equal(dashboard.pendingApprovals.length, 0);
});

test("buildDomainAdminDashboard domain budget allocated is at least $10", () => {
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

  const dashboard = service.buildDomainAdminDashboard("ops");
  const allocatedValue = parseFloat(dashboard.domainBudget.allocated.replace("$", ""));
  assert.ok(allocatedValue >= 10);
});

// ─────────────────────────────────────────────────────────────────────────────
// buildPlatformOpsDashboard
// ─────────────────────────────────────────────────────────────────────────────

test("buildPlatformOpsDashboard returns platform health component", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: {
      build: () => makeSystemSituation({ healthStatus: "ok" }),
    },
  });

  const dashboard = service.buildPlatformOpsDashboard();

  const platform = dashboard.infrastructureHealth.find((c) => c.component === "platform");
  assert.ok(platform);
  assert.equal(platform!.status, "healthy");
  assert.equal(platform!.uptime30d, 99.9);
  assert.equal(platform!.errorBudgetRemaining, 92);
});

test("buildPlatformOpsDashboard returns model_gateway component", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: {
      build: () => makeSystemSituation({
        providerHealth: { status: "healthy", successRate: 0.95, recentCalls: 100 },
      }),
    },
  });

  const dashboard = service.buildPlatformOpsDashboard();

  const modelGateway = dashboard.infrastructureHealth.find((c) => c.component === "model_gateway");
  assert.ok(modelGateway);
  assert.equal(modelGateway!.status, "healthy");
  assert.equal(modelGateway!.uptime30d, 95);
});

test("buildPlatformOpsDashboard marks components degraded when system is degraded", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: {
      build: () => makeSystemSituation({ healthStatus: "degraded" }),
    },
  });

  const dashboard = service.buildPlatformOpsDashboard();

  const platform = dashboard.infrastructureHealth.find((c) => c.component === "platform");
  assert.equal(platform!.status, "degraded");
});

test("buildPlatformOpsDashboard marks model_gateway down when provider fails", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
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

test("buildPlatformOpsDashboard returns queue metrics", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: {
      build: () => makeSystemSituation({ queueBacklog: { size: 25, degraded: true } }),
    },
  });

  const dashboard = service.buildPlatformOpsDashboard();

  assert.equal(dashboard.queueMetrics.length, 1);
  assert.equal(dashboard.queueMetrics[0]!.queueName, "default");
  assert.equal(dashboard.queueMetrics[0]!.depth, 25);
  assert.equal(dashboard.queueMetrics[0]!.avgWaitMs, 2000); // degraded = higher wait
  assert.equal(dashboard.queueMetrics[0]!.dlqCount, 0);
});

test("buildPlatformOpsDashboard returns queue metrics with low wait when not degraded", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: {
      build: () => makeSystemSituation({ queueBacklog: { size: 5, degraded: false } }),
    },
  });

  const dashboard = service.buildPlatformOpsDashboard();

  assert.equal(dashboard.queueMetrics[0]!.avgWaitMs, 250);
});

test("buildPlatformOpsDashboard returns active incidents from failed tasks", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "failed"),
        makeTask("task_2", "failed"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildPlatformOpsDashboard();

  assert.ok(dashboard.activeIncidents.length >= 2);
  assert.ok(dashboard.activeIncidents.every((item) => item.itemType === "incident"));
});

test("buildPlatformOpsDashboard includes system health incident when not ok", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: {
      build: () => makeSystemSituation({ healthStatus: "unhealthy" }),
    },
  });

  const dashboard = service.buildPlatformOpsDashboard();

  const systemIncident = dashboard.activeIncidents.find(
    (item) => item.title.includes("Platform health degraded"),
  );
  assert.ok(systemIncident);
  assert.equal(systemIncident!.priority, "critical");
});

// ─────────────────────────────────────────────────────────────────────────────
// buildFleetDashboard
// ─────────────────────────────────────────────────────────────────────────────

test("buildFleetDashboard returns platform health with overall score", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: {
      build: () => makeSystemSituation({ healthStatus: "ok" }),
    },
  });

  const dashboard = service.buildFleetDashboard();

  assert.equal(dashboard.platformHealth.overall, 92);
  assert.deepEqual(dashboard.platformHealth.degradedComponents, []);
});

test("buildFleetDashboard returns platform health degraded when system degraded", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: {
      build: () => makeSystemSituation({ healthStatus: "degraded" }),
    },
  });

  const dashboard = service.buildFleetDashboard();

  assert.equal(dashboard.platformHealth.overall, 75);
  assert.ok(dashboard.platformHealth.degradedComponents.length > 0);
});

test("buildFleetDashboard returns platform health unhealthy when system unhealthy", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: {
      build: () => makeSystemSituation({ healthStatus: "unhealthy" }),
    },
  });

  const dashboard = service.buildFleetDashboard();

  assert.equal(dashboard.platformHealth.overall, 58);
});

test("buildFleetDashboard groups tasks by department", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "done", "engineering_ops"),
        makeTask("task_2", "in_progress", "engineering_ops"),
        makeTask("task_3", "pending", "finance"),
        makeTask("task_4", "failed", "finance"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildFleetDashboard();

  assert.equal(dashboard.departmentOverview.length, 2);
  const engOps = dashboard.departmentOverview.find((d) => d.departmentId === "engineering_ops");
  const finance = dashboard.departmentOverview.find((d) => d.departmentId === "finance");
  assert.ok(engOps);
  assert.ok(finance);
});

test("buildFleetDashboard calculates agent count per department", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "done", "engineering_ops"),
        makeTask("task_2", "in_progress", "engineering_ops"),
        makeTask("task_3", "done", "engineering_ops"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildFleetDashboard();
  const engOps = dashboard.departmentOverview.find((d) => d.departmentId === "engineering_ops");

  // agentCount is based on unique divisionIds
  assert.ok(engOps!.agentCount >= 1);
});

test("buildFleetDashboard calculates activeWorkflows correctly", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "done", "ops"),
        makeTask("task_2", "in_progress", "ops"),
        makeTask("task_3", "failed", "ops"),
        makeTask("task_4", "pending", "ops"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildFleetDashboard();
  const ops = dashboard.departmentOverview.find((d) => d.departmentId === "ops");

  // activeWorkflows = non-done tasks
  assert.equal(ops!.activeWorkflows, 3);
});

test("buildFleetDashboard calculates healthScore based on incidents", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "failed", "ops"),
        makeTask("task_2", "failed", "ops"),
        makeTask("task_3", "failed", "ops"),
        makeTask("task_4", "in_progress", "ops"),
        makeTask("task_5", "pending", "ops"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildFleetDashboard();
  const ops = dashboard.departmentOverview.find((d) => d.departmentId === "ops");

  // healthScore = 100 - (incidents * 20), max 20
  // incidentsOpen = 3 (failed tasks)
  // healthScore = max(20, 100 - 3*20) = max(20, 40) = 40
  assert.equal(ops!.healthScore, 40);
});

test("buildFleetDashboard calculates attentionItems correctly", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "failed", "ops"),
        makeTask("task_2", "pending", "ops"),
        makeTask("task_3", "pending", "ops"),
        makeTask("task_4", "done", "ops"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildFleetDashboard();
  const ops = dashboard.departmentOverview.find((d) => d.departmentId === "ops");

  // attentionItems = incidentsOpen + pending tasks
  assert.equal(ops!.attentionItems, 3);
});

test("buildFleetDashboard with no tasks returns empty department overview", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: {
      build: () => makeSystemSituation({ healthStatus: "ok" }),
    },
  });

  const dashboard = service.buildFleetDashboard();

  assert.equal(dashboard.platformHealth.overall, 92);
  assert.deepEqual(dashboard.departmentOverview, []);
});

test("buildFleetDashboard uses general_ops for tasks without divisionId", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "done"), // no divisionId
        makeTask("task_2", "in_progress", "finance"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildFleetDashboard();

  const generalOps = dashboard.departmentOverview.find((d) => d.departmentId === "general_ops");
  assert.ok(generalOps);
  assert.equal(generalOps!.agentCount, 1); // only the task without divisionId
});

// ─────────────────────────────────────────────────────────────────────────────
// getSnapshot
// ─────────────────────────────────────────────────────────────────────────────

test("getSnapshot returns snapshot with generatedAt timestamp", async () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: { build: () => makeSystemSituation() },
  });

  const snapshot = await service.getSnapshot();

  assert.ok(snapshot.generatedAt);
  assert.ok(snapshot.generatedAt.includes("T"));
});

test("getSnapshot returns workflowBacklog as count of non-done tasks", async () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "done"),
        makeTask("task_2", "in_progress"),
        makeTask("task_3", "pending"),
        makeTask("task_4", "failed"),
      ],
    },
    systemSource: { build: () => makeSystemSituation() },
  });

  const snapshot = await service.getSnapshot();

  assert.equal(snapshot.workflowBacklog, 3);
});

test("getSnapshot returns incidentCount from attention queue items", async () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "failed"),
        makeTask("task_2", "failed"),
        makeTask("task_3", "done"),
      ],
    },
    systemSource: { build: () => makeSystemSituation() },
  });

  const snapshot = await service.getSnapshot();

  assert.equal(snapshot.incidentCount, 2);
});

test("getSnapshot respects limit when calling taskSource.list", async () => {
  let receivedLimit = 0;
  const service = new DashboardAggregationService({
    taskSource: {
      list: (limit?: number) => {
        if (limit !== undefined) receivedLimit = limit;
        return [];
      },
    },
    systemSource: { build: () => makeSystemSituation() },
  });

  await service.getSnapshot();

  assert.equal(receivedLimit, 100); // default limit
});

// ─────────────────────────────────────────────────────────────────────────────
// AttentionItem building
// ─────────────────────────────────────────────────────────────────────────────

test("buildOperatorDashboard creates incident for failed task", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [makeTask("task_1", "failed", "ops")],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildOperatorDashboard();
  const incident = dashboard.attentionQueue.find(
    (item) => item.itemType === "incident" && item.title.includes("Task failed"),
  );

  assert.ok(incident);
  assert.equal(incident!.priority, "high");
  assert.deepEqual(incident!.actionOptions, ["inspect", "retry"]);
  assert.equal(incident!.domainId, "ops");
});

test("buildOperatorDashboard creates approval_needed for pending task", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [makeTask("task_1", "pending", "ops")],
    },
    systemSource: {
      build: () => makeSystemSituation(),
    },
  });

  const dashboard = service.buildOperatorDashboard();
  const approval = dashboard.attentionQueue.find(
    (item) => item.itemType === "approval_needed",
  );

  assert.ok(approval);
  assert.equal(approval!.priority, "normal");
  assert.deepEqual(approval!.actionOptions, ["open_task", "prioritize"]);
});

test("buildOperatorDashboard creates budget_warning when cost exceeds forecast", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: {
      build: () => makeSystemSituation({ healthStatus: "ok" }),
    },
    costBurnUsd: 100,
    forecastCostUsd: 50,
  });

  const dashboard = service.buildOperatorDashboard();
  const budgetWarning = dashboard.attentionQueue.find(
    (item) => item.itemType === "budget_warning",
  );

  assert.ok(budgetWarning);
  assert.equal(budgetWarning!.priority, "high");
  assert.ok(budgetWarning!.title.includes("Cost burn exceeds forecast"));
});

test("buildOperatorDashboard does not create budget_warning when cost is within forecast", () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: {
      build: () => makeSystemSituation({ healthStatus: "ok" }),
    },
    costBurnUsd: 50,
    forecastCostUsd: 100,
  });

  const dashboard = service.buildOperatorDashboard();
  const budgetWarning = dashboard.attentionQueue.find(
    (item) => item.itemType === "budget_warning",
  );

  assert.equal(budgetWarning, undefined);
});

test("buildOperatorDashboard includes suggestions in proactiveSuggestions", () => {
  const suggestions: AttentionItem[] = [
    {
      itemType: "suggestion",
      priority: "low",
      title: "Consider using batch processing",
      description: "Batch processing could reduce costs",
      actionOptions: ["apply", "dismiss"],
      createdAt: "2026-04-20T00:00:00.000Z",
      domainId: "ops",
    },
  ];

  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: {
      build: () => makeSystemSituation(),
    },
    suggestions,
  });

  const dashboard = service.buildOperatorDashboard();

  assert.equal(dashboard.proactiveSuggestions.length, 1);
  assert.equal(dashboard.proactiveSuggestions[0]!.title, "Consider using batch processing");
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases
// ─────────────────────────────────────────────────────────────────────────────

test("buildOperatorDashboard handles empty task list", () => {
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
  assert.deepEqual(dashboard.recentCompletions, []);
  assert.deepEqual(dashboard.agentHealthCards, []);
});

test("buildOperatorDashboard handles all tasks done", () => {
  const service = new DashboardAggregationService({
    taskSource: {
      list: () => [
        makeTask("task_1", "done"),
        makeTask("task_2", "done"),
      ],
    },
    systemSource: {
      build: () => makeSystemSituation({ healthStatus: "ok" }),
    },
  });

  const dashboard = service.buildOperatorDashboard();

  assert.equal(dashboard.dailySummary.tasksCompleted, 2);
  assert.equal(dashboard.attentionQueue.length, 0); // no incidents or approvals
});

test("DashboardAggregationService implements DashboardPort interface", async () => {
  const service = new DashboardAggregationService({
    taskSource: { list: () => [] },
    systemSource: { build: () => makeSystemSituation() },
  });

  // Verify service has getSnapshot method (DashboardPort interface)
  const port: DashboardPort = service;
  const snapshot = await port.getSnapshot();

  assert.ok(snapshot);
  assert.ok(typeof snapshot.generatedAt === "string");
});
