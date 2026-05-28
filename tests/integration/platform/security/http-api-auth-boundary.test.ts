import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ApiAuthService } from "../../../../src/platform/five-plane-interface/api/api-auth-service.js";
import { HttpApiServer, type InjectResponse } from "../../../../src/platform/five-plane-interface/api/http-api-server.js";
import { CoordinatorLoadBalancingService } from "../../../../src/platform/five-plane-execution/ha/coordinator-load-balancing-service.js";
import { runSingleTaskExecution } from "../../../../src/platform/five-plane-execution/execution-engine/single-task-happy-path.js";
import { createSeededApiContext } from "../../../helpers/api.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

interface DataEnvelope<T> {
  requestId: string;
  data: T;
}

interface ErrorEnvelope {
  requestId: string;
  error: {
    code: string;
    message?: string;
  };
}

function readJson<T>(response: InjectResponse): DataEnvelope<T> {
  return response.json<DataEnvelope<T>>();
}

function readError(response: InjectResponse): ErrorEnvelope {
  return response.json<ErrorEnvelope>();
}

test("configured api auth blocks x-aa-actor-id bypasses and enforces RBAC on privileged routes", async () => {
  const workspace = createTempWorkspace("aa-http-api-auth-boundary-");
  const context = createSeededApiContext(workspace);
  const authService = new ApiAuthService({
    apiKeys: [
      {
        apiKey: "viewer-key",
        actorId: "viewer-1",
        roles: ["viewer"],
      },
      {
        apiKey: "operator-key",
        actorId: "operator-1",
        roles: ["viewer", "operator"],
      },
      {
        apiKey: "admin-key",
        actorId: "admin-1",
        roles: ["viewer", "operator", "admin"],
      },
    ],
    jwtSecret: "phase3-security-secret",
  });
  const loadBalancing = new CoordinatorLoadBalancingService(context.db, context.store);
  loadBalancing.registerHeartbeat({
    coordinatorId: "coord-sec-1",
    region: "us-west",
    status: "active",
    queueAffinity: "default",
    shards: ["tenant-sec"],
  });
  const server = new HttpApiServer({
    approvalService: context.approvalService,
    inspectService: context.inspectService,
    missionControlService: context.missionControlService,
    gatewayTargetDirectoryService: context.gatewayTargetDirectoryService,
    authService,
    coordinatorLoadBalancingService: loadBalancing,
  });

  try {
    const bypassAttempt = await server.inject({
      url: "/v1/gateway/targets",
      headers: {
        "x-aa-actor-id": "operator-1",
      },
    });
    assert.equal(bypassAttempt.statusCode, 401);
    const bypassPayload = readError(bypassAttempt);
    assert.equal(bypassPayload.error.code, "api.auth_required");

    const invalidBearer = await server.inject({
      url: "/v1/gateway/targets",
      headers: {
        authorization: "Bearer invalid.token.value",
      },
    });
    assert.equal(invalidBearer.statusCode, 401);
    const invalidBearerPayload = readError(invalidBearer);
    // Malformed token (invalid base64url in header) should return invalid_token or invalid_token_header
    assert.ok(
      invalidBearerPayload.error.code === "api.invalid_token" ||
      invalidBearerPayload.error.code === "api.invalid_token_header",
      `Expected invalid_token or invalid_token_header, got ${invalidBearerPayload.error.code}`,
    );

    const viewerToken = readJson<{ accessToken: string }>(
      await server.inject({
        method: "POST",
        url: "/v1/auth/token",
        headers: {
          "x-api-key": "viewer-key",
          "idempotency-key": "viewer-token-1",
        },
      }),
    ).data.accessToken;

    const gatewayWriteAttempt = await server.inject({
      method: "POST",
      url: "/v1/gateway/messages/send",
      headers: {
        authorization: `Bearer ${viewerToken}`,
        "content-type": "application/json",
        "idempotency-key": "viewer-gateway-send-1",
      },
      body: JSON.stringify({
        channel: "telegram",
        query: "finance",
        text: "Should not pass.",
      }),
    });
    assert.equal(gatewayWriteAttempt.statusCode, 403);
    const gatewayWritePayload = readError(gatewayWriteAttempt);
    assert.equal(gatewayWritePayload.error.code, "api.forbidden");

    const protectedRoutes = [
      "/v1/dashboard/snapshot",
      "/v1/tasks",
      "/v1/workflows",
      `/v1/tasks/${context.seededTaskId}`,
      `/v1/tasks/${context.seededTaskId}/events`,
      `/v1/tasks/${context.seededTaskId}/inspect`,
      `/v1/workflows/${context.seededTaskId}`,
      "/console",
      "/console/workflows",
      "/console/approvals",
      "/console/stability",
      "/console/targets",
    ];
    for (const url of protectedRoutes) {
      const response = await server.inject({ url });
      assert.equal(response.statusCode, 401, `${url} should reject unauthenticated access`);
      const payload = readError(response);
      assert.equal(payload.error.code, "api.auth_required");
    }

    const operatorToken = readJson<{ accessToken: string }>(
      await server.inject({
        method: "POST",
        url: "/v1/auth/token",
        headers: {
          "x-api-key": "operator-key",
          "idempotency-key": "operator-token-1",
        },
      }),
    ).data.accessToken;

    const adminAttempt = await server.inject({
      url: "/v1/admin/control-plane/load-balancing",
      headers: {
        authorization: `Bearer ${operatorToken}`,
      },
    });
    assert.equal(adminAttempt.statusCode, 403);
    const adminPayload = readError(adminAttempt);
    assert.equal(adminPayload.error.code, "api.forbidden");

    const adminConsoleAttempt = await server.inject({
      url: `/console/admin/tasks/${context.seededTaskId}`,
      headers: {
        authorization: `Bearer ${operatorToken}`,
      },
    });
    assert.equal(adminConsoleAttempt.statusCode, 403);
    const adminConsolePayload = readError(adminConsoleAttempt);
    assert.equal(adminConsolePayload.error.code, "api.forbidden");

    const adminToken = readJson<{ accessToken: string }>(
      await server.inject({
        method: "POST",
        url: "/v1/auth/token",
        headers: {
          "x-api-key": "admin-key",
          "idempotency-key": "admin-token-1",
        },
      }),
    ).data.accessToken;

    const adminSuccess = await server.inject({
      url: "/v1/admin/control-plane/load-balancing",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });
    assert.equal(adminSuccess.statusCode, 200);
    const adminSuccessPayload = readJson<{ coordinatorCount: number }>(adminSuccess);
    assert.equal(adminSuccessPayload.data.coordinatorCount, 1);
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("tenant-scoped api auth only exposes matching tenant resources and blocks global surfaces", async () => {
  const workspace = createTempWorkspace("aa-http-api-tenant-boundary-");
  const context = createSeededApiContext(workspace, { tenantId: "tenant-api" });
  const dbPath = join(workspace, "api.db");
  runSingleTaskExecution({
    dbPath,
    title: "Other tenant task",
    request: "Seed another tenant task.",
    tenantId: "tenant-other",
  });

  const otherTenantTaskId = context.store
    .listTasks(200)
    .find((task) => task.title === "Other tenant task")?.id;
  assert.ok(otherTenantTaskId);

  const authService = new ApiAuthService({
    apiKeys: [
      {
        apiKey: "tenant-viewer-key",
        actorId: "tenant-viewer-1",
        roles: ["viewer"],
        tenantId: "tenant-api",
      },
      {
        apiKey: "tenant-admin-key",
        actorId: "tenant-admin-1",
        roles: ["viewer", "operator", "admin"],
        tenantId: "tenant-api",
      },
    ],
    jwtSecret: "12345678901234567890123456789012",
  });
  const server = new HttpApiServer({
    approvalService: context.approvalService,
    inspectService: context.inspectService,
    missionControlService: context.missionControlService,
    gatewayTargetDirectoryService: context.gatewayTargetDirectoryService,
    authService,
  });

  try {
    const tenantViewerToken = readJson<{ accessToken: string }>(
      await server.inject({
        method: "POST",
        url: "/v1/auth/token",
        headers: {
          "x-api-key": "tenant-viewer-key",
          "idempotency-key": "tenant-viewer-token-1",
        },
      }),
    ).data.accessToken;

    const tenantTasks = await server.inject({
      url: "/v1/tasks?limit=10",
      headers: {
        authorization: `Bearer ${tenantViewerToken}`,
      },
    });
    assert.equal(tenantTasks.statusCode, 200);
    const tenantTasksPayload = readJson<{ tasks: Array<{ taskId: string }> }>(tenantTasks);
    assert.deepEqual(
      tenantTasksPayload.data.tasks.map((task) => task.taskId),
      [context.seededTaskId],
    );

    const tenantWorkflows = await server.inject({
      url: "/v1/workflows?limit=10",
      headers: {
        authorization: `Bearer ${tenantViewerToken}`,
      },
    });
    assert.equal(tenantWorkflows.statusCode, 200);
    const tenantWorkflowsPayload = readJson<{ workflows: Array<{ taskId: string }> }>(tenantWorkflows);
    assert.deepEqual(
      tenantWorkflowsPayload.data.workflows.map((workflow) => workflow.taskId),
      [context.seededTaskId],
    );

    const tenantInspectMiss = await server.inject({
      url: `/v1/tasks/${otherTenantTaskId}/inspect`,
      headers: {
        authorization: `Bearer ${tenantViewerToken}`,
      },
    });
    assert.equal(tenantInspectMiss.statusCode, 404);
    const tenantInspectMissPayload = readError(tenantInspectMiss);
    assert.equal(tenantInspectMissPayload.error.code, "api.task_not_found");

    const tenantWorkflowMiss = await server.inject({
      url: `/v1/workflows/${otherTenantTaskId}`,
      headers: {
        authorization: `Bearer ${tenantViewerToken}`,
      },
    });
    assert.equal(tenantWorkflowMiss.statusCode, 404);
    const tenantWorkflowMissPayload = readError(tenantWorkflowMiss);
    assert.equal(tenantWorkflowMissPayload.error.code, "api.workflow_not_found");

    const tenantDashboard = await server.inject({
      url: "/v1/dashboard/snapshot",
      headers: {
        authorization: `Bearer ${tenantViewerToken}`,
      },
    });
    assert.equal(tenantDashboard.statusCode, 403);
    const tenantDashboardPayload = readError(tenantDashboard);
    assert.equal(tenantDashboardPayload.error.code, "api.tenant_scope_unsupported");

    const tenantAdminToken = readJson<{ accessToken: string }>(
      await server.inject({
        method: "POST",
        url: "/v1/auth/token",
        headers: {
          "x-api-key": "tenant-admin-key",
          "idempotency-key": "tenant-admin-token-1",
        },
      }),
    ).data.accessToken;

    const tenantAdminSummary = await server.inject({
      url: "/v1/admin/control-plane/load-balancing",
      headers: {
        authorization: `Bearer ${tenantAdminToken}`,
      },
    });
    assert.equal(tenantAdminSummary.statusCode, 403);
    const tenantAdminSummaryPayload = readError(tenantAdminSummary);
    assert.equal(tenantAdminSummaryPayload.error.code, "api.tenant_scope_unsupported");
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});
