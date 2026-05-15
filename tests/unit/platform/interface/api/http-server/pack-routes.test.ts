import assert from "node:assert/strict";
import test from "node:test";

import { createPackRoutes } from "../../../../../../src/platform/five-plane-interface/api/http-server/pack-routes.js";
import { PackCatalogService } from "../../../../../../src/platform/five-plane-interface/api/pack-catalog-service.js";
import type { ApiAuthService } from "../../../../../../src/platform/five-plane-interface/api/api-auth-service.js";
import type { RouteContext, RouteDefinition, ApiResponsePayload } from "../../../../../../src/platform/five-plane-interface/api/http-server/types.js";

function createMockAuthService(roles: string[] = ["viewer"]): ApiAuthService {
  return {
    requireRole: () => ({ actorId: "actor-1", roles: roles as ("viewer" | "operator" | "admin")[], authMethod: "api_key", tenantId: null }),
  } as unknown as ApiAuthService;
}

function createMockContext(pathname = "/v1/packs", segments: string[] = [], body: string | null = null): RouteContext {
  return {
    requestId: "req-pack-123",
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
    } else if (route.segments) {
      const result = await route.handler(ctx);
      if (result !== null) {
        return result;
      }
    }
  }
  return null;
}

test("createPackRoutes returns 3 routes", () => {
  const routes = createPackRoutes({
    authService: createMockAuthService(),
    packCatalogService: new PackCatalogService(),
  });
  assert.equal(routes.length, 3);
});

test("POST /v1/packs creates a pack and GET /v1/packs returns it", async () => {
  const packCatalogService = new PackCatalogService();
  const routes = createPackRoutes({
    authService: createMockAuthService(["operator"]),
    packCatalogService,
  });

  const createResponse = await callRoute(
    routes,
    createMockContext(
      "/v1/packs",
      ["v1", "packs"],
      JSON.stringify({
        packId: "pack.finance",
        name: "Finance Pack",
        version: "1.0.0",
        domainId: "finance",
        description: "Finance workflow pack",
        toolBundles: ["bundle-1"],
        pluginIds: ["plugin-1"],
      }),
    ),
  );
  if (!createResponse) throw new Error("create handler returned null");
  assert.equal(createResponse.statusCode, 201);
  assert.ok(createResponse.body.includes("pack.finance"));

  const listResponse = await callRoute(routes, createMockContext("/v1/packs", ["v1", "packs"]));
  if (!listResponse) throw new Error("list handler returned null");
  assert.equal(listResponse.statusCode, 200);
  assert.ok(listResponse.body.includes("Finance Pack"));
});

test("GET /v1/packs/:id returns 404 for unknown pack", async () => {
  const routes = createPackRoutes({
    authService: createMockAuthService(),
    packCatalogService: new PackCatalogService(),
  });

  await assert.rejects(async () => {
    await callRoute(routes, createMockContext("/v1/packs/unknown", ["v1", "packs", "unknown"]));
  }, /Pack unknown not found/);
});
