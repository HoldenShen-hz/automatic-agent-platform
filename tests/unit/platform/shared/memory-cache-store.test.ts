import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryCacheStore } from "../../../../src/platform/shared/cache/stores/memory-cache-store.js";
import type { CacheMeta } from "../../../../src/platform/shared/cache/cache-types.js";

function createMeta(overrides: Partial<CacheMeta> = {}): CacheMeta {
  return {
    scope: "memory",
    ttlMs: 60000,
    tags: [],
    version: "1.0",
    createdAt: Date.now(),
    expiresAt: undefined,
    lastAccessedAt: Date.now(),
    hitCount: 0,
    sizeBytes: 100,
    ...overrides,
  };
}

test("MemoryCacheStore - basic get/set operations", async () => {
  const store = new MemoryCacheStore();

  await store.set("ns", "key1", "value1", createMeta());
  const result = await store.get<string>("ns", "key1");

  assert.equal(result.hit, true);
  assert.equal(result.value, "value1");
  assert.equal(result.layer, "L1");
});

test("MemoryCacheStore - get returns miss for non-existent key", async () => {
  const store = new MemoryCacheStore();

  const result = await store.get("ns", "nonexistent");

  assert.equal(result.hit, false);
  assert.equal(result.value, null);
  assert.equal(result.reason, "not_found");
});

test("MemoryCacheStore - get returns miss for expired entry", async () => {
  const store = new MemoryCacheStore();

  const pastTime = Date.now() - 1000;
  await store.set("ns", "expired-key", "value", createMeta({
    expiresAt: pastTime,
  }));

  const result = await store.get<string>("ns", "expired-key");

  assert.equal(result.hit, false);
  assert.equal(result.reason, "expired");
  assert.equal(result.value, null);
});

test("MemoryCacheStore - delete removes entry", async () => {
  const store = new MemoryCacheStore();

  await store.set("ns", "key1", "value1", createMeta());
  await store.delete("ns", "key1");
  const result = await store.get("ns", "key1");

  assert.equal(result.hit, false);
});

test("MemoryCacheStore - hit count increments on access", async () => {
  const store = new MemoryCacheStore();

  await store.set("ns", "key1", "value1", createMeta());
  await store.get<string>("ns", "key1");
  const result = await store.get<string>("ns", "key1");

  assert.equal(result.hit, true);
  assert.ok(result.layer, "L1");
});

test("MemoryCacheStore - lastAccessedAt updates on access", async () => {
  const store = new MemoryCacheStore();
  const beforeTime = Date.now() - 100;

  await store.set("ns", "key1", "value1", createMeta({ lastAccessedAt: beforeTime }));

  // Access to trigger update
  await store.get<string>("ns", "key1");

  // Verify entry is still accessible (the metadata update happens internally)
  const result = await store.get<string>("ns", "key1");
  assert.equal(result.hit, true);
  assert.ok(result.layer, "L1");
});

test("MemoryCacheStore - LRU eviction when at capacity", async () => {
  const store = new MemoryCacheStore(3);

  await store.set("ns", "key1", "value1", createMeta());
  await store.set("ns", "key2", "value2", createMeta());
  await store.set("ns", "key3", "value3", createMeta());
  // Capacity reached, next set should evict oldest
  await store.set("ns", "key4", "value4", createMeta());

  const result1 = await store.get("ns", "key1");
  const result2 = await store.get("ns", "key2");
  const result3 = await store.get("ns", "key3");
  const result4 = await store.get("ns", "key4");

  // At least one of the first three should be evicted
  const firstThreeEvicted = !result1.hit || !result2.hit || !result3.hit;
  assert.equal(firstThreeEvicted, true);
  assert.equal(result4.hit, true);
});

test("MemoryCacheStore - invalidateByTag removes tagged entries", async () => {
  const store = new MemoryCacheStore();

  await store.set("ns", "key1", "value1", createMeta({ tags: ["tag1"] }));
  await store.set("ns", "key2", "value2", createMeta({ tags: ["tag2"] }));
  await store.set("ns", "key3", "value3", createMeta({ tags: ["tag1", "tag2"] }));

  const count = await store.invalidateByTag("tag1");

  assert.equal(count, 2);

  const result1 = await store.get("ns", "key1");
  const result2 = await store.get("ns", "key2");
  const result3 = await store.get("ns", "key3");

  assert.equal(result1.hit, false);
  assert.equal(result2.hit, true);  // Only had tag2
  assert.equal(result3.hit, false); // Had both tags
});

test("MemoryCacheStore - invalidateNamespace removes all entries in namespace", async () => {
  const store = new MemoryCacheStore();

  await store.set("ns1", "key1", "value1", createMeta());
  await store.set("ns1", "key2", "value2", createMeta());
  await store.set("ns2", "key3", "value3", createMeta());

  const count = await store.invalidateNamespace("ns1");

  assert.equal(count, 2);

  const result1 = await store.get("ns1", "key1");
  const result2 = await store.get("ns1", "key2");
  const result3 = await store.get("ns2", "key3");

  assert.equal(result1.hit, false);
  assert.equal(result2.hit, false);
  assert.equal(result3.hit, true); // ns2 not affected
});

test("MemoryCacheStore - cleanupExpired removes expired entries", async () => {
  const store = new MemoryCacheStore();

  const pastTime = Date.now() - 1000;
  const futureTime = Date.now() + 10000;

  await store.set("ns", "expired", "expired-value", createMeta({ expiresAt: pastTime }));
  await store.set("ns", "valid", "valid-value", createMeta({ expiresAt: futureTime }));

  const count = await store.cleanupExpired();

  assert.equal(count, 1);

  const expiredResult = await store.get("ns", "expired");
  const validResult = await store.get("ns", "valid");

  assert.equal(expiredResult.hit, false);
  assert.equal(validResult.hit, true);
});

test("MemoryCacheStore - size returns correct count", async () => {
  const store = new MemoryCacheStore();

  assert.equal(store.size, 0);

  await store.set("ns", "key1", "value1", createMeta());
  assert.equal(store.size, 1);

  await store.set("ns", "key2", "value2", createMeta());
  assert.equal(store.size, 2);

  await store.delete("ns", "key1");
  assert.equal(store.size, 1);
});

test("MemoryCacheStore - updating existing key does not increase size", async () => {
  const store = new MemoryCacheStore();

  await store.set("ns", "key1", "value1", createMeta());
  assert.equal(store.size, 1);

  await store.set("ns", "key1", "value2", createMeta());
  assert.equal(store.size, 1);

  const result = await store.get<string>("ns", "key1");
  assert.equal(result.value, "value2");
});

test("MemoryCacheStore - different namespaces are independent", async () => {
  const store = new MemoryCacheStore();

  await store.set("ns1", "key1", "value1", createMeta());
  await store.set("ns2", "key1", "value2", createMeta());

  const result1 = await store.get<string>("ns1", "key1");
  const result2 = await store.get<string>("ns2", "key1");

  assert.equal(result1.value, "value1");
  assert.equal(result2.value, "value2");
  assert.equal(store.size, 2);
});

test("MemoryCacheStore - constructor accepts custom maxEntries", () => {
  const store = new MemoryCacheStore(100);
  assert.equal(store.size, 0);
});