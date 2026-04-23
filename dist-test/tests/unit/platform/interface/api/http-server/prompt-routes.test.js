import assert from "node:assert/strict";
import test from "node:test";
import { HierarchicalPromptRegistryService } from "../../../../../../src/platform/prompt-engine/registry/hierarchical-registry-service.js";
import { createPromptRoutes } from "../../../../../../src/platform/interface/api/http-server/prompt-routes.js";
function createMockAuthService(roles = ["viewer"]) {
    return {
        requireRole: () => ({ actorId: "actor-1", roles: roles, authMethod: "api_key", tenantId: null }),
    };
}
function createMockContext(url = "/v1/prompts", pathname = "/v1/prompts") {
    return {
        requestId: "req-prompt-123",
        request: { method: "GET", url, headers: {}, body: null },
        route: { pathname, segments: ["v1", "prompts"] },
        principal: null,
    };
}
async function callRoute(routes, ctx) {
    for (const route of routes) {
        if (route.method === (ctx.request.method ?? "GET") && route.pathname === ctx.route.pathname) {
            return route.handler(ctx);
        }
    }
    return null;
}
function seedPromptRegistry() {
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
    if (!response)
        throw new Error("handler returned null");
    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes("system.default"));
});
test("GET /v1/prompts supports domain filters", async () => {
    const routes = createPromptRoutes({
        authService: createMockAuthService(),
        promptRegistryService: seedPromptRegistry(),
    });
    const response = await callRoute(routes, createMockContext("/v1/prompts?level=domain&domain=sales"));
    if (!response)
        throw new Error("handler returned null");
    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes("system.sales"));
    assert.ok(!response.body.includes("system.default"));
});
//# sourceMappingURL=prompt-routes.test.js.map