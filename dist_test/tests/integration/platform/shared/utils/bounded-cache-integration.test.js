import assert from "node:assert/strict";
import test from "node:test";
import { BoundedCache } from "../../../../../src/platform/shared/utils/bounded-cache.js";
test("BoundedCache integration: capacity enforcement under load", () => {
    const cache = new BoundedCache(100);
    // Add 150 items
    for (let i = 0; i < 150; i++) {
        cache.set(`key-${i}`, `value-${i}`);
    }
    // Should have evicted older items
    assert.ok(cache.size <= 100);
    // Recent items should still be accessible
    assert.equal(cache.get("key-149"), "value-149");
    assert.equal(cache.get("key-100"), "value-100");
});
test("BoundedCache integration: FIFO eviction order", () => {
    const cache = new BoundedCache(3);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3");
    // Note: get() does NOT update order - this is FIFO, not LRU
    cache.get("a");
    // Add new item, evicts oldest (FIFO order: a was first)
    cache.set("d", "4");
    assert.equal(cache.get("a"), undefined); // Evicted (oldest in FIFO)
    assert.equal(cache.get("b"), "2");
    assert.equal(cache.get("c"), "3");
    assert.equal(cache.get("d"), "4");
});
test("BoundedCache integration: update existing key doesn't evict", () => {
    const cache = new BoundedCache(2);
    cache.set("a", "1");
    cache.set("b", "2");
    // Update existing key
    cache.set("a", "1-updated");
    // Add new key - should not evict 'a' since it was just updated
    cache.set("c", "3");
    assert.equal(cache.get("a"), "1-updated");
    assert.equal(cache.get("b"), undefined); // Evicted
    assert.equal(cache.get("c"), "3");
});
test("BoundedCache integration: delete removes entry", () => {
    const cache = new BoundedCache(10);
    cache.set("key", "value");
    assert.equal(cache.get("key"), "value");
    cache.delete("key");
    assert.equal(cache.get("key"), undefined);
});
test("BoundedCache integration: clear removes all entries", () => {
    const cache = new BoundedCache(10);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3");
    cache.clear();
    assert.equal(cache.size, 0);
    assert.equal(cache.get("a"), undefined);
});
test("BoundedCache integration: has returns correct status", () => {
    const cache = new BoundedCache(10);
    cache.set("exists", "yes");
    assert.equal(cache.has("exists"), true);
    assert.equal(cache.has("not-exists"), false);
});
test("BoundedCache integration: maxEntries=1 edge case", () => {
    const cache = new BoundedCache(1);
    cache.set("a", "1");
    cache.set("b", "2");
    assert.equal(cache.get("a"), undefined);
    assert.equal(cache.get("b"), "2");
    assert.equal(cache.size, 1);
});
test("BoundedCache integration: keys iterator returns all keys", () => {
    const cache = new BoundedCache(10);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3");
    const keys = Array.from(cache.keys());
    assert.deepEqual(keys.sort(), ["a", "b", "c"]);
});
test("BoundedCache integration: values iterator returns all values", () => {
    const cache = new BoundedCache(10);
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3");
    const values = Array.from(cache.values()).sort();
    assert.deepEqual(values, ["1", "2", "3"]);
});
test("BoundedCache integration: entries iterator returns key-value pairs", () => {
    const cache = new BoundedCache(10);
    cache.set("a", "1");
    cache.set("b", "2");
    const entries = Array.from(cache.entries())
        .map(([k, v]) => `${k}:${v}`)
        .sort();
    assert.deepEqual(entries, ["a:1", "b:2"]);
});
test("BoundedCache integration: multiple updates to same key", () => {
    const cache = new BoundedCache(3);
    for (let i = 0; i < 10; i++) {
        cache.set("same-key", `value-${i}`);
    }
    assert.equal(cache.get("same-key"), "value-9");
    assert.equal(cache.size, 1);
});
//# sourceMappingURL=bounded-cache-integration.test.js.map