import assert from "node:assert/strict";
import test from "node:test";

import type { DashboardDelta } from "../../../../src/interaction/dashboard/dashboard-projection-service.js";
import { DashboardWebSocketServer } from "../../../../src/interaction/dashboard/dashboard-websocket-server.js";

function createDashboardDelta(overrides: Partial<DashboardDelta> = {}): DashboardDelta {
  return {
    deltaId: "delta-1",
    timestamp: new Date().toISOString(),
    tenantId: "tenant-1",
    visibilityScope: "tenant",
    changes: [{
      changeType: "task_updated",
      entityId: "task-1",
      newValue: { taskId: "task-1", tenantId: "tenant-1" },
    }],
    affectedMetrics: ["totalTasks"],
    ...overrides,
  };
}

test("DashboardWebSocketServer rejects unauthorized privileged channel subscriptions", () => {
  const server = new DashboardWebSocketServer();

  assert.throws(
    () => server.registerClient(
      [{ channel: "admin" }],
      "principal-1",
      "tenant-1",
      null,
      "1.0",
      { allowedChannels: ["global"], allowedTenantIds: ["tenant-1"] },
    ),
    /not authorized/,
  );
});

test("DashboardWebSocketServer enforces task scope authorization on registration and updates", () => {
  const server = new DashboardWebSocketServer();

  const { clientId } = server.registerClient(
    [{ channel: "task", filterId: "task-1" }],
    "principal-1",
    "tenant-1",
    null,
    "1.0",
    {
      allowedChannels: ["task"],
      allowedTenantIds: ["tenant-1"],
      allowedTaskIds: ["task-1"],
    },
  );

  assert.equal(
    server.updateSubscriptions(clientId, [{ channel: "task", filterId: "task-1" }]),
    true,
  );
  assert.throws(
    () => server.updateSubscriptions(clientId, [{ channel: "task", filterId: "task-2" }]),
    /outside the authorized scope/,
  );
});

test("DashboardWebSocketServer filters tenant-scoped deltas on the server side", () => {
  const server = new DashboardWebSocketServer();

  server.registerClient(
    [{ channel: "task", filterId: "task-1" }],
    "principal-a",
    "tenant-1",
    null,
    "1.0",
    { allowedChannels: ["task"], allowedTenantIds: ["tenant-1"], allowedTaskIds: ["task-1"] },
  );
  server.registerClient(
    [{ channel: "task", filterId: "task-1" }],
    "principal-b",
    "tenant-2",
    null,
    "1.0",
    { allowedChannels: ["task"], allowedTenantIds: ["tenant-2"], allowedTaskIds: ["task-1"] },
  );

  const sentCount = server.pushDelta(createDashboardDelta());

  assert.equal(sentCount, 1);
});

test("DashboardWebSocketServer replays buffered deltas after lastEventId for the same tenant and scope", () => {
  const server = new DashboardWebSocketServer();
  const authorization = {
    allowedChannels: ["task"] as const,
    allowedTenantIds: ["tenant-1"],
    allowedTaskIds: ["task-1"],
  };

  server.registerClient(
    [{ channel: "task", filterId: "task-1" }],
    "principal-1",
    "tenant-1",
    null,
    "1.0",
    authorization,
  );

  server.pushDelta(createDashboardDelta({ deltaId: "delta-1" }));
  server.pushDelta(createDashboardDelta({ deltaId: "delta-2" }));
  server.pushDelta(createDashboardDelta({ deltaId: "delta-3" }));

  const reconnect = server.registerClient(
    [{ channel: "task", filterId: "task-1" }],
    "principal-1",
    "tenant-1",
    "delta-1",
    "1.0",
    authorization,
  );

  assert.deepEqual(
    reconnect.missedEvents?.map((delta) => delta.deltaId),
    ["delta-2", "delta-3"],
  );
  assert.equal(reconnect.gapMessage, undefined);
});

test("DashboardWebSocketServer returns stream_gap when lastEventId is no longer replayable", () => {
  const server = new DashboardWebSocketServer();

  server.registerClient(
    [{ channel: "task", filterId: "task-1" }],
    "principal-1",
    "tenant-1",
    null,
    "1.0",
    { allowedChannels: ["task"], allowedTenantIds: ["tenant-1"], allowedTaskIds: ["task-1"] },
  );
  server.pushDelta(createDashboardDelta({ deltaId: "delta-2" }));

  const reconnect = server.registerClient(
    [{ channel: "task", filterId: "task-1" }],
    "principal-1",
    "tenant-1",
    "delta-1",
    "1.0",
    { allowedChannels: ["task"], allowedTenantIds: ["tenant-1"], allowedTaskIds: ["task-1"] },
  );

  assert.equal(reconnect.gapMessage?.type, "stream_gap");
  assert.deepEqual(reconnect.gapMessage?.payload, {
    lastEventId: "delta-1",
    expectedOldestEventId: "delta-2",
    latestEventId: "delta-2",
    reasonCode: "stream.last_event_id_not_replayable",
    recoveryAction: "resync_from_snapshot",
  });
});

test("DashboardWebSocketServer routes deltas to metric subscribers without requiring a channel match", () => {
  const server = new DashboardWebSocketServer();

  server.registerClient(
    [{ channel: "approvals" }],
    "principal-1",
    "tenant-1",
    null,
    "1.0",
    { allowedChannels: ["approvals"], allowedTenantIds: ["tenant-1"] },
    ["totalTasks"],
  );

  const sentCount = server.pushDelta(createDashboardDelta({
    changes: [{
      changeType: "system_health_changed",
      entityId: "platform",
      newValue: { status: "degraded" },
    }],
    affectedMetrics: ["totalTasks"],
  }));

  assert.equal(sentCount, 1);
});

test("DashboardWebSocketServer updateMetricSubscriptions removes old metric routing", () => {
  const server = new DashboardWebSocketServer();
  const { clientId } = server.registerClient(
    [{ channel: "approvals" }],
    "principal-1",
    "tenant-1",
    null,
    "1.0",
    { allowedChannels: ["approvals"], allowedTenantIds: ["tenant-1"] },
    ["totalTasks"],
  );

  assert.equal(server.updateMetricSubscriptions(clientId, ["incidentCount"]), true);

  const oldMetricCount = server.pushDelta(createDashboardDelta({
    changes: [{
      changeType: "system_health_changed",
      entityId: "platform",
      newValue: { status: "degraded" },
    }],
    affectedMetrics: ["totalTasks"],
  }));
  const newMetricCount = server.pushDelta(createDashboardDelta({
    changes: [{
      changeType: "system_health_changed",
      entityId: "platform",
      newValue: { status: "degraded" },
    }],
    affectedMetrics: ["incidentCount"],
  }));

  assert.equal(oldMetricCount, 0);
  assert.equal(newMetricCount, 1);
});
