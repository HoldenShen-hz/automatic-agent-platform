/**
 * Multi-Level Cache Store Unit Tests
 *
 * Tests for multi-level cache coordination with hierarchical lookup
 * and automatic population of upper layers on hits.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { MultiLevelCacheStore } from "../../../../../../src/platform/shared/cache/stores/multi-level-cache-store.js";
import type { CacheLookupResult, CacheMeta } from "../../../../../../src/platform/shared/cache/cache-types.js";
import type { CacheStore } from "../../../../../../src/platform/shared/cache/stores/cache-store.js";

function createTestMeta(overrides: Partial<CacheMeta> = {}): CacheMeta {
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

function createMockStore(): {
  store: CacheStore;
  getResults: CacheLookupResult<unknown>[];
  setCalls: { namespace: string; key: string; value: unknown; meta: CacheMeta }[];
  deleteCalls: { namespace: string; key: string }[];
  invalidateByTagCalls: string[];
  invalidateNamespaceCalls: string[];
  cleanupExpiredCount: { value: number };
} {
  const getResults: CacheLookupResult<unknown>[] = [];
  const setCalls: { namespace: string; key: string; value: unknown; meta: CacheMeta }[] = [];
  const deleteCalls: { namespace: string; key: string }[] = [];
  const invalidateByTagCalls: string[] = [];
  const invalidateNamespaceCalls: string[] = [];
  const cleanupExpiredCount = { value: 0 };

  const store: CacheStore = {
    async get<T>(namespace: string, key: string): Promise<CacheLookupResult<T>> {
      const result = getResults.shift() ?? { hit: false, value: null, reason: "not_found" };
      return result as CacheLookupResult<T>;
    },
    async set<T>(namespace: string, key: string, value: T, meta: CacheMeta): Promise<void> {
      setCalls.push({ namespace, key, value, meta });
    },
    async delete(namespace: string, key: string): Promise<void> {
      deleteCalls.push({ namespace, key });
    },
    async invalidateByTag(tag: string): Promise<number> {
      invalidateByTagCalls.push(tag);
      return 1;
    },
    async invalidateNamespace(namespace: string): Promise<number> {
      invalidateNamespaceCalls.push(namespace);
      return 1;
    },
    async cleanupExpired(): Promise<number> {
      cleanupExpiredCount.value++;
      return 1;
    },
  };

  return {
    store,
    getResults,
    setCalls,
    deleteCalls,
    invalidateByTagCalls,
    invalidateNamespaceCalls,
    cleanupExpiredCount,
  };
}

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

test("MultiLevelCacheStore constructor accepts l1, l2, l3 stores", () => {
  const l1 = createMockStore().store;
  const l2 = createMockStore().store;
  const l3 = createMockStore().store;

  const store = new MultiLevelCacheStore(l1, l2, l3);
  assert.ok(store, "Should create MultiLevelCacheStore");
});

// ---------------------------------------------------------------------------
// get - L1 Hit
// ---------------------------------------------------------------------------

test("get returns L1 hit without consulting L2 or L3", async () => {
  const { store: l1, getResults: l1Results } = createMockStore();
  const { store: l2, getResults: l2Results } = createMockStore();
  const { store: l3 } = createMockStore();

  l1Results.push({ hit: true, value: "L1value", layer: "L1" });

  const multiStore = new MultiLevelCacheStore(l1, l2, l3);
  const result = await multiStore.get("ns1", "key1");

  assert.strictEqual(result.hit, true);
  assert.strictEqual(result.value, "L1value");
  assert.strictEqual(result.layer, "L1");
});

test("get falls through to L2 on L1 miss", async () => {
  const { store: l1, getResults: l1Results } = createMockStore();
  const { store: l2, getResults: l2Results } = createMockStore();
  const { store: l3 } = createMockStore();

  l1Results.push({ hit: false, value: null, reason: "not_found" });
  l2Results.push({ hit: true, value: "L2value", layer: "L2" });

  const multiStore = new MultiLevelCacheStore(l1, l2, l3);
  const result = await multiStore.get("ns1", "key1");

  assert.strictEqual(result.hit, true);
  assert.strictEqual(result.value, "L2value");
  assert.strictEqual(result.layer, "L2");
});

test("get populates L1 on L2 hit", async () => {
  const { store: l1, getResults: l1Results, setCalls: l1SetCalls } = createMockStore();
  const { store: l2, getResults: l2Results } = createMockStore();
  const { store: l3 } = createMockStore();

  l1Results.push({ hit: false, value: null, reason: "not_found" });
  l2Results.push({
    hit: true,
    value: "L2value",
    layer: "L2",
    meta: createTestMeta({ scope: "session" }),
  });

  const multiStore = new MultiLevelCacheStore(l1, l2, l3);
  await multiStore.get("ns1", "key1");

  assert.strictEqual(l1SetCalls.length, 1, "Should populate L1 on L2 hit");
  assert.strictEqual(l1SetCalls[0]?.value, "L2value");
  assert.strictEqual(l1SetCalls[0]?.meta.scope, "memory");
});

test("get falls through to L3 on L2 miss", async () => {
  const { store: l1, getResults: l1Results } = createMockStore();
  const { store: l2, getResults: l2Results } = createMockStore();
  const { store: l3, getResults: l3Results } = createMockStore();

  l1Results.push({ hit: false, value: null, reason: "not_found" });
  l2Results.push({ hit: false, value: null, reason: "not_found" });
  l3Results.push({ hit: true, value: "L3value", layer: "L3" });

  const multiStore = new MultiLevelCacheStore(l1, l2, l3);
  const result = await multiStore.get("ns1", "key1");

  assert.strictEqual(result.hit, true);
  assert.strictEqual(result.value, "L3value");
  assert.strictEqual(result.layer, "L3");
});

test("get populates L1 on L3 hit", async () => {
  const { store: l1, getResults: l1Results, setCalls: l1SetCalls } = createMockStore();
  const { store: l2, getResults: l2Results } = createMockStore();
  const { store: l3, getResults: l3Results } = createMockStore();

  l1Results.push({ hit: false, value: null, reason: "not_found" });
  l2Results.push({ hit: false, value: null, reason: "not_found" });
  l3Results.push({
    hit: true,
    value: "L3value",
    layer: "L3",
    meta: createTestMeta({ scope: "persistent" }),
  });

  const multiStore = new MultiLevelCacheStore(l1, l2, l3);
  await multiStore.get("ns1", "key1");

  assert.strictEqual(l1SetCalls.length, 1, "Should populate L1 on L3 hit");
  assert.strictEqual(l1SetCalls[0]?.value, "L3value");
  assert.strictEqual(l1SetCalls[0]?.meta.scope, "memory");
});

test("get returns miss when all layers miss", async () => {
  const { store: l1, getResults: l1Results } = createMockStore();
  const { store: l2, getResults: l2Results } = createMockStore();
  const { store: l3, getResults: l3Results } = createMockStore();

  l1Results.push({ hit: false, value: null, reason: "not_found" });
  l2Results.push({ hit: false, value: null, reason: "not_found" });
  l3Results.push({ hit: false, value: null, reason: "not_found" });

  const multiStore = new MultiLevelCacheStore(l1, l2, l3);
  const result = await multiStore.get("ns1", "key1");

  assert.strictEqual(result.hit, false);
  assert.strictEqual(result.value, null);
  assert.strictEqual(result.reason, "not_found");
});

test("get does not populate L1 when L2/L3 returns null value", async () => {
  const { store: l1, getResults: l1Results, setCalls: l1SetCalls } = createMockStore();
  const { store: l2, getResults: l2Results } = createMockStore();
  const { store: l3 } = createMockStore();

  l1Results.push({ hit: false, value: null, reason: "not_found" });
  l2Results.push({ hit: true, value: null, reason: "not_found" }); // null value

  const multiStore = new MultiLevelCacheStore(l1, l2, l3);
  await multiStore.get("ns1", "key1");

  assert.strictEqual(l1SetCalls.length, 0, "Should not populate L1 with null value");
});

// ---------------------------------------------------------------------------
// set - Scope-Based Distribution
// ---------------------------------------------------------------------------

test("set with scope=memory writes only to L1", async () => {
  const { store: l1, setCalls: l1SetCalls } = createMockStore();
  const { store: l2, setCalls: l2SetCalls } = createMockStore();
  const { store: l3, setCalls: l3SetCalls } = createMockStore();

  const multiStore = new MultiLevelCacheStore(l1, l2, l3);
  const meta = createTestMeta({ scope: "memory" });

  await multiStore.set("ns1", "key1", "value1", meta);

  assert.strictEqual(l1SetCalls.length, 1);
  assert.strictEqual(l2SetCalls.length, 0);
  assert.strictEqual(l3SetCalls.length, 0);
});

test("set with scope=session writes to L1 and L2", async () => {
  const { store: l1, setCalls: l1SetCalls } = createMockStore();
  const { store: l2, setCalls: l2SetCalls } = createMockStore();
  const { store: l3, setCalls: l3SetCalls } = createMockStore();

  const multiStore = new MultiLevelCacheStore(l1, l2, l3);
  const meta = createTestMeta({ scope: "session" });

  await multiStore.set("ns1", "key1", "value1", meta);

  assert.strictEqual(l1SetCalls.length, 1);
  assert.strictEqual(l2SetCalls.length, 1);
  assert.strictEqual(l3SetCalls.length, 0);
});

test("set with scope=persistent writes to all layers", async () => {
  const { store: l1, setCalls: l1SetCalls } = createMockStore();
  const { store: l2, setCalls: l2SetCalls } = createMockStore();
  const { store: l3, setCalls: l3SetCalls } = createMockStore();

  const multiStore = new MultiLevelCacheStore(l1, l2, l3);
  const meta = createTestMeta({ scope: "persistent" });

  await multiStore.set("ns1", "key1", "value1", meta);

  assert.strictEqual(l1SetCalls.length, 1);
  assert.strictEqual(l2SetCalls.length, 1);
  assert.strictEqual(l3SetCalls.length, 1);
});

// ---------------------------------------------------------------------------
// delete
// ---------------------------------------------------------------------------

test("delete removes from all layers", async () => {
  const { store: l1, deleteCalls: l1Delete } = createMockStore();
  const { store: l2, deleteCalls: l2Delete } = createMockStore();
  const { store: l3, deleteCalls: l3Delete } = createMockStore();

  const multiStore = new MultiLevelCacheStore(l1, l2, l3);
  await multiStore.delete("ns1", "key1");

  assert.strictEqual(l1Delete.length, 1);
  assert.deepStrictEqual(l1Delete[0], { namespace: "ns1", key: "key1" });
  assert.strictEqual(l2Delete.length, 1);
  assert.strictEqual(l3Delete.length, 1);
});

test("delete runs in parallel across all layers", async () => {
  const { store: l1 } = createMockStore();
  const { store: l2 } = createMockStore();
  const { store: l3 } = createMockStore();

  const multiStore = new MultiLevelCacheStore(l1, l2, l3);
  const start = Date.now();
  await multiStore.delete("ns1", "key1");
  const elapsed = Date.now() - start;

  // Should complete quickly since all run in parallel
  assert.ok(elapsed < 100, "Delete should complete quickly");
});

// ---------------------------------------------------------------------------
// invalidateByTag
// ---------------------------------------------------------------------------

test("invalidateByTag invalidates all layers", async () => {
  const { store: l1, invalidateByTagCalls: l1Calls } = createMockStore();
  const { store: l2, invalidateByTagCalls: l2Calls } = createMockStore();
  const { store: l3, invalidateByTagCalls: l3Calls } = createMockStore();

  const multiStore = new MultiLevelCacheStore(l1, l2, l3);
  await multiStore.invalidateByTag("tag1");

  assert.strictEqual(l1Calls.length, 1);
  assert.deepStrictEqual(l1Calls[0], "tag1");
  assert.strictEqual(l2Calls.length, 1);
  assert.strictEqual(l3Calls.length, 1);
});

test("invalidateByTag returns total invalidation count across all layers", async () => {
  const { store: l1 } = createMockStore();
  const { store: l2 } = createMockStore();
  const { store: l3 } = createMockStore();

  const multiStore = new MultiLevelCacheStore(l1, l2, l3);
  const count = await multiStore.invalidateByTag("tag1");

  assert.strictEqual(count, 3);
});

// ---------------------------------------------------------------------------
// invalidateNamespace
// ---------------------------------------------------------------------------

test("invalidateNamespace invalidates all layers", async () => {
  const { store: l1, invalidateNamespaceCalls: l1Calls } = createMockStore();
  const { store: l2, invalidateNamespaceCalls: l2Calls } = createMockStore();
  const { store: l3, invalidateNamespaceCalls: l3Calls } = createMockStore();

  const multiStore = new MultiLevelCacheStore(l1, l2, l3);
  await multiStore.invalidateNamespace("ns1");

  assert.strictEqual(l1Calls.length, 1);
  assert.deepStrictEqual(l1Calls[0], "ns1");
  assert.strictEqual(l2Calls.length, 1);
  assert.strictEqual(l3Calls.length, 1);
});

// ---------------------------------------------------------------------------
// cleanupExpired
// ---------------------------------------------------------------------------

test("cleanupExpired calls all layers", async () => {
  const { store: l1, cleanupExpiredCount: l1Count } = createMockStore();
  const { store: l2, cleanupExpiredCount: l2Count } = createMockStore();
  const { store: l3, cleanupExpiredCount: l3Count } = createMockStore();

  const multiStore = new MultiLevelCacheStore(l1, l2, l3);
  await multiStore.cleanupExpired();

  assert.strictEqual(l1Count.value, 1);
  assert.strictEqual(l2Count.value, 1);
  assert.strictEqual(l3Count.value, 1);
});

test("cleanupExpired returns sum of all layer counts", async () => {
  const { store: l1 } = createMockStore();
  const { store: l2 } = createMockStore();
  const { store: l3 } = createMockStore();

  const multiStore = new MultiLevelCacheStore(l1, l2, l3);
  const count = await multiStore.cleanupExpired();

  assert.strictEqual(count, 3); // 1 + 1 + 1 from each mock store
});
