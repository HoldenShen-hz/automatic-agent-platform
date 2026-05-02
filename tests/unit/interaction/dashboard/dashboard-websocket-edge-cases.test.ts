/**
 * Edge Case Tests: Dashboard WebSocket Server
 *
 * Tests edge cases and boundary conditions for the DashboardWebSocketServer.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { ChannelSubscription, DashboardSubscriptionAuthorization } from "../../../../src/interaction/dashboard/dashboard-websocket-server.js";
import { DashboardWebSocketServer } from "../../../../src/interaction/dashboard/dashboard-websocket-server.js";
import type { DashboardDelta } from "../../../../src/interaction/dashboard/dashboard-projection-service.js";

function createDashboardDelta(overrides: Partial<DashboardDelta> = {}): DashboardDelta {
  return {
    deltaId: "delta-edge",
    timestamp: new Date().toISOString(),
    tenantId: null,
    visibilityScope: "global",
    changes: [{ changeType: "system_health_changed", entityId: "platform", newValue: { status: "ok" } }],
    affectedMetrics: ["totalTasks"],
    ...overrides,
  };
}

function createAuthorization(
  channels: readonly ChannelSubscription[],
  tenantId: string,
): DashboardSubscriptionAuthorization {
  const allowedTaskIds = channels
    .filter((subscription) => subscription.channel === "task")
    .map((subscription) => subscription.filterId)
    .filter((filterId): filterId is string => filterId !== undefined);
  return {
    allowedChannels: [...new Set(channels.map((subscription) => subscription.channel))],
    allowedTenantIds: [tenantId],
    ...(allowedTaskIds.length > 0 ? { allowedTaskIds } : {}),
  };
}

function registerClient(
  server: DashboardWebSocketServer,
  channels: readonly ChannelSubscription[],
  options: {
    principal?: string;
    tenantId?: string;
    authorization?: DashboardSubscriptionAuthorization;
    metricSubscriptions?: readonly string[];
  } = {},
) {
  const principal = options.principal ?? "principal-1";
  const tenantId = options.tenantId ?? "tenant-1";
  return server.registerClient(
    channels,
    principal,
    tenantId,
    null,
    "1.0",
    options.authorization ?? createAuthorization(channels, tenantId),
    options.metricSubscriptions ?? [],
  );
}

test("DashboardWebSocketServer handles unregister unknown client", () => {
  const server = new DashboardWebSocketServer();

  // Should not throw
  server.unregisterClient("completely_unknown_client");
  assert.equal(server.getClientCount(), 0);
});

test("DashboardWebSocketServer handles updateSubscriptions for unknown client", () => {
  const server = new DashboardWebSocketServer();

  const result = server.updateSubscriptions("unknown_client", [{ channel: "global" }]);

  assert.equal(result, false);
});

test("DashboardWebSocketServer pushSnapshotToClient for unknown client", () => {
  const server = new DashboardWebSocketServer();

  const result = server.pushSnapshotToClient("unknown_client", { data: "test" });

  assert.equal(result, false);
});

test("DashboardWebSocketServer isClientConnected for unknown client", () => {
  const server = new DashboardWebSocketServer();

  const result = server.isClientConnected("unknown_client");

  assert.equal(result, false);
});

test("DashboardWebSocketServer maxClients can be configured to zero", () => {
  const server = new DashboardWebSocketServer({ maxClients: 0 });

  const { clientId, ack } = registerClient(server, [{ channel: "global" }]);

  // Should reject immediately since maxClients is 0
  assert.equal(clientId, "");
  assert.equal(ack.type, "error");
});

test("DashboardWebSocketServer handles empty dashboard list", () => {
  const server = new DashboardWebSocketServer();

  const { clientId } = registerClient(server, []);

  assert.ok(clientId.length > 0);
  assert.equal(server.getClientCount(), 1);
});

test("DashboardWebSocketServer handles duplicate subscription updates", () => {
  const server = new DashboardWebSocketServer();
  const taskSubscriptions = [{ channel: "task", filterId: "task-1" }] as const;
  const authorization = {
    allowedChannels: ["task"] as const,
    allowedTenantIds: ["tenant-1"],
    allowedTaskIds: ["task-1"],
  };

  const { clientId } = registerClient(server, taskSubscriptions, { authorization });

  const result1 = server.updateSubscriptions(clientId, taskSubscriptions);
  const result2 = server.updateSubscriptions(clientId, taskSubscriptions);

  assert.equal(result1, true);
  assert.equal(result2, true);
});

test("DashboardWebSocketServer updateSubscriptions removes from old dashboards", () => {
  const server = new DashboardWebSocketServer();
  const authorization = {
    allowedChannels: ["task"] as const,
    allowedTenantIds: ["tenant-1"],
    allowedTaskIds: ["task-a", "task-b", "task-c"],
  };

  const { clientId } = registerClient(
    server,
    [{ channel: "task", filterId: "task-a" }, { channel: "task", filterId: "task-b" }],
    { authorization },
  );
  server.updateSubscriptions(clientId, [{ channel: "task", filterId: "task-c" }]);

  const delta = createDashboardDelta({
    tenantId: "tenant-1",
    visibilityScope: "tenant",
    changes: [{ changeType: "task_updated", entityId: "task-a", newValue: {} }],
    affectedMetrics: ["totalTasks"],
  });
  const sentCount = server.pushDelta(delta);

  // Should not reach client anymore
  assert.equal(sentCount, 0);
});

test("DashboardWebSocketServer pushDelta handles empty affectedMetrics", () => {
  const server = new DashboardWebSocketServer();

  registerClient(server, [{ channel: "approvals" }], {
    authorization: { allowedChannels: ["approvals"], allowedTenantIds: ["tenant-1"] },
  });
  const delta = createDashboardDelta({
    changes: [{ changeType: "system_health_changed", entityId: "platform", newValue: {} }],
    affectedMetrics: [],
  });

  const sentCount = server.pushDelta(delta);

  assert.equal(sentCount, 0);
});

test("DashboardWebSocketServer global channel receives deltas regardless of metric names", () => {
  const server = new DashboardWebSocketServer();

  registerClient(server, [{ channel: "global" }]);
  const delta = createDashboardDelta({
    changes: [{ changeType: "system_health_changed", entityId: "platform", newValue: {} }],
    affectedMetrics: ["anything", "at.all"],
  });

  const sentCount = server.pushDelta(delta);

  assert.equal(sentCount, 1);
});

test("DashboardWebSocketServer broadcast handles empty message payload", () => {
  const server = new DashboardWebSocketServer();

  registerClient(server, [{ channel: "global" }], { principal: "principal-1", tenantId: "tenant-1" });
  registerClient(server, [{ channel: "global" }], { principal: "principal-2", tenantId: "tenant-2" });

  const message = {
    type: "dashboard_snapshot" as const,
    clientId: "",
    timestamp: new Date().toISOString(),
    payload: {},
  };

  const sentCount = server.broadcast(message);

  assert.equal(sentCount, 2);
});

test("DashboardWebSocketServer getConnectedClients returns correct structure", () => {
  const server = new DashboardWebSocketServer();

  const { clientId } = registerClient(
    server,
    [{ channel: "global" }],
    { metricSubscriptions: ["totalTasks"] },
  );

  const clients = server.getConnectedClients();

  assert.equal(clients.length, 1);
  assert.equal(clients[0]!.clientId, clientId);
  assert.equal(clients[0]!.principal, "principal-1");
  assert.equal(clients[0]!.tenantId, "tenant-1");
  assert.deepEqual(clients[0]!.subscribedChannels, [{ channel: "global" }]);
  assert.deepEqual(clients[0]!.subscribedMetrics, ["totalTasks"]);
  assert.equal(clients[0]!.isConnected, true);
});

test("DashboardWebSocketServer getConnectedClients after unregister", () => {
  const server = new DashboardWebSocketServer();

  const { clientId } = registerClient(server, [{ channel: "global" }]);
  server.unregisterClient(clientId);

  const clients = server.getConnectedClients();

  assert.equal(clients.length, 0);
});

test("DashboardWebSocketServer heartbeat timer is cleared on stop", () => {
  const server = new DashboardWebSocketServer({ heartbeatIntervalMs: 1000 });

  server.start();
  assert.ok((server as any).heartbeatTimer !== null);

  server.stop();
  assert.ok((server as any).heartbeatTimer === null);
});

test("DashboardWebSocketServer handles setDeltaHandler with null", () => {
  const server = new DashboardWebSocketServer();

  // Should not throw
  server.setDeltaHandler(null as any);
});

test("DashboardWebSocketServer handleProjectionDelta without delta handler", () => {
  const server = new DashboardWebSocketServer();
  registerClient(server, [{ channel: "global" }]);

  const delta = createDashboardDelta({
    changes: [{ changeType: "system_health_changed", entityId: "platform", newValue: {} }],
    affectedMetrics: ["totalTasks"],
  });

  // Should work even without delta handler set
  const sentCount = server.handleProjectionDelta(delta);

  assert.equal(sentCount, 1);
});

test("DashboardWebSocketServer handleProjectionDelta with delta handler", () => {
  const server = new DashboardWebSocketServer();
  registerClient(server, [{ channel: "global" }]);

  let handlerCalled = false;
  server.setDeltaHandler((delta, clientIds) => {
    handlerCalled = true;
    assert.ok(delta.deltaId.length > 0);
    assert.ok(clientIds.length > 0);
  });

  const delta = createDashboardDelta({
    changes: [{ changeType: "system_health_changed", entityId: "platform", newValue: {} }],
    affectedMetrics: ["totalTasks"],
  });
  server.handleProjectionDelta(delta);

  assert.equal(handlerCalled, true);
});

test("DashboardWebSocketServer pushDelta does not send to disconnected clients", () => {
  const server = new DashboardWebSocketServer();

  const { clientId } = registerClient(server, [{ channel: "global" }]);
  server.unregisterClient(clientId);

  const delta = createDashboardDelta({
    changes: [{ changeType: "system_health_changed", entityId: "platform", newValue: {} }],
    affectedMetrics: ["totalTasks"],
  });
  const sentCount = server.pushDelta(delta);

  assert.equal(sentCount, 0);
});

test("DashboardWebSocketServer createMessage generates valid structure", () => {
  const server = new DashboardWebSocketServer();

  const message = (server as any).createMessage("dashboard_snapshot", "client_123", { data: "test" });

  assert.equal(message.type, "dashboard_snapshot");
  assert.equal(message.clientId, "client_123");
  assert.ok(message.timestamp.length > 0);
  assert.deepEqual(message.payload, { data: "test" });
});

test("DashboardWebSocketServer all message types are valid", () => {
  const server = new DashboardWebSocketServer();

  const messageTypes = ["task.status_changed", "dashboard_snapshot", "connection_ack", "stream_gap", "error"] as const;

  for (const type of messageTypes) {
    const message = (server as any).createMessage(type, "test_client", { data: type });
    assert.equal(message.type, type);
  }
});

test("DashboardWebSocketServer delta handler receives correct client IDs", () => {
  const server = new DashboardWebSocketServer();
  const authTaskA = {
    allowedChannels: ["task"] as const,
    allowedTenantIds: ["tenant-1"],
    allowedTaskIds: ["task-a"],
  };
  const authTaskB = {
    allowedChannels: ["task"] as const,
    allowedTenantIds: ["tenant-1"],
    allowedTaskIds: ["task-b"],
  };

  registerClient(server, [{ channel: "task", filterId: "task-a" }], { authorization: authTaskA });
  registerClient(server, [{ channel: "task", filterId: "task-b" }], { authorization: authTaskB });
  registerClient(server, [{ channel: "task", filterId: "task-a" }], { authorization: authTaskA, principal: "principal-2" });

  let receivedClientIds: string[] = [];
  server.setDeltaHandler((delta, clientIds) => {
    receivedClientIds = clientIds;
  });

  const delta = createDashboardDelta({
    tenantId: "tenant-1",
    visibilityScope: "tenant",
    changes: [{ changeType: "task_updated", entityId: "task-a", newValue: {} }],
    affectedMetrics: ["totalTasks"],
  });
  server.handleProjectionDelta(delta);

  assert.equal(receivedClientIds.length, 2);
});

test("DashboardWebSocketServer client subscription update is atomic", () => {
  const server = new DashboardWebSocketServer();
  const authorization = {
    allowedChannels: ["task"] as const,
    allowedTenantIds: ["tenant-1"],
    allowedTaskIds: ["task-old", "task-new"],
  };

  const { clientId } = registerClient(server, [{ channel: "task", filterId: "task-old" }], { authorization });

  // Before update
  const deltaOld = createDashboardDelta({
    tenantId: "tenant-1",
    visibilityScope: "tenant",
    changes: [{ changeType: "task_updated", entityId: "task-old", newValue: {} }],
    affectedMetrics: ["totalTasks"],
  });
  assert.equal(server.pushDelta(deltaOld), 1);

  // After update
  server.updateSubscriptions(clientId, [{ channel: "task", filterId: "task-new" }]);
  const deltaNew = createDashboardDelta({
    tenantId: "tenant-1",
    visibilityScope: "tenant",
    changes: [{ changeType: "task_updated", entityId: "task-new", newValue: {} }],
    affectedMetrics: ["totalTasks"],
  });
  assert.equal(server.pushDelta(deltaNew), 1);

  const deltaOldAfter = createDashboardDelta({
    tenantId: "tenant-1",
    visibilityScope: "tenant",
    changes: [{ changeType: "task_updated", entityId: "task-old", newValue: {} }],
    affectedMetrics: ["totalTasks"],
  });
  assert.equal(server.pushDelta(deltaOldAfter), 0);
});
