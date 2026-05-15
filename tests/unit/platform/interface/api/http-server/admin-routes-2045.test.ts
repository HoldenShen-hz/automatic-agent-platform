/**
 * @fileoverview Unit tests for Admin Routes - Issue #2045 regression guard.
 *
 * Historical bug:
 * - /admin/tenants used an unbounded `listTenants(Number.MAX_SAFE_INTEGER)` call for `total`
 * - that forced loading the full tenant set into memory and could trigger OOM
 *
 * Current guardrail:
 * - the handler must stay on the canonical `/v1/admin/tenants` route
 * - the tenant read must remain bounded by the validated request limit
 * - the handler must never fall back to `Number.MAX_SAFE_INTEGER`
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createAdminRoutes } from "../../../../../../src/platform/five-plane-interface/api/http-server/admin-routes.js";
import type { MissionControlService } from "../../../../../../src/platform/five-plane-interface/api/mission-control-service.js";
import type { ApiDelegationService } from "../../../../../../src/platform/five-plane-interface/api/facade-interfaces.js";
import type { ApiAuthService } from "../../../../../../src/platform/five-plane-interface/api/api-auth-service.js";
import type { RouteContext, RouteDefinition, ApiResponsePayload } from "../../../../../../src/platform/five-plane-interface/api/http-server/types.js";

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

function createMockLoadBalancingService(): ApiDelegationService {
  return {
    route: () => null,
    buildSummary: () => ({ generatedAt: "2026-04-16T00:00:00.000Z", coordinators: [], hotCoordinators: [] }),
    selectCoordinator: () => ({ selectedCoordinatorId: "coord-1", score: 0.5, candidates: 1 }),
  } as unknown as ApiDelegationService;
}

function createMockAuthService(roles: string[] = ["admin"]): ApiAuthService {
  return {
    requireRole: () => ({ actorId: "actor-1", roles: roles as ("viewer" | "operator" | "admin")[], authMethod: "api_key", tenantId: null }),
  } as unknown as ApiAuthService;
}

function createMockContext(pathname = "/v1/admin/tenants", segments: string[] = [], headers: Record<string, string | undefined> = {}, body: string | null = null, method: string = "GET"): RouteContext {
  return {
    requestId: "req-123",
    request: { method, url: pathname, headers, body } as never,
    route: {
      pathname: pathname.split("?")[0]!,
      segments: segments.length > 0 ? segments : pathname.split("?")[0]!.split("/").filter((segment) => segment.length > 0),
    },
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

// ── Issue #2045: bounded tenant listing regression guard ────────────────────────

/**
 * ISSUE #2045 TEST SUITE
 *
 * The old route used an unbounded list call for totals. The current
 * implementation keeps the tenant listing bounded and derives `total`
 * from the returned page size.
 */

test("ISSUE #2045: GET /v1/admin/tenants keeps listTenants on the bounded default limit", async () => {
  const callLog: { limit: number }[] = [];

  const mockTenantRegistryService = {
    listTenants: (limit: number) => {
      callLog.push({ limit });
      return [];
    },
  };

  const deps = {
    authService: createMockAuthService(),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
    tenantRegistryService: mockTenantRegistryService as any,
  };
  const routes = createAdminRoutes(deps);

  const ctx = createMockContext("/v1/admin/tenants", ["v1", "admin", "tenants"]);

  await callRoute(routes, ctx);

  assert.equal(callLog.length, 1);
  assert.deepEqual(callLog, [{ limit: 50 }]);
});

test("ISSUE #2045: GET /v1/admin/tenants?limit=10 reuses the requested bounded limit", async () => {
  const callLog: { limit: number }[] = [];

  const mockTenantRegistryService = {
    listTenants: (limit: number) => {
      callLog.push({ limit });
      return [];
    },
  };

  const deps = {
    authService: createMockAuthService(),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
    tenantRegistryService: mockTenantRegistryService as any,
  };
  const routes = createAdminRoutes(deps);

  const ctx = createMockContext("/v1/admin/tenants?limit=10", ["v1", "admin", "tenants"]);

  await callRoute(routes, ctx);

  assert.equal(callLog.length, 1);
  assert.deepEqual(callLog, [{ limit: 10 }]);
});

test("ISSUE #2045: GET /v1/admin/tenants clamps oversized limits instead of issuing an unbounded read", async () => {
  let maxLimitUsed = 0;

  const mockTenantRegistryService = {
    listTenants: (limit: number) => {
      if (limit > maxLimitUsed) {
        maxLimitUsed = limit;
      }
      return [];
    },
  };

  const deps = {
    authService: createMockAuthService(),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
    tenantRegistryService: mockTenantRegistryService as any,
  };
  const routes = createAdminRoutes(deps);

  const ctx = createMockContext("/v1/admin/tenants?limit=999999", ["v1", "admin", "tenants"]);

  await callRoute(routes, ctx);

  assert.equal(maxLimitUsed, 200);
});

test("ISSUE #2045: response body total stays aligned with the bounded tenant page", async () => {
  const firstPage = Array.from({ length: 10 }, (_, index) => ({ tenantId: `tenant-${index}` }));
  const mockTenantRegistryService = {
    listTenants: (limit: number) => {
      return limit === 10 ? firstPage : [];
    },
  };

  const deps = {
    authService: createMockAuthService(),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
    tenantRegistryService: mockTenantRegistryService as any,
  };
  const routes = createAdminRoutes(deps);

  const ctx = createMockContext("/v1/admin/tenants?limit=10", ["v1", "admin", "tenants"]);

  const response = await callRoute(routes, ctx);

  const body = JSON.parse(response!.body);
  assert.equal(body.data.total, 10);
  assert.equal(body.data.tenants.length, 10);
});

// ── Existing tests that should continue to pass ─────────────────────────────────

test("createAdminRoutes returns expected route count", () => {
  const deps = {
    authService: createMockAuthService(),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  };
  const routes = createAdminRoutes(deps);
  assert.ok(routes.length > 0);
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
});

test("GET /v1/admin/control-plane/load-balancing requires admin role", async () => {
  const deps = {
    authService: createMockAuthService(["viewer"]), // Wrong role
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  };
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext("/v1/admin/control-plane/load-balancing", ["v1", "admin", "control-plane", "load-balancing"]);

  try {
    await callRoute(routes, ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
  }
});

test("GET /v1/admin/tenants requires admin role", async () => {
  const deps = {
    authService: createMockAuthService(["viewer"]), // Wrong role
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  };
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext("/v1/admin/tenants", ["v1", "admin", "tenants"]);

  try {
    await callRoute(routes, ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
  }
});
