/**
 * Integration Test: Dashboard Services
 *
 * Tests the Dashboard Aggregation Service, Dashboard Projection Service,
 * and Dashboard WebSocket Server integration.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { nowIso } from "../../../src/platform/contracts/types/ids.js";

import {
  DashboardAggregationService,
  type DashboardSnapshot,
  type AttentionItem,
  type DailySummary,
  type AgentHealthCard,
  type OperatorDashboard,
  type DomainAdminDashboard,
  type PlatformOpsDashboard,
  type FleetDashboard,
} from "../../../src/interaction/dashboard/index.js";
import {
  DashboardProjectionService,
  type DashboardDelta,
  type DashboardChange,
} from "../../../src/interaction/dashboard/dashboard-projection-service.js";
import {
  DashboardWebSocketServer,
  type WebSocketClient,
} from "../../../src/interaction/dashboard/dashboard-websocket-server.js";
import type { TaskBoardItem } from "../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { SystemSituation } from "../../../src/platform/shared/observability/system-situation-model.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createMockTaskSource(tasks: TaskBoardItem[]): { list: (limit?: number, tenantId?: string | null) => TaskBoardItem[] } {
  return { list: () => tasks };
}

function createMockSystemSource(
  status: "ok" | "degraded" | "unhealthy" = "ok",
  queueSize = 0,
): { build: () => SystemSituation } {
  return {
    build: (): SystemSituation => ({
      healthStatus: status,
      providerHealth: { status: "healthy", successRate: 1.0, recentCalls: 0 },
      resourceUtilization: { memoryRssMb: 512, activeProcesses: 1 },
      queueBacklog: { size: queueSize, degraded: queueSize > 5 },
      eventBusBacklog: { tier1PendingAcks: 0 },
      findings: [],
      observedAt: Date.now(),
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Aggregation Service Tests
// ─────────────────────────────────────────────────────────────────────────────

test("integration: DashboardAggregationService builds operator dashboard snapshot", () => {
  const tasks: TaskBoardItem[] = [
    { taskId: "task-1", title: "Report generation", taskStatus: "done" as const, priority: "normal" as const, divisionId: "marketing", workflowStatus: null, currentStepIndex: null, sessionStatus: null, latestEventAt: null, updatedAt: nowIso() },
    { taskId: "task-2", title: "Deploy to staging", taskStatus: "in_progress" as const, priority: "normal" as const, divisionId: "engineering", workflowStatus: null, currentStepIndex: null, sessionStatus: null, latestEventAt: null, updatedAt: nowIso() },
    { taskId: "task-3", title: "Fix critical bug", taskStatus: "failed" as const, priority: "normal" as const, divisionId: "engineering", workflowStatus: null, currentStepIndex: null, sessionStatus: null, latestEventAt: null, updatedAt: nowIso() },
  ];

  const service = new DashboardAggregationService({
    taskSource: createMockTaskSource(tasks),
    systemSource: createMockSystemSource("ok", 3),
    costBurnUsd: 25.5,
    forecastCostUsd: 30.0,
  });

  const dashboard = service.buildOperatorDashboard(10);

  assert.ok(dashboard.attentionQueue.length > 0);
  assert.ok(dashboard.dailySummary);
  assert.equal(dashboard.dailySummary.tasksCompleted, 1);
  assert.equal(dashboard.dailySummary.tasksInProgress, 1);
  assert.equal(dashboard.dailySummary.tasksFailed, 1);
  assert.equal(dashboard.costBurn.consumedUsd, 25.5);
  assert.equal(dashboard.costBurn.forecastUsd, 30.0);
  assert.ok(dashboard.agentHealthCards.length > 0);
});

test("integration: DashboardAggregationService builds domain admin dashboard", () => {
  const tasks: TaskBoardItem[] = [
    { taskId: "task-1", title: "Marketing campaign", taskStatus: "in_progress" as const, priority: "normal" as const, divisionId: "marketing", workflowStatus: null, currentStepIndex: null, sessionStatus: null, latestEventAt: null, updatedAt: nowIso() },
    { taskId: "task-2", title: "Another marketing task", taskStatus: "pending" as const, priority: "normal" as const, divisionId: "marketing", workflowStatus: null, currentStepIndex: null, sessionStatus: null, latestEventAt: null, updatedAt: nowIso() },
  ];

  const service = new DashboardAggregationService({
    taskSource: createMockTaskSource(tasks),
    systemSource: createMockSystemSource(),
  });

  const dashboard = service.buildDomainAdminDashboard("marketing", 50);

  assert.equal(dashboard.domainId, "marketing");
  assert.ok(dashboard.agentInventory.length > 0);
  assert.ok(dashboard.activeWorkflows.length > 0);
  assert.ok(dashboard.domainBudget);
});

test("integration: DashboardAggregationService builds platform ops dashboard", () => {
  const tasks: TaskBoardItem[] = [
    { taskId: "task-1", title: "System task", taskStatus: "in_progress" as const, priority: "normal" as const, divisionId: "platform", workflowStatus: null, currentStepIndex: null, sessionStatus: null, latestEventAt: null, updatedAt: nowIso() },
  ];

  const service = new DashboardAggregationService({
    taskSource: createMockTaskSource(tasks),
    systemSource: createMockSystemSource("degraded", 10),
  });

  const dashboard = service.buildPlatformOpsDashboard(100);

  assert.ok(dashboard.infrastructureHealth.length > 0);
  assert.ok(dashboard.queueMetrics.length > 0);
  assert.equal(dashboard.queueMetrics[0]?.queueName, "default");
  assert.ok(dashboard.queueMetrics[0]?.depth >= 0);
});

test("integration: DashboardAggregationService builds fleet dashboard", () => {
  const tasks: TaskBoardItem[] = [
    { taskId: "task-1", title: "Marketing task", taskStatus: "done" as const, priority: "normal" as const, divisionId: "marketing", workflowStatus: null, currentStepIndex: null, sessionStatus: null, latestEventAt: null, updatedAt: nowIso() },
    { taskId: "task-2", title: "Engineering task", taskStatus: "failed" as const, priority: "normal" as const, divisionId: "engineering", workflowStatus: null, currentStepIndex: null, sessionStatus: null, latestEventAt: null, updatedAt: nowIso() },
    { taskId: "task-3", title: "HR task", taskStatus: "pending" as const, priority: "normal" as const, divisionId: "hr", workflowStatus: null, currentStepIndex: null, sessionStatus: null, latestEventAt: null, updatedAt: nowIso() },
  ];

  const service = new DashboardAggregationService({
    taskSource: createMockTaskSource(tasks),
    systemSource: createMockSystemSource("ok"),
  });

  const dashboard = service.buildFleetDashboard(100);

  assert.ok(dashboard.platformHealth);
  assert.ok(dashboard.departmentOverview.length > 0);
  assert.ok(dashboard.platformHealth.overall >= 0 && dashboard.platformHealth.overall <= 100);
});

test("integration: DashboardAggregationService getSnapshot returns correct metrics", async () => {
  const tasks: TaskBoardItem[] = [
    { taskId: "task-1", title: "Task 1", taskStatus: "done" as const, priority: "normal" as const, divisionId: "ops", workflowStatus: null, currentStepIndex: null, sessionStatus: null, latestEventAt: null, updatedAt: nowIso() },
    { taskId: "task-2", title: "Task 2", taskStatus: "failed" as const, priority: "normal" as const, divisionId: "ops", workflowStatus: null, currentStepIndex: null, sessionStatus: null, latestEventAt: null, updatedAt: nowIso() },
  ];

  const service = new DashboardAggregationService({
    taskSource: createMockTaskSource(tasks),
    systemSource: createMockSystemSource("degraded", 2),
  });

  const snapshot = await service.getSnapshot();

  assert.ok(snapshot.generatedAt);
  assert.equal(snapshot.incidentCount, 2, "Should count failed task and degraded system as incidents");
  assert.ok(snapshot.workflowBacklog >= 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Projection Service Tests
// ─────────────────────────────────────────────────────────────────────────────

test("integration: DashboardProjectionService processes projection updates and generates deltas", () => {
  const service = new DashboardProjectionService({ emitDebounceMs: 50 });

  const record = {
    projectionId: "proj-1",
    sourceEventId: "evt-1",
    projectionName: "task_summary" as const,
    entityRef: "task-123",
    state: { taskStatus: "done" },
    updatedAt: nowIso(),
  };

  const delta = service.processProjectionUpdate(record);

  assert.ok(delta);
  assert.ok(delta.deltaId);
  assert.ok(delta.changes.length > 0);
  assert.ok(delta.affectedMetrics.length > 0);
  assert.ok(delta.timestamp);
});

test("integration: DashboardProjectionService processes events and generates deltas", () => {
  const service = new DashboardProjectionService({ emitDebounceMs: 10 });

  const delta = service.processEvent("task:status_changed", { taskId: "task-456", previousStatus: "pending", newStatus: "completed", changedAt: nowIso() } as any);

  assert.ok(delta);
  assert.equal(delta?.changes[0]?.changeType, "task_completed");
  assert.equal(delta?.changes[0]?.entityId, "task-456");
});

test("integration: DashboardProjectionService consumes pending deltas", () => {
  const service = new DashboardProjectionService({ emitDebounceMs: 10 });

  service.processEvent("task:status_changed", { taskId: "task-789", previousStatus: "pending", newStatus: "in_progress", changedAt: nowIso() } as any);

  assert.ok(service.hasPendingDeltas());

  const consumed = service.consumePendingDeltas();

  assert.equal(consumed.length, 1);
  assert.ok(!service.hasPendingDeltas());
});

test("integration: DashboardProjectionService flushes pending deltas immediately", () => {
  const service = new DashboardProjectionService({ emitDebounceMs: 500 });

  service.processEvent("task:status_changed", { taskId: "task-flush", previousStatus: "pending", newStatus: "done", changedAt: nowIso() } as any);

  assert.ok(service.hasPendingDeltas());

  const flushed = service.flush();

  assert.equal(flushed.length, 1);
  assert.ok(!service.hasPendingDeltas());
});

test("integration: DashboardProjectionService builds state from projection records", () => {
  const service = new DashboardProjectionService();

  const projections = [
    { projectionId: "proj-1", sourceEventId: "evt-1", projectionName: "task_summary" as const, entityRef: "task-1", state: { taskStatus: "done" }, updatedAt: nowIso() },
    { projectionId: "proj-2", sourceEventId: "evt-2", projectionName: "task_summary" as const, entityRef: "task-2", state: { taskStatus: "failed" }, updatedAt: nowIso() },
    { projectionId: "proj-3", sourceEventId: "evt-3", projectionName: "task_summary" as const, entityRef: "task-3", state: { taskStatus: "pending" }, updatedAt: nowIso() },
    { projectionId: "proj-4", sourceEventId: "evt-4", projectionName: "incident_summary" as const, entityRef: "inc-1", state: { priority: "high", resolved: false }, updatedAt: nowIso() },
    { projectionId: "proj-5", sourceEventId: "evt-5", projectionName: "workflow_summary" as const, entityRef: "wf-1", state: {}, updatedAt: nowIso() },
  ];

  const state = service.buildStateFromProjections(projections);

  assert.equal(state.totalTasks, 3);
  assert.ok(state.tasksByStatus["done"] === 1);
  assert.ok(state.tasksByStatus["failed"] === 1);
  assert.ok(state.tasksByStatus["pending"] === 1);
  assert.equal(state.totalIncidents, 1);
  assert.equal(state.totalWorkflows, 1);
  assert.ok(state.lastUpdatedAt);
});

test("integration: DashboardProjectionService clears pending deltas", () => {
  const service = new DashboardProjectionService({ emitDebounceMs: 1000 });

  service.processEvent("task:status_changed", { taskId: "task-clear", newStatus: "in_progress" } as any);
  assert.ok(service.hasPendingDeltas());

  service.clearPendingDeltas();

  assert.ok(!service.hasPendingDeltas());
});

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard WebSocket Server Tests
// ─────────────────────────────────────────────────────────────────────────────

test("integration: DashboardWebSocketServer registers and unregisters clients", () => {
  const server = new DashboardWebSocketServer({ heartbeatIntervalMs: 60000 });

  const { clientId, ack } = server.registerClient(["dashboard_delta", "attentionQueue"]);

  assert.ok(clientId.length > 0);
  assert.equal(ack.type, "connection_ack");
  assert.equal(server.getClientCount(), 1);
  assert.ok(server.isClientConnected(clientId));

  server.unregisterClient(clientId);

  assert.equal(server.getClientCount(), 0);
  assert.ok(!server.isClientConnected(clientId));

  server.stop();
});

test("integration: DashboardWebSocketServer rejects connection when max clients reached", () => {
  const server = new DashboardWebSocketServer({ heartbeatIntervalMs: 60000, maxClients: 1 });

  server.registerClient(["*"]);

  const { clientId: secondClient, ack } = server.registerClient(["*"]);

  assert.equal(secondClient, "");
  assert.equal(ack.type, "error");

  server.stop();
});

test("integration: DashboardWebSocketServer updates client subscriptions", () => {
  const server = new DashboardWebSocketServer({ heartbeatIntervalMs: 60000 });

  const { clientId } = server.registerClient(["attentionQueue"]);

  const updated = server.updateSubscriptions(clientId, ["budgetAlerts", "incidentCount"]);

  assert.ok(updated);

  server.unregisterClient(clientId);
  server.stop();
});

test("integration: DashboardWebSocketServer pushes delta to subscribed clients", () => {
  const server = new DashboardWebSocketServer({ heartbeatIntervalMs: 60000 });

  const { clientId } = server.registerClient(["totalTasks", "tasksByStatus"]);

  const delta: DashboardDelta = {
    deltaId: "delta-1",
    timestamp: nowIso(),
    changes: [
      { changeType: "task_created", entityId: "task-new", newValue: {} },
    ],
    affectedMetrics: ["totalTasks", "tasksByStatus.pending"],
  };

  const sentCount = server.pushDelta(delta);

  assert.equal(sentCount, 1);

  server.unregisterClient(clientId);
  server.stop();
});

test("integration: DashboardWebSocketServer pushes snapshot to specific client", () => {
  const server = new DashboardWebSocketServer({ heartbeatIntervalMs: 60000 });

  const { clientId } = server.registerClient(["snapshot"]);

  const snapshot = {
    generatedAt: nowIso(),
    workflowBacklog: 5,
    incidentCount: 2,
    budgetAlerts: 1,
  };

  const sent = server.pushSnapshotToClient(clientId, snapshot);

  assert.ok(sent);

  server.unregisterClient(clientId);
  server.stop();
});

test("integration: DashboardWebSocketServer broadcasts to all connected clients", () => {
  const server = new DashboardWebSocketServer({ heartbeatIntervalMs: 60000 });

  const { clientId: client1 } = server.registerClient(["*"]);
  const { clientId: client2 } = server.registerClient(["*"]);

  const message = {
    type: "dashboard_snapshot" as const,
    clientId: "",
    timestamp: nowIso(),
    payload: { test: "broadcast" },
  };

  const broadcastCount = server.broadcast(message);

  assert.equal(broadcastCount, 2);

  server.unregisterClient(client1);
  server.unregisterClient(client2);
  server.stop();
});

test("integration: DashboardWebSocketServer handles projection delta", () => {
  const server = new DashboardWebSocketServer({ heartbeatIntervalMs: 60000 });

  const { clientId } = server.registerClient(["totalTasks"]);

  const delta: DashboardDelta = {
    deltaId: "delta-projection",
    timestamp: nowIso(),
    changes: [{ changeType: "task_updated" as any, entityId: "task-x", newValue: {} }],
    affectedMetrics: ["totalTasks"],
  };

  const handled = server.handleProjectionDelta(delta);

  assert.equal(handled, 1);

  server.unregisterClient(clientId);
  server.stop();
});

test("integration: DashboardWebSocketServer getConnectedClients returns client list", () => {
  const server = new DashboardWebSocketServer({ heartbeatIntervalMs: 60000 });

  const { clientId: client1 } = server.registerClient(["dashboard_delta"]);
  const { clientId: client2 } = server.registerClient(["attentionQueue"]);

  const clients = server.getConnectedClients();

  assert.equal(clients.length, 2);
  assert.ok(clients.some((c) => c.clientId === client1));
  assert.ok(clients.some((c) => c.clientId === client2));

  server.unregisterClient(client1);
  server.unregisterClient(client2);
  server.stop();
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration: Full Dashboard Pipeline
// ─────────────────────────────────────────────────────────────────────────────

test("integration: Full dashboard pipeline - task events flow through projection to WebSocket", () => {
  const projectionService = new DashboardProjectionService({ emitDebounceMs: 10 });
  const wsServer = new DashboardWebSocketServer({ heartbeatIntervalMs: 60000 });

  const { clientId } = wsServer.registerClient(["totalTasks", "incidentCount"]);

  projectionService.processEvent("task:status_changed", { taskId: "task-pipeline-1", previousStatus: "pending", newStatus: "in_progress", changedAt: nowIso() } as any);
  projectionService.processEvent("task:status_changed", { taskId: "task-pipeline-1", previousStatus: "in_progress", newStatus: "completed", changedAt: nowIso() } as any);
  projectionService.processEvent("task:status_changed", { taskId: "task-pipeline-2", previousStatus: "pending", newStatus: "failed", changedAt: nowIso() } as any);

  wsServer.setDeltaHandler((delta) => {
    void delta;
  });

  const deltas = projectionService.flush();
  let totalPushed = 0;

  for (const delta of deltas) {
    totalPushed += wsServer.pushDelta(delta);
  }

  assert.equal(deltas.length, 3);
  assert.ok(totalPushed > 0);

  wsServer.unregisterClient(clientId);
  wsServer.stop();
});

test("integration: DashboardAggregationService with attention items includes incidents and warnings", () => {
  const tasks: TaskBoardItem[] = [
    { taskId: "task-1", title: "Failed deployment", taskStatus: "failed" as const, priority: "high" as const, divisionId: "engineering", workflowStatus: "completed" as const, currentStepIndex: 0, sessionStatus: "failed" as const, latestEventAt: nowIso(), updatedAt: nowIso() },
    { taskId: "task-2", title: "Pending approval", taskStatus: "pending" as const, priority: "normal" as const, divisionId: "ops", workflowStatus: "running" as const, currentStepIndex: 1, sessionStatus: "open" as const, latestEventAt: nowIso(), updatedAt: nowIso() },
  ];

  const suggestions: AttentionItem[] = [
    {
      itemType: "suggestion",
      priority: "low",
      title: "Consider using template TPL-001",
      description: "Template suggestion for repeated task",
      actionOptions: ["apply_template"],
      createdAt: nowIso(),
      domainId: "ops",
    },
  ];

  const service = new DashboardAggregationService({
    taskSource: createMockTaskSource(tasks),
    systemSource: createMockSystemSource("ok"),
    suggestions,
  });

  const dashboard = service.buildOperatorDashboard(25);

  assert.ok(dashboard.attentionQueue.length >= 2, "Should have incident and approval items");
  assert.ok(dashboard.proactiveSuggestions.length > 0, "Should include suggestions");
});
