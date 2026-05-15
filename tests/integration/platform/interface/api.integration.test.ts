/**
 * @fileoverview Integration tests for HTTP Server API routes
 *
 * Tests the HTTP server routes with mocked dependencies to verify
 * request/response handling and route matching.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { HttpApiServer } from "../../../../src/platform/five-plane-interface/api/http-api-server.js";
import { ApiAuthService, type ApiKeyRecord } from "../../../../src/platform/five-plane-interface/api/api-auth-service.js";
import { PrometheusMetricsExporter } from "../../../../src/platform/shared/observability/prometheus-metrics-exporter.js";
import type { MissionControlService } from "../../../../src/platform/five-plane-interface/api/mission-control-service.js";
import type { InspectService } from "../../../../src/platform/shared/observability/inspect-service.js";
import type { ApprovalService } from "../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import type { BillingService } from "../../../../src/scale-ecosystem/billing/billing-service.js";
import type { ApiDelegationService } from "../../../../src/platform/five-plane-interface/api/facade-interfaces.js";

class MockPrometheusMetricsExporter extends PrometheusMetricsExporter {
  constructor() {
    // Pass minimal dependencies - they won't be used since we're overriding export()
    super(null as any, {} as any);
  }

  public override export(): string {
    return `# HELP process_cpu_seconds_total Total user and system CPU time spent in seconds.
# TYPE process_cpu_seconds_total counter
process_cpu_seconds_total 0
# HELP http_requests_total Total number of HTTP requests.
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/healthz",status="200"} 1`;
  }
}

class NoOpMissionControlService implements MissionControlService {
  async snapshot() {
    return {
      generatedAt: "2026-04-16T00:00:00.000Z",
      health: { status: "ok", queuedTasks: 0, activeExecutions: 0, tier1AckBacklog: 0 },
      metrics: { tasksTotal: 0, tasksActive: 0, tasksDone: 0, tasksFailed: 0 },
      taskBoard: [],
      pendingApprovals: [],
      productSignals: { billingAccounts: [], latestPmfReport: null, perceptionBriefs: [] },
      divisions: [],
      gatewayTargets: [],
    };
  }
  getHealthReportAsync() {
    return Promise.resolve({
      status: "ok",
      uptimeSeconds: 3600,
      dbWritable: true,
      providerHealth: "healthy",
      providerSuccessRate: 1.0,
      providerRecentCalls: 100,
      activeExecutions: 0,
      queuedTasks: 0,
      eventLoopLagMs: null,
      memoryRssMb: 100,
      tier1AckBacklog: 0,
      degradationMode: "none",
      backpressure: { engaged: false, reason: null },
      queueGovernance: { mode: "normal", queuedTasks: 0 },
      workerHealth: { total: 0, healthy: 0, unhealthy: 0 },
      findings: [],
    });
  }
  getStableTasks() { return []; }
  getWorkers() { return []; }
  getStabilityPanel() {
    return {
      health: { status: "ok", queuedTasks: 0, activeExecutions: 0, tier1AckBacklog: 0 },
      pendingApprovals: [],
      findings: [],
      blockedTasks: [],
      workers: [],
    };
  }
  getTaskCockpit() {
    return {
      snapshot: {
        task: { id: "task-1", title: "Test", status: "done", tenantId: null, createdAt: "", updatedAt: "" },
        events: [],
        artifacts: [],
      },
      inspect: { task: { id: "task-1" }, steps: [], executions: [], approvals: [], artifacts: [], dispatchDecisions: [], stepResults: [], runtimeRecovery: { candidates: [] }, workflowState: null },
      timeline: { entries: [] },
    };
  }
  listWorkflowCockpits() { return []; }
  getWorkflowCockpit() {
    return {
      summary: { taskId: "task-1", workflowId: "wf-1", workflowStatus: "done", currentStepIndex: 0, pendingApprovalCount: 0, retryCount: 0, resumableFromStep: null },
      inspect: { task: { id: "task-1", tenantId: null }, steps: [], executions: [], approvals: [], artifacts: [], dispatchDecisions: [], stepResults: [], runtimeRecovery: { candidates: [] }, workflowState: null },
      timeline: { entries: [] },
    };
  }
  getAdminTakeoverConsole() {
    return {
      scope: { taskId: "task-1", divisionId: null, workspaceId: null, tenantId: null },
      inspect: { takeoverSessions: [], operatorActions: [] },
      executionOwner: {},
      activeWorker: null,
      latestPmfVerdict: null,
      timeline: { entries: [] },
    };
  }
}

class NoOpInspectService implements InspectService {
  async taskInspect() {
    return { id: "", status: "", createdAt: "", updatedAt: "" };
  }
  async workflowInspect() {
    return { summary: { taskId: "" }, timeline: { entries: [] } };
  }
  queryTaskInspectSummaries() {
    return [];
  }
  getTaskInspectView() {
    return {
      task: { id: "task-1", tenantId: null },
      steps: [],
      executions: [],
      approvals: [],
      artifacts: [],
      dispatchDecisions: [],
      stepResults: [],
      runtimeRecovery: { candidates: [] },
      workflowState: null,
    };
  }
  queryDecisionInspectSummaries() {
    return [];
  }
  getApprovalInspectView() {
    return {
      approval: { id: "appr-1", taskId: "task-1", decisionType: "approval", status: "completed", requestedAt: "", completedAt: "" },
      timeline: { entries: [] },
    };
  }
}

class NoOpApprovalService implements ApprovalService {
  async listApprovals() { return { approvals: [] }; }
  async createApproval() { return { approvalId: "", status: "", decisionId: "" }; }
  async submitDecision() { return { id: "", status: "" }; }
  applyDecision() {}
}

class NoOpBillingService implements BillingService {
  createInvoice() { return { invoiceId: "", accountId: "", amount: 0, status: "", createdAt: "" }; }
  createCheckoutSession() { return { sessionId: "", invoiceId: "", gatewayKind: "", gatewaySessionRef: "", status: "", createdAt: "" }; }
  reconcileCheckout() { return { session: { status: "" }, invoice: { status: "" } }; }
}

class NoOpApiDelegationService implements ApiDelegationService {
  async route() { return null; }
  buildSummary() { return { generatedAt: "", coordinators: [], hotCoordinators: [] }; }
  selectCoordinator() { return { selectedCoordinatorId: "", score: 0, candidates: 0 }; }
}

function createTestServer(): HttpApiServer {
  return new HttpApiServer({
    approvalService: new NoOpApprovalService(),
    inspectService: new NoOpInspectService(),
    missionControlService: new NoOpMissionControlService(),
    billingService: new NoOpBillingService(),
    coordinatorLoadBalancingService: new NoOpApiDelegationService(),
    authService: new ApiAuthService({
      apiKeys: [{ apiKey: "test-api-key", actorId: "test-actor", roles: ["viewer"] }],
      jwtSecret: "test-jwt-secret-for-integration-tests-only",
    }),
    prometheusMetricsExporter: new MockPrometheusMetricsExporter(),
  });
}

test("HttpApiServer: GET /healthz returns healthy status", async () => {
  const server = createTestServer();
  await server.start();

  try {
    const response = await server.inject({
      url: "/healthz",
      method: "GET",
      headers: {},
    });

    assert.equal(response.statusCode, 200);
    const data = response.json();
    assert.equal(data.data.status, "ok");
  } finally {
    await server.stop();
  }
});

test("HttpApiServer: GET /healthz includes security headers", async () => {
  const server = createTestServer();
  await server.start();

  try {
    const response = await server.inject({
      url: "/healthz",
      method: "GET",
      headers: {},
    });

    assert.equal(response.headers["x-frame-options"], "DENY");
    assert.equal(response.headers["x-content-type-options"], "nosniff");
    assert.equal(response.headers["strict-transport-security"], "max-age=31536000; includeSubDomains");
  } finally {
    await server.stop();
  }
});

test("HttpApiServer: OPTIONS /v1/tasks returns CORS preflight headers", async () => {
  const server = createTestServer();
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

test("HttpApiServer: GET /nonexistent returns 404", async () => {
  const server = createTestServer();
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

test("HttpApiServer: POST with malformed JSON returns 400", async () => {
  const server = createTestServer();
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

test("HttpApiServer: Request body larger than limit returns 413", async () => {
  const server = createTestServer();
  await server.start();

  try {
    // Body must exceed MAX_BODY_BYTES (1,048,576) and be valid JSON with required fields
    const largeBody = JSON.stringify({ title: "x".repeat(1_050_000) });
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

test("HttpApiServer: GET /metrics returns Prometheus metrics", async () => {
  const server = createTestServer();
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

test("HttpApiServer: POST /v1/auth/token with valid payload succeeds", async () => {
  const server = createTestServer();
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
    assert.ok("accessToken" in data.data || "error" in data.data);
  } finally {
    await server.stop();
  }
});

test("HttpApiServer: broadcastTaskEvent does not throw when WebSocket disabled", async () => {
  const server = createTestServer();
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
    assert.ok(true); // If we get here, no exception was thrown
  } finally {
    await server.stop();
  }
});

test("HttpApiServer: GET /v1/stability returns stability panel", async () => {
  const server = createTestServer();
  await server.start();

  try {
    const response = await server.inject({
      url: "/v1/stability",
      method: "GET",
      headers: {
        "x-api-key": "test-api-key",
      },
    });

    assert.equal(response.statusCode, 200);
    const data = response.json();
    assert.equal(data.data.health.status, "ok");
  } finally {
    await server.stop();
  }
});

test("HttpApiServer: Request with gzip accept-encoding succeeds", async () => {
  const server = createTestServer();
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
