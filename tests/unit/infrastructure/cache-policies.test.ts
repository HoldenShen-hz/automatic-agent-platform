/**
 * Infrastructure: Cache Policy Exports Tests
 *
 * Tests for specialized cache policy modules (tool, prompt, memory, planner).
 */

import { describe, it } from "node:test";
import assert from "node:assert";

// Policy exports
import { TOOL_CACHE_POLICIES } from "../../../src/platform/shared/cache/policies/tool-cache-policy.js";
import { PROMPT_CACHE_POLICIES } from "../../../src/platform/shared/cache/policies/prompt-cache-policy.js";
import { MEMORY_CACHE_POLICIES } from "../../../src/platform/shared/cache/policies/memory-cache-policy.js";
import { PLANNER_CACHE_POLICIES } from "../../../src/platform/shared/cache/policies/planner-cache-policy.js";

describe("TOOL_CACHE_POLICIES", () => {
  it("has tool.read policy", () => {
    const policy = TOOL_CACHE_POLICIES["tool.read"];
    assert.ok(policy);
    assert.equal(policy.scope, "session");
    assert.ok(policy.ttlMs > 0);
  });

  it("has tool.glob policy", () => {
    const policy = TOOL_CACHE_POLICIES["tool.glob"];
    assert.ok(policy);
    assert.equal(policy.scope, "session");
  });

  it("has tool.grep policy", () => {
    const policy = TOOL_CACHE_POLICIES["tool.grep"];
    assert.ok(policy);
    assert.ok(policy.ttlMs > 0);
  });

  it("has tool.repo_map policy", () => {
    const policy = TOOL_CACHE_POLICIES["tool.repo_map"];
    assert.ok(policy);
    assert.equal(policy.scope, "persistent");
    assert.ok(policy.maxPayloadBytes >= 1024 * 1024);
  });

  it("has tool.diagnostics policy", () => {
    const policy = TOOL_CACHE_POLICIES["tool.diagnostics"];
    assert.ok(policy);
  });

  it("has tool.web_fetch policy", () => {
    const policy = TOOL_CACHE_POLICIES["tool.web_fetch"];
    assert.ok(policy);
    assert.ok(policy.ttlMs >= 10 * 60 * 1000);
  });

  it("all tool policies have tags", () => {
    for (const [namespace, policy] of Object.entries(TOOL_CACHE_POLICIES)) {
      assert.ok(policy.tags, `${namespace} should have tags`);
      assert.ok(Array.isArray(policy.tags), `${namespace} tags should be array`);
    }
  });

  it("all tool policies have version", () => {
    for (const [namespace, policy] of Object.entries(TOOL_CACHE_POLICIES)) {
      assert.equal(policy.version, "v1", `${namespace} should have v1 version`);
    }
  });
});

describe("PROMPT_CACHE_POLICIES", () => {
  it("has prompt.prefix policy with persistent scope", () => {
    const policy = PROMPT_CACHE_POLICIES["prompt.prefix"];
    assert.ok(policy);
    assert.equal(policy.scope, "persistent");
    assert.equal(policy.ttlMs, 24 * 60 * 60 * 1000);
  });

  it("has prompt.full policy with session scope", () => {
    const policy = PROMPT_CACHE_POLICIES["prompt.full"];
    assert.ok(policy);
    assert.equal(policy.scope, "session");
  });

  it("has prompt.static policy with 7 day TTL", () => {
    const policy = PROMPT_CACHE_POLICIES["prompt.static"];
    assert.ok(policy);
    assert.equal(policy.ttlMs, 7 * 24 * 60 * 60 * 1000);
    assert.ok(policy.maxPayloadBytes >= 1024 * 1024);
  });

  it("all prompt policies have tags", () => {
    for (const [namespace, policy] of Object.entries(PROMPT_CACHE_POLICIES)) {
      assert.ok(policy.tags, `${namespace} should have tags`);
    }
  });
});

describe("MEMORY_CACHE_POLICIES", () => {
  it("has memory.summary policy with 24 hour TTL", () => {
    const policy = MEMORY_CACHE_POLICIES["memory.summary"];
    assert.ok(policy);
    assert.equal(policy.scope, "persistent");
    assert.equal(policy.ttlMs, 24 * 60 * 60 * 1000);
  });

  it("has memory.retrieval policy with session scope", () => {
    const policy = MEMORY_CACHE_POLICIES["memory.retrieval"];
    assert.ok(policy);
    assert.equal(policy.scope, "session");
    assert.equal(policy.ttlMs, 5 * 60 * 1000);
  });

  it("has memory.compressed policy with 12 hour TTL", () => {
    const policy = MEMORY_CACHE_POLICIES["memory.compressed"];
    assert.ok(policy);
    assert.equal(policy.ttlMs, 12 * 60 * 60 * 1000);
    assert.ok(policy.maxPayloadBytes >= 512 * 1024);
  });

  it("all memory policies have tags", () => {
    for (const [namespace, policy] of Object.entries(MEMORY_CACHE_POLICIES)) {
      assert.ok(policy.tags, `${namespace} should have tags`);
      assert.ok(policy.tags.some((t: string) => t.startsWith("memory:")));
    }
  });
});

describe("PLANNER_CACHE_POLICIES", () => {
  it("has planner.plan policy with 15 minute TTL", () => {
    const policy = PLANNER_CACHE_POLICIES["planner.plan"];
    assert.ok(policy);
    assert.equal(policy.scope, "session");
    assert.equal(policy.ttlMs, 15 * 60 * 1000);
  });

  it("has planner.decomposition policy with 10 minute TTL", () => {
    const policy = PLANNER_CACHE_POLICIES["planner.decomposition"];
    assert.ok(policy);
    assert.equal(policy.ttlMs, 10 * 60 * 1000);
  });

  it("has planner.workflow policy", () => {
    const policy = PLANNER_CACHE_POLICIES["planner.workflow"];
    assert.ok(policy);
    assert.ok(policy.maxPayloadBytes >= 256 * 1024);
  });

  it("all planner policies have session scope", () => {
    for (const [namespace, policy] of Object.entries(PLANNER_CACHE_POLICIES)) {
      assert.equal(policy.scope, "session", `${namespace} should have session scope`);
    }
  });

  it("all planner policies have tags", () => {
    for (const [namespace, policy] of Object.entries(PLANNER_CACHE_POLICIES)) {
      assert.ok(policy.tags, `${namespace} should have tags`);
      assert.ok(policy.tags.some((t: string) => t.startsWith("planner:")));
    }
  });
});