import assert from "node:assert/strict";
import test from "node:test";
import { CacheNormalizer } from "../../../../../src/platform/shared/cache/cache-normalizer.js";
test("CacheNormalizer normalizes empty args", () => {
    const normalizer = new CacheNormalizer();
    const result = normalizer.normalizeToolArgs({});
    assert.deepEqual(result, {});
});
test("CacheNormalizer removes undefined values", () => {
    const normalizer = new CacheNormalizer();
    const result = normalizer.normalizeToolArgs({ a: "value", b: undefined });
    assert.deepEqual(result, { a: "value" });
});
test("CacheNormalizer sorts keys alphabetically", () => {
    const normalizer = new CacheNormalizer();
    const result = normalizer.normalizeToolArgs({ z: 1, a: 2, m: 3 });
    const keys = Object.keys(result);
    assert.deepEqual(keys, ["a", "m", "z"]);
});
test("CacheNormalizer preserves string values", () => {
    const normalizer = new CacheNormalizer();
    const result = normalizer.normalizeToolArgs({ key: "value" });
    assert.equal(result.key, "value");
});
test("CacheNormalizer preserves number values", () => {
    const normalizer = new CacheNormalizer();
    const result = normalizer.normalizeToolArgs({ num: 42, float: 3.14 });
    assert.equal(result.num, 42);
    assert.equal(result.float, 3.14);
});
test("CacheNormalizer preserves boolean values", () => {
    const normalizer = new CacheNormalizer();
    const result = normalizer.normalizeToolArgs({ flag: true, other: false });
    assert.equal(result.flag, true);
    assert.equal(result.other, false);
});
test("CacheNormalizer normalizes nested objects", () => {
    const normalizer = new CacheNormalizer();
    const result = normalizer.normalizeToolArgs({ outer: { z: 1, a: 2 } });
    assert.deepEqual(result.outer, { a: 2, z: 1 });
});
test("CacheNormalizer normalizes arrays", () => {
    const normalizer = new CacheNormalizer();
    const result = normalizer.normalizeToolArgs({ arr: [3, 1, 2] });
    assert.deepEqual(result.arr, [3, 1, 2]);
});
test("CacheNormalizer removes undefined in nested objects", () => {
    const normalizer = new CacheNormalizer();
    const result = normalizer.normalizeToolArgs({ obj: { a: 1, b: undefined } });
    assert.deepEqual(result.obj, { a: 1 });
});
test("CacheNormalizer handles complex values", () => {
    const normalizer = new CacheNormalizer();
    const result = normalizer.normalizeToolArgs({ fn: (() => { }) });
    assert.equal(result.fn, "[ComplexValue]");
});
test("CacheNormalizer handles mixed types", () => {
    const normalizer = new CacheNormalizer();
    const result = normalizer.normalizeToolArgs({
        str: "hello",
        num: 123,
        bool: true,
        nil: null, // null is normalized to undefined
        arr: [1, 2],
        obj: { a: 1 },
    });
    assert.equal(result.str, "hello");
    assert.equal(result.num, 123);
    assert.equal(result.bool, true);
    assert.equal(result.nil, undefined); // null becomes undefined
    assert.deepEqual(result.arr, [1, 2]);
    assert.deepEqual(result.obj, { a: 1 });
});
test("CacheNormalizer.normalizeCacheInput normalizes unknown input", () => {
    const normalizer = new CacheNormalizer();
    const result = normalizer.normalizeCacheInput({ z: 1, a: 2 });
    assert.deepEqual(result, { a: 2, z: 1 });
});
test("CacheNormalizer.normalizeQueryString normalizes query", () => {
    const normalizer = new CacheNormalizer();
    const result = normalizer.normalizeQueryString("  key=value  ");
    assert.equal(result, "key=value");
});
test("CacheNormalizer with caseInsensitive normalizes strings", () => {
    const normalizer = new CacheNormalizer(undefined, true);
    const result = normalizer.normalizeToolArgs({ key: "HELLO" });
    assert.equal(result.key, "hello");
});
test("CacheNormalizer with caseInsensitive preserves numbers", () => {
    const normalizer = new CacheNormalizer(undefined, true);
    const result = normalizer.normalizeToolArgs({ key: "Value", num: 42 });
    assert.equal(result.key, "value");
    assert.equal(result.num, 42);
});
//# sourceMappingURL=cache-normalizer.test.js.map