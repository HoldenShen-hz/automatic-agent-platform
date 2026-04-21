import assert from "node:assert/strict";
import test from "node:test";
import { createAuthRoutes } from "../../../../../../src/platform/interface/api/http-server/auth-routes.js";
function createMockAuthService(tokenResult = { token: "abc123", expiresAt: "2026-04-17T00:00:00.000Z" }) {
    return {
        exchangeApiKey: () => tokenResult,
    };
}
function createMockContext(headers = {}, body = null) {
    return {
        requestId: "req-123",
        request: { method: "POST", url: "/auth/token", headers, body },
        route: { pathname: "/auth/token", segments: [] },
        principal: null,
    };
}
test("createAuthRoutes returns 2 routes", () => {
    const deps = { authService: createMockAuthService() };
    const routes = createAuthRoutes(deps);
    assert.equal(routes.length, 2);
});
test("POST /auth/token returns token when auth service available", async () => {
    const deps = { authService: createMockAuthService({ token: "tok-xyz", expiresAt: "2026-04-16T12:00:00.000Z" }) };
    const routes = createAuthRoutes(deps);
    const route = routes.find((r) => r.pathname === "/auth/token");
    const ctx = createMockContext({}, JSON.stringify({ apiKey: "my-key" }));
    const response = await route.handler(ctx);
    if (!response)
        throw new Error("Handler returned null");
    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes("tok-xyz"));
});
test("POST /auth/token throws 503 when auth service not configured", async () => {
    const deps = { authService: null };
    const routes = createAuthRoutes(deps);
    const route = routes.find((r) => r.pathname === "/auth/token");
    const ctx = createMockContext({}, JSON.stringify({ apiKey: "my-key" }));
    try {
        await route.handler(ctx);
        assert.fail("Expected handler to throw");
    }
    catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /auth.*not configured/i);
    }
});
test("POST /auth/token validates payload", async () => {
    const deps = { authService: createMockAuthService() };
    const routes = createAuthRoutes(deps);
    const route = routes.find((r) => r.pathname === "/auth/token");
    const ctx = createMockContext({}, JSON.stringify({ apiKey: "" }));
    try {
        await route.handler(ctx);
        assert.fail("Expected handler to throw");
    }
    catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /String must contain at least 1 character|apiKey/);
    }
});
test("POST /auth/token uses x-api-key header when body is empty", async () => {
    const deps = { authService: createMockAuthService({ token: "header-key-token" }) };
    const routes = createAuthRoutes(deps);
    const route = routes.find((r) => r.pathname === "/auth/token");
    const ctx = createMockContext({ "x-api-key": "header-key-value" }, JSON.stringify({}));
    const response = await route.handler(ctx);
    if (!response)
        throw new Error("Handler returned null");
    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes("header-key-token"));
});
test("POST /v1/auth/token returns token when auth service available", async () => {
    const deps = { authService: createMockAuthService({ token: "v1-token", expiresAt: "2026-04-16T12:00:00.000Z" }) };
    const routes = createAuthRoutes(deps);
    const route = routes.find((r) => r.pathname === "/v1/auth/token");
    const ctx = createMockContext({}, JSON.stringify({ apiKey: "v1-key" }));
    const response = await route.handler(ctx);
    if (!response)
        throw new Error("Handler returned null");
    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes("v1-token"));
});
test("POST /v1/auth/token throws 503 when auth service not configured", async () => {
    const deps = { authService: null };
    const routes = createAuthRoutes(deps);
    const route = routes.find((r) => r.pathname === "/v1/auth/token");
    const ctx = createMockContext({}, JSON.stringify({ apiKey: "my-key" }));
    try {
        await route.handler(ctx);
        assert.fail("Expected handler to throw");
    }
    catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /auth.*not configured/i);
    }
});
test("POST /auth/token throws on invalid JSON body", async () => {
    const deps = { authService: createMockAuthService() };
    const routes = createAuthRoutes(deps);
    const route = routes.find((r) => r.pathname === "/auth/token");
    const ctx = createMockContext({}, "not valid json{");
    try {
        await route.handler(ctx);
        assert.fail("Expected handler to throw");
    }
    catch (err) {
        assert.ok(err instanceof Error);
        assert.match(err.message, /JSON/);
    }
});
test("POST /auth/token rejects dangerous JSON keys", async () => {
    const deps = { authService: createMockAuthService() };
    const routes = createAuthRoutes(deps);
    const route = routes.find((r) => r.pathname === "/auth/token");
    const ctx = createMockContext({}, "{\"__proto__\":{\"polluted\":true},\"apiKey\":\"my-key\"}");
    await assert.rejects(async () => {
        await route.handler(ctx);
    }, /reserved key: __proto__/i);
});
//# sourceMappingURL=auth-routes.test.js.map