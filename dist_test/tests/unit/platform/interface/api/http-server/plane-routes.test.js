import assert from "node:assert/strict";
import test from "node:test";
import { createPlaneRoutes } from "../../../../../../src/platform/interface/api/http-server/plane-routes.js";
function createMockAuthService() {
    return {
        requireRole: () => ({ actorId: "actor-1", roles: ["viewer"], authMethod: "api_key", tenantId: null }),
    };
}
function createMockContext(url, options = {}) {
    const routePathname = url.split("?")[0] ?? url;
    return {
        requestId: "req-123",
        request: {
            method: options.method ?? "GET",
            url,
            headers: { authorization: "Bearer test", ...(options.headers ?? {}) },
            body: options.body ?? null,
        },
        route: {
            pathname: routePathname,
            segments: routePathname.split("/").filter((segment) => segment.length > 0),
        },
        principal: null,
    };
}
async function callRoute(routes, ctx) {
    for (const route of routes) {
        if (route.method !== (ctx.request.method ?? "GET")) {
            continue;
        }
        if (route.pathname === ctx.route.pathname) {
            return route.handler(ctx);
        }
        if (route.pathname == null && route.segments) {
            const result = await route.handler(ctx);
            if (result != null) {
                return result;
            }
        }
    }
    return null;
}
test("GET /v1/knowledge/semantic/inspect returns semantic infrastructure profile", async () => {
    const routes = createPlaneRoutes({
        authService: createMockAuthService(),
        knowledgePlaneService: {
            inspectSemanticInfrastructure: () => ({
                backend: "local_hash",
                ready: true,
                details: {
                    recordCount: 2,
                },
            }),
        },
    });
    const route = routes.find((candidate) => candidate.pathname === "/v1/knowledge/semantic/inspect");
    assert.ok(route);
    const response = await route.handler(createMockContext("/v1/knowledge/semantic/inspect"));
    assert.ok(response);
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /local_hash/);
    assert.match(response.body, /recordCount/);
});
test("GET /v1/knowledge/semantic/inspect reports not_enabled when knowledge plane is absent", async () => {
    const routes = createPlaneRoutes({
        authService: createMockAuthService(),
        knowledgePlaneService: null,
    });
    const route = routes.find((candidate) => candidate.pathname === "/v1/knowledge/semantic/inspect");
    assert.ok(route);
    const response = await route.handler(createMockContext("/v1/knowledge/semantic/inspect"));
    assert.ok(response);
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /not_enabled/);
    assert.match(response.body, /knowledge_plane/);
});
test("GET /v1/knowledge/query rejects invalid domainId query values", async () => {
    const routes = createPlaneRoutes({
        authService: createMockAuthService(),
        knowledgePlaneService: {
            queryAsync: async () => [],
            queryForDomain: async () => [],
        },
    });
    await assert.rejects(async () => {
        await callRoute(routes, createMockContext("/v1/knowledge/query?domainId=../../etc/passwd&q=test"));
    }, /invalid_domainId|invalid characters/i);
});
test("GET /v1/knowledge/graph rejects invalid limit query values", async () => {
    const routes = createPlaneRoutes({
        authService: createMockAuthService(),
        knowledgePlaneService: {
            inspectGraph: () => ({ nodes: [], edges: [] }),
        },
    });
    await assert.rejects(async () => {
        await callRoute(routes, createMockContext("/v1/knowledge/graph?limit=oops"));
    }, /positive integer|invalid_limit/i);
});
test("POST /v1/artifacts/bundles/preview validates payload before prepareBundle", async () => {
    const routes = createPlaneRoutes({
        authService: {
            requireRole: () => ({ actorId: "actor-1", roles: ["operator"], authMethod: "api_key", tenantId: null }),
        },
        artifactPlaneService: {
            prepareBundle: () => {
                throw new Error("should not reach prepareBundle");
            },
        },
    });
    const ctx = createMockContext("/v1/artifacts/bundles/preview", {
        method: "POST",
        body: JSON.stringify({
            taskId: "task-1",
            domainId: "domain-1",
            bundleType: "release_bundle",
            artifacts: [{ artifactId: "artifact-1" }],
        }),
    });
    await assert.rejects(async () => {
        await callRoute(routes, ctx);
    }, (error) => typeof error === "object"
        && error != null
        && "code" in error
        && typeof error.code === "string"
        && error.code.startsWith("api.invalid_artifact_bundle_preview_payload"));
});
test("POST /v1/artifacts/bundles/publish rejects dangerous json keys", async () => {
    const routes = createPlaneRoutes({
        authService: {
            requireRole: () => ({ actorId: "actor-1", roles: ["operator"], authMethod: "api_key", tenantId: null }),
        },
        artifactPlaneService: {
            publishBundle: () => {
                throw new Error("should not reach publishBundle");
            },
        },
    });
    const ctx = createMockContext("/v1/artifacts/bundles/publish", {
        method: "POST",
        body: "{\"bundle\":{\"__proto__\":{\"polluted\":true}}}",
    });
    await assert.rejects(async () => {
        await callRoute(routes, ctx);
    }, (error) => typeof error === "object" && error != null && "code" in error && error.code === "api.invalid_json_key");
});
//# sourceMappingURL=plane-routes.test.js.map