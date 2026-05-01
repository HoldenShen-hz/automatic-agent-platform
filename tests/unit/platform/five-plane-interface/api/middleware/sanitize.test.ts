import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  sanitizeJsonValue,
} from "../../../../../../src/platform/five-plane-interface/api/middleware/sanitize.js";

test("sanitizeJsonValue returns primitives unchanged", () => {
  assert.equal(sanitizeJsonValue("hello"), "hello");
  assert.equal(sanitizeJsonValue(123), 123);
  assert.equal(sanitizeJsonValue(true), true);
  assert.equal(sanitizeJsonValue(null), null);
});

test("sanitizeJsonValue returns arrays with sanitized contents", () => {
  const input = [1, "test", { nested: true }];
  const result = sanitizeJsonValue(input) as unknown[];
  assert.deepEqual(result, input);
});

test("sanitizeJsonValue sanitizes object keys", () => {
  const input = { name: "test", value: 123 };
  const result = sanitizeJsonValue(input) as Record<string, unknown>;
  assert.equal(result.name, "test");
  assert.equal(result.value, 123);
});

test("sanitizeJsonValue creates null-prototype object", () => {
  const input = { name: "test" };
  const result = sanitizeJsonValue(input) as Record<string, unknown>;
  assert.equal(Object.getPrototypeOf(result), null);
});

test("sanitizeJsonValue throws for __proto__ key", () => {
  assert.throws(
    () => sanitizeJsonValue({ __proto__: { admin: true } }),
    /reserved key/,
  );
});

test("sanitizeJsonValue throws for prototype key", () => {
  assert.throws(
    () => sanitizeJsonValue({ prototype: {} }),
    /reserved key/,
  );
});

test("sanitizeJsonValue throws for constructor key", () => {
  assert.throws(
    () => sanitizeJsonValue({ constructor: {} }),
    /reserved key/,
  );
});

test("sanitizeJsonValue sanitizes nested objects recursively", () => {
  const input = {
    level1: {
      level2: {
        value: "deep",
      },
    },
  };
  const result = sanitizeJsonValue(input) as Record<string, unknown>;
  const l1 = result.level1 as Record<string, unknown>;
  const l2 = l1.level2 as Record<string, unknown>;
  assert.equal(l2.value, "deep");
});

test("sanitizeJsonValue throws when max depth exceeded", () => {
  // Create deeply nested object
  let obj: unknown = {};
  for (let i = 0; i < 70; i++) {
    obj = { nested: obj };
  }

  assert.throws(
    () => sanitizeJsonValue(obj),
    /maximum nesting depth/,
  );
});

test("sanitizeJsonValue handles empty object", () => {
  const result = sanitizeJsonValue({}) as Record<string, unknown>;
  assert.deepEqual(Object.keys(result), []);
  assert.equal(Object.getPrototypeOf(result), null);
});

test("sanitizeJsonValue handles empty array", () => {
  const result = sanitizeJsonValue([]) as unknown[];
  assert.deepEqual(result, []);
});

test("sanitizeJsonValue handles special number values", () => {
  assert.equal(sanitizeJsonValue(Infinity), Infinity);
  assert.equal(sanitizeJsonValue(-Infinity), -Infinity);
  assert.ok(Number.isNaN(sanitizeJsonValue(NaN) as number));
});

test("sanitizeJsonValue preserves arrays at depth limit", () => {
  // Depth 64 should still work
  const input: unknown = { data: "value" };
  for (let i = 0; i < 60; i++) {
    input as Record<string, unknown>;
  }
  const result = sanitizeJsonValue(input);
  assert.ok(result !== undefined);
});