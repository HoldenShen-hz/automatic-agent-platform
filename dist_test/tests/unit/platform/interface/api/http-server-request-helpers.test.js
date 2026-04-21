import assert from "node:assert/strict";
import test from "node:test";
import { matchRoute, normalizeHeaders, authenticateOptionalPrincipal, MAX_BODY_BYTES, } from "../../../../../src/platform/interface/api/http-server/request-helpers.js";
import { ApiAuthError } from "../../../../../src/platform/interface/api/api-auth-service.js";
function createMockRequest(overrides = {}) {
    return {
        method: overrides.method ?? "GET",
        url: overrides.url ?? "/",
        headers: overrides.headers ?? {},
        ...overrides,
    };
}
test("matchRoute returns null for unsupported methods", () => {
    assert.equal(matchRoute(createMockRequest({ method: "DELETE" })), null);
    assert.equal(matchRoute(createMockRequest({ method: "PUT" })), null);
    assert.equal(matchRoute(createMockRequest({ method: "PATCH" })), null);
});
test("matchRoute returns route for GET requests", () => {
    const result = matchRoute(createMockRequest({ method: "GET", url: "/tasks" }));
    assert.deepEqual(result, { pathname: "/tasks", segments: ["tasks"] });
});
test("matchRoute returns route for POST requests", () => {
    const result = matchRoute(createMockRequest({ method: "POST", url: "/v1/tasks" }));
    assert.deepEqual(result, { pathname: "/v1/tasks", segments: ["v1", "tasks"] });
});
test("matchRoute parses root path", () => {
    const result = matchRoute(createMockRequest({ method: "GET", url: "/" }));
    assert.deepEqual(result, { pathname: "/", segments: [] });
});
test("matchRoute handles paths with multiple segments", () => {
    const result = matchRoute(createMockRequest({ method: "GET", url: "/v1/tasks/task_123/steps" }));
    assert.deepEqual(result, { pathname: "/v1/tasks/task_123/steps", segments: ["v1", "tasks", "task_123", "steps"] });
});
test("matchRoute handles query strings", () => {
    const result = matchRoute(createMockRequest({ method: "GET", url: "/tasks?limit=10&status=active" }));
    assert.deepEqual(result, { pathname: "/tasks", segments: ["tasks"] });
});
test("normalizeHeaders returns empty object for undefined", () => {
    assert.deepEqual(normalizeHeaders(undefined), {});
});
test("normalizeHeaders lowercases header names", () => {
    const result = normalizeHeaders({ "Content-Type": "application/json", "X-Request-Id": "123" });
    assert.deepEqual(result, { "content-type": "application/json", "x-request-id": "123" });
});
test("normalizeHeaders joins array values with comma", () => {
    const result = normalizeHeaders({ "X-Custom-Header": ["value1", "value2"] });
    assert.equal(result["x-custom-header"], "value1, value2");
});
test("normalizeHeaders handles mixed array and string values", () => {
    const result = normalizeHeaders({ "Content-Type": "application/json", "X-Array": ["a", "b"] });
    assert.equal(result["content-type"], "application/json");
    assert.equal(result["x-array"], "a, b");
});
test("MAX_BODY_BYTES is 1 MB", () => {
    assert.equal(MAX_BODY_BYTES, 1_048_576);
});
test("authenticateOptionalPrincipal returns null when authService is null", () => {
    const request = createMockRequest({ headers: { authorization: "Bearer token" } });
    assert.equal(authenticateOptionalPrincipal(request, null), null);
});
test("authenticateOptionalPrincipal returns null when no credentials provided", () => {
    const mockAuthService = { authenticate: () => { } };
    const request = createMockRequest({ headers: {} });
    assert.equal(authenticateOptionalPrincipal(request, mockAuthService), null);
});
test("authenticateOptionalPrincipal returns null for empty authorization", () => {
    const mockAuthService = { authenticate: () => { } };
    const request = createMockRequest({ headers: { authorization: "" } });
    assert.equal(authenticateOptionalPrincipal(request, mockAuthService), null);
});
test("authenticateOptionalPrincipal returns null for whitespace-only authorization", () => {
    const mockAuthService = { authenticate: () => { } };
    const request = createMockRequest({ headers: { authorization: "   " } });
    assert.equal(authenticateOptionalPrincipal(request, mockAuthService), null);
});
test("authenticateOptionalPrincipal returns null for empty x-api-key", () => {
    const mockAuthService = { authenticate: () => { } };
    const request = createMockRequest({ headers: { "x-api-key": "" } });
    assert.equal(authenticateOptionalPrincipal(request, mockAuthService), null);
});
test("authenticateOptionalPrincipal calls authenticate for valid bearer token", () => {
    const mockPrincipal = { actorId: "user_123", tenantId: null, roles: [] };
    const mockAuthService = { authenticate: () => mockPrincipal };
    const request = createMockRequest({ headers: { authorization: "Bearer valid_token" } });
    assert.deepEqual(authenticateOptionalPrincipal(request, mockAuthService), mockPrincipal);
});
test("authenticateOptionalPrincipal calls authenticate for valid api key", () => {
    const mockPrincipal = { actorId: "user_456", tenantId: "tenant_1", roles: ["admin"] };
    const mockAuthService = { authenticate: () => mockPrincipal };
    const request = createMockRequest({ headers: { "x-api-key": "valid_key" } });
    assert.deepEqual(authenticateOptionalPrincipal(request, mockAuthService), mockPrincipal);
});
test("authenticateOptionalPrincipal returns null when authenticate throws ApiAuthError", () => {
    const mockAuthService = {
        authenticate: () => { throw new ApiAuthError(401, "api.token_invalid", "Invalid token"); },
    };
    const request = createMockRequest({ headers: { authorization: "Bearer invalid_token" } });
    assert.equal(authenticateOptionalPrincipal(request, mockAuthService), null);
});
test("authenticateOptionalPrincipal propagates non-ApiAuthError exceptions", () => {
    const mockAuthService = {
        authenticate: () => { throw new Error("Unexpected error"); },
    };
    const request = createMockRequest({ headers: { authorization: "Bearer token" } });
    assert.throws(() => authenticateOptionalPrincipal(request, mockAuthService), { message: "Unexpected error" });
});
//# sourceMappingURL=http-server-request-helpers.test.js.map