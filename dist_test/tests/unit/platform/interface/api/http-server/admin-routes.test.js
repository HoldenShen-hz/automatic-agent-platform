import assert from "node:assert/strict";
import test from "node:test";
import { createAdminRoutes } from "../../../../../../src/platform/interface/api/http-server/admin-routes.js";
import { ConfigRolloutService } from "../../../../../../src/platform/control-plane/config-center/config-rollout-service.js";
import { TenantBoundaryRegistryService } from "../../../../../../src/platform/control-plane/tenant/index.js";
import { CostReportService } from "../../../../../../src/platform/interface/api/cost-report-service.js";
import { AdminConfigService } from "../../../../../../src/platform/interface/api/admin-config-service.js";
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
        getStabilityPanel: () => ({
            health: { status: "ok", queuedTasks: 0, activeExecutions: 0, tier1AckBacklog: 0 },
            pendingApprovals: [],
            findings: [],
            blockedTasks: [],
            workers: [],
        }),
        getAdminTakeoverConsole: (_taskId) => ({
            scope: { taskId: "task-123", divisionId: null, workspaceId: null, tenantId: null },
            inspect: { takeoverSessions: [], operatorActions: [] },
            executionOwner: {},
            activeWorker: null,
            latestPmfVerdict: null,
            timeline: { entries: [] },
        }),
    };
}
function createMockLoadBalancingService() {
    return {
        buildSummary: () => ({ generatedAt: "2026-04-16T00:00:00.000Z", coordinators: [], hotCoordinators: [] }),
        selectCoordinator: () => ({ selectedCoordinatorId: "coord-1", score: 0.5, candidates: 1 }),
    };
}
function createMockAuthService(roles = ["viewer"]) {
    return {
        requireRole: () => ({ actorId: "actor-1", roles: roles, authMethod: "api_key", tenantId: null }),
    };
}
function createTenantRegistryService() {
    return new TenantBoundaryRegistryService({
        organizations: [
            {
                organizationId: "org-1",
                displayName: "Example Org",
                billingAccountId: null,
                defaultTenantId: "tenant-1",
                createdAt: "2026-04-16T00:00:00.000Z",
                updatedAt: "2026-04-16T00:00:00.000Z",
            },
        ],
        tenants: [
            {
                tenantId: "tenant-1",
                organizationId: "org-1",
                displayName: "Tenant One",
                storageScope: "storage/tenant-1",
                identityScope: "identity/tenant-1",
                policyScope: "policy/tenant-1",
                artifactScope: "artifacts/tenant-1",
                isolationMode: "shared_logical",
                deploymentMode: "cloud_shared",
                status: "active",
                createdAt: "2026-04-16T00:00:00.000Z",
                updatedAt: "2026-04-16T00:00:00.000Z",
            },
        ],
    });
}
function createMockContext(pathname = "/v1/stability", segments = [], headers = {}, body = null) {
    return {
        requestId: "req-123",
        request: { method: body != null ? "POST" : "GET", url: pathname, headers, body },
        route: { pathname, segments },
        principal: null,
    };
}
async function callRoute(routes, ctx) {
    const pathname = ctx.route.pathname;
    const method = ctx.request.method ?? "GET";
    for (const route of routes) {
        if (route.method !== method)
            continue;
        if (route.pathname !== null) {
            if (route.pathname === pathname) {
                return route.handler(ctx);
            }
        }
        else if (route.segments) {
            const result = await route.handler(ctx);
            if (result !== null) {
                return result;
            }
        }
    }
    return null;
}
test("createAdminRoutes returns 9 routes", () => {
    const deps = {
        authService: createMockAuthService(),
        missionControlService: createMockMissionControlService(),
        coordinatorLoadBalancingService: createMockLoadBalancingService(),
    };
    const routes = createAdminRoutes(deps);
    assert.equal(routes.length, 9);
});
test("GET /v1/stability returns stability panel", async () => {
    const deps = {
        authService: createMockAuthService(),
        missionControlService: createMockMissionControlService(),
        coordinatorLoadBalancingService: createMockLoadBalancingService(),
    };
    const routes = createAdminRoutes(deps);
    const ctx = createMockContext("/v1/stability", ["v1", "stability"]);
    const response = await callRoute(routes, ctx);
    if (!response)
        throw new Error("Handler returned null");
    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes("ok"));
});
test("GET /v1/stability throws when auth not configured", async () => {
    const deps = {
        authService: null,
        missionControlService: createMockMissionControlService(),
        coordinatorLoadBalancingService: createMockLoadBalancingService(),
    };
    const routes = createAdminRoutes(deps);
    const ctx = createMockContext("/v1/stability", ["v1", "stability"]);
    try {
        await callRoute(routes, ctx);
        assert.fail("Expected handler to throw");
    }
    catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /authentication/);
    }
});
test("GET /v1/admin/tasks/:id returns admin takeover console", async () => {
    const deps = {
        authService: createMockAuthService(["admin"]),
        missionControlService: createMockMissionControlService(),
        coordinatorLoadBalancingService: createMockLoadBalancingService(),
    };
    const routes = createAdminRoutes(deps);
    const ctx = createMockContext("/v1/admin/tasks/task-123", ["v1", "admin", "tasks", "task-123"]);
    const response = await callRoute(routes, ctx);
    if (!response)
        throw new Error("Handler returned null");
    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes("task-123"));
});
test("GET /v1/admin/tasks/:id throws for non-admin role", async () => {
    const deps = {
        authService: createMockAuthService(["viewer"]),
        missionControlService: createMockMissionControlService(),
        coordinatorLoadBalancingService: createMockLoadBalancingService(),
    };
    const routes = createAdminRoutes(deps);
    const ctx = createMockContext("/v1/admin/tasks/task-123", ["v1", "admin", "tasks", "task-123"]);
    try {
        await callRoute(routes, ctx);
        assert.fail("Expected handler to throw");
    }
    catch (err) {
        assert.ok(err instanceof Error);
    }
});
test("GET /v1/admin/control-plane/load-balancing returns summary", async () => {
    const deps = {
        authService: createMockAuthService(["admin"]),
        missionControlService: createMockMissionControlService(),
        coordinatorLoadBalancingService: createMockLoadBalancingService(),
    };
    const routes = createAdminRoutes(deps);
    const ctx = createMockContext("/v1/admin/control-plane/load-balancing", ["v1", "admin", "control-plane", "load-balancing"]);
    const response = await callRoute(routes, ctx);
    if (!response)
        throw new Error("Handler returned null");
    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes("generatedAt") || response.body.includes("coordinators"));
});
test("GET /v1/admin/control-plane/load-balancing throws 503 when service unavailable", async () => {
    const deps = {
        authService: createMockAuthService(["admin"]),
        missionControlService: createMockMissionControlService(),
        coordinatorLoadBalancingService: null,
    };
    const routes = createAdminRoutes(deps);
    const ctx = createMockContext("/v1/admin/control-plane/load-balancing", ["v1", "admin", "control-plane", "load-balancing"]);
    try {
        await callRoute(routes, ctx);
        assert.fail("Expected handler to throw");
    }
    catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /not configured/);
    }
});
test("POST /v1/admin/control-plane/load-balancing/select selects coordinator", async () => {
    const deps = {
        authService: createMockAuthService(["admin"]),
        missionControlService: createMockMissionControlService(),
        coordinatorLoadBalancingService: createMockLoadBalancingService(),
    };
    const routes = createAdminRoutes(deps);
    const ctx = createMockContext("/v1/admin/control-plane/load-balancing/select", ["v1", "admin", "control-plane", "load-balancing", "select"], {}, JSON.stringify({ queueName: "default" }));
    const response = await callRoute(routes, ctx);
    if (!response)
        throw new Error("Handler returned null");
    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes("coord-1"));
});
test("POST /v1/admin/control-plane/load-balancing/select validates payload is object", async () => {
    const deps = {
        authService: createMockAuthService(["admin"]),
        missionControlService: createMockMissionControlService(),
        coordinatorLoadBalancingService: createMockLoadBalancingService(),
    };
    const routes = createAdminRoutes(deps);
    const ctx = createMockContext("/v1/admin/control-plane/load-balancing/select", ["v1", "admin", "control-plane", "load-balancing", "select"], {}, "not an object");
    try {
        await callRoute(routes, ctx);
        assert.fail("Expected handler to throw");
    }
    catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /Request body must be valid JSON/);
    }
});
test("POST /v1/admin/control-plane/load-balancing/select rejects dangerous json keys", async () => {
    const deps = {
        authService: createMockAuthService(["admin"]),
        missionControlService: createMockMissionControlService(),
        coordinatorLoadBalancingService: createMockLoadBalancingService(),
    };
    const routes = createAdminRoutes(deps);
    const ctx = createMockContext("/v1/admin/control-plane/load-balancing/select", ["v1", "admin", "control-plane", "load-balancing", "select"], {}, "{\"__proto__\":{\"polluted\":true}}");
    await assert.rejects(async () => {
        await callRoute(routes, ctx);
    }, (err) => typeof err === "object" && err != null && "code" in err && err.code === "api.invalid_json_key");
});
test("GET /v1/admin/workers returns workers list envelope", async () => {
    const deps = {
        authService: createMockAuthService(["admin"]),
        missionControlService: createMockMissionControlService(),
        coordinatorLoadBalancingService: createMockLoadBalancingService(),
    };
    const routes = createAdminRoutes(deps);
    const ctx = createMockContext("/v1/admin/workers", ["v1", "admin", "workers"]);
    const response = await callRoute(routes, ctx);
    if (!response)
        throw new Error("Handler returned null");
    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes("\"workers\""));
});
test("POST /v1/admin/config returns update metadata", async () => {
    const adminConfigService = new AdminConfigService();
    const deps = {
        authService: createMockAuthService(["admin"]),
        missionControlService: createMockMissionControlService(),
        coordinatorLoadBalancingService: createMockLoadBalancingService(),
        adminConfigService,
    };
    const routes = createAdminRoutes(deps);
    const ctx = createMockContext("/v1/admin/config", ["v1", "admin", "config"], {}, JSON.stringify({ key: "runtime.maxConcurrency", value: 8 }));
    const response = await callRoute(routes, ctx);
    if (!response)
        throw new Error("Handler returned null");
    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes("runtime.maxConcurrency"));
    assert.equal(adminConfigService.listUpdates(1)[0]?.key, "runtime.maxConcurrency");
});
test("GET /v1/admin/rollouts returns active rollouts", async () => {
    const configRolloutService = new ConfigRolloutService();
    configRolloutService.startRollout("runtime.maxConcurrency", "platform", null, 25, { changedBy: "admin" });
    const routes = createAdminRoutes({
        authService: createMockAuthService(["viewer"]),
        missionControlService: createMockMissionControlService(),
        coordinatorLoadBalancingService: createMockLoadBalancingService(),
        configRolloutService,
    });
    const response = await callRoute(routes, createMockContext("/v1/admin/rollouts", ["v1", "admin", "rollouts"]));
    if (!response)
        throw new Error("Handler returned null");
    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes("runtime.maxConcurrency"));
});
test("GET /v1/admin/tenants returns tenant registry data", async () => {
    const routes = createAdminRoutes({
        authService: createMockAuthService(["admin"]),
        missionControlService: createMockMissionControlService(),
        coordinatorLoadBalancingService: createMockLoadBalancingService(),
        tenantRegistryService: createTenantRegistryService(),
    });
    const response = await callRoute(routes, createMockContext("/v1/admin/tenants", ["v1", "admin", "tenants"]));
    if (!response)
        throw new Error("Handler returned null");
    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes("Tenant One"));
});
test("GET /v1/admin/budgets returns aggregated budget summaries", async () => {
    const costReportService = new CostReportService();
    costReportService.createReport({
        tenantId: "tenant-1",
        periodStart: "2026-04-01T00:00:00.000Z",
        periodEnd: "2026-04-30T23:59:59.000Z",
        totalCostUsd: 25,
        resourceCosts: [{ resourceId: "openai", resourceType: "api", costUsd: 25, currency: "USD" }],
        submittedBy: "operator-1",
    });
    const routes = createAdminRoutes({
        authService: createMockAuthService(["admin"]),
        missionControlService: createMockMissionControlService(),
        coordinatorLoadBalancingService: createMockLoadBalancingService(),
        costReportService,
    });
    const response = await callRoute(routes, createMockContext("/v1/admin/budgets", ["v1", "admin", "budgets"]));
    if (!response)
        throw new Error("Handler returned null");
    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes("\"totalCostUsd\": 25"));
});
//# sourceMappingURL=admin-routes.test.js.map