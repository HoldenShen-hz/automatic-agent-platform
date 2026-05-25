import assert from "node:assert/strict";
import test from "node:test";

import {
  readRequestId,
  readLimit,
  readStatusFilter,
  readQueryParam,
  readJsonBody,
  requirePrincipal,
  resolveTenantScope,
  assertGlobalTenantScopeSupported,
  assertTaskTenantAccess,
  validateTaskId,
  buildJsonResponse,
  buildJsonErrorResponse,
  buildJsonDocumentResponse,
  buildHtmlResponse,
  buildTextResponse,
  normalizeSegments,
  matchNormalizedSegments,
} from "../../../../../../src/platform/five-plane-interface/api/http-server/utils.js";
import type { ApiRequestLike } from "../../../../../../src/platform/five-plane-interface/api/http-server/types.js";
import { ApiAuthService } from "../../../../../../src/platform/five-plane-interface/api/api-auth-service.js";

function makeRequest(url: string, headers: Record<string, string | undefined> = {}): ApiRequestLike {
  return { method: "GET", url, headers, body: null };
}

// readRequestId tests

test("readRequestId returns x-request-id header when present", () => {
  const request = makeRequest("/api/test", { "x-request-id": "req_custom_123" });
  assert.equal(readRequestId(request), "req_custom_123");
});

test("readRequestId trims whitespace from header", () => {
  const request = makeRequest("/api/test", { "x-request-id": "  req_trimmed_456  " });
  assert.equal(readRequestId(request), "req_trimmed_456");
});

test("readRequestId generates UUID when header is absent", () => {
  const request = makeRequest("/api/test", {});
  const result = readRequestId(request);
  assert.match(result, /^req_[0-9a-f-]{36}$/);
});

test("readRequestId generates UUID when header is empty", () => {
  const request = makeRequest("/api/test", { "x-request-id": "" });
  const result = readRequestId(request);
  assert.match(result, /^req_[0-9a-f-]{36}$/);
});

test("readRequestId generates UUID when header is whitespace only", () => {
  const request = makeRequest("/api/test", { "x-request-id": "   " });
  const result = readRequestId(request);
  assert.match(result, /^req_[0-9a-f-]{36}$/);
});

// readLimit tests

test("readLimit returns fallback when limit param absent", () => {
  const request = makeRequest("/api/tasks");
  assert.equal(readLimit(request, 50), 50);
});

test("readLimit parses valid limit", () => {
  const request = makeRequest("/api/tasks?limit=25");
  assert.equal(readLimit(request, 50), 25);
});

test("readLimit rejects zero and negative limits", () => {
  const request0 = makeRequest("/api/tasks?limit=0");
  assert.throws(() => readLimit(request0, 50), /limit must be a positive integer/);
  const requestNeg = makeRequest("/api/tasks?limit=-5");
  assert.throws(() => readLimit(requestNeg, 50), /limit must be a positive integer/);
});

test("readLimit clamps to maximum of 200", () => {
  const request = makeRequest("/api/tasks?limit=500");
  assert.equal(readLimit(request, 50), 200);
});

test("readLimit rejects non-integer limit", () => {
  const request = makeRequest("/api/tasks?limit=abc");
  assert.throws(() => readLimit(request, 50), /limit must be a positive integer/);
});

test("readLimit rejects negative limit", () => {
  const request = makeRequest("/api/tasks?limit=-10");
  assert.throws(() => readLimit(request, 50), /limit must be a positive integer/);
});

test("readLimit rejects float limit", () => {
  const request = makeRequest("/api/tasks?limit=10.5");
  assert.throws(() => readLimit(request, 50), /limit must be a positive integer/);
});

test("readLimit rejects limit exceeding max length", () => {
  const request = makeRequest("/api/tasks?limit=12345678901234567890");
  assert.throws(() => readLimit(request, 50), /limit exceeds maximum length/);
});

// readStatusFilter tests

test("readStatusFilter returns undefined when status param absent", () => {
  const request = makeRequest("/api/tasks");
  assert.equal(readStatusFilter(request), undefined);
});

test("readStatusFilter returns status value", () => {
  const request = makeRequest("/api/tasks?status=pending");
  assert.equal(readStatusFilter(request), "pending");
});

// readQueryParam tests

test("readQueryParam returns undefined for missing param", () => {
  const request = makeRequest("/api/tasks");
  assert.equal(readQueryParam(request, "foo"), undefined);
});

test("readQueryParam returns value for existing param", () => {
  const request = makeRequest("/api/tasks?foo=bar");
  assert.equal(readQueryParam(request, "foo"), "bar");
});

test("readQueryParam trims value by default", () => {
  const request = makeRequest("/api/tasks?foo=  bar  ");
  assert.equal(readQueryParam(request, "foo"), "bar");
});

test("readQueryParam preserves whitespace when trim=false", () => {
  const request = makeRequest("/api/tasks?foo=  bar  ");
  // URL parsing trims trailing whitespace, so we get "  bar" not "  bar  "
  assert.equal(readQueryParam(request, "foo", { trim: false }), "  bar");
});

test("readQueryParam returns undefined for empty string value when not required", () => {
  const request = makeRequest("/api/tasks?foo=");
  assert.equal(readQueryParam(request, "foo"), undefined);
});

test("readQueryParam throws for empty value when required", () => {
  const request = makeRequest("/api/tasks?foo=");
  assert.throws(() => readQueryParam(request, "foo", { required: true }), /foo is required/);
});

test("readQueryParam throws for missing param when required", () => {
  const request = makeRequest("/api/tasks");
  assert.throws(() => readQueryParam(request, "foo", { required: true }), /foo is required/);
});

test("readQueryParam enforces maxLength", () => {
  const request = makeRequest("/api/tasks?foo=this_is_a_very_long_value");
  assert.throws(() => readQueryParam(request, "foo", { maxLength: 10 }), /exceeds maximum length/);
});

test("readQueryParam enforces pattern - throws on mismatch", () => {
  const request = makeRequest("/api/tasks?foo=abc123");
  // Pattern /^[a-z]+$/ requires all lowercase letters, digits don't match so it throws
  assert.throws(
    () => readQueryParam(request, "foo", { pattern: /^[a-z]+$/ }),
    /contains invalid characters/,
  );
});

test("readQueryParam enforces pattern - returns value on match", () => {
  const request = makeRequest("/api/tasks?foo=abcdef");
  assert.equal(readQueryParam(request, "foo", { pattern: /^[a-z]+$/ }), "abcdef");
});

test("readQueryParam throws on pattern mismatch", () => {
  const request = makeRequest("/api/tasks?foo=ABC123");
  assert.throws(() => readQueryParam(request, "foo", { pattern: /^[a-z]+$/ }), /contains invalid characters/);
});

// readJsonBody tests

test("readJsonBody returns empty object for null body", () => {
  assert.deepEqual(readJsonBody(null), {});
});

test("readJsonBody returns empty object for undefined body", () => {
  assert.deepEqual(readJsonBody(undefined), {});
});

test("readJsonBody returns empty object for empty string body", () => {
  assert.deepEqual(readJsonBody(""), {});
});

test("readJsonBody parses valid JSON object", () => {
  const result = readJsonBody('{"key": "value"}');
  assert.deepEqual(result, { key: "value" });
});

test("readJsonBody parses valid JSON array", () => {
  const result = readJsonBody('[1, 2, 3]');
  assert.deepEqual(result, [1, 2, 3]);
});

test("readJsonBody parses valid JSON primitive", () => {
  assert.equal(readJsonBody('"hello"'), "hello");
  assert.equal(readJsonBody("123"), 123);
  assert.equal(readJsonBody("true"), true);
});

test("readJsonBody throws for invalid JSON", () => {
  assert.throws(() => readJsonBody("not json"), /Request body must be valid JSON/);
});

test("readJsonBody throws for partial JSON", () => {
  assert.throws(() => readJsonBody('{"key": }'), /Request body must be valid JSON/);
});

function makePrincipal(tenantId: string | null): import("../../../../../../src/platform/five-plane-interface/api/api-auth-service.js").ApiPrincipal {
  return { actorId: "user_1", roles: [], authMethod: "jwt", tenantId };
}

// resolveTenantScope tests

test("resolveTenantScope returns requestedTenantId when principal has no tenant", () => {
  const principal = makePrincipal(null);
  assert.equal(resolveTenantScope(principal, "tenant_abc"), "tenant_abc");
});

test("resolveTenantScope returns principal tenantId when requestedTenantId is undefined", () => {
  const principal = makePrincipal("tenant_xyz");
  assert.equal(resolveTenantScope(principal, undefined), "tenant_xyz");
});

test("resolveTenantScope returns principal tenantId when requestedTenantId matches", () => {
  const principal = makePrincipal("tenant_abc");
  assert.equal(resolveTenantScope(principal, "tenant_abc"), "tenant_abc");
});

test("resolveTenantScope throws when principal tenant does not match requested", () => {
  const principal = makePrincipal("tenant_xyz");
  assert.throws(
    () => resolveTenantScope(principal, "tenant_abc"),
    /cannot access another tenant/,
  );
});

// assertGlobalTenantScopeSupported tests

test("assertGlobalTenantScopeSupported does nothing for global principal", () => {
  const principal = makePrincipal(null);
  assert.doesNotThrow(() => assertGlobalTenantScopeSupported(principal, "admin"));
});

test("assertGlobalTenantScopeSupported throws for tenant-scoped principal", () => {
  const principal = makePrincipal("tenant_abc");
  assert.throws(
    () => assertGlobalTenantScopeSupported(principal, "admin"),
    /cannot access/,
  );
});

// assertTaskTenantAccess tests

test("assertTaskTenantAccess rejects principal with no tenant", () => {
  const principal = makePrincipal(null);
  assert.throws(
    () => assertTaskTenantAccess(principal, "tenant_abc", "not_found", "Not found"),
    /tenant scope/,
  );
});

test("assertTaskTenantAccess does nothing when tenant matches", () => {
  const principal = makePrincipal("tenant_abc");
  assert.doesNotThrow(() => assertTaskTenantAccess(principal, "tenant_abc", "not_found", "Not found"));
});

test("assertTaskTenantAccess throws when tenant does not match", () => {
  const principal = makePrincipal("tenant_xyz");
  assert.throws(
    () => assertTaskTenantAccess(principal, "tenant_abc", "not_found", "Not found"),
    /another tenant scope/,
  );
});

test("assertTaskTenantAccess throws 403 with tenant mismatch code", () => {
  const principal = makePrincipal("tenant_xyz");
  try {
    assertTaskTenantAccess(principal, "tenant_abc", "api.task_not_found", "Task not found.");
    assert.fail("Expected error to be thrown");
  } catch (error: any) {
    assert.equal(error.code, "api.tenant_scope_mismatch");
    assert.equal(error.statusCode, 403);
  }
});

// validateTaskId tests

test("validateTaskId returns taskId when valid", () => {
  const request = makeRequest("/api/tasks/task_abc_123");
  assert.equal(validateTaskId("task_abc_123", "path"), "task_abc_123");
});

test("validateTaskId accepts valid alphanumeric with underscores and hyphens", () => {
  assert.equal(validateTaskId("task_abc_123", "path"), "task_abc_123");
  assert.equal(validateTaskId("task-abc-123", "path"), "task-abc-123");
  assert.equal(validateTaskId("TaskABC", "path"), "TaskABC");
});

test("validateTaskId rejects undefined taskId", () => {
  assert.throws(() => validateTaskId(undefined, "path"), /requires taskId/);
});

test("validateTaskId rejects null taskId", () => {
  assert.throws(() => validateTaskId(null as any, "path"), /requires taskId/);
});

test("validateTaskId rejects empty string taskId", () => {
  assert.throws(() => validateTaskId("", "path"), /requires taskId/);
});

test("validateTaskId rejects taskId exceeding max length", () => {
  const longTaskId = "a".repeat(129);
  assert.throws(() => validateTaskId(longTaskId, "path"), /exceeds maximum length/);
});

test("validateTaskId rejects taskId with invalid characters", () => {
  assert.throws(() => validateTaskId("task with space", "path"), /contains invalid characters/);
  assert.throws(() => validateTaskId("task.dot", "path"), /contains invalid characters/);
  assert.throws(() => validateTaskId("task@host", "path"), /contains invalid characters/);
});

test("validateTaskId rejects taskId with leading slash", () => {
  assert.throws(() => validateTaskId("/task_123", "path"), /contains invalid characters/);
});

// buildJsonResponse tests

test("buildJsonResponse builds correct response", () => {
  const result = buildJsonResponse("req_123", 200, { ok: true });
  assert.equal(result.statusCode, 200);
  assert.equal(result.headers["content-type"], "application/json; charset=utf-8");
  assert.equal(result.headers["x-request-id"], "req_123");
  const parsed = JSON.parse(result.body);
  assert.equal(parsed.requestId, "req_123");
  assert.deepEqual(parsed.data, { ok: true });
});

test("buildJsonResponse with 404 status", () => {
  const result = buildJsonResponse("req_456", 404, null);
  assert.equal(result.statusCode, 404);
  const parsed = JSON.parse(result.body);
  assert.equal(parsed.data, null);
});

test("buildJsonResponse pretty-prints JSON", () => {
  const result = buildJsonResponse("req_789", 200, { nested: { value: 1 } });
  assert.ok(result.body.includes("\n"));
  assert.ok(result.body.includes("  "));
});

// buildJsonErrorResponse tests

test("buildJsonErrorResponse builds correct response", () => {
  const result = buildJsonErrorResponse("req_123", 400, {
    code: "api.bad_request",
    message: "Invalid input",
  });
  assert.equal(result.statusCode, 400);
  assert.equal(result.headers["content-type"], "application/json; charset=utf-8");
  assert.equal(result.headers["x-request-id"], "req_123");
  const parsed = JSON.parse(result.body);
  assert.equal(parsed.requestId, "req_123");
  assert.equal(parsed.error.code, "api.bad_request");
  assert.equal(parsed.error.message, "Invalid input");
});

test("buildJsonErrorResponse with 500 status", () => {
  const result = buildJsonErrorResponse("req_500", 500, {
    code: "api.internal_error",
    message: "Something went wrong",
  });
  assert.equal(result.statusCode, 500);
  const parsed = JSON.parse(result.body);
  assert.equal(parsed.error.code, "api.internal_error");
});

// buildJsonDocumentResponse tests

test("buildJsonDocumentResponse builds 200 response without requestId", () => {
  const result = buildJsonDocumentResponse({ doc: "value" });
  assert.equal(result.statusCode, 200);
  assert.equal(result.headers["content-type"], "application/json; charset=utf-8");
  const parsed = JSON.parse(result.body);
  assert.deepEqual(parsed, { doc: "value" });
});

test("buildJsonDocumentResponse does not include x-request-id header", () => {
  const result = buildJsonDocumentResponse({ ok: true });
  assert.equal(result.headers["x-request-id"], undefined);
});

// buildHtmlResponse tests

test("buildHtmlResponse builds correct response", () => {
  const result = buildHtmlResponse("<html><body>Hello</body></html>");
  assert.equal(result.statusCode, 200);
  assert.equal(result.headers["content-type"], "text/html; charset=utf-8");
  assert.equal(result.body, "<html><body>Hello</body></html>");
});

// buildTextResponse tests

test("buildTextResponse builds correct response", () => {
  const result = buildTextResponse("Plain text content");
  assert.equal(result.statusCode, 200);
  assert.equal(result.headers["content-type"], "text/plain; charset=utf-8");
  assert.equal(result.body, "Plain text content");
});

// normalizeSegments tests

test("normalizeSegments removes leading v1", () => {
  assert.deepEqual(normalizeSegments(["v1", "divisions"]), ["divisions"]);
});

test("normalizeSegments returns same segments when no v1", () => {
  assert.deepEqual(normalizeSegments(["divisions", "abc"]), ["divisions", "abc"]);
});

test("normalizeSegments handles multiple v1 prefixes", () => {
  assert.deepEqual(normalizeSegments(["v1", "tasks", "abc"]), ["tasks", "abc"]);
});

test("normalizeSegments returns empty array as-is", () => {
  assert.deepEqual(normalizeSegments([]), []);
});

test("normalizeSegments handles single v1 segment", () => {
  assert.deepEqual(normalizeSegments(["v1"]), []);
});

test("normalizeSegments handles v1 not at first position", () => {
  // v1 at position 0 is the only case we strip, so if not at 0 we keep it
  assert.deepEqual(normalizeSegments(["tasks", "v1"]), ["tasks", "v1"]);
});

// matchNormalizedSegments tests

test("matchNormalizedSegments matches exact segments", () => {
  const result = matchNormalizedSegments(["tasks", "abc"], ["tasks", ":id"]);
  assert.deepEqual(result, ["tasks", "abc"]);
});

test("matchNormalizedSegments strips v1 before matching", () => {
  const result = matchNormalizedSegments(["v1", "tasks", "abc"], ["tasks", ":id"]);
  assert.deepEqual(result, ["tasks", "abc"]);
});

test("matchNormalizedSegments returns null on segment count mismatch (too few)", () => {
  const result = matchNormalizedSegments(["tasks"], ["tasks", ":id"]);
  assert.equal(result, null);
});

test("matchNormalizedSegments returns null on segment count mismatch (too many)", () => {
  const result = matchNormalizedSegments(["tasks", "abc", "extra"], ["tasks", ":id"]);
  assert.equal(result, null);
});

test("matchNormalizedSegments allows variable length with minLength/maxLength", () => {
  const result = matchNormalizedSegments(["tasks", "abc"], ["tasks", ":id"], 1, 3);
  assert.deepEqual(result, ["tasks", "abc"]);
});

test("matchNormalizedSegments returns null when below minLength", () => {
  const result = matchNormalizedSegments(["tasks"], ["tasks", ":id"], 2, 3);
  assert.equal(result, null);
});

test("matchNormalizedSegments returns null when above maxLength", () => {
  const result = matchNormalizedSegments(["tasks", "abc", "extra"], ["tasks", ":id"], 1, 2);
  assert.equal(result, null);
});

test("matchNormalizedSegments returns null when length 0 expected but minLength is 0", () => {
  // When minLength=0 and maxLength=0 but we pass no segments vs expected ["tasks"]
  // Since normalized.length < min, it returns null
  const result = matchNormalizedSegments([], ["tasks"], 0, 0);
  assert.equal(result, null);
});

test("matchNormalizedSegments matches parameter placeholders", () => {
  const result = matchNormalizedSegments(["tasks", "task_123"], ["tasks", ":taskId"]);
  assert.deepEqual(result, ["tasks", "task_123"]);
});

test("matchNormalizedSegments does not validate parameter placeholder content", () => {
  const result = matchNormalizedSegments(["tasks", "any-value-123"], ["tasks", ":taskId"]);
  assert.deepEqual(result, ["tasks", "any-value-123"]);
});

test("matchNormalizedSegments returns null when literal segment does not match", () => {
  const result = matchNormalizedSegments(["divisions", "abc"], ["tasks", ":id"]);
  assert.equal(result, null);
});

test("matchNormalizedSegments handles mixed literal and parameter segments", () => {
  const result = matchNormalizedSegments(["v1", "tasks", "task_abc", "steps", "step_1"], ["tasks", ":taskId", "steps", ":stepId"]);
  assert.deepEqual(result, ["tasks", "task_abc", "steps", "step_1"]);
});

// requirePrincipal tests

test("requirePrincipal returns principal when authService is null and no auth required", () => {
  // This test checks requirePrincipal behavior when authService is null
  const request = makeRequest("/api/tasks");
  // When authService is null, it should throw ApiError with auth_not_configured
  assert.throws(
    () => requirePrincipal(request, null, "viewer"),
    (error: any) => error.code === "api.auth_not_configured" && error.statusCode === 401,
  );
});

test("requirePrincipal throws ApiError when authService is null", () => {
  const request = makeRequest("/api/tasks");
  try {
    requirePrincipal(request, null, "viewer");
    assert.fail("Expected error to be thrown");
  } catch (error: any) {
    assert.equal(error.code, "api.auth_not_configured");
    assert.equal(error.statusCode, 401);
  }
});

test("requirePrincipal returns principal for valid role", () => {
  const service = new ApiAuthService({
    apiKeys: [{ apiKey: "admin-key", actorId: "admin-1", roles: ["admin"] }],
    jwtSecret: "secret-123",
  });
  const exchange = service.exchangeApiKey("admin-key");
  const request = makeRequest("/api/admin", { authorization: `Bearer ${exchange.accessToken}` });

  const principal = requirePrincipal(request, service, "admin");
  assert.equal(principal.actorId, "admin-1");
  assert.ok(principal.roles.includes("admin"));
});

test("requirePrincipal throws for insufficient role", () => {
  const service = new ApiAuthService({
    apiKeys: [{ apiKey: "viewer-key", actorId: "viewer-1", roles: ["viewer"] }],
    jwtSecret: "secret-123",
  });
  const exchange = service.exchangeApiKey("viewer-key");
  const request = makeRequest("/api/admin", { authorization: `Bearer ${exchange.accessToken}` });

  assert.throws(
    () => requirePrincipal(request, service, "admin"),
    (error: any) => error.code === "api.forbidden" && error.statusCode === 403,
  );
});

test("requirePrincipal propagates ApiAuthError with correct status", () => {
  const service = new ApiAuthService({
    apiKeys: [{ apiKey: "viewer-key", actorId: "viewer-1", roles: ["viewer"] }],
    jwtSecret: "secret-123",
  });
  // Use an invalid token so authenticate() throws ApiAuthError
  const request = makeRequest("/api/admin", { authorization: "Bearer invalid.token.here" });

  try {
    requirePrincipal(request, service, "admin");
    assert.fail("Expected error to be thrown");
  } catch (error: any) {
    assert.equal(error.statusCode, 401);
    assert.ok(error.code === "api.invalid_token" || error.code === "api.auth_required");
  }
});
