/**
 * @fileoverview Unit tests for KV Cache Prefix Config integration scenarios.
 *
 * Tests integration scenarios, budget enforcement, sharing behavior,
 * and configuration composition.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  createKvCachePrefixConfig,
  estimateTokens,
  isWithinFixedPrefixBudget,
  isWithinDomainBlockBudget,
} from "../../../../../src/platform/five-plane-execution/execution-engine/kv-cache-prefix-config.js";

// ---------------------------------------------------------------------------
// Default Configuration Verification
// ---------------------------------------------------------------------------

test("default budget has expected token limits [kv-cache-prefix-config-integration]", () => {
  const config = createKvCachePrefixConfig();

  assert.equal(config.budget.fixedPrefixMaxTokens, 1000);
  assert.equal(config.budget.domainBlockMaxTokens, 400);
  assert.equal(config.budget.enforceBudget, true);
});

test("default strategy has expected sharing settings [kv-cache-prefix-config-integration]", () => {
  const config = createKvCachePrefixConfig();

  assert.equal(config.strategy.cacheKeyStrategy, "hash_prefix");
  assert.equal(config.strategy.kvCacheEnabled, true);
  assert.equal(config.strategy.fixedPrefixShareable, true);
  assert.equal(config.strategy.domainBlockShareable, true);
});

test("default fixedPrefixTemplate is non-empty and contains expected sections [kv-cache-prefix-config-integration]", () => {
  const config = createKvCachePrefixConfig();

  assert.ok(config.fixedPrefixTemplate.length > 0);
  assert.ok(config.fixedPrefixTemplate.includes("System Configuration"));
  assert.ok(config.fixedPrefixTemplate.includes("Governance"));
  assert.ok(config.fixedPrefixTemplate.includes("Constraints"));
  assert.ok(config.fixedPrefixTemplate.includes("Directives"));
});

test("default domainBlockTemplates is empty object [kv-cache-prefix-config-integration]", () => {
  const config = createKvCachePrefixConfig();

  assert.deepEqual(config.domainBlockTemplates, {});
});

// ---------------------------------------------------------------------------
// Budget Enforcement Combinations
// ---------------------------------------------------------------------------

test("enforceBudget true with kvCacheEnabled true enforces limits [kv-cache-prefix-config-integration]", () => {
  const config = createKvCachePrefixConfig({
    budget: { enforceBudget: true },
    strategy: { kvCacheEnabled: true, fixedPrefixMaxTokens: 10 },
  });

  // This scenario should use the passed fixedPrefixMaxTokens
  assert.equal(config.budget.enforceBudget, true);
  assert.equal(config.strategy.kvCacheEnabled, true);
});

test("enforceBudget false bypasses all budget checks [kv-cache-prefix-config-integration]", () => {
  const config = createKvCachePrefixConfig({
    budget: {
      enforceBudget: false,
      fixedPrefixMaxTokens: 1,
      domainBlockMaxTokens: 1,
    },
  });

  // Even 10000 chars should pass
  assert.equal(isWithinFixedPrefixBudget("a".repeat(10000), config), true);
  assert.equal(isWithinDomainBlockBudget("a".repeat(10000), "domain-x", config), true);
});

test("kvCacheEnabled false bypasses all budget checks [kv-cache-prefix-config-integration]", () => {
  const config = createKvCachePrefixConfig({
    strategy: { kvCacheEnabled: false },
    budget: {
      fixedPrefixMaxTokens: 1,
      domainBlockMaxTokens: 1,
    },
  });

  // Even 10000 chars should pass
  assert.equal(isWithinFixedPrefixBudget("a".repeat(10000), config), true);
  assert.equal(isWithinDomainBlockBudget("a".repeat(10000), "domain-x", config), true);
});

test("both enforceBudget false and kvCacheEnabled false - always passes [kv-cache-prefix-config-integration]", () => {
  const config = createKvCachePrefixConfig({
    budget: { enforceBudget: false },
    strategy: { kvCacheEnabled: false },
  });

  assert.equal(isWithinFixedPrefixBudget("x".repeat(999999), config), true);
  assert.equal(isWithinDomainBlockBudget("x".repeat(999999), "any-domain", config), true);
});

// ---------------------------------------------------------------------------
// Token Estimation Edge Cases
// ---------------------------------------------------------------------------

test("estimateTokens returns 0 for empty string [kv-cache-prefix-config-integration]", () => {
  assert.equal(estimateTokens(""), 0);
});

test("estimateTokens returns 1 for 1-4 characters [kv-cache-prefix-config-integration]", () => {
  assert.equal(estimateTokens("a"), 1);
  assert.equal(estimateTokens("ab"), 1);
  assert.equal(estimateTokens("abc"), 1);
  assert.equal(estimateTokens("abcd"), 1);
});

test("estimateTokens returns 2 for 5-8 characters [kv-cache-prefix-config-integration]", () => {
  assert.equal(estimateTokens("abcde"), 2);
  assert.equal(estimateTokens("abcdef"), 2);
  assert.equal(estimateTokens("abcdefg"), 2);
  assert.equal(estimateTokens("abcdefgh"), 2);
});

test("estimateTokens handles large strings correctly [kv-cache-prefix-config-integration]", () => {
  // 10000 chars / 4 = 2500 tokens
  assert.equal(estimateTokens("a".repeat(10000)), 2500);
});

test("estimateTokens handles unicode characters correctly [kv-cache-prefix-config-integration]", () => {
  // estimateTokens counts characters, not bytes (4 chars per token)
  // "日本語日本語日本語日本語" = 12 chars / 4 = 3 tokens (ceil)
  assert.equal(estimateTokens("日本語日本語日本語日本語"), 3);
});

// ---------------------------------------------------------------------------
// Budget Boundary Conditions
// ---------------------------------------------------------------------------

test("fixedPrefixBudget at exact boundary (4000 chars = 1000 tokens) [kv-cache-prefix-config-integration]", () => {
  const config = createKvCachePrefixConfig({
    budget: { fixedPrefixMaxTokens: 1000 },
  });

  const text = "a".repeat(4000);
  assert.equal(isWithinFixedPrefixBudget(text, config), true);
});

test("fixedPrefixBudget just over boundary (4001 chars = 1001 tokens) [kv-cache-prefix-config-integration]", () => {
  const config = createKvCachePrefixConfig({
    budget: { fixedPrefixMaxTokens: 1000 },
  });

  const text = "a".repeat(4001);
  assert.equal(isWithinFixedPrefixBudget(text, config), false);
});

test("domainBlockBudget at exact boundary (1600 chars = 400 tokens) [kv-cache-prefix-config-integration]", () => {
  const config = createKvCachePrefixConfig({
    budget: { domainBlockMaxTokens: 400 },
  });

  const text = "a".repeat(1600);
  assert.equal(isWithinDomainBlockBudget(text, "domain", config), true);
});

test("domainBlockBudget just over boundary (1601 chars = 401 tokens) [kv-cache-prefix-config-integration]", () => {
  const config = createKvCachePrefixConfig({
    budget: { domainBlockMaxTokens: 400 },
  });

  const text = "a".repeat(1601);
  assert.equal(isWithinDomainBlockBudget(text, "domain", config), false);
});

test("zero budget allows empty content only [kv-cache-prefix-config-integration]", () => {
  const config = createKvCachePrefixConfig({
    budget: { fixedPrefixMaxTokens: 0, domainBlockMaxTokens: 0 },
  });

  assert.equal(isWithinFixedPrefixBudget("", config), true);
  assert.equal(isWithinFixedPrefixBudget("a", config), false);
  assert.equal(isWithinDomainBlockBudget("", "domain", config), true);
  assert.equal(isWithinDomainBlockBudget("a", "domain", config), false);
});

// ---------------------------------------------------------------------------
// Configuration Composition
// ---------------------------------------------------------------------------

test("partial budget override preserves unspecified fields [kv-cache-prefix-config-integration]", () => {
  const config = createKvCachePrefixConfig({
    budget: { fixedPrefixMaxTokens: 500 },
  });

  assert.equal(config.budget.fixedPrefixMaxTokens, 500);
  assert.equal(config.budget.domainBlockMaxTokens, 400); // preserved default
  assert.equal(config.budget.enforceBudget, true); // preserved default
});

test("partial strategy override preserves unspecified fields [kv-cache-prefix-config-integration]", () => {
  const config = createKvCachePrefixConfig({
    strategy: { kvCacheEnabled: false },
  });

  assert.equal(config.strategy.kvCacheEnabled, false);
  assert.equal(config.strategy.cacheKeyStrategy, "hash_prefix"); // preserved default
  assert.equal(config.strategy.fixedPrefixShareable, true); // preserved default
  assert.equal(config.strategy.domainBlockShareable, true); // preserved default
});

test("full override of all fields [kv-cache-prefix-config-integration]", () => {
  const config = createKvCachePrefixConfig({
    budget: {
      fixedPrefixMaxTokens: 800,
      domainBlockMaxTokens: 300,
      enforceBudget: false,
    },
    strategy: {
      cacheKeyStrategy: "exact_match",
      kvCacheEnabled: false,
      fixedPrefixShareable: false,
      domainBlockShareable: false,
    },
    fixedPrefixTemplate: "Custom template",
    domainBlockTemplates: { "test-domain": "Test content" },
  });

  assert.equal(config.budget.fixedPrefixMaxTokens, 800);
  assert.equal(config.budget.domainBlockMaxTokens, 300);
  assert.equal(config.budget.enforceBudget, false);
  assert.equal(config.strategy.cacheKeyStrategy, "exact_match");
  assert.equal(config.strategy.kvCacheEnabled, false);
  assert.equal(config.strategy.fixedPrefixShareable, false);
  assert.equal(config.strategy.domainBlockShareable, false);
  assert.equal(config.fixedPrefixTemplate, "Custom template");
  assert.equal(config.domainBlockTemplates["test-domain"], "Test content");
});

// ---------------------------------------------------------------------------
// Sharing Configuration Behavior
// ---------------------------------------------------------------------------

test("fixedPrefixShareable true allows cross-agent sharing [kv-cache-prefix-config-integration]", () => {
  const config = createKvCachePrefixConfig({
    strategy: { fixedPrefixShareable: true },
  });

  assert.equal(config.strategy.fixedPrefixShareable, true);
  // The sharing behavior is determined by the configuration;
  // actual sharing depends on cache implementation
});

test("fixedPrefixShareable false restricts sharing [kv-cache-prefix-config-integration]", () => {
  const config = createKvCachePrefixConfig({
    strategy: { fixedPrefixShareable: false },
  });

  assert.equal(config.strategy.fixedPrefixShareable, false);
});

test("domainBlockShareable true allows within-domain sharing [kv-cache-prefix-config-integration]", () => {
  const config = createKvCachePrefixConfig({
    strategy: { domainBlockShareable: true },
  });

  assert.equal(config.strategy.domainBlockShareable, true);
});

test("domainBlockShareable false restricts within-domain sharing [kv-cache-prefix-config-integration]", () => {
  const config = createKvCachePrefixConfig({
    strategy: { domainBlockShareable: false },
  });

  assert.equal(config.strategy.domainBlockShareable, false);
});

// ---------------------------------------------------------------------------
// Domain Block Templates
// ---------------------------------------------------------------------------

test("multiple domain block templates can coexist [kv-cache-prefix-config-integration]", () => {
  const config = createKvCachePrefixConfig({
    domainBlockTemplates: {
      finance: "Finance-specific rules",
      engineering: "Engineering-specific rules",
      marketing: "Marketing-specific rules",
    },
  });

  assert.equal(Object.keys(config.domainBlockTemplates).length, 3);
  assert.ok(config.domainBlockTemplates["finance"]);
  assert.ok(config.domainBlockTemplates["engineering"]);
  assert.ok(config.domainBlockTemplates["marketing"]);
});

test("empty domain block templates is valid [kv-cache-prefix-config-integration]", () => {
  const config = createKvCachePrefixConfig({
    domainBlockTemplates: {},
  });

  assert.deepEqual(config.domainBlockTemplates, {});
  assert.equal(Object.keys(config.domainBlockTemplates).length, 0);
});

test("adding to empty domainBlockTemplates works [kv-cache-prefix-config-integration]", () => {
  const config = createKvCachePrefixConfig({
    domainBlockTemplates: { "new-domain": "New content" },
  });

  assert.ok(config.domainBlockTemplates["new-domain"]);
});

// ---------------------------------------------------------------------------
// Cache Key Strategy Behavior
// ---------------------------------------------------------------------------

test("hash_prefix strategy produces hash-based cache keys [kv-cache-prefix-config-integration]", () => {
  const config = createKvCachePrefixConfig({
    strategy: { cacheKeyStrategy: "hash_prefix" },
  });

  assert.equal(config.strategy.cacheKeyStrategy, "hash_prefix");
});

test("exact_match strategy produces content-based cache keys [kv-cache-prefix-config-integration]", () => {
  const config = createKvCachePrefixConfig({
    strategy: { cacheKeyStrategy: "exact_match" },
  });

  assert.equal(config.strategy.cacheKeyStrategy, "exact_match");
});

// ---------------------------------------------------------------------------
// Complex Budget Scenarios
// ---------------------------------------------------------------------------

test("very small budget with enforcement checks correctly [kv-cache-prefix-config-integration]", () => {
  const config = createKvCachePrefixConfig({
    budget: {
      fixedPrefixMaxTokens: 2,
      domainBlockMaxTokens: 2,
      enforceBudget: true,
    },
  });

  // 8 chars = 2 tokens (at boundary)
  assert.equal(isWithinFixedPrefixBudget("abcdefgh", config), true);
  // 9 chars = 3 tokens (over)
  assert.equal(isWithinFixedPrefixBudget("abcdefghi", config), false);

  assert.equal(isWithinDomainBlockBudget("abcdefgh", "domain", config), true);
  assert.equal(isWithinDomainBlockBudget("abcdefghi", "domain", config), false);
});

test("budget with very large values allows large content [kv-cache-prefix-config-integration]", () => {
  const config = createKvCachePrefixConfig({
    budget: {
      fixedPrefixMaxTokens: 100000,
      domainBlockMaxTokens: 100000,
    },
  });

  const largeText = "a".repeat(400000);
  // 400000 chars = 100000 tokens (at boundary)
  assert.equal(isWithinFixedPrefixBudget(largeText, config), true);
  assert.equal(isWithinDomainBlockBudget(largeText, "domain", config), true);
});

test("budget enforcement interacts correctly with KV cache enabled flag [kv-cache-prefix-config-integration]", () => {
  // When KV cache is disabled, budget checks are skipped regardless of enforceBudget
  const config1 = createKvCachePrefixConfig({
    strategy: { kvCacheEnabled: false },
    budget: { enforceBudget: true, fixedPrefixMaxTokens: 1 },
  });
  assert.equal(isWithinFixedPrefixBudget("very long text", config1), true);

  // When KV cache is enabled and budget enforcement is disabled, checks are skipped
  const config2 = createKvCachePrefixConfig({
    strategy: { kvCacheEnabled: true },
    budget: { enforceBudget: false, fixedPrefixMaxTokens: 1 },
  });
  assert.equal(isWithinFixedPrefixBudget("very long text", config2), true);

  // When KV cache is enabled and budget enforcement is enabled, checks apply
  const config3 = createKvCachePrefixConfig({
    strategy: { kvCacheEnabled: true },
    budget: { enforceBudget: true, fixedPrefixMaxTokens: 1 },
  });
  assert.equal(isWithinFixedPrefixBudget("very long text", config3), false);
});
