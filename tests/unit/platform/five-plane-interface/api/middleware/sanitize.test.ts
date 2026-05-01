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

test("sanitizeJsonValue converts __proto__ to normal key in null-prototype object", () => {
  const input = { "__proto__": { admin: true }, normalKey: "value" };
  const result = sanitizeJsonValue(input) as Record<string, unknown>;
  // The result is a null-prototype object, so __proto__ is just a string key
  assert.equal((result["__proto__"] as Record<string, unknown>)?.admin, true);
  assert.equal(result.normalKey, "value");
  // The result has null prototype, so __proto__ doesn't pollute
  assert.equal(Object.getPrototypeOf(result), null);
});

test("sanitizeJsonValue converts prototype to normal key in null-prototype object", () => {
  const input = { prototype: { fn: "test" } };
  const result = sanitizeJsonValue(input) as Record<string, unknown>;
  assert.equal((result.prototype as Record<string, unknown>)?.fn, "test");
  assert.equal(Object.getPrototypeOf(result), null);
});

test("sanitizeJsonValue converts constructor to normal key in null-prototype object", () => {
  const input = { constructor: { name: "MyConstructor" } };
  const result = sanitizeJsonValue(input) as Record<string, unknown>;
  assert.equal((result.constructor as Record<string, unknown>)?.name, "MyConstructor");
  assert.equal(Object.getPrototypeOf(result), null);
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