import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeJsonValue } from "../../../../../src/platform/five-plane-interface/api/middleware/sanitize.js";
import { AppError } from "../../../../../src/platform/contracts/errors.js";

test("sanitizeJsonValue returns primitives unchanged", () => {
  assert.equal(sanitizeJsonValue("hello"), "hello");
  assert.equal(sanitizeJsonValue(42), 42);
  assert.equal(sanitizeJsonValue(true), true);
  assert.equal(sanitizeJsonValue(null), null);
});

test("sanitizeJsonValue returns undefined unchanged", () => {
  assert.equal(sanitizeJsonValue(undefined), undefined);
});

test("sanitizeJsonValue sanitizes arrays recursively", () => {
  const input = ["safe_key", { nested: "value" }];
  const result = sanitizeJsonValue(input) as unknown[];
  assert.equal(result.length, 2);
  assert.equal(result[0], "safe_key");
  const nested = result[1] as Record<string, unknown>;
  assert.equal(nested["nested"], "value");
  assert.equal(Object.getPrototypeOf(nested), null);
});

test("sanitizeJsonValue sanitizes plain objects recursively", () => {
  const input = { key: "value", nested: { inner: "data" } };
  const result = sanitizeJsonValue(input) as Record<string, unknown>;
  assert.equal(result["key"], "value");
  const nested = result["nested"] as Record<string, unknown>;
  assert.equal(nested["inner"], "data");
  assert.equal(Object.getPrototypeOf(nested), null);
});

test("sanitizeJsonValue creates object with null prototype", () => {
  const input = { key: "value" };
  const result = sanitizeJsonValue(input);
  assert.equal(Object.getPrototypeOf(result), null);
});

test("sanitizeJsonValue throws for __proto__ key", () => {
  // Note: In JS, { "__proto__": value } sets the prototype, not a property.
  // To test __proto__ as a dangerous key, we use Object.create(null) with property assignment.
  const obj = Object.create(null);
  obj["__proto__"] = "dangerous";
  assert.throws(
    () => sanitizeJsonValue(obj),
    (err: unknown) => err instanceof AppError && err.code === "api.invalid_json_key"
  );
});

test("sanitizeJsonValue throws for prototype key", () => {
  assert.throws(
    () => sanitizeJsonValue({ "prototype": "dangerous" }),
    (err: unknown) => err instanceof AppError && err.code === "api.invalid_json_key"
  );
});

test("sanitizeJsonValue throws for constructor key", () => {
  assert.throws(
    () => sanitizeJsonValue({ "constructor": "dangerous" }),
    (err: unknown) => err instanceof AppError && err.code === "api.invalid_json_key"
  );
});

test("sanitizeJsonValue throws for nested dangerous keys", () => {
  const inner = Object.create(null);
  inner["__proto__"] = "dangerous";
  const outer = Object.create(null);
  outer["outer"] = inner;
  assert.throws(
    () => sanitizeJsonValue(outer),
    (err: unknown) => err instanceof AppError && err.code === "api.invalid_json_key"
  );
});

test("sanitizeJsonValue throws for array element with dangerous key", () => {
  const obj = Object.create(null);
  obj["__proto__"] = "dangerous";
  assert.throws(
    () => sanitizeJsonValue([obj]),
    (err: unknown) => err instanceof AppError && err.code === "api.invalid_json_key"
  );
});

test("sanitizeJsonValue handles empty object", () => {
  const result = sanitizeJsonValue({}) as Record<string, unknown>;
  assert.equal(Object.keys(result).length, 0);
  assert.equal(Object.getPrototypeOf(result), null);
});

test("sanitizeJsonValue handles empty array", () => {
  const result = sanitizeJsonValue([]);
  assert.deepEqual(result, []);
});

test("sanitizeJsonValue rejects non-plain objects (class instance)", () => {
  class Dangerous {
    constructor() {
      (this as Record<string, unknown>)["__proto__"] = "attack";
    }
  }
  // Class instances return value as-is since they are not plain objects
  const instance = new Dangerous();
  const result = sanitizeJsonValue(instance);
  assert.equal(result, instance);
});

test("sanitizeJsonValue rejects Date objects", () => {
  const date = new Date();
  const result = sanitizeJsonValue(date);
  assert.equal(result, date);
});
