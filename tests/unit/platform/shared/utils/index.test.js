import assert from "node:assert/strict";
import test from "node:test";
// Re-export test for barrel file
import { BoundedCache } from "../../../../../src/platform/shared/utils/index.js";
test("BoundedCache can be instantiated with default capacity", () => {
    const cache = new BoundedCache();
    assert.ok(cache instanceof BoundedCache);
});
test("BoundedCache can be instantiated with custom capacity", () => {
    const cache = new BoundedCache(50);
    assert.ok(cache instanceof BoundedCache);
});
test("BoundedCache.set and get work correctly", () => {
    const cache = new BoundedCache(3);
    cache.set("a", 1);
    cache.set("b", 2);
    assert.equal(cache.get("a"), 1);
    assert.equal(cache.get("b"), 2);
});
test("BoundedCache.evict removes oldest entry when at capacity", () => {
    const cache = new BoundedCache(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3); // Should evict "a"
    assert.equal(cache.get("a"), undefined);
    assert.equal(cache.get("b"), 2);
    assert.equal(cache.get("c"), 3);
});
test("BoundedCache.delete removes entry", () => {
    const cache = new BoundedCache(3);
    cache.set("a", 1);
    cache.delete("a");
    assert.equal(cache.get("a"), undefined);
});
test("BoundedCache.clear removes all entries", () => {
    const cache = new BoundedCache(3);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.clear();
    assert.equal(cache.size, 0);
});
test("BoundedCache.size returns correct count", () => {
    const cache = new BoundedCache(5);
    cache.set("a", 1);
    cache.set("b", 2);
    assert.equal(cache.size, 2);
});
//# sourceMappingURL=index.test.js.map