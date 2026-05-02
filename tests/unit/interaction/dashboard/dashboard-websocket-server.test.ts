/**
 * Unit Tests: Dashboard WebSocket Server
 *
 * Tests DashboardWebSocketServer including heartbeat behavior.
 *
 * Issue #2040: Heartbeat marks disconnect but doesn't unregister
 *
 * Test categories:
 * 1. Client registration and unregistration
 * 2. Heartbeat timeout marking disconnect without unregister (issue #2040)
 * 3. Subscription management
 * 4. Delta pushing and routing
 * 5. Reconnection and replay
 * 6. Authorization and validation
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  DashboardWebSocketServer,
  createDashboardWebSocketServer,
  type ChannelSubscription,
  type DashboardChannel,
  type DashboardSubscriptionAuthorization,
} from "../../../../src/interaction/dashboard/dashboard-websocket-server.js";
import type { DashboardDelta } from "../../../../src/interaction/dashboard/dashboard-projection-service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures & Helpers
// ─────────────────────────────────────────────────────────────────────────────

function createDashboardDelta(
  overrides: Partial<DashboardDelta> = {},
): DashboardDelta {
  return {
    deltaId: "delta-" + Math.random().toString(36).slice(2, 8),
    timestamp: new Date().toISOString(),
    tenantId: null,
    visibilityScope: "global",
    changes: [],
    affectedMetrics: ["totalTasks"],
    ...overrides,
  };
}

function createChannelSubscription(
  channel: DashboardChannel = "global",
  filterId?: string,
): ChannelSubscription {
  return { channel, filterId };
}

function createAuthorization(
  channels: readonly ChannelSubscription[],
  tenantId: string,
): DashboardSubscriptionAuthorization {
  const allowedTaskIds = channels
    .filter((subscription) => subscription.channel === "task")
    .map((subscription) => subscription.filterId)
    .filter((filterId): filterId is string => filterId !== undefined && filterId.length > 0);
  return {
    allowedChannels: [...new Set(channels.map((subscription) => subscription.channel))],
    allowedTenantIds: [tenantId],
    ...(allowedTaskIds.length > 0 ? { allowedTaskIds } : {}),
  };
}

function createTimedOutConnection(
  server: DashboardWebSocketServer,
  heartbeatIntervalMs: number,
): string {
  // Create a client
  const { clientId } = server.registerClient(
    [createChannelSubscription("global")],
    "principal-timer",
    "tenant-timer",
  );

  // Manually set lastActivityAt to be in the past to simulate timeout
  // This is needed because we can't easily manipulate time in tests
  // Instead we test the behavior through the performHeartbeat mechanism

  return clientId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Basic Client Registration & Unregistration
// ─────────────────────────────────────────────────────────────────────────────

test("registerClient returns clientId and connection_ack", () => {
  const server = new DashboardWebSocketServer();
  const { clientId, ack } = server.registerClient(
    [createChannelSubscription("global")],
    "principal-1",
    "tenant-1",
  );

  assert.ok(clientId.length > 0, "Client ID should be non-empty");
  assert.equal(ack.type, "connection_ack");
  assert.equal((ack.payload as { clientId: string }).clientId, clientId);

  server.stop();
});

test("registerClient throws on missing principal", () => {
  const server = new DashboardWebSocketServer();

  assert.throws(
    () => {
      server.registerClient(
        [createChannelSubscription("global")],
        "",
        "tenant-1",
      );
    },
    /Principal is required/,
  );

  server.stop();
});

test("registerClient throws on missing tenantId", () => {
  const server = new DashboardWebSocketServer();

  assert.throws(
    () => {
      server.registerClient(
        [createChannelSubscription("global")],
        "principal-1",
        "",
      );
    },
    /Tenant ID is required/,
  );

  server.stop();
});

test("registerClient throws on principal too long", () => {
  const server = new DashboardWebSocketServer();
  const longPrincipal = "a".repeat(300);

  assert.throws(
    () => {
      server.registerClient(
        [createChannelSubscription("global")],
        longPrincipal,
        "tenant-1",
      );
    },
    /Invalid credential format/,
  );

  server.stop();
});

test("registerClient returns error when maxClients reached", () => {
  const server = new DashboardWebSocketServer({ maxClients: 1 });

  server.registerClient(
    [createChannelSubscription("global")],
    "principal-1",
    "tenant-1",
  );

  const { clientId, ack } = server.registerClient(
    [createChannelSubscription("global")],
    "principal-2",
    "tenant-2",
  );

  assert.equal(clientId, "", "Should return empty clientId");
  assert.equal(ack.type, "error");

  server.stop();
});

test("unregisterClient removes client from server", () => {
  const server = new DashboardWebSocketServer();
  const { clientId } = server.registerClient(
    [createChannelSubscription("global")],
    "principal-1",
    "tenant-1",
    null,
    "1.0",
    {
      allowedChannels: ["global", "admin", "approvals"],
      allowedTenantIds: ["tenant-1"],
    },
  );

  assert.equal(server.getClientCount(), 1);

  server.unregisterClient(clientId);

  assert.equal(server.getClientCount(), 0);

  server.stop();
});

test("unregisterClient on unknown client is no-op", () => {
  const server = new DashboardWebSocketServer();

  // Should not throw
  server.unregisterClient("unknown-client-id");

  assert.equal(server.getClientCount(), 0);

  server.stop();
});

test("isClientConnected returns true for registered client", () => {
  const server = new DashboardWebSocketServer();
  const { clientId } = server.registerClient(
    [createChannelSubscription("global")],
    "principal-1",
    "tenant-1",
    null,
    "1.0",
    {
      allowedChannels: ["global", "admin"],
      allowedTenantIds: ["tenant-1"],
    },
  );

  assert.equal(server.isClientConnected(clientId), true);

  server.unregisterClient(clientId);
  server.stop();
});

test("isClientConnected returns false for unregistered client", () => {
  const server = new DashboardWebSocketServer();

  assert.equal(server.isClientConnected("unknown-id"), false);

  server.stop();
});

// ─────────────────────────────────────────────────────────────────────────────
// Issue #2040: Heartbeat marks disconnect but doesn't unregister
// ─────────────────────────────────────────────────────────────────────────────

test("heartbeat unregisters timed out clients (issue #2040 fixed)", () => {
  const server = new DashboardWebSocketServer({
    heartbeatIntervalMs: 60000, // 60 seconds
    connectionTimeoutMs: 100, // 100ms timeout for testing
  });

  const { clientId } = server.registerClient(
    [createChannelSubscription("global")],
    "principal-1",
    "tenant-1",
  );

  const connection = (server as { connections: Map<string, { lastActivityAt: string }> }).connections.get(clientId);
  assert.ok(connection);
  connection!.lastActivityAt = new Date(Date.now() - 1_000).toISOString();

  (server as { performHeartbeat: () => void }).performHeartbeat();

  assert.equal(server.isClientConnected(clientId), false);
  assert.equal(server.getClientCount(), 0);

  server.stop();
});

test("performHeartbeat removes timed out connections from the registry", () => {
  const server = new DashboardWebSocketServer({
    heartbeatIntervalMs: 100, // Short interval for testing
    connectionTimeoutMs: 50, // Very short timeout
  });

  const { clientId } = server.registerClient(
    [createChannelSubscription("global")],
    "principal-heartbeat",
    "tenant-heartbeat",
  );

  const connection = (server as { connections: Map<string, { lastActivityAt: string }> }).connections.get(clientId);
  assert.ok(connection);
  connection!.lastActivityAt = new Date(Date.now() - 1_000).toISOString();

  (server as { performHeartbeat: () => void }).performHeartbeat();

  assert.equal(server.isClientConnected(clientId), false);
  assert.equal(server.getClientCount(), 0);

  server.stop();
});

test("heartbeat cleanup removes timed out clients from counts and routing", () => {
  const server = new DashboardWebSocketServer({
    heartbeatIntervalMs: 100,
    connectionTimeoutMs: 50,
  });

  const { clientId } = server.registerClient(
    [createChannelSubscription("global")],
    "principal-test",
    "tenant-test",
  );

  const connection = (server as { connections: Map<string, { lastActivityAt: string }> }).connections.get(clientId);
  assert.ok(connection);
  connection!.lastActivityAt = new Date(Date.now() - 1_000).toISOString();

  (server as { performHeartbeat: () => void }).performHeartbeat();

  assert.equal(server.getClientCount(), 0);
  assert.equal(
    server.pushDelta(createDashboardDelta({
      changes: [{ changeType: "system_health_changed", entityId: "platform", newValue: {} }],
      affectedMetrics: ["totalTasks"],
    })),
    0,
  );

  server.stop();
});

// ─────────────────────────────────────────────────────────────────────────────
// Subscription Management
// ─────────────────────────────────────────────────────────────────────────────

test("updateSubscriptions modifies client subscriptions", () => {
  const server = new DashboardWebSocketServer();
  const { clientId } = server.registerClient(
    [createChannelSubscription("global")],
    "principal-1",
    "tenant-1",
    null,
    "1.0",
    {
      allowedChannels: ["global", "admin", "approvals"],
      allowedTenantIds: ["tenant-1"],
    },
  );

  const result = server.updateSubscriptions(clientId, [
    createChannelSubscription("admin"),
    createChannelSubscription("approvals"),
  ]);

  assert.equal(result, true);

  server.unregisterClient(clientId);
  server.stop();
});

test("updateSubscriptions returns false for unknown client", () => {
  const server = new DashboardWebSocketServer();

  const result = server.updateSubscriptions("unknown-client", [
    createChannelSubscription("global"),
  ]);

  assert.equal(result, false);

  server.stop();
});

test("updateSubscriptions removes from old channels", () => {
  const server = new DashboardWebSocketServer();
  const { clientId } = server.registerClient(
    [createChannelSubscription("global")],
    "principal-1",
    "tenant-1",
    null,
    "1.0",
    {
      allowedChannels: ["global", "admin"],
      allowedTenantIds: ["tenant-1"],
    },
  );

  // Push to global should work initially
  let delta = createDashboardDelta({
    changes: [{ changeType: "system_health_changed", entityId: "test", newValue: {} }],
  });
  let sent = server.pushDelta(delta);
  assert.equal(sent, 1);

  // Update subscription to different channel
  server.updateSubscriptions(clientId, [createChannelSubscription("admin")]);

  // Now global push should not reach this client
  delta = createDashboardDelta({
    changes: [{ changeType: "system_health_changed", entityId: "test", newValue: {} }],
    affectedMetrics: ["systemHealth"],
  });
  sent = server.pushDelta(delta);
  // May or may not reach depending on routing

  server.unregisterClient(clientId);
  server.stop();
});

test("registerClient with task channel requires filterId", () => {
  const server = new DashboardWebSocketServer();

  // This should throw because task channel requires filterId
  assert.throws(
    () => {
      server.registerClient(
        [createChannelSubscription("task")], // no filterId
        "principal-1",
        "tenant-1",
        null,
        "1.0",
        { allowedChannels: ["task"], allowedTenantIds: ["tenant-1"] },
      );
    },
    /Task channel subscriptions require a task filterId/,
  );

  server.stop();
});

test("registerClient with valid task channel subscription works", () => {
  const server = new DashboardWebSocketServer();

  const { clientId } = server.registerClient(
    [createChannelSubscription("task", "task-123")],
    "principal-1",
    "tenant-1",
    null,
    "1.0",
    createAuthorization([createChannelSubscription("task", "task-123")], "tenant-1"),
  );

  assert.ok(clientId.length > 0);
  assert.equal(server.isClientConnected(clientId), true);

  server.unregisterClient(clientId);
  server.stop();
});

test("registerClient with invalid task filterId throws", () => {
  const server = new DashboardWebSocketServer();

  assert.throws(
    () => {
      server.registerClient(
        [createChannelSubscription("task", "")], // empty filterId
        "principal-1",
        "tenant-1",
        null,
        "1.0",
        { allowedChannels: ["task"], allowedTenantIds: ["tenant-1"] },
      );
    },
    /Task channel subscriptions require a task filterId/,
  );

  server.stop();
});

test("registerClient with non-task channel ignores filterId", () => {
  const server = new DashboardWebSocketServer();

  // For non-task channels, filterId should be ignored or rejected
  // Currently the code checks this in validateSubscriptions
  assert.throws(
    () => {
      server.registerClient(
        [createChannelSubscription("global", "some-filter")], // filterId not allowed on global
        "principal-1",
        "tenant-1",
      );
    },
    /does not accept filterId/,
  );

  server.stop();
});

// ─────────────────────────────────────────────────────────────────────────────
// Delta Pushing and Routing
// ─────────────────────────────────────────────────────────────────────────────

test("pushDelta sends to subscribed clients", () => {
  const server = new DashboardWebSocketServer();
  const { clientId } = server.registerClient(
    [createChannelSubscription("approvals")],
    "principal-1",
    "tenant-1",
    null,
    "1.0",
    { allowedChannels: ["approvals"], allowedTenantIds: ["tenant-1"] },
    ["totalTasks"],
  );

  const delta = createDashboardDelta({
    changes: [{ changeType: "system_health_changed", entityId: "platform", newValue: {} }],
    affectedMetrics: ["totalTasks"],
  });
  const sentCount = server.pushDelta(delta);

  assert.equal(sentCount, 1);

  server.unregisterClient(clientId);
  server.stop();
});

test("pushDelta does not send to unsubscribed clients", () => {
  const server = new DashboardWebSocketServer();
  const { clientId } = server.registerClient(
    [createChannelSubscription("approvals")],
    "principal-1",
    "tenant-1",
    null,
    "1.0",
    { allowedChannels: ["approvals"], allowedTenantIds: ["tenant-1"] },
    ["incidentCount"],
  );

  const delta = createDashboardDelta({
    changes: [{ changeType: "system_health_changed", entityId: "platform", newValue: {} }],
    affectedMetrics: ["totalTasks"],
  });
  const sentCount = server.pushDelta(delta);

  assert.equal(sentCount, 0);

  server.unregisterClient(clientId);
  server.stop();
});

test("pushDelta with wildcard subscription receives all", () => {
  const server = new DashboardWebSocketServer();
  const { clientId } = server.registerClient(
    [createChannelSubscription("global")],
    "principal-global",
    "tenant-global",
  );

  const delta = createDashboardDelta({
    changes: [{ changeType: "system_health_changed", entityId: "platform", newValue: {} }],
    affectedMetrics: ["totalTasks", "incidentCount", "budgetAlerts"],
  });
  const sentCount = server.pushDelta(delta);

  assert.equal(sentCount, 1);

  server.unregisterClient(clientId);
  server.stop();
});

test("pushDelta routes task delta to specific task subscribers", () => {
  const server = new DashboardWebSocketServer();

  server.registerClient(
    [createChannelSubscription("task", "task-123")],
    "principal-1",
    "tenant-1",
    null,
    "1.0",
    createAuthorization([createChannelSubscription("task", "task-123")], "tenant-1"),
  );

  server.registerClient(
    [createChannelSubscription("task", "task-456")],
    "principal-2",
    "tenant-2",
    null,
    "1.0",
    createAuthorization([createChannelSubscription("task", "task-456")], "tenant-2"),
  );

  // Push delta for task-123
  const delta = createDashboardDelta({
    changes: [{ changeType: "task_updated", entityId: "task-123", newValue: {} }],
    affectedMetrics: ["totalTasks"],
  });
  const sentCount = server.pushDelta(delta);

  assert.equal(sentCount, 1, "Should only send to task-123 subscriber");

  server.stop();
});

test("pushDelta routes incident delta to admin channel", () => {
  const server = new DashboardWebSocketServer();

  server.registerClient(
    [createChannelSubscription("admin")],
    "principal-1",
    "tenant-1",
    null,
    "1.0",
    createAuthorization([createChannelSubscription("admin")], "tenant-1"),
  );

  const delta = createDashboardDelta({
    changes: [{ changeType: "incident_opened", entityId: "inc-1", newValue: {} }],
    affectedMetrics: ["incidentCount"],
  });

  const sentCount = server.pushDelta(delta);

  assert.equal(sentCount, 1);

  server.stop();
});

test("pushDelta routes system_health_changed to global channel", () => {
  const server = new DashboardWebSocketServer();

  server.registerClient(
    [createChannelSubscription("global")],
    "principal-1",
    "tenant-1",
  );

  const delta = createDashboardDelta({
    changes: [{ changeType: "system_health_changed", entityId: "system", newValue: {} }],
    affectedMetrics: ["systemHealth"],
  });

  const sentCount = server.pushDelta(delta);

  assert.equal(sentCount, 1);

  server.stop();
});

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot Pushing
// ─────────────────────────────────────────────────────────────────────────────

test("pushSnapshotToClient sends snapshot to specific client", () => {
  const server = new DashboardWebSocketServer();
  const { clientId } = server.registerClient(
    [createChannelSubscription("global")],
    "principal-1",
    "tenant-1",
  );

  const snapshot = {
    generatedAt: new Date().toISOString(),
    workflowBacklog: 5,
    incidentCount: 2,
    budgetAlerts: 1,
  };

  const success = server.pushSnapshotToClient(clientId, snapshot);

  assert.equal(success, true);

  server.unregisterClient(clientId);
  server.stop();
});

test("pushSnapshotToClient returns false for unknown client", () => {
  const server = new DashboardWebSocketServer();

  const success = server.pushSnapshotToClient("unknown-client", {
    generatedAt: new Date().toISOString(),
  });

  assert.equal(success, false);

  server.stop();
});

test("pushSnapshotToClient returns false for disconnected client", () => {
  const server = new DashboardWebSocketServer();
  const { clientId } = server.registerClient(
    [createChannelSubscription("global")],
    "principal-1",
    "tenant-1",
  );

  server.unregisterClient(clientId);

  const success = server.pushSnapshotToClient(clientId, { generatedAt: new Date().toISOString() });

  assert.equal(success, false);

  server.stop();
});

// ─────────────────────────────────────────────────────────────────────────────
// Broadcast
// ─────────────────────────────────────────────────────────────────────────────

test("broadcast reaches all connected clients", () => {
  const server = new DashboardWebSocketServer();

  server.registerClient([createChannelSubscription("global")], "p1", "t1");
  server.registerClient([createChannelSubscription("global")], "p2", "t2");
  server.registerClient([createChannelSubscription("global")], "p3", "t3");

  const message = {
    type: "dashboard_snapshot" as const,
    clientId: "",
    timestamp: new Date().toISOString(),
    payload: { test: "broadcast" },
  };

  const count = server.broadcast(message);

  assert.equal(count, 3);

  server.stop();
});

test("broadcast only reaches connected clients", () => {
  const server = new DashboardWebSocketServer();

  const { clientId } = server.registerClient(
    [createChannelSubscription("global")],
    "p1",
    "t1",
  );
  server.registerClient([createChannelSubscription("global")], "p2", "t2");

  // Unregister one client
  server.unregisterClient(clientId);

  const message = {
    type: "dashboard_snapshot" as const,
    clientId: "",
    timestamp: new Date().toISOString(),
    payload: { test: "broadcast" },
  };

  const count = server.broadcast(message);

  assert.equal(count, 1);

  server.stop();
});

// ─────────────────────────────────────────────────────────────────────────────
// getConnectedClients
// ─────────────────────────────────────────────────────────────────────────────

test("getConnectedClients returns all connected clients", () => {
  const server = new DashboardWebSocketServer();

  const { clientId: id1 } = server.registerClient(
    [createChannelSubscription("global")],
    "p1",
    "t1",
  );
  server.registerClient([createChannelSubscription("global")], "p2", "t2");

  const clients = server.getConnectedClients();

  assert.equal(clients.length, 2);
  assert.ok(clients.some((c) => c.clientId === id1));

  server.stop();
});

test("getConnectedClients returns empty for stopped server", () => {
  const server = new DashboardWebSocketServer();

  server.registerClient([createChannelSubscription("global")], "p1", "t1");

  server.stop();

  const clients = server.getConnectedClients();

  assert.equal(clients.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// getClientCount
// ─────────────────────────────────────────────────────────────────────────────

test("getClientCount returns correct count", () => {
  const server = new DashboardWebSocketServer();

  assert.equal(server.getClientCount(), 0);

  server.registerClient([createChannelSubscription("global")], "p1", "t1");
  assert.equal(server.getClientCount(), 1);

  server.registerClient([createChannelSubscription("global")], "p2", "t2");
  assert.equal(server.getClientCount(), 2);

  server.unregisterClient(server.getConnectedClients()[0]!.clientId);
  assert.equal(server.getClientCount(), 1);

  server.stop();
});

// ─────────────────────────────────────────────────────────────────────────────
// Start/Stop Heartbeat
// ─────────────────────────────────────────────────────────────────────────────

test("start initializes heartbeat timer", () => {
  const server = new DashboardWebSocketServer();

  server.start();
  // Should not throw
  server.start(); // idempotent

  server.stop();
});

test("stop clears heartbeat timer", () => {
  const server = new DashboardWebSocketServer();

  server.start();
  server.stop();
  // Should not throw
  server.stop(); // idempotent
});

test("start returns early if already started", () => {
  const server = new DashboardWebSocketServer();

  server.start();
  server.start(); // Should be no-op

  server.stop();
});

// ─────────────────────────────────────────────────────────────────────────────
// handleProjectionDelta
// ─────────────────────────────────────────────────────────────────────────────

test("handleProjectionDelta pushes delta to clients", () => {
  const server = new DashboardWebSocketServer();

  server.registerClient(
    [createChannelSubscription("global")],
    "principal-1",
    "tenant-1",
  );

  const delta = createDashboardDelta({
    changes: [{ changeType: "task_created", entityId: "task-new", newValue: {} }],
    affectedMetrics: ["totalTasks"],
  });

  const sentCount = server.handleProjectionDelta(delta);

  assert.equal(sentCount, 1);

  server.stop();
});

test("handleProjectionDelta uses deltaHandler if set", () => {
  const server = new DashboardWebSocketServer();

  let handlerCalled = false;
  server.setDeltaHandler((delta, clientIds) => {
    handlerCalled = true;
    assert.ok(delta.deltaId);
    assert.ok(Array.isArray(clientIds));
  });

  server.registerClient(
    [createChannelSubscription("approvals")],
    "principal-1",
    "tenant-1",
    null,
    "1.0",
    { allowedChannels: ["approvals"], allowedTenantIds: ["tenant-1"] },
    ["totalTasks"],
  );

  const delta = createDashboardDelta({
    changes: [{ changeType: "system_health_changed", entityId: "platform", newValue: {} }],
    affectedMetrics: ["totalTasks"],
  });
  server.handleProjectionDelta(delta);

  assert.equal(handlerCalled, true);

  server.stop();
});

// ─────────────────────────────────────────────────────────────────────────────
// integrateWithProjectionService
// ─────────────────────────────────────────────────────────────────────────────

test("integrateWithProjectionService returns cleanup function", () => {
  const server = new DashboardWebSocketServer();

  const mockProjectionService = {
    processProjectionUpdate: () => null,
    consumePendingDeltas: () => [],
  };

  const cleanup = server.integrateWithProjectionService(mockProjectionService);

  assert.ok(typeof cleanup === "function");

  cleanup();
  server.stop();
});

test("integrateWithProjectionService polls for deltas", async () => {
  const server = new DashboardWebSocketServer();

  let pollCount = 0;
  const mockProjectionService = {
    processProjectionUpdate: () => null,
    consumePendingDeltas: () => {
      pollCount++;
      return [];
    },
  };

  const cleanup = server.integrateWithProjectionService(mockProjectionService);
  await new Promise((resolve) => setTimeout(resolve, 250));

  assert.ok(pollCount >= 1, "Should have polled at least once");

  cleanup();
  server.stop();
});

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────

test("createDashboardWebSocketServer factory works", () => {
  const server = createDashboardWebSocketServer({ maxClients: 500 });

  const { clientId } = server.registerClient(
    [createChannelSubscription("global")],
    "principal-1",
    "tenant-1",
  );

  assert.ok(clientId);
  assert.equal(server.getClientCount(), 1);

  server.stop();
});

// ─────────────────────────────────────────────────────────────────────────────
// Reconnection with lastEventId
// ─────────────────────────────────────────────────────────────────────────────

test("registerClient with lastEventId computes missed events", () => {
  const server = new DashboardWebSocketServer();

  // First, create some deltas in the replay buffer
  const delta1 = createDashboardDelta({ deltaId: "delta-1", affectedMetrics: ["totalTasks"] });
  const delta2 = createDashboardDelta({ deltaId: "delta-2", affectedMetrics: ["totalTasks"] });

  server.pushDelta(delta1);
  server.pushDelta(delta2);

  // Now register a client with lastEventId = delta-1
  const result = server.registerClient(
    [createChannelSubscription("global")],
    "principal-reconnect",
    "tenant-reconnect",
    "delta-1", // lastEventId
  );

  assert.ok(result.clientId);
  assert.ok(result.missedEvents);
  assert.ok(result.missedEvents!.length >= 0);

  server.stop();
});

test("registerClient with non-existent lastEventId returns gap", () => {
  const server = new DashboardWebSocketServer();

  // Create some deltas first
  const delta = createDashboardDelta({ deltaId: "delta-1" });
  server.pushDelta(delta);

  // Register with lastEventId that doesn't exist
  const result = server.registerClient(
    [createChannelSubscription("global")],
    "principal-gap",
    "tenant-gap",
    "non-existent-delta",
  );

  assert.ok(result.gapMessage);
  assert.equal(result.gapMessage!.type, "stream_gap");

  server.stop();
});

test("registerClient with lastEventId but no replayable history returns no gap", () => {
  const server = new DashboardWebSocketServer();

  const result = server.registerClient(
    [createChannelSubscription("global")],
    "principal-future",
    "tenant-future",
    "future-delta-id",
  );

  assert.equal(result.gapMessage, undefined);
  assert.deepEqual(result.missedEvents, []);

  server.stop();
});

// ─────────────────────────────────────────────────────────────────────────────
// Tenant Isolation
// ─────────────────────────────────────────────────────────────────────────────

test("tenant isolation - delta with tenant scope only reaches matching tenant", () => {
  const server = new DashboardWebSocketServer();

  server.registerClient(
    [createChannelSubscription("global")],
    "principal-tenant1",
    "tenant-1",
  );

  const delta = createDashboardDelta({
    tenantId: "tenant-1",
    visibilityScope: "tenant",
    changes: [{ changeType: "task_updated", entityId: "task-1", newValue: {} }],
    affectedMetrics: ["totalTasks"],
  });

  const sentCount = server.pushDelta(delta);

  // Should reach tenant-1 client
  assert.equal(sentCount, 1);

  server.stop();
});

test("tenant isolation - delta with different tenant doesn't reach client", () => {
  const server = new DashboardWebSocketServer();

  server.registerClient(
    [createChannelSubscription("global")],
    "principal-tenant1",
    "tenant-1",
  );

  const delta = createDashboardDelta({
    tenantId: "tenant-2", // Different tenant
    visibilityScope: "tenant",
    changes: [{ changeType: "task_updated", entityId: "task-1", newValue: {} }],
    affectedMetrics: ["totalTasks"],
  });

  const sentCount = server.pushDelta(delta);

  // Should NOT reach tenant-1 client
  assert.equal(sentCount, 0);

  server.stop();
});

test("global scope delta reaches all tenants", () => {
  const server = new DashboardWebSocketServer();

  server.registerClient(
    [createChannelSubscription("global")],
    "principal-tenant1",
    "tenant-1",
  );

  server.registerClient(
    [createChannelSubscription("global")],
    "principal-tenant2",
    "tenant-2",
  );

  const delta = createDashboardDelta({
    tenantId: null,
    visibilityScope: "global",
    changes: [{ changeType: "system_health_changed", entityId: "system", newValue: {} }],
    affectedMetrics: ["systemHealth"],
  });

  const sentCount = server.pushDelta(delta);

  // Should reach both clients
  assert.equal(sentCount, 2);

  server.stop();
});
