/**
 * Integration Test: KV Cache Prefix Configuration
 *
 * Verifies KV cache prefix budget enforcement and cache key strategy
 * configuration for the fixed prefix / domain block architecture.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  createKvCachePrefixConfig,
  estimateTokens,
  isWithinFixedPrefixBudget,
  isWithinDomainBlockBudget,
  type KvCachePrefixConfig,
} from "../../../../../src/platform/execution/execution-engine/kv-cache-prefix-config.js";

test("kv cache prefix config: creates config with defaults", () => {
  const config = createKvCachePrefixConfig();

  assert.equal(config.budget.fixedPrefixMaxTokens, 1000, "Should have default fixed prefix max tokens");
  assert.equal(config.budget.domainBlockMaxTokens, 400, "Should have default domain block max tokens");
  assert.equal(config.budget.enforceBudget, true, "Should enforce budget by default");
  assert.equal(config.strategy.cacheKeyStrategy, "hash_prefix", "Should use hash_prefix strategy by default");
  assert.equal(config.strategy.kvCacheEnabled, true, "Should enable KV cache by default");
  assert.equal(config.strategy.fixedPrefixShareable, true, "Should allow fixed prefix sharing by default");
  assert.equal(config.strategy.domainBlockShareable, true, "Should allow domain block sharing by default");
});

test("kv cache prefix config: overrides are applied correctly", () => {
  const config = createKvCachePrefixConfig({
    budget: { fixedPrefixMaxTokens: 2000 },
    strategy: { kvCacheEnabled: false },
    fixedPrefixTemplate: "Custom template",
    domainBlockTemplates: { engineering: "Engineering domain" },
  });

  assert.equal(config.budget.fixedPrefixMaxTokens, 2000, "Should override fixed prefix max tokens");
  assert.equal(config.budget.domainBlockMaxTokens, 400, "Should keep default domain block max tokens");
  assert.equal(config.strategy.kvCacheEnabled, false, "Should override KV cache enabled");
  assert.equal(config.fixedPrefixTemplate, "Custom template", "Should override fixed prefix template");
  assert.deepEqual(config.domainBlockTemplates, { engineering: "Engineering domain" }, "Should override domain templates");
});

test("kv cache prefix config: partial budget overrides", () => {
  const config = createKvCachePrefixConfig({
    budget: { enforceBudget: false },
  });

  assert.equal(config.budget.enforceBudget, false, "Should override enforce budget");
  assert.equal(config.budget.fixedPrefixMaxTokens, 1000, "Should keep default for fixed prefix");
  assert.equal(config.budget.domainBlockMaxTokens, 400, "Should keep default for domain block");
});

test("kv cache prefix config: partial strategy overrides", () => {
  const config = createKvCachePrefixConfig({
    strategy: { cacheKeyStrategy: "exact_match" },
  });

  assert.equal(config.strategy.cacheKeyStrategy, "exact_match", "Should override cache key strategy");
  assert.equal(config.strategy.kvCacheEnabled, true, "Should keep default KV cache enabled");
});

test("estimate tokens: uses 4 chars per token approximation", () => {
  assert.equal(estimateTokens(""), 0, "Empty string should be 0 tokens");
  assert.equal(estimateTokens("abcd"), 1, "4 chars should be 1 token");
  assert.equal(estimateTokens("abcdefgh"), 2, "8 chars should be 2 tokens");
  assert.equal(estimateTokens("a"), 1, "1 char should round up to 1 token");
  assert.equal(estimateTokens("abcdef"), 2, "6 chars should round up to 2 tokens");
  assert.equal(estimateTokens("a".repeat(1000)), 250, "1000 chars should be ~250 tokens");
});

test("isWithinFixedPrefixBudget: respects budget enforcement flag", () => {
  const configEnforce = createKvCachePrefixConfig({ budget: { enforceBudget: true } });
  const configNoEnforce = createKvCachePrefixConfig({ budget: { enforceBudget: false } });
  const shortText = "Short text";
  const longText = "a".repeat(5000); // ~1250 tokens, over 1000 limit

  assert.equal(isWithinFixedPrefixBudget(shortText, configEnforce), true, "Short text should be within budget when enforcing");
  assert.equal(isWithinFixedPrefixBudget(longText, configEnforce), false, "Long text should be over budget when enforcing");
  assert.equal(isWithinFixedPrefixBudget(longText, configNoEnforce), true, "Should ignore budget when not enforcing");
});

test("isWithinFixedPrefixBudget: respects kvCacheEnabled flag", () => {
  const configDisabled = createKvCachePrefixConfig({ strategy: { kvCacheEnabled: false } });
  const longText = "a".repeat(5000);

  assert.equal(isWithinFixedPrefixBudget(longText, configDisabled), true, "Should return true when KV cache disabled");
});

test("isWithinFixedPrefixBudget: respects configured max tokens", () => {
  const config = createKvCachePrefixConfig({ budget: { fixedPrefixMaxTokens: 500 } });
  const text500tokens = "a".repeat(2000); // ~500 tokens

  assert.equal(isWithinFixedPrefixBudget(text500tokens, config), true, "Exactly at limit should be within budget");
  assert.equal(isWithinFixedPrefixBudget(text500tokens + "x", config), false, "Over limit should be out of budget");
});

test("isWithinDomainBlockBudget: respects budget enforcement flag", () => {
  const configEnforce = createKvCachePrefixConfig({ budget: { enforceBudget: true } });
  const configNoEnforce = createKvCachePrefixConfig({ budget: { enforceBudget: false } });
  const text = "a".repeat(2000); // ~500 tokens, over 400 limit

  assert.equal(isWithinDomainBlockBudget(text, "engineering", configEnforce), false, "Should be over budget when enforcing");
  assert.equal(isWithinDomainBlockBudget(text, "engineering", configNoEnforce), true, "Should ignore budget when not enforcing");
});

test("isWithinDomainBlockBudget: respects kvCacheEnabled flag", () => {
  const configDisabled = createKvCachePrefixConfig({ strategy: { kvCacheEnabled: false } });
  const longText = "a".repeat(2000);

  assert.equal(isWithinDomainBlockBudget(longText, "engineering", configDisabled), true, "Should return true when KV cache disabled");
});

test("isWithinDomainBlockBudget: uses domain block max tokens", () => {
  const config = createKvCachePrefixConfig({ budget: { domainBlockMaxTokens: 300 } });
  const text300tokens = "a".repeat(1200); // ~300 tokens

  assert.equal(isWithinDomainBlockBudget(text300tokens, "engineering", config), true, "Exactly at limit should be within budget");
  assert.equal(isWithinDomainBlockBudget(text300tokens + "x", "engineering", config), false, "Over limit should be out of budget");
});

test("kv cache prefix config: default fixed prefix template is not empty", () => {
  const config = createKvCachePrefixConfig();
  assert.ok(config.fixedPrefixTemplate.length > 0, "Default fixed prefix template should not be empty");
  assert.ok(config.fixedPrefixTemplate.includes("Governance"), "Should contain Governance section");
  assert.ok(config.fixedPrefixTemplate.includes("Constraints"), "Should contain Constraints section");
  assert.ok(config.fixedPrefixTemplate.includes("Directives"), "Should contain Directives section");
});

test("kv cache prefix config: default domain block templates are empty", () => {
  const config = createKvCachePrefixConfig();
  assert.deepEqual(config.domainBlockTemplates, {}, "Default domain block templates should be empty");
});

test("kv cache prefix config: domain block templates can be added", () => {
  const config = createKvCachePrefixConfig({
    domainBlockTemplates: {
      engineering: "Engineering-specific rules",
      security: "Security-specific rules",
    },
  });

  assert.equal(config.domainBlockTemplates.engineering, "Engineering-specific rules");
  assert.equal(config.domainBlockTemplates.security, "Security-specific rules");
});

test("kv cache prefix config: sharing can be disabled", () => {
  const config = createKvCachePrefixConfig({
    strategy: {
      fixedPrefixShareable: false,
      domainBlockShareable: false,
    },
  });

  assert.equal(config.strategy.fixedPrefixShareable, false, "Fixed prefix sharing should be disabled");
  assert.equal(config.strategy.domainBlockShareable, false, "Domain block sharing should be disabled");
});

test("estimate tokens: handles unicode correctly", () => {
  // Unicode characters may take more bytes but token estimation is char-based
  const emoji = "👍";
  const chinese = "你好";

  assert.equal(estimateTokens(emoji), 1, "Single emoji should be 1 token");
  assert.equal(estimateTokens(chinese), 1, "Chinese chars should each be ~1 token (char count / 4)");
});

test("isWithinFixedPrefixBudget: handles empty text", () => {
  const config = createKvCachePrefixConfig();
  assert.equal(isWithinFixedPrefixBudget("", config), true, "Empty text should be within budget");
});

test("isWithinDomainBlockBudget: handles empty text", () => {
  const config = createKvCachePrefixConfig();
  assert.equal(isWithinDomainBlockBudget("", "any", config), true, "Empty text should be within budget");
});

test("kv cache prefix config: all budget fields are required in type", () => {
  const config = createKvCachePrefixConfig({});
  // Should have all required fields with defaults applied
  assert.ok(typeof config.budget.fixedPrefixMaxTokens === "number");
  assert.ok(typeof config.budget.domainBlockMaxTokens === "number");
  assert.ok(typeof config.budget.enforceBudget === "boolean");
});

test("kv cache prefix config: all strategy fields are required in type", () => {
  const config = createKvCachePrefixConfig({});
  // Should have all required fields with defaults applied
  assert.equal(config.strategy.cacheKeyStrategy, "hash_prefix");
  assert.ok(typeof config.strategy.kvCacheEnabled === "boolean");
  assert.ok(typeof config.strategy.fixedPrefixShareable === "boolean");
  assert.ok(typeof config.strategy.domainBlockShareable === "boolean");
});
