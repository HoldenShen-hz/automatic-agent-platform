import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeJsonValue } from "../../../../../../src/platform/interface/api/middleware/sanitize.js";

test("sanitizeJsonValue returns primitives unchanged", () => {
  assert.equal(sanitizeJsonValue("hello"), "hello");
  assert.equal(sanitizeJsonValue(42), 42);
  assert.equal(sanitizeJsonValue(true), true);
  assert.equal(sanitizeJsonValue(null), null);
});

test("sanitizeJsonValue returns plain objects with null prototype", () => {
  const obj = { key: "value", num: 123 };
  const result = sanitizeJsonValue(obj) as Record<string, unknown>;
  assert.equal(result.key, "value");
  assert.equal(result.num, 123);
  assert.ok(Object.getPrototypeOf(result) === null);
});

test("sanitizeJsonValue recursively sanitizes arrays", () => {
  const result = sanitizeJsonValue([
    { key: "first" },
    { key: "second" },
  ]) as unknown[];
  assert.equal((result[0] as Record<string, unknown>).key, "first");
  assert.equal((result[1] as Record<string, unknown>).key, "second");
  assert.ok(Object.getPrototypeOf(result[0]) === null);
});

test("sanitizeJsonValue throws on prototype key", () => {
  assert.throws(
    () => sanitizeJsonValue({ prototype: "evil" }),
    (err: any) => err.code === "api.invalid_json_key"
  );
});

test("sanitizeJsonValue throws on constructor key", () => {
  assert.throws(
    () => sanitizeJsonValue({ constructor: {} }),
    (err: any) => err.code === "api.invalid_json_key"
  );
});

test("sanitizeJsonValue allows safe keys", () => {
  const result = sanitizeJsonValue({
    normalKey: "allowed",
    anotherKey: 123,
    nested: { deeper: true },
  }) as Record<string, unknown>;
  assert.equal(result.normalKey, "allowed");
  assert.equal(result.anotherKey, 123);
  const nested = result.nested as Record<string, unknown>;
  assert.equal(nested.deeper, true);
  assert.ok(Object.getPrototypeOf(result) === null);
});

test("sanitizeJsonValue creates plain object with null prototype", () => {
  const result = sanitizeJsonValue({ key: "value" });
  assert.ok(Object.getPrototypeOf(result) === null || Object.getPrototypeOf(result) === Object.prototype);
});
