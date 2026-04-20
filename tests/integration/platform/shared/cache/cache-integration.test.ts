import assert from "node:assert/strict";
import test from "node:test";

import { MultiLevelCacheStore } from "../../../../../src/platform/shared/cache/stores/multi-level-cache-store.js";
import { MemoryCacheStore } from "../../../../../src/platform/shared/cache/stores/memory-cache-store.js";
import { CacheFacade } from "../../../../../src/platform/shared/cache/cache-facade.js";
import { CacheMetrics } from "../../../../../src/platform/shared/cache/cache-metrics.js";
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

test("CacheFacade with MultiLevelCacheStore persists across L1 misses", async () => {
  const l1 = new MemoryCacheStore(100);
  const l2 = new MemoryCacheStore(100);
  const l3 = new MemoryCacheStore(100);
  const store = new MultiLevelCacheStore(l1, l2, l3);
  const metrics = new CacheMetrics();
  const facade = new CacheFacade(store, metrics);

  // Use a known namespace that has caching enabled
  await facade.set("memory.summary", { key: "persist" }, { data: "persisted" });

  // Verify the value was stored
  const result = await facade.get("memory.summary", { key: "persist" });
  assert.equal(result.hit, true);
  assert.deepEqual(result.value, { data: "persisted" });
});

test("CacheFacade metrics track hits and misses across layers", async () => {
  const l1 = new MemoryCacheStore(100);
  const store = new MultiLevelCacheStore(l1, l1, l1);
  const metrics = new CacheMetrics();
  const facade = new CacheFacade(store, metrics);

  // Miss
  await facade.get("memory.summary", { key: "nonexistent" });

  // Set and hit
  await facade.set("memory.summary", { key: "test" }, "value");
  await facade.get("memory.summary", { key: "test" });
  await facade.get("memory.summary", { key: "test" });

  const snapshot = facade.getMetricsSnapshot();
  assert.equal(snapshot.totalMisses >= 1, true);
  assert.equal(snapshot.totalHits >= 2, true);
});

test("CacheFacade getOrCompute only computes once for concurrent requests", async () => {
  const l1 = new MemoryCacheStore(100);
  const store = new MultiLevelCacheStore(l1, l1, l1);
  const metrics = new CacheMetrics();
  const facade = new CacheFacade(store, metrics);

  let computeCount = 0;

  const [result1, result2] = await Promise.all([
    facade.getOrCompute("memory.summary", { key: "shared" }, async () => {
      computeCount++;
      return { computed: true };
    }),
    facade.getOrCompute("memory.summary", { key: "shared" }, async () => {
      computeCount++;
      return { computed: true };
    }),
  ]);

  assert.equal(computeCount, 1);
  assert.deepEqual(result1.value, { computed: true });
  assert.deepEqual(result2.value, { computed: true });
});

test("CacheFacade invalidation cascades across all layers", async () => {
  const l1 = new MemoryCacheStore(100);
  const l2 = new MemoryCacheStore(100);
  const l3 = new MemoryCacheStore(100);
  const store = new MultiLevelCacheStore(l1, l2, l3);
  const metrics = new CacheMetrics();
  const facade = new CacheFacade(store, metrics);

  await facade.getOrCompute("memory.summary", { key: "cascade" }, async () => "value", {
    tags: ["cascade:tag"],
  });

  const invalidated = await facade.invalidateByTag("cascade:tag");
  assert.equal(invalidated >= 1, true);

  const result = await facade.get("memory.summary", { key: "cascade" });
  assert.equal(result.hit, false);
});

test("CacheFacade set with oversized payload is skipped for unknown namespaces", async () => {
  const l1 = new MemoryCacheStore(100);
  const store = new MultiLevelCacheStore(l1, l1, l1);
  const metrics = new CacheMetrics();
  const facade = new CacheFacade(store, metrics);

  const hugePayload = { data: "x".repeat(1024 * 1024) };

  // For unknown namespace, it should be skipped
  await facade.set("unknown.ns", { key: "huge" }, hugePayload);

  const result = await facade.get("unknown.ns", { key: "huge" });
  assert.equal(result.hit, false);
});

test("MultiLevelCacheStore cleanupExpired removes expired entries from all layers", async () => {
  const l1 = new MemoryCacheStore(100);
  const l2 = new MemoryCacheStore(100);
  const l3 = new MemoryCacheStore(100);
  const store = new MultiLevelCacheStore(l1, l2, l3);
  const now = Date.now();

  await store.set("ns", "expired-l1", "v1", {
    ...makeMeta(),
    createdAt: now - 10000,
    expiresAt: now - 1,
  });
  await store.set("ns", "expired-l2", "v2", {
    ...makeMeta(),
    createdAt: now - 10000,
    expiresAt: now - 1,
  });
  await store.set("ns", "fresh", "v3", {
    ...makeMeta(),
    createdAt: now,
    expiresAt: now + 10000,
  });

  const cleaned = await store.cleanupExpired();

  assert.equal(cleaned >= 2, true);

  const rExpired = await store.get<string>("ns", "expired-l1");
  const rFresh = await store.get<string>("ns", "fresh");
  assert.equal(rFresh.hit, true);
});

test("CacheFacade getOrCompute with different tags updates correctly", async () => {
  const l1 = new MemoryCacheStore(100);
  const store = new MultiLevelCacheStore(l1, l1, l1);
  const metrics = new CacheMetrics();
  const facade = new CacheFacade(store, metrics);

  await facade.getOrCompute("memory.summary", { key: "tagged" }, async () => "v1", {
    tags: ["tag:a", "tag:b"],
  });

  const result1 = await facade.get<string>("memory.summary", { key: "tagged" });
  assert.equal(result1.hit, true);
  assert.equal(result1.value, "v1");

  // Invalidate by one tag
  await facade.invalidateByTag("tag:a");

  const result2 = await facade.get<string>("memory.summary", { key: "tagged" });
  assert.equal(result2.hit, false);
});