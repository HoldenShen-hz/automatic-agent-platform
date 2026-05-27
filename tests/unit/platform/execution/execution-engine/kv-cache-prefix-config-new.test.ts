/**
 * KV Cache Prefix Config Extended Tests
 *
 * Additional tests for comprehensive coverage of kv-cache-prefix-config.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  createKvCachePrefixConfig,
  estimateTokens,
  isWithinFixedPrefixBudget,
  isWithinDomainBlockBudget,
} from "../../../../../src/platform/five-plane-execution/execution-engine/kv-cache-prefix-config.js";

test("createKvCachePrefixConfig with exact_match strategy [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig({
    strategy: { cacheKeyStrategy: "exact_match" },
  });
  assert.equal(config.strategy.cacheKeyStrategy, "exact_match");
});

test("createKvCachePrefixConfig with kvCacheEnabled false [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig({
    strategy: { kvCacheEnabled: false },
  });
  assert.equal(config.strategy.kvCacheEnabled, false);
});

test("createKvCachePrefixConfig with fixedPrefixShareable false [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig({
    strategy: { fixedPrefixShareable: false },
  });
  assert.equal(config.strategy.fixedPrefixShareable, false);
});

test("createKvCachePrefixConfig with domainBlockShareable false [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig({
    strategy: { domainBlockShareable: false },
  });
  assert.equal(config.strategy.domainBlockShareable, false);
});

test("createKvCachePrefixConfig overrides both shareable flags [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig({
    strategy: {
      fixedPrefixShareable: false,
      domainBlockShareable: false,
    },
  });
  assert.equal(config.strategy.fixedPrefixShareable, false);
  assert.equal(config.strategy.domainBlockShareable, false);
});

test("createKvCachePrefixConfig overrides all strategy fields [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig({
    strategy: {
      cacheKeyStrategy: "exact_match",
      kvCacheEnabled: false,
      fixedPrefixShareable: false,
      domainBlockShareable: false,
    },
  });
  assert.equal(config.strategy.cacheKeyStrategy, "exact_match");
  assert.equal(config.strategy.kvCacheEnabled, false);
  assert.equal(config.strategy.fixedPrefixShareable, false);
  assert.equal(config.strategy.domainBlockShareable, false);
});

test("createKvCachePrefixConfig overrides all budget fields [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig({
    budget: {
      fixedPrefixMaxTokens: 800,
      domainBlockMaxTokens: 300,
      enforceBudget: false,
    },
  });
  assert.equal(config.budget.fixedPrefixMaxTokens, 800);
  assert.equal(config.budget.domainBlockMaxTokens, 300);
  assert.equal(config.budget.enforceBudget, false);
});

test("createKvCachePrefixConfig with custom fixedPrefixTemplate [kv-cache-prefix-config-new]", () => {
  const customTemplate = "Custom system prompt";
  const config = createKvCachePrefixConfig({
    fixedPrefixTemplate: customTemplate,
  });
  assert.equal(config.fixedPrefixTemplate, customTemplate);
});

test("createKvCachePrefixConfig with empty fixedPrefixTemplate [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig({
    fixedPrefixTemplate: "",
  });
  assert.equal(config.fixedPrefixTemplate, "");
});

test("createKvCachePrefixConfig with empty domainBlockTemplates [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig({
    domainBlockTemplates: {},
  });
  assert.deepEqual(config.domainBlockTemplates, {});
});

test("createKvCachePrefixConfig preserves default when strategy partially overridden [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig({
    strategy: { kvCacheEnabled: false },
  });
  assert.equal(config.strategy.cacheKeyStrategy, "hash_prefix");
  assert.equal(config.strategy.fixedPrefixShareable, true);
  assert.equal(config.strategy.domainBlockShareable, true);
});

test("createKvCachePrefixConfig preserves default when budget partially overridden [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig({
    budget: { enforceBudget: false },
  });
  assert.equal(config.budget.fixedPrefixMaxTokens, 1000);
  assert.equal(config.budget.domainBlockMaxTokens, 400);
});

test("isWithinFixedPrefixBudget returns true for empty string [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig();
  assert.equal(isWithinFixedPrefixBudget("", config), true);
});

test("isWithinFixedPrefixBudget returns true for single character [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig();
  assert.equal(isWithinFixedPrefixBudget("a", config), true);
});

test("isWithinFixedPrefixBudget returns false for text exceeding fixedPrefixMaxTokens [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig({
    budget: { fixedPrefixMaxTokens: 1 },
  });
  // 5 chars = 2 tokens, which exceeds 1 token budget
  assert.equal(isWithinFixedPrefixBudget("abcde", config), false);
});

test("isWithinFixedPrefixBudget respects zero budget [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig({
    budget: { fixedPrefixMaxTokens: 0 },
  });
  assert.equal(isWithinFixedPrefixBudget("", config), true);
  assert.equal(isWithinFixedPrefixBudget("a", config), false);
});

test("isWithinDomainBlockBudget returns true for empty string [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig();
  assert.equal(isWithinDomainBlockBudget("", "domain-x", config), true);
});

test("isWithinDomainBlockBudget returns true for single character [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig();
  assert.equal(isWithinDomainBlockBudget("a", "domain-x", config), true);
});

test("isWithinDomainBlockBudget returns false for text exceeding domainBlockMaxTokens [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig({
    budget: { domainBlockMaxTokens: 1 },
  });
  // 5 chars = 2 tokens, which exceeds 1 token budget
  assert.equal(isWithinDomainBlockBudget("abcde", "domain-x", config), false);
});

test("isWithinDomainBlockBudget respects zero budget [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig({
    budget: { domainBlockMaxTokens: 0 },
  });
  assert.equal(isWithinDomainBlockBudget("", "domain-x", config), true);
  assert.equal(isWithinDomainBlockBudget("a", "domain-x", config), false);
});

test("isWithinDomainBlockBudget works with KV cache disabled [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig({
    strategy: { kvCacheEnabled: false },
    budget: { domainBlockMaxTokens: 1 },
  });
  const text = "A".repeat(10000);
  assert.equal(isWithinDomainBlockBudget(text, "domain-x", config), true);
});

test("isWithinDomainBlockBudget works with budget enforcement disabled [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig({
    budget: {
      domainBlockMaxTokens: 1,
      enforceBudget: false,
    },
  });
  const text = "A".repeat(10000);
  assert.equal(isWithinDomainBlockBudget(text, "domain-x", config), true);
});

test("isWithinFixedPrefixBudget works with KV cache disabled and budget enforcement enabled [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig({
    strategy: { kvCacheEnabled: false },
    budget: {
      fixedPrefixMaxTokens: 1,
      enforceBudget: true,
    },
  });
  const text = "A".repeat(10000);
  assert.equal(isWithinFixedPrefixBudget(text, config), true);
});

test("createKvCachePrefixConfig with all overrides combined [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig({
    budget: {
      fixedPrefixMaxTokens: 800,
      domainBlockMaxTokens: 300,
      enforceBudget: true,
    },
    strategy: {
      cacheKeyStrategy: "exact_match",
      kvCacheEnabled: true,
      fixedPrefixShareable: false,
      domainBlockShareable: false,
    },
    fixedPrefixTemplate: "Custom template",
    domainBlockTemplates: { "domain-1": "Domain 1 content" },
  });

  assert.equal(config.budget.fixedPrefixMaxTokens, 800);
  assert.equal(config.budget.domainBlockMaxTokens, 300);
  assert.equal(config.budget.enforceBudget, true);
  assert.equal(config.strategy.cacheKeyStrategy, "exact_match");
  assert.equal(config.strategy.kvCacheEnabled, true);
  assert.equal(config.strategy.fixedPrefixShareable, false);
  assert.equal(config.strategy.domainBlockShareable, false);
  assert.equal(config.fixedPrefixTemplate, "Custom template");
  assert.ok(config.domainBlockTemplates["domain-1"]);
});

test("estimateTokens handles unicode characters [kv-cache-prefix-config-new]", () => {
  // Unicode characters are often 4+ bytes but we approximate as 4 chars per token
  assert.equal(estimateTokens("日本語"), 1);
});

test("estimateTokens handles mixed content [kv-cache-prefix-config-new]", () => {
  const text = "Hello 世界 123!";
  // 16 chars / 4 = 4 tokens
  assert.equal(estimateTokens(text), 4);
});

test("isWithinFixedPrefixBudget handles text at exactly boundary [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig({
    budget: { fixedPrefixMaxTokens: 10 },
  });
  // 40 chars = 10 tokens exactly
  const text = "a".repeat(40);
  assert.equal(isWithinFixedPrefixBudget(text, config), true);
});

test("isWithinFixedPrefixBudget handles text just over boundary [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig({
    budget: { fixedPrefixMaxTokens: 10 },
  });
  // 41 chars = 11 tokens
  const text = "a".repeat(41);
  assert.equal(isWithinFixedPrefixBudget(text, config), false);
});

test("isWithinDomainBlockBudget handles text at exactly boundary [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig({
    budget: { domainBlockMaxTokens: 10 },
  });
  // 40 chars = 10 tokens exactly
  const text = "a".repeat(40);
  assert.equal(isWithinDomainBlockBudget(text, "domain-x", config), true);
});

test("isWithinDomainBlockBudget handles text just over boundary [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig({
    budget: { domainBlockMaxTokens: 10 },
  });
  // 41 chars = 11 tokens
  const text = "a".repeat(41);
  assert.equal(isWithinDomainBlockBudget(text, "domain-x", config), false);
});

test("multiple domainBlockTemplates can be added and retrieved [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig({
    domainBlockTemplates: {
      "finance": "Finance division rules",
      "engineering": "Engineering division rules",
      "marketing": "Marketing division rules",
    },
  });
  assert.equal(Object.keys(config.domainBlockTemplates).length, 3);
  assert.ok(config.domainBlockTemplates["finance"]);
  assert.ok(config.domainBlockTemplates["engineering"]);
  assert.ok(config.domainBlockTemplates["marketing"]);
});

test("isWithinFixedPrefixBudget with KV cache disabled ignores enforceBudget [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig({
    strategy: { kvCacheEnabled: false },
    budget: {
      fixedPrefixMaxTokens: 1,
      enforceBudget: true,
    },
  });
  // Even though budget is tiny and enforceBudget is true, KV cache disabled returns true
  assert.equal(isWithinFixedPrefixBudget("A".repeat(10000), config), true);
});

test("isWithinDomainBlockBudget with KV cache disabled ignores enforceBudget [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig({
    strategy: { kvCacheEnabled: false },
    budget: {
      domainBlockMaxTokens: 1,
      enforceBudget: true,
    },
  });
  // Even though budget is tiny and enforceBudget is true, KV cache disabled returns true
  assert.equal(isWithinDomainBlockBudget("A".repeat(10000), "domain-x", config), true);
});

test("createKvCachePrefixConfig default fixedPrefixTemplate contains expected sections [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig();
  assert.ok(config.fixedPrefixTemplate.includes("System Configuration"));
  assert.ok(config.fixedPrefixTemplate.includes("Governance"));
  assert.ok(config.fixedPrefixTemplate.includes("Constraints"));
  assert.ok(config.fixedPrefixTemplate.includes("Directives"));
});

test("isWithinFixedPrefixBudget uses default fixedPrefixMaxTokens when not set in budget [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig({
    budget: { enforceBudget: true },
  });
  // Default fixedPrefixMaxTokens is 1000, so 3999 chars should be false (999 tokens)
  // 4000 chars = 1000 tokens, at the boundary
  assert.equal(isWithinFixedPrefixBudget("a".repeat(4000), config), true);
  // 4001 chars = 1001 tokens, over boundary
  assert.equal(isWithinFixedPrefixBudget("a".repeat(4001), config), false);
});

test("isWithinDomainBlockBudget uses default domainBlockMaxTokens when not set in budget [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig({
    budget: { enforceBudget: true },
  });
  // Default domainBlockMaxTokens is 400, so 1599 chars should be true (399 tokens)
  // 1600 chars = 400 tokens, at the boundary
  assert.equal(isWithinDomainBlockBudget("a".repeat(1600), "domain-x", config), true);
  // 1601 chars = 401 tokens, over boundary
  assert.equal(isWithinDomainBlockBudget("a".repeat(1601), "domain-x", config), false);
});

test("createKvCachePrefixConfig merges domainBlockTemplates with defaults [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig({
    domainBlockTemplates: { "new-domain": "New domain content" },
  });
  // Default domainBlockTemplates is empty object
  assert.ok(config.domainBlockTemplates["new-domain"]);
  assert.equal(Object.keys(config.domainBlockTemplates).length, 1);
});

test("estimateTokens rounds up correctly [kv-cache-prefix-config-new]", () => {
  assert.equal(estimateTokens("abc"), 1);   // 3 chars = 0.75, ceil = 1
  assert.equal(estimateTokens("abcdefg"), 2); // 7 chars = 1.75, ceil = 2
});

test("isWithinFixedPrefixBudget at one token boundary [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig({
    budget: { fixedPrefixMaxTokens: 1 },
  });
  // 4 chars = 1 token
  assert.equal(isWithinFixedPrefixBudget("abcd", config), true);
  // 5 chars = 2 tokens
  assert.equal(isWithinFixedPrefixBudget("abcde", config), false);
});

test("isWithinDomainBlockBudget at one token boundary [kv-cache-prefix-config-new]", () => {
  const config = createKvCachePrefixConfig({
    budget: { domainBlockMaxTokens: 1 },
  });
  // 4 chars = 1 token
  assert.equal(isWithinDomainBlockBudget("abcd", "domain-x", config), true);
  // 5 chars = 2 tokens
  assert.equal(isWithinDomainBlockBudget("abcde", "domain-x", config), false);
});
