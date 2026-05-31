import assert from "node:assert/strict";
import test from "node:test";

import { DashboardWebSocketServer, createDashboardWebSocketServer } from "../../../../src/interaction/dashboard/dashboard-websocket-server.js";
import type { DashboardDelta } from "../../../../src/interaction/dashboard/dashboard-projection-service.js";

type DashboardWebSocketServerPrivate = DashboardWebSocketServer & {
  heartbeatTimer: ReturnType<typeof setInterval> | null;
};

function createDashboardDelta(overrides: Partial<DashboardDelta> = {}): DashboardDelta {
  return {
    deltaId: "delta-1",
    timestamp: new Date().toISOString(),
    changes: [],
    affectedMetrics: ["totalTasks"],
    ...overrides,
  };
}

function registerClient(server: DashboardWebSocketServer, subscriptions: readonly string[]) {
  return server.registerClient(subscriptions, "principal-test", "tenant-test");
}

test("DashboardWebSocketServer registers client successfully", () => {
  const server = new DashboardWebSocketServer();

  const { clientId, ack } = registerClient(server, ["dashboard:operator"]);

  assert.ok(clientId);
  assert.equal(ack.type, "connection_ack");
  assert.equal((ack.payload as { clientId: string }).clientId, clientId);
});

test("DashboardWebSocketServer rejects when max clients reached", () => {
  const server = new DashboardWebSocketServer({ maxClients: 1 });

  registerClient(server, ["dashboard:operator"]);
  const { clientId, ack } = registerClient(server, ["dashboard:operator"]);

  assert.equal(clientId, "rejected:max_clients");
  assert.equal(ack.type, "error");
});

test("DashboardWebSocketServer unregisters client", () => {
  const server = new DashboardWebSocketServer();

  const { clientId } = registerClient(server, ["dashboard:operator"]);
  server.unregisterClient(clientId);

  assert.equal(server.getClientCount(), 0);
});

test("DashboardWebSocketServer updates subscriptions", () => {
  const server = new DashboardWebSocketServer();

  const { clientId } = registerClient(server, ["dashboard:operator"]);
  const updated = server.updateSubscriptions(clientId, ["dashboard:fleet", "dashboard:platform"]);

  assert.equal(updated, true);
});

test("DashboardWebSocketServer returns false for unknown client subscription update", () => {
  const server = new DashboardWebSocketServer();

  const updated = server.updateSubscriptions("unknown-client", ["dashboard:operator"]);

  assert.equal(updated, false);
});

test("DashboardWebSocketServer isClientConnected returns correct status", () => {
  const server = new DashboardWebSocketServer();

  const { clientId } = registerClient(server, ["dashboard:operator"]);
  assert.equal(server.isClientConnected(clientId), true);

  server.unregisterClient(clientId);
  assert.equal(server.isClientConnected(clientId), false);
});

test("DashboardWebSocketServer pushes delta to subscribed clients", () => {
  const server = new DashboardWebSocketServer();

  const { clientId } = registerClient(server, ["totalTasks", "incidentCount"]);
  const delta = createDashboardDelta({ affectedMetrics: ["totalTasks"] });

  const sentCount = server.pushDelta(delta);

  assert.equal(sentCount, 1);
});

test("DashboardWebSocketServer pushes delta to all subscribed dashboards", () => {
  const server = new DashboardWebSocketServer();

  registerClient(server, ["totalTasks"]);
  registerClient(server, ["incidentCount"]);
  registerClient(server, ["totalTasks", "incidentCount"]);

  const delta = createDashboardDelta({ affectedMetrics: ["totalTasks", "incidentCount"] });

  const sentCount = server.pushDelta(delta);

  assert.equal(sentCount, 3);
});

test("DashboardWebSocketServer does not push to unsubscribed clients", () => {
  const server = new DashboardWebSocketServer();

  registerClient(server, ["totalTasks"]);
  const delta = createDashboardDelta({ affectedMetrics: ["incidentCount"] });

  const sentCount = server.pushDelta(delta);

  assert.equal(sentCount, 0);
});

test("DashboardWebSocketServer wildcard subscription receives all deltas", () => {
  const server = new DashboardWebSocketServer();

  registerClient(server, ["*"]);
  const delta = createDashboardDelta({ affectedMetrics: ["totalTasks", "incidentCount", "systemHealth"] });

  const sentCount = server.pushDelta(delta);

  assert.equal(sentCount, 1);
});

test("DashboardWebSocketServer pushes snapshot to specific client", () => {
  const server = new DashboardWebSocketServer();

  const { clientId } = registerClient(server, ["dashboard:operator"]);
  const snapshot = { totalTasks: 42 };

  const success = server.pushSnapshotToClient(clientId, snapshot);

  assert.equal(success, true);
});

test("DashboardWebSocketServer pushSnapshotToClient returns false for disconnected client", () => {
  const server = new DashboardWebSocketServer();

  const { clientId } = registerClient(server, ["dashboard:operator"]);
  server.unregisterClient(clientId);

  const success = server.pushSnapshotToClient(clientId, { data: "test" });

  assert.equal(success, false);
});

test("DashboardWebSocketServer broadcast reaches all connected clients", () => {
  const server = new DashboardWebSocketServer();

  registerClient(server, ["dashboard:operator"]);
  registerClient(server, ["dashboard:fleet"]);

  const message = {
    type: "dashboard_snapshot" as const,
    clientId: "",
    timestamp: new Date().toISOString(),
    payload: { data: "test" },
  };

  const sentCount = server.broadcast(message);

  assert.equal(sentCount, 2);
});

test("DashboardWebSocketServer getConnectedClients returns correct list", () => {
  const server = new DashboardWebSocketServer();

  const { clientId } = registerClient(server, ["dashboard:operator"]);
  registerClient(server, ["dashboard:fleet"]);

  const clients = server.getConnectedClients();

  assert.equal(clients.length, 2);
  assert.ok(clients.some((c) => c.clientId === clientId));
});

test("DashboardWebSocketServer handleProjectionDelta processes delta", () => {
  const server = new DashboardWebSocketServer();

  registerClient(server, ["totalTasks"]);
  const delta = createDashboardDelta({ affectedMetrics: ["totalTasks"] });

  const sentCount = server.handleProjectionDelta(delta);

  assert.equal(sentCount, 1);
});

test("DashboardWebSocketServer start and stop manage heartbeat", () => {
  const server = new DashboardWebSocketServer();

  server.start();
  assert.ok((server as DashboardWebSocketServerPrivate).heartbeatTimer != null);
  // Start should be idempotent
  server.start();
  assert.ok((server as DashboardWebSocketServerPrivate).heartbeatTimer != null);

  server.stop();
  assert.equal((server as DashboardWebSocketServerPrivate).heartbeatTimer, null);
  // Stop should be idempotent
  server.stop();
  assert.equal((server as DashboardWebSocketServerPrivate).heartbeatTimer, null);
});

test("DashboardWebSocketServer getClientCount returns correct count", () => {
  const server = new DashboardWebSocketServer();

  assert.equal(server.getClientCount(), 0);

  registerClient(server, ["dashboard:operator"]);
  assert.equal(server.getClientCount(), 1);

  registerClient(server, ["dashboard:fleet"]);
  assert.equal(server.getClientCount(), 2);

  server.unregisterClient(server.getConnectedClients()[0]!.clientId);
  assert.equal(server.getClientCount(), 1);
});

test("createDashboardWebSocketServer factory works", () => {
  const server = createDashboardWebSocketServer({ maxClients: 500 });

  const { clientId } = registerClient(server, ["dashboard:operator"]);

  assert.ok(clientId);
  assert.equal(server.getClientCount(), 1);
});

test("DashboardWebSocketServer subscription update removes from old dashboards", () => {
  const server = new DashboardWebSocketServer();

  const { clientId } = registerClient(server, ["dashboard:operator"]);
  server.updateSubscriptions(clientId, ["dashboard:fleet"]);

  const delta = createDashboardDelta({ affectedMetrics: ["dashboard:operator"] });
  const sentCount = server.pushDelta(delta);

  assert.equal(sentCount, 0);
});
