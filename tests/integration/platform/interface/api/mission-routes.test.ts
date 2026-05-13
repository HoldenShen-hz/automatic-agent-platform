import test from "node:test";
import assert from "node:assert/strict";

import { ApiAuthService } from "../../../../../src/platform/five-plane-interface/api/api-auth-service.js";
import { createMissionRoutes } from "../../../../../src/platform/five-plane-interface/api/http-server/mission-routes.js";
import type { RouteDefinition } from "../../../../../src/platform/five-plane-interface/api/http-server/types.js";
import { InMemoryMissionRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/mission-repository.js";

const authService = new ApiAuthService({
  jwtSecret: "test-secret",
  apiKeys: [{ apiKey: "key_001", actorId: "user_001", roles: ["admin", "operator", "viewer"], tenantId: "tenant_001" }],
});

function authHeaders() {
  const token = authService.exchangeApiKey("key_001").accessToken;
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "x-trace-id": "trace_001",
    "x-correlation-id": "corr_001",
  };
}

async function invokeRoute(
  routes: RouteDefinition[],
  method: string,
  path: string,
  body: Record<string, unknown> | null = null,
  headers: Record<string, string | undefined> = authHeaders(),
) {
  const pathname = path.startsWith("/api/") ? path.slice(4) : path;
  const segments = pathname.split("/").filter((segment) => segment.length > 0);
  for (const route of routes) {
    if (route.method !== method) {
      continue;
    }
    if (route.pathname != null && route.pathname !== pathname) {
      continue;
    }
    const response = await route.handler({
      requestId: `req_${method}_${segments.join("_")}`,
      principal: null,
      route: { pathname, segments },
      request: {
        method,
        url: pathname,
        headers,
        body: body == null ? null : JSON.stringify(body),
      },
    });
    if (response != null) {
      return response;
    }
  }
  throw new Error(`route_not_found:${method}:${path}`);
}

test("Mission routes create mission and dry-run explicit resolution", async () => {
  const repository = new InMemoryMissionRepository();
  const routes = createMissionRoutes({ authService, missionRepository: repository });

  const createResponse = await invokeRoute(routes, "POST", "/v1/missions", {
    missionId: "mis_ignored_by_route",
    title: "Mission API",
    objective: "Exercise API",
    successCriteria: ["created"],
    domainId: "coding",
  });
  assert.equal(createResponse.statusCode, 201);
  const created = JSON.parse(createResponse.body).data.mission;
  assert.equal(created.tenantId, "tenant_001");

  const dryRunResponse = await invokeRoute(routes, "POST", "/v1/mission-resolutions:dry-run", {
    tenantId: "tenant_001",
    confirmedTaskSpecId: "ctspec_001",
    principal: { principalId: "user_001", type: "human", tenantId: "tenant_001", roles: ["operator"] },
    missionRef: { mode: "use_existing", missionId: created.missionId },
    goal: "Exercise API",
    domainId: "coding",
    riskClass: "low",
    traceId: "trace_001",
    correlationId: "corr_001",
  });
  assert.equal(dryRunResponse.statusCode, 200);
  assert.equal(JSON.parse(dryRunResponse.body).data.resolution, "matched_existing");
});

test("Mission routes expose console resources and membership lifecycle", async () => {
  const repository = new InMemoryMissionRepository();
  const routes = createMissionRoutes({ authService, missionRepository: repository });
  const createResponse = await invokeRoute(routes, "POST", "/v1/missions", {
    title: "Mission Console",
    objective: "Expose console resources",
    successCriteria: ["resources available"],
    budgetEnvelopeRef: "budget_env_001",
  });
  const created = JSON.parse(createResponse.body).data.mission;

  const patchResponse = await invokeRoute(
    routes,
    "PATCH",
    `/v1/missions/${created.missionId}`,
    { title: "Mission Console Updated", priority: "high" },
    { ...authHeaders(), "if-match": created.etag },
  );
  assert.equal(patchResponse.statusCode, 200);
  const patched = JSON.parse(patchResponse.body).data.mission;
  assert.equal(patched.title, "Mission Console Updated");
  assert.equal(patched.version, created.version + 1);

  const memberResponse = await invokeRoute(routes, "POST", `/v1/missions/${created.missionId}/members`, {
    principalId: "user_002",
    role: "operator",
    permissions: ["mission:read", "mission:execute"],
  });
  assert.equal(memberResponse.statusCode, 201);
  const member = JSON.parse(memberResponse.body).data.member;
  assert.equal(member.principalId, "user_002");

  const membersResponse = await invokeRoute(routes, "GET", `/v1/missions/${created.missionId}/members`);
  assert.equal(membersResponse.statusCode, 200);
  assert.ok(JSON.parse(membersResponse.body).data.members.length >= 2);

  repository.createSnapshot({
    missionId: created.missionId,
    taskId: "task_001",
    confirmedTaskSpecId: "ctspec_001",
    traceId: "trace_001",
    correlationId: "corr_001",
    createdBy: "user_001",
  });

  const tasksResponse = await invokeRoute(routes, "GET", `/v1/missions/${created.missionId}/tasks`);
  assert.equal(JSON.parse(tasksResponse.body).data.tasks[0].id, "task_001");
  const evidenceResponse = await invokeRoute(routes, "GET", `/v1/missions/${created.missionId}/evidence`);
  assert.equal(JSON.parse(evidenceResponse.body).data.evidence[0].type, "evidence");
  const budgetResponse = await invokeRoute(routes, "GET", `/v1/missions/${created.missionId}/budget`);
  assert.equal(JSON.parse(budgetResponse.body).data.budget.status, "configured");
  const runsResponse = await invokeRoute(routes, "GET", `/v1/missions/${created.missionId}/runs`);
  assert.deepEqual(JSON.parse(runsResponse.body).data.runs, []);

  const revokeResponse = await invokeRoute(routes, "DELETE", `/v1/missions/${created.missionId}/members/${member.membershipId}`);
  assert.equal(revokeResponse.statusCode, 200);
  assert.equal(JSON.parse(revokeResponse.body).data.member.status, "revoked");
});
