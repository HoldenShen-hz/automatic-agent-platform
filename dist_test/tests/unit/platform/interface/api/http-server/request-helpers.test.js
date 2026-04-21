import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import test from "node:test";
import { matchRoute, normalizeHeaders, readIncomingBody } from "../../../../../../src/platform/interface/api/http-server/request-helpers.js";
// Helper to create a minimal IncomingMessage-like that works with for-await-of
function createMockIncomingMessage(data) {
    const passthrough = new PassThrough();
    // Make it look like an IncomingMessage
    const mockReq = Object.assign(passthrough, {
        headers: {},
        method: "POST",
        url: "/test",
    });
    // Write data asynchronously after creation
    setImmediate(() => {
        if (data !== null) {
            passthrough.write(data, () => {
                passthrough.end();
            });
        }
        else {
            passthrough.end();
        }
    });
    return mockReq;
}
test("matchRoute parses GET request", () => {
    const request = {
        method: "GET",
        url: "/api/tasks/123",
        headers: {},
        body: null,
    };
    const match = matchRoute(request);
    assert.ok(match !== null);
    assert.equal(match.pathname, "/api/tasks/123");
    assert.deepEqual(match.segments, ["api", "tasks", "123"]);
});
test("matchRoute parses POST request", () => {
    const request = {
        method: "POST",
        url: "/api/tasks",
        headers: {},
        body: '{"data":"test"}',
    };
    const match = matchRoute(request);
    assert.ok(match !== null);
    assert.equal(match.pathname, "/api/tasks");
    assert.deepEqual(match.segments, ["api", "tasks"]);
});
test("matchRoute returns null for non-GET/POST methods", () => {
    const request = {
        method: "PUT",
        url: "/api/tasks/123",
        headers: {},
        body: null,
    };
    const match = matchRoute(request);
    assert.equal(match, null);
});
test("matchRoute returns null for DELETE method", () => {
    const request = {
        method: "DELETE",
        url: "/api/tasks/123",
        headers: {},
        body: null,
    };
    const match = matchRoute(request);
    assert.equal(match, null);
});
test("matchRoute defaults to GET when method is undefined", () => {
    const request = {
        method: undefined,
        url: "/api/health",
        headers: {},
        body: null,
    };
    const match = matchRoute(request);
    assert.ok(match !== null);
    assert.equal(match.pathname, "/api/health");
});
test("matchRoute handles root path", () => {
    const request = {
        method: "GET",
        url: "/",
        headers: {},
        body: null,
    };
    const match = matchRoute(request);
    assert.ok(match !== null);
    assert.equal(match.pathname, "/");
    assert.deepEqual(match.segments, []);
});
test("matchRoute handles path with query string", () => {
    const request = {
        method: "GET",
        url: "/api/tasks?status=pending&limit=10",
        headers: {},
        body: null,
    };
    const match = matchRoute(request);
    assert.ok(match !== null);
    assert.equal(match.pathname, "/api/tasks");
    assert.deepEqual(match.segments, ["api", "tasks"]);
});
test("matchRoute handles empty segments", () => {
    const request = {
        method: "GET",
        url: "///api///tasks///",
        headers: {},
        body: null,
    };
    const match = matchRoute(request);
    assert.ok(match !== null);
    assert.deepEqual(match.segments, ["api", "tasks"]);
});
test("normalizeHeaders converts header keys to lowercase", () => {
    const headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer token123",
        "X-Request-Id": "req_456",
    };
    const normalized = normalizeHeaders(headers);
    assert.equal(normalized["content-type"], "application/json");
    assert.equal(normalized["authorization"], "Bearer token123");
    assert.equal(normalized["x-request-id"], "req_456");
});
test("normalizeHeaders joins array values with comma", () => {
    const headers = {
        "Accept": ["application/json", "text/plain"],
        "X-Custom": "single",
    };
    const normalized = normalizeHeaders(headers);
    assert.equal(normalized["accept"], "application/json, text/plain");
    assert.equal(normalized["x-custom"], "single");
});
test("normalizeHeaders returns empty object for undefined input", () => {
    const normalized = normalizeHeaders(undefined);
    assert.deepEqual(normalized, {});
});
test("normalizeHeaders returns empty object for null input", () => {
    const normalized = normalizeHeaders(null);
    assert.deepEqual(normalized, {});
});
test("normalizeHeaders skips undefined values", () => {
    const headers = {
        "Content-Type": "application/json",
        "Authorization": undefined,
    };
    const normalized = normalizeHeaders(headers);
    assert.equal(normalized["content-type"], "application/json");
    assert.equal(normalized["authorization"], undefined);
});
test("readIncomingBody throws api.payload_too_large when body exceeds 1MB", async () => {
    // Create a payload larger than 1MB (1,048,576 bytes)
    const largeData = Buffer.alloc(1_100_000, "x");
    const mockReq = createMockIncomingMessage(largeData);
    await assert.rejects(() => readIncomingBody(mockReq), (error) => error?.code === "api.payload_too_large"
        && error?.statusCode === 413
        && error?.message.includes("exceeds 1 MB"));
});
test("readIncomingBody accepts body at exactly 1MB", async () => {
    // Create a payload exactly at 1MB boundary
    const exactData = Buffer.alloc(1_048_576, "y");
    const mockReq = createMockIncomingMessage(exactData);
    const result = await readIncomingBody(mockReq);
    assert.equal(result?.length, 1_048_576);
});
test("readIncomingBody returns null for empty body", async () => {
    const mockReq = createMockIncomingMessage(null);
    const result = await readIncomingBody(mockReq);
    assert.equal(result, null);
});
test("readIncomingBody reads normal-sized body correctly", async () => {
    const data = Buffer.from("hello world");
    const mockReq = createMockIncomingMessage(data);
    const result = await readIncomingBody(mockReq);
    assert.equal(result, "hello world");
});
//# sourceMappingURL=request-helpers.test.js.map