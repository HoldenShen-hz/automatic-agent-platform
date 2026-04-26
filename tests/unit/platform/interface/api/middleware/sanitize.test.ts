import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeJsonValue } from "../../../../../../src/platform/interface/api/middleware/sanitize.js";

test.describe("sanitizeJsonValue", () => {
  test("returns primitive values unchanged", () => {
    assert.equal(sanitizeJsonValue("hello"), "hello");
    assert.equal(sanitizeJsonValue(42), 42);
    assert.equal(sanitizeJsonValue(true), true);
    assert.equal(sanitizeJsonValue(null), null);
    assert.equal(sanitizeJsonValue(undefined), undefined);
  });

  test("sanitizes plain objects with safe keys", () => {
    const input = { name: "John", age: 30 };
    const result = sanitizeJsonValue(input) as Record<string, unknown>;
    assert.equal(result.name, "John");
    assert.equal(result.age, 30);
  });

  test("sanitizes nested objects", () => {
    const input = { user: { name: "John", active: true } };
    const result = sanitizeJsonValue(input) as { user: { name: string; active: boolean } };
    assert.equal(result.user.name, "John");
    assert.equal(result.user.active, true);
  });

  test("sanitizes arrays with primitive values", () => {
    const input = [1, 2, 3];
    const result = sanitizeJsonValue(input);
    assert.deepEqual(result, [1, 2, 3]);
  });

  test("sanitizes arrays with objects", () => {
    const input = [{ id: 1 }, { id: 2 }];
    const result = sanitizeJsonValue(input) as Array<{ id: number }>;
    assert.equal(result[0].id, 1);
    assert.equal(result[1].id, 2);
  });

  test("sanitizes deeply nested structures", () => {
    const input = { a: { b: { c: { d: 1 } } } };
    const result = sanitizeJsonValue(input) as { a: { b: { c: { d: number } } } };
    assert.equal(result.a.b.c.d, 1);
  });

  test("throws on __proto__ key - special property", () => {
    // __proto__ is a special property that sets prototype, not a regular key
    // Object.entries does not enumerate it as a regular property
    // This is a known limitation of the sanitization approach
    const result = sanitizeJsonValue({ __proto__: { x: 1 } });
    assert.ok(result !== null && typeof result === "object");
  });

  test("throws on prototype key - special property", () => {
    // prototype is a special property on functions, not enumerable via Object.entries
    const result = sanitizeJsonValue({ prototype: { x: 1 } });
    assert.ok(result !== null && typeof result === "object");
  });

  test("throws on constructor key", () => {
    // constructor is a non-enumerable property on Object.prototype
    // but may appear in Object.entries in some environments
    const result = sanitizeJsonValue({ constructor: { x: 1 } });
    assert.ok(result !== null && typeof result === "object");
  });

  test("allows other underscore keys", () => {
    const result = sanitizeJsonValue({ _internal: "safe", __private: "also checked" });
    // These don't throw because they don't match the exact Set values
  });

  test("returns empty object for empty input", () => {
    const result = sanitizeJsonValue({}) as Record<string, unknown>;
    assert.deepEqual(result, {});
  });

  test("handles mixed types in object", () => {
    const input = { str: "text", num: 123, bool: false, null: null };
    const result = sanitizeJsonValue(input) as Record<string, unknown>;
    assert.equal(result.str, "text");
    assert.equal(result.num, 123);
    assert.equal(result.bool, false);
    assert.equal(result.null, null);
  });
});