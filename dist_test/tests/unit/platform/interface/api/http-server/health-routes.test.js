import assert from "node:assert/strict";
import test from "node:test";
import { createHealthRoutes } from "../../../../../../src/platform/interface/api/http-server/health-routes.js";
function createMockMissionControlService(health = { status: "ok" }) {
    return {
        getSnapshot: () => ({ health }),
        getHealthReportAsync: async () => health,
    };
}
function createMockContext() {
    return {
        requestId: "req-123",
        request: {},
        route: { pathname: "/", segments: [] },
        principal: null,
    };
}
test("createHealthRoutes returns 4 routes", () => {
    const deps = {
        missionControlService: createMockMissionControlService(),
    };
    const routes = createHealthRoutes(deps);
    assert.equal(routes.length, 4);
});
test("GET /healthz returns health status", async () => {
    const deps = {
        missionControlService: createMockMissionControlService({ status: "ok", uptime: 100 }),
    };
    const routes = createHealthRoutes(deps);
    const healthzRoute = routes.find((r) => r.pathname === "/healthz");
    const ctx = createMockContext();
    const response = await healthzRoute.handler(ctx);
    if (!response)
        throw new Error("Handler returned null");
    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes("ok"));
});
test("GET /v1/healthz returns health status", async () => {
    const deps = {
        missionControlService: createMockMissionControlService({ status: "degraded" }),
    };
    const routes = createHealthRoutes(deps);
    const healthzRoute = routes.find((r) => r.pathname === "/v1/healthz");
    const ctx = createMockContext();
    const response = await healthzRoute.handler(ctx);
    if (!response)
        throw new Error("Handler returned null");
    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes("degraded"));
});
test("GET /health returns health status", async () => {
    const deps = {
        missionControlService: createMockMissionControlService({ status: "ok" }),
    };
    const routes = createHealthRoutes(deps);
    const healthRoute = routes.find((r) => r.pathname === "/health");
    const ctx = createMockContext();
    const response = await healthRoute.handler(ctx);
    if (!response)
        throw new Error("Handler returned null");
    assert.equal(response.statusCode, 200);
});
test("GET /v1/openapi.json returns OpenAPI document", async () => {
    const deps = {
        missionControlService: createMockMissionControlService(),
    };
    const routes = createHealthRoutes(deps);
    const openapiRoute = routes.find((r) => r.pathname === "/v1/openapi.json");
    const ctx = createMockContext();
    const response = await openapiRoute.handler(ctx);
    if (!response)
        throw new Error("Handler returned null");
    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes("openapi"));
});
//# sourceMappingURL=health-routes.test.js.map