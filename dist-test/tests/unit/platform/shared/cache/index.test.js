import assert from "node:assert/strict";
import test from "node:test";
test("CacheScope type accepts valid values", () => {
    const scopes = ["memory", "session", "persistent"];
    assert.equal(scopes.length, 3);
});
test("CacheLayer type accepts valid values", () => {
    const layers = ["L1", "L2", "L3"];
    assert.equal(layers.length, 3);
});
test("CacheMissReason type accepts valid values", () => {
    const reasons = [
        "not_found",
        "expired",
        "invalidated",
        "version_mismatch",
        "payload_too_large",
        "disabled",
        "not_cacheable",
    ];
    assert.equal(reasons.length, 7);
});
test("CacheMeta structure is correct", () => {
    const meta = {
        scope: "memory",
        ttlMs: 60000,
        tags: ["tag1", "tag2"],
        version: "1.0.0",
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        hitCount: 0,
        sizeBytes: 1024,
    };
    assert.equal(meta.scope, "memory");
    assert.equal(meta.ttlMs, 60000);
    assert.equal(meta.tags.length, 2);
});
test("CacheEntry structure is correct", () => {
    const entry = {
        namespace: "test",
        key: "key1",
        value: "test-value",
        meta: {
            scope: "session",
            tags: [],
            version: "1.0",
            createdAt: Date.now(),
            lastAccessedAt: Date.now(),
            hitCount: 0,
            sizeBytes: 256,
        },
    };
    assert.equal(entry.namespace, "test");
    assert.equal(entry.key, "key1");
    assert.equal(entry.value, "test-value");
});
test("CacheLookupResult structure is correct", () => {
    const result = {
        hit: true,
        value: "cached-value",
        layer: "L1",
    };
    assert.equal(result.hit, true);
    assert.equal(result.value, "cached-value");
    assert.equal(result.layer, "L1");
});
test("CacheLookupResult miss structure is correct", () => {
    const result = {
        hit: false,
        value: null,
        reason: "not_found",
    };
    assert.equal(result.hit, false);
    assert.equal(result.value, null);
    assert.equal(result.reason, "not_found");
});
test("CachePolicy structure is correct", () => {
    const policy = {
        enabled: true,
        scope: "memory",
        ttlMs: 300000,
        version: "1.0.0",
        maxPayloadBytes: 1048576,
        tags: ["workflow", "task"],
        staleWhileRevalidate: true,
    };
    assert.equal(policy.enabled, true);
    assert.equal(policy.scope, "memory");
    assert.equal(policy.ttlMs, 300000);
    assert.equal(policy.maxPayloadBytes, 1048576);
    assert.equal(policy.staleWhileRevalidate, true);
});
test("CacheComputeOptions structure is correct", () => {
    const options = {
        tags: ["compute"],
        contentType: "application/json",
        forceBypass: false,
    };
    assert.equal(options.forceBypass, false);
    assert.equal(options.contentType, "application/json");
});
//# sourceMappingURL=index.test.js.map