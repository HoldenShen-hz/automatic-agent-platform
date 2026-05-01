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

test("sanitizeJsonValue returns array with sanitized elements", () => {
  const input = [1, "test", { nested: true }];
  const result = sanitizeJsonValue(input) as unknown[];
  assert.equal(result[0], 1);
  assert.equal(result[1], "test");
  assert.equal((result[2] as Record<string, unknown>).nested, true);
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

test("sanitizeJsonValue creates null-prototype object with normal keys", () => {
  const input = { safeKey: { admin: true }, normalKey: "value" };
  const result = sanitizeJsonValue(input) as Record<string, unknown>;
  // Result is null-prototype
  assert.equal(Object.getPrototypeOf(result), null);
  // The object has keys properly
  assert.ok(Object.keys(result).includes("safeKey"));
  assert.equal(result.normalKey, "value");
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

test("sanitizeJsonValue handles deeply nested but within limit", () => {
  // Depth 10 should work
  let obj: unknown = { value: "deep" };
  for (let i = 0; i < 10; i++) {
    obj = { nested: obj };
  }
  const result = sanitizeJsonValue(obj) as Record<string, unknown>;
  assert.ok(result !== undefined);
});