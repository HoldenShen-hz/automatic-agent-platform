import assert from "node:assert/strict";
import test from "node:test";
import { isCacheableTool, isUncacheableTool, CACHEABLE_TOOLS, UNCACHEABLE_TOOLS, } from "../../../../../src/platform/shared/cache/cache-types.js";
test("isCacheableTool returns true for cacheable tools", () => {
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
test("isCacheableTool returns false for uncacheable tools", () => {
    assert.equal(isCacheableTool("bash"), false);
    assert.equal(isCacheableTool("write"), false);
    assert.equal(isCacheableTool("edit"), false);
    assert.equal(isCacheableTool("apply_patch"), false);
    assert.equal(isCacheableTool("git_commit"), false);
    assert.equal(isCacheableTool("git_push"), false);
});
test("isCacheableTool returns false for unknown tools", () => {
    assert.equal(isCacheableTool("unknown_tool"), false);
    assert.equal(isCacheableTool(""), false);
});
test("isUncacheableTool returns true for uncacheable tools", () => {
    assert.equal(isUncacheableTool("bash"), true);
    assert.equal(isUncacheableTool("write"), true);
    assert.equal(isUncacheableTool("edit"), true);
    assert.equal(isUncacheableTool("apply_patch"), true);
    assert.equal(isUncacheableTool("git_commit"), true);
    assert.equal(isUncacheableTool("git_push"), true);
});
test("isUncacheableTool returns false for cacheable tools", () => {
    assert.equal(isUncacheableTool("read"), false);
    assert.equal(isUncacheableTool("glob"), false);
    assert.equal(isUncacheableTool("grep"), false);
});
test("isUncacheableTool returns false for unknown tools", () => {
    assert.equal(isUncacheableTool("unknown_tool"), false);
    assert.equal(isUncacheableTool(""), false);
});
test("CACHEABLE_TOOLS contains expected tools", () => {
    assert.equal(CACHEABLE_TOOLS.length, 9);
    assert.ok(CACHEABLE_TOOLS.includes("read"));
    assert.ok(CACHEABLE_TOOLS.includes("glob"));
    assert.ok(CACHEABLE_TOOLS.includes("grep"));
});
test("UNCACHEABLE_TOOLS contains expected tools", () => {
    assert.equal(UNCACHEABLE_TOOLS.length, 6);
    assert.ok(UNCACHEABLE_TOOLS.includes("bash"));
    assert.ok(UNCACHEABLE_TOOLS.includes("write"));
    assert.ok(UNCACHEABLE_TOOLS.includes("edit"));
});
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
test("CacheMeta type accepts valid structure", () => {
    const meta = {
        scope: "memory",
        ttlMs: 1000,
        tags: ["tag1", "tag2"],
        version: "v1",
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        hitCount: 5,
        sizeBytes: 1024,
    };
    assert.equal(meta.scope, "memory");
    assert.equal(meta.hitCount, 5);
});
test("CacheEntry type accepts valid structure", () => {
    const entry = {
        namespace: "test",
        key: "test-key",
        value: "test-value",
        meta: {
            scope: "memory",
            tags: [],
            version: "v1",
            createdAt: Date.now(),
            lastAccessedAt: Date.now(),
            hitCount: 0,
            sizeBytes: 0,
        },
    };
    assert.equal(entry.namespace, "test");
    assert.equal(entry.value, "test-value");
});
test("CacheLookupResult type accepts valid hit structure", () => {
    const result = {
        hit: true,
        value: "found-value",
        layer: "L1",
    };
    assert.equal(result.hit, true);
    assert.equal(result.value, "found-value");
});
test("CacheLookupResult type accepts valid miss structure", () => {
    const result = {
        hit: false,
        value: null,
        reason: "not_found",
    };
    assert.equal(result.hit, false);
    assert.equal(result.value, null);
    assert.equal(result.reason, "not_found");
});
test("CachePolicy type accepts valid structure", () => {
    const policy = {
        enabled: true,
        scope: "memory",
        ttlMs: 60000,
        version: "v1",
        maxPayloadBytes: 1024,
        tags: ["tag1"],
        staleWhileRevalidate: true,
    };
    assert.equal(policy.enabled, true);
    assert.equal(policy.ttlMs, 60000);
});
//# sourceMappingURL=cache-types.test.js.map