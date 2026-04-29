import { test } from "node:test";
import assert from "node:assert/strict";
import { BoundedCache } from "../../../../src/platform/shared/utils/bounded-cache.js";
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

test("BoundedCache and MemoryCacheStore - both enforce capacity limits", async () => {
  // BoundedCache with capacity 3
  const boundedCache = new BoundedCache<string, string>(3);
  boundedCache.set("key1", "value1");
  boundedCache.set("key2", "value2");
  boundedCache.set("key3", "value3");
  boundedCache.set("key4", "value4"); // Must evict one entry

  // At least one entry must be evicted (not all can fit)
  const a = boundedCache.get("key1");
  const b = boundedCache.get("key2");
  const c = boundedCache.get("key3");
  const d = boundedCache.get("key4");
  const evicted = [a, b, c, d].filter(v => v === undefined).length;
  assert.ok(evicted >= 1, "At least one entry should be evicted");

  // MemoryCacheStore with capacity 3
  const memoryStore = new MemoryCacheStore(3);
  await memoryStore.set("ns", "key1", "value1", createMeta());
  await memoryStore.set("ns", "key2", "value2", createMeta());
  await memoryStore.set("ns", "key3", "value3", createMeta());
  await memoryStore.set("ns", "key4", "value4", createMeta()); // Must evict

  const result1 = await memoryStore.get("ns", "key1");
  const result2 = await memoryStore.get("ns", "key2");
  const result3 = await memoryStore.get("ns", "key3");
  const result4 = await memoryStore.get("ns", "key4");

  // At least one must be evicted
  const memEvicted = [result1, result2, result3, result4].filter(r => !r.hit).length;
  assert.ok(memEvicted >= 1, "At least one entry should be evicted");
});

test("MemoryCacheStore - get returns correct value for existing entries", async () => {
  const memoryStore = new MemoryCacheStore(5);

  await memoryStore.set("ns", "key1", "value1", createMeta());
  await memoryStore.set("ns", "key2", "value2", createMeta());

  const result1 = await memoryStore.get<string>("ns", "key1");
  const result2 = await memoryStore.get<string>("ns", "key2");

  assert.equal(result1.hit, true);
  assert.equal(result1.value, "value1");
  assert.equal(result2.hit, true);
  assert.equal(result2.value, "value2");
});

test("MemoryCacheStore - delete removes entry", async () => {
  const memoryStore = new MemoryCacheStore(5);

  await memoryStore.set("ns", "key1", "value1", createMeta());
  await memoryStore.delete("ns", "key1");

  const result = await memoryStore.get("ns", "key1");
  assert.equal(result.hit, false);
});

test("BoundedCache - update existing key preserves value", () => {
  const cache = new BoundedCache<string, number>(3);
  cache.set("key", 1);
  cache.set("key", 2);

  assert.equal(cache.get("key"), 2);
  assert.equal(cache.size, 1);
});

test("MemoryCacheStore - update existing key preserves value", async () => {
  const memoryStore = new MemoryCacheStore(3);

  await memoryStore.set("ns", "key1", "value1", createMeta());
  await memoryStore.set("ns", "key1", "value2", createMeta());

  const result = await memoryStore.get<string>("ns", "key1");
  assert.equal(result.value, "value2");
  assert.equal(memoryStore.size, 1);
});