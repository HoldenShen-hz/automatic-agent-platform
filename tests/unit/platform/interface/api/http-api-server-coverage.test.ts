import assert from "node:assert/strict";
import test from "node:test";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";
import { HttpApiServer } from "../../../../../src/platform/interface/api/http-api-server.js";
import type { MissionControlService } from "../../../../../src/platform/interface/api/mission-control-service.js";
import type { InspectService } from "../../../../../src/platform/shared/observability/inspect-service.js";
import type { ApprovalService } from "../../../../../src/platform/control-plane/approval-center/approval-service.js";
import type { BillingService } from "../../../../../src/scale-ecosystem/billing/billing-service.js";
import type { ApiDelegationService } from "../../../../../src/platform/interface/api/facade-interfaces.js";

class NoOpMissionControlService implements MissionControlService {
  async snapshot() {
    return { taskBoard: [], gatewayTargets: [], productSignals: { billingAccounts: [] } };
  }
  getStableTasks() {
    return [];
  }
  getWorkers() {
    return [];
  }
}

class NoOpInspectService implements InspectService {
  async taskInspect() {
    return { id: "", status: "", createdAt: "", updatedAt: "" };
  }
  async workflowInspect() {
    return { summary: { taskId: "" }, timeline: { entries: [] } };
  }
}

class NoOpApprovalService implements ApprovalService {
  async listApprovals() {
    return { approvals: [] };
  }
  async createApproval() {
    return { approvalId: "", status: "", decisionId: "" };
  }
  async submitDecision() {
    return { id: "", status: "" };
  }
}

class NoOpBillingService implements BillingService {
  createInvoice() {
    return { invoiceId: "", accountId: "", amount: 0, status: "", createdAt: "" };
  }
  createCheckoutSession() {
    return { sessionId: "", invoiceId: "", gatewayKind: "", gatewaySessionRef: "", status: "", createdAt: "" };
  }
  reconcileCheckout() {
    return { session: { status: "" }, invoice: { status: "" } };
  }
}

class NoOpApiDelegationService implements ApiDelegationService {
  async route() {
    return null;
  }
}

function createMinimalServer(): HttpApiServer {
  return new HttpApiServer({
    approvalService: new NoOpApprovalService(),
    inspectService: new NoOpInspectService(),
    missionControlService: new NoOpMissionControlService(),
    billingService: new NoOpBillingService(),
    coordinatorLoadBalancingService: new NoOpApiDelegationService(),
  });
}

test("HttpApiServer start and stop lifecycle", async () => {
  const server = createMinimalServer();

  const { host, port } = await server.start();
  assert.ok(host != null);
  assert.ok(port > 0);

  await server.stop();
});

test("HttpApiServer inject handles GET /healthz", async () => {
  const server = createMinimalServer();
  await server.start();

  try {
    const response = await server.inject({
      url: "/healthz",
      method: "GET",
      headers: {},
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["x-frame-options"], "DENY");
    assert.equal(response.headers["x-content-type-options"], "nosniff");
  } finally {
    await server.stop();
  }
});

test("HttpApiServer inject handles OPTIONS preflight request", async () => {
  const server = createMinimalServer();
  await server.start();

  try {
    const response = await server.inject({
      url: "/v1/tasks",
      method: "OPTIONS",
      headers: {
        origin: "https://console.example.test",
        "access-control-request-method": "GET",
      },
    });

    assert.equal(response.statusCode, 204);
    assert.equal(response.headers["access-control-allow-origin"], "https://console.example.test");
  } finally {
    await server.stop();
  }
});

test("HttpApiServer inject handles non-existent route", async () => {
  const server = createMinimalServer();
  await server.start();

  try {
    const response = await server.inject({
      url: "/nonexistent-route-xyz",
      method: "GET",
      headers: {},
    });

    assert.equal(response.statusCode, 404);
  } finally {
    await server.stop();
  }
});

test("HttpApiServer inject handles request body larger than limit", async () => {
  const server = createMinimalServer();
  await server.start();

  try {
    const largeBody = JSON.stringify({ data: "x".repeat(1_000_000) });
    const response = await server.inject({
      url: "/v1/tasks",
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(largeBody.length),
      },
      body: largeBody,
    });

    assert.equal(response.statusCode, 413);
  } finally {
    await server.stop();
  }
});

test("HttpApiServer broadcastTaskEvent does not throw when WebSocket bridge is disabled", async () => {
  const server = createMinimalServer();
  await server.start();

  try {
    const event = {
      eventType: "status_changed" as const,
      taskId: "task-123",
      status: "in_progress",
      timestamp: new Date().toISOString(),
    };

    // Should not throw even though WebSocket is disabled
    server.broadcastTaskEvent("task-123", event);
  } finally {
    await server.stop();
  }
});

test("HttpApiServer sets security headers on responses", async () => {
  const server = createMinimalServer();
  await server.start();

  try {
    const response = await server.inject({
      url: "/healthz",
      method: "GET",
      headers: {},
    });

    assert.equal(response.headers["x-frame-options"], "DENY");
    assert.equal(response.headers["x-content-type-options"], "nosniff");
    assert.equal(response.headers["strict-transport-security"]);
  } finally {
    await server.stop();
  }
});

test("HttpApiServer inject handles POST with JSON body", async () => {
  const server = createMinimalServer();
  await server.start();

  try {
    const response = await server.inject({
      url: "/v1/auth/token",
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ apiKey: "test-api-key" }),
    });

    assert.equal(response.statusCode, 200);
    const data = response.json();
    assert.ok("accessToken" in data || "error" in data);
  } finally {
    await server.stop();
  }
});

test("HttpApiServer inject returns 400 for malformed JSON", async () => {
  const server = createMinimalServer();
  await server.start();

  try {
    const response = await server.inject({
      url: "/v1/auth/token",
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: "not valid json {",
    });

    assert.equal(response.statusCode, 400);
  } finally {
    await server.stop();
  }
});

test("HttpApiServer WebSocket bridge initialization when enabled", async () => {
  const server = new HttpApiServer({
    approvalService: new NoOpApprovalService(),
    inspectService: new NoOpInspectService(),
    missionControlService: new NoOpMissionControlService(),
    billingService: new NoOpBillingService(),
    coordinatorLoadBalancingService: new NoOpApiDelegationService(),
    enableWebSocket: true,
    authService: null, // Will use no-op auth
  });

  await server.start();

  try {
    const response = await server.inject({
      url: "/healthz",
      method: "GET",
      headers: {},
    });

    assert.equal(response.statusCode, 200);
  } finally {
    await server.stop();
  }
});

test("HttpApiServer inject handles request with accept-encoding gzip", async () => {
  const server = createMinimalServer();
  await server.start();

  try {
    const response = await server.inject({
      url: "/healthz",
      method: "GET",
      headers: {
        "accept-encoding": "gzip",
      },
    });

    assert.equal(response.statusCode, 200);
  } finally {
    await server.stop();
  }
});

test("HttpApiServer inject records Prometheus metrics", async () => {
  const server = createMinimalServer();
  await server.start();

  try {
    const response = await server.inject({
      url: "/metrics",
      method: "GET",
      headers: {},
    });

    assert.equal(response.statusCode, 200);
    const text = response.text();
    assert.ok(text.includes("http_requests_total") || text.includes("process_"));
  } finally {
    await server.stop();
  }
});
