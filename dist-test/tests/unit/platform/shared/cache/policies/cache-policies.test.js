import assert from "node:assert/strict";
import test from "node:test";
import { MEMORY_CACHE_POLICIES } from "../../../../../../src/platform/shared/cache/policies/memory-cache-policy.js";
import { PROMPT_CACHE_POLICIES } from "../../../../../../src/platform/shared/cache/policies/prompt-cache-policy.js";
import { TOOL_CACHE_POLICIES } from "../../../../../../src/platform/shared/cache/policies/tool-cache-policy.js";
import { PLANNER_CACHE_POLICIES } from "../../../../../../src/platform/shared/cache/policies/planner-cache-policy.js";
function assertValidCachePolicy(policy, name) {
    assert.equal(typeof policy.enabled, "boolean", `${name}: enabled must be boolean`);
    assert.ok(["memory", "session", "persistent"].includes(policy.scope), `${name}: invalid scope`);
    assert.equal(typeof policy.ttlMs, "number", `${name}: ttlMs must be number`);
    assert.ok(policy.ttlMs > 0, `${name}: ttlMs must be positive`);
    assert.equal(typeof policy.version, "string", `${name}: version must be string`);
    assert.equal(typeof policy.maxPayloadBytes, "number", `${name}: maxPayloadBytes must be number`);
    assert.ok(policy.maxPayloadBytes > 0, `${name}: maxPayloadBytes must be positive`);
    if (policy.tags !== undefined) {
        assert.ok(Array.isArray(policy.tags), `${name}: tags must be array`);
    }
}
test("MEMORY_CACHE_POLICIES has all required entries", () => {
    assert.ok(MEMORY_CACHE_POLICIES["memory.summary"], "memory.summary should exist");
    assert.ok(MEMORY_CACHE_POLICIES["memory.retrieval"], "memory.retrieval should exist");
    assert.ok(MEMORY_CACHE_POLICIES["memory.compressed"], "memory.compressed should exist");
});
test("MEMORY_CACHE_POLICIES entries are valid CachePolicy", () => {
    for (const [name, policy] of Object.entries(MEMORY_CACHE_POLICIES)) {
        if (policy) {
            assertValidCachePolicy(policy, `MEMORY_CACHE_POLICIES.${name}`);
        }
    }
});
test("memory.summary policy has correct values", () => {
    const policy = MEMORY_CACHE_POLICIES["memory.summary"];
    assert.equal(policy.enabled, true);
    assert.equal(policy.scope, "persistent");
    assert.equal(policy.ttlMs, 24 * 60 * 60 * 1000); // 24 hours
    assert.equal(policy.version, "v1");
    assert.equal(policy.maxPayloadBytes, 256 * 1024);
    assert.ok(policy.tags.includes("memory:summary"));
});
test("memory.retrieval policy has correct values", () => {
    const policy = MEMORY_CACHE_POLICIES["memory.retrieval"];
    assert.equal(policy.enabled, true);
    assert.equal(policy.scope, "session");
    assert.equal(policy.ttlMs, 5 * 60 * 1000); // 5 minutes
    assert.equal(policy.version, "v1");
    assert.equal(policy.maxPayloadBytes, 256 * 1024);
    assert.ok(policy.tags.includes("memory:retrieval"));
});
test("memory.compressed policy has correct values", () => {
    const policy = MEMORY_CACHE_POLICIES["memory.compressed"];
    assert.equal(policy.enabled, true);
    assert.equal(policy.scope, "persistent");
    assert.equal(policy.ttlMs, 12 * 60 * 60 * 1000); // 12 hours
    assert.equal(policy.version, "v1");
    assert.equal(policy.maxPayloadBytes, 512 * 1024);
    assert.ok(policy.tags.includes("memory:compressed"));
});
test("PROMPT_CACHE_POLICIES has all required entries", () => {
    assert.ok(PROMPT_CACHE_POLICIES["prompt.prefix"], "prompt.prefix should exist");
    assert.ok(PROMPT_CACHE_POLICIES["prompt.full"], "prompt.full should exist");
    assert.ok(PROMPT_CACHE_POLICIES["prompt.static"], "prompt.static should exist");
});
test("PROMPT_CACHE_POLICIES entries are valid CachePolicy", () => {
    for (const [name, policy] of Object.entries(PROMPT_CACHE_POLICIES)) {
        if (policy) {
            assertValidCachePolicy(policy, `PROMPT_CACHE_POLICIES.${name}`);
        }
    }
});
test("prompt.prefix policy has correct values", () => {
    const policy = PROMPT_CACHE_POLICIES["prompt.prefix"];
    assert.equal(policy.enabled, true);
    assert.equal(policy.scope, "persistent");
    assert.equal(policy.ttlMs, 24 * 60 * 60 * 1000); // 24 hours
    assert.equal(policy.version, "v1");
    assert.equal(policy.maxPayloadBytes, 512 * 1024);
    assert.ok(policy.tags.includes("prompt:prefix"));
});
test("prompt.full policy has correct values", () => {
    const policy = PROMPT_CACHE_POLICIES["prompt.full"];
    assert.equal(policy.enabled, true);
    assert.equal(policy.scope, "session");
    assert.equal(policy.ttlMs, 30 * 60 * 1000); // 30 minutes
    assert.equal(policy.version, "v1");
    assert.equal(policy.maxPayloadBytes, 512 * 1024);
    assert.ok(policy.tags.includes("prompt:full"));
});
test("prompt.static policy has correct values", () => {
    const policy = PROMPT_CACHE_POLICIES["prompt.static"];
    assert.equal(policy.enabled, true);
    assert.equal(policy.scope, "persistent");
    assert.equal(policy.ttlMs, 7 * 24 * 60 * 60 * 1000); // 7 days
    assert.equal(policy.version, "v1");
    assert.equal(policy.maxPayloadBytes, 1024 * 1024);
    assert.ok(policy.tags.includes("prompt:static"));
});
test("TOOL_CACHE_POLICIES has all required entries", () => {
    const expected = ["tool.read", "tool.glob", "tool.grep", "tool.repo_map", "tool.diagnostics", "tool.web_fetch"];
    for (const name of expected) {
        assert.ok(TOOL_CACHE_POLICIES[name], `${name} should exist`);
    }
});
test("TOOL_CACHE_POLICIES entries are valid CachePolicy", () => {
    for (const [name, policy] of Object.entries(TOOL_CACHE_POLICIES)) {
        if (policy) {
            assertValidCachePolicy(policy, `TOOL_CACHE_POLICIES.${name}`);
        }
    }
});
test("tool.read policy has correct values", () => {
    const policy = TOOL_CACHE_POLICIES["tool.read"];
    assert.equal(policy.enabled, true);
    assert.equal(policy.scope, "session");
    assert.equal(policy.ttlMs, 5 * 60 * 1000);
    assert.equal(policy.version, "v1");
    assert.equal(policy.maxPayloadBytes, 256 * 1024);
    assert.ok(policy.tags.includes("tool:read"));
});
test("tool.glob policy has correct values", () => {
    const policy = TOOL_CACHE_POLICIES["tool.glob"];
    assert.equal(policy.enabled, true);
    assert.equal(policy.scope, "session");
    assert.equal(policy.ttlMs, 5 * 60 * 1000);
    assert.equal(policy.version, "v1");
    assert.equal(policy.maxPayloadBytes, 256 * 1024);
    assert.ok(policy.tags.includes("tool:glob"));
});
test("tool.grep policy has correct values", () => {
    const policy = TOOL_CACHE_POLICIES["tool.grep"];
    assert.equal(policy.enabled, true);
    assert.equal(policy.scope, "session");
    assert.equal(policy.ttlMs, 3 * 60 * 1000);
    assert.equal(policy.version, "v1");
    assert.equal(policy.maxPayloadBytes, 256 * 1024);
    assert.ok(policy.tags.includes("tool:grep"));
});
test("tool.repo_map policy has correct values", () => {
    const policy = TOOL_CACHE_POLICIES["tool.repo_map"];
    assert.equal(policy.enabled, true);
    assert.equal(policy.scope, "persistent");
    assert.equal(policy.ttlMs, 10 * 60 * 1000);
    assert.equal(policy.version, "v1");
    assert.equal(policy.maxPayloadBytes, 1024 * 1024);
    assert.ok(policy.tags.includes("tool:repo_map"));
});
test("tool.diagnostics policy has correct values", () => {
    const policy = TOOL_CACHE_POLICIES["tool.diagnostics"];
    assert.equal(policy.enabled, true);
    assert.equal(policy.scope, "session");
    assert.equal(policy.ttlMs, 5 * 60 * 1000);
    assert.equal(policy.version, "v1");
    assert.equal(policy.maxPayloadBytes, 256 * 1024);
    assert.ok(policy.tags.includes("tool:diagnostics"));
});
test("tool.web_fetch policy has correct values", () => {
    const policy = TOOL_CACHE_POLICIES["tool.web_fetch"];
    assert.equal(policy.enabled, true);
    assert.equal(policy.scope, "session");
    assert.equal(policy.ttlMs, 10 * 60 * 1000);
    assert.equal(policy.version, "v1");
    assert.equal(policy.maxPayloadBytes, 512 * 1024);
    assert.ok(policy.tags.includes("tool:web_fetch"));
});
test("PLANNER_CACHE_POLICIES has all required entries", () => {
    assert.ok(PLANNER_CACHE_POLICIES["planner.plan"], "planner.plan should exist");
    assert.ok(PLANNER_CACHE_POLICIES["planner.decomposition"], "planner.decomposition should exist");
    assert.ok(PLANNER_CACHE_POLICIES["planner.workflow"], "planner.workflow should exist");
});
test("PLANNER_CACHE_POLICIES entries are valid CachePolicy", () => {
    for (const [name, policy] of Object.entries(PLANNER_CACHE_POLICIES)) {
        if (policy) {
            assertValidCachePolicy(policy, `PLANNER_CACHE_POLICIES.${name}`);
        }
    }
});
test("planner.plan policy has correct values", () => {
    const policy = PLANNER_CACHE_POLICIES["planner.plan"];
    assert.equal(policy.enabled, true);
    assert.equal(policy.scope, "session");
    assert.equal(policy.ttlMs, 15 * 60 * 1000); // 15 minutes
    assert.equal(policy.version, "v1");
    assert.equal(policy.maxPayloadBytes, 256 * 1024);
    assert.ok(policy.tags.includes("planner:plan"));
});
test("planner.decomposition policy has correct values", () => {
    const policy = PLANNER_CACHE_POLICIES["planner.decomposition"];
    assert.equal(policy.enabled, true);
    assert.equal(policy.scope, "session");
    assert.equal(policy.ttlMs, 10 * 60 * 1000); // 10 minutes
    assert.equal(policy.version, "v1");
    assert.equal(policy.maxPayloadBytes, 256 * 1024);
    assert.ok(policy.tags.includes("planner:decomposition"));
});
test("planner.workflow policy has correct values", () => {
    const policy = PLANNER_CACHE_POLICIES["planner.workflow"];
    assert.equal(policy.enabled, true);
    assert.equal(policy.scope, "session");
    assert.equal(policy.ttlMs, 15 * 60 * 1000);
    assert.equal(policy.version, "v1");
    assert.equal(policy.maxPayloadBytes, 512 * 1024);
    assert.ok(policy.tags.includes("planner:workflow"));
});
test("all cache policies have unique tag sets", () => {
    const allTags = new Set();
    for (const policies of [MEMORY_CACHE_POLICIES, PROMPT_CACHE_POLICIES, TOOL_CACHE_POLICIES, PLANNER_CACHE_POLICIES]) {
        for (const policy of Object.values(policies)) {
            if (policy && policy.tags) {
                for (const tag of policy.tags) {
                    assert.ok(!allTags.has(tag), `Tag ${tag} should be unique`);
                    allTags.add(tag);
                }
            }
        }
    }
});
test("all cache policies use v1 version", () => {
    for (const policies of [MEMORY_CACHE_POLICIES, PROMPT_CACHE_POLICIES, TOOL_CACHE_POLICIES, PLANNER_CACHE_POLICIES]) {
        for (const [name, policy] of Object.entries(policies)) {
            if (policy) {
                assert.equal(policy.version, "v1", `${name} should use v1`);
            }
        }
    }
});
test("all cache policies are enabled", () => {
    for (const policies of [MEMORY_CACHE_POLICIES, PROMPT_CACHE_POLICIES, TOOL_CACHE_POLICIES, PLANNER_CACHE_POLICIES]) {
        for (const [name, policy] of Object.entries(policies)) {
            if (policy) {
                assert.equal(policy.enabled, true, `${name} should be enabled`);
            }
        }
    }
});
//# sourceMappingURL=cache-policies.test.js.map