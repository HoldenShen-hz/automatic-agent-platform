import assert from "node:assert/strict";
import test from "node:test";
import { stableStringify, stableEquals } from "../../../../../../src/platform/shared/cache/utils/stable-stringify.js";
test("stableStringify serializes primitives", () => {
    assert.equal(stableStringify(null), "null");
    assert.equal(stableStringify(true), "true");
    assert.equal(stableStringify(false), "false");
    assert.equal(stableStringify(42), "42");
    assert.equal(stableStringify("hello"), '"hello"');
});
test("stableStringify handles undefined", () => {
    assert.equal(stableStringify(undefined), "undefined");
});
test("stableStringify handles bigint", () => {
    assert.equal(stableStringify(BigInt(123)), "123");
});
test("stableStringify handles symbols", () => {
    const sym = Symbol("test");
    assert.ok(stableStringify(sym).includes("Symbol(test)"));
});
test("stableStringify handles arrays", () => {
    assert.equal(stableStringify([1, 2, 3]), "[1,2,3]");
    assert.equal(stableStringify(["c", "a", "b"]), '["c","a","b"]');
});
test("stableStringify sorts object keys", () => {
    const obj1 = { b: 1, a: 2 };
    const obj2 = { a: 2, b: 1 };
    assert.equal(stableStringify(obj1), stableStringify(obj2));
    assert.equal(stableStringify(obj1), '{"a":2,"b":1}');
});
test("stableStringify handles nested objects", () => {
    const obj = { outer: { c: 1, b: 2, a: 3 } };
    assert.equal(stableStringify(obj), '{"outer":{"a":3,"b":2,"c":1}}');
});
test("stableStringify filters undefined values in objects", () => {
    const obj = { a: 1, b: undefined, c: 3 };
    assert.equal(stableStringify(obj), '{"a":1,"c":3}');
});
test("stableStringify handles functions", () => {
    assert.equal(stableStringify(function myFunc() { }), '"[Function]"');
    assert.equal(stableStringify(() => { }), '"[Function]"');
});
test("stableStringify is deterministic regardless of key order", () => {
    const obj1 = { z: 1, y: 2, x: 3 };
    const obj2 = { x: 3, y: 2, z: 1 };
    const obj3 = { y: 2, z: 1, x: 3 };
    assert.equal(stableStringify(obj1), stableStringify(obj2));
    assert.equal(stableStringify(obj2), stableStringify(obj3));
});
test("stableStringify handles mixed arrays", () => {
    assert.equal(stableStringify([{ b: 2, a: 1 }, { d: 4, c: 3 }]), '[{"a":1,"b":2},{"c":3,"d":4}]');
});
test("stableEquals compares equality", () => {
    assert.equal(stableEquals({ a: 1, b: 2 }, { b: 2, a: 1 }), true);
    assert.equal(stableEquals({ a: 1 }, { a: 2 }), false);
    assert.equal(stableEquals([1, 2, 3], [1, 2, 3]), true);
    assert.equal(stableEquals([1, 2], [1, 2, 3]), false);
    assert.equal(stableEquals(null, null), true);
    assert.equal(stableEquals(null, undefined), false);
});
test("stableEquals handles primitive equality", () => {
    assert.equal(stableEquals(42, 42), true);
    assert.equal(stableEquals("hello", "hello"), true);
    assert.equal(stableEquals(true, true), true);
    assert.equal(stableEquals(42, "42"), false);
});
//# sourceMappingURL=stable-stringify.test.js.map