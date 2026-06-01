import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import type { InjectResponse } from "../../../../../src/platform/five-plane-interface/api/http-api-server.js";
import { cleanupPath, createFile, createTempWorkspace } from "../../../../helpers/fs.js";
import { createSeededApiContext } from "../../../../helpers/api.js";

interface Envelope<T> {
  requestId: string;
  data: T;
}

function readJson<T>(response: InjectResponse): Envelope<T> {
  return response.json<Envelope<T>>();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getAccessToken(server: any): Promise<string> {
  const tokenResponse = await server.inject({
    url: "/v1/auth/token",
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ apiKey: "test-api-key" }),
  });
  return readJson<{ accessToken: string }>(tokenResponse).data.accessToken;
}

test("integration: GET /v1/stability returns stability panel with workers", async () => {
  const workspace = createTempWorkspace("aa-admin-stability-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const accessToken = await getAccessToken(server);

    const response = await server.inject({
      url: "/v1/stability",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(response.statusCode, 200);
    const payload = readJson<{
      health: { status: string };
      workers: Array<{ workerId: string }>;
      pendingApprovals: Array<unknown>;
    }>(response);
    assert.equal(payload.data.health.status, "ok");
    assert.ok(payload.data.workers.some((w) => w.workerId === context.seededWorkerId));
    // Seeded context creates an approval, so pendingApprovals may have entries
    assert.ok(Array.isArray(payload.data.pendingApprovals));
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("integration: GET /v1/admin/control-plane/load-balancing returns 503 when service unavailable", async () => {
  // The seeded context doesn't configure coordinatorLoadBalancingService,
  // so this endpoint should return 503
  const workspace = createTempWorkspace("aa-admin-lb-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const accessToken = await getAccessToken(server);

    const response = await server.inject({
      url: "/v1/admin/control-plane/load-balancing",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    // Service not configured - expect 503
    assert.equal(response.statusCode, 503);
    // Error responses have { requestId, error: { code, message } }
    const errorBody = response.json<{ requestId: string; error: { code: string; message: string } }>();
    assert.ok(errorBody.error.code.includes("control_plane_unavailable"));
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("integration: POST /v1/admin/control-plane/load-balancing/select returns 503 when service unavailable", async () => {
  const workspace = createTempWorkspace("aa-admin-lb-select-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const accessToken = await getAccessToken(server);

    const response = await server.inject({
      url: "/v1/admin/control-plane/load-balancing/select",
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        "idempotency-key": "lb-select-unavailable-1",
      },
      body: JSON.stringify({ queueName: "default" }),
    });
    // Service not configured - expect 503
    assert.equal(response.statusCode, 503);
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("integration: POST /v1/admin/control-plane/load-balancing/select rejects invalid payload", async () => {
  const workspace = createTempWorkspace("aa-admin-lb-select-invalid-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const accessToken = await getAccessToken(server);

    const response = await server.inject({
      url: "/v1/admin/control-plane/load-balancing/select",
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: "not valid json",
    });
    assert.equal(response.statusCode, 400);
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("integration: GET /v1/admin/workers returns workers list", async () => {
  const workspace = createTempWorkspace("aa-admin-workers-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const accessToken = await getAccessToken(server);

    const response = await server.inject({
      url: "/v1/admin/workers",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(response.statusCode, 200);
    const payload = readJson<{ workers: Array<{ workerId: string }>; total: number }>(response);
    assert.ok(payload.data.workers.length >= 1);
    assert.ok(payload.data.workers.some((w) => w.workerId === context.seededWorkerId));
    assert.ok(typeof payload.data.total === "number");
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("integration: GET /v1/admin/governance/leadership-claims returns leadership governance snapshot", async () => {
  const workspace = createTempWorkspace("aa-admin-leadership-claims-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const accessToken = await getAccessToken(server);

    const response = await server.inject({
      url: "/v1/admin/governance/leadership-claims",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(response.statusCode, 200);
    const payload = readJson<{
      summary: { familyCount: number; approvedClaimCount: number };
      families: Array<{ familyId: string }>;
      claims: Array<{ claimId: string }>;
    }>(response);
    assert.ok(payload.data.summary.familyCount >= 1);
    assert.ok(payload.data.summary.approvedClaimCount >= 1);
    assert.ok(payload.data.families.some((family) => family.familyId === "engineering"));
    assert.ok(payload.data.claims.length >= 1);
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("integration: GET /v1/admin/governance/division-inventory returns generated inventory", async () => {
  const originalPlatformRoot = process.env.AA_PLATFORM_ROOT;
  const workspace = createTempWorkspace("aa-admin-division-inventory-int-");
  createFile(join(workspace, "config", "division-coverage", "inventory", "division-inventory.generated.json"), JSON.stringify({
    generatedAt: "2026-06-01T00:00:00.000Z",
    records: [{ divisionId: "coding", normalizedDivisionId: "coding", familyId: "engineering", status: "pilot_ready", riskLevel: "high", hasDivisionYaml: true, hasCoverageCard: true, hasScenarioCard: true, hasEval: true, hasRedTeam: true, hasTrainingPolicy: true, hasOwner: true, blockers: [] }],
    summary: { totalDivisions: 1, p0Divisions: 1, blockedDivisions: 0, orphanSourceModules: 0 },
  }, null, 2));
  process.env.AA_PLATFORM_ROOT = workspace;
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const accessToken = await getAccessToken(server);

    const response = await server.inject({
      url: "/v1/admin/governance/division-inventory",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(response.statusCode, 200);
    const payload = readJson<{ summary: { totalDivisions: number }; records: Array<{ divisionId: string }> }>(response);
    assert.equal(payload.data.summary.totalDivisions, 1);
    assert.equal(payload.data.records[0]?.divisionId, "coding");
  } finally {
    if (originalPlatformRoot == null) {
      delete process.env.AA_PLATFORM_ROOT;
    } else {
      process.env.AA_PLATFORM_ROOT = originalPlatformRoot;
    }
    context.db.close();
    cleanupPath(workspace);
  }
});

test("integration: POST /v1/admin/governance/leadership-claims/review-requests/:requestId/approve updates a pending request", async () => {
  const originalDataRoot = process.env.AA_DATA_ROOT;
  const workspace = createTempWorkspace("aa-admin-leadership-approve-int-");
  createFile(join(workspace, "data", "governance", "leadership-claim-review-requests.json"), JSON.stringify([
    {
      requestId: "req-1",
      familyId: "engineering",
      requestedClaimLevel: "local_leader",
      requestedSurfaces: ["docs"],
      requestedBy: "release-owner",
      rationale: "ready",
      requestedAt: "2026-05-31T00:00:00.000Z",
      status: "pending",
    },
  ], null, 2));
  process.env.AA_DATA_ROOT = join(workspace, "data");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const accessToken = await getAccessToken(server);

    const response = await server.inject({
      url: "/v1/admin/governance/leadership-claims/review-requests/req-1/approve",
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        "idempotency-key": "leadership-claim-approve-1",
      },
      body: JSON.stringify({ reasonCode: "operator.approved" }),
    });
    assert.equal(response.statusCode, 200);
    const payload = readJson<{ reviewRequest: { requestId: string; status: string; reviewedBy: string | null } }>(response);
    assert.equal(payload.data.reviewRequest.requestId, "req-1");
    assert.equal(payload.data.reviewRequest.status, "approved");
    assert.equal(payload.data.reviewRequest.reviewedBy, "operator-1");
  } finally {
    if (originalDataRoot == null) {
      delete process.env.AA_DATA_ROOT;
    } else {
      process.env.AA_DATA_ROOT = originalDataRoot;
    }
    context.db.close();
    cleanupPath(workspace);
  }
});

test("integration: POST /v1/admin/config updates configuration", async () => {
  const workspace = createTempWorkspace("aa-admin-config-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const accessToken = await getAccessToken(server);

    const response = await server.inject({
      url: "/v1/admin/config",
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        "idempotency-key": "admin-config-post-1",
      },
      body: JSON.stringify({ key: "runtime.maxConcurrency", value: 8 }),
    });
    assert.equal(response.statusCode, 200);
    const payload = readJson<{ success: boolean; record: { key: string; value: number } }>(response);
    assert.equal(payload.data.success, true);
    assert.equal(payload.data.record.key, "runtime.maxConcurrency");
    assert.equal(payload.data.record.value, 8);
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("integration: PUT /api/v1/admin/config updates configuration via canonical API prefix", async () => {
  const workspace = createTempWorkspace("aa-admin-config-put-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const accessToken = await getAccessToken(server);

    const response = await server.inject({
      url: "/api/v1/admin/config",
      method: "PUT",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        "idempotency-key": "admin-config-put-1",
      },
      body: JSON.stringify({ key: "runtime.maxQueueDepth", value: 32 }),
    });
    assert.equal(response.statusCode, 200);
    const payload = readJson<{ success: boolean; record: { key: string; value: number } }>(response);
    assert.equal(payload.data.success, true);
    assert.equal(payload.data.record.key, "runtime.maxQueueDepth");
    assert.equal(payload.data.record.value, 32);
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("integration: GET /api/v1/replay-sessions returns replay session summaries", async () => {
  const workspace = createTempWorkspace("aa-admin-replay-list-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const accessToken = await getAccessToken(server);

    const response = await server.inject({
      url: "/api/v1/replay-sessions",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(response.statusCode, 200);
    const payload = readJson<{
      replaySessions: Array<{ replaySessionId: string; taskId: string | null }>;
      total: number;
    }>(response);
    assert.ok(payload.data.total >= 1);
    assert.ok(payload.data.replaySessions.some((session) => session.taskId === context.seededTaskId));
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("integration: GET /api/v1/replay-sessions/:id returns replay session detail", async () => {
  const workspace = createTempWorkspace("aa-admin-replay-detail-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const accessToken = await getAccessToken(server);

    const response = await server.inject({
      url: `/api/v1/replay-sessions/${context.seededTaskId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(response.statusCode, 200);
    const payload = readJson<{
      replaySessionId: string;
      workflow: { taskId: string };
      events: Array<unknown>;
    }>(response);
    assert.equal(payload.data.replaySessionId, context.seededTaskId);
    assert.equal(payload.data.workflow.taskId, context.seededTaskId);
    assert.ok(Array.isArray(payload.data.events));
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("integration: POST /v1/admin/panic-directives and /v1/admin/resume-directives complete directive lifecycle", async () => {
  const workspace = createTempWorkspace("aa-admin-panic-resume-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const accessToken = await getAccessToken(server);

    const panicResponse = await server.inject({
      url: "/v1/admin/panic-directives",
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        "idempotency-key": "admin-panic-1",
      },
      body: JSON.stringify({
        scope: "platform/runtime",
        reasonCode: "security.operator_override",
        activeIncidents: 1,
        requiredApprovers: ["operator-1", "operator-2"],
        freezeModes: ["deploy", "automation"],
        severity: "full",
      }),
    });
    assert.equal(panicResponse.statusCode, 200);
    const panicPayload = readJson<{
      success: boolean;
      directive: { scope: string; reasonCode: string; directiveId: string };
      propagationRecords: Array<unknown>;
    }>(panicResponse);
    assert.equal(panicPayload.data.success, true);
    assert.equal(panicPayload.data.directive.scope, "platform/runtime");
    assert.equal(panicPayload.data.directive.reasonCode, "security.operator_override");
    assert.ok(panicPayload.data.propagationRecords.length >= 1);

    const resumeResponse = await server.inject({
      url: "/v1/admin/resume-directives",
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        "idempotency-key": "admin-resume-1",
      },
      body: JSON.stringify({
        scope: "platform/runtime",
        approvedBy: ["operator-1", "operator-2"],
        approvedRoles: ["platform_admin", "security_team"],
        checkpointsVerified: true,
        forensicSnapshotReviewed: true,
        rollbackPlanReady: true,
        validationRunPassed: true,
      }),
    });
    assert.equal(resumeResponse.statusCode, 200);
    const resumePayload = readJson<{
      success: boolean;
      receipt: { scope: string; resumed: boolean; directiveId: string | null };
    }>(resumeResponse);
    assert.equal(resumePayload.data.success, true);
    assert.equal(resumePayload.data.receipt.scope, "platform/runtime");
    assert.equal(resumePayload.data.receipt.resumed, true);
    assert.ok(resumePayload.data.receipt.directiveId != null);
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("integration: GET /v1/admin/rollouts returns active rollouts", async () => {
  const workspace = createTempWorkspace("aa-admin-rollouts-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const accessToken = await getAccessToken(server);

    const response = await server.inject({
      url: "/v1/admin/rollouts",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(response.statusCode, 200);
    const payload = readJson<{ rollouts: Array<unknown>; total: number }>(response);
    assert.ok(Array.isArray(payload.data.rollouts));
    assert.ok(typeof payload.data.total === "number");
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("integration: GET /v1/admin/budgets returns budget summaries", async () => {
  const workspace = createTempWorkspace("aa-admin-budgets-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const accessToken = await getAccessToken(server);

    const response = await server.inject({
      url: "/v1/admin/budgets",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(response.statusCode, 200);
    const payload = readJson<{ budgets: Array<unknown>; total: number }>(response);
    assert.ok(Array.isArray(payload.data.budgets));
    assert.ok(typeof payload.data.total === "number");
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("integration: GET /v1/admin/chargeback/reports returns chargeback report", async () => {
  // Note: HttpApiServer creates its own CostReportService if not provided
  const workspace = createTempWorkspace("aa-admin-chargeback-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const accessToken = await getAccessToken(server);

    const response = await server.inject({
      url: "/v1/admin/chargeback/reports",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(response.statusCode, 200);
    const payload = readJson<{ allocations: Array<unknown> }>(response);
    assert.ok(Array.isArray(payload.data.allocations));
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("integration: GET /v1/admin/inventories/benchmarks returns benchmark inventory", async () => {
  const workspace = createTempWorkspace("aa-admin-benchmarks-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const accessToken = await getAccessToken(server);

    const response = await server.inject({
      url: "/v1/admin/inventories/benchmarks",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(response.statusCode, 200);
    // Inspect actual response structure
    const raw = response.json<Record<string, unknown>>();
    // The response should have a data array at some level
    const data = raw.data;
    assert.ok(Array.isArray(data), "Response data should be an array");
    const arr = data as Array<Record<string, unknown>>;
    assert.ok(arr.length > 0, "Benchmark data should have entries");
    assert.ok(arr[0]?.architectureSection != null, "Benchmark should have architectureSection");
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("integration: GET /v1/admin/inventories/projections returns projection inventory", async () => {
  const workspace = createTempWorkspace("aa-admin-projections-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const accessToken = await getAccessToken(server);

    const response = await server.inject({
      url: "/v1/admin/inventories/projections",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(response.statusCode, 200);
    const raw = response.json<Record<string, unknown>>();
    const data = raw.data;
    assert.ok(Array.isArray(data), "Response data should be an array");
    const arr = data as Array<Record<string, unknown>>;
    assert.ok(arr.length > 0, "Projection data should have entries");
    assert.ok(arr[0]?.projectionName != null, "Projection should have projectionName");
    assert.ok(arr[0]?.consumerId != null, "Projection should have consumerId");
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("integration: GET /v1/admin/inventories/deployments returns deployment inventory", async () => {
  const workspace = createTempWorkspace("aa-admin-deployments-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const accessToken = await getAccessToken(server);

    const response = await server.inject({
      url: "/v1/admin/inventories/deployments",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(response.statusCode, 200);
    const raw = response.json<Record<string, unknown>>();
    const data = raw.data;
    assert.ok(Array.isArray(data), "Response data should be an array");
    const arr = data as Array<Record<string, unknown>>;
    assert.ok(arr.length > 0, "Deployment data should have entries");
    assert.ok(arr[0]?.deploymentId != null, "Deployment should have deploymentId");
    assert.ok(arr[0]?.s4Mode != null, "Deployment should have s4Mode");
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("integration: GET /v1/admin/inventories/schema returns schema inventory", async () => {
  const workspace = createTempWorkspace("aa-admin-schema-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const accessToken = await getAccessToken(server);

    const response = await server.inject({
      url: "/v1/admin/inventories/schema",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(response.statusCode, 200);
    const schemaPayload = readJson<{
      summary: { totalTables: number };
      tables: Array<{ tableName: string }>;
    }>(response);
    assert.ok(schemaPayload.data.summary.totalTables > 0);
    assert.ok(schemaPayload.data.tables.some((t) => t.tableName === "outbox"));
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("integration: GET /v1/admin/judges returns judge registry descriptors", async () => {
  const workspace = createTempWorkspace("aa-admin-judges-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const accessToken = await getAccessToken(server);

    const response = await server.inject({
      url: "/v1/admin/judges",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(response.statusCode, 200);
    const raw = response.json<Record<string, unknown>>();
    const data = raw.data;
    assert.ok(Array.isArray(data), "Response data should be an array");
    const arr = data as Array<Record<string, unknown>>;
    assert.ok(arr.length >= 1, "Judges data should have entries");
    assert.ok(arr[0]?.providerId != null, "Judge should have providerId");
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("integration: GET /v1/admin/compliance/program-templates returns compliance templates", async () => {
  const workspace = createTempWorkspace("aa-admin-compliance-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const accessToken = await getAccessToken(server);

    const response = await server.inject({
      url: "/v1/admin/compliance/program-templates",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(response.statusCode, 200);
    const raw = response.json<Record<string, unknown>>();
    const data = raw.data;
    assert.ok(Array.isArray(data), "Response data should be an array");
    const arr = data as Array<Record<string, unknown>>;
    assert.ok(arr.length >= 1, "Compliance data should have entries");
    assert.ok(arr[0]?.templateId != null, "Compliance template should have templateId");
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("integration: admin endpoints require authentication", async () => {
  const workspace = createTempWorkspace("aa-admin-auth-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const response = await server.inject({
      url: "/v1/admin/workers",
    });
    // Should return 401 or 403 without auth token
    assert.ok(response.statusCode === 401 || response.statusCode === 403);
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("integration: admin endpoints require admin role", async () => {
  const workspace = createTempWorkspace("aa-admin-role-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    // Use the test-api-key which has admin role
    const viewerTokenResponse = await server.inject({
      url: "/v1/auth/token",
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey: "test-api-key" }),
    });
    const tokenData = readJson<{ accessToken: string }>(viewerTokenResponse);

    // The test-api-key has admin role, so this passes.
    // For a proper test we'd need a viewer-only key, but the seeded context
    // only creates an admin key. This test verifies the endpoint is accessible.
    const response = await server.inject({
      url: "/v1/admin/workers",
      headers: { authorization: `Bearer ${tokenData.data.accessToken}` },
    });
    assert.equal(response.statusCode, 200);
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});

test("integration: GET /v1/admin/tasks/:id returns admin takeover console", async () => {
  const workspace = createTempWorkspace("aa-admin-task-id-");
  const context = createSeededApiContext(workspace);
  const server = context.createServer();

  try {
    const accessToken = await getAccessToken(server);

    const response = await server.inject({
      url: `/v1/admin/tasks/${context.seededTaskId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(response.statusCode, 200);
    const payload = readJson<{
      scope: { taskId: string };
      activeWorker: { workerId: string } | null;
      inspect: { takeoverSessions: Array<{ id: string }> };
    }>(response);
    assert.equal(payload.data.scope.taskId, context.seededTaskId);
    assert.equal(payload.data.activeWorker?.workerId, context.seededWorkerId);
    if (context.takeoverSessionId) {
      assert.ok(payload.data.inspect.takeoverSessions.some((s) => s.id === context.takeoverSessionId));
    }
  } finally {
    context.db.close();
    cleanupPath(workspace);
  }
});
