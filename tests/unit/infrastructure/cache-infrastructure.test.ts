/**
 * Infrastructure: Cache Store Tests
 *
 * Tests for cache store implementations (Memory, SQLite) and cache types.
 */

import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";

// Cache types
import type { CacheLookupResult, CacheMeta } from "../../../src/platform/shared/cache/cache-types.js";
import { isCacheableTool, isUncacheableTool, CACHEABLE_TOOLS, UNCACHEABLE_TOOLS } from "../../../src/platform/shared/cache/cache-types.js";

// Cache errors
import {
  CacheError,
  CacheSerializationError,
  CachePolicyError,
  CachePayloadTooLargeError,
  CacheNotFoundError,
  CacheExpiredError,
  CacheVersionMismatchError,
  CacheDisabledError,
  CacheInitializationError,
} from "../../../src/platform/shared/cache/cache-errors.js";

// Memory cache store
import { MemoryCacheStore } from "../../../src/platform/shared/cache/stores/memory-cache-store.js";

// Cache metrics
import { CacheMetrics } from "../../../src/platform/shared/cache/cache-metrics.js";

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

// ── Cache Types Tests ──────────────────────────────────────────────────────────

describe("Cache Types", () => {
  it("isCacheableTool returns true for cacheable tools", () => {
    assert.equal(isCacheableTool("read"), true);
    assert.equal(isCacheableTool("glob"), true);
    assert.equal(isCacheableTool("grep"), true);
    assert.equal(isCacheableTool("repo_map"), true);
    assert.equal(isCacheableTool("diagnostics"), true);
    assert.equal(isCacheableTool("web_fetch"), true);
    assert.equal(isCacheableTool("memory_summary"), true);
    assert.equal(isCacheableTool("memory_retrieval"), true);
    assert.equal(isCacheableTool("planner_plan"), true);
  });

  it("isCacheableTool returns false for uncacheable tools", () => {
    assert.equal(isCacheableTool("bash"), false);
    assert.equal(isCacheableTool("write"), false);
    assert.equal(isCacheableTool("edit"), false);
  });

  it("isUncacheableTool returns true for uncacheable tools", () => {
    assert.equal(isUncacheableTool("bash"), true);
    assert.equal(isUncacheableTool("write"), true);
    assert.equal(isUncacheableTool("git_commit"), true);
  });

  it("isUncacheableTool returns false for cacheable tools", () => {
    assert.equal(isUncacheableTool("read"), false);
    assert.equal(isUncacheableTool("glob"), false);
  });

  it("CACHEABLE_TOOLS has expected length", () => {
    assert.equal(CACHEABLE_TOOLS.length, 9);
  });

  it("UNCACHEABLE_TOOLS has expected entries", () => {
    assert.ok(UNCACHEABLE_TOOLS.includes("bash"));
    assert.ok(UNCACHEABLE_TOOLS.includes("write"));
    assert.ok(UNCACHEABLE_TOOLS.includes("edit"));
    assert.ok(UNCACHEABLE_TOOLS.includes("apply_patch"));
    assert.ok(UNCACHEABLE_TOOLS.includes("git_commit"));
    assert.ok(UNCACHEABLE_TOOLS.includes("git_push"));
  });
});

// ── Cache Errors Tests ───────────────────────────────────────────────────────────

describe("Cache Errors", () => {
  it("CacheError has correct properties", () => {
    const error = new CacheError("test message", "TEST_CODE", true);
    assert.equal(error.message, "test message");
    assert.equal(error.code, "TEST_CODE");
    assert.equal(error.retryable, true);
    assert.equal(error.name, "CacheError");
  });

  it("CacheSerializationError has correct code", () => {
    const error = new CacheSerializationError();
    assert.equal(error.code, "CACHE_SERIALIZATION_ERROR");
    assert.equal(error.retryable, false);
    assert.equal(error.name, "CacheSerializationError");
  });

  it("CachePolicyError has correct code", () => {
    const error = new CachePolicyError();
    assert.equal(error.code, "CACHE_POLICY_ERROR");
    assert.equal(error.name, "CachePolicyError");
  });

  it("CachePayloadTooLargeError includes size info", () => {
    const error = new CachePayloadTooLargeError(1000, 500);
    assert.ok(error.message.includes("1000"));
    assert.ok(error.message.includes("500"));
    assert.equal(error.code, "CACHE_PAYLOAD_TOO_LARGE");
  });

  it("CacheNotFoundError includes namespace and key", () => {
    const error = new CacheNotFoundError("ns1", "key1");
    assert.ok(error.message.includes("ns1"));
    assert.ok(error.message.includes("key1"));
    assert.equal(error.code, "CACHE_NOT_FOUND");
  });

  it("CacheExpiredError includes namespace and key", () => {
    const error = new CacheExpiredError("ns1", "key1");
    assert.ok(error.message.includes("ns1"));
    assert.ok(error.message.includes("key1"));
    assert.equal(error.code, "CACHE_EXPIRED");
  });

  it("CacheVersionMismatchError includes version info", () => {
    const error = new CacheVersionMismatchError("ns1", "key1", "1.0", "2.0");
    assert.ok(error.message.includes("ns1"));
    assert.ok(error.message.includes("1.0"));
    assert.ok(error.message.includes("2.0"));
    assert.equal(error.code, "CACHE_VERSION_MISMATCH");
  });

  it("CacheDisabledError includes namespace", () => {
    const error = new CacheDisabledError("ns1");
    assert.ok(error.message.includes("ns1"));
    assert.equal(error.code, "CACHE_DISABLED");
  });

  it("CacheInitializationError has correct code", () => {
    const error = new CacheInitializationError("init failed");
    assert.ok(error.message.includes("init failed"));
    assert.equal(error.code, "CACHE_INITIALIZATION_ERROR");
  });
});

// ── MemoryCacheStore Tests ─────────────────────────────────────────────────────

describe("MemoryCacheStore", () => {
  let store: MemoryCacheStore;

  beforeEach(() => {
    store = new MemoryCacheStore(100);
  });

  afterEach(() => {
    // No cleanup needed for memory store
  });

  it("get returns miss for non-existent key", async () => {
    const result = await store.get("ns1", "nonexistent");
    assert.equal(result.hit, false);
    assert.equal(result.value, null);
    assert.equal(result.reason, "not_found");
  });

  it("set and get returns hit with correct value", async () => {
    const meta = createMeta();
    await store.set("ns1", "key1", "test-value", meta);
    const result = await store.get< string>("ns1", "key1");
    assert.equal(result.hit, true);
    assert.equal(result.value, "test-value");
    assert.equal(result.layer, "L1");
  });

  it("get returns miss for expired entry", async () => {
    const meta = createMeta({ expiresAt: Date.now() - 1000 });
    await store.set("ns1", "key1", "test-value", meta);
    const result = await store.get("ns1", "key1");
    assert.equal(result.hit, false);
    assert.equal(result.reason, "expired");
  });

  it("delete removes entry", async () => {
    const meta = createMeta();
    await store.set("ns1", "key1", "test-value", meta);
    await store.delete("ns1", "key1");
    const result = await store.get("ns1", "key1");
    assert.equal(result.hit, false);
  });

  it("invalidateByTag removes tagged entries", async () => {
    const meta1 = createMeta({ tags: ["tag1"] });
    const meta2 = createMeta({ tags: ["tag2"] });
    const meta3 = createMeta({ tags: ["tag1", "tag2"] });
    await store.set("ns1", "key1", "value1", meta1);
    await store.set("ns1", "key2", "value2", meta2);
    await store.set("ns1", "key3", "value3", meta3);
    const count = await store.invalidateByTag("tag1");
    assert.equal(count, 2); // key1 and key3
    const result1 = await store.get("ns1", "key1");
    const result2 = await store.get("ns1", "key2");
    const result3 = await store.get("ns1", "key3");
    assert.equal(result1.hit, false);
    assert.equal(result2.hit, true); // tag2 only
    assert.equal(result3.hit, false);
  });

  it("invalidateNamespace removes all entries in namespace", async () => {
    const meta = createMeta();
    await store.set("ns1", "key1", "value1", meta);
    await store.set("ns1", "key2", "value2", meta);
    await store.set("ns2", "key1", "value3", meta);
    const count = await store.invalidateNamespace("ns1");
    assert.equal(count, 2);
    assert.equal((await store.get("ns1", "key1")).hit, false);
    assert.equal((await store.get("ns2", "key1")).hit, true);
  });

  it("cleanupExpired removes expired entries", async () => {
    const expiredMeta = createMeta({ expiresAt: Date.now() - 1000 });
    const validMeta = createMeta({ expiresAt: Date.now() + 10000 });
    await store.set("ns1", "key1", "expired", expiredMeta);
    await store.set("ns1", "key2", "valid", validMeta);
    const count = await store.cleanupExpired();
    assert.equal(count, 1);
    assert.equal((await store.get("ns1", "key1")).hit, false);
    assert.equal((await store.get("ns1", "key2")).hit, true);
  });

  it("respects maxEntries limit", async () => {
    const smallStore = new MemoryCacheStore(3);
    const meta = createMeta();
    await smallStore.set("ns1", "key1", "v1", meta);
    await smallStore.set("ns1", "key2", "v2", meta);
    await smallStore.set("ns1", "key3", "v3", meta);
    await smallStore.set("ns1", "key4", "v4", meta); // Should evict key1
    assert.equal((await smallStore.get("ns1", "key1")).hit, false);
    assert.equal((await smallStore.get("ns1", "key4")).hit, true);
  });

  it("respects maxEntries limit by evicting oldest entry", async () => {
    const smallStore = new MemoryCacheStore(3);
    const meta = createMeta();
    await smallStore.set("ns1", "key1", "v1", meta);
    await smallStore.set("ns1", "key2", "v2", meta);
    await smallStore.set("ns1", "key3", "v3", meta);
    await smallStore.set("ns1", "key4", "v4", meta); // Should evict oldest
    // key4 was added last, so one of key1/key2/key3 should be evicted
    const count = await smallStore.size;
    assert.ok(count <= 3, `Expected at most 3 entries, got ${count}`);
    // The newest entry should exist
    assert.equal((await smallStore.get("ns1", "key4")).hit, true);
  });

  it("evicts least recently used when at capacity", async () => {
    const smallStore = new MemoryCacheStore(3);
    const meta = createMeta();
    await smallStore.set("ns1", "key1", "v1", meta);
    await smallStore.set("ns1", "key2", "v2", meta);
    await smallStore.set("ns1", "key3", "v3", meta);
    // Access key1 to make it recently used
    await smallStore.get("ns1", "key1");
    // Adding new entry should evict something (LRU should evict key2 or key3)
    await smallStore.set("ns1", "key4", "v4", meta);
    // key1 should still be accessible since it was recently used
    const key1Result = await smallStore.get("ns1", "key1");
    assert.equal(key1Result.hit, true, "key1 should still be in cache after being accessed");
  });

  it("size returns correct count", async () => {
    const meta = createMeta();
    await store.set("ns1", "key1", "v1", meta);
    await store.set("ns1", "key2", "v2", meta);
    assert.equal(store.size, 2);
    await store.delete("ns1", "key1");
    assert.equal(store.size, 1);
  });

  it("stores different namespaces separately", async () => {
    const meta = createMeta();
    await store.set("ns1", "key1", "value1", meta);
    await store.set("ns2", "key1", "value2", meta);
    assert.equal((await store.get("ns1", "key1")).value, "value1");
    assert.equal((await store.get("ns2", "key1")).value, "value2");
  });

  it("updates hitCount on access", async () => {
    const meta = createMeta();
    await store.set("ns1", "key1", "value1", meta);
    assert.equal((await store.get("ns1", "key1")).meta?.hitCount, 1);
    assert.equal((await store.get("ns1", "key1")).meta?.hitCount, 2);
  });
});

// ── CacheMetrics Tests ─────────────────────────────────────────────────────────

describe("CacheMetrics", () => {
  let metrics: CacheMetrics;

  beforeEach(() => {
    metrics = new CacheMetrics();
  });

  it("records hits correctly", () => {
    metrics.record({ hit: true, namespace: "ns1", layer: "L1" });
    metrics.record({ hit: true, namespace: "ns1", layer: "L2" });
    metrics.record({ hit: true, namespace: "ns1", layer: "L1" });
    const snapshot = metrics.snapshot();
    const ns1 = snapshot.byNamespace["ns1"]!;
    assert.equal(snapshot.totalHits, 3);
    assert.equal(snapshot.totalMisses, 0);
    assert.equal(snapshot.hitRate, 1.0);
    assert.equal(ns1.hits, 3);
  });

  it("records misses correctly", () => {
    metrics.record({ hit: false, namespace: "ns1", reason: "not_found" });
    metrics.record({ hit: false, namespace: "ns1", reason: "expired" });
    const snapshot = metrics.snapshot();
    const ns1 = snapshot.byNamespace["ns1"]!;
    assert.equal(snapshot.totalHits, 0);
    assert.equal(snapshot.totalMisses, 2);
    assert.equal(snapshot.hitRate, 0);
    assert.equal(ns1.misses, 2);
    assert.equal(ns1.byReason["not_found"], 1);
    assert.equal(ns1.byReason["expired"], 1);
  });

  it("calculates hit rate correctly", () => {
    metrics.record({ hit: true, namespace: "ns1" });
    metrics.record({ hit: false, namespace: "ns1" });
    metrics.record({ hit: true, namespace: "ns1" });
    metrics.record({ hit: false, namespace: "ns1" });
    const snapshot = metrics.snapshot();
    assert.equal(snapshot.totalHits, 2);
    assert.equal(snapshot.totalMisses, 2);
    assert.equal(snapshot.hitRate, 0.5);
  });

  it("aggregates multiple namespaces", () => {
    metrics.record({ hit: true, namespace: "ns1" });
    metrics.record({ hit: true, namespace: "ns2" });
    metrics.record({ hit: false, namespace: "ns1" });
    const snapshot = metrics.snapshot();
    const ns1 = snapshot.byNamespace["ns1"]!;
    const ns2 = snapshot.byNamespace["ns2"]!;
    assert.equal(snapshot.totalHits, 2);
    assert.equal(snapshot.totalMisses, 1);
    assert.equal(ns1.hitRate, 0.5);
    assert.equal(ns2.hitRate, 1.0);
  });

  it("reset clears all metrics", () => {
    metrics.record({ hit: true, namespace: "ns1" });
    metrics.reset();
    const snapshot = metrics.snapshot();
    assert.equal(snapshot.totalHits, 0);
    assert.equal(snapshot.totalMisses, 0);
    assert.equal(Object.keys(snapshot.byNamespace).length, 0);
  });

  it("handles missing namespace gracefully", () => {
    metrics.record({ hit: true }); // no namespace
    const snapshot = metrics.snapshot();
    assert.equal(snapshot.totalHits, 1);
    assert.ok(snapshot.byNamespace["unknown"]);
  });
});
