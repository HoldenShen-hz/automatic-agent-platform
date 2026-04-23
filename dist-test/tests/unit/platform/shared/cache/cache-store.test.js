import assert from "node:assert/strict";
import test from "node:test";
test("CacheStore interface structure", () => {
    // CacheStore is an interface, so we can only verify its shape by creating a mock
    const mockStore = {
        get: async (_namespace, _key) => {
            return { hit: false, value: null };
        },
        set: async (_namespace, _key, _value, _meta) => {
            // noop
        },
        delete: async (_namespace, _key) => {
            // noop
        },
        invalidateByTag: async (_tag) => {
            return 0;
        },
        invalidateNamespace: async (_namespace) => {
            return 0;
        },
        cleanupExpired: async () => {
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
    const mockStore = {
        get: async (_namespace, _key) => {
            return {
                hit: true,
                value: "test",
                layer: "L1",
            };
        },
        set: async (_namespace, _key, _value, _meta) => { },
        delete: async (_namespace, _key) => { },
        invalidateByTag: async (_tag) => 0,
        invalidateNamespace: async (_namespace) => 0,
        cleanupExpired: async () => 0,
    };
    const result = await mockStore.get("ns", "key");
    assert.equal(result.hit, true);
    assert.equal(result.value, "test");
    assert.equal(result.layer, "L1");
});
test("CacheStore.get returns miss for missing entry", async () => {
    const mockStore = {
        get: async (_namespace, _key) => {
            return { hit: false, value: null };
        },
        set: async (_namespace, _key, _value, _meta) => { },
        delete: async (_namespace, _key) => { },
        invalidateByTag: async (_tag) => 0,
        invalidateNamespace: async (_namespace) => 0,
        cleanupExpired: async () => 0,
    };
    const result = await mockStore.get("ns", "missing-key");
    assert.equal(result.hit, false);
    assert.equal(result.value, null);
});
test("CacheStore.set accepts value and meta", async () => {
    let capturedValue;
    let capturedMeta;
    const mockStore = {
        get: async (_namespace, _key) => {
            return { hit: false, value: null };
        },
        set: async (_namespace, _key, value, meta) => {
            capturedValue = value;
            capturedMeta = meta;
        },
        delete: async (_namespace, _key) => { },
        invalidateByTag: async (_tag) => 0,
        invalidateNamespace: async (_namespace) => 0,
        cleanupExpired: async () => 0,
    };
    const meta = {
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
    assert.deepEqual(capturedMeta.tags, ["tag1", "tag2"]);
    assert.equal(capturedMeta.scope, "session");
});
test("CacheStore.invalidateByTag returns count of invalidated entries", async () => {
    const mockStore = {
        get: async (_namespace, _key) => {
            return { hit: false, value: null };
        },
        set: async (_namespace, _key, _value, _meta) => { },
        delete: async (_namespace, _key) => { },
        invalidateByTag: async (_tag) => {
            return 5;
        },
        invalidateNamespace: async (_namespace) => 0,
        cleanupExpired: async () => 0,
    };
    const count = await mockStore.invalidateByTag("file:/src/app.ts");
    assert.equal(count, 5);
});
test("CacheStore.invalidateNamespace returns count of invalidated entries", async () => {
    const mockStore = {
        get: async (_namespace, _key) => {
            return { hit: false, value: null };
        },
        set: async (_namespace, _key, _value, _meta) => { },
        delete: async (_namespace, _key) => { },
        invalidateByTag: async (_tag) => 0,
        invalidateNamespace: async (_namespace) => {
            return 10;
        },
        cleanupExpired: async () => 0,
    };
    const count = await mockStore.invalidateNamespace("planner");
    assert.equal(count, 10);
});
test("CacheStore.cleanupExpired returns count of cleaned entries", async () => {
    const mockStore = {
        get: async (_namespace, _key) => {
            return { hit: false, value: null };
        },
        set: async (_namespace, _key, _value, _meta) => { },
        delete: async (_namespace, _key) => { },
        invalidateByTag: async (_tag) => 0,
        invalidateNamespace: async (_namespace) => 0,
        cleanupExpired: async () => {
            return 3;
        },
    };
    const count = await mockStore.cleanupExpired();
    assert.equal(count, 3);
});
//# sourceMappingURL=cache-store.test.js.map