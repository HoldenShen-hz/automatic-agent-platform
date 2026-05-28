import assert from "node:assert/strict";
import test from "node:test";

import { createPackRoutes } from "../../../../../../src/platform/five-plane-interface/api/http-server/pack-routes.js";
import { PackCatalogService } from "../../../../../../src/platform/five-plane-interface/api/pack-catalog-service.js";
import type { ApiAuthService } from "../../../../../../src/platform/five-plane-interface/api/api-auth-service.js";
import type { RouteContext, RouteDefinition, ApiResponsePayload } from "../../../../../../src/platform/five-plane-interface/api/http-server/types.js";

function createMockAuthService(roles: string[] = ["viewer"], tenantId: string | null = null): ApiAuthService {
  return {
    requireRole: () => ({ actorId: "actor-1", roles: roles as ("viewer" | "operator" | "admin")[], authMethod: "api_key", tenantId }),
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

test("createPackRoutes returns 5 routes", () => {
  const routes = createPackRoutes({
    authService: createMockAuthService(),
    packCatalogService: new PackCatalogService(),
  });
  assert.equal(routes.length, 5);
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

test("GET /v1/marketplace returns public marketplace summaries", async () => {
  const packCatalogService = new PackCatalogService();
  packCatalogService.createPack({
    packId: "pack.ops",
    name: "Ops Pack",
    version: "2.0.0",
    domainId: "operations",
    createdBy: "actor-1",
  });
  const routes = createPackRoutes({
    authService: createMockAuthService(),
    packCatalogService,
  });

  const response = await callRoute(routes, createMockContext("/v1/marketplace", ["v1", "marketplace"]));
  if (!response) throw new Error("marketplace handler returned null");
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body) as { data: Array<Record<string, unknown>> };
  assert.deepEqual(body.data[0], {
    id: "pack.ops",
    name: "Ops Pack",
    category: "operations",
    version: "2.0.0",
  });
});

test("pack routes reject tenant-scoped principals on global catalog surfaces", async () => {
  const routes = createPackRoutes({
    authService: createMockAuthService(["viewer"], "tenant-a"),
    packCatalogService: new PackCatalogService(),
  });

  await assert.rejects(
    () => callRoute(routes, createMockContext("/v1/packs", ["v1", "packs"])),
    /api\.tenant_scope_unsupported|pack catalog/,
  );
});

test("GET /v1/packs/:id/versions returns public version history", async () => {
  const packCatalogService = new PackCatalogService();
  packCatalogService.createPack({
    packId: "pack.finance",
    name: "Finance Pack",
    version: "1.2.3",
    domainId: "finance",
    createdBy: "actor-1",
  });
  const routes = createPackRoutes({
    authService: createMockAuthService(),
    packCatalogService,
  });

  const response = await callRoute(routes, createMockContext("/v1/packs/pack.finance/versions", ["v1", "packs", "pack.finance", "versions"]));
  if (!response) throw new Error("versions handler returned null");
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body) as { data: Array<Record<string, unknown>> };
  assert.equal(body.data[0]?.version, "1.2.3");
  assert.equal(body.data[0]?.status, "draft");
});
