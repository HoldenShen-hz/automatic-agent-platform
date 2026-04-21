import assert from "node:assert/strict";
import test from "node:test";
import { createDivisionRoutes } from "../../../../../../src/platform/interface/api/http-server/division-routes.js";
function createMockMissionControlService(divisions = []) {
    return {
        getSnapshot: () => ({ divisions }),
    };
}
function createMockDivisionRegistry(divisions = [{ id: "div-1", name: "Test Division", description: "A test", defaultWorkflowId: "wf-1" }]) {
    const map = new Map();
    for (const div of divisions) {
        map.set(div.id, div);
    }
    return { divisions: map };
}
function createMockContext() {
    return {
        requestId: "req-123",
        request: {},
        route: { pathname: "/", segments: [] },
        principal: null,
    };
}
test("createDivisionRoutes returns 2 routes", () => {
    const deps = {
        divisionRegistry: createMockDivisionRegistry(),
        missionControlService: createMockMissionControlService(),
    };
    const routes = createDivisionRoutes(deps);
    assert.equal(routes.length, 2);
});
test("GET /divisions returns divisions from registry", async () => {
    const deps = {
        divisionRegistry: createMockDivisionRegistry([
            { id: "div-1", name: "Division One", description: "First", defaultWorkflowId: "wf-1" },
            { id: "div-2", name: "Division Two", description: "Second", defaultWorkflowId: "wf-2" },
        ]),
        missionControlService: createMockMissionControlService(),
    };
    const routes = createDivisionRoutes(deps);
    const route = routes.find((r) => r.pathname === "/divisions");
    const ctx = createMockContext();
    const response = await route.handler(ctx);
    if (!response)
        throw new Error("Handler returned null");
    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes("Division One"));
    assert.ok(response.body.includes("div-1"));
});
test("GET /divisions falls back to missionControlService when registry is null", async () => {
    const deps = {
        divisionRegistry: null,
        missionControlService: createMockMissionControlService([{ divisionId: "snap-1", name: "Snapshot Div" }]),
    };
    const routes = createDivisionRoutes(deps);
    const route = routes.find((r) => r.pathname === "/divisions");
    const ctx = createMockContext();
    const response = await route.handler(ctx);
    if (!response)
        throw new Error("Handler returned null");
    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes("Snapshot Div"));
});
test("GET /v1/divisions returns divisions from registry", async () => {
    const deps = {
        divisionRegistry: createMockDivisionRegistry([
            { id: "div-v1", name: "V1 Division", description: "Version 1", defaultWorkflowId: "wf-v1" },
        ]),
        missionControlService: createMockMissionControlService(),
    };
    const routes = createDivisionRoutes(deps);
    const route = routes.find((r) => r.pathname === "/v1/divisions");
    const ctx = createMockContext();
    const response = await route.handler(ctx);
    if (!response)
        throw new Error("Handler returned null");
    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes("V1 Division"));
});
test("GET /v1/divisions falls back to missionControlService when registry is null", async () => {
    const deps = {
        divisionRegistry: null,
        missionControlService: createMockMissionControlService([{ divisionId: "v1-snap", name: "V1 Snapshot" }]),
    };
    const routes = createDivisionRoutes(deps);
    const route = routes.find((r) => r.pathname === "/v1/divisions");
    const ctx = createMockContext();
    const response = await route.handler(ctx);
    if (!response)
        throw new Error("Handler returned null");
    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes("v1-snap"));
});
//# sourceMappingURL=division-routes.test.js.map