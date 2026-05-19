import assert from "node:assert/strict";
import test from "node:test";

import { HierarchicalPromptRegistryService } from "../../../../../../src/platform/prompt-engine/registry/hierarchical-registry-service.js";
import { createPromptRoutes } from "../../../../../../src/platform/five-plane-interface/api/http-server/prompt-routes.js";
import type { ApiAuthService } from "../../../../../../src/platform/five-plane-interface/api/api-auth-service.js";
import type { ApiResponsePayload, RouteContext, RouteDefinition } from "../../../../../../src/platform/five-plane-interface/api/http-server/types.js";

function createMockAuthService(roles: string[] = ["viewer"]): ApiAuthService {
  return {
    requireRole: () => ({ actorId: "actor-1", roles: roles as ("viewer" | "operator" | "admin")[], authMethod: "api_key", tenantId: null }),
  } as unknown as ApiAuthService;
}

function createMockContext(url = "/v1/prompts", pathname = "/v1/prompts"): RouteContext {
  return {
    requestId: "req-prompt-123",
    request: { method: "GET", url, headers: {}, body: null } as never,
    route: { pathname, segments: ["v1", "prompts"] },
    principal: null,
  };
}

async function callRoute(routes: RouteDefinition[], ctx: RouteContext): Promise<ApiResponsePayload | null> {
  for (const route of routes) {
    if (route.method === (ctx.request.method ?? "GET") && route.pathname === ctx.route.pathname) {
      return route.handler(ctx);
    }
  }
  return null;
}

function findSegmentRoute(routes: RouteDefinition[], method: string): RouteDefinition {
  const route = routes.find((candidate) => candidate.method === method && candidate.segments === true);
  if (!route) {
    throw new Error(`route not found for method ${method}`);
  }
  return route;
}

function seedPromptRegistry(): HierarchicalPromptRegistryService {
  const registry = new HierarchicalPromptRegistryService();
  registry.registerBundle({
    name: "system.default",
    version: "1.0.0",
    domain: "global",
    taskType: "general",
    packId: undefined,
    systemPrompt: { content: "You are helpful.", templateVariables: [], channel: "system" },
    userPrompt: undefined,
    fewShotExamples: undefined,
    constraints: undefined,
    metadata: undefined,
  }, "global");
  registry.registerBundle({
    name: "system.sales",
    version: "1.1.0",
    domain: "sales",
    taskType: "lead_followup",
    packId: undefined,
    systemPrompt: { content: "You are a sales assistant.", templateVariables: [], channel: "system" },
    userPrompt: undefined,
    fewShotExamples: undefined,
    constraints: undefined,
    metadata: undefined,
  }, "domain", "sales");
  return registry;
}

test("createPromptRoutes returns 5 routes", () => {
  const routes = createPromptRoutes({
    authService: createMockAuthService(),
    promptRegistryService: seedPromptRegistry(),
  });
  assert.equal(routes.length, 5);
});

test("GET /v1/prompts lists registered prompt bundles", async () => {
  const routes = createPromptRoutes({
    authService: createMockAuthService(),
    promptRegistryService: seedPromptRegistry(),
  });

  const response = await callRoute(routes, createMockContext());
  if (!response) throw new Error("handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("system.default"));
});

test("GET /v1/prompts supports domain filters", async () => {
  const routes = createPromptRoutes({
    authService: createMockAuthService(),
    promptRegistryService: seedPromptRegistry(),
  });

  const response = await callRoute(routes, createMockContext("/v1/prompts?level=domain&domain=sales"));
  if (!response) throw new Error("handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("system.sales"));
  assert.ok(!response.body.includes("system.default"));
});

test("GET /v1/prompts/:name returns 404 error payload when bundle is missing", async () => {
  const routes = createPromptRoutes({
    authService: createMockAuthService(),
    promptRegistryService: seedPromptRegistry(),
  });

  const route = findSegmentRoute(routes, "GET");
  const response = await route.handler({
    requestId: "req-prompt-missing",
    request: {
      method: "GET",
      url: "/v1/prompts/missing.bundle?taskType=general",
      headers: {},
      body: null,
    } as never,
    route: { pathname: null, segments: ["v1", "prompts", "missing.bundle"] },
    principal: null,
  });

  if (!response) throw new Error("handler returned null");
  assert.equal(response.statusCode, 404);
  assert.ok(response.body.includes("\"error\""));
  assert.ok(response.body.includes("api.prompt_bundle_not_found"));
});

test("PUT /v1/prompts/:name/deprecate returns 404 when version is missing", async () => {
  const routes = createPromptRoutes({
    authService: createMockAuthService(["operator"]),
    promptRegistryService: seedPromptRegistry(),
  });

  const route = findSegmentRoute(routes, "PUT");
  const response = await route.handler({
    requestId: "req-prompt-deprecate",
    request: {
      method: "PUT",
      url: "/v1/prompts/system.default/deprecate",
      headers: {},
      body: JSON.stringify({ version: "9.9.9", level: "global" }),
    } as never,
    route: { pathname: null, segments: ["v1", "prompts", "system.default", "deprecate"] },
    principal: null,
  });

  if (!response) throw new Error("handler returned null");
  assert.equal(response.statusCode, 404);
  assert.ok(response.body.includes("api.prompt_bundle_not_found"));
});

test("POST /v1/prompts rejects unknown request fields via strict schema", async () => {
  const routes = createPromptRoutes({
    authService: createMockAuthService(["operator"]),
    promptRegistryService: seedPromptRegistry(),
  });

  const route = routes.find((candidate) => candidate.method === "POST" && candidate.pathname === "/v1/prompts");
  if (!route) throw new Error("route not found");

  await assert.rejects(
    async () => {
      await route.handler({
        requestId: "req-prompt-post",
        request: {
          method: "POST",
          url: "/v1/prompts",
          headers: {},
          body: JSON.stringify({
            name: "system.extra",
            version: 1,
            unsupportedField: true,
          }),
        } as never,
        route: { pathname: "/v1/prompts", segments: ["v1", "prompts"] },
        principal: null,
      });
    },
    /unrecognized key/i,
  );
});
