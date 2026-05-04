/**
 * Unit tests for typed-factories test helpers
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  unsafeCast,
  partial,
  createMockCacheStore,
  createMockCacheFacade,
  createMockCacheMetrics,
} from "../../helpers/typed-factories.js";
import type { CacheStore } from "../../../src/platform/shared/cache/stores/cache-store.js";

test("unsafeCast casts unknown to target type", () => {
  const value: unknown = "hello";
  const result = unsafeCast<string>(value);
  assert.equal(result, "hello");
});

test("unsafeCast handles objects", () => {
  const value: unknown = { foo: "bar" };
  const result = unsafeCast<{ foo: string }>(value);
  assert.equal(result.foo, "bar");
});

test("partial creates partial object", () => {
  const result = partial<{ name: string; age: number }>({ name: "test" });
  assert.equal(result.name, "test");
  assert.strictEqual(result.age, undefined);
});

test("partial handles empty overrides", () => {
  const result = partial<{ a: string }>();
  assert.strictEqual(result.a, undefined);
});

test("createMockCacheStore returns valid CacheStore interface", () => {
  const store = createMockCacheStore();
  assert.equal(typeof store.get, "function");
  assert.equal(typeof store.set, "function");
  assert.equal(typeof store.delete, "function");
  assert.equal(typeof store.invalidateByTag, "function");
  assert.equal(typeof store.invalidateNamespace, "function");
  assert.equal(typeof store.cleanupExpired, "function");
});

test("createMockCacheStore get returns not_found", async () => {
  const store = createMockCacheStore();
  const result = await store.get<string>("namespace", "key");
  assert.equal(result.hit, false);
  assert.strictEqual(result.value, null);
  assert.equal(result.reason, "not_found");
});

test("createMockCacheStore set does not throw", async () => {
  const store = createMockCacheStore();
  await store.set("namespace", "key", "value", {
    ttlMs: 1000,
    tags: [],
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
    hitCount: 0,
    sizeBytes: 100,
    version: "1.0.0",
    scope: "memory",
  });
});

test("createMockCacheStore delete does not throw", async () => {
  const store = createMockCacheStore();
  await store.delete("namespace", "key");
});

test("createMockCacheStore invalidateByTag returns 0", async () => {
  const store = createMockCacheStore();
  const result = await store.invalidateByTag("tag");
  assert.equal(result, 0);
});

test("createMockCacheStore invalidateNamespace returns 0", async () => {
  const store = createMockCacheStore();
  const result = await store.invalidateNamespace("namespace");
  assert.equal(result, 0);
});

test("createMockCacheStore cleanupExpired returns 0", async () => {
  const store = createMockCacheStore();
  const result = await store.cleanupExpired();
  assert.equal(result, 0);
});

test("createMockCacheFacade returns valid facade interface", async () => {
  const facade = createMockCacheFacade();
  assert.equal(typeof facade.get, "function");
  assert.equal(typeof facade.set, "function");
  assert.equal(typeof facade.getOrCompute, "function");
  assert.equal(typeof facade.invalidateByTag, "function");
  assert.equal(typeof facade.invalidateNamespace, "function");
  assert.equal(typeof facade.cleanupExpired, "function");
  assert.equal(typeof facade.getStats, "function");
  assert.equal(typeof facade.resetMetrics, "function");
});

test("createMockCacheMetrics returns valid metrics interface", () => {
  const metrics = createMockCacheMetrics();
  assert.equal(typeof metrics.record, "function");
  assert.equal(typeof metrics.snapshot, "function");
  assert.equal(typeof metrics.reset, "function");
});

test("createMockCacheMetrics snapshot returns default stats", () => {
  const metrics = createMockCacheMetrics();
  const snapshot = metrics.snapshot();
  assert.equal(snapshot.totalHits, 0);
  assert.equal(snapshot.totalMisses, 0);
  assert.equal(snapshot.hitRate, 0);
});