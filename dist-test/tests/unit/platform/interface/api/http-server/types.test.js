import assert from "node:assert/strict";
import test from "node:test";
test("RouteMatch structure is correct", () => {
    const match = {
        pathname: "/api/tasks/123",
        segments: ["api", "tasks", "123"],
    };
    assert.equal(match.pathname, "/api/tasks/123");
    assert.deepEqual(match.segments, ["api", "tasks", "123"]);
});
test("RouteMatch allows empty segments for root path", () => {
    const match = {
        pathname: "/",
        segments: [],
    };
    assert.equal(match.pathname, "/");
    assert.deepEqual(match.segments, []);
});
test("ApiRequestLike structure is correct", () => {
    const request = {
        method: "GET",
        url: "/api/health",
        headers: { "content-type": "application/json" },
        body: null,
    };
    assert.equal(request.method, "GET");
    assert.equal(request.url, "/api/health");
    assert.equal(request.headers["content-type"], "application/json");
});
test("ApiRequestLike allows undefined method", () => {
    const request = {
        method: undefined,
        url: "/api/default",
        headers: {},
        body: undefined,
    };
    assert.equal(request.method, undefined);
    assert.equal(request.body, undefined);
});
test("ApiResponsePayload structure is correct", () => {
    const response = {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: '{"success":true}',
    };
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["content-type"], "application/json");
    assert.equal(response.body, '{"success":true}');
});
test("ApiResponsePayload allows different status codes", () => {
    const response404 = {
        statusCode: 404,
        headers: {},
        body: "Not Found",
    };
    assert.equal(response404.statusCode, 404);
    const response500 = {
        statusCode: 500,
        headers: { "content-type": "text/plain" },
        body: "Internal Server Error",
    };
    assert.equal(response500.statusCode, 500);
});
test("RouteContext structure is correct", () => {
    const ctx = {
        request: {
            method: "POST",
            url: "/api/tasks",
            headers: {},
            body: '{"data":"test"}',
        },
        route: {
            pathname: "/api/tasks",
            segments: ["api", "tasks"],
        },
        requestId: "req_123",
        principal: null,
    };
    assert.equal(ctx.requestId, "req_123");
    assert.equal(ctx.principal, null);
    assert.equal(ctx.route.pathname, "/api/tasks");
});
test("RouteContext allows non-null principal", () => {
    const ctx = {
        request: {
            method: "GET",
            url: "/api/tasks",
            headers: { "authorization": "Bearer token" },
            body: null,
        },
        route: {
            pathname: "/api/tasks",
            segments: ["api", "tasks"],
        },
        requestId: "req_456",
        principal: {
            actorId: "user_abc",
            roles: ["admin"],
            authMethod: "jwt",
            tenantId: "tenant_123",
        },
    };
    assert.equal(ctx.principal?.actorId, "user_abc");
    assert.ok(ctx.principal?.roles.includes("admin"));
    assert.equal(ctx.principal?.authMethod, "jwt");
});
test("RouteDefinition structure is correct", () => {
    const definition = {
        method: "GET",
        pathname: "/api/health",
        segments: false,
        handler: async () => ({
            statusCode: 200,
            headers: {},
            body: "OK",
        }),
    };
    assert.equal(definition.method, "GET");
    assert.equal(definition.pathname, "/api/health");
    assert.equal(definition.segments, false);
});
test("RouteDefinition allows segments=true for segment-based routing", () => {
    const definition = {
        method: "GET",
        pathname: "/api/tasks/:taskId",
        segments: true,
        handler: async () => ({
            statusCode: 200,
            headers: {},
            body: "OK",
        }),
    };
    assert.equal(definition.segments, true);
});
test("RouteDefinition allows null pathname for catch-all", () => {
    const definition = {
        method: "*",
        pathname: null,
        handler: async () => ({
            statusCode: 404,
            headers: {},
            body: "Not Found",
        }),
    };
    assert.equal(definition.pathname, null);
});
//# sourceMappingURL=types.test.js.map