/**
 * Integration tests for API server / HTTP routes
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../../helpers/integration-context.js";
import { HttpApiServer } from "../../../../../src/platform/five-plane-interface/api/http-api-server.js";
import { ApiAuthService } from "../../../../../src/platform/five-plane-interface/api/api-auth-service.js";
import { MissionControlService } from "../../../../../src/platform/five-plane-interface/api/mission-control-service.js";
import type { ApprovalService } from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import type { ApprovalDecision } from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import type { InspectService } from "../../../../../src/platform/shared/observability/inspect-service.js";
import type { MissionControlServiceType } from "../../../../../src/platform/five-plane-interface/api/mission-control-service.js";

function createMockApprovalService(): ApprovalService {
  return {
    applyDecision: (decision: ApprovalDecision) => {},
  } as unknown as ApprovalService;
}

function createMockInspectService(): InspectService {
  return {
    getApprovalInspectView: () => ({
      task: { id: "task_123", title: "Test Task", status: "in_progress", tenantId: null },
      workflowState: null, execution: null, session: null,
      approval: {
        id: "approval_123", taskId: "task_123", status: "requested", type: "human_review",
        requestedBy: "agent_1", requestedAt: new Date().toISOString(), summary: "Test",
        options: ["approve", "reject"], riskLevel: "medium", context: {}, timeoutMs: 300000,
        deadline: null, resolvedBy: null, resolvedAt: null, decision: null, tenantId: null,
        traceId: "trace_123", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      },
      approvals: [], operatorActions: [], agentExecution: null, dispatchDecisions: [],
      remoteRoutingSummary: null, leaseHandoverSummary: null, recentEvents: [], stepResults: [],
      taskResult: null, artifacts: [], runtimeRecovery: { candidates: [], resumable: false },
    }),
    queryDecisionInspectSummaries: () => [],
    queryTaskInspectSummaries: () => [],
    getTaskInspectView: () => ({
      task: { id: "task_123", title: "Test Task", status: "in_progress", tenantId: null },
      workflow: null, execution: null, session: null, events: [], approvals: [],
      operatorActions: [], agentExecution: null, dispatchDecisions: [], remoteRoutingSummary: null,
      leaseHandoverSummary: null, stepResults: [], taskResult: null, artifacts: [],
      runtimeRecovery: { candidates: [], resumable: false },
    }),
  } as unknown as InspectService;
}

function createMockMissionControlService(): MissionControlServiceType {
  const snapshot = {
    generatedAt: new Date().toISOString(),
    health: {
      status: "ok", uptimeSeconds: 100, dbWritable: true, providerHealth: "healthy",
      providerSuccessRate: 1.0, providerRecentCalls: 0, activeExecutions: 0, queuedTasks: 0,
      eventLoopLagMs: null, memoryRssMb: 64, tier1AckBacklog: 0, degradationMode: "none",
      queueGovernance: { tier1Pending: 0, tier2Pending: 0, tier3Pending: 0, throughput: { p50Ms: 0, p99Ms: 0 } },
      workerHealth: { totalWorkers: 0, activeWorkers: 0, idleWorkers: 0 }, findings: [],
    },
    metrics: {
      tasks: { total: 0, queued: 0, inProgress: 0, done: 0, failed: 0 },
      executions: { active: 0, queued: 0, completed: 0, failed: 0 },
    },
    taskBoard: [], pendingApprovals: [], divisions: [], productSignals: {
      latestPmfReport: null, billingAccounts: [], perceptionBriefs: [],
    }, gatewayTargets: [],
  };
  return {
    getSnapshot: () => ({ ...snapshot }),
    getHealthReportAsync: async () => snapshot.health,
    getTaskCockpit: () => ({
      snapshot: { task: { id: "task_123", title: "Test", status: "in_progress", tenantId: null }, events: [], artifacts: [] },
      inspect: { task: { id: "task_123", title: "Test", status: "in_progress", tenantId: null }, workflow: null, execution: null, session: null, events: [], approvals: [], operatorActions: [], agentExecution: null, dispatchDecisions: [], remoteRoutingSummary: null, leaseHandoverSummary: null, stepResults: [], taskResult: null, artifacts: [], runtimeRecovery: { candidates: [], resumable: false } },
      timeline: { entries: [] },
    }),
    getWorkflowCockpit: () => ({
      summary: { workflowId: "wf_123", taskId: "task_123", workflowStatus: "in_progress", currentStepIndex: 0, retryCount: 0, pendingApprovalCount: 0, resumableFromStep: null },
      inspect: { task: { id: "task_123", title: "Test", status: "in_progress", tenantId: null }, workflow: null, execution: null, session: null, events: [], approvals: [], operatorActions: [], agentExecution: null, dispatchDecisions: [], remoteRoutingSummary: null, leaseHandoverSummary: null, stepResults: [], taskResult: null, artifacts: [], runtimeRecovery: { candidates: [], resumable: false } },
      timeline: { entries: [] },
    }),
    listWorkflowCockpits: () => [],
    getStabilityPanel: () => ({
      generatedAt: new Date().toISOString(), health: snapshot.health, activeTasks: [], queuedTasks: [], blockedTasks: [], workflows: [], pendingApprovals: [], workers: [], findings: [],
    }),
    getAdminTakeoverConsole: () => ({
      generatedAt: new Date().toISOString(), scope: { taskId: "task_123", divisionId: null, workspaceId: null, tenantId: null },
      executionOwner: { executionId: null, workerId: null, leaseId: null, leaseStatus: null },
      activeWorker: null, latestPmfVerdict: null, inspect: { takeoverSessions: [], operatorActions: [] }, timeline: { entries: [] },
    }),
    listApprovalQueue: () => [],
  } as unknown as MissionControlServiceType;
}

function createTestServer() {
  const authService = new ApiAuthService({
    apiKeys: [
      { apiKey: "test-operator-key", actorId: "operator_1", roles: ["viewer", "operator"] },
      { apiKey: "test-admin-key", actorId: "admin_1", roles: ["viewer", "operator", "admin"] },
      { apiKey: "test-viewer-key", actorId: "viewer_1", roles: ["viewer"] },
    ],
    jwtSecret: "test-jwt-secret",
    tokenTtlMs: 60 * 60 * 1000,
  });

  const server = new HttpApiServer({
    approvalService: createMockApprovalService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
    authService,
  });

  return { server, authService };
}

test("Integration: HttpApiServer health endpoint responds correctly", async () => {
  const { server } = createTestServer();
  await server.start({ port: 0 });
  try {
    const response = await server.inject({ method: "GET", url: "/health" });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.data?.status, "ok");
  } finally {
    await server.stop();
  }
});

test("Integration: HttpApiServer handles full request lifecycle", async () => {
  const { server } = createTestServer();
  await server.start({ port: 0 });
  try {
    const start = Date.now();
    const response = await server.inject({
      method: "GET",
      url: "/healthz",
    });
    const duration = Date.now() - start;

    assert.equal(response.statusCode, 200);
    assert.ok(duration < 5000);
  } finally {
    await server.stop();
  }
});

test("Integration: authenticated request with bearer token", async () => {
  const { server, authService } = createTestServer();
  const token = authService.exchangeApiKey("test-operator-key").accessToken;

  await server.start({ port: 0 });
  try {
    const response = await server.inject({
      method: "GET",
      url: "/v1/tasks",
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(response.statusCode, 200);
  } finally {
    await server.stop();
  }
});

test("Integration: unauthenticated request denied", async () => {
  const { server } = createTestServer();
  await server.start({ port: 0 });
  try {
    const response = await server.inject({ method: "GET", url: "/v1/tasks" });
    assert.equal(response.statusCode, 401);
  } finally {
    await server.stop();
  }
});

test("Integration: API key authentication via header", async () => {
  const { server } = createTestServer();
  await server.start({ port: 0 });
  try {
    const response = await server.inject({
      method: "GET",
      url: "/v1/tasks",
      headers: { "x-api-key": "test-operator-key" },
    });

    assert.equal(response.statusCode, 200);
  } finally {
    await server.stop();
  }
});

test("Integration: API key exchange for bearer token", async () => {
  const { server } = createTestServer();
  await server.start({ port: 0 });
  try {
    const response = await server.inject({
      method: "POST",
      url: "/v1/auth/token",
      headers: { "x-api-key": "test-operator-key" },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.data?.tokenType, "Bearer");
    assert.ok(typeof body.data?.accessToken === "string");
  } finally {
    await server.stop();
  }
});

test("Integration: POST /v1/tasks reports unavailable without task store", async () => {
  const ctx = createIntegrationContext("aa-api-server-");
  const { server, authService } = createTestServer();
  try {
    await server.start({ port: 0 });

    const token = authService.exchangeApiKey("test-operator-key").accessToken;

    const response = await server.inject({
      method: "POST",
      url: "/api/v1/tasks",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "idempotency-key": "api-server-create-task",
      },
      body: JSON.stringify({
        title: "Integration test task",
        inputJson: JSON.stringify({ request: "test" }),
      }),
    });

    assert.equal(response.statusCode, 503);
    const body = response.json();
    assert.equal(body.error?.code, "api.task_store_unavailable");
  } finally {
    await server.stop();
    ctx.cleanup();
  }
});

test("Integration: OPTIONS preflight request", async () => {
  const authService = new ApiAuthService({
    apiKeys: [
      { apiKey: "test-operator-key", actorId: "operator_1", roles: ["viewer", "operator"] },
    ],
    jwtSecret: "test-jwt-secret",
    tokenTtlMs: 60 * 60 * 1000,
  });
  const server = new HttpApiServer({
    approvalService: createMockApprovalService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
    authService,
    cors: {
      allowedOrigins: ["https://example.com"],
    },
  });
  await server.start({ port: 0 });
  try {
    const response = await server.inject({
      method: "OPTIONS",
      url: "/v1/tasks",
      headers: {
        origin: "https://example.com",
        "access-control-request-method": "GET",
      },
    });

    assert.equal(response.statusCode, 204);
  } finally {
    await server.stop();
  }
});

test("Integration: error response has correct structure", async () => {
  const { server } = createTestServer();
  await server.start({ port: 0 });
  try {
    const response = await server.inject({ method: "GET", url: "/v1/nonexistent" });

    assert.equal(response.statusCode, 404);
    const body = response.json();
    assert.ok(typeof body.requestId === "string");
    assert.ok(typeof body.error?.code === "string");
    assert.ok(typeof body.error?.message === "string");
  } finally {
    await server.stop();
  }
});

test("Integration: request-id header is echoed back", async () => {
  const { server } = createTestServer();
  await server.start({ port: 0 });
  try {
    const response = await server.inject({
      method: "GET",
      url: "/healthz",
      headers: { "x-request-id": "req_test_123" },
    });

    assert.equal(response.headers["x-request-id"], "req_test_123");
  } finally {
    await server.stop();
  }
});

test("Integration: server handles concurrent requests", async () => {
  const { server } = createTestServer();
  await server.start({ port: 0 });
  try {
    const promises = Array.from({ length: 5 }, (_, i) =>
      server.inject({ method: "GET", url: "/healthz" })
    );

    const results = await Promise.all(promises);

    for (const response of results) {
      assert.equal(response.statusCode, 200);
    }
  } finally {
    await server.stop();
  }
});

test("Integration: server stops cleanly", async () => {
  const { server } = createTestServer();
  await server.start({ port: 0 });
  await server.stop();
  // Should be able to stop again without error
  await server.stop();
});
