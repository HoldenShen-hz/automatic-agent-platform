import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  readRequestId,
  readLimit,
  readCursor,
  validateTaskId,
  buildJsonResponse,
  buildJsonErrorResponse,
  encodeOpaqueCursor,
  decodeOpaqueCursor,
  normalizeSegments,
  matchNormalizedSegments,
  readQueryParam,
  requirePrincipal,
} from "../../../../src/platform/five-plane-interface/api/http-server/utils.js";
import type { ApiRequestLike } from "../../../../src/platform/five-plane-interface/api/http-server/types.js";

function makeRequest(overrides: Partial<ApiRequestLike> = {}): ApiRequestLike {
  return {
    method: "GET",
    url: "/",
    headers: {},
    body: null,
    ...overrides,
  };
}

test("readRequestId uses x-request-id header when present", () => {
  const request = makeRequest({
    headers: { "x-request-id": "custom_id_123" },
  });
  const result = readRequestId(request);
  assert.equal(result, "custom_id_123");
});

test("readRequestId generates UUID when no header", () => {
  const request = makeRequest({ headers: {} });
  const result = readRequestId(request);
  assert.match(result, /^req_[0-9a-f-]{36}$/);
});

test("readRequestId trims whitespace from header value", () => {
  const request = makeRequest({
    headers: { "x-request-id": "  trimmed_id  " },
  });
  const result = readRequestId(request);
  assert.equal(result, "trimmed_id");
});

test("readLimit returns fallback when no limit param", () => {
  const request = makeRequest({ url: "/api/v1/tasks" });
  const result = readLimit(request, 25);
  assert.equal(result, 25);
});

test("readLimit parses valid limit param", () => {
  const request = makeRequest({ url: "/api/v1/tasks?limit=50" });
  const result = readLimit(request, 25);
  assert.equal(result, 50);
});

test("readLimit clamps to max 200", () => {
  const request = makeRequest({ url: "/api/v1/tasks?limit=500" });
  const result = readLimit(request, 25);
  assert.equal(result, 200);
});

test("readLimit throws for limit=0", () => {
  const request = makeRequest({ url: "/api/v1/tasks?limit=0" });
  assert.throws(
    () => readLimit(request, 25),
    /limit must be a positive integer/,
  );
});

test("readLimit throws for non-numeric limit", () => {
  const request = makeRequest({ url: "/api/v1/tasks?limit=abc" });
  assert.throws(
    () => readLimit(request, 25),
    /limit must be a positive integer/,
  );
});

test("readLimit throws for negative limit", () => {
  const request = makeRequest({ url: "/api/v1/tasks?limit=-5" });
  assert.throws(
    () => readLimit(request, 25),
    /limit must be a positive integer/,
  );
});

test("readCursor returns undefined when no cursor param", () => {
  const request = makeRequest({ url: "/api/v1/tasks" });
  const result = readCursor(request);
  assert.equal(result, undefined);
});

test("readCursor returns cursor value when present", () => {
  const request = makeRequest({ url: "/api/v1/tasks?cursor=abc123xyz" });
  const result = readCursor(request);
  assert.equal(result, "abc123xyz");
});

test("validateTaskId accepts valid task ID", () => {
  const validIds = [
    "task_abc123",
    "task-xyz-456",
    "TaskABC123",
    "task_id_789",
    "a",
    "task_with_underscores_and_dashes",
  ];
  for (const id of validIds) {
    assert.equal(validateTaskId(id, "test"), id, `should accept ${id}`);
  }
});

test("validateTaskId rejects empty string", () => {
  assert.throws(
    () => validateTaskId("", "test"),
    /requires taskId/,
  );
});

test("validateTaskId rejects undefined", () => {
  assert.throws(
    () => validateTaskId(undefined, "test"),
    /requires taskId/,
  );
});

test("validateTaskId rejects task ID over 128 chars", () => {
  const longId = "a".repeat(129);
  assert.throws(
    () => validateTaskId(longId, "test"),
    /taskId exceeds maximum length/,
  );
});

test("validateTaskId rejects invalid characters", () => {
  const invalidIds = ["task@abc", "task#123", "task.abc", "task abc", "task/abc"];
  for (const id of invalidIds) {
    assert.throws(
      () => validateTaskId(id, "test"),
      /taskId contains invalid characters/,
      `should reject ${id}`,
    );
  }
});

test("buildJsonResponse creates correct structure", () => {
  const result = buildJsonResponse("req_123", 200, { tasks: ["a", "b"] });
  assert.equal(result.statusCode, 200);
  assert.ok(result.headers["content-type"]?.includes("application/json"));
  assert.ok(result.headers["x-request-id"], "req_123");
  assert.equal(result.headers["x-trace-id"], "req_123");
  const body = JSON.parse(result.body);
  assert.equal(body.requestId, "req_123");
  assert.deepEqual(body.data, { tasks: ["a", "b"] });
});

test("buildJsonErrorResponse creates correct error structure", () => {
  const result = buildJsonErrorResponse("req_123", 404, {
    code: "api.not_found",
    message: "Resource not found",
  });
  assert.equal(result.statusCode, 404);
  assert.ok(result.headers["content-type"]?.includes("application/json"));
  assert.equal(result.headers["x-trace-id"], "req_123");
  const body = JSON.parse(result.body);
  assert.equal(body.requestId, "req_123");
  assert.equal(body.error.code, "api.not_found");
  assert.equal(body.error.message, "Resource not found");
});

test("encodeOpaqueCursor and decodeOpaqueCursor roundtrip", () => {
  const original = { updatedAt: "2024-01-15T10:30:00Z", taskId: "task_abc123" };
  const encoded = encodeOpaqueCursor(original);
  assert.ok(typeof encoded === "string");
  const decoded = decodeOpaqueCursor<typeof original>(encoded);
  assert.deepEqual(decoded, original);
});

test("decodeOpaqueCursor throws for invalid base64", () => {
  assert.throws(
    () => decodeOpaqueCursor("not-valid-base64!!!"),
    /cursor is invalid/,
  );
});

test("decodeOpaqueCursor throws for invalid JSON", () => {
  const invalidJson = Buffer.from("not json", "utf8").toString("base64url");
  assert.throws(
    () => decodeOpaqueCursor(invalidJson),
    /cursor is invalid/,
  );
});

test("normalizeSegments strips leading v1", () => {
  assert.deepEqual(normalizeSegments(["v1", "tasks"]), ["tasks"]);
  assert.deepEqual(normalizeSegments(["v1", "tasks", "abc"]), ["tasks", "abc"]);
  assert.deepEqual(normalizeSegments(["v1"]), []);
});

test("normalizeSegments returns same array if no v1 prefix", () => {
  assert.deepEqual(normalizeSegments(["tasks"]), ["tasks"]);
  assert.deepEqual(normalizeSegments(["tasks", "abc"]), ["tasks", "abc"]);
  assert.deepEqual(normalizeSegments([]), []);
});

test("matchNormalizedSegments matches simple path", () => {
  const result = matchNormalizedSegments(["v1", "tasks"], ["tasks"]);
  assert.deepEqual(result, ["tasks"]);
});

test("matchNormalizedSegments returns null on length mismatch", () => {
  const result = matchNormalizedSegments(["v1", "tasks", "abc"], ["tasks"], 3, 3);
  assert.equal(result, null);
});

test("matchNormalizedSegments handles parameter placeholders", () => {
  const result = matchNormalizedSegments(["v1", "tasks", "abc123"], ["tasks", ":id"]);
  assert.deepEqual(result, ["tasks", "abc123"]);
});

test("matchNormalizedSegments with custom min/max lengths", () => {
  const result = matchNormalizedSegments(["tasks"], ["tasks", ":id"], 2, 2);
  assert.equal(result, null);
  const result2 = matchNormalizedSegments(["tasks", "abc"], ["tasks", ":id"], 2, 2);
  assert.deepEqual(result2, ["tasks", "abc"]);
});

test("readQueryParam extracts query param", () => {
  const request = makeRequest({ url: "/api/v1/tasks?status=pending" });
  const result = readQueryParam(request, "status");
  assert.equal(result, "pending");
});

test("readQueryParam returns undefined for missing param", () => {
  const request = makeRequest({ url: "/api/v1/tasks" });
  const result = readQueryParam(request, "status");
  assert.equal(result, undefined);
});

test("readQueryParam trims whitespace", () => {
  const request = makeRequest({ url: "/api/v1/tasks?title=  hello  " });
  const result = readQueryParam(request, "title");
  assert.equal(result, "hello");
});

test("readQueryParam respects maxLength option", () => {
  const request = makeRequest({ url: "/api/v1/tasks?name=abc" });
  // "abc" is 3 chars, maxLength is 2, so it should throw
  assert.throws(
    () => readQueryParam(request, "name", { maxLength: 2 }),
    /name exceeds maximum length/,
  );
});

test("readQueryParam respects trim: false option", () => {
  const request = makeRequest({ url: "/api/v1/tasks?code=%20%20ABC%20%20" });
  const result = readQueryParam(request, "code", { trim: false });
  // URL decoded value is "  ABC  " with leading/trailing spaces preserved
  assert.equal(result, "  ABC  ");
});

test("readQueryParam returns undefined for empty string when not required", () => {
  const request = makeRequest({ url: "/api/v1/tasks?name=" });
  const result = readQueryParam(request, "name");
  assert.equal(result, undefined);
});

test("requirePrincipal throws ApiError when authService is null", () => {
  const request = makeRequest();
  assert.throws(
    () => requirePrincipal(request, null, "operator"),
    /This endpoint requires authentication to be configured/,
  );
});

test("normalizeSegments with mixed v1/non-v1 paths", () => {
  assert.deepEqual(normalizeSegments(["v1", "divisions", "abc"]), ["divisions", "abc"]);
  assert.deepEqual(normalizeSegments(["v1", "tasks", "abc", "events"]), ["tasks", "abc", "events"]);
});

test("buildJsonResponse handles nested data", () => {
  const result = buildJsonResponse("req_456", 201, {
    task: { id: "task_123", title: "Test", nested: { deep: { value: 1 } } },
  });
  const body = JSON.parse(result.body);
  assert.equal(body.data.task.nested.deep.value, 1);
});
