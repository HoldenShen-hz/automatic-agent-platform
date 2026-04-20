import assert from "node:assert/strict";
import test from "node:test";

import { createCostRoutes } from "../../../../../../src/platform/interface/api/http-server/cost-routes.js";
import { CostReportService } from "../../../../../../src/platform/interface/api/cost-report-service.js";
import type { ApiAuthService } from "../../../../../../src/platform/interface/api/api-auth-service.js";
import type { RouteContext, RouteDefinition, ApiResponsePayload } from "../../../../../../src/platform/interface/api/http-server/types.js";

function createMockAuthService(roles: string[] = ["viewer"]): ApiAuthService {
  return {
    requireRole: () => ({ actorId: "actor-1", roles: roles as ("viewer" | "operator" | "admin")[], authMethod: "api_key", tenantId: null }),
  } as unknown as ApiAuthService;
}

function createMockContext(pathname = "/v1/cost-reports", segments: string[] = [], body: string | null = null): RouteContext {
  return {
    requestId: "req-cost-123",
    request: { method: body != null ? "POST" : "GET", url: pathname, headers: {}, body } as never,
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
    }
  }
  return null;
}

test("createCostRoutes returns 2 routes", () => {
  const routes = createCostRoutes({
    authService: createMockAuthService(),
    costReportService: new CostReportService(),
  });
  assert.equal(routes.length, 2);
});

test("POST /v1/cost-reports stores report and GET returns report list", async () => {
  const costReportService = new CostReportService();
  const routes = createCostRoutes({
    authService: createMockAuthService(["operator"]),
    costReportService,
  });

  const createResponse = await callRoute(
    routes,
    createMockContext(
      "/v1/cost-reports",
      ["v1", "cost-reports"],
      JSON.stringify({
        periodStart: "2026-04-01T00:00:00.000Z",
        periodEnd: "2026-04-30T23:59:59.000Z",
        totalCostUsd: 12.5,
        resourceCosts: [
          { resourceId: "llm-1", resourceType: "api", costUsd: 12.5 },
        ],
      }),
    ),
  );
  if (!createResponse) throw new Error("create handler returned null");
  assert.equal(createResponse.statusCode, 201);
  assert.ok(createResponse.body.includes("\"resourceCount\": 1"));

  const listResponse = await callRoute(routes, createMockContext("/v1/cost-reports", ["v1", "cost-reports"]));
  if (!listResponse) throw new Error("list handler returned null");
  assert.equal(listResponse.statusCode, 200);
  assert.ok(listResponse.body.includes("\"totalCostUsd\": 12.5"));
});
