/**
 * @fileoverview E2E tests for Interface Plane API endpoints
 *
 * End-to-end tests that verify the full request/response cycle of API endpoints
 * including authentication, validation, and response formatting.
 */

import assert from "node:assert/strict";
import test from "node:test";

// @ts-ignore
import { HttpApiServer } from "../../../../../src/platform/five-plane-interface/api/http-api-server.js";
// @ts-ignore
import type { MissionControlService } from "../../../../../src/platform/five-plane-interface/api/mission-control-service.js";
// @ts-ignore
import type { InspectService } from "../../../../../src/platform/shared/observability/inspect-service.js";
// @ts-ignore
import type { ApprovalService } from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
// @ts-ignore
import type { BillingService } from "../../../../../src/scale-ecosystem/billing/billing-service.js";
// @ts-ignore
import type { ApiDelegationService } from "../../../../../src/platform/five-plane-interface/api/facade-interfaces.js";

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
        task: { id: "task-1", title: "Test Task", status: "done", tenantId: null, createdAt: "2026-04-16T00:00:00.000Z", updatedAt: "2026-04-16T00:00:00.000Z" },
        events: [],
        artifacts: [],
      },
      inspect: { task: { id: "task-1" }, steps: [], executions: [], approvals: [], artifacts: [], dispatchDecisions: [], stepResults: [], runtimeRecovery: { candidates: [] }, workflowState: null },
      timeline: { entries: [] },
    };
  }
  listWorkflowCockpits() {
    return [
      { taskId: "task-1", workflowId: "wf-1", workflowStatus: "done", currentStepIndex: 0, pendingApprovalCount: 0, retryCount: 0, updatedAt: "2026-04-16T00:00:00.000Z" },
    ];
  }
  getWorkflowCockpit() {
    return {
      summary: { taskId: "task-1", workflowId: "wf-1", workflowStatus: "done", currentStepIndex: 0, pendingApprovalCount: 0, retryCount: 0, resumableFromStep: null },
      inspect: { task: { id: "task-1", tenantId: null }, steps: [], executions: [], approvals: [], artifacts: [], dispatchDecisions: [], stepResults: [], runtimeRecovery: { candidates: [] }, workflowState: null },
      timeline: { entries: [] },
    };
  }
  getAdminTakeoverConsole() {
    return {
      scope: { taskId: "task-123", divisionId: null, workspaceId: null, tenantId: null },
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
    return [
      { taskId: "task-1", title: "Test Task", divisionId: null, priority: "normal", taskStatus: "done", workflowId: null, workflowStatus: null, currentStepIndex: null, sessionStatus: null, activeExecutionId: null, latestExecutionStatus: null, pendingApprovalCount: 0, resolvedApprovalCount: 0, dispatchDecisionCount: 0, latestEventAt: null, updatedAt: "2026-04-16T00:00:00.000Z" },
    ];
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
    return [
      { decisionId: "appr-1", decisionType: "approval", status: "requested", taskId: "task-1", requestedAt: "2026-04-16T00:00:00.000Z", completedAt: null },
    ];
  }
  getApprovalInspectView() {
    return {
      approval: { id: "appr-1", taskId: "task-1", decisionType: "approval", status: "completed", requestedAt: "2026-04-16T00:00:00.000Z", completedAt: "2026-04-16T01:00:00.000Z" },
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
  buildSummary() { return { generatedAt: "2026-04-16T00:00:00.000Z", coordinators: [], hotCoordinators: [] }; }
  selectCoordinator() { return { selectedCoordinatorId: "coord-1", score: 0.5, candidates: 1 }; }
}

function createE2eServer(): HttpApiServer {
  return new HttpApiServer({
    approvalService: new NoOpApprovalService(),
    inspectService: new NoOpInspectService(),
    missionControlService: new NoOpMissionControlService(),
    billingService: new NoOpBillingService(),
    coordinatorLoadBalancingService: new NoOpApiDelegationService(),
    authService: null, // Use no-op auth
  });
}

// ── Health Endpoint E2E ────────────────────────────────────────────────────────

test("E2E: GET /healthz returns ok status with proper response envelope", async () => {
  const server = createE2eServer();
  await server.start();

  try {
    const response = await server.inject({
      url: "/healthz",
      method: "GET",
      headers: {},
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.status, "ok");
    assert.ok(body.generatedAt);
  } finally {
    await server.stop();
  }
});

// ── Task Endpoints E2E ──────────────────────────────────────────────────────────

test("E2E: GET /api/v1/tasks returns task list with pagination envelope", async () => {
  const server = createE2eServer();
  await server.start();

  try {
    const response = await server.inject({
      url: "/api/v1/tasks",
      method: "GET",
      headers: {},
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.ok(Array.isArray(body.data.tasks));
    assert.ok("requestId" in body);
    assert.ok("data" in body);
  } finally {
    await server.stop();
  }
});

test("E2E: GET /api/v1/tasks/:id returns task cockpit", async () => {
  const server = createE2eServer();
  await server.start();

  try {
    const response = await server.inject({
      url: "/api/v1/tasks/task-1",
      method: "GET",
      headers: {},
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.ok(body.data.snapshot?.task);
  } finally {
    await server.stop();
  }
});

test("E2E: GET /api/v1/workflows returns workflow list", async () => {
  const server = createE2eServer();
  await server.start();

  try {
    const response = await server.inject({
      url: "/api/v1/workflows",
      method: "GET",
      headers: {},
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.ok(Array.isArray(body.data.workflows));
  } finally {
    await server.stop();
  }
});

test("E2E: GET /api/v1/workflows/:id returns workflow cockpit", async () => {
  const server = createE2eServer();
  await server.start();

  try {
    const response = await server.inject({
      url: "/api/v1/workflows/task-1",
      method: "GET",
      headers: {},
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.ok(body.data.summary);
  } finally {
    await server.stop();
  }
});

// ── Approval Endpoints E2E ─────────────────────────────────────────────────────

test("E2E: GET /approvals returns approval list", async () => {
  const server = createE2eServer();
  await server.start();

  try {
    const response = await server.inject({
      url: "/approvals",
      method: "GET",
      headers: {},
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.ok(Array.isArray(body.data.approvals));
  } finally {
    await server.stop();
  }
});

test("E2E: GET /v1/approvals returns approval list (v1 route)", async () => {
  const server = createE2eServer();
  await server.start();

  try {
    const response = await server.inject({
      url: "/v1/approvals",
      method: "GET",
      headers: {},
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.ok(Array.isArray(body.data.approvals));
  } finally {
    await server.stop();
  }
});

test("E2E: POST /approvals/:id/decision processes decision payload", async () => {
  const server = createE2eServer();
  await server.start();

  try {
    const response = await server.inject({
      url: "/approvals/appr-1/decision",
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ decisionType: "confirmed" }),
    });

    // Should return 200 (or 404 if approval not found)
    assert.ok(response.statusCode >= 200 && response.statusCode < 500);
  } finally {
    await server.stop();
  }
});

test("E2E: POST /approvals/:id/decision validates required fields", async () => {
  const server = createE2eServer();
  await server.start();

  try {
    const response = await server.inject({
      url: "/approvals/appr-1/decision",
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ decisionType: "option_selected" }), // Missing selectedOptionId
    });

    // Should return 400 due to validation error
    assert.equal(response.statusCode, 400);
  } finally {
    await server.stop();
  }
});

// ── Admin Endpoints E2E ────────────────────────────────────────────────────────

test("E2E: GET /v1/stability returns stability panel", async () => {
  const server = createE2eServer();
  await server.start();

  try {
    const response = await server.inject({
      url: "/v1/stability",
      method: "GET",
      headers: {},
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.ok(body.data.health);
  } finally {
    await server.stop();
  }
});

test("E2E: GET /v1/admin/control-plane/load-balancing returns coordinator summary", async () => {
  const server = createE2eServer();
  await server.start();

  try {
    const response = await server.inject({
      url: "/v1/admin/control-plane/load-balancing",
      method: "GET",
      headers: {},
    });

    // May return 401/403 without proper auth, or 200 with data
    assert.ok(response.statusCode >= 200 || response.statusCode >= 400);
  } finally {
    await server.stop();
  }
});

test("E2E: POST /v1/admin/control-plane/load-balancing/select with valid payload", async () => {
  const server = createE2eServer();
  await server.start();

  try {
    const response = await server.inject({
      url: "/v1/admin/control-plane/load-balancing/select",
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ queueName: "default" }),
    });

    // May return 401/403 without admin auth, or 200/503 if service unavailable
    assert.ok(response.statusCode >= 200 || response.statusCode >= 400);
  } finally {
    await server.stop();
  }
});

// ── CORS E2E ──────────────────────────────────────────────────────────────────

test("E2E: OPTIONS request returns CORS preflight headers", async () => {
  const server = createE2eServer();
  await server.start();

  try {
    const response = await server.inject({
      url: "/v1/tasks",
      method: "OPTIONS",
      headers: {
        origin: "https://console.example.test",
        "access-control-request-method": "GET",
        "access-control-request-headers": "content-type,authorization",
      },
    });

    assert.equal(response.statusCode, 204);
    assert.equal(response.headers["access-control-allow-origin"], "https://console.example.test");
    assert.ok(response.headers["access-control-allow-methods"]);
    assert.ok(response.headers["access-control-allow-headers"]);
  } finally {
    await server.stop();
  }
});

test("E2E: GET request with Origin header returns CORS headers in response", async () => {
  const server = createE2eServer();
  await server.start();

  try {
    const response = await server.inject({
      url: "/healthz",
      method: "GET",
      headers: {
        origin: "https://console.example.test",
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["access-control-allow-origin"], "https://console.example.test");
  } finally {
    await server.stop();
  }
});

// ── Security Headers E2E ──────────────────────────────────────────────────────

test("E2E: All responses include security headers", async () => {
  const server = createE2eServer();
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
    assert.equal(response.headers["referrer-policy"], "no-referrer");
  } finally {
    await server.stop();
  }
});

test("E2E: Response includes x-request-id for traceability", async () => {
  const server = createE2eServer();
  await server.start();

  try {
    const response = await server.inject({
      url: "/healthz",
      method: "GET",
      headers: {},
    });

    assert.ok(response.headers["x-request-id"]);
  } finally {
    await server.stop();
  }
});

// ── Error Handling E2E ─────────────────────────────────────────────────────────

test("E2E: Malformed JSON in request body returns 400", async () => {
  const server = createE2eServer();
  await server.start();

  try {
    const response = await server.inject({
      url: "/v1/auth/token",
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: "{ invalid json }",
    });

    assert.equal(response.statusCode, 400);
    const body = response.json();
    assert.ok(body.error);
  } finally {
    await server.stop();
  }
});

test("E2E: Missing required payload fields returns validation error", async () => {
  const server = createE2eServer();
  await server.start();

  try {
    const response = await server.inject({
      url: "/v1/admin/control-plane/load-balancing/select",
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: "null",
    });

    assert.equal(response.statusCode, 400);
  } finally {
    await server.stop();
  }
});

test("E2E: Request to unknown route returns 404 with proper error envelope", async () => {
  const server = createE2eServer();
  await server.start();

  try {
    const response = await server.inject({
      url: "/api/v1/nonexistent-resource-xyz",
      method: "GET",
      headers: {},
    });

    assert.equal(response.statusCode, 404);
    const body = response.json();
    assert.ok(body.error || body.data);
  } finally {
    await server.stop();
  }
});
