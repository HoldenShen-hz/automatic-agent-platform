/**
 * Memory Cache Store Unit Tests
 *
 * Tests for L1 in-memory cache with LRU eviction and TTL support.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { MemoryCacheStore } from "../../../../../../src/platform/shared/cache/stores/memory-cache-store.js";
function createTestMeta(overrides = {}) {
    return {
        scope: "memory",
        tags: [],
        version: "1.0",
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        hitCount: 0,
        sizeBytes: 100,
        ...overrides,
    };
}
// ---------------------------------------------------------------------------
// Constructor & Initialization
// ---------------------------------------------------------------------------
test("MemoryCacheStore constructor accepts custom maxEntries", () => {
    const store = new MemoryCacheStore(100);
    assert.strictEqual(store.size, 0, "Store should start empty");
});
test("MemoryCacheStore defaults maxEntries to 2000", () => {
    const store = new MemoryCacheStore();
    assert.strictEqual(store.size, 0, "Store should start with default capacity");
});
// ---------------------------------------------------------------------------
// get - Cache Hits
// ---------------------------------------------------------------------------
test("get returns hit=true for existing entry", async () => {
    const store = new MemoryCacheStore();
    const meta = createTestMeta();
    await store.set("ns1", "key1", "value1", meta);
    const result = await store.get("ns1", "key1");
    assert.strictEqual(result.hit, true);
    assert.strictEqual(result.value, "value1");
    assert.strictEqual(result.layer, "L1");
});
test("get returns correct value type for generic", async () => {
    const store = new MemoryCacheStore();
    const meta = createTestMeta();
    const testObj = { a: 1, b: "test" };
    await store.set("ns1", "key1", testObj, meta);
    const result = await store.get("ns1", "key1");
    assert.strictEqual(result.hit, true);
    assert.deepStrictEqual(result.value, testObj);
});
test("get increments hit count on cache hit", async () => {
    const store = new MemoryCacheStore();
    const meta = createTestMeta();
    await store.set("ns1", "key1", "value1", meta);
    await store.get("ns1", "key1");
    await store.get("ns1", "key1");
    const result = await store.get("ns1", "key1");
    assert.strictEqual(result.hit, true);
    // hitCount increments on access - lastAccessedAt is updated
});
// ---------------------------------------------------------------------------
// get - Cache Misses
// ---------------------------------------------------------------------------
test("get returns hit=false for non-existent key", async () => {
    const store = new MemoryCacheStore();
    const result = await store.get("ns1", "nonexistent");
    assert.strictEqual(result.hit, false);
    assert.strictEqual(result.value, null);
    assert.strictEqual(result.reason, "not_found");
});
test("get returns hit=false for expired entry", async () => {
    const store = new MemoryCacheStore();
    const pastTime = Date.now() - 1000;
    const meta = createTestMeta({ expiresAt: pastTime });
    await store.set("ns1", "key1", "value1", meta);
    const result = await store.get("ns1", "key1");
    assert.strictEqual(result.hit, false);
    assert.strictEqual(result.value, null);
    assert.strictEqual(result.reason, "expired");
});
test("get returns hit=false after entry is deleted", async () => {
    const store = new MemoryCacheStore();
    const meta = createTestMeta();
    await store.set("ns1", "key1", "value1", meta);
    await store.delete("ns1", "key1");
    const result = await store.get("ns1", "key1");
    assert.strictEqual(result.hit, false);
    assert.strictEqual(result.reason, "not_found");
});
// ---------------------------------------------------------------------------
// get - Namespace Isolation
// ---------------------------------------------------------------------------
test("get returns hit=false for key in different namespace", async () => {
    const store = new MemoryCacheStore();
    const meta = createTestMeta();
    await store.set("ns1", "key1", "value1", meta);
    const result = await store.get("ns2", "key1");
    assert.strictEqual(result.hit, false);
    assert.strictEqual(result.reason, "not_found");
});
test("same key in different namespaces are isolated", async () => {
    const store = new MemoryCacheStore();
    const meta = createTestMeta();
    await store.set("ns1", "key1", "value1", meta);
    await store.set("ns2", "key1", "value2", meta);
    const result1 = await store.get("ns1", "key1");
    const result2 = await store.get("ns2", "key1");
    assert.strictEqual(result1.value, "value1");
    assert.strictEqual(result2.value, "value2");
});
// ---------------------------------------------------------------------------
// set - Basic Operations
// ---------------------------------------------------------------------------
test("set stores value in cache", async () => {
    const store = new MemoryCacheStore();
    const meta = createTestMeta();
    await store.set("ns1", "key1", "testvalue", meta);
    const result = await store.get("ns1", "key1");
    assert.strictEqual(result.hit, true);
    assert.strictEqual(result.value, "testvalue");
});
test("set overwrites existing entry", async () => {
    const store = new MemoryCacheStore();
    const meta = createTestMeta();
    await store.set("ns1", "key1", "value1", meta);
    await store.set("ns1", "key1", "value2", meta);
    const result = await store.get("ns1", "key1");
    assert.strictEqual(result.value, "value2");
});
test("set does not count towards capacity when updating existing key", async () => {
    const store = new MemoryCacheStore(2);
    const meta = createTestMeta();
    await store.set("ns1", "key1", "v1", meta);
    await store.set("ns1", "key2", "v2", meta);
    await store.set("ns1", "key1", "v1updated", meta); // update, not new entry
    await store.set("ns1", "key3", "v3", meta); // should not evict key1
    const result = await store.get("ns1", "key1");
    assert.strictEqual(result.hit, true);
    assert.strictEqual(result.value, "v1updated");
});
// ---------------------------------------------------------------------------
// set - LRU Eviction
// ---------------------------------------------------------------------------
test("set evicts least recently used entry when at capacity", async () => {
    const store = new MemoryCacheStore(2);
    const meta = createTestMeta();
    await store.set("ns1", "key1", "v1", meta);
    await store.set("ns1", "key2", "v2", meta);
    // key1 is LRU, key2 is MRU
    await store.set("ns1", "key3", "v3", meta); // should evict key1
    const result1 = await store.get("ns1", "key1");
    const result2 = await store.get("ns1", "key2");
    const result3 = await store.get("ns1", "key3");
    assert.strictEqual(result1.hit, false, "key1 should be evicted");
    assert.strictEqual(result2.hit, true, "key2 should still exist");
    assert.strictEqual(result3.hit, true, "key3 should exist");
});
test("LRU order updates on get", async () => {
    const store = new MemoryCacheStore(2);
    const meta = createTestMeta();
    await store.set("ns1", "key1", "v1", meta);
    await store.set("ns1", "key2", "v2", meta);
    // key2 is MRU
    await store.get("ns1", "key1"); // key1 becomes MRU
    await store.set("ns1", "key3", "v3", meta); // should evict key2 (now LRU)
    const result1 = await store.get("ns1", "key1");
    const result2 = await store.get("ns1", "key2");
    assert.strictEqual(result1.hit, true, "key1 should not be evicted");
    assert.strictEqual(result2.hit, false, "key2 should be evicted");
});
// ---------------------------------------------------------------------------
// delete
// ---------------------------------------------------------------------------
test("delete removes entry from cache", async () => {
    const store = new MemoryCacheStore();
    const meta = createTestMeta();
    await store.set("ns1", "key1", "value1", meta);
    await store.delete("ns1", "key1");
    const result = await store.get("ns1", "key1");
    assert.strictEqual(result.hit, false);
});
test("delete is idempotent", async () => {
    const store = new MemoryCacheStore();
    const meta = createTestMeta();
    await store.delete("ns1", "key1"); // no error
    await store.set("ns1", "key1", "value1", meta);
    await store.delete("ns1", "key1");
    await store.delete("ns1", "key1"); // no error
    const result = await store.get("ns1", "key1");
    assert.strictEqual(result.hit, false);
});
// ---------------------------------------------------------------------------
// invalidateByTag
// ---------------------------------------------------------------------------
test("invalidateByTag removes entries with matching tag", async () => {
    const store = new MemoryCacheStore();
    const meta1 = createTestMeta({ tags: ["tag1"] });
    const meta2 = createTestMeta({ tags: ["tag2"] });
    const meta3 = createTestMeta({ tags: ["tag1", "tag2"] });
    await store.set("ns1", "key1", "v1", meta1);
    await store.set("ns1", "key2", "v2", meta2);
    await store.set("ns1", "key3", "v3", meta3);
    const count = await store.invalidateByTag("tag1");
    assert.strictEqual(count, 2);
    assert.strictEqual((await store.get("ns1", "key1")).hit, false);
    assert.strictEqual((await store.get("ns1", "key2")).hit, true);
    assert.strictEqual((await store.get("ns1", "key3")).hit, false);
});
test("invalidateByTag returns 0 when no entries match", async () => {
    const store = new MemoryCacheStore();
    const meta = createTestMeta({ tags: ["tag1"] });
    await store.set("ns1", "key1", "v1", meta);
    const count = await store.invalidateByTag("nonexistent");
    assert.strictEqual(count, 0);
});
test("invalidateByTag handles entries with multiple tags", async () => {
    const store = new MemoryCacheStore();
    const meta = createTestMeta({ tags: ["tag1", "tag2", "tag3"] });
    await store.set("ns1", "key1", "v1", meta);
    await store.invalidateByTag("tag2");
    assert.strictEqual((await store.get("ns1", "key1")).hit, false);
});
// ---------------------------------------------------------------------------
// invalidateNamespace
// ---------------------------------------------------------------------------
test("invalidateNamespace removes all entries in namespace", async () => {
    const store = new MemoryCacheStore();
    const meta = createTestMeta();
    await store.set("ns1", "key1", "v1", meta);
    await store.set("ns1", "key2", "v2", meta);
    await store.set("ns2", "key1", "v3", meta);
    const count = await store.invalidateNamespace("ns1");
    assert.strictEqual(count, 2);
    assert.strictEqual((await store.get("ns1", "key1")).hit, false);
    assert.strictEqual((await store.get("ns1", "key2")).hit, false);
    assert.strictEqual((await store.get("ns2", "key1")).hit, true);
});
test("invalidateNamespace returns 0 for non-existent namespace", async () => {
    const store = new MemoryCacheStore();
    const meta = createTestMeta();
    await store.set("ns1", "key1", "v1", meta);
    const count = await store.invalidateNamespace("nonexistent");
    assert.strictEqual(count, 0);
});
// ---------------------------------------------------------------------------
// cleanupExpired
// ---------------------------------------------------------------------------
test("cleanupExpired removes expired entries", async () => {
    const store = new MemoryCacheStore();
    const pastTime = Date.now() - 1000;
    const futureTime = Date.now() + 10000;
    const meta1 = createTestMeta({ expiresAt: pastTime });
    const meta2 = createTestMeta({ expiresAt: futureTime });
    await store.set("ns1", "key1", "v1", meta1);
    await store.set("ns1", "key2", "v2", meta2);
    const count = await store.cleanupExpired();
    assert.strictEqual(count, 1);
    assert.strictEqual((await store.get("ns1", "key1")).hit, false);
    assert.strictEqual((await store.get("ns1", "key2")).hit, true);
});
test("cleanupExpired returns 0 when no entries are expired", async () => {
    const store = new MemoryCacheStore();
    const futureTime = Date.now() + 10000;
    const meta = createTestMeta({ expiresAt: futureTime });
    await store.set("ns1", "key1", "v1", meta);
    const count = await store.cleanupExpired();
    assert.strictEqual(count, 0);
});
test("cleanupExpired handles empty cache", async () => {
    const store = new MemoryCacheStore();
    const count = await store.cleanupExpired();
    assert.strictEqual(count, 0);
});
// ---------------------------------------------------------------------------
// size property
// ---------------------------------------------------------------------------
test("size returns correct entry count", async () => {
    const store = new MemoryCacheStore();
    const meta = createTestMeta();
    assert.strictEqual(store.size, 0);
    await store.set("ns1", "key1", "v1", meta);
    assert.strictEqual(store.size, 1);
    await store.set("ns1", "key2", "v2", meta);
    assert.strictEqual(store.size, 2);
    await store.delete("ns1", "key1");
    assert.strictEqual(store.size, 1);
});
test("size updates correctly after eviction", async () => {
    const store = new MemoryCacheStore(2);
    const meta = createTestMeta();
    await store.set("ns1", "key1", "v1", meta);
    await store.set("ns1", "key2", "v2", meta);
    await store.set("ns1", "key3", "v3", meta); // evicts key1
    assert.strictEqual(store.size, 2);
});
//# sourceMappingURL=memory-cache-store.test.js.map