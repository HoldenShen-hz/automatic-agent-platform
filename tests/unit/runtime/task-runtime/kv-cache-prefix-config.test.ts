import test from "node:test";
import assert from "node:assert/strict";
import {
  createKvCachePrefixConfig,
  DEFAULT_BUDGET,
  DEFAULT_STRATEGY,
  DEFAULT_FIXED_PREFIX_TEMPLATE,
  estimateTokens,
  isWithinFixedPrefixBudget,
  isWithinDomainBlockBudget,
  type KvCachePrefixConfig,
  type KvCachePrefixBudget,
  type KvCachePrefixStrategy,
} from "../../../../src/platform/five-plane-execution/execution-engine/kv-cache-prefix-config.js";

test("DEFAULT_BUDGET has correct values", () => {
  assert.equal(DEFAULT_BUDGET.fixedPrefixMaxTokens, 1000);
  assert.equal(DEFAULT_BUDGET.domainBlockMaxTokens, 400);
  assert.equal(DEFAULT_BUDGET.enforceBudget, true);
});

test("DEFAULT_STRATEGY has correct values", () => {
  assert.equal(DEFAULT_STRATEGY.cacheKeyStrategy, "hash_prefix");
  assert.equal(DEFAULT_STRATEGY.kvCacheEnabled, true);
  assert.equal(DEFAULT_STRATEGY.fixedPrefixShareable, true);
  assert.equal(DEFAULT_STRATEGY.domainBlockShareable, true);
});

test("DEFAULT_FIXED_PREFIX_TEMPLATE is non-empty string", () => {
  assert.ok(DEFAULT_FIXED_PREFIX_TEMPLATE.length > 0);
  assert.ok(DEFAULT_FIXED_PREFIX_TEMPLATE.includes("System Configuration"));
});

test("createKvCachePrefixConfig returns defaults when no overrides", () => {
  const config = createKvCachePrefixConfig();
  assert.deepEqual(config.budget, DEFAULT_BUDGET);
  assert.deepEqual(config.strategy, DEFAULT_STRATEGY);
  assert.equal(config.fixedPrefixTemplate, DEFAULT_FIXED_PREFIX_TEMPLATE);
  assert.deepEqual(config.domainBlockTemplates, {});
});

test("createKvCachePrefixConfig applies budget overrides", () => {
  const config = createKvCachePrefixConfig({
    budget: { fixedPrefixMaxTokens: 2000, enforceBudget: false },
  });
  assert.equal(config.budget.fixedPrefixMaxTokens, 2000);
  assert.equal(config.budget.enforceBudget, false);
  assert.equal(config.budget.domainBlockMaxTokens, DEFAULT_BUDGET.domainBlockMaxTokens);
});

test("createKvCachePrefixConfig applies strategy overrides", () => {
  const config = createKvCachePrefixConfig({
    strategy: { kvCacheEnabled: false, cacheKeyStrategy: "exact_match" },
  });
  assert.equal(config.strategy.kvCacheEnabled, false);
  assert.equal(config.strategy.cacheKeyStrategy, "exact_match");
  assert.equal(config.strategy.fixedPrefixShareable, DEFAULT_STRATEGY.fixedPrefixShareable);
});

test("createKvCachePrefixConfig applies fixedPrefixTemplate override", () => {
  const config = createKvCachePrefixConfig({
    fixedPrefixTemplate: "Custom template",
  });
  assert.equal(config.fixedPrefixTemplate, "Custom template");
});

test("createKvCachePrefixConfig applies domainBlockTemplates override", () => {
  const config = createKvCachePrefixConfig({
    domainBlockTemplates: { "domain_1": "Template for domain 1" },
  });
  assert.deepEqual(config.domainBlockTemplates, { "domain_1": "Template for domain 1" });
});

test("estimateTokens calculates correctly (4 chars per token)", () => {
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens("abcd"), 1);
  assert.equal(estimateTokens("abcdefgh"), 2);
  assert.equal(estimateTokens("a".repeat(4000)), 1000);
});

test("estimateTokens handles fractional tokens by rounding up", () => {
  assert.equal(estimateTokens("ab"), 1);  // 2 chars / 4 = 0.5 -> ceil = 1
  assert.equal(estimateTokens("abc"), 1); // 3 chars / 4 = 0.75 -> ceil = 1
});

test("isWithinFixedPrefixBudget returns true when KV cache disabled", () => {
  const config = createKvCachePrefixConfig({
    strategy: { kvCacheEnabled: false },
  });
  assert.equal(isWithinFixedPrefixBudget("x".repeat(10000), config), true);
});

test("isWithinFixedPrefixBudget returns true when budget enforcement disabled", () => {
  const config = createKvCachePrefixConfig({
    budget: { enforceBudget: false },
  });
  assert.equal(isWithinFixedPrefixBudget("x".repeat(10000), config), true);
});

test("isWithinFixedPrefixBudget returns true when within budget", () => {
  const config = createKvCachePrefixConfig();
  assert.equal(isWithinFixedPrefixBudget("a".repeat(4000), config), true); // 1000 tokens
});

test("isWithinFixedPrefixBudget returns false when exceeds budget", () => {
  const config = createKvCachePrefixConfig();
  assert.equal(isWithinFixedPrefixBudget("a".repeat(4001), config), false); // 1001 tokens
});

test("isWithinDomainBlockBudget returns true when KV cache disabled", () => {
  const config = createKvCachePrefixConfig({
    strategy: { kvCacheEnabled: false },
  });
  assert.equal(isWithinDomainBlockBudget("x".repeat(10000), "domain_1", config), true);
});

test("isWithinDomainBlockBudget returns true when budget enforcement disabled", () => {
  const config = createKvCachePrefixConfig({
    budget: { enforceBudget: false },
  });
  assert.equal(isWithinDomainBlockBudget("x".repeat(10000), "domain_1", config), true);
});

test("isWithinDomainBlockBudget returns true when within budget", () => {
  const config = createKvCachePrefixConfig();
  assert.equal(isWithinDomainBlockBudget("a".repeat(1600), "domain_1", config), true); // 400 tokens
});

test("isWithinDomainBlockBudget returns false when exceeds budget", () => {
  const config = createKvCachePrefixConfig();
  assert.equal(isWithinDomainBlockBudget("a".repeat(1601), "domain_1", config), false); // 401 tokens
});

test("KvCachePrefixBudget type is correctly structured", () => {
  const budget: KvCachePrefixBudget = {
    fixedPrefixMaxTokens: 1500,
    domainBlockMaxTokens: 600,
    enforceBudget: true,
  };
  assert.equal(budget.fixedPrefixMaxTokens, 1500);
  assert.equal(budget.domainBlockMaxTokens, 600);
  assert.equal(budget.enforceBudget, true);
});

test("KvCachePrefixStrategy type is correctly structured", () => {
  const strategy: KvCachePrefixStrategy = {
    cacheKeyStrategy: "exact_match",
    kvCacheEnabled: true,
    fixedPrefixShareable: false,
    domainBlockShareable: true,
  };
  assert.equal(strategy.cacheKeyStrategy, "exact_match");
  assert.equal(strategy.kvCacheEnabled, true);
  assert.equal(strategy.fixedPrefixShareable, false);
  assert.equal(strategy.domainBlockShareable, true);
});

test("KvCachePrefixConfig type is correctly structured", () => {
  const config: KvCachePrefixConfig = {
    budget: { ...DEFAULT_BUDGET },
    strategy: { ...DEFAULT_STRATEGY },
    fixedPrefixTemplate: "Test template",
    domainBlockTemplates: { "test_domain": "Test domain block" },
  };
  assert.equal(config.fixedPrefixTemplate, "Test template");
  assert.equal(config.domainBlockTemplates["test_domain"], "Test domain block");
});