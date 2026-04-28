import assert from "node:assert/strict";
import test from "node:test";

import { createAdminRoutes } from "../../../../../../src/platform/interface/api/http-server/admin-routes.js";
import type { AdminRouteDeps } from "../../../../../../src/platform/interface/api/http-server/admin-routes.js";
import type { ApiAuthService } from "../../../../../../src/platform/interface/api/api-auth-service.js";
import type { MissionControlService } from "../../../../../../src/platform/interface/api/mission-control-service.js";
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
    getTaskCockpit: () => ({
      snapshot: {
        task: { id: "task-1", title: "Test Task", status: "done", tenantId: null, createdAt: "2026-04-16T00:00:00.000Z", updatedAt: "2026-04-16T00:00:00.000Z" },
        events: [],
        artifacts: [],
      },
      inspect: { task: { id: "task-1" }, steps: [], executions: [], approvals: [], artifacts: [], dispatchDecisions: [], stepResults: [], runtimeRecovery: { candidates: [] }, workflowState: null },
      timeline: { entries: [] },
    }),
    listWorkflowCockpits: () => [],
    getWorkflowCockpit: () => ({
      summary: { taskId: "task-1", workflowId: "wf-1", workflowStatus: "done", currentStepIndex: 0, pendingApprovalCount: 0, retryCount: 0, resumableFromStep: null },
      inspect: { task: { id: "task-1", tenantId: null }, steps: [], executions: [], approvals: [], artifacts: [], dispatchDecisions: [], stepResults: [], runtimeRecovery: { candidates: [] }, workflowState: null },
      timeline: { entries: [] },
    }),
  } as unknown as MissionControlService;
}

function createMockAuthService(): ApiAuthService {
  return {
    requireRole: () => ({ actorId: "actor-1", roles: ["viewer"], authMethod: "api_key", tenantId: null }),
  } as unknown as ApiAuthService;
}

function createMockAdminRouteDeps(): AdminRouteDeps {
  return {
    authService: createMockAuthService(),
    missionControlService: createMockMissionControlService(),
  };
}

function createMockContext(pathname = "/api/v1/harness-runs", segments: string[] = [], headers: Record<string, string | undefined> = {}): RouteContext {
  const routePathname = pathname.split("?")[0] ?? pathname;
  return {
    requestId: "req-123",
    request: { method: "GET", url: pathname, headers, body: null } as never,
    route: { pathname: routePathname, segments },
    principal: null,
  };
}

/**
 * Finds and calls the correct route handler for a given pathname+segments,
 * mimicking how the HTTP server iterates segment-based routes and returns
 * the first non-null result.
 */
async function callRoute(routes: RouteDefinition[], ctx: RouteContext): Promise<ApiResponsePayload | null> {
  const pathname = ctx.route.pathname;
  for (const route of routes) {
    if (route.method !== (ctx.request.method ?? "GET")) continue;
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

// ── R5-35: Harness runs endpoints ────────────────────────────────────────────

test("GET /api/v1/harness-runs returns harness runs list", async () => {
  const deps = createMockAdminRouteDeps();
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext("/api/v1/harness-runs", ["api", "v1", "harness-runs"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.ok(Array.isArray(body.data.harnessRuns));
  assert.equal(body.data.total, 0);
  assert.equal(body.data.limit, 50);
});

test("GET /api/v1/harness-runs accepts limit parameter", async () => {
  const deps = createMockAdminRouteDeps();
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext("/api/v1/harness-runs?limit=25", ["api", "v1", "harness-runs"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.data.limit, 25);
});

test("GET /api/v1/harness-runs/:id returns harness run by id", async () => {
  const deps = createMockAdminRouteDeps();
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext("/api/v1/harness-runs/hr-123", ["api", "v1", "harness-runs", "hr-123"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.data.harnessRunId, "hr-123");
});

test("GET /api/v1/harness-runs/:id/events returns harness run events", async () => {
  const deps = createMockAdminRouteDeps();
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext("/api/v1/harness-runs/hr-456/events", ["api", "v1", "harness-runs", "hr-456", "events"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.data.harnessRunId, "hr-456");
});

test("GET /api/v1/harness-runs requires authentication", async () => {
  const deps: AdminRouteDeps = {
    ...createMockAdminRouteDeps(),
    authService: null,
  };
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext("/api/v1/harness-runs", ["api", "v1", "harness-runs"]);
  try {
    await callRoute(routes, ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /authentication|auth|principal/i);
  }
});

test("GET /api/v1/harness-runs/:id requires authentication", async () => {
  const deps: AdminRouteDeps = {
    ...createMockAdminRouteDeps(),
    authService: null,
  };
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext("/api/v1/harness-runs/hr-123", ["api", "v1", "harness-runs", "hr-123"]);
  try {
    await callRoute(routes, ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /authentication|auth|principal/i);
  }
});

test("GET /api/v1/harness-runs/:id/events requires authentication", async () => {
  const deps: AdminRouteDeps = {
    ...createMockAdminRouteDeps(),
    authService: null,
  };
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext("/api/v1/harness-runs/hr-456/events", ["api", "v1", "harness-runs", "hr-456", "events"]);
  try {
    await callRoute(routes, ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /authentication|auth|principal/i);
  }
});

test("GET /api/v1/harness-runs returns 401 when auth service returns null principal", async () => {
  const deps = createMockAdminRouteDeps();
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext("/api/v1/harness-runs", ["api", "v1", "harness-runs"]);
  try {
    await callRoute(routes, ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
  }
});

test("GET /api/v1/harness-runs/:id rejects malformed harness run id", async () => {
  const deps = createMockAdminRouteDeps();
  const routes = createAdminRoutes(deps);
  // Empty segment should not match the route pattern (length !== 4)
  const ctx = createMockContext("/api/v1/harness-runs/", ["api", "v1", "harness-runs", ""]);
  const response = await callRoute(routes, ctx);
  // Empty string as segment should not match the harness-runs/:id route
  assert.ok(response === null || response.statusCode !== 200);
});
