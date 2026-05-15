import assert from "node:assert/strict";
import test from "node:test";

import {
  encodeOpaqueCursor,
  decodeOpaqueCursor,
} from "../../../../../../src/platform/five-plane-interface/api/http-server/utils.js";

test("encodeOpaqueCursor encodes empty object to base64url", () => {
  const encoded = encodeOpaqueCursor({});
  assert.ok(typeof encoded === "string");
  assert.ok(encoded.length > 0);
  // Should be valid base64url (no + or /)
  assert.ok(!encoded.includes("+"));
  assert.ok(!encoded.includes("/"));
  assert.ok(!encoded.includes("="));
});

test("encodeOpaqueCursor encodes object with data", () => {
  const encoded = encodeOpaqueCursor({ key: "value", num: 123 });
  assert.ok(typeof encoded === "string");
  assert.ok(encoded.length > 0);
});

test("decodeOpaqueCursor decodes encoded cursor", () => {
  const original = { taskId: "task_abc", index: 5 };
  const encoded = encodeOpaqueCursor(original);
  const decoded = decodeOpaqueCursor<typeof original>(encoded);
  assert.deepEqual(decoded, original);
});

test("decodeOpaqueCursor decodes empty object cursor", () => {
  const encoded = encodeOpaqueCursor({});
  const decoded = decodeOpaqueCursor<Record<string, never>>(encoded);
  assert.deepEqual(decoded, {});
});

test("decodeOpaqueCursor decodes cursor with multiple fields", () => {
  const original = {
    taskId: "task_123",
    status: "pending",
    limit: 20,
    timestamp: "2026-04-23T00:00:00.000Z",
  };
  const encoded = encodeOpaqueCursor(original);
  const decoded = decodeOpaqueCursor<typeof original>(encoded);
  assert.deepEqual(decoded, original);
});

test("decodeOpaqueCursor accepts custom error code", () => {
  const encoded = encodeOpaqueCursor({ key: "value" });
  const decoded = decodeOpaqueCursor<{ key: string }>(encoded, "custom.error_code");
  assert.deepEqual(decoded, { key: "value" });
});

test("decodeOpaqueCursor throws ApiError for invalid base64", () => {
  try {
    decodeOpaqueCursor("not-valid-base64!!!");
    assert.fail("Expected error");
  } catch (error: any) {
    assert.ok(error.code?.includes("api.invalid_cursor") || error.code?.includes("cursor is invalid"));
  }
});

test("decodeOpaqueCursor throws ApiError for invalid JSON", () => {
  // Create a valid base64url string that decodes to invalid JSON
  const invalidJson = Buffer.from("this is not json", "utf8").toString("base64url");
  try {
    decodeOpaqueCursor(invalidJson);
    assert.fail("Expected error");
  } catch (error: any) {
    assert.ok(error.code?.includes("api.invalid_cursor") || error.code?.includes("cursor is invalid"));
  }
});

test("decodeOpaqueCursor uses custom error code on failure", () => {
  const invalidJson = Buffer.from("not json", "utf8").toString("base64url");
  try {
    decodeOpaqueCursor(invalidJson, "my.custom_code");
    assert.fail("Expected error");
  } catch (error: any) {
    assert.ok(error.code?.includes("my.custom_code"));
  }
});

test("encodeOpaqueCursor is reversible for nested objects", () => {
  const original = {
    user: {
      name: "Alice",
      roles: ["admin", "viewer"],
    },
    tasks: ["task_1", "task_2", "task_3"],
    meta: {
      nested: {
        deep: {
          value: 42,
        },
      },
    },
  };
  const encoded = encodeOpaqueCursor(original);
  const decoded = decodeOpaqueCursor<typeof original>(encoded);
  assert.deepEqual(decoded, original);
});

test("encodeOpaqueCursor handles special characters", () => {
  const original = {
    query: "hello world & friends",
    filter: "status='active'",
  };
  const encoded = encodeOpaqueCursor(original);
  const decoded = decodeOpaqueCursor<typeof original>(encoded);
  assert.deepEqual(decoded, original);
});
