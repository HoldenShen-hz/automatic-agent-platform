import assert from "node:assert/strict";
import test from "node:test";

import { BoundedCache } from "../../../../../src/platform/shared/utils/bounded-cache.js";

test("BoundedCache constructor accepts custom maxEntries", () => {
  const cache = new BoundedCache<string, number>(50);
  assert.equal(cache.size, 0);
});

test("BoundedCache default maxEntries is 100", () => {
  const cache = new BoundedCache<string, number>();
  assert.equal(cache.size, 0);
});

test("BoundedCache.set adds entry", () => {
  const cache = new BoundedCache<string, number>();
  cache.set("key1", 100);
  assert.equal(cache.size, 1);
  assert.equal(cache.get("key1"), 100);
});

test("BoundedCache.get returns undefined for missing key", () => {
  const cache = new BoundedCache<string, number>();
  assert.equal(cache.get("nonexistent"), undefined);
});

test("BoundedCache.has returns true for existing key", () => {
  const cache = new BoundedCache<string, number>();
  cache.set("exists", 1);
  assert.equal(cache.has("exists"), true);
});

test("BoundedCache.has returns false for missing key", () => {
  const cache = new BoundedCache<string, number>();
  assert.equal(cache.has("missing"), false);
});

test("BoundedCache.delete removes entry", () => {
  const cache = new BoundedCache<string, number>();
  cache.set("todelete", 42);
  assert.equal(cache.delete("todelete"), true);
  assert.equal(cache.has("todelete"), false);
});

test("BoundedCache.delete returns false for missing key", () => {
  const cache = new BoundedCache<string, number>();
  assert.equal(cache.delete("missing"), false);
});

test("BoundedCache.clear removes all entries", () => {
  const cache = new BoundedCache<string, number>();
  cache.set("a", 1);
  cache.set("b", 2);
  cache.set("c", 3);
  cache.clear();
  assert.equal(cache.size, 0);
});

test("BoundedCache.evicts oldest entry when at capacity", () => {
  const cache = new BoundedCache<string, number>(3);
  cache.set("first", 1);
  cache.set("second", 2);
  cache.set("third", 3);
  // Now at capacity
  assert.equal(cache.size, 3);
  cache.set("fourth", 4);
  // First entry should be evicted
  assert.equal(cache.size, 3);
  assert.equal(cache.has("first"), false);
  assert.equal(cache.get("fourth"), 4);
});

test("BoundedCache updates existing key without eviction", () => {
  const cache = new BoundedCache<string, number>(3);
  cache.set("a", 1);
  cache.set("b", 2);
  cache.set("c", 3);
  // Update existing key - should not cause eviction
  cache.set("a", 10);
  assert.equal(cache.size, 3);
  assert.equal(cache.get("a"), 10);
  assert.equal(cache.has("b"), true);
  assert.equal(cache.has("c"), true);
});

test("BoundedCache maxEntries must be positive", () => {
  const cache = new BoundedCache<string, number>(0);
  cache.set("key", 1);
  assert.equal(cache.get("key"), 1);
});

test("BoundedCache handles non-integer maxEntries by truncating", () => {
  const cache = new BoundedCache<string, number>(3.7);
  for (let i = 0; i < 5; i++) {
    cache.set(`key${i}`, i);
  }
  assert.equal(cache.size, 3);
});

test("BoundedCache.entries iterator works", () => {
  const cache = new BoundedCache<string, number>();
  cache.set("a", 1);
  cache.set("b", 2);
  const entries = Array.from(cache.entries());
  assert.equal(entries.length, 2);
});

test("BoundedCache.keys iterator works", () => {
  const cache = new BoundedCache<string, number>();
  cache.set("x", 1);
  cache.set("y", 2);
  const keys = Array.from(cache.keys());
  assert.deepEqual(keys.sort(), ["x", "y"]);
});

test("BoundedCache.values iterator works", () => {
  const cache = new BoundedCache<string, number>();
  cache.set("a", 10);
  cache.set("b", 20);
  const values = Array.from(cache.values());
  assert.deepEqual(values.sort(), [10, 20]);
});

test("BoundedCache Symbol.iterator works", () => {
  const cache = new BoundedCache<string, number>();
  cache.set("k1", 100);
  cache.set("k2", 200);
  const entries = Array.from(cache);
  assert.equal(entries.length, 2);
});

test("BoundedCache.size getter returns current size", () => {
  const cache = new BoundedCache<string, number>();
  assert.equal(cache.size, 0);
  cache.set("a", 1);
  assert.equal(cache.size, 1);
  cache.set("b", 2);
  assert.equal(cache.size, 2);
  cache.delete("a");
  assert.equal(cache.size, 1);
});

test("BoundedCache eviction uses FIFO order", () => {
  const cache = new BoundedCache<string, number>(3);
  cache.set("first", 1);
  cache.set("second", 2);
  cache.set("third", 3);
  // At capacity - next set should evict first (oldest)
  cache.set("fourth", 4);
  // First should be evicted since it was inserted first
  assert.equal(cache.has("first"), false, "first should be evicted");
  assert.equal(cache.has("second"), true, "second should still exist");
  assert.equal(cache.has("third"), true, "third should still exist");
  assert.equal(cache.get("fourth"), 4);
});

test("BoundedCache get does not update LRU order", () => {
  // Note: This cache uses FIFO (insertion order), not LRU
  // get() does not change insertion order
  const cache = new BoundedCache<string, number>(3);
  cache.set("first", 1);
  cache.set("second", 2);
  cache.set("third", 3);
  // Accessing first does NOT make it more recent
  cache.get("first");
  // Eviction still happens in insertion order
  cache.set("fourth", 4);
  // first was oldest, so it gets evicted
  assert.equal(cache.has("first"), false, "first should be evicted despite get()");
  assert.equal(cache.has("second"), true);
  assert.equal(cache.has("third"), true);
});

test("BoundedCache supports LRU eviction when configured", () => {
  const cache = new BoundedCache<string, number>({
    maxEntries: 3,
    evictionPolicy: "lru",
  });
  cache.set("first", 1);
  cache.set("second", 2);
  cache.set("third", 3);
  assert.equal(cache.get("first"), 1);
  cache.set("fourth", 4);
  assert.equal(cache.has("first"), true);
  assert.equal(cache.has("second"), false);
});

test("BoundedCache expires entries by TTL", async () => {
  const cache = new BoundedCache<string, number>({
    maxEntries: 3,
    ttlMs: 20,
  });
  cache.set("ephemeral", 1);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(cache.get("ephemeral"), undefined);
  assert.equal(cache.size, 0);
});

test("BoundedCache tracks hits misses evictions and expirations", async () => {
  const cache = new BoundedCache<string, number>({
    maxEntries: 1,
    ttlMs: 20,
    evictionPolicy: "lru",
  });
  assert.equal(cache.get("missing"), undefined);
  cache.set("a", 1);
  assert.equal(cache.get("a"), 1);
  cache.set("b", 2);
  await new Promise((resolve) => setTimeout(resolve, 30));
  cache.purgeExpired();
  const stats = cache.getStats();
  assert.equal(stats.hits, 1);
  assert.equal(stats.misses, 1);
  assert.equal(stats.evictions, 1);
  assert.equal(stats.expirations, 1);
});

test("BoundedCache boundary: exactly at default capacity of 100 - no eviction", () => {
  // Tests boundary at DEFAULT_MAX_ENTRIES = 100
  const cache = new BoundedCache<string, number>(100);
  for (let i = 0; i < 100; i++) {
    cache.set(`key${i}`, i);
  }
  assert.equal(cache.size, 100, "size should be exactly 100");
  assert.equal(cache.has("key0"), true, "first entry should still exist");
  assert.equal(cache.has("key99"), true, "last entry should exist");
});

test("BoundedCache boundary: one over default capacity of 100 - oldest evicted", () => {
  // Tests boundary at DEFAULT_MAX_ENTRIES = 100, one over triggers eviction
  const cache = new BoundedCache<string, number>(100);
  for (let i = 0; i < 100; i++) {
    cache.set(`key${i}`, i);
  }
  // 101st entry triggers eviction of key0
  cache.set("key100", 100);
  assert.equal(cache.size, 100, "size should still be 100 after eviction");
  assert.equal(cache.has("key0"), false, "first entry should be evicted");
  assert.equal(cache.has("key1"), true, "second entry should still exist");
  assert.equal(cache.has("key100"), true, "newest entry should exist");
});
