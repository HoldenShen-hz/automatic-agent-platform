/**
 * Unit tests for tests/helpers/typed-factories.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  unsafeCast,
  partial,
  createMockCacheStore,
  createMockCacheFacade,
  createMockCacheMetrics,
} from "../../helpers/typed-factories.js";

describe("typed-factories", () => {
  describe("unsafeCast", () => {
    it("should cast unknown to specified type", () => {
      const value: unknown = { foo: "bar", num: 42 };
      const result = unsafeCast<{ foo: string; num: number }>(value);
      assert.strictEqual(result.foo, "bar");
      assert.strictEqual(result.num, 42);
    });

    it("should preserve primitive values", () => {
      const str: unknown = "hello";
      assert.strictEqual(unsafeCast<string>(str), "hello");

      const num: unknown = 123;
      assert.strictEqual(unsafeCast<number>(num), 123);

      const bool: unknown = true;
      assert.strictEqual(unsafeCast<boolean>(bool), true);
    });

    it("should cast null to any type", () => {
      const value: unknown = null;
      const result = unsafeCast<string>(value);
      assert.strictEqual(result, null);
    });

    it("should cast array to typed array", () => {
      const value: unknown = [1, 2, 3];
      const result = unsafeCast<number[]>(value);
      assert.deepStrictEqual(result, [1, 2, 3]);
    });
  });

  describe("partial", () => {
    it("should return the same object passed in", () => {
      const input = { a: 1, b: "two" };
      const result = partial(input);
      assert.deepStrictEqual(result, { a: 1, b: "two" });
    });

    it("should return empty object when no args", () => {
      const result = partial();
      assert.deepStrictEqual(result, {});
    });

    it("should work with complex nested objects", () => {
      const input = {
        name: "test",
        config: { timeout: 5000, retries: 3 },
        tags: ["unit", "integration"],
      };
      const result = partial(input);
      assert.strictEqual(result.name, "test");
      assert.deepStrictEqual(result.config, { timeout: 5000, retries: 3 });
      assert.deepStrictEqual(result.tags, ["unit", "integration"]);
    });

    it("should allow partial override via spread", () => {
      const base = { x: 1, y: 2 };
      const result = partial<typeof base>({ ...base, x: 100 });
      assert.strictEqual(result.x, 100);
      assert.strictEqual(result.y, 2);
    });
  });

  describe("createMockCacheStore", () => {
    it("should return an object with all cache store methods", () => {
      const store = createMockCacheStore();
      assert.strictEqual(typeof store.get, "function");
      assert.strictEqual(typeof store.set, "function");
      assert.strictEqual(typeof store.delete, "function");
      assert.strictEqual(typeof store.invalidateByTag, "function");
      assert.strictEqual(typeof store.invalidateNamespace, "function");
      assert.strictEqual(typeof store.cleanupExpired, "function");
    });

    it("get should return cache miss by default", async () => {
      const store = createMockCacheStore();
      const result = await store.get<string>("namespace", "key");
      assert.strictEqual(result.hit, false);
      assert.strictEqual(result.value, null);
      assert.strictEqual(result.reason, "not_found");
    });

    it("set should return void", async () => {
      const store = createMockCacheStore();
      const result = await store.set("namespace", "key", "value", {
        scope: "memory",
        tags: [],
        version: "1.0",
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        hitCount: 0,
        sizeBytes: 0,
      });
      assert.strictEqual(result, undefined);
    });

    it("delete should return void", async () => {
      const store = createMockCacheStore();
      const result = await store.delete("namespace", "key");
      assert.strictEqual(result, undefined);
    });

    it("invalidateByTag should return 0", async () => {
      const store = createMockCacheStore();
      const result = await store.invalidateByTag("tag");
      assert.strictEqual(result, 0);
    });

    it("invalidateNamespace should return 0", async () => {
      const store = createMockCacheStore();
      const result = await store.invalidateNamespace("namespace");
      assert.strictEqual(result, 0);
    });

    it("cleanupExpired should return 0", async () => {
      const store = createMockCacheStore();
      const result = await store.cleanupExpired();
      assert.strictEqual(result, 0);
    });
  });

  describe("createMockCacheFacade", () => {
    it("should return an object with cache facade methods", () => {
      const facade = createMockCacheFacade();
      assert.strictEqual(typeof facade.get, "function");
      assert.strictEqual(typeof facade.set, "function");
      assert.strictEqual(typeof facade.getOrCompute, "function");
      assert.strictEqual(typeof facade.invalidateByTag, "function");
      assert.strictEqual(typeof facade.invalidateNamespace, "function");
      assert.strictEqual(typeof facade.cleanupExpired, "function");
      assert.strictEqual(typeof facade.getStats, "function");
      assert.strictEqual(typeof facade.resetMetrics, "function");
    });

    it("get should return cache miss by default", async () => {
      const facade = createMockCacheFacade();
      const result = await facade.get<string>("namespace", "key");
      assert.strictEqual(result.hit, false);
      assert.strictEqual(result.value, null);
      assert.strictEqual(result.reason, "not_found");
    });

    it("getOrCompute should call compute function", async () => {
      const facade = createMockCacheFacade();
      const result = await facade.getOrCompute("namespace", "key", async () => "computed");
      assert.strictEqual(result.value, "computed");
      assert.strictEqual(result.fromCache, false);
    });

    it("getStats should return default stats", async () => {
      const facade = createMockCacheFacade();
      const stats = await facade.getStats();
      assert.deepStrictEqual(stats, {
        totalHits: 0,
        totalMisses: 0,
        hitRate: 0,
        byNamespace: {},
      });
    });

    it("invalidateByTag should return 0", async () => {
      const facade = createMockCacheFacade();
      const result = await facade.invalidateByTag("tag");
      assert.strictEqual(result, 0);
    });

    it("invalidateNamespace should return 0", async () => {
      const facade = createMockCacheFacade();
      const result = await facade.invalidateNamespace("namespace");
      assert.strictEqual(result, 0);
    });

    it("cleanupExpired should return 0", async () => {
      const facade = createMockCacheFacade();
      const result = await facade.cleanupExpired();
      assert.strictEqual(result, 0);
    });

    it("resetMetrics should not throw", () => {
      const facade = createMockCacheFacade();
      assert.doesNotThrow(() => facade.resetMetrics());
    });
  });

  describe("createMockCacheMetrics", () => {
    it("should return an object with metrics methods", () => {
      const metrics = createMockCacheMetrics();
      assert.strictEqual(typeof metrics.record, "function");
      assert.strictEqual(typeof metrics.snapshot, "function");
      assert.strictEqual(typeof metrics.reset, "function");
    });

    it("record should not throw", () => {
      const metrics = createMockCacheMetrics();
      assert.doesNotThrow(() => metrics.record({ hit: false }));
    });

    it("snapshot should return default values", () => {
      const metrics = createMockCacheMetrics();
      const result = metrics.snapshot();
      assert.deepStrictEqual(result, {
        totalHits: 0,
        totalMisses: 0,
        hitRate: 0,
        byNamespace: {},
      });
    });

    it("reset should not throw", () => {
      const metrics = createMockCacheMetrics();
      assert.doesNotThrow(() => metrics.reset());
    });
  });
});
