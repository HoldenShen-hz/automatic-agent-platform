import assert from "node:assert/strict";
import test from "node:test";

import { DashboardWebSocketServer } from "../../../../src/interaction/dashboard/dashboard-websocket-server.js";

test("DashboardWebSocketServer registerClient binds principal and tenantId into the connection ack", () => {
  const server = new DashboardWebSocketServer();

  const { clientId, ack } = server.registerClient(
    [{ channel: "global" }],
    "principal-1",
    "tenant-1",
    "delta-42",
    "2.0",
  );

  assert.ok(clientId.length > 0);
  assert.equal(ack.type, "connection_ack");
  assert.deepEqual(ack.payload, {
    clientId,
    principal: "principal-1",
    tenantId: "tenant-1",
    subscribedChannels: [{ channel: "global" }],
    subscribedMetrics: [],
    serverTime: (ack.payload as { serverTime: string }).serverTime,
    schemaVersion: "2.0",
    missedEvents: 0,
    authorizedChannels: ["global"],
    recoveryRequired: false,
  });
});

test("DashboardWebSocketServer registerClient rejects missing auth binding inputs", () => {
  const server = new DashboardWebSocketServer();

  assert.throws(
    () => server.registerClient([{ channel: "global" }], "", "tenant-1"),
    /dashboard_ws\.identity_required:principal/,
  );
  assert.throws(
    () => server.registerClient([{ channel: "global" }], "principal-1", ""),
    /dashboard_ws\.identity_required:tenant/,
  );
  assert.throws(
    () => server.registerClient([{ channel: "global" }]),
    /dashboard_ws\.identity_required:principal/,
  );
});

test("DashboardWebSocketServer registerClient rejects tenant outside authorization scope", () => {
  const server = new DashboardWebSocketServer();

  assert.throws(
    () => server.registerClient(
      [{ channel: "global" }],
      "principal-1",
      "tenant-2",
      null,
      "1.0",
      {
        allowedChannels: ["global"],
        allowedTenantIds: ["tenant-1"],
      },
    ),
    /outside the authorized scope/,
  );
});
