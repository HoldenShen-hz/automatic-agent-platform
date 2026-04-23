import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CACHE_POLICIES, getPolicyForNamespace, isCacheableNamespace, getTTLForNamespace, getScopeForNamespace, } from "../../../../../src/platform/shared/cache/cache-policy.js";
test("DEFAULT_CACHE_POLICIES contains expected namespaces", () => {
    assert.ok(DEFAULT_CACHE_POLICIES["prompt.prefix"]);
    assert.ok(DEFAULT_CACHE_POLICIES["prompt.full"]);
    assert.ok(DEFAULT_CACHE_POLICIES["tool.read"]);
    assert.ok(DEFAULT_CACHE_POLICIES["tool.grep"]);
    assert.ok(DEFAULT_CACHE_POLICIES["memory.summary"]);
});
test("DEFAULT_CACHE_POLICIES.prompt_prefix has correct values", () => {
    const policy = DEFAULT_CACHE_POLICIES["prompt.prefix"];
    assert.equal(policy.enabled, true);
    assert.equal(policy.scope, "persistent");
    assert.equal(policy.ttlMs, 24 * 60 * 60 * 1000);
    assert.equal(policy.version, "v1");
    assert.equal(policy.maxPayloadBytes, 512 * 1024);
});
test("DEFAULT_CACHE_POLICIES.tool_read has session scope", () => {
    const policy = DEFAULT_CACHE_POLICIES["tool.read"];
    assert.equal(policy.scope, "session");
    assert.equal(policy.ttlMs, 5 * 60 * 1000);
});
test("getPolicyForNamespace returns default policy for known namespace", () => {
    const policy = getPolicyForNamespace("prompt.prefix");
    assert.equal(policy.enabled, true);
    assert.equal(policy.scope, "persistent");
});
test("getPolicyForNamespace returns disabled policy for unknown namespace", () => {
    const policy = getPolicyForNamespace("unknown.namespace");
    assert.equal(policy.enabled, false);
    assert.equal(policy.scope, "session");
    assert.equal(policy.ttlMs, 0);
});
test("getPolicyForNamespace applies override", () => {
    const policy = getPolicyForNamespace("prompt.prefix", {
        ttlMs: 1000,
        scope: "memory",
    });
    assert.equal(policy.ttlMs, 1000);
    assert.equal(policy.scope, "memory");
    assert.equal(policy.enabled, true); // from default
});
test("isCacheableNamespace returns true for enabled namespace", () => {
    assert.equal(isCacheableNamespace("prompt.prefix"), true);
    assert.equal(isCacheableNamespace("tool.read"), true);
});
test("isCacheableNamespace returns false for disabled namespace", () => {
    assert.equal(isCacheableNamespace("unknown.namespace"), false);
});
test("getTTLForNamespace returns correct TTL for known namespace", () => {
    assert.equal(getTTLForNamespace("tool.grep"), 3 * 60 * 1000);
    assert.equal(getTTLForNamespace("memory.summary"), 24 * 60 * 60 * 1000);
});
test("getTTLForNamespace returns 0 for unknown namespace", () => {
    assert.equal(getTTLForNamespace("unknown"), 0);
});
test("getScopeForNamespace returns correct scope", () => {
    assert.equal(getScopeForNamespace("prompt.prefix"), "persistent");
    assert.equal(getScopeForNamespace("tool.read"), "session");
    assert.equal(getScopeForNamespace("unknown"), "session");
});
//# sourceMappingURL=cache-policy.test.js.map