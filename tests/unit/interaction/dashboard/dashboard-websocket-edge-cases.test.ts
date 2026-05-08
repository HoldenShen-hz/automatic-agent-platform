/**
 * Edge Case Tests: Dashboard WebSocket Server
 *
 * Tests edge cases and boundary conditions for the DashboardWebSocketServer.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { DashboardWebSocketServer } from "../../../../src/interaction/dashboard/dashboard-websocket-server.js";
import type { DashboardDelta } from "../../../../src/interaction/dashboard/dashboard-projection-service.js";

function createDashboardDelta(overrides: Partial<DashboardDelta> = {}): DashboardDelta {
  return {
    deltaId: "delta-edge",
    timestamp: new Date().toISOString(),
    changes: [],
    affectedMetrics: ["totalTasks"],
    ...overrides,
  };
}

test("DashboardWebSocketServer handles unregister unknown client", () => {
  const server = new DashboardWebSocketServer();

  // Should not throw
  server.unregisterClient("completely_unknown_client");
  assert.equal(server.getClientCount(), 0);
});

test("DashboardWebSocketServer handles updateSubscriptions for unknown client", () => {
  const server = new DashboardWebSocketServer();

  const result = server.updateSubscriptions("unknown_client", ["dashboard:operator"]);

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

  const { clientId, ack } = server.registerClient(["dashboard:operator"]);

  // Should reject immediately since maxClients is 0
  assert.equal(clientId, "");
  assert.equal(ack.type, "error");
});

test("DashboardWebSocketServer handles empty dashboard list", () => {
  const server = new DashboardWebSocketServer();

  const { clientId } = server.registerClient([]);

  assert.ok(clientId.length > 0);
  assert.equal(server.getClientCount(), 1);
});

test("DashboardWebSocketServer handles duplicate subscription updates", () => {
  const server = new DashboardWebSocketServer();

  const { clientId } = server.registerClient(["dashboard:operator"]);

  // Update to same dashboard
  const result1 = server.updateSubscriptions(clientId, ["dashboard:operator"]);
  // Update to same dashboard again
  const result2 = server.updateSubscriptions(clientId, ["dashboard:operator"]);

  assert.equal(result1, true);
  assert.equal(result2, true);
});

test("DashboardWebSocketServer updateSubscriptions removes from old dashboards", () => {
  const server = new DashboardWebSocketServer();

  const { clientId } = server.registerClient(["dashboard:a", "dashboard:b"]);
  server.updateSubscriptions(clientId, ["dashboard:c"]);

  const delta = createDashboardDelta({ affectedMetrics: ["dashboard:a"] });
  const sentCount = server.pushDelta(delta);

  // Should not reach client anymore
  assert.equal(sentCount, 0);
});

test("DashboardWebSocketServer pushDelta handles empty affectedMetrics", () => {
  const server = new DashboardWebSocketServer();

  const { clientId } = server.registerClient(["totalTasks"]);
  const delta = createDashboardDelta({ affectedMetrics: [] });

  const sentCount = server.pushDelta(delta);

  assert.equal(sentCount, 0);
});

test("DashboardWebSocketServer pushDelta handles wildcard subscription", () => {
  const server = new DashboardWebSocketServer();

  server.registerClient(["*"]);
  const delta = createDashboardDelta({ affectedMetrics: ["anything", "at.all"] });

  const sentCount = server.pushDelta(delta);

  assert.equal(sentCount, 1);
});

test("DashboardWebSocketServer broadcast handles empty message payload", () => {
  const server = new DashboardWebSocketServer();

  server.registerClient(["dashboard:operator"]);
  server.registerClient(["dashboard:fleet"]);

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

  const { clientId } = server.registerClient(["dashboard:operator"]);

  const clients = server.getConnectedClients();

  assert.equal(clients.length, 1);
  assert.equal(clients[0]!.clientId, clientId);
  assert.deepEqual(clients[0]!.subscribedDashboards, ["dashboard:operator"]);
  assert.equal(clients[0]!.isConnected, true);
});

test("DashboardWebSocketServer getConnectedClients after unregister", () => {
  const server = new DashboardWebSocketServer();

  const { clientId } = server.registerClient(["dashboard:operator"]);
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
  server.registerClient(["totalTasks"]);

  const delta = createDashboardDelta({ affectedMetrics: ["totalTasks"] });

  // Should work even without delta handler set
  const sentCount = server.handleProjectionDelta(delta);

  assert.equal(sentCount, 1);
});

test("DashboardWebSocketServer handleProjectionDelta with delta handler", () => {
  const server = new DashboardWebSocketServer();
  server.registerClient(["totalTasks"]);

  let handlerCalled = false;
  server.setDeltaHandler((delta, clientIds) => {
    handlerCalled = true;
    assert.ok(delta.deltaId.length > 0);
    assert.ok(clientIds.length > 0);
  });

  const delta = createDashboardDelta({ affectedMetrics: ["totalTasks"] });
  server.handleProjectionDelta(delta);

  assert.equal(handlerCalled, true);
});

test("DashboardWebSocketServer pushDelta does not send to disconnected clients", () => {
  const server = new DashboardWebSocketServer();

  const { clientId } = server.registerClient(["totalTasks"]);
  server.unregisterClient(clientId);

  const delta = createDashboardDelta({ affectedMetrics: ["totalTasks"] });
  const sentCount = server.pushDelta(delta);

  assert.equal(sentCount, 0);
});

test("DashboardWebSocketServer createMessage generates valid structure", () => {
  const server = new DashboardWebSocketServer();

  const message = (server as any).createMessage("dashboard_delta", "client_123", { data: "test" });

  assert.equal(message.type, "dashboard_delta");
  assert.equal(message.clientId, "client_123");
  assert.ok(message.timestamp.length > 0);
  assert.deepEqual(message.payload, { data: "test" });
});

test("DashboardWebSocketServer all message types are valid", () => {
  const server = new DashboardWebSocketServer();

  const messageTypes = ["dashboard_delta", "dashboard_snapshot", "connection_ack", "error"] as const;

  for (const type of messageTypes) {
    const message = (server as any).createMessage(type, "test_client", { data: type });
    assert.equal(message.type, type);
  }
});

test("DashboardWebSocketServer delta handler receives correct client IDs", () => {
  const server = new DashboardWebSocketServer();

  server.registerClient(["dashboard:a"]);
  server.registerClient(["dashboard:b"]);
  server.registerClient(["dashboard:a", "dashboard:c"]);

  let receivedClientIds: string[] = [];
  server.setDeltaHandler((delta, clientIds) => {
    receivedClientIds = clientIds;
  });

  const delta = createDashboardDelta({ affectedMetrics: ["dashboard:a"] });
  server.handleProjectionDelta(delta);

  assert.ok(receivedClientIds.length >= 2); // At least clients subscribed to dashboard:a
});

test("DashboardWebSocketServer client subscription update is atomic", () => {
  const server = new DashboardWebSocketServer();

  const { clientId } = server.registerClient(["dashboard:old"]);

  // Before update
  const deltaOld = createDashboardDelta({ affectedMetrics: ["dashboard:old"] });
  assert.equal(server.pushDelta(deltaOld), 1);

  // After update
  server.updateSubscriptions(clientId, ["dashboard:new"]);
  const deltaNew = createDashboardDelta({ affectedMetrics: ["dashboard:new"] });
  assert.equal(server.pushDelta(deltaNew), 1);

  const deltaOldAfter = createDashboardDelta({ affectedMetrics: ["dashboard:old"] });
  assert.equal(server.pushDelta(deltaOldAfter), 0);
});
