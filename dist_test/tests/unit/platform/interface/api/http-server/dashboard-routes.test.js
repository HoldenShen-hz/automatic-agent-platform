import assert from "node:assert/strict";
import test from "node:test";
import { createDashboardRoutes } from "../../../../../../src/platform/interface/api/http-server/dashboard-routes.js";
function createMockMissionControlService() {
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
    };
}
function createMockAuthService() {
    return {
        requireRole: () => ({ actorId: "actor-1", roles: ["viewer"], authMethod: "api_key", tenantId: null }),
    };
}
function createMockAuthServiceWithTenant() {
    return {
        requireRole: () => ({ actorId: "actor-1", roles: ["viewer"], authMethod: "api_key", tenantId: "tenant-1" }),
    };
}
function createMockContext(headers = {}) {
    return {
        requestId: "req-123",
        request: { method: "GET", url: "/dashboard/snapshot", headers, body: null },
        route: { pathname: "/dashboard/snapshot", segments: [] },
        principal: null,
    };
}
test("createDashboardRoutes returns 2 routes", () => {
    const deps = {
        authService: createMockAuthService(),
        missionControlService: createMockMissionControlService(),
    };
    const routes = createDashboardRoutes(deps);
    assert.equal(routes.length, 2);
});
test("GET /dashboard/snapshot returns snapshot", async () => {
    const deps = {
        authService: createMockAuthService(),
        missionControlService: createMockMissionControlService(),
    };
    const routes = createDashboardRoutes(deps);
    const route = routes.find((r) => r.pathname === "/dashboard/snapshot");
    const ctx = createMockContext();
    const response = await route.handler(ctx);
    if (!response)
        throw new Error("Handler returned null");
    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes("ok"));
});
test("GET /dashboard/snapshot throws when auth not configured", async () => {
    const deps = {
        authService: null,
        missionControlService: createMockMissionControlService(),
    };
    const routes = createDashboardRoutes(deps);
    const route = routes.find((r) => r.pathname === "/dashboard/snapshot");
    const ctx = createMockContext();
    try {
        await route.handler(ctx);
        assert.fail("Expected handler to throw");
    }
    catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /authentication/);
    }
});
test("GET /dashboard/snapshot throws for tenant-scoped principal", async () => {
    const deps = {
        authService: createMockAuthServiceWithTenant(),
        missionControlService: createMockMissionControlService(),
    };
    const routes = createDashboardRoutes(deps);
    const route = routes.find((r) => r.pathname === "/dashboard/snapshot");
    const ctx = createMockContext();
    try {
        await route.handler(ctx);
        assert.fail("Expected handler to throw");
    }
    catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /tenant/);
    }
});
test("GET /v1/dashboard/snapshot returns snapshot", async () => {
    const deps = {
        authService: createMockAuthService(),
        missionControlService: createMockMissionControlService(),
    };
    const routes = createDashboardRoutes(deps);
    const route = routes.find((r) => r.pathname === "/v1/dashboard/snapshot");
    const ctx = createMockContext();
    const response = await route.handler(ctx);
    if (!response)
        throw new Error("Handler returned null");
    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes("ok"));
});
test("GET /v1/dashboard/snapshot throws when auth not configured", async () => {
    const deps = {
        authService: null,
        missionControlService: createMockMissionControlService(),
    };
    const routes = createDashboardRoutes(deps);
    const route = routes.find((r) => r.pathname === "/v1/dashboard/snapshot");
    const ctx = createMockContext();
    try {
        await route.handler(ctx);
        assert.fail("Expected handler to throw");
    }
    catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /authentication/);
    }
});
//# sourceMappingURL=dashboard-routes.test.js.map