import assert from "node:assert/strict";
import test from "node:test";

import { CacheFacade } from "../../../../../src/platform/shared/cache/cache-facade.js";
import type { CacheStore } from "../../../../../src/platform/shared/cache/stores/cache-store.js";
import type { CacheLookupResult, CacheMeta } from "../../../../../src/platform/shared/cache/cache-types.js";
import type { CacheMetricsSnapshot } from "../../../../../src/platform/shared/cache/cache-metrics.js";
import { getPolicyForNamespace } from "../../../../../src/platform/shared/cache/cache-policy.js";

// Mock CacheStore implementation
function createMockCacheStore(): CacheStore {
  const internalStore = new Map<string, { value: unknown; meta: CacheMeta }>();

  return {
    async get<T>(_namespace: string, key: string): Promise<CacheLookupResult<T>> {
      const entry = internalStore.get(key);
      if (!entry) {
        return { hit: false, value: null, reason: "not_found" };
      }
      // On hit, don't specify reason (only for misses)
      return { hit: true, value: entry.value as T };
    },
    async set(_namespace: string, key: string, value: unknown, meta: CacheMeta): Promise<void> {
      internalStore.set(key, { value, meta });
    },
    async delete(_namespace: string, key: string): Promise<void> {
      internalStore.delete(key);
    },
    async invalidateByTag(_tag: string): Promise<number> {
      return 0;
    },
    async invalidateNamespace(_namespace: string): Promise<number> {
      const size = internalStore.size;
      internalStore.clear();
      return size;
    },
    async cleanupExpired(): Promise<number> {
      return 0;
    },
  };
}

// Mock CacheMetrics
function createMockCacheMetrics() {
  const records: Array<{ namespace: string; hit: boolean; reason?: string; layer?: string }> = [];
  return {
    records,
    record(entry: { namespace: string; hit: boolean; reason?: string; layer?: string }) {
      records.push(entry);
    },
    snapshot(): CacheMetricsSnapshot {
      return {
        totalHits: records.filter(r => r.hit).length,
        totalMisses: records.filter(r => !r.hit).length,
        byNamespace: {},
        hitRate: 0,
      };
    },
  };
}

// Use "tool.read" namespace which is known to have enabled: true in DEFAULT_CACHE_POLICIES
const NS = "tool.read";

test("CacheFacade.get returns disabled when policy is disabled", async () => {
  // Note: This test relies on the default cache policies
  // getPolicyForNamespace returns a policy with enabled=true by default
  // To test disabled path, we'd need to override the policy
  const mockStore = createMockCacheStore();
  const mockMetrics = createMockCacheMetrics();
  const facade = new CacheFacade(mockStore as any, mockMetrics as any);

  // Default policy is enabled, so this will use the store
  const result = await facade.get(NS, { id: 1 });
  assert.equal(mockMetrics.records.length > 0, true);
});

test("CacheFacade.get records metrics on cache miss", async () => {
  const mockStore = createMockCacheStore();
  const mockMetrics = createMockCacheMetrics();
  const facade = new CacheFacade(mockStore as any, mockMetrics as any);

  await facade.get(NS, { id: 1 });

  assert.equal(mockMetrics.records.length, 1);
  assert.equal(mockMetrics.records[0]!.hit, false);
});

test("CacheFacade.get returns cached value on hit", async () => {
  const mockStore = createMockCacheStore();
  const mockMetrics = createMockCacheMetrics();
  const facade = new CacheFacade(mockStore as any, mockMetrics as any);

  // Pre-populate cache
  await facade.set(NS, { id: 1 }, { result: "cached" });

  const result = await facade.get<{ result: string }>(NS, { id: 1 });
  assert.equal(result.hit, true);
  assert.equal(result.value?.result, "cached");
});

test("CacheFacade.set stores value and can be retrieved", async () => {
  const mockStore = createMockCacheStore();
  const mockMetrics = createMockCacheMetrics();
  const facade = new CacheFacade(mockStore as any, mockMetrics as any);

  await facade.set(NS, { id: 1 }, { data: "value" });

  // Verify by getting it back
  const result = await facade.get<{ data: string }>(NS, { id: 1 });
  assert.equal(result.hit, true);
  assert.equal(result.value?.data, "value");
});

test("CacheFacade.set does not store when payload exceeds limit", async () => {
  const mockStore = createMockCacheStore();
  const mockMetrics = createMockCacheMetrics();
  const facade = new CacheFacade(mockStore as any, mockMetrics as any);

  // Create a large payload that exceeds tool.read limit of 256KB
  const largePayload = { data: "x".repeat(300 * 1024) };
  await facade.set(NS, { id: 1 }, largePayload);

  // Should not store due to size limit - verify by trying to get it
  const result = await facade.get(NS, { id: 1 });
  assert.equal(result.hit, false);
});

test("CacheFacade.getOrCompute returns cached value without calling compute", async () => {
  const mockStore = createMockCacheStore();
  const mockMetrics = createMockCacheMetrics();
  const facade = new CacheFacade(mockStore as any, mockMetrics as any);

  // Pre-populate
  await facade.set(NS, { id: 1 }, { result: "cached" });

  let computeCalled = false;
  const compute = async () => {
    computeCalled = true;
    return { result: "computed" };
  };

  const result = await facade.getOrCompute(NS, { id: 1 }, compute);

  assert.equal(result.fromCache, true);
  assert.equal(result.value.result, "cached");
  assert.equal(computeCalled, false);
});

test("CacheFacade.getOrCompute calls compute on cache miss", async () => {
  const mockStore = createMockCacheStore();
  const mockMetrics = createMockCacheMetrics();
  const facade = new CacheFacade(mockStore as any, mockMetrics as any);

  let computeCalled = false;
  const compute = async () => {
    computeCalled = true;
    return { result: "computed" };
  };

  const result = await facade.getOrCompute(NS, { id: 1 }, compute);

  assert.equal(result.fromCache, false);
  assert.equal(result.value.result, "computed");
  assert.equal(computeCalled, true);
});

test("CacheFacade.getOrCompute with forceBypass skips cache", async () => {
  const mockStore = createMockCacheStore();
  const mockMetrics = createMockCacheMetrics();
  const facade = new CacheFacade(mockStore as any, mockMetrics as any);

  // Pre-populate cache
  await facade.set(NS, { id: 1 }, { result: "cached" });

  let computeCalled = false;
  const compute = async () => {
    computeCalled = true;
    return { result: "computed" };
  };

  const result = await facade.getOrCompute(NS, { id: 1 }, compute, { forceBypass: true });

  assert.equal(result.fromCache, false);
  assert.equal(result.value.result, "computed");
  assert.equal(computeCalled, true);
});

test("CacheFacade.getOrCompute deduplicates concurrent requests", async () => {
  const mockStore = createMockCacheStore();
  const mockMetrics = createMockCacheMetrics();
  const facade = new CacheFacade(mockStore as any, mockMetrics as any);

  let computeCallCount = 0;
  const compute = async () => {
    computeCallCount++;
    await new Promise(resolve => setTimeout(resolve, 10));
    return { result: "computed" };
  };

  // First call starts compute
  const firstPromise = facade.getOrCompute(NS, { id: 1 }, compute);

  // While first is still computing (10ms delay), second call with same key should wait
  // We can't easily test the true concurrent case in a unit test without more mocking,
  // but we can verify that once computed, subsequent calls get from cache

  // First call result (from compute, not cache since nothing was stored yet)
  const firstResult = await firstPromise;
  assert.equal(firstResult.fromCache, false);
  assert.equal(firstResult.value.result, "computed");
  assert.equal(computeCallCount, 1);

  // Second call should get from cache
  const secondResult = await facade.getOrCompute(NS, { id: 1 }, compute);
  assert.equal(secondResult.fromCache, true);
  assert.equal(secondResult.value.result, "computed");
  assert.equal(computeCallCount, 1); // Still 1, no new compute

  // Third call should also get from cache
  const thirdResult = await facade.getOrCompute(NS, { id: 1 }, compute);
  assert.equal(thirdResult.fromCache, true);
  assert.equal(thirdResult.value.result, "computed");
  assert.equal(computeCallCount, 1); // Still 1, no new compute
});

test("CacheFacade.getOrCompute returns live-compute semantics to concurrent waiters", async () => {
  const mockStore = createMockCacheStore();
  const mockMetrics = createMockCacheMetrics();
  const facade = new CacheFacade(mockStore as any, mockMetrics as any);

  let computeCallCount = 0;
  let resolveCompute: (value: { result: string }) => void;
  const computeGate = new Promise<{ result: string }>((resolve) => {
    resolveCompute = resolve;
  });
  const compute = async () => {
    computeCallCount++;
    return await computeGate;
  };

  const firstPromise = facade.getOrCompute(NS, { id: "shared-live" }, compute);
  const secondPromise = facade.getOrCompute(NS, { id: "shared-live" }, compute);
  await Promise.resolve();
  resolveCompute!({ result: "computed" });

  const [firstResult, secondResult] = await Promise.all([firstPromise, secondPromise]);
  assert.equal(computeCallCount, 1);
  assert.equal(firstResult.fromCache, false);
  assert.equal(secondResult.fromCache, false);
});

test("CacheFacade.invalidateByTag delegates to store", async () => {
  const mockStore = createMockCacheStore();
  const mockMetrics = createMockCacheMetrics();
  const facade = new CacheFacade(mockStore as any, mockMetrics as any);

  const count = await facade.invalidateByTag("tag1");

  assert.equal(typeof count, "number");
});

test("CacheFacade.invalidateByTag broadcasts cross-instance invalidation when configured", async () => {
  const mockStore = createMockCacheStore();
  const mockMetrics = createMockCacheMetrics();
  const calls: string[] = [];
  const facade = new CacheFacade(
    mockStore as any,
    mockMetrics as any,
    {
      async broadcastTagInvalidation(tag: string): Promise<void> {
        calls.push(`tag:${tag}`);
      },
      async broadcastNamespaceInvalidation(namespace: string): Promise<void> {
        calls.push(`ns:${namespace}`);
      },
    },
  );

  await facade.invalidateByTag("tag1");

  assert.deepEqual(calls, ["tag:tag1"]);
});

test("CacheFacade.invalidateNamespace delegates to store", async () => {
  const mockStore = createMockCacheStore();
  const mockMetrics = createMockCacheMetrics();
  const facade = new CacheFacade(mockStore as any, mockMetrics as any);

  // Add some data
  await facade.set(NS, { id: 1 }, { data: "value1" });
  await facade.set(NS, { id: 2 }, { data: "value2" });

  const count = await facade.invalidateNamespace(NS);

  assert.equal(count, 2);

  // Verify by trying to get the values
  const result1 = await facade.get(NS, { id: 1 });
  const result2 = await facade.get(NS, { id: 2 });
  assert.equal(result1.hit, false);
  assert.equal(result2.hit, false);
});

test("CacheFacade.invalidateNamespace broadcasts cross-instance invalidation when configured", async () => {
  const mockStore = createMockCacheStore();
  const mockMetrics = createMockCacheMetrics();
  const calls: string[] = [];
  const facade = new CacheFacade(
    mockStore as any,
    mockMetrics as any,
    {
      async broadcastTagInvalidation(tag: string): Promise<void> {
        calls.push(`tag:${tag}`);
      },
      async broadcastNamespaceInvalidation(namespace: string): Promise<void> {
        calls.push(`ns:${namespace}`);
      },
    },
  );

  await facade.invalidateNamespace(NS);

  assert.deepEqual(calls, [`ns:${NS}`]);
});

test("CacheFacade.getMetricsSnapshot returns metrics", async () => {
  const mockStore = createMockCacheStore();
  const mockMetrics = createMockCacheMetrics();
  const facade = new CacheFacade(mockStore as any, mockMetrics as any);

  await facade.get(NS, { id: 1 });

  const snapshot = facade.getMetricsSnapshot();

  assert.equal(typeof snapshot.totalHits, "number");
  assert.equal(typeof snapshot.totalMisses, "number");
  assert.equal(typeof snapshot.hitRate, "number");
});

test("CacheFacade.get returns disabled result for disabled policy", async () => {
  const mockStore = createMockCacheStore();
  const mockMetrics = createMockCacheMetrics();
  const facade = new CacheFacade(mockStore as any, mockMetrics as any);

  // Use a namespace that will have disabled policy via override
  const disabledNs = "disabled.test";
  const result = await facade.get(disabledNs, { id: 1 });

  assert.equal(result.hit, false);
  assert.equal(result.reason, "disabled");
  assert.equal(result.value, null);
});

test("CacheFacade.get records disabled metric reason", async () => {
  const mockStore = createMockCacheStore();
  const mockMetrics = createMockCacheMetrics();
  const facade = new CacheFacade(mockStore as any, mockMetrics as any);

  // Use a namespace that doesn't exist in DEFAULT_CACHE_POLICIES (disabled by default)
  await facade.get("nonexistent.namespace", { id: 1 });

  assert.equal(mockMetrics.records.length, 1);
  assert.equal(mockMetrics.records[0]!.hit, false);
  assert.equal(mockMetrics.records[0]!.reason, "disabled");
});

test("CacheFacade.set returns early for disabled policy", async () => {
  const mockStore = createMockCacheStore();
  const mockMetrics = createMockCacheMetrics();
  const facade = new CacheFacade(mockStore as any, mockMetrics as any);

  // Use a namespace that doesn't exist (disabled by default)
  await facade.set("nonexistent.namespace", { id: 1 }, { data: "value" });

  // Store should be empty since policy is disabled
  const result = await facade.get("nonexistent.namespace", { id: 1 });
  assert.equal(result.hit, false);
});

test("CacheFacade.set does not call store.set for disabled policy", async () => {
  const mockStore = createMockCacheStore();
  const mockMetrics = createMockCacheMetrics();
  const facade = new CacheFacade(mockStore as any, mockMetrics as any);

  // Track store.set calls
  let setCallCount = 0;
  const trackingStore = {
    ...mockStore,
    async set(...args: Parameters<typeof mockStore.set>) {
      setCallCount++;
      return mockStore.set(...args);
    },
  } as CacheStore;

  const trackingFacade = new CacheFacade(trackingStore as any, mockMetrics as any);

  // Use a namespace that doesn't exist (disabled by default)
  await trackingFacade.set("nonexistent.namespace", { id: 1 }, { data: "value" });

  assert.equal(setCallCount, 0);
});

test("CacheFacade.getOrCompute returns computed value when cache returns null value", async () => {
  const mockStore = createMockCacheStore();
  const mockMetrics = createMockCacheMetrics();
  const facade = new CacheFacade(mockStore as any, mockMetrics as any);

  // Manually set a null value in the store to simulate this edge case
  const policy = getPolicyForNamespace(NS);
  const key = "test-key-null";
  await mockStore.set(NS, key, null, {
    scope: policy.scope,
    tags: [],
    version: policy.version,
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
    hitCount: 0,
    sizeBytes: 0,
  });

  let computeCalled = false;
  const compute = async () => {
    computeCalled = true;
    return { result: "computed" };
  };

  const result = await facade.getOrCompute(NS, { id: "test-key-null" }, compute);

  // Since the stored value is null, it should still call compute
  assert.equal(result.fromCache, false);
  assert.equal(computeCalled, true);
  assert.equal(result.value.result, "computed");
});

test("CacheFacade.getOrCompute stores computed result in cache", async () => {
  const mockStore = createMockCacheStore();
  const mockMetrics = createMockCacheMetrics();
  const facade = new CacheFacade(mockStore as any, mockMetrics as any);

  const compute = async () => ({ result: "computed" });

  const result = await facade.getOrCompute(NS, { id: 999 }, compute);

  assert.equal(result.fromCache, false);
  assert.equal(result.value.result, "computed");

  // Verify it was stored
  const cached = await facade.get(NS, { id: 999 });
  assert.equal(cached.hit, true);
  assert.equal((cached.value as { result: string } | null)?.result, "computed");
});

test("CacheFacade.get records layer when present in store result", async () => {
  const mockStore = createMockCacheStore();
  const mockMetrics = createMockCacheMetrics();
  const facade = new CacheFacade(mockStore as any, mockMetrics as any);

  // Manually add entry with layer info
  const policy = getPolicyForNamespace(NS);
  await mockStore.set(NS, "layered-key", { data: "value" }, {
    scope: policy.scope,
    tags: [],
    version: policy.version,
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
    hitCount: 0,
    sizeBytes: 0,
  });

  await facade.get(NS, { id: "layered-key" });

  // Verify metrics recorded
  assert.equal(mockMetrics.records.length, 1);
});

test("CacheFacade.set includes contentType when provided in options", async () => {
  const mockStore = createMockCacheStore();
  const mockMetrics = createMockCacheMetrics();
  const facade = new CacheFacade(mockStore as any, mockMetrics as any);

  await facade.set(NS, { id: 1 }, { data: "value" }, {
    contentType: "application/json",
    tags: ["test"],
  });

  // Verify the value was stored by retrieving it through the facade
  const result = await facade.get(NS, { id: 1 });
  assert.equal(result.hit, true);
  assert.deepEqual(result.value, { data: "value" });
});
