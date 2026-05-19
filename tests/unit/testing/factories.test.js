import assert from "node:assert/strict";
import test from "node:test";
import { unsafeCast, partial, createMockCacheStore, createMockCacheFacade, createMockCacheMetrics, } from "../../../tests/helpers/typed-factories.js";
test("unsafeCast casts unknown to specified type", () => {
    const unknownValue = "test string";
    const casted = unsafeCast(unknownValue);
    assert.equal(casted, "test string");
});
test("unsafeCast preserves original value", () => {
    const unknownValue = { key: "value", num: 42 };
    const casted = unsafeCast(unknownValue);
    assert.equal(casted.key, "value");
    assert.equal(casted.num, 42);
});
test("unsafeCast handles null", () => {
    const unknownValue = null;
    const casted = unsafeCast(unknownValue);
    assert.strictEqual(casted, null);
});
test("unsafeCast handles undefined", () => {
    const unknownValue = undefined;
    const casted = unsafeCast(unknownValue);
    assert.strictEqual(casted, undefined);
});
test("unsafeCast handles array", () => {
    const unknownValue = [1, 2, 3];
    const casted = unsafeCast(unknownValue);
    assert.deepEqual(casted, [1, 2, 3]);
});
test("partial returns empty object when no overrides provided", () => {
    const result = partial();
    assert.deepEqual(result, {});
});
test("partial returns object with overrides", () => {
    const result = partial({
        name: "test",
    });
    assert.deepEqual(result, { name: "test" });
});
test("partial preserves partial nature", () => {
    const result = partial({
        required1: "value",
    });
    assert.equal(result.required1, "value");
    assert.strictEqual(result.required2, undefined);
});
test("createMockCacheStore returns object with all CacheStore methods", () => {
    const store = createMockCacheStore();
    assert.ok(typeof store.get === "function", "should have get method");
    assert.ok(typeof store.set === "function", "should have set method");
    assert.ok(typeof store.delete === "function", "should have delete method");
    assert.ok(typeof store.invalidateByTag === "function", "should have invalidateByTag method");
    assert.ok(typeof store.invalidateNamespace === "function", "should have invalidateNamespace method");
    assert.ok(typeof store.cleanupExpired === "function", "should have cleanupExpired method");
});
test("createMockCacheStore.get returns cache miss", async () => {
    const store = createMockCacheStore();
    const result = await store.get("namespace", "key");
    assert.deepEqual(result, {
        hit: false,
        value: null,
        reason: "not_found",
    });
});
test("createMockCacheStore.set is no-op", async () => {
    const store = createMockCacheStore();
    // Should not throw
    await store.set("namespace", "key", "value", {
        scope: "memory",
        ttlMs: 1000,
        tags: [],
        version: "test-v1",
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        hitCount: 0,
        sizeBytes: 5,
    });
    assert.ok(true, "set should complete without error");
});
test("createMockCacheStore.delete is no-op", async () => {
    const store = createMockCacheStore();
    // Should not throw
    await store.delete("namespace", "key");
    assert.ok(true, "delete should complete without error");
});
test("createMockCacheStore.invalidateByTag returns zero", async () => {
    const store = createMockCacheStore();
    const count = await store.invalidateByTag("tag");
    assert.equal(count, 0);
});
test("createMockCacheStore.invalidateNamespace returns zero", async () => {
    const store = createMockCacheStore();
    const count = await store.invalidateNamespace("namespace");
    assert.equal(count, 0);
});
test("createMockCacheStore.cleanupExpired returns zero", async () => {
    const store = createMockCacheStore();
    const count = await store.cleanupExpired();
    assert.equal(count, 0);
});
test("createMockCacheFacade returns object with CacheFacade interface", () => {
    const facade = createMockCacheFacade();
    assert.ok(typeof facade.get === "function", "should have get method");
    assert.ok(typeof facade.set === "function", "should have set method");
    assert.ok(typeof facade.getOrCompute === "function", "should have getOrCompute method");
    assert.ok(typeof facade.invalidateByTag === "function", "should have invalidateByTag method");
    assert.ok(typeof facade.invalidateNamespace === "function", "should have invalidateNamespace method");
    assert.ok(typeof facade.cleanupExpired === "function", "should have cleanupExpired method");
    assert.ok(typeof facade.getStats === "function", "should have getStats method");
    assert.ok(typeof facade.resetMetrics === "function", "should have resetMetrics method");
});
test("createMockCacheFacade.get returns cache miss", async () => {
    const facade = createMockCacheFacade();
    const result = await facade.get("namespace", "key");
    assert.deepEqual(result, {
        hit: false,
        value: null,
        reason: "not_found",
    });
});
test("createMockCacheFacade.set is no-op", async () => {
    const facade = createMockCacheFacade();
    // Should not throw
    await facade.set("namespace", "key", "value");
    assert.ok(true, "set should complete without error");
});
test("createMockCacheFacade.invalidateByTag returns zero", async () => {
    const facade = createMockCacheFacade();
    const count = await facade.invalidateByTag("tag");
    assert.equal(count, 0);
});
test("createMockCacheFacade.invalidateNamespace returns zero", async () => {
    const facade = createMockCacheFacade();
    const count = await facade.invalidateNamespace("namespace");
    assert.equal(count, 0);
});
test("createMockCacheFacade.cleanupExpired returns zero", async () => {
    const facade = createMockCacheFacade();
    const count = await facade.cleanupExpired();
    assert.equal(count, 0);
});
test("createMockCacheFacade.getStats returns default stats", async () => {
    const facade = createMockCacheFacade();
    const stats = await facade.getStats();
    assert.deepEqual(stats, {
        totalHits: 0,
        totalMisses: 0,
        hitRate: 0,
        byNamespace: {},
    });
});
test("createMockCacheFacade.resetMetrics is no-op", () => {
    const facade = createMockCacheFacade();
    // Should not throw
    facade.resetMetrics();
    assert.ok(true, "resetMetrics should complete without error");
});
test("createMockCacheMetrics returns object with CacheMetrics interface", () => {
    const metrics = createMockCacheMetrics();
    assert.ok(typeof metrics.record === "function", "should have record method");
    assert.ok(typeof metrics.snapshot === "function", "should have snapshot method");
    assert.ok(typeof metrics.reset === "function", "should have reset method");
});
test("createMockCacheMetrics.record is no-op", () => {
    const metrics = createMockCacheMetrics();
    // Should not throw
    metrics.record({ namespace: "test", hit: true });
    assert.ok(true, "record should complete without error");
});
test("createMockCacheMetrics.snapshot returns default metrics", () => {
    const metrics = createMockCacheMetrics();
    const snapshot = metrics.snapshot();
    assert.deepEqual(snapshot, {
        totalHits: 0,
        totalMisses: 0,
        hitRate: 0,
        byNamespace: {},
    });
});
test("createMockCacheMetrics.reset is no-op", () => {
    const metrics = createMockCacheMetrics();
    // Should not throw
    metrics.reset();
    assert.ok(true, "reset should complete without error");
});
test("partial works with complex nested types", () => {
    const result = partial({
        id: "test-id",
        config: { enabled: true, timeout: 0 },
    });
    assert.equal(result.id, "test-id");
    assert.deepEqual(result.config, { enabled: true, timeout: 0 });
    assert.strictEqual(result.tags, undefined);
});
test("unsafeCast handles class instances", () => {
    class TestClass {
        value;
        constructor(value) {
            this.value = value;
        }
        getValue() {
            return this.value;
        }
    }
    const instance = new TestClass("hello");
    const unknownValue = instance;
    const casted = unsafeCast(unknownValue);
    assert.equal(casted.getValue(), "hello");
});
test("unsafeCast handles typed arrays", () => {
    const typedArray = new Uint8Array([1, 2, 3, 4]);
    const unknownValue = typedArray;
    const casted = unsafeCast(unknownValue);
    assert.deepEqual(Array.from(casted), [1, 2, 3, 4]);
});
//# sourceMappingURL=factories.test.js.map