import assert from "node:assert/strict";
import test from "node:test";

import { createAdminRoutes } from "../../../../../../src/platform/interface/api/http-server/admin-routes.js";
import type { MissionControlService } from "../../../../../../src/platform/interface/api/mission-control-service.js";
import type { CoordinatorLoadBalancingService } from "../../../../../../src/platform/execution/ha/coordinator-load-balancing-service.js";
import type { ApiAuthService } from "../../../../../../src/platform/interface/api/api-auth-service.js";
import type { RouteContext, RouteDefinition, ApiResponsePayload } from "../../../../../../src/platform/interface/api/http-server/types.js";

function createMockMissionControlService(): MissionControlService {
  return {
    getSnapshot: () => ({
      generatedAt: "2026-04-16T00:00:00.000Z",
      health: { status: "ok", queuedTasks: 0, activeExecutions: 0, tier1AckBacklog: 0 },
      metrics: { tasksTotal: 0, tasksActive: 0, tasksDone: 0, tasksFailed: 0 },
      taskBoard: [],
      pendingApprovals: [],
      productSignals: { billingAccounts: [], latestPmfReport: null, perceptionBriefs: [] },
      divisions: [],
      gatewayTargets: [],
    }),
    getStabilityPanel: () => ({
      health: { status: "ok", queuedTasks: 0, activeExecutions: 0, tier1AckBacklog: 0 },
      pendingApprovals: [],
      findings: [],
      blockedTasks: [],
      workers: [],
    }),
    getAdminTakeoverConsole: (_taskId: string) => ({
      scope: { taskId: "task-123", divisionId: null, workspaceId: null, tenantId: null },
      inspect: { takeoverSessions: [], operatorActions: [] },
      executionOwner: {},
      activeWorker: null,
      latestPmfVerdict: null,
      timeline: { entries: [] },
    }),
  } as unknown as MissionControlService;
}

function createMockLoadBalancingService(): CoordinatorLoadBalancingService {
  return {
    buildSummary: () => ({ generatedAt: "2026-04-16T00:00:00.000Z", coordinators: [], hotCoordinators: [] }),
    selectCoordinator: () => ({ selectedCoordinatorId: "coord-1", score: 0.5, candidates: 1 }),
  } as unknown as CoordinatorLoadBalancingService;
}

function createMockAuthService(roles: string[] = ["viewer"]): ApiAuthService {
  return {
    requireRole: () => ({ actorId: "actor-1", roles: roles as ("viewer" | "operator" | "admin")[], authMethod: "api_key", tenantId: null }),
  } as unknown as ApiAuthService;
}

function createMockContext(pathname = "/v1/stability", segments: string[] = [], headers: Record<string, string | undefined> = {}, body: string | null = null): RouteContext {
  return {
    requestId: "req-123",
    request: { method: body != null ? "POST" : "GET", url: pathname, headers, body } as never,
    route: { pathname, segments },
    principal: null,
  };
}

async function callRoute(routes: RouteDefinition[], ctx: RouteContext): Promise<ApiResponsePayload | null> {
  const pathname = ctx.route.pathname;
  const method = ctx.request.method ?? "GET";
  for (const route of routes) {
    if (route.method !== method) continue;
    if (route.pathname !== null) {
      if (route.pathname === pathname) {
        return route.handler(ctx);
      }
    } else if (route.segments) {
      const result = await route.handler(ctx);
      if (result !== null) {
        return result;
      }
    }
  }
  return null;
}

test("createAdminRoutes returns 4 routes", () => {
  const deps = {
    authService: createMockAuthService(),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  };
  const routes = createAdminRoutes(deps);
  assert.equal(routes.length, 4);
});

test("GET /v1/stability returns stability panel", async () => {
  const deps = {
    authService: createMockAuthService(),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  };
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext("/v1/stability", ["v1", "stability"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("ok"));
});

test("GET /v1/stability throws when auth not configured", async () => {
  const deps = {
    authService: null,
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  };
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext("/v1/stability", ["v1", "stability"]);
  try {
    await callRoute(routes, ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /authentication/);
  }
});

test("GET /v1/admin/tasks/:id returns admin takeover console", async () => {
  const deps = {
    authService: createMockAuthService(["admin"]),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  };
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext("/v1/admin/tasks/task-123", ["v1", "admin", "tasks", "task-123"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("task-123"));
});

test("GET /v1/admin/tasks/:id throws for non-admin role", async () => {
  const deps = {
    authService: createMockAuthService(["viewer"]),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  };
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext("/v1/admin/tasks/task-123", ["v1", "admin", "tasks", "task-123"]);
  try {
    await callRoute(routes, ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
  }
});

test("GET /v1/admin/control-plane/load-balancing returns summary", async () => {
  const deps = {
    authService: createMockAuthService(["admin"]),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  };
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext("/v1/admin/control-plane/load-balancing", ["v1", "admin", "control-plane", "load-balancing"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("generatedAt") || response.body.includes("coordinators"));
});

test("GET /v1/admin/control-plane/load-balancing throws 503 when service unavailable", async () => {
  const deps = {
    authService: createMockAuthService(["admin"]),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: null,
  };
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext("/v1/admin/control-plane/load-balancing", ["v1", "admin", "control-plane", "load-balancing"]);
  try {
    await callRoute(routes, ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /not configured/);
  }
});

test("POST /v1/admin/control-plane/load-balancing/select selects coordinator", async () => {
  const deps = {
    authService: createMockAuthService(["admin"]),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  };
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext("/v1/admin/control-plane/load-balancing/select", ["v1", "admin", "control-plane", "load-balancing", "select"], {}, JSON.stringify({ queueName: "default" }));
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("coord-1"));
});

test("POST /v1/admin/control-plane/load-balancing/select validates payload is object", async () => {
  const deps = {
    authService: createMockAuthService(["admin"]),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  };
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext("/v1/admin/control-plane/load-balancing/select", ["v1", "admin", "control-plane", "load-balancing", "select"], {}, "not an object");
  try {
    await callRoute(routes, ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /Request body must be valid JSON/);
  }
});

test("POST /v1/admin/control-plane/load-balancing/select rejects dangerous json keys", async () => {
  const deps = {
    authService: createMockAuthService(["admin"]),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  };
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext(
    "/v1/admin/control-plane/load-balancing/select",
    ["v1", "admin", "control-plane", "load-balancing", "select"],
    {},
    "{\"__proto__\":{\"polluted\":true}}",
  );
  await assert.rejects(async () => {
    await callRoute(routes, ctx);
  }, (err: unknown) => typeof err === "object" && err != null && "code" in err && err.code === "api.invalid_json_key");
});
