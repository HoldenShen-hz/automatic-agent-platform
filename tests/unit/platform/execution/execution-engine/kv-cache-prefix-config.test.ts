import assert from "node:assert/strict";
import test from "node:test";

import {
  createKvCachePrefixConfig,
  estimateTokens,
  isWithinFixedPrefixBudget,
  isWithinDomainBlockBudget,
} from "../../../../../src/platform/execution/execution-engine/kv-cache-prefix-config.js";

test("createKvCachePrefixConfig returns default values", () => {
  const config = createKvCachePrefixConfig();

  assert.equal(config.budget.fixedPrefixMaxTokens, 1000);
  assert.equal(config.budget.domainBlockMaxTokens, 400);
  assert.equal(config.budget.enforceBudget, true);
  assert.equal(config.strategy.kvCacheEnabled, true);
  assert.equal(config.strategy.cacheKeyStrategy, "hash_prefix");
  assert.equal(config.strategy.fixedPrefixShareable, true);
  assert.equal(config.strategy.domainBlockShareable, true);
  assert.ok(config.fixedPrefixTemplate.length > 0);
});

test("createKvCachePrefixConfig applies overrides", () => {
  const config = createKvCachePrefixConfig({
    budget: { fixedPrefixMaxTokens: 2000 },
    strategy: { kvCacheEnabled: false },
  });

  assert.equal(config.budget.fixedPrefixMaxTokens, 2000);
  assert.equal(config.budget.domainBlockMaxTokens, 400);
  assert.equal(config.strategy.kvCacheEnabled, false);
  assert.equal(config.strategy.cacheKeyStrategy, "hash_prefix");
});

test("createKvCachePrefixConfig merges domain block templates", () => {
  const config = createKvCachePrefixConfig({
    domainBlockTemplates: {
      "domain-a": "Domain A specific rules",
      "domain-b": "Domain B specific rules",
    },
  });

  assert.ok(config.domainBlockTemplates["domain-a"]);
  assert.ok(config.domainBlockTemplates["domain-b"]);
});

test("estimateTokens calculates rough token count", () => {
  // 4 chars per token approximation
  assert.equal(estimateTokens("abcd"), 1);
  assert.equal(estimateTokens("abcdefgh"), 2);
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens("a".repeat(100)), 25);
});

test("isWithinFixedPrefixBudget returns true when under budget", () => {
  const config = createKvCachePrefixConfig();
  const text = "A".repeat(1000);

  assert.equal(isWithinFixedPrefixBudget(text, config), true);
});

test("isWithinFixedPrefixBudget returns true when budget disabled", () => {
  const config = createKvCachePrefixConfig({
    budget: { enforceBudget: false },
  });
  const text = "A".repeat(10000);

  assert.equal(isWithinFixedPrefixBudget(text, config), true);
});

test("isWithinFixedPrefixBudget returns false when over budget", () => {
  const config = createKvCachePrefixConfig();
  const text = "A".repeat(5000);

  assert.equal(isWithinFixedPrefixBudget(text, config), false);
});

test("isWithinFixedPrefixBudget returns true when KV cache disabled", () => {
  const config = createKvCachePrefixConfig({
    strategy: { kvCacheEnabled: false },
  });
  const text = "A".repeat(10000);

  assert.equal(isWithinFixedPrefixBudget(text, config), true);
});

test("isWithinDomainBlockBudget returns true when under budget", () => {
  const config = createKvCachePrefixConfig();
  const text = "A".repeat(400);

  assert.equal(isWithinDomainBlockBudget(text, "domain-a", config), true);
});

test("isWithinDomainBlockBudget returns false when over budget", () => {
  const config = createKvCachePrefixConfig();
  const text = "A".repeat(2000);

  assert.equal(isWithinDomainBlockBudget(text, "domain-a", config), false);
});

test("isWithinDomainBlockBudget uses domainBlockMaxTokens", () => {
  const config = createKvCachePrefixConfig({
    budget: { domainBlockMaxTokens: 100 },
  });
  const text = "A".repeat(500);

  assert.equal(isWithinDomainBlockBudget(text, "domain-b", config), false);
});

test("isWithinDomainBlockBudget handles different domains independently", () => {
  const config = createKvCachePrefixConfig({
    budget: { domainBlockMaxTokens: 100 },
    domainBlockTemplates: {
      "domain-a": "Domain A content",
      "domain-b": "Domain B content",
    },
  });

  const smallText = "A".repeat(500);
  assert.equal(isWithinDomainBlockBudget(smallText, "domain-a", config), false);
  assert.equal(isWithinDomainBlockBudget(smallText, "domain-b", config), false);
});

test("createKvCachePrefixConfig handles empty overrides", () => {
  const config = createKvCachePrefixConfig({});

  assert.equal(config.budget.fixedPrefixMaxTokens, 1000);
  assert.equal(config.budget.domainBlockMaxTokens, 400);
});

test("estimateTokens handles edge cases", () => {
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens("a"), 1);
  assert.equal(estimateTokens("ab"), 1);
  assert.equal(estimateTokens("abc"), 1);
  assert.equal(estimateTokens("abcd"), 1);
  assert.equal(estimateTokens("abcde"), 2);
});

test("isWithinFixedPrefixBudget edge case - exact boundary", () => {
  const config = createKvCachePrefixConfig({
    budget: { fixedPrefixMaxTokens: 100 },
  });
  // At boundary: 100 tokens * 4 chars = 400 chars
  const text = "a".repeat(400);
  assert.equal(isWithinFixedPrefixBudget(text, config), true);
});

test("isWithinDomainBlockBudget edge case - exact boundary", () => {
  const config = createKvCachePrefixConfig({
    budget: { domainBlockMaxTokens: 50 },
  });
  // At boundary: 50 tokens * 4 chars = 200 chars
  const text = "a".repeat(200);
  assert.equal(isWithinDomainBlockBudget(text, "domain-x", config), true);
});