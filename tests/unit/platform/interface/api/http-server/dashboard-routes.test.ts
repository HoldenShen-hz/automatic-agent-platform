import assert from "node:assert/strict";
import test from "node:test";

import { createDashboardRoutes } from "../../../../../../src/platform/interface/api/http-server/dashboard-routes.js";
import type { MissionControlService } from "../../../../../../src/platform/interface/api/mission-control-service.js";
import type { ApiAuthService } from "../../../../../../src/platform/interface/api/api-auth-service.js";
import type { RouteContext } from "../../../../../../src/platform/interface/api/http-server/types.js";

function createMockMissionControlService(): MissionControlService {
  return {
    getSnapshot: () => ({
      generatedAt: "2026-04-16T00:00:00.000Z",
      health: { status: "ok", queuedTasks: 0, activeExecutions: 0, tier1AckBacklog: 0, findings: [] },
      metrics: { tasksTotal: 0, tasksActive: 0, tasksDone: 0, tasksFailed: 0 },
      taskBoard: [],
      pendingApprovals: [
        {
          id: "approval-1",
          taskId: "task-1",
          executionId: "exec-1",
          sourceAgentId: "agent-1",
          reason: "Promote rollout",
          requestJson: JSON.stringify({ title: "Promote rollout", reason: "Approve canary stage", riskLevel: "medium" }),
          optionsJson: JSON.stringify(["approve"]),
          requestedAt: "2026-04-16T00:00:00.000Z",
          expiresAt: null,
          status: "requested",
          respondedBy: null,
          respondedAt: null,
          responseJson: null,
          timeoutPolicy: "expire",
          createdAt: "2026-04-16T00:00:00.000Z",
          updatedAt: "2026-04-16T00:00:00.000Z",
        },
      ],
      productSignals: { billingAccounts: [], latestPmfReport: null, perceptionBriefs: [] },
      divisions: [],
      gatewayTargets: [],
    }),
  } as unknown as MissionControlService;
}

function createMockAuthService(): ApiAuthService {
  return {
    requireRole: () => ({ actorId: "actor-1", roles: ["viewer"], authMethod: "api_key", tenantId: null }),
  } as unknown as ApiAuthService;
}

function createMockAuthServiceWithTenant(): ApiAuthService {
  return {
    requireRole: () => ({ actorId: "actor-1", roles: ["viewer"], authMethod: "api_key", tenantId: "tenant-1" }),
  } as unknown as ApiAuthService;
}

function createMockContext(headers: Record<string, string | undefined> = {}): RouteContext {
  return {
    requestId: "req-123",
    request: { method: "GET", url: "/dashboard/snapshot", headers, body: null } as never,
    route: { pathname: "/dashboard/snapshot", segments: [] },
    principal: null,
  };
}

test("createDashboardRoutes returns 3 routes", () => {
  const deps = {
    authService: createMockAuthService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createDashboardRoutes(deps);
  assert.equal(routes.length, 3);
});

test("GET /dashboard/snapshot returns snapshot", async () => {
  const deps = {
    authService: createMockAuthService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createDashboardRoutes(deps);
  const route = routes.find((r) => r.pathname === "/dashboard/snapshot")!;
  const ctx = createMockContext();
  const response = await route.handler(ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("ok"));
});

test("GET /dashboard/snapshot throws when auth not configured", async () => {
  const deps = {
    authService: null,
    missionControlService: createMockMissionControlService(),
  };
  const routes = createDashboardRoutes(deps);
  const route = routes.find((r) => r.pathname === "/dashboard/snapshot")!;
  const ctx = createMockContext();
  try {
    await route.handler(ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /authentication/);
  }
});

test("GET /dashboard/snapshot throws for tenant-scoped principal", async () => {
  const deps = {
    authService: createMockAuthServiceWithTenant(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createDashboardRoutes(deps);
  const route = routes.find((r) => r.pathname === "/dashboard/snapshot")!;
  const ctx = createMockContext();
  try {
    await route.handler(ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /tenant/);
  }
});

test("GET /v1/dashboard/snapshot returns snapshot", async () => {
  const deps = {
    authService: createMockAuthService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createDashboardRoutes(deps);
  const route = routes.find((r) => r.pathname === "/v1/dashboard/snapshot")!;
  const ctx = createMockContext();
  const response = await route.handler(ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("ok"));
});

test("GET /v1/dashboard/snapshot throws when auth not configured", async () => {
  const deps = {
    authService: null,
    missionControlService: createMockMissionControlService(),
  };
  const routes = createDashboardRoutes(deps);
  const route = routes.find((r) => r.pathname === "/v1/dashboard/snapshot")!;
  const ctx = createMockContext();
  try {
    await route.handler(ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /authentication/);
  }
});

test("GET /v1/workbench/snapshot returns aggregated workbench payload", async () => {
  const deps = {
    authService: createMockAuthService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createDashboardRoutes(deps);
  const route = routes.find((r) => r.pathname === "/v1/workbench/snapshot")!;
  const ctx = createMockContext();
  const response = await route.handler(ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body) as { data: Record<string, unknown> };
  assert.equal(body.data.inventorySummary != null, true);
  assert.equal(Array.isArray(body.data.approvalQueue), true);
  assert.equal(Array.isArray(body.data.operatorActions), true);
});
