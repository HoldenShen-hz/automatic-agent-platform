import assert from "node:assert/strict";
import test from "node:test";

import { createHarnessRunsRoutes, HarnessRunsApiError } from "../../../../../../src/platform/five-plane-interface/api/http-server/harness-runs-routes.js";
import type { ApiAuthService } from "../../../../../../src/platform/five-plane-interface/api/api-auth-service.js";
import type { RouteContext, RouteDefinition, ApiResponsePayload } from "../../../../../../src/platform/five-plane-interface/api/http-server/types.js";

function createMockAuthService(): ApiAuthService {
  return {
    requireRole: () => ({ actorId: "actor-1", roles: ["operator"], authMethod: "api_key", tenantId: "tenant:local" }),
  } as unknown as ApiAuthService;
}

function createMockAuthServiceAdmin(): ApiAuthService {
  return {
    requireRole: () => ({ actorId: "admin-1", roles: ["admin"], authMethod: "api_key", tenantId: "tenant:local" }),
  } as unknown as ApiAuthService;
}

function createMockAuthServiceViewer(): ApiAuthService {
  return {
    requireRole: () => ({ actorId: "viewer-1", roles: ["viewer"], authMethod: "api_key", tenantId: "tenant:local" }),
  } as unknown as ApiAuthService;
}

function createMockContext(pathname = "/v1/harness-runs", segments: string[] = [], headers: Record<string, string | undefined> = {}, body: string | null = null): RouteContext {
  const routePathname = pathname.split("?")[0] ?? pathname;
  return {
    requestId: "req-123",
    request: { method: "GET", url: pathname, headers, body } as never,
    route: { pathname: routePathname, segments },
    principal: null,
  };
}

async function callRoute(routes: RouteDefinition[], ctx: RouteContext, method = "GET"): Promise<ApiResponsePayload | null> {
  for (const route of routes) {
    if (route.method !== method) continue;
    if (route.pathname !== null) {
      if (route.pathname === ctx.route.pathname) {
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

function parseResponseData(result: ApiResponsePayload): any {
  return JSON.parse(result.body).data;
}

test("createHarnessRunsRoutes - GET /v1/harness-runs returns empty list initially", async () => {
  const routes = createHarnessRunsRoutes({ authService: createMockAuthServiceViewer() });
  const ctx = createMockContext("/v1/harness-runs", ["v1", "harness-runs"]);
  const result = await callRoute(routes, ctx);

  assert.ok(result != null);
  assert.strictEqual(result.statusCode, 200);
  const body = parseResponseData(result);
  assert.deepStrictEqual(body.harnessRuns, []);
  assert.strictEqual(body.total, 0);
  assert.strictEqual(body.hasMore, false);
});

test("createHarnessRunsRoutes - POST /v1/harness-runs creates a new harness run", async () => {
  const routes = createHarnessRunsRoutes({ authService: createMockAuthService() });
  const ctx = createMockContext("/v1/harness-runs", ["v1", "harness-runs"], {}, JSON.stringify({
    tenantId: "tenant:test",
    domainId: "test-domain",
    riskLevel: "low",
  }));

  const result = await callRoute(routes, ctx, "POST");

  assert.ok(result != null);
  assert.strictEqual(result.statusCode, 201);
  const body = parseResponseData(result);
  assert.ok(body.harnessRunId.startsWith("hrun_"));
  assert.strictEqual(body.tenantId, "tenant:test");
  assert.strictEqual(body.domainId, "test-domain");
  assert.strictEqual(body.riskLevel, "low");
  assert.strictEqual(body.status, "created");
});

test("createHarnessRunsRoutes - POST /v1/harness-runs with invalid JSON throws error", async () => {
  const routes = createHarnessRunsRoutes({ authService: createMockAuthService() });
  const ctx = createMockContext("/v1/harness-runs", ["v1", "harness-runs"], {}, "not valid json{");

  await assert.rejects(
    async () => callRoute(routes, ctx, "POST"),
    (err: unknown) => err instanceof HarnessRunsApiError && err.statusCode === 400 && err.code === "api.invalid_json"
  );
});

test("createHarnessRunsRoutes - GET /v1/harness-runs/:id returns 404 for non-existent run", async () => {
  const routes = createHarnessRunsRoutes({ authService: createMockAuthServiceViewer() });
  const ctx = createMockContext("/v1/harness-runs/hrun_nonexistent", ["v1", "harness-runs", "hrun_nonexistent"]);

  await assert.rejects(
    async () => callRoute(routes, ctx),
    (err: unknown) => err instanceof HarnessRunsApiError && err.statusCode === 404
  );
});

test("createHarnessRunsRoutes - GET /v1/harness-runs/:id returns created run", async () => {
  const authService = createMockAuthService();
  const routes = createHarnessRunsRoutes({ authService });

  // First create a run
  const createCtx = createMockContext("/v1/harness-runs", ["v1", "harness-runs"], {}, JSON.stringify({
    tenantId: "tenant:create-test",
    domainId: "domain:create-test",
    riskLevel: "medium",
  }));
  const createResult = await callRoute(routes, createCtx, "POST");
  assert.ok(createResult != null);
  const created = parseResponseData(createResult);
  const harnessRunId = created.harnessRunId;

  // Now fetch it
  const getCtx = createMockContext(`/v1/harness-runs/${harnessRunId}`, ["v1", "harness-runs", harnessRunId]);
  const getResult = await callRoute(routes, getCtx);

  assert.ok(getResult != null);
  assert.strictEqual(getResult.statusCode, 200);
  const body = parseResponseData(getResult);
  assert.strictEqual(body.harnessRunId, harnessRunId);
  assert.strictEqual(body.tenantId, "tenant:create-test");
});

test("createHarnessRunsRoutes - PATCH /v1/harness-runs/:id updates run status", async () => {
  const authService = createMockAuthService();
  const routes = createHarnessRunsRoutes({ authService });

  // Create a run first
  const createCtx = createMockContext("/v1/harness-runs", ["v1", "harness-runs"], {}, JSON.stringify({ domainId: "domain:patch-test", riskLevel: "high" }));
  const createResult = await callRoute(routes, createCtx, "POST");
  const harnessRunId = parseResponseData(createResult!).harnessRunId;

  // Update it
  const patchCtx = createMockContext(
    `/v1/harness-runs/${harnessRunId}`,
    ["v1", "harness-runs", harnessRunId],
    {},
    JSON.stringify({ status: "running" })
  );
  const patchResult = await callRoute(routes, patchCtx, "PATCH");

  assert.ok(patchResult != null);
  assert.strictEqual(patchResult.statusCode, 200);
  const body = parseResponseData(patchResult);
  assert.strictEqual(body.status, "running");
});

test("createHarnessRunsRoutes - PATCH /v1/harness-runs/:id returns 404 for non-existent run", async () => {
  const routes = createHarnessRunsRoutes({ authService: createMockAuthService() });
  const ctx = createMockContext(
    "/v1/harness-runs/hrun_fake",
    ["v1", "harness-runs", "hrun_fake"],
    {},
    JSON.stringify({ status: "running" })
  );

  await assert.rejects(
    async () => callRoute(routes, ctx, "PATCH"),
    (err: unknown) => err instanceof HarnessRunsApiError && err.statusCode === 404
  );
});

test("createHarnessRunsRoutes - DELETE /v1/harness-runs/:id deletes run", async () => {
  const authService = createMockAuthServiceAdmin();
  const routes = createHarnessRunsRoutes({ authService });

  // Create a run
  const createCtx = createMockContext("/v1/harness-runs", ["v1", "harness-runs"], {}, JSON.stringify({ domainId: "domain:delete-test" }));
  const createResult = await callRoute(routes, createCtx, "POST");
  const harnessRunId = parseResponseData(createResult!).harnessRunId;

  // Delete it
  const deleteCtx = createMockContext(`/v1/harness-runs/${harnessRunId}`, ["v1", "harness-runs", harnessRunId]);
  const deleteResult = await callRoute(routes, deleteCtx, "DELETE");

  assert.ok(deleteResult != null);
  assert.strictEqual(deleteResult.statusCode, 200);
  const body = parseResponseData(deleteResult);
  assert.strictEqual(body.harnessRunId, harnessRunId);
  assert.strictEqual(body.status, "deleted");

  // Verify it's gone
  await assert.rejects(
    async () => {
      const getCtx = createMockContext(`/v1/harness-runs/${harnessRunId}`, ["v1", "harness-runs", harnessRunId]);
      return callRoute(routes, getCtx);
    },
    (err: unknown) => err instanceof HarnessRunsApiError && err.statusCode === 404
  );
});

test("createHarnessRunsRoutes - GET /v1/harness-runs/:id/events returns events array", async () => {
  const authService = createMockAuthService();
  const routes = createHarnessRunsRoutes({ authService });

  // Create a run
  const createCtx = createMockContext("/v1/harness-runs", ["v1", "harness-runs"], {}, JSON.stringify({ domainId: "domain:events-test" }));
  const createResult = await callRoute(routes, createCtx, "POST");
  const harnessRunId = parseResponseData(createResult!).harnessRunId;

  // Get events
  const eventsCtx = createMockContext(
    `/v1/harness-runs/${harnessRunId}/events`,
    ["v1", "harness-runs", harnessRunId, "events"]
  );
  const eventsResult = await callRoute(routes, eventsCtx);

  assert.ok(eventsResult != null);
  assert.strictEqual(eventsResult.statusCode, 200);
  const body = parseResponseData(eventsResult);
  assert.deepStrictEqual(body.harnessRunId, harnessRunId);
  assert.deepStrictEqual(body.events, []);
});

test("createHarnessRunsRoutes - pagination with cursor", async () => {
  const routes = createHarnessRunsRoutes({ authService: createMockAuthService() });

  // Create multiple runs
  for (let i = 0; i < 5; i++) {
    const createCtx = createMockContext(
      "/v1/harness-runs",
      ["v1", "harness-runs"],
      {},
      JSON.stringify({ tenantId: `tenant:pagination-${i}`, domainId: `domain:pagination-${i}` }),
    );
    await callRoute(routes, createCtx, "POST");
  }

  // Get first page
  const firstCtx = createMockContext("/v1/harness-runs?limit=2", ["v1", "harness-runs"]);
  const firstResult = await callRoute(routes, firstCtx);

  assert.ok(firstResult != null);
  const firstBody = parseResponseData(firstResult);
  assert.strictEqual(firstBody.harnessRuns.length, 2);
  assert.strictEqual(firstBody.hasMore, true);
  assert.ok(firstBody.nextCursor != null);

  // Get second page using cursor
  const secondCtx = createMockContext(`/v1/harness-runs?limit=2&cursor=${firstBody.nextCursor}`, ["v1", "harness-runs"]);
  const secondResult = await callRoute(routes, secondCtx);

  assert.ok(secondResult != null);
  const secondBody = parseResponseData(secondResult);
  assert.strictEqual(secondBody.harnessRuns.length, 2);
});

test("createHarnessRunsRoutes - uses default values when optional fields not provided", async () => {
  const routes = createHarnessRunsRoutes({ authService: createMockAuthService() });
  const ctx = createMockContext("/v1/harness-runs", ["v1", "harness-runs"], {}, JSON.stringify({ domainId: "default-domain" }));

  const result = await callRoute(routes, ctx, "POST");

  assert.ok(result != null);
  const body = parseResponseData(result);
  assert.strictEqual(body.tenantId, "tenant:local");
  assert.strictEqual(body.domainId, "default-domain");
  assert.strictEqual(body.riskLevel, "medium");
  assert.ok(body.harnessRunId.startsWith("hrun_"));
});
