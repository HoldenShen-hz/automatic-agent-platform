import assert from "node:assert/strict";
import test from "node:test";
import { stableHash, shortHash, buildCacheKey } from "../../../../../src/platform/shared/cache/utils/stable-hash.js";
test("stableHash returns consistent hash for same input", () => {
    const input = { key: "value", num: 42 };
    const hash1 = stableHash(input);
    const hash2 = stableHash(input);
    assert.equal(hash1, hash2);
    assert.equal(hash1.length, 64); // SHA-256 hex is 64 chars
});
test("stableHash returns different hash for different input", () => {
    const hash1 = stableHash({ a: 1 });
    const hash2 = stableHash({ b: 1 });
    assert.notEqual(hash1, hash2);
});
test("stableHash handles string input", () => {
    const hash1 = stableHash("hello");
    const hash2 = stableHash("hello");
    assert.equal(hash1, hash2);
});
test("stableHash handles number input", () => {
    const hash1 = stableHash(42);
    const hash2 = stableHash(42);
    assert.equal(hash1, hash2);
    assert.notEqual(stableHash(42), stableHash(43));
});
test("stableHash handles array input", () => {
    const hash1 = stableHash([1, 2, 3]);
    const hash2 = stableHash([1, 2, 3]);
    assert.equal(hash1, hash2);
    assert.notEqual(stableHash([1, 2, 3]), stableHash([1, 2, 4]));
});
test("stableHash handles null and undefined", () => {
    assert.equal(stableHash(null), stableHash(null));
    assert.equal(stableHash(undefined), stableHash(undefined));
    assert.notEqual(stableHash(null), stableHash(undefined));
});
test("stableHash is stable across calls (key property order doesn't matter)", () => {
    const hash1 = stableHash({ b: 2, a: 1 });
    const hash2 = stableHash({ a: 1, b: 2 });
    assert.equal(hash1, hash2);
});
test("shortHash returns first 16 characters of stableHash", () => {
    const input = { test: "value" };
    const full = stableHash(input);
    const short = shortHash(input);
    assert.equal(short, full.slice(0, 16));
    assert.equal(short.length, 16);
});
test("shortHash is also stable", () => {
    const hash1 = shortHash({ a: 1 });
    const hash2 = shortHash({ a: 1 });
    assert.equal(hash1, hash2);
});
test("buildCacheKey creates correct format", () => {
    const key = buildCacheKey("test.ns", "v1", { path: "/file" });
    assert.equal(key.startsWith("test.ns:v1:"), true);
    assert.equal(key.split(":").length, 3);
});
test("buildCacheKey produces different keys for different namespaces", () => {
    const key1 = buildCacheKey("ns1", "v1", { path: "/file" });
    const key2 = buildCacheKey("ns2", "v1", { path: "/file" });
    assert.notEqual(key1, key2);
});
test("buildCacheKey produces different keys for different versions", () => {
    const key1 = buildCacheKey("ns", "v1", { path: "/file" });
    const key2 = buildCacheKey("ns", "v2", { path: "/file" });
    assert.notEqual(key1, key2);
});
test("buildCacheKey produces same key for same input", () => {
    const key1 = buildCacheKey("ns", "v1", { path: "/file" });
    const key2 = buildCacheKey("ns", "v1", { path: "/file" });
    assert.equal(key1, key2);
});
test("stableHash handles empty object", () => {
    const hash1 = stableHash({});
    const hash2 = stableHash({});
    assert.equal(hash1, hash2);
    assert.equal(hash1.length, 64);
});
test("stableHash handles nested objects", () => {
    const obj1 = { outer: { inner: { value: 42 } } };
    const obj2 = { outer: { inner: { value: 42 } } };
    assert.equal(stableHash(obj1), stableHash(obj2));
    assert.notEqual(stableHash(obj1), stableHash({ outer: { inner: { value: 43 } } }));
});
test("stableHash handles boolean values", () => {
    assert.equal(stableHash(true), stableHash(true));
    assert.notEqual(stableHash(true), stableHash(false));
});
//# sourceMappingURL=stable-hash.test.js.map