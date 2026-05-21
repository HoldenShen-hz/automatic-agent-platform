import assert from "node:assert/strict";
import { createServer as createNetServer } from "node:net";
import test from "node:test";

import { ApiAuthService } from "../../../../src/platform/five-plane-interface/api/api-auth-service.js";
import { HttpApiServer } from "../../../../src/platform/five-plane-interface/api/http-api-server.js";

const ADMIN_API_KEY = "admin-api-key";

class NoOpMissionControlService {
  async getHealthReportAsync() {
    return {
      status: "ok",
      queuedTasks: 0,
      activeExecutions: 0,
      tier1AckBacklog: 0,
      generatedAt: "2026-04-16T00:00:00.000Z",
    };
  }

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
        task: {
          id: "task-1",
          title: "Test Task",
          status: "done",
          tenantId: null,
          createdAt: "2026-04-16T00:00:00.000Z",
          updatedAt: "2026-04-16T00:00:00.000Z",
        },
        events: [],
        artifacts: [],
      },
      inspect: {
        task: { id: "task-1", tenantId: null },
        steps: [],
        executions: [],
        approvals: [],
        artifacts: [],
        dispatchDecisions: [],
        stepResults: [],
        runtimeRecovery: { candidates: [] },
        workflowState: null,
      },
      timeline: { entries: [] },
    };
  }
  listWorkflowCockpits() {
    return [
      {
        taskId: "task-1",
        workflowId: "wf-1",
        workflowStatus: "done",
        currentStepIndex: 0,
        pendingApprovalCount: 0,
        retryCount: 0,
        updatedAt: "2026-04-16T00:00:00.000Z",
      },
    ];
  }
  getWorkflowCockpit() {
    return {
      summary: {
        taskId: "task-1",
        workflowId: "wf-1",
        workflowStatus: "done",
        currentStepIndex: 0,
        pendingApprovalCount: 0,
        retryCount: 0,
        resumableFromStep: null,
      },
      inspect: {
        task: { id: "task-1", tenantId: null },
        steps: [],
        executions: [],
        approvals: [],
        artifacts: [],
        dispatchDecisions: [],
        stepResults: [],
        runtimeRecovery: { candidates: [] },
        workflowState: { workflowId: "wf-1" },
      },
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

class NoOpInspectService {
  queryTaskInspectSummaries() {
    return [
      {
        taskId: "task-1",
        title: "Test Task",
        divisionId: null,
        priority: "normal",
        taskStatus: "done",
        workflowId: null,
        workflowStatus: null,
        currentStepIndex: null,
        sessionStatus: null,
        activeExecutionId: null,
        latestExecutionStatus: null,
        pendingApprovalCount: 0,
        resolvedApprovalCount: 0,
        dispatchDecisionCount: 0,
        latestEventAt: null,
        updatedAt: "2026-04-16T00:00:00.000Z",
      },
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
      workflowState: { workflowId: "wf-1" },
    };
  }

  queryDecisionInspectSummaries() {
    return [
      {
        decisionId: "appr-1",
        decisionType: "approval",
        status: "requested",
        taskId: "task-1",
        requestedAt: "2026-04-16T00:00:00.000Z",
        completedAt: null,
      },
    ];
  }

  getApprovalInspectView() {
    return {
      approval: {
        id: "appr-1",
        taskId: "task-1",
        decisionType: "approval",
        status: "completed",
        requestedAt: "2026-04-16T00:00:00.000Z",
        completedAt: "2026-04-16T01:00:00.000Z",
      },
      task: { tenantId: null },
      timeline: { entries: [] },
    };
  }
}

class NoOpApprovalService {
  async listApprovals() { return { approvals: [] }; }
  async createApproval() { return { approvalId: "", status: "", decisionId: "" }; }
  async submitDecision() { return { id: "", status: "" }; }
  applyDecision() {}
}

class NoOpBillingService {
  createInvoice() { return { invoiceId: "", accountId: "", amount: 0, status: "", createdAt: "" }; }
  createCheckoutSession() { return { sessionId: "", invoiceId: "", gatewayKind: "", gatewaySessionRef: "", status: "", createdAt: "" }; }
  reconcileCheckout() { return { session: { status: "" }, invoice: { status: "" } }; }
}

class NoOpApiDelegationService {
  async route() { return null; }
  buildSummary() { return { generatedAt: "2026-04-16T00:00:00.000Z", coordinators: [], hotCoordinators: [] }; }
  selectCoordinator() { return { selectedCoordinatorId: "coord-1", score: 0.5, candidates: 1 }; }
}

function createAuthService() {
  return new ApiAuthService({
    apiKeys: [
      {
        apiKey: ADMIN_API_KEY,
        actorId: "admin-1",
        roles: ["viewer", "operator", "admin"],
      },
    ],
    jwtSecret: "test-secret",
  });
}

function createE2eServer(options: {
  auth?: boolean;
  allowedOrigins?: string[];
} = {}): HttpApiServer {
  return new HttpApiServer({
    approvalService: new NoOpApprovalService() as never,
    inspectService: new NoOpInspectService() as never,
    missionControlService: new NoOpMissionControlService() as never,
    billingService: new NoOpBillingService() as never,
    coordinatorLoadBalancingService: new NoOpApiDelegationService() as never,
    authService: options.auth === false ? null : createAuthService(),
    ...(options.allowedOrigins != null ? { cors: { allowedOrigins: options.allowedOrigins } } : {}),
  });
}

const ADMIN_HEADERS = { "x-api-key": ADMIN_API_KEY };

async function canBindLocalSockets(): Promise<boolean> {
  return await new Promise((resolve) => {
    const probe = createNetServer();
    probe.once("error", () => resolve(false));
    probe.listen(0, "127.0.0.1", () => {
      probe.close(() => resolve(true));
    });
  });
}

const canBindSockets = await canBindLocalSockets();

function networkPathTest(name: string, body: Parameters<typeof test>[1]): void {
  test(name, async (t) => {
    if (!canBindSockets) {
      t.diagnostic("Skipping local socket bind lifecycle path: local sockets are unavailable in this environment.");
      return;
    }
    await body(t);
  });
}

networkPathTest("E2E API: GET /healthz returns the mission-control health report", async () => {
  const server = createE2eServer();
  await server.start();

  try {
    const response = await server.inject({ url: "/healthz", method: "GET", headers: {} });
    const body = response.json<{ data: { status: string } }>();

    assert.equal(response.statusCode, 200);
    assert.equal(body.data.status, "ok");
  } finally {
    await server.stop();
  }
});

networkPathTest("E2E API: protected task routes return 401 when auth is not configured", async () => {
  const server = createE2eServer({ auth: false });
  await server.start();

  try {
    const response = await server.inject({ url: "/api/v1/tasks", method: "GET", headers: {} });
    assert.equal(response.statusCode, 401);
  } finally {
    await server.stop();
  }
});

networkPathTest("E2E API: GET /api/v1/tasks returns the task list with authenticated headers", async () => {
  const server = createE2eServer();
  await server.start();

  try {
    const response = await server.inject({ url: "/api/v1/tasks", method: "GET", headers: ADMIN_HEADERS });
    const body = response.json<{ data: { tasks: unknown[] } }>();

    assert.equal(response.statusCode, 200);
    assert.ok(Array.isArray(body.data.tasks));
  } finally {
    await server.stop();
  }
});

networkPathTest("E2E API: GET /api/v1/tasks/:id returns the task cockpit", async () => {
  const server = createE2eServer();
  await server.start();

  try {
    const response = await server.inject({ url: "/api/v1/tasks/task-1", method: "GET", headers: ADMIN_HEADERS });
    const body = response.json<{ data: { snapshot: { task: unknown } } }>();

    assert.equal(response.statusCode, 200);
    assert.ok(body.data.snapshot.task);
  } finally {
    await server.stop();
  }
});

networkPathTest("E2E API: workflow and approval listing routes succeed with authenticated headers", async () => {
  const server = createE2eServer();
  await server.start();

  try {
    const workflows = await server.inject({ url: "/api/v1/workflows", method: "GET", headers: ADMIN_HEADERS });
    const approvals = await server.inject({ url: "/v1/approvals", method: "GET", headers: ADMIN_HEADERS });

    assert.equal(workflows.statusCode, 200);
    assert.equal(approvals.statusCode, 200);
    assert.ok(Array.isArray(workflows.json<{ data: { workflows: unknown[] } }>().data.workflows));
    assert.ok(Array.isArray(approvals.json<{ data: { approvals: unknown[] } }>().data.approvals));
  } finally {
    await server.stop();
  }
});

networkPathTest("E2E API: POST /approvals/:id/decision validates required fields", async () => {
  const server = createE2eServer();
  await server.start();

  try {
    const response = await server.inject({
      url: "/approvals/appr-1/decision",
      method: "POST",
      headers: {
        ...ADMIN_HEADERS,
        "content-type": "application/json",
      },
      body: JSON.stringify({ decisionType: "option_selected" }),
    });

    assert.equal(response.statusCode, 400);
  } finally {
    await server.stop();
  }
});

networkPathTest("E2E API: GET /v1/stability returns the stability panel for an authenticated principal", async () => {
  const server = createE2eServer();
  await server.start();

  try {
    const response = await server.inject({ url: "/v1/stability", method: "GET", headers: ADMIN_HEADERS });
    const body = response.json<{ data: { health: unknown } }>();

    assert.equal(response.statusCode, 200);
    assert.ok(body.data.health);
  } finally {
    await server.stop();
  }
});

networkPathTest("E2E API: preflight and normal responses emit CORS headers when the origin is allowed", async () => {
  const server = createE2eServer({ allowedOrigins: ["https://console.example.test"] });
  await server.start();

  try {
    const preflight = await server.inject({
      url: "/v1/tasks",
      method: "OPTIONS",
      headers: {
        origin: "https://console.example.test",
        "access-control-request-method": "GET",
        "access-control-request-headers": "content-type,authorization",
      },
    });
    const getResponse = await server.inject({
      url: "/healthz",
      method: "GET",
      headers: {
        origin: "https://console.example.test",
      },
    });

    assert.equal(preflight.statusCode, 204);
    assert.equal(preflight.headers["access-control-allow-origin"], "https://console.example.test");
    assert.equal(getResponse.statusCode, 200);
    assert.equal(getResponse.headers["access-control-allow-origin"], "https://console.example.test");
  } finally {
    await server.stop();
  }
});

networkPathTest("E2E API: responses include security and traceability headers", async () => {
  const server = createE2eServer();
  await server.start();

  try {
    const response = await server.inject({ url: "/healthz", method: "GET", headers: {} });

    assert.equal(response.headers["x-frame-options"], "DENY");
    assert.equal(response.headers["x-content-type-options"], "nosniff");
    assert.equal(response.headers["strict-transport-security"], "max-age=31536000; includeSubDomains");
    assert.ok(response.headers["x-request-id"]);
  } finally {
    await server.stop();
  }
});

networkPathTest("E2E API: malformed JSON on the auth route returns 400 when auth is configured", async () => {
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
    assert.ok(response.json<{ error: unknown }>().error);
  } finally {
    await server.stop();
  }
});

networkPathTest("E2E API: unknown routes return a structured 404 response", async () => {
  const server = createE2eServer();
  await server.start();

  try {
    const response = await server.inject({ url: "/v1/does-not-exist", method: "GET", headers: {} });
    const body = response.json<{ error: { code: string } }>();

    assert.equal(response.statusCode, 404);
    assert.equal(typeof body.error.code, "string");
  } finally {
    await server.stop();
  }
});
