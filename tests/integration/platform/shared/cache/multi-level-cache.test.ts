/**
 * Multi-Level Cache Integration Tests
 *
 * Tests hierarchical L1/L2/L3 cache lookup, backfill behavior,
 * scope-based distribution, and cross-layer invalidation.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { MultiLevelCacheStore } from "../../../../../src/platform/shared/cache/stores/multi-level-cache-store.js";
import { MemoryCacheStore } from "../../../../../src/platform/shared/cache/stores/memory-cache-store.js";
import type { CacheMeta } from "../../../../../src/platform/shared/cache/cache-types.js";

function makeMeta(overrides: Partial<CacheMeta> = {}): CacheMeta {
  return {
    scope: "persistent",
    tags: [],
    version: "v1",
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
    hitCount: 0,
    sizeBytes: 32,
    ...overrides,
  };
}

test("MultiLevelCacheStore L1 hit is returned immediately without L2/L3 lookup", async () => {
  const l1 = new MemoryCacheStore(100);
  const l2 = new MemoryCacheStore(100);
  const l3 = new MemoryCacheStore(100);
  const store = new MultiLevelCacheStore(l1, l2, l3);

  await store.set("ns", "key", "l1-value", makeMeta({ scope: "memory" }));
  const result = await store.get<string>("ns", "key");

  assert.equal(result.hit, true);
  assert.equal(result.value, "l1-value");
  assert.equal(result.layer, "L1");
});

test("MultiLevelCacheStore L2 hit populates L1 via backfill", async () => {
  const l1 = new MemoryCacheStore(100);
  const l2 = new MemoryCacheStore(100);
  const l3 = new MemoryCacheStore(100);
  const store = new MultiLevelCacheStore(l1, l2, l3);

  // Set value only in L2 (session scope)
  await store.set("ns", "key", "l2-value", makeMeta({ scope: "session" }));

  // First get should hit L2 and backfill L1
  const result1 = await store.get<string>("ns", "key");
  assert.equal(result1.hit, true);
  assert.equal(result1.value, "l2-value");
  assert.equal(result1.layer, "L2");

  // Second get should now hit L1
  const result2 = await store.get<string>("ns", "key");
  assert.equal(result2.hit, true);
  assert.equal(result2.layer, "L1");
});

test("MultiLevelCacheStore L3 hit populates L1 via backfill", async () => {
  const l1 = new MemoryCacheStore(100);
  const l2 = new MemoryCacheStore(100);
  const l3 = new MemoryCacheStore(100);
  const store = new MultiLevelCacheStore(l1, l2, l3);

  // Set value only in L3 (persistent scope)
  await store.set("ns", "key", "l3-value", makeMeta({ scope: "persistent" }));

  // First get should hit L3 and backfill L1
  const result1 = await store.get<string>("ns", "key");
  assert.equal(result1.hit, true);
  assert.equal(result1.value, "l3-value");
  assert.equal(result1.layer, "L3");

  // Second get should now hit L1
  const result2 = await store.get<string>("ns", "key");
  assert.equal(result2.hit, true);
  assert.equal(result2.layer, "L1");
});

test("MultiLevelCacheStore miss returns not_found reason", async () => {
  const l1 = new MemoryCacheStore(100);
  const l2 = new MemoryCacheStore(100);
  const l3 = new MemoryCacheStore(100);
  const store = new MultiLevelCacheStore(l1, l2, l3);

  const result = await store.get<string>("ns", "nonexistent");

  assert.equal(result.hit, false);
  assert.equal(result.value, null);
  assert.equal(result.reason, "not_found");
});

test("MultiLevelCacheStore memory scope writes only to L1", async () => {
  const l1 = new MemoryCacheStore(100);
  const l2 = new MemoryCacheStore(100);
  const l3 = new MemoryCacheStore(100);
  const store = new MultiLevelCacheStore(l1, l2, l3);

  await store.set("ns", "key", "memory-value", makeMeta({ scope: "memory" }));

  // L1 should have the value
  const l1Result = await l1.get<string>("ns", "key");
  assert.equal(l1Result.hit, true);

  // L2 and L3 should not
  const l2Result = await l2.get<string>("ns", "key");
  assert.equal(l2Result.hit, false);
  const l3Result = await l3.get<string>("ns", "key");
  assert.equal(l3Result.hit, false);
});

test("MultiLevelCacheStore persistent scope writes to all layers", async () => {
  const l1 = new MemoryCacheStore(100);
  const l2 = new MemoryCacheStore(100);
  const l3 = new MemoryCacheStore(100);
  const store = new MultiLevelCacheStore(l1, l2, l3);

  await store.set("ns", "key", "persistent-value", makeMeta({ scope: "persistent" }));

  const [l1Result, l2Result, l3Result] = await Promise.all([
    l1.get<string>("ns", "key"),
    l2.get<string>("ns", "key"),
    l3.get<string>("ns", "key"),
  ]);

  assert.equal(l1Result.hit, true);
  assert.equal(l1Result.value, "persistent-value");
  assert.equal(l2Result.hit, true);
  assert.equal(l2Result.value, "persistent-value");
  assert.equal(l3Result.hit, true);
  assert.equal(l3Result.value, "persistent-value");
});

test("MultiLevelCacheStore delete removes from all layers", async () => {
  const l1 = new MemoryCacheStore(100);
  const l2 = new MemoryCacheStore(100);
  const l3 = new MemoryCacheStore(100);
  const store = new MultiLevelCacheStore(l1, l2, l3);

  await store.set("ns", "key", "value", makeMeta({ scope: "persistent" }));
  await store.delete("ns", "key");

  const [l1Result, l2Result, l3Result] = await Promise.all([
    store.get<string>("ns", "key"),
    store.get<string>("ns", "key"),
    store.get<string>("ns", "key"),
  ]);

  assert.equal(l1Result.hit, false);
  assert.equal(l2Result.hit, false);
  assert.equal(l3Result.hit, false);
});

test("MultiLevelCacheStore invalidateByTag removes tagged entries from all layers", async () => {
  const l1 = new MemoryCacheStore(100);
  const l2 = new MemoryCacheStore(100);
  const l3 = new MemoryCacheStore(100);
  const store = new MultiLevelCacheStore(l1, l2, l3);

  await store.set("ns", "key1", "v1", makeMeta({ scope: "persistent", tags: ["tag:A"] }));
  await store.set("ns", "key2", "v2", makeMeta({ scope: "persistent", tags: ["tag:B"] }));
  await store.set("ns", "key3", "v3", makeMeta({ scope: "persistent", tags: ["tag:A", "tag:B"] }));

  const count = await store.invalidateByTag("tag:A");

  // key1 and key3 should be invalidated
  assert.equal(count >= 1, true);

  const [r1, r2, r3] = await Promise.all([
    store.get<string>("ns", "key1"),
    store.get<string>("ns", "key2"),
    store.get<string>("ns", "key3"),
  ]);

  assert.equal(r1.hit, false);
  assert.equal(r2.hit, true); // Only had tag:B
  assert.equal(r3.hit, false);
});

test("MultiLevelCacheStore invalidateNamespace removes all entries in namespace", async () => {
  const l1 = new MemoryCacheStore(100);
  const l2 = new MemoryCacheStore(100);
  const l3 = new MemoryCacheStore(100);
  const store = new MultiLevelCacheStore(l1, l2, l3);

  await store.set("ns1", "key", "v1", makeMeta({ scope: "persistent" }));
  await store.set("ns2", "key", "v2", makeMeta({ scope: "persistent" }));

  const count = await store.invalidateNamespace("ns1");

  assert.equal(count >= 1, true);

  const [rNs1, rNs2] = await Promise.all([
    store.get<string>("ns1", "key"),
    store.get<string>("ns2", "key"),
  ]);

  assert.equal(rNs1.hit, false);
  assert.equal(rNs2.hit, true);
});

test("MultiLevelCacheStore cleanupExpired removes expired entries from all layers", async () => {
  const l1 = new MemoryCacheStore(100);
  const l2 = new MemoryCacheStore(100);
  const l3 = new MemoryCacheStore(100);
  const store = new MultiLevelCacheStore(l1, l2, l3);
  const now = Date.now();

  // Set expired entry in L1
  await store.set("ns", "expired-l1", "expired", makeMeta({
    scope: "memory",
    createdAt: now - 10000,
    expiresAt: now - 1,
  }));

  // Set expired entry in L2
  await store.set("ns", "expired-l2", "expired", makeMeta({
    scope: "persistent",
    createdAt: now - 10000,
    expiresAt: now - 1,
  }));

  // Set fresh entry
  await store.set("ns", "fresh", "fresh", makeMeta({
    scope: "persistent",
    createdAt: now,
    expiresAt: now + 10000,
  }));

  const cleaned = await store.cleanupExpired();

  assert.equal(cleaned >= 2, true);

  const rFresh = await store.get<string>("ns", "fresh");
  assert.equal(rFresh.hit, true);

  const rExpired1 = await store.get<string>("ns", "expired-l1");
  assert.equal(rExpired1.hit, false);

  const rExpired2 = await store.get<string>("ns", "expired-l2");
  assert.equal(rExpired2.hit, false);
});

test("MultiLevelCacheStore with LRU eviction when L1 is full", async () => {
  const l1 = new MemoryCacheStore(2); // Small L1
  const l2 = new MemoryCacheStore(100);
  const l3 = new MemoryCacheStore(100);
  const store = new MultiLevelCacheStore(l1, l2, l3);

  // Fill L1 beyond capacity
  await store.set("ns", "key1", "v1", makeMeta({ scope: "memory" }));
  await store.set("ns", "key2", "v2", makeMeta({ scope: "memory" }));
  await store.set("ns", "key3", "v3", makeMeta({ scope: "memory" }));

  // key1 should have been evicted
  const result = await store.get<string>("ns", "key1");
  assert.equal(result.hit, false);

  // key2 and key3 should still be accessible
  const r2 = await store.get<string>("ns", "key2");
  assert.equal(r2.hit, true);
  const r3 = await store.get<string>("ns", "key3");
  assert.equal(r3.hit, true);
});
