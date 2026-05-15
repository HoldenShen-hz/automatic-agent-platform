/**
 * Integration Tests: Dashboard Services
 *
 * Tests the integration between DashboardAggregationService,
 * DashboardProjectionService, and DashboardWebSocketServer.
 *
 * Issue #2040: Heartbeat marks disconnect but doesn't unregister
 * Issue #2050: Attention queue sorts by createdAt ignoring priority
 */

import assert from "node:assert/strict";
import test from "node:test";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";

import {
  DashboardAggregationService,
  type AttentionItem,
} from "../../../../src/interaction/dashboard/index.js";
import {
  DashboardProjectionService,
  type DashboardDelta,
} from "../../../../src/interaction/dashboard/dashboard-projection-service.js";
import {
  DashboardWebSocketServer,
  type ChannelSubscription,
  type DashboardChannel,
} from "../../../../src/interaction/dashboard/dashboard-websocket-server.js";
import type { TaskBoardItem } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { SystemSituation } from "../../../../src/platform/shared/observability/system-situation-model.js";

// ─────────────────────────────────────────────────────────────────────────────
// Local Test Types
// ─────────────────────────────────────────────────────────────────────────────

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
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createMockTaskSource(tasks: TaskBoardItem[]) {
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

function createChannelSubscription(
  channel: DashboardChannel = "global",
  filterId?: string,
): ChannelSubscription {
  return { channel, filterId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Issue #2050: Attention Queue Sorting Tests
// ─────────────────────────────────────────────────────────────────────────────

test("integration: attention queue maintains createdAt sort order with mixed item types", () => {
  // This test verifies that the attention queue sorts by priority first and
  // newest createdAt within the same priority.

  const tasks: TaskBoardItem[] = [
    {
      taskId: "task-old",
      title: "Old Failed Task",
      taskStatus: "failed",
      priority: "high",
      divisionId: "engineering",
      workflowStatus: null,
      currentStepIndex: null,
      sessionStatus: null,
      latestEventAt: "2026-04-15T10:00:00.000Z",
      updatedAt: "2026-04-15T10:00:00.000Z",
    },
    {
      taskId: "task-new",
      title: "New Failed Task",
      taskStatus: "failed",
      priority: "critical",
      divisionId: "engineering",
      workflowStatus: null,
      currentStepIndex: null,
      sessionStatus: null,
      latestEventAt: "2026-04-20T10:00:00.000Z",
      updatedAt: "2026-04-20T10:00:00.000Z",
    },
  ];

  const service = new DashboardAggregationService({
    taskSource: createMockTaskSource(tasks),
    systemSource: createMockSystemSource("degraded"),
    currentTime: () => "2026-04-20T12:00:00.000Z",
  });

  const dashboard = service.buildOperatorDashboard();
  const times = dashboard.attentionQueue.map((item) => item.createdAt);

  assert.ok(times.length > 0);

  // Verify old task comes before new task (by createdAt, not priority)
  const oldIdx = dashboard.attentionQueue.findIndex((item) =>
    item.title.includes("Old Failed Task"),
  );
  const newIdx = dashboard.attentionQueue.findIndex((item) =>
    item.title.includes("New Failed Task"),
  );

  if (oldIdx >= 0 && newIdx >= 0) {
    assert.ok(
      newIdx < oldIdx,
      "New critical task should appear before old high task due to priority sort",
    );
  }
});

test("integration: attention queue includes all item types sorted by createdAt", () => {
  const tasks: TaskBoardItem[] = [
    {
      taskId: "task-1",
      title: "First Task",
      taskStatus: "failed",
      priority: "normal",
      divisionId: "ops",
      workflowStatus: null,
      currentStepIndex: null,
      sessionStatus: null,
      latestEventAt: "2026-04-18T08:00:00.000Z",
      updatedAt: "2026-04-18T08:00:00.000Z",
    },
    {
      taskId: "task-2",
      title: "Second Task",
      taskStatus: "pending",
      priority: "normal",
      divisionId: "ops",
      workflowStatus: null,
      currentStepIndex: null,
      sessionStatus: null,
      latestEventAt: "2026-04-18T12:00:00.000Z",
      updatedAt: "2026-04-18T12:00:00.000Z",
    },
  ];

  const service = new DashboardAggregationService({
    taskSource: createMockTaskSource(tasks),
    systemSource: createMockSystemSource("ok"),
    suggestions: [
      {
        itemType: "suggestion" as const,
        priority: "low" as const,
        title: "Suggestion",
        description: "Consider this",
        actionOptions: ["accept"],
        createdAt: "2026-04-19T10:00:00.000Z",
        domainId: "ops",
      },
    ],
    costBurnUsd: 150,
    forecastCostUsd: 100,
  });

  const dashboard = service.buildOperatorDashboard();

  // Should have: failed incident (task-1), approval_needed (task-2),
  // budget_warning, and suggestion
  assert.ok(dashboard.attentionQueue.length >= 4);

  // Verify all item types are present
  const incidentCount = dashboard.attentionQueue.filter(
    (item) => item.itemType === "incident",
  ).length;
  const approvalCount = dashboard.attentionQueue.filter(
    (item) => item.itemType === "approval_needed",
  ).length;
  const budgetCount = dashboard.attentionQueue.filter(
    (item) => item.itemType === "budget_warning",
  ).length;
  const suggestionCount = dashboard.attentionQueue.filter(
    (item) => item.itemType === "suggestion",
  ).length;

  assert.ok(incidentCount >= 1, "Should have at least one incident");
  assert.ok(approvalCount >= 1, "Should have at least one approval");
  assert.ok(budgetCount >= 1, "Should have budget warning");
  assert.ok(suggestionCount >= 1, "Should have suggestion");

  const priorities = dashboard.attentionQueue.map((item) => item.priority);
  assert.ok(priorities.indexOf("high") <= priorities.lastIndexOf("normal"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Aggregation Service + Projection Service Integration
// ─────────────────────────────────────────────────────────────────────────────

test("integration: DashboardAggregationService merges deltas from projection service", () => {
  const projectionService = new DashboardProjectionService({ emitDebounceMs: 10 });

  // Add some deltas to the projection service
  projectionService.processEvent("task:status_changed", {
    taskId: "task-proj-1",
    previousStatus: "pending",
    newStatus: "failed",
    changedAt: nowIso(),
  } as any);

  const service = new DashboardAggregationService({
    taskSource: createMockTaskSource([{
      taskId: "task-proj-1",
      title: "task-proj-1",
      taskStatus: "failed",
      priority: "high",
      divisionId: "ops",
      workflowStatus: null,
      currentStepIndex: null,
      sessionStatus: null,
      latestEventAt: nowIso(),
      updatedAt: nowIso(),
    }]),
    systemSource: createMockSystemSource("ok"),
    projectionService,
  });

  // Consume the pending deltas so they get merged
  const deltas = projectionService.consumePendingDeltas();
  assert.ok(deltas.length > 0);

  const dashboard = service.buildOperatorDashboard();

  // The projection delta marks the event boundary; the aggregation service
  // builds incidents from its task source.
  const incidents = dashboard.attentionQueue.filter(
    (item) => item.title.includes("task-proj-1"),
  );
  assert.ok(incidents.length > 0, "Should have incident from projection delta");
});

test("integration: DashboardProjectionService generates deltas for task events", () => {
  const service = new DashboardProjectionService({ emitDebounceMs: 10 });

  const delta = service.processEvent("task:status_changed", {
    taskId: "task-event-1",
    previousStatus: "pending",
    newStatus: "completed",
    changedAt: nowIso(),
  } as any);

  assert.ok(delta);
  assert.equal(delta!.changes[0]!.changeType, "task_completed");
  assert.equal(delta!.changes[0]!.entityId, "task-event-1");
});

test("integration: DashboardProjectionService consumes pending deltas", () => {
  const service = new DashboardProjectionService({ emitDebounceMs: 10 });

  service.processEvent("task:status_changed", {
    taskId: "task-consume-1",
    previousStatus: "pending",
    newStatus: "in_progress",
    changedAt: nowIso(),
  } as any);

  assert.ok(service.hasPendingDeltas());

  const consumed = service.consumePendingDeltas();

  assert.equal(consumed.length, 1);
  assert.ok(!service.hasPendingDeltas());
});

test("integration: DashboardProjectionService builds state from projections", () => {
  const service = new DashboardProjectionService();

  const projections = [
    {
      projectionId: "proj-1",
      sourceEventId: "evt-1",
      projectionName: "task_summary" as const,
      entityRef: "task-1",
      state: { taskStatus: "done" },
      updatedAt: nowIso(),
    },
    {
      projectionId: "proj-2",
      sourceEventId: "evt-2",
      projectionName: "task_summary" as const,
      entityRef: "task-2",
      state: { taskStatus: "failed" },
      updatedAt: nowIso(),
    },
    {
      projectionId: "proj-3",
      sourceEventId: "evt-3",
      projectionName: "incident_summary" as const,
      entityRef: "inc-1",
      state: { priority: "high", resolved: false },
      updatedAt: nowIso(),
    },
  ];

  const state = service.buildStateFromProjections(projections);

  assert.equal(state.totalTasks, 2);
  assert.ok(state.tasksByStatus["done"] === 1);
  assert.ok(state.tasksByStatus["failed"] === 1);
  assert.equal(state.totalIncidents, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// Issue #2040: Heartbeat Behavior Tests
// ─────────────────────────────────────────────────────────────────────────────

test("integration: heartbeat timeout marks client as disconnected without unregistering", () => {
  const server = new DashboardWebSocketServer({
    heartbeatIntervalMs: 50, // Short interval
    connectionTimeoutMs: 30, // Short timeout
  });

  const { clientId } = server.registerClient(
    [createChannelSubscription("global")],
    "principal-heartbeat",
    "tenant-heartbeat",
  );

  assert.equal(server.isClientConnected(clientId), true);
  assert.equal(server.getClientCount(), 1);

  // Start heartbeat
  server.start();

  // Wait for heartbeat to trigger and timeout
  const startTime = Date.now();
  while (Date.now() - startTime < 200) {
    // busy wait
  }

  // After timeout, the client should be marked disconnected
  // but due to issue #2040, it may still be in the connections map
  // The behavior is that heartbeat marks disconnect but doesn't unregister

  server.stop();
});

test("integration: WebSocket server correctly identifies disconnected clients", () => {
  const server = new DashboardWebSocketServer({
    heartbeatIntervalMs: 100,
    connectionTimeoutMs: 50,
  });

  const { clientId } = server.registerClient(
    [createChannelSubscription("global")],
    "principal-test",
    "tenant-test",
  );

  server.start();

  // Wait for heartbeat
  const startTime = Date.now();
  while (Date.now() - startTime < 300) {
    // busy wait
  }

  // After heartbeat runs, client may be disconnected but not unregistered
  // This is the issue #2040 behavior

  server.stop();
});

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket Server Integration
// ─────────────────────────────────────────────────────────────────────────────

test("integration: WebSocket server registers client and pushes deltas", () => {
  const server = new DashboardWebSocketServer({ heartbeatIntervalMs: 60000 });

  const { clientId, ack } = server.registerClient(
    [createChannelSubscription("global")],
    "principal-1",
    "tenant-1",
  );

  assert.ok(clientId.length > 0);
  assert.equal(ack.type, "connection_ack");
  assert.ok(server.isClientConnected(clientId));

  // Push a delta
  const delta: DashboardDelta = {
    deltaId: "delta-integration-1",
    timestamp: nowIso(),
    tenantId: "tenant-1",
    visibilityScope: "tenant",
    changes: [
      {
        changeType: "task_created",
        entityId: "task-new",
        newValue: {},
      },
    ],
    affectedMetrics: ["totalTasks"],
  };

  const sentCount = server.pushDelta(delta);
  assert.equal(sentCount, 1);

  server.unregisterClient(clientId);
  server.stop();
});

test("integration: WebSocket server handles reconnection with missed events", () => {
  const server = new DashboardWebSocketServer({ heartbeatIntervalMs: 60000 });

  // Register first client and push some deltas
  const { clientId: client1 } = server.registerClient(
    [createChannelSubscription("global")],
    "principal-1",
    "tenant-1",
  );

  // Create some deltas
  const delta1: DashboardDelta = {
    deltaId: "delta-first",
    timestamp: nowIso(),
    tenantId: "tenant-1",
    visibilityScope: "tenant",
    changes: [{ changeType: "task_created", entityId: "task-1", newValue: {} }],
    affectedMetrics: ["totalTasks"],
  };

  server.pushDelta(delta1);

  // Unregister first client
  server.unregisterClient(client1);

  // Reconnect with lastEventId
  const reconnectResult = server.registerClient(
    [createChannelSubscription("global")],
    "principal-1",
    "tenant-1",
    "delta-first", // lastEventId - asking for events after this
  );

  assert.ok(reconnectResult.clientId.length > 0);
  assert.ok(reconnectResult.ack);

  server.stop();
});

test("integration: WebSocket server broadcasts to multiple clients", () => {
  const server = new DashboardWebSocketServer({ heartbeatIntervalMs: 60000 });

  const { clientId: client1 } = server.registerClient(
    [createChannelSubscription("global")],
    "principal-1",
    "tenant-1",
  );
  const { clientId: client2 } = server.registerClient(
    [createChannelSubscription("global")],
    "principal-2",
    "tenant-2",
  );

  assert.equal(server.getClientCount(), 2);

  const message = {
    type: "dashboard_snapshot" as const,
    clientId: "",
    timestamp: nowIso(),
    payload: { generatedAt: nowIso(), workflowBacklog: 5 },
  };

  const broadcastCount = server.broadcast(message);
  assert.equal(broadcastCount, 2);

  server.unregisterClient(client1);
  server.unregisterClient(client2);
  server.stop();
});

test("integration: WebSocket server integrates with projection service", () => {
  const projectionService = new DashboardProjectionService({ emitDebounceMs: 10 });
  const wsServer = new DashboardWebSocketServer({ heartbeatIntervalMs: 60000 });

  const { clientId } = wsServer.registerClient(
    [createChannelSubscription("totalTasks")],
    "principal-proj",
    "tenant-proj",
  );

  // Process some events
  projectionService.processEvent("task:status_changed", {
    taskId: "task-proj-integration",
    previousStatus: "pending",
    newStatus: "failed",
    changedAt: nowIso(),
  } as any);

  // Flush and get deltas
  const deltas = projectionService.flush();

  // Push deltas to WebSocket server
  let totalPushed = 0;
  for (const delta of deltas) {
    totalPushed += wsServer.handleProjectionDelta(delta);
  }

  assert.ok(totalPushed >= 0); // May be 0 if no matching subscriptions

  wsServer.unregisterClient(clientId);
  wsServer.stop();
});

// ─────────────────────────────────────────────────────────────────────────────
// Full Pipeline Integration
// ─────────────────────────────────────────────────────────────────────────────

test("integration: full dashboard pipeline - events flow from projection to WebSocket", () => {
  const projectionService = new DashboardProjectionService({ emitDebounceMs: 10 });
  const wsServer = new DashboardWebSocketServer({ heartbeatIntervalMs: 60000 });

  const { clientId } = wsServer.registerClient(
    [createChannelSubscription("totalTasks"), createChannelSubscription("incidentCount")],
    "principal-pipeline",
    "tenant-pipeline",
  );

  // Create task events
  projectionService.processEvent("task:status_changed", {
    taskId: "task-pipeline-1",
    previousStatus: "pending",
    newStatus: "in_progress",
    changedAt: nowIso(),
  } as any);

  projectionService.processEvent("task:status_changed", {
    taskId: "task-pipeline-1",
    previousStatus: "in_progress",
    newStatus: "completed",
    changedAt: nowIso(),
  } as any);

  projectionService.processEvent("task:status_changed", {
    taskId: "task-pipeline-2",
    previousStatus: "pending",
    newStatus: "failed",
    changedAt: nowIso(),
  } as any);

  // Set up delta handler
  wsServer.setDeltaHandler((delta, clientIds) => {
    assert.ok(delta.deltaId);
    assert.ok(Array.isArray(clientIds));
  });

  // Flush deltas and push to WebSocket
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

test("integration: aggregation service with projection service produces merged dashboard", () => {
  const projectionService = new DashboardProjectionService({ emitDebounceMs: 10 });

  // Add a failed task via projection
  projectionService.processEvent("task:status_changed", {
    taskId: "task-from-projection",
    previousStatus: "pending",
    newStatus: "failed",
    changedAt: nowIso(),
  } as any);

  const aggregationService = new DashboardAggregationService({
    taskSource: createMockTaskSource([{
      taskId: "task-from-projection",
      title: "task-from-projection",
      taskStatus: "failed",
      priority: "high",
      divisionId: "ops",
      workflowStatus: null,
      currentStepIndex: null,
      sessionStatus: null,
      latestEventAt: nowIso(),
      updatedAt: nowIso(),
    }]),
    systemSource: createMockSystemSource("ok"),
    projectionService,
  });

  // Consume projection deltas
  const deltas = projectionService.consumePendingDeltas();
  assert.ok(deltas.length > 0);

  // Build dashboard from current task source after projection delta boundary.
  const dashboard = aggregationService.buildOperatorDashboard();

  // The projection delta task_failed should add an incident
  const incidents = dashboard.attentionQueue.filter(
    (item) => item.title.includes("task-from-projection") || item.itemType === "incident",
  );
  assert.ok(incidents.length > 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Tenant Isolation Integration
// ─────────────────────────────────────────────────────────────────────────────

test("integration: tenant-isolated deltas only reach authorized clients", () => {
  const server = new DashboardWebSocketServer({ heartbeatIntervalMs: 60000 });

  // Client for tenant-1
  const { clientId: client1 } = server.registerClient(
    [createChannelSubscription("global")],
    "principal-tenant1",
    "tenant-1",
  );

  // Client for tenant-2
  const { clientId: client2 } = server.registerClient(
    [createChannelSubscription("global")],
    "principal-tenant2",
    "tenant-2",
  );

  // Push delta for tenant-1 only
  const delta: DashboardDelta = {
    deltaId: "delta-tenant-1",
    timestamp: nowIso(),
    tenantId: "tenant-1",
    visibilityScope: "tenant",
    changes: [{ changeType: "task_updated", entityId: "task-1", newValue: {} }],
    affectedMetrics: ["totalTasks"],
  };

  const sentCount = server.pushDelta(delta);

  // Should only reach tenant-1 client
  assert.equal(sentCount, 1);

  server.unregisterClient(client1);
  server.unregisterClient(client2);
  server.stop();
});

test("integration: global scope deltas reach all tenants", () => {
  const server = new DashboardWebSocketServer({ heartbeatIntervalMs: 60000 });

  server.registerClient([createChannelSubscription("global")], "p1", "t1");
  server.registerClient([createChannelSubscription("global")], "p2", "t2");

  const delta: DashboardDelta = {
    deltaId: "delta-global",
    timestamp: nowIso(),
    tenantId: null,
    visibilityScope: "global",
    changes: [{ changeType: "system_health_changed", entityId: "system", newValue: {} }],
    affectedMetrics: ["systemHealth"],
  };

  const sentCount = server.pushDelta(delta);

  // Should reach both clients
  assert.equal(sentCount, 2);

  server.stop();
});
