import assert from "node:assert/strict";
import test from "node:test";
import { createKvCachePrefixConfig, estimateTokens, isWithinFixedPrefixBudget, isWithinDomainBlockBudget, } from "../../../../src/platform/execution/execution-engine/kv-cache-prefix-config.js";
test("createKvCachePrefixConfig returns config with defaults", () => {
    const config = createKvCachePrefixConfig();
    assert.ok(config.budget);
    assert.equal(config.budget.fixedPrefixMaxTokens, 1000);
    assert.equal(config.budget.domainBlockMaxTokens, 400);
    assert.equal(config.budget.enforceBudget, true);
    assert.ok(config.strategy);
    assert.equal(config.strategy.cacheKeyStrategy, "hash_prefix");
    assert.equal(config.strategy.kvCacheEnabled, true);
    assert.equal(config.strategy.fixedPrefixShareable, true);
    assert.equal(config.strategy.domainBlockShareable, true);
    assert.ok(config.fixedPrefixTemplate.length > 0);
    assert.deepEqual(config.domainBlockTemplates, {});
});
test("createKvCachePrefixConfig applies budget overrides", () => {
    const config = createKvCachePrefixConfig({
        budget: {
            fixedPrefixMaxTokens: 2000,
            domainBlockMaxTokens: 800,
            enforceBudget: false,
        },
    });
    assert.equal(config.budget.fixedPrefixMaxTokens, 2000);
    assert.equal(config.budget.domainBlockMaxTokens, 800);
    assert.equal(config.budget.enforceBudget, false);
});
test("createKvCachePrefixConfig applies strategy overrides", () => {
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
test("createKvCachePrefixConfig applies fixedPrefixTemplate override", () => {
    const customTemplate = "Custom governance rules";
    const config = createKvCachePrefixConfig({
        fixedPrefixTemplate: customTemplate,
    });
    assert.equal(config.fixedPrefixTemplate, customTemplate);
});
test("createKvCachePrefixConfig applies domainBlockTemplates override", () => {
    const templates = {
        growth: "Growth-specific rules",
        ops: "Ops-specific rules",
    };
    const config = createKvCachePrefixConfig({
        domainBlockTemplates: templates,
    });
    assert.deepEqual(config.domainBlockTemplates, templates);
});
test("createKvCachePrefixConfig merges partial overrides with defaults", () => {
    const config = createKvCachePrefixConfig({
        budget: {
            fixedPrefixMaxTokens: 1500,
            // domainBlockMaxTokens should use default
        },
    });
    assert.equal(config.budget.fixedPrefixMaxTokens, 1500);
    assert.equal(config.budget.domainBlockMaxTokens, 400); // default
    assert.equal(config.budget.enforceBudget, true); // default
});
test("estimateTokens calculates correctly", () => {
    assert.equal(estimateTokens("1234"), 1); // 4 chars = 1 token
    assert.equal(estimateTokens("12345678"), 2); // 8 chars = 2 tokens
    assert.equal(estimateTokens(""), 0); // empty string
    assert.equal(estimateTokens("abc"), 1); // 3 chars rounds up to 1
    assert.equal(estimateTokens("abcdefgh"), 2); // 8 chars = 2 tokens
});
test("estimateTokens handles long strings", () => {
    const longString = "a".repeat(100);
    assert.equal(estimateTokens(longString), 25); // 100 chars / 4 = 25 tokens
});
test("estimateTokens handles unicode characters", () => {
    // Chinese characters - each character counts as 4 chars for token estimation
    const chinese = "你好世界"; // 4 chars
    assert.equal(estimateTokens(chinese), 1); // 4 chars / 4 = 1 token
    assert.equal(estimateTokens("你好世界你好世界"), 2); // 8 chars / 4 = 2 tokens
});
test("isWithinFixedPrefixBudget returns true when under budget", () => {
    const config = createKvCachePrefixConfig({
        budget: { fixedPrefixMaxTokens: 1000, enforceBudget: true },
        strategy: { kvCacheEnabled: true },
    });
    const text = "a".repeat(4000); // ~1000 tokens
    assert.equal(isWithinFixedPrefixBudget(text, config), true);
});
test("isWithinFixedPrefixBudget returns false when over budget", () => {
    const config = createKvCachePrefixConfig({
        budget: { fixedPrefixMaxTokens: 1000, enforceBudget: true },
        strategy: { kvCacheEnabled: true },
    });
    const text = "a".repeat(5000); // ~1250 tokens
    assert.equal(isWithinFixedPrefixBudget(text, config), false);
});
test("isWithinFixedPrefixBudget returns true when kvCacheDisabled", () => {
    const config = createKvCachePrefixConfig({
        budget: { fixedPrefixMaxTokens: 100, enforceBudget: true },
        strategy: { kvCacheEnabled: false },
    });
    const text = "a".repeat(10000); // far over budget
    assert.equal(isWithinFixedPrefixBudget(text, config), true);
});
test("isWithinFixedPrefixBudget returns true when enforceBudget is false", () => {
    const config = createKvCachePrefixConfig({
        budget: { fixedPrefixMaxTokens: 100, enforceBudget: false },
        strategy: { kvCacheEnabled: true },
    });
    const text = "a".repeat(10000); // far over budget
    assert.equal(isWithinFixedPrefixBudget(text, config), true);
});
test("isWithinDomainBlockBudget returns true when under budget", () => {
    const config = createKvCachePrefixConfig({
        budget: { domainBlockMaxTokens: 400, enforceBudget: true },
        strategy: { kvCacheEnabled: true },
    });
    const text = "a".repeat(1600); // ~400 tokens
    assert.equal(isWithinDomainBlockBudget(text, "growth", config), true);
});
test("isWithinDomainBlockBudget returns false when over budget", () => {
    const config = createKvCachePrefixConfig({
        budget: { domainBlockMaxTokens: 400, enforceBudget: true },
        strategy: { kvCacheEnabled: true },
    });
    const text = "a".repeat(2000); // ~500 tokens
    assert.equal(isWithinDomainBlockBudget(text, "growth", config), false);
});
test("isWithinDomainBlockBudget is independent of fixedPrefix budget", () => {
    const config = createKvCachePrefixConfig({
        budget: {
            fixedPrefixMaxTokens: 100, // very small
            domainBlockMaxTokens: 400,
            enforceBudget: true,
        },
        strategy: { kvCacheEnabled: true },
    });
    // Text that exceeds fixedPrefix budget but fits in domainBlock budget
    // 1200 chars ≈ 300 tokens - fits in domainBlock (400) but exceeds fixedPrefix (100)
    const text = "a".repeat(1200); // ~300 tokens
    assert.equal(isWithinFixedPrefixBudget(text, config), false); // 300 > 100
    assert.equal(isWithinDomainBlockBudget(text, "growth", config), true); // 300 < 400
});
test("isWithinDomainBlockBudget returns true when kvCacheDisabled", () => {
    const config = createKvCachePrefixConfig({
        budget: { domainBlockMaxTokens: 100, enforceBudget: true },
        strategy: { kvCacheEnabled: false },
    });
    const text = "a".repeat(10000); // far over budget
    assert.equal(isWithinDomainBlockBudget(text, "growth", config), true);
});
test("isWithinDomainBlockBudget returns true when enforceBudget is false", () => {
    const config = createKvCachePrefixConfig({
        budget: { domainBlockMaxTokens: 100, enforceBudget: false },
        strategy: { kvCacheEnabled: true },
    });
    const text = "a".repeat(10000); // far over budget
    assert.equal(isWithinDomainBlockBudget(text, "growth", config), true);
});
test("default fixedPrefixTemplate contains governance content", () => {
    const config = createKvCachePrefixConfig();
    assert.ok(config.fixedPrefixTemplate.includes("Governance"));
    assert.ok(config.fixedPrefixTemplate.includes("Constraints"));
    assert.ok(config.fixedPrefixTemplate.includes("Directives"));
});
test("createKvCachePrefixConfig handles empty overrides", () => {
    const config = createKvCachePrefixConfig({});
    assert.ok(config.budget);
    assert.ok(config.strategy);
    assert.ok(config.fixedPrefixTemplate);
    // Defaults should be applied
    assert.equal(config.budget.fixedPrefixMaxTokens, 1000);
    assert.equal(config.strategy.kvCacheEnabled, true);
});
//# sourceMappingURL=kv-cache-prefix-config.test.js.map