/**
 * Infrastructure: Multi-Level Cache Store Tests
 *
 * Tests for the multi-level cache store that coordinates L1, L2, and L3 cache layers.
 */

import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";

// Cache types
import type {
  CacheLayer,
  CacheLookupResult,
  CacheMeta,
} from "../../../src/platform/shared/cache/cache-types.js";

// Cache store interface
import type { CacheStore } from "../../../src/platform/shared/cache/stores/cache-store.js";

// Multi-level cache store
import { MultiLevelCacheStore } from "../../../src/platform/shared/cache/stores/multi-level-cache-store.js";

// Memory cache store for testing
import { MemoryCacheStore } from "../../../src/platform/shared/cache/stores/memory-cache-store.js";

function createMeta(overrides: Partial<CacheMeta> = {}): CacheMeta {
  const now = Date.now();
  return {
    scope: "memory",
    ttlMs: 1000,
    tags: [],
    version: "1.0.0",
    createdAt: now,
    expiresAt: now + 1000,
    lastAccessedAt: now,
    hitCount: 0,
    sizeBytes: 0,
    ...overrides,
  };
}

// ── Mock Cache Store Implementation ──────────────────────────────────────────

/**
 * Mock cache store for testing multi-level coordination.
 * Can simulate hits, misses, and failures at each layer.
 */
class MockCacheStore implements CacheStore {
  private storage = new Map<string, { value: unknown; meta: CacheMeta }>();
  private failGet = false;
  private failSet = false;

  constructor(
    private readonly name: string,
    private hitRate = 1.0, // 0.0 to 1.0
    private latencyMs = 0,
  ) {}

  setHitRate(rate: number) {
    this.hitRate = rate;
  }

  shouldFailGet() {
    this.failGet = true;
  }

  shouldFailSet() {
    this.failSet = true;
  }

  reset() {
    this.storage.clear();
    this.failGet = false;
    this.failSet = false;
  }

  async get<T>(namespace: string, key: string): Promise<CacheLookupResult<T>> {
    if (this.failGet) {
      throw new Error(`${this.name}: get failed`);
    }
    await new Promise((r) => setTimeout(r, this.latencyMs));
    const fullKey = `${namespace}::${key}`;
    const entry = this.storage.get(fullKey);
    if (!entry) {
      return { hit: false, value: null, reason: "not_found" };
    }
    if (entry.meta.expiresAt && entry.meta.expiresAt <= Date.now()) {
      this.storage.delete(fullKey);
      return { hit: false, value: null, reason: "expired" };
    }
    return {
      hit: Math.random() < this.hitRate,
      value: entry.value as T,
      layer: this.name as CacheLayer,
      meta: entry.meta,
    };
  }

  async set<T>(namespace: string, key: string, value: T, meta: CacheMeta): Promise<void> {
    if (this.failSet) {
      throw new Error(`${this.name}: set failed`);
    }
    await new Promise((r) => setTimeout(r, this.latencyMs));
    const fullKey = `${namespace}::${key}`;
    this.storage.set(fullKey, { value, meta });
  }

  async delete(namespace: string, key: string): Promise<void> {
    const fullKey = `${namespace}::${key}`;
    this.storage.delete(fullKey);
  }

  async invalidateByTag(tag: string): Promise<number> {
    let count = 0;
    for (const [fullKey, entry] of this.storage.entries()) {
      if (entry.meta.tags.includes(tag)) {
        this.storage.delete(fullKey);
        count++;
      }
    }
    return count;
  }

  async invalidateNamespace(namespace: string): Promise<number> {
    let count = 0;
    const prefix = `${namespace}::`;
    for (const key of this.storage.keys()) {
      if (key.startsWith(prefix)) {
        this.storage.delete(key);
        count++;
      }
    }
    return count;
  }

  async cleanupExpired(): Promise<number> {
    let count = 0;
    const now = Date.now();
    for (const [key, entry] of this.storage.entries()) {
      if (entry.meta.expiresAt && entry.meta.expiresAt <= now) {
        this.storage.delete(key);
        count++;
      }
    }
    return count;
  }
}

// ── MultiLevelCacheStore Tests ─────────────────────────────────────────────────

describe("MultiLevelCacheStore", () => {
  let l1: MemoryCacheStore;
  let l2: MemoryCacheStore;
  let l3: MemoryCacheStore;
  let multiLevel: MultiLevelCacheStore;

  beforeEach(() => {
    l1 = new MemoryCacheStore(100);
    l2 = new MemoryCacheStore(100);
    l3 = new MemoryCacheStore(100);
    multiLevel = new MultiLevelCacheStore(l1, l2, l3);
  });

  it("returns L1 hit when entry exists in L1", async () => {
    const meta = createMeta();
    await l1.set("ns1", "key1", "l1-value", meta);
    const result = await multiLevel.get("ns1", "key1");
    assert.equal(result.hit, true);
    assert.equal(result.value, "l1-value");
    assert.equal(result.layer, "L1");
  });

  it("backfills L1 from L2 on L2 hit", async () => {
    const meta = createMeta();
    await l2.set("ns1", "key1", "l2-value", meta);
    const result = await multiLevel.get("ns1", "key1");
    assert.equal(result.hit, true);
    assert.equal(result.value, "l2-value");
    assert.equal(result.layer, "L2");
    // L1 should now have the value too
    const l1Result = await l1.get("ns1", "key1");
    assert.equal(l1Result.hit, true);
    assert.equal(l1Result.value, "l2-value");
  });

  it("backfills L1 from L3 on L3 hit", async () => {
    const meta = createMeta();
    await l3.set("ns1", "key1", "l3-value", meta);
    const result = await multiLevel.get("ns1", "key1");
    assert.equal(result.hit, true);
    assert.equal(result.value, "l3-value");
    assert.equal(result.layer, "L3");
    // L1 should now have the value too
    const l1Result = await l1.get("ns1", "key1");
    assert.equal(l1Result.hit, true);
  });

  it("returns miss when not found in any layer", async () => {
    const result = await multiLevel.get("ns1", "nonexistent");
    assert.equal(result.hit, false);
    assert.equal(result.value, null);
    assert.equal(result.reason, "not_found");
  });

  it("set with memory scope only sets L1", async () => {
    const meta = createMeta({ scope: "memory" });
    await multiLevel.set("ns1", "key1", "value1", meta);
    assert.equal((await l1.get("ns1", "key1")).hit, true);
    // L2 and L3 should not have the value
    assert.equal((await l2.get("ns1", "key1")).hit, false);
    assert.equal((await l3.get("ns1", "key1")).hit, false);
  });

  it("set with session scope sets L1 and L2", async () => {
    const meta = createMeta({ scope: "session" });
    await multiLevel.set("ns1", "key1", "value1", meta);
    assert.equal((await l1.get("ns1", "key1")).hit, true);
    assert.equal((await l2.get("ns1", "key1")).hit, true);
    assert.equal((await l3.get("ns1", "key1")).hit, false);
  });

  it("set with persistent scope sets all layers", async () => {
    const meta = createMeta({ scope: "persistent" });
    await multiLevel.set("ns1", "key1", "value1", meta);
    assert.equal((await l1.get("ns1", "key1")).hit, true);
    assert.equal((await l2.get("ns1", "key1")).hit, true);
    assert.equal((await l3.get("ns1", "key1")).hit, true);
  });

  it("delete removes from all layers", async () => {
    const meta = createMeta({ scope: "persistent" });
    await multiLevel.set("ns1", "key1", "value1", meta);
    await multiLevel.delete("ns1", "key1");
    assert.equal((await l1.get("ns1", "key1")).hit, false);
    assert.equal((await l2.get("ns1", "key1")).hit, false);
    assert.equal((await l3.get("ns1", "key1")).hit, false);
  });

  it("invalidateByTag removes tagged entries from all layers", async () => {
    const meta1 = createMeta({ scope: "persistent", tags: ["tag1"] });
    const meta2 = createMeta({ scope: "persistent", tags: ["tag2"] });
    await multiLevel.set("ns1", "key1", "value1", meta1);
    await multiLevel.set("ns1", "key2", "value2", meta2);
    const count = await multiLevel.invalidateByTag("tag1");
    // key1 was set in all 3 layers with persistent scope, so we get 3 (1 from each layer)
    assert.equal(count, 3);
    assert.equal((await l1.get("ns1", "key1")).hit, false);
    assert.equal((await l1.get("ns1", "key2")).hit, true); // tag2 only
  });

  it("invalidateNamespace removes all entries from namespace", async () => {
    const meta = createMeta({ scope: "persistent" });
    await multiLevel.set("ns1", "key1", "v1", meta);
    await multiLevel.set("ns1", "key2", "v2", meta);
    await multiLevel.set("ns2", "key1", "v3", meta);
    const count = await multiLevel.invalidateNamespace("ns1");
    // Each key was set in all 3 layers (L1, L2, L3), so 2 keys * 3 layers = 6
    assert.equal(count, 6);
    assert.equal((await l1.get("ns1", "key1")).hit, false);
    assert.equal((await l1.get("ns2", "key1")).hit, true);
  });

  it("cleanupExpired removes expired entries from all layers", async () => {
    const expiredMeta = createMeta({ scope: "persistent", expiresAt: Date.now() - 1000 });
    const validMeta = createMeta({ scope: "persistent", expiresAt: Date.now() + 10000 });
    await multiLevel.set("ns1", "key1", "expired", expiredMeta);
    await multiLevel.set("ns1", "key2", "valid", validMeta);
    const count = await multiLevel.cleanupExpired();
    // expired entry was in all 3 layers
    assert.equal(count, 3);
    assert.equal((await l1.get("ns1", "key1")).hit, false);
    assert.equal((await l1.get("ns1", "key2")).hit, true);
  });

  it("handles backfill failure gracefully", async () => {
    // Create a store that fails on set (used as L1)
    const failingL1 = new MockCacheStore("L1-fail");
    failingL1.shouldFailSet();
    const multiLevelWithFailingL1 = new MultiLevelCacheStore(failingL1, l2, l3);
    const meta = createMeta();
    await l2.set("ns1", "key1", "l2-value", meta);
    // Backfill should fail but not throw - result should still have L2 hit
    const result = await multiLevelWithFailingL1.get("ns1", "key1");
    assert.equal(result.hit, true);
    assert.equal(result.layer, "L2");
    assert.equal(result.backfillFailed, true);
  });

  it("queries layers in order L1 -> L2 -> L3", async () => {
    const meta = createMeta();
    // Only set in L3
    await l3.set("ns1", "key1", "l3-value", meta);
    const result = await multiLevel.get("ns1", "key1");
    assert.equal(result.hit, true);
    assert.equal(result.value, "l3-value");
    assert.equal(result.layer, "L3");
  });

  it("uses L1 value for scope even when backfilled from lower layer", async () => {
    const meta = createMeta({ scope: "persistent" });
    // Set in L2 only (not L1)
    await l2.set("ns1", "key1", "l2-value", meta);
    const result = await multiLevel.get("ns1", "key1");
    assert.equal(result.hit, true);
    assert.equal(result.layer, "L2");
    // After backfill, L1 should now have it too
    const l1Result = await l1.get("ns1", "key1");
    assert.equal(l1Result.hit, true);
  });
});

// ── Layer Ordering Tests ───────────────────────────────────────────────────────

describe("MultiLevelCacheStore Layer Ordering", () => {
  it("prefers L1 over L2 even when L2 has newer value", async () => {
    const l1 = new MemoryCacheStore(100);
    const l2 = new MemoryCacheStore(100);
    const l3 = new MemoryCacheStore(100);
    const multiLevel = new MultiLevelCacheStore(l1, l2, l3);
    const meta1 = createMeta();
    const meta2 = createMeta();
    await l1.set("ns1", "key1", "l1-value", meta1);
    await l2.set("ns1", "key1", "l2-value", meta2);
    const result = await multiLevel.get("ns1", "key1");
    assert.equal(result.value, "l1-value");
    assert.equal(result.layer, "L1");
  });

  it("prefers L2 over L3 when L1 miss", async () => {
    const l1 = new MemoryCacheStore(100);
    const l2 = new MemoryCacheStore(100);
    const l3 = new MemoryCacheStore(100);
    const multiLevel = new MultiLevelCacheStore(l1, l2, l3);
    const meta2 = createMeta();
    const meta3 = createMeta();
    await l2.set("ns1", "key1", "l2-value", meta2);
    await l3.set("ns1", "key1", "l3-value", meta3);
    const result = await multiLevel.get("ns1", "key1");
    assert.equal(result.value, "l2-value");
    assert.equal(result.layer, "L2");
  });

  it("marks backfillFailed when L1 backfill fails", async () => {
    const failingL1 = new MockCacheStore("L1", 1.0);
    failingL1.shouldFailSet();
    const l2 = new MemoryCacheStore(100);
    const l3 = new MemoryCacheStore(100);
    const multiLevel = new MultiLevelCacheStore(failingL1, l2, l3);
    const meta = createMeta({ scope: "persistent" });
    await l2.set("ns1", "key1", "l2-value", meta);
    const result = await multiLevel.get("ns1", "key1");
    assert.equal(result.hit, true);
    assert.equal(result.layer, "L2");
    assert.equal(result.backfillFailed, true);
  });
});
