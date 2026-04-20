import assert from "node:assert/strict";
import test from "node:test";

import { stableStringify, stableEquals } from "../../../../../src/platform/shared/cache/utils/stable-stringify.js";

test("stableStringify handles null", () => {
  assert.equal(stableStringify(null), "null");
});

test("stableStringify handles undefined", () => {
  assert.equal(stableStringify(undefined), "undefined");
});

test("stableStringify handles boolean", () => {
  assert.equal(stableStringify(true), "true");
  assert.equal(stableStringify(false), "false");
});

test("stableStringify handles numbers", () => {
  assert.equal(stableStringify(0), "0");
  assert.equal(stableStringify(42), "42");
  assert.equal(stableStringify(-3.14), "-3.14");
});

test("stableStringify handles strings", () => {
  assert.equal(stableStringify("hello"), '"hello"');
});

test("stableStringify handles bigint", () => {
  assert.equal(stableStringify(BigInt(42)), "42");
});

test("stableStringify handles symbols as string", () => {
  const sym = Symbol("test");
  assert.equal(stableStringify(sym), "Symbol(test)");
});

test("stableStringify handles arrays", () => {
  assert.equal(stableStringify([3, 1, 2]), "[3,1,2]");
});

test("stableStringify handles nested arrays", () => {
  assert.equal(stableStringify([[1, 2], [3, 4]]), "[[1,2],[3,4]]");
});

test("stableStringify sorts object keys", () => {
  const result = stableStringify({ z: 1, a: 2, m: 3 });
  assert.equal(result, '{"a":2,"m":3,"z":1}');
});

test("stableStringify handles nested objects with sorted keys", () => {
  const result = stableStringify({ outer: { z: 1, a: 2 } });
  assert.equal(result, '{"outer":{"a":2,"z":1}}');
});

test("stableStringify skips undefined values in objects", () => {
  const result = stableStringify({ a: 1, b: undefined, c: 3 });
  assert.equal(result, '{"a":1,"c":3}');
});

test("stableStringify handles functions as [Function]", () => {
  const fn = () => {};
  assert.equal(stableStringify(fn), '"[Function]"');
});

test("stableStringify produces same output regardless of key order", () => {
  const obj1 = { b: 2, a: 1 };
  const obj2 = { a: 1, b: 2 };
  assert.equal(stableStringify(obj1), stableStringify(obj2));
});

test("stableStringify produces same output for deeply nested structures", () => {
  const obj1 = { level1: { level2: { z: 1, a: 2 } } };
  const obj2 = { level1: { level2: { a: 2, z: 1 } } };
  assert.equal(stableStringify(obj1), stableStringify(obj2));
});

test("stableStringify handles mixed types in array", () => {
  const result = stableStringify([1, "two", true, null]);
  assert.equal(result, '[1,"two",true,null]');
});

test("stableEquals returns true for equal values", () => {
  assert.equal(stableEquals({ a: 1, b: 2 }, { b: 2, a: 1 }), true);
});

test("stableEquals returns false for different values", () => {
  assert.equal(stableEquals({ a: 1 }, { a: 2 }), false);
});

test("stableEquals handles arrays", () => {
  assert.equal(stableEquals([1, 2, 3], [1, 2, 3]), true);
  assert.equal(stableEquals([1, 2, 3], [3, 2, 1]), false);
});

test("stableEquals handles null and undefined", () => {
  assert.equal(stableEquals(null, null), true);
  assert.equal(stableEquals(undefined, undefined), true);
  assert.equal(stableEquals(null, undefined), false);
});

test("stableStringify handles empty object", () => {
  assert.equal(stableStringify({}), "{}");
});

test("stableStringify handles empty array", () => {
  assert.equal(stableStringify([]), "[]");
});
