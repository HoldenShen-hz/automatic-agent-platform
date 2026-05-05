import assert from "node:assert/strict";
import test from "node:test";

import { HierarchicalPromptRegistryService } from "../../../../../../src/platform/prompt-engine/registry/hierarchical-registry-service.js";
import { createPromptRoutes } from "../../../../../../src/platform/interface/api/http-server/prompt-routes.js";
import type { ApiAuthService } from "../../../../../../src/platform/interface/api/api-auth-service.js";
import type { ApiResponsePayload, RouteContext, RouteDefinition } from "../../../../../../src/platform/interface/api/http-server/types.js";

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

function seedPromptRegistry(): HierarchicalPromptRegistryService {
  const registry = new HierarchicalPromptRegistryService();
  registry.registerBundle({
    name: "system.default",
    version: 1,
    domain: "global",
    taskType: "general",
    packId: undefined,
    systemPrompt: { content: "You are helpful.", templateVariables: [], channel: "system" },
    userPrompt: undefined,
    fewShotExamples: [],
    constraints: {
      maxTokens: 256,
      temperature: undefined,
      topP: undefined,
      stopSequences: undefined,
      responseFormat: "json",
      customConstraints: {},
    },
    compatibilityMatrix: {
      toolSchemaVersions: [{ toolName: "general", schemaVersion: 1 }],
      evaluatorSchemaVersions: [{ evaluatorName: "default", schemaVersion: 1 }],
      domainDescriptorVersions: [{ domainId: "global", version: 1 }],
      modelRoutingProfiles: [{ modelId: "balanced/default", profileVersion: 1 }],
    },
    metadata: {
      owner: "test",
      deprecated: false,
      lifecycleStatus: "draft",
      tags: [],
      compatibilityTags: [],
      trafficAllocation: {
        weight: 100,
        startTime: undefined,
        endTime: undefined,
        targeting: undefined,
      },
    },
  }, "global");
  registry.registerBundle({
    name: "system.sales",
    version: 2,
    domain: "sales",
    taskType: "lead_followup",
    packId: undefined,
    systemPrompt: { content: "You are a sales assistant.", templateVariables: [], channel: "system" },
    userPrompt: undefined,
    fewShotExamples: [],
    constraints: {
      maxTokens: 256,
      temperature: undefined,
      topP: undefined,
      stopSequences: undefined,
      responseFormat: "json",
      customConstraints: {},
    },
    compatibilityMatrix: {
      toolSchemaVersions: [{ toolName: "sales", schemaVersion: 1 }],
      evaluatorSchemaVersions: [{ evaluatorName: "default", schemaVersion: 1 }],
      domainDescriptorVersions: [{ domainId: "sales", version: 1 }],
      modelRoutingProfiles: [{ modelId: "balanced/default", profileVersion: 1 }],
    },
    metadata: {
      owner: "test",
      deprecated: false,
      lifecycleStatus: "draft",
      tags: [],
      compatibilityTags: [],
      trafficAllocation: {
        weight: 100,
        startTime: undefined,
        endTime: undefined,
        targeting: undefined,
      },
    },
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

test("PUT /v1/prompts/:name/deprecate validates request body before deprecating", async () => {
  const routes = createPromptRoutes({
    authService: createMockAuthService(["operator"]),
    promptRegistryService: seedPromptRegistry(),
  });

  await assert.rejects(
    () => callRoute(routes, {
      requestId: "req-prompt-deprecate-invalid",
      request: {
        method: "PUT",
        url: "/v1/prompts/system.default/deprecate",
        headers: {},
        body: JSON.stringify({ version: "1", unexpected: true }),
      } as never,
      route: { pathname: null, segments: ["v1", "prompts", "system.default", "deprecate"] },
      principal: null,
    }),
  );
});

test("PUT /v1/prompts/:name/deprecate accepts validated payload", async () => {
  const routes = createPromptRoutes({
    authService: createMockAuthService(["operator"]),
    promptRegistryService: seedPromptRegistry(),
  });

  const response = await callRoute(routes, {
    requestId: "req-prompt-deprecate-valid",
    request: {
      method: "PUT",
      url: "/v1/prompts/system.default/deprecate",
      headers: {},
      body: JSON.stringify({ version: 1, level: "global" }),
    } as never,
    route: { pathname: null, segments: ["v1", "prompts", "system.default", "deprecate"] },
    principal: null,
  });

  if (!response) throw new Error("handler returned null");
  assert.equal(response.statusCode, 200);
  const parsed = JSON.parse(response.body);
  assert.equal(parsed.data.deprecated, true);
  assert.equal(parsed.data.name, "system.default");
});
