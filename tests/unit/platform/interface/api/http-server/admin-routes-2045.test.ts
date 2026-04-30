/**
 * @fileoverview Unit tests for Admin Routes - Issue #2045
 *
 * ISSUE #2045: listTenants(MAX_SAFE_INTEGER) causes OOM
 *
 * In admin-routes.ts line 249:
 *   tenants: deps.tenantRegistryService?.listTenants(limit) ?? [],
 *   total: deps.tenantRegistryService?.listTenants(Number.MAX_SAFE_INTEGER).length ?? 0,
 *
 * The total calculation always uses MAX_SAFE_INTEGER regardless of the limit parameter,
 * which can cause memory exhaustion when there are many tenants.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createAdminRoutes } from "../../../../../../src/platform/interface/api/http-server/admin-routes.js";
import type { MissionControlService } from "../../../../../../src/platform/interface/api/mission-control-service.js";
import type { ApiDelegationService } from "../../../../../../src/platform/interface/api/facade-interfaces.js";
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

// ── Issue #2045: listTenants(MAX_SAFE_INTEGER) OOM vulnerability ────────────────

/**
 * ISSUE #2045 TEST SUITE
 *
 * The /v1/admin/tenants endpoint has an OOM vulnerability:
 * 1. It calls listTenants(limit) to get the paginated tenants
 * 2. It calls listTenants(Number.MAX_SAFE_INTEGER) to get the total count
 *
 * This means every request to list tenants with a small limit still causes
 * the backend to load ALL tenants into memory just to count them.
 *
 * CURRENT CODE (line 248-249):
 *   tenants: deps.tenantRegistryService?.listTenants(limit) ?? [],
 *   total: deps.tenantRegistryService?.listTenants(Number.MAX_SAFE_INTEGER).length ?? 0,
 *
 * The total should be a separate metadata query that doesn't load all tenants.
 */

test("ISSUE #2045: GET /v1/admin/tenants calls listTenants twice with different limits", async () => {
  const callLog: { limit: number }[] = [];

  const mockTenantRegistryService = {
    listTenants: (limit: number) => {
      callLog.push({ limit });
      // Return empty array with metadata to track the call
      return [];
    },
    getTotalTenantCount: () => 0, // This method doesn't exist in the current code
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

  // The route should call listTenants TWICE: once with limit, once with MAX_SAFE_INTEGER
  // This is the bug - it loads all tenants just to count them
  assert.equal(callLog.length, 2);
  assert.equal(callLog[0]?.limit, 50); // Default limit
  assert.equal(callLog[1]?.limit, Number.MAX_SAFE_INTEGER); // Bug: max integer for count
});

test("ISSUE #2045: GET /v1/admin/tenants?limit=10 still calls listTenants with MAX_SAFE_INTEGER", async () => {
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

  // Even with a small limit, MAX_SAFE_INTEGER is used for total count
  assert.equal(callLog.length, 2);
  assert.equal(callLog[0]?.limit, 10);
  assert.equal(callLog[1]?.limit, Number.MAX_SAFE_INTEGER);
});

test("ISSUE #2045: The total calculation loads all tenants into memory", async () => {
  // Simulate many tenants being loaded just for counting
  const allTenants = Array.from({ length: 1000 }, (_, i) => ({
    tenantId: `tenant-${i}`,
    organizationId: "org-1",
    displayName: `Tenant ${i}`,
    storageScope: `storage/tenant-${i}`,
    identityScope: `identity/tenant-${i}`,
    policyScope: `policy/tenant-${i}`,
    artifactScope: `artifacts/tenant-${i}`,
    isolationMode: "shared_logical" as const,
    deploymentMode: "cloud_shared" as const,
    status: "active" as const,
    createdAt: "2026-04-16T00:00:00.000Z",
    updatedAt: "2026-04-16T00:00:00.000Z",
  }));

  let maxLimitUsed = 0;

  const mockTenantRegistryService = {
    listTenants: (limit: number) => {
      if (limit > maxLimitUsed) {
        maxLimitUsed = limit;
      }
      // If limit is MAX_SAFE_INTEGER, return all tenants
      if (limit === Number.MAX_SAFE_INTEGER) {
        return allTenants;
      }
      // Otherwise return empty (simulating pagination)
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

  // The bug causes MAX_SAFE_INTEGER to be used, loading all 1000 tenants
  assert.equal(maxLimitUsed, Number.MAX_SAFE_INTEGER);
});

test("ISSUE #2045: Response body shows incorrect total when tenants are empty", async () => {
  const mockTenantRegistryService = {
    listTenants: (limit: number) => {
      if (limit === Number.MAX_SAFE_INTEGER) {
        // Simulate the OOM actually happening - return huge array
        return Array.from({ length: 10000 }, (_, i) => ({ tenantId: `tenant-${i}` }));
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

  const ctx = createMockContext("/v1/admin/tenants", ["v1", "admin", "tenants"]);

  const response = await callRoute(routes, ctx);

  // The response contains all 10000 tenants in memory (OOM risk)
  const body = JSON.parse(response!.body);
  assert.equal(body.data.total, 10000);
  assert.equal(body.data.tenants.length, 0);
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
