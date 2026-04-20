import assert from "node:assert/strict";
import test from "node:test";

import { MultiLevelCacheStore } from "../../../../../src/platform/shared/cache/stores/multi-level-cache-store.js";
import { MemoryCacheStore } from "../../../../../src/platform/shared/cache/stores/memory-cache-store.js";
import type { CacheStore } from "../../../../../src/platform/shared/cache/stores/cache-store.js";
import type { CacheMeta, CacheLookupResult } from "../../../../../src/platform/shared/cache/cache-types.js";

function makeMeta(scope: "memory" | "session" | "persistent" = "memory"): CacheMeta {
  return {
    scope,
    tags: [],
    version: "v1",
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
    hitCount: 0,
    sizeBytes: 32,
  };
}

function createMultiLevelStore() {
  const l1 = new MemoryCacheStore(100);
  const l2 = new MemoryCacheStore(100);
  const l3 = new MemoryCacheStore(100);
  return new MultiLevelCacheStore(l1, l2, l3);
}

test("MultiLevelCacheStore.get hits L1 and returns L1 layer", async () => {
  const store = createMultiLevelStore();

  await store.set("ns", "key1", "l1-value", makeMeta("memory"));

  const result = await store.get<string>("ns", "key1");

  assert.equal(result.hit, true);
  assert.equal(result.value, "l1-value");
  assert.equal(result.layer, "L1");
});

test("MultiLevelCacheStore.get returns miss when not found anywhere", async () => {
  const store = createMultiLevelStore();

  const result = await store.get<string>("ns", "nonexistent");

  assert.equal(result.hit, false);
  assert.equal(result.value, null);
  assert.equal(result.reason, "not_found");
});

test("MultiLevelCacheStore.set with memory scope only writes to L1", async () => {
  const store = createMultiLevelStore();

  await store.set("ns", "key1", "mem-scope", makeMeta("memory"));

  const l1Result = await store.get<string>("ns", "key1");
  assert.equal(l1Result.hit, true);

  // L2 and L3 not written for memory scope
  const l2miss = await (store as unknown as { l2: MemoryCacheStore }).l2.get<string>("ns", "key1");
  assert.equal(l2miss.hit, false);
});

test("MultiLevelCacheStore.set with session scope writes to L1 and L2", async () => {
  const store = createMultiLevelStore();

  await store.set("ns", "key1", "session-scope", makeMeta("session"));

  const l1Hit = await store.get<string>("ns", "key1");
  assert.equal(l1Hit.hit, true);

  // L2 should have it
  const l2Store = (store as unknown as { l2: MemoryCacheStore }).l2;
  const l2Hit = await l2Store.get<string>("ns", "key1");
  assert.equal(l2Hit.hit, true, "L2 should have session-scoped entry");
});

test("MultiLevelCacheStore.set with persistent scope writes to all three layers", async () => {
  const store = createMultiLevelStore();

  await store.set("ns", "key1", "persistent-scope", makeMeta("persistent"));

  const l1Hit = await store.get<string>("ns", "key1");
  assert.equal(l1Hit.hit, true);

  const l2Store = (store as unknown as { l2: MemoryCacheStore }).l2;
  const l3Store = (store as unknown as { l3: MemoryCacheStore }).l3;
  assert.equal((await l2Store.get<string>("ns", "key1")).hit, true);
  assert.equal((await l3Store.get<string>("ns", "key1")).hit, true);
});

test("MultiLevelCacheStore.delete removes from all layers", async () => {
  const store = createMultiLevelStore();

  await store.set("ns", "key1", "value", makeMeta("persistent"));
  await store.delete("ns", "key1");

  const result = await store.get<string>("ns", "key1");
  assert.equal(result.hit, false);
});

test("MultiLevelCacheStore.invalidateByTag removes from all layers", async () => {
  const store = createMultiLevelStore();

  await store.set("ns", "key1", "v1", { ...makeMeta("persistent"), tags: ["tag:a"] });
  await store.set("ns", "key2", "v2", { ...makeMeta("persistent"), tags: ["tag:b"] });
  await store.set("ns", "key3", "v3", { ...makeMeta("persistent"), tags: ["tag:a"] });

  const count = await store.invalidateByTag("tag:a");

  assert.equal(count, 2);

  const r1 = await store.get<string>("ns", "key1");
  const r2 = await store.get<string>("ns", "key2");
  const r3 = await store.get<string>("ns", "key3");

  assert.equal(r1.hit, false, "key1 should be removed");
  assert.equal(r2.hit, true, "key2 should remain");
  assert.equal(r3.hit, false, "key3 should be removed");
});

test("MultiLevelCacheStore.invalidateNamespace removes all entries in namespace from all layers", async () => {
  const store = createMultiLevelStore();

  await store.set("ns1", "key1", "v1", makeMeta("persistent"));
  await store.set("ns2", "key2", "v2", makeMeta("persistent"));

  const count = await store.invalidateNamespace("ns1");

  assert.equal(count, 1);

  const r1 = await store.get<string>("ns1", "key1");
  const r2 = await store.get<string>("ns2", "key2");

  assert.equal(r1.hit, false);
  assert.equal(r2.hit, true);
});

test("MultiLevelCacheStore.cleanupExpired delegates to all layers", async () => {
  const store = createMultiLevelStore();
  const now = Date.now();

  await store.set("ns", "expired", "old", {
    ...makeMeta("memory"),
    createdAt: now - 10_000,
    expiresAt: now - 1,
  });
  await store.set("ns", "fresh", "new", {
    ...makeMeta("memory"),
    createdAt: now,
    expiresAt: now + 10_000,
  });

  const cleaned = await store.cleanupExpired();

  assert.equal(cleaned, 1);

  const rExpired = await store.get<string>("ns", "expired");
  const rFresh = await store.get<string>("ns", "fresh");

  assert.equal(rExpired.hit, false);
  assert.equal(rFresh.hit, true);
});

test("MultiLevelCacheStore.getStoreForLayer returns correct store", () => {
  const l1 = new MemoryCacheStore(100);
  const l2 = new MemoryCacheStore(100);
  const l3 = new MemoryCacheStore(100);
  const store = new MultiLevelCacheStore(l1, l2, l3);

  const getStore = (store as unknown as { getStoreForLayer: (layer: string) => MemoryCacheStore }).getStoreForLayer.bind(store);

  assert.equal(getStore("L1"), l1);
  assert.equal(getStore("L2"), l2);
  assert.equal(getStore("L3"), l3);
});

/**
 * Mock cache store that can be configured to throw on specific operations
 */
class ThrowingCacheStore implements CacheStore {
  constructor(
    private readonly shouldThrowOn: Set<string> = new Set(),
  ) {}

  async get<T>(_namespace: string, _key: string): Promise<CacheLookupResult<T>> {
    return { hit: false, value: null, reason: "not_found" };
  }

  async set<T>(_namespace: string, _key: string, _value: T, _meta: CacheMeta): Promise<void> {
    if (this.shouldThrowOn.has("set")) {
      throw new Error("set failed");
    }
  }

  async delete(_namespace: string, _key: string): Promise<void> {
    if (this.shouldThrowOn.has("delete")) {
      throw new Error("delete failed");
    }
  }

  async invalidateByTag(_tag: string): Promise<number> {
    if (this.shouldThrowOn.has("invalidateByTag")) {
      throw new Error("invalidateByTag failed");
    }
    return 0;
  }

  async invalidateNamespace(_namespace: string): Promise<number> {
    if (this.shouldThrowOn.has("invalidateNamespace")) {
      throw new Error("invalidateNamespace failed");
    }
    return 0;
  }

  async cleanupExpired(): Promise<number> {
    if (this.shouldThrowOn.has("cleanupExpired")) {
      throw new Error("cleanupExpired failed");
    }
    return 0;
  }
}

test("MultiLevelCacheStore.delete propagates error when one layer throws", async () => {
  const l1 = new MemoryCacheStore(100);
  const l2 = new ThrowingCacheStore(new Set(["delete"]));
  const l3 = new MemoryCacheStore(100);
  const store = new MultiLevelCacheStore(l1, l2, l3);

  await store.set("ns", "key1", "value", makeMeta("persistent"));

  await assert.rejects(
    () => store.delete("ns", "key1"),
    (err: unknown) => (err as Error).message === "delete failed",
  );
});

test("MultiLevelCacheStore.invalidateByTag propagates error when one layer throws", async () => {
  const l1 = new MemoryCacheStore(100);
  const l2 = new ThrowingCacheStore(new Set(["invalidateByTag"]));
  const l3 = new MemoryCacheStore(100);
  const store = new MultiLevelCacheStore(l1, l2, l3);

  await assert.rejects(
    () => store.invalidateByTag("tag:a"),
    (err: unknown) => (err as Error).message === "invalidateByTag failed",
  );
});

test("MultiLevelCacheStore.invalidateNamespace propagates error when one layer throws", async () => {
  const l1 = new MemoryCacheStore(100);
  const l2 = new ThrowingCacheStore(new Set(["invalidateNamespace"]));
  const l3 = new MemoryCacheStore(100);
  const store = new MultiLevelCacheStore(l1, l2, l3);

  await assert.rejects(
    () => store.invalidateNamespace("ns"),
    (err: unknown) => (err as Error).message === "invalidateNamespace failed",
  );
});

test("MultiLevelCacheStore.cleanupExpired propagates error when one layer throws", async () => {
  const l1 = new MemoryCacheStore(100);
  const l2 = new ThrowingCacheStore(new Set(["cleanupExpired"]));
  const l3 = new MemoryCacheStore(100);
  const store = new MultiLevelCacheStore(l1, l2, l3);

  await assert.rejects(
    () => store.cleanupExpired(),
    (err: unknown) => (err as Error).message === "cleanupExpired failed",
  );
});
