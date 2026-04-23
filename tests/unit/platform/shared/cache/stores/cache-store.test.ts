/**
 * Unit tests for CacheStore interface.
 */

import test from "node:test";
import assert from "node:assert/strict";

import type { CacheStore } from "../../../../../../src/platform/shared/cache/stores/cache-store.js";
import type { CacheLookupResult, CacheMeta } from "../../../../../../src/platform/shared/cache/cache-types.js";

test("CacheStore interface can be satisfied by a mock implementation", async () => {
  const store: CacheStore = {
    async get<T>(_namespace: string, _key: string): Promise<CacheLookupResult<T>> {
      return { hit: false, value: null, reason: "not_found" };
    },
    async set<T>(_namespace: string, _key: string, _value: T, _meta: CacheMeta): Promise<void> {
      // no-op
    },
    async delete(_namespace: string, _key: string): Promise<void> {
      // no-op
    },
    async invalidateByTag(_tag: string): Promise<number> {
      return 0;
    },
    async invalidateNamespace(_namespace: string): Promise<number> {
      return 0;
    },
    async cleanupExpired(): Promise<number> {
      return 0;
    },
  };

  const result = await store.get<string>("ns", "key");
  assert.equal(result.hit, false);
});

test("CacheStore.get returns hit with value when cache exists", async () => {
  const store: CacheStore = {
    async get<T>(_namespace: string, _key: string): Promise<CacheLookupResult<T>> {
      return { hit: true, value: "cached-value" as T, layer: "L1" };
    },
    async set<T>(): Promise<void> {},
    async delete(): Promise<void> {},
    async invalidateByTag(): Promise<number> { return 0; },
    async invalidateNamespace(): Promise<number> { return 0; },
    async cleanupExpired(): Promise<number> { return 0; },
  };

  const result = await store.get<string>("ns", "key");
  assert.equal(result.hit, true);
  assert.equal(result.value, "cached-value");
  assert.equal(result.layer, "L1");
});

test("CacheStore.set stores value with meta", async () => {
  const store: CacheStore = {
    async get<T>(): Promise<CacheLookupResult<T>> {
      return { hit: false, value: null, reason: "not_found" };
    },
    async set<T>(_namespace: string, _key: string, _value: T, meta: CacheMeta): Promise<void> {
      // Verify meta has expected structure
      assert.ok(meta);
      assert.deepEqual(meta.tags, ["tag1"]);
      assert.equal(meta.scope, "session");
    },
    async delete(): Promise<void> {},
    async invalidateByTag(): Promise<number> { return 0; },
    async invalidateNamespace(): Promise<number> { return 0; },
    async cleanupExpired(): Promise<number> { return 0; },
  };

  await store.set("ns", "key", "value", {
    scope: "session",
    tags: ["tag1"],
    version: "v1",
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
    hitCount: 0,
    sizeBytes: 100,
  });
});

test("CacheStore.invalidateByTag returns count of invalidated entries", async () => {
  const store: CacheStore = {
    async get<T>(): Promise<CacheLookupResult<T>> { return { hit: false, value: null, reason: "not_found" }; },
    async set<T>(): Promise<void> {},
    async delete(): Promise<void> {},
    async invalidateByTag(_tag: string): Promise<number> {
      return 5;
    },
    async invalidateNamespace(): Promise<number> { return 0; },
    async cleanupExpired(): Promise<number> { return 0; },
  };

  const count = await store.invalidateByTag("file:/src/index.ts");
  assert.equal(count, 5);
});

test("CacheStore.invalidateNamespace returns count of invalidated entries", async () => {
  const store: CacheStore = {
    async get<T>(): Promise<CacheLookupResult<T>> { return { hit: false, value: null, reason: "not_found" }; },
    async set<T>(): Promise<void> {},
    async delete(): Promise<void> {},
    async invalidateByTag(): Promise<number> { return 0; },
    async invalidateNamespace(_namespace: string): Promise<number> {
      return 3;
    },
    async cleanupExpired(): Promise<number> { return 0; },
  };

  const count = await store.invalidateNamespace("tool.read");
  assert.equal(count, 3);
});

test("CacheStore.cleanupExpired returns count of cleaned entries", async () => {
  const store: CacheStore = {
    async get<T>(): Promise<CacheLookupResult<T>> { return { hit: false, value: null, reason: "not_found" }; },
    async set<T>(): Promise<void> {},
    async delete(): Promise<void> {},
    async invalidateByTag(): Promise<number> { return 0; },
    async invalidateNamespace(): Promise<number> { return 0; },
    async cleanupExpired(): Promise<number> {
      return 2;
    },
  };

  const count = await store.cleanupExpired();
  assert.equal(count, 2);
});