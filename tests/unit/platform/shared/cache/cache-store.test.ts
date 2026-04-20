import assert from "node:assert/strict";
import test from "node:test";

import type { CacheStore } from "../../../../../src/platform/shared/cache/stores/cache-store.js";
import type { CacheLookupResult, CacheMeta, CacheLayer } from "../../../../../src/platform/shared/cache/cache-types.js";

test("CacheStore interface structure", () => {
  // CacheStore is an interface, so we can only verify its shape by creating a mock
  const mockStore: CacheStore = {
    get: async <T>(_namespace: string, _key: string): Promise<CacheLookupResult<T>> => {
      return { hit: false, value: null };
    },
    set: async <T>(_namespace: string, _key: string, _value: T, _meta: CacheMeta): Promise<void> => {
      // noop
    },
    delete: async (_namespace: string, _key: string): Promise<void> => {
      // noop
    },
    invalidateByTag: async (_tag: string): Promise<number> => {
      return 0;
    },
    invalidateNamespace: async (_namespace: string): Promise<number> => {
      return 0;
    },
    cleanupExpired: async (): Promise<number> => {
      return 0;
    },
  };

  assert.equal(typeof mockStore.get, "function");
  assert.equal(typeof mockStore.set, "function");
  assert.equal(typeof mockStore.delete, "function");
  assert.equal(typeof mockStore.invalidateByTag, "function");
  assert.equal(typeof mockStore.invalidateNamespace, "function");
  assert.equal(typeof mockStore.cleanupExpired, "function");
});

test("CacheStore.get returns CacheLookupResult with hit", async () => {
  const mockStore: CacheStore = {
    get: async <T>(_namespace: string, _key: string): Promise<CacheLookupResult<T>> => {
      return {
        hit: true,
        value: "test" as T,
        layer: "L1" as CacheLayer,
      };
    },
    set: async <T>(_namespace: string, _key: string, _value: T, _meta: CacheMeta): Promise<void> => {},
    delete: async (_namespace: string, _key: string): Promise<void> => {},
    invalidateByTag: async (_tag: string): Promise<number> => 0,
    invalidateNamespace: async (_namespace: string): Promise<number> => 0,
    cleanupExpired: async (): Promise<number> => 0,
  };

  const result = await mockStore.get<string>("ns", "key");
  assert.equal(result.hit, true);
  assert.equal(result.value, "test");
  assert.equal(result.layer, "L1");
});

test("CacheStore.get returns miss for missing entry", async () => {
  const mockStore: CacheStore = {
    get: async <T>(_namespace: string, _key: string): Promise<CacheLookupResult<T>> => {
      return { hit: false, value: null };
    },
    set: async <T>(_namespace: string, _key: string, _value: T, _meta: CacheMeta): Promise<void> => {},
    delete: async (_namespace: string, _key: string): Promise<void> => {},
    invalidateByTag: async (_tag: string): Promise<number> => 0,
    invalidateNamespace: async (_namespace: string): Promise<number> => 0,
    cleanupExpired: async (): Promise<number> => 0,
  };

  const result = await mockStore.get<string>("ns", "missing-key");
  assert.equal(result.hit, false);
  assert.equal(result.value, null);
});

test("CacheStore.set accepts value and meta", async () => {
  let capturedValue: string | undefined;
  let capturedMeta: CacheMeta | undefined;

  const mockStore: CacheStore = {
    get: async <T>(_namespace: string, _key: string): Promise<CacheLookupResult<T>> => {
      return { hit: false, value: null };
    },
    set: async <T>(_namespace: string, _key: string, value: T, meta: CacheMeta): Promise<void> => {
      capturedValue = value as string;
      capturedMeta = meta;
    },
    delete: async (_namespace: string, _key: string): Promise<void> => {},
    invalidateByTag: async (_tag: string): Promise<number> => 0,
    invalidateNamespace: async (_namespace: string): Promise<number> => 0,
    cleanupExpired: async (): Promise<number> => 0,
  };

  const meta: CacheMeta = {
    scope: "session",
    tags: ["tag1", "tag2"],
    version: "1.0",
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
    hitCount: 0,
    sizeBytes: 1024,
  };

  await mockStore.set("ns", "key", "test-value", meta);

  assert.equal(capturedValue, "test-value");
  assert.ok(capturedMeta);
  assert.deepEqual(capturedMeta!.tags, ["tag1", "tag2"]);
  assert.equal(capturedMeta!.scope, "session");
});

test("CacheStore.invalidateByTag returns count of invalidated entries", async () => {
  const mockStore: CacheStore = {
    get: async <T>(_namespace: string, _key: string): Promise<CacheLookupResult<T>> => {
      return { hit: false, value: null };
    },
    set: async <T>(_namespace: string, _key: string, _value: T, _meta: CacheMeta): Promise<void> => {},
    delete: async (_namespace: string, _key: string): Promise<void> => {},
    invalidateByTag: async (_tag: string): Promise<number> => {
      return 5;
    },
    invalidateNamespace: async (_namespace: string): Promise<number> => 0,
    cleanupExpired: async (): Promise<number> => 0,
  };

  const count = await mockStore.invalidateByTag("file:/src/app.ts");
  assert.equal(count, 5);
});

test("CacheStore.invalidateNamespace returns count of invalidated entries", async () => {
  const mockStore: CacheStore = {
    get: async <T>(_namespace: string, _key: string): Promise<CacheLookupResult<T>> => {
      return { hit: false, value: null };
    },
    set: async <T>(_namespace: string, _key: string, _value: T, _meta: CacheMeta): Promise<void> => {},
    delete: async (_namespace: string, _key: string): Promise<void> => {},
    invalidateByTag: async (_tag: string): Promise<number> => 0,
    invalidateNamespace: async (_namespace: string): Promise<number> => {
      return 10;
    },
    cleanupExpired: async (): Promise<number> => 0,
  };

  const count = await mockStore.invalidateNamespace("planner");
  assert.equal(count, 10);
});

test("CacheStore.cleanupExpired returns count of cleaned entries", async () => {
  const mockStore: CacheStore = {
    get: async <T>(_namespace: string, _key: string): Promise<CacheLookupResult<T>> => {
      return { hit: false, value: null };
    },
    set: async <T>(_namespace: string, _key: string, _value: T, _meta: CacheMeta): Promise<void> => {},
    delete: async (_namespace: string, _key: string): Promise<void> => {},
    invalidateByTag: async (_tag: string): Promise<number> => 0,
    invalidateNamespace: async (_namespace: string): Promise<number> => 0,
    cleanupExpired: async (): Promise<number> => {
      return 3;
    },
  };

  const count = await mockStore.cleanupExpired();
  assert.equal(count, 3);
});
