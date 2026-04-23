import assert from "node:assert/strict";
import test from "node:test";
import { readRequestId, readLimit, readStatusFilter, readJsonBody, validateTaskId, buildJsonResponse, buildJsonErrorResponse, buildJsonDocumentResponse, buildHtmlResponse, buildTextResponse, } from "../../../../../src/platform/interface/api/http-server/utils.js";
function createMockRequest(overrides = {}) {
    return {
        method: overrides.method ?? "GET",
        url: overrides.url ?? "/",
        headers: overrides.headers ?? {},
        body: overrides.body ?? null,
        ...overrides,
    };
}
test("readRequestId returns header value when present", () => {
    const request = createMockRequest({ headers: { "x-request-id": "req_123" } });
    assert.equal(readRequestId(request), "req_123");
});
test("readRequestId trims whitespace from header value", () => {
    const request = createMockRequest({ headers: { "x-request-id": "  req_456  " } });
    assert.equal(readRequestId(request), "req_456");
});
test("readRequestId generates fallback when header missing", () => {
    const request = createMockRequest({ headers: {} });
    const result = readRequestId(request);
    assert.ok(result.startsWith("req_"));
});
test("readRequestId returns fallback when header is empty string", () => {
    const request = createMockRequest({ headers: { "x-request-id": "" } });
    const result = readRequestId(request);
    assert.ok(result.startsWith("req_"));
});
test("readLimit parses valid limit from query", () => {
    const request = createMockRequest({ url: "/?limit=50" });
    assert.equal(readLimit(request, 20), 50);
});
test("readLimit clamps to maximum of 200", () => {
    const request = createMockRequest({ url: "/?limit=500" });
    assert.equal(readLimit(request, 20), 200);
});
test("readLimit throws for limit=0", () => {
    const request = createMockRequest({ url: "/?limit=0" });
    assert.throws(() => readLimit(request, 20), { code: "api.invalid_limit" });
});
test("readLimit throws for non-numeric limit", () => {
    const request = createMockRequest({ url: "/?limit=abc" });
    assert.throws(() => readLimit(request, 20), { code: "api.invalid_limit" });
});
test("readLimit uses fallback when no query param", () => {
    const request = createMockRequest({ url: "/" });
    assert.equal(readLimit(request, 30), 30);
});
test("readLimit throws for float limit", () => {
    const request = createMockRequest({ url: "/?limit=25.75" });
    assert.throws(() => readLimit(request, 20), { code: "api.invalid_limit" });
});
test("readStatusFilter returns status when present", () => {
    const request = createMockRequest({ url: "/?status=active" });
    assert.equal(readStatusFilter(request), "active");
});
test("readStatusFilter returns undefined for empty status", () => {
    const request = createMockRequest({ url: "/?status=" });
    assert.equal(readStatusFilter(request), undefined);
});
test("readStatusFilter returns undefined for missing status", () => {
    const request = createMockRequest({ url: "/" });
    assert.equal(readStatusFilter(request), undefined);
});
test("readJsonBody returns empty object for null", () => {
    assert.deepEqual(readJsonBody(null), {});
});
test("readJsonBody returns empty object for undefined", () => {
    assert.deepEqual(readJsonBody(undefined), {});
});
test("readJsonBody returns empty object for empty string", () => {
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
test("readJsonBody throws for invalid JSON", () => {
    assert.throws(() => readJsonBody("not valid json"), (e) => e.code === "api.invalid_json");
});
test("validateTaskId returns taskId when valid", () => {
    assert.equal(validateTaskId("task_123", "test"), "task_123");
    assert.equal(validateTaskId("task-abc-456", "test"), "task-abc-456");
    assert.equal(validateTaskId("task_ABC-123", "test"), "task_ABC-123");
});
test("validateTaskId throws for undefined", () => {
    assert.throws(() => validateTaskId(undefined, "test"), (e) => e.code === "api.task_not_found" && e.message.includes("test"));
});
test("validateTaskId throws for empty string", () => {
    assert.throws(() => validateTaskId("", "test"), (e) => e.code === "api.task_not_found");
});
test("validateTaskId throws when exceeds max length", () => {
    const longId = "a".repeat(129);
    assert.throws(() => validateTaskId(longId, "test"), (e) => e.code === "api.invalid_task_id" && e.message.includes("128"));
});
test("validateTaskId accepts taskId at exactly MAX_TASK_ID_LENGTH (128 chars)", () => {
    const maxLengthId = "a".repeat(128);
    assert.equal(validateTaskId(maxLengthId, "test"), maxLengthId);
});
test("validateTaskId rejects taskId of 129 chars", () => {
    const overByOne = "b".repeat(129);
    assert.throws(() => validateTaskId(overByOne, "test"), (e) => e.code === "api.invalid_task_id");
});
test("validateTaskId throws for invalid characters", () => {
    assert.throws(() => validateTaskId("task with space", "test"), (e) => e.code === "api.invalid_task_id");
    assert.throws(() => validateTaskId("task@special", "test"), (e) => e.code === "api.invalid_task_id");
});
test("validateTaskId throws for non-string", () => {
    assert.throws(() => validateTaskId(123, "test"), (e) => e.code === "api.task_not_found");
});
test("buildJsonResponse creates correct payload", () => {
    const result = buildJsonResponse("req_123", 200, { data: "test" });
    assert.equal(result.statusCode, 200);
    assert.equal(result.headers["content-type"], "application/json; charset=utf-8");
    assert.equal(result.headers["x-request-id"], "req_123");
    assert.ok(result.body.includes('"requestId"'));
    assert.ok(result.body.includes('"data"'));
});
test("buildJsonErrorResponse creates correct error payload", () => {
    const result = buildJsonErrorResponse("req_456", 400, { code: "test.error", message: "Test error" });
    assert.equal(result.statusCode, 400);
    assert.equal(result.headers["content-type"], "application/json; charset=utf-8");
    assert.equal(result.headers["x-request-id"], "req_456");
    assert.ok(result.body.includes('"error"'));
    assert.ok(result.body.includes('"test.error"'));
    assert.ok(result.body.includes('"Test error"'));
});
test("buildJsonDocumentResponse creates 200 response without requestId", () => {
    const result = buildJsonDocumentResponse({ doc: true });
    assert.equal(result.statusCode, 200);
    assert.ok(result.body.includes('"doc": true'));
});
test("buildHtmlResponse creates correct HTML payload", () => {
    const result = buildHtmlResponse("<html><body>Hello</body></html>");
    assert.equal(result.statusCode, 200);
    assert.equal(result.headers["content-type"], "text/html; charset=utf-8");
    assert.equal(result.body, "<html><body>Hello</body></html>");
});
test("buildTextResponse creates correct text payload", () => {
    const result = buildTextResponse("Plain text content");
    assert.equal(result.statusCode, 200);
    assert.equal(result.headers["content-type"], "text/plain; charset=utf-8");
    assert.equal(result.body, "Plain text content");
});
//# sourceMappingURL=http-server-utils.test.js.map