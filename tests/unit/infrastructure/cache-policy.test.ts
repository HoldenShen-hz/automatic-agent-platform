/**
 * Infrastructure: Cache Policy Tests
 *
 * Tests for cache policy definitions, including TTL, scope,
 * max payload size, and version settings for each namespace.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

// Cache Policy
import {
  DEFAULT_CACHE_POLICIES,
  getPolicyForNamespace,
  isCacheableNamespace,
  getTTLForNamespace,
  getScopeForNamespace,
} from "../../../src/platform/shared/cache/cache-policy.js";

describe("Cache Policy", () => {
  describe("DEFAULT_CACHE_POLICIES", () => {
    it("has prompt.prefix policy with persistent scope", () => {
      const policy = DEFAULT_CACHE_POLICIES["prompt.prefix"];
      assert.ok(policy);
      assert.equal(policy.scope, "persistent");
      assert.equal(policy.ttlMs, 24 * 60 * 60 * 1000); // 24 hours
      assert.equal(policy.version, "v1");
      assert.ok(policy.enabled);
    });

    it("has prompt.full policy with session scope", () => {
      const policy = DEFAULT_CACHE_POLICIES["prompt.full"];
      assert.ok(policy);
      assert.equal(policy.scope, "session");
      assert.equal(policy.ttlMs, 30 * 60 * 1000); // 30 minutes
    });

    it("has tool.read policy with 5 minute TTL", () => {
      const policy = DEFAULT_CACHE_POLICIES["tool.read"];
      assert.ok(policy);
      assert.equal(policy.ttlMs, 5 * 60 * 1000);
      assert.equal(policy.scope, "session");
    });

    it("has tool.grep policy with shorter 3 minute TTL", () => {
      const policy = DEFAULT_CACHE_POLICIES["tool.grep"];
      assert.ok(policy);
      assert.equal(policy.ttlMs, 3 * 60 * 1000);
    });

    it("has tool.repo_map policy with persistent scope", () => {
      const policy = DEFAULT_CACHE_POLICIES["tool.repo_map"];
      assert.ok(policy);
      assert.equal(policy.scope, "persistent");
      assert.equal(policy.ttlMs, 10 * 60 * 1000);
      assert.ok(policy.maxPayloadBytes >= 1024 * 1024); // 1MB
    });

    it("has memory.summary policy with 24 hour TTL", () => {
      const policy = DEFAULT_CACHE_POLICIES["memory.summary"];
      assert.ok(policy);
      assert.equal(policy.ttlMs, 24 * 60 * 60 * 1000);
      assert.equal(policy.scope, "persistent");
    });

    it("has memory.retrieval policy with session scope", () => {
      const policy = DEFAULT_CACHE_POLICIES["memory.retrieval"];
      assert.ok(policy);
      assert.equal(policy.scope, "session");
      assert.equal(policy.ttlMs, 5 * 60 * 1000);
    });

    it("has planner.plan policy with 15 minute TTL", () => {
      const policy = DEFAULT_CACHE_POLICIES["planner.plan"];
      assert.ok(policy);
      assert.equal(policy.ttlMs, 15 * 60 * 1000);
      assert.equal(policy.scope, "session");
    });

    it("all policies have maxPayloadBytes defined", () => {
      for (const [namespace, policy] of Object.entries(DEFAULT_CACHE_POLICIES)) {
        assert.ok(policy.maxPayloadBytes > 0, `${namespace} should have maxPayloadBytes > 0`);
      }
    });

    it("all policies have version defined", () => {
      for (const [namespace, policy] of Object.entries(DEFAULT_CACHE_POLICIES)) {
        assert.ok(policy.version, `${namespace} should have version defined`);
      }
    });

    it("tool policies have smaller payload limits than prompt policies", () => {
      const toolReadMax = DEFAULT_CACHE_POLICIES["tool.read"].maxPayloadBytes;
      const promptFullMax = DEFAULT_CACHE_POLICIES["prompt.full"].maxPayloadBytes;

      assert.ok(toolReadMax < promptFullMax);
    });
  });

  describe("getPolicyForNamespace", () => {
    it("returns policy for known namespace", () => {
      const policy = getPolicyForNamespace("tool.read");

      assert.ok(policy);
      assert.equal(policy.ttlMs, 5 * 60 * 1000);
    });

    it("returns disabled policy for unknown namespace", () => {
      const policy = getPolicyForNamespace("unknown.namespace");

      assert.ok(policy);
      assert.equal(policy.enabled, false);
      assert.equal(policy.scope, "session");
      assert.equal(policy.ttlMs, 0);
    });

    it("applies overrides correctly", () => {
      const policy = getPolicyForNamespace("tool.read", {
        ttlMs: 10000,
        scope: "persistent",
      });

      assert.equal(policy.ttlMs, 10000);
      assert.equal(policy.scope, "persistent");
      // Other properties should remain from default
      assert.equal(policy.version, "v1");
      assert.ok(policy.enabled);
    });

    it("override can enable disabled namespace", () => {
      const policy = getPolicyForNamespace("unknown.namespace", {
        enabled: true,
        ttlMs: 60000,
      });

      assert.equal(policy.enabled, true);
      assert.equal(policy.ttlMs, 60000);
    });
  });

  describe("isCacheableNamespace", () => {
    it("returns true for cacheable namespaces", () => {
      assert.equal(isCacheableNamespace("tool.read"), true);
      assert.equal(isCacheableNamespace("tool.glob"), true);
      assert.equal(isCacheableNamespace("prompt.prefix"), true);
      assert.equal(isCacheableNamespace("memory.summary"), true);
      assert.equal(isCacheableNamespace("planner.plan"), true);
    });

    it("returns false for unknown namespaces", () => {
      assert.equal(isCacheableNamespace("unknown.namespace"), false);
      assert.equal(isCacheableNamespace("custom.tool"), false);
    });

    it("returns false for disabled namespace", () => {
      const policy = getPolicyForNamespace("tool.read");
      assert.equal(policy.enabled, true);

      const disabledPolicy = getPolicyForNamespace("non.existent");
      assert.equal(disabledPolicy.enabled, false);
    });
  });

  describe("getTTLForNamespace", () => {
    it("returns TTL for known namespace", () => {
      assert.equal(getTTLForNamespace("tool.read"), 5 * 60 * 1000);
      assert.equal(getTTLForNamespace("tool.grep"), 3 * 60 * 1000);
      assert.equal(getTTLForNamespace("memory.summary"), 24 * 60 * 60 * 1000);
    });

    it("returns 0 for unknown namespace", () => {
      assert.equal(getTTLForNamespace("unknown.namespace"), 0);
    });

    it("returns 0 for non-existent namespace", () => {
      assert.equal(getTTLForNamespace("non.cacheable"), 0);
    });
  });

  describe("getScopeForNamespace", () => {
    it("returns 'persistent' for persistent scope namespaces", () => {
      assert.equal(getScopeForNamespace("prompt.prefix"), "persistent");
      assert.equal(getScopeForNamespace("memory.summary"), "persistent");
    });

    it("returns 'session' for session scope namespaces", () => {
      assert.equal(getScopeForNamespace("tool.read"), "session");
      assert.equal(getScopeForNamespace("tool.glob"), "session");
      assert.equal(getScopeForNamespace("planner.plan"), "session");
    });

    it("returns 'session' as default for unknown namespace", () => {
      assert.equal(getScopeForNamespace("unknown.namespace"), "session");
    });
  });
});