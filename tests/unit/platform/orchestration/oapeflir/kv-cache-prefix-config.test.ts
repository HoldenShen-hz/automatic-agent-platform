import assert from "node:assert/strict";
import test from "node:test";

import {
  KvCacheLayerSchema,
  KvCachePrefixConfigSchema,
  buildCacheKey,
  estimateTokens,
} from "../../../../../src/platform/orchestration/oapeflir/kv-cache-prefix-config.js";

test("KvCacheLayerSchema parses valid layer", () => {
  const result = KvCacheLayerSchema.parse({
    fixedPrefix: "prefix content",
  });
  assert.equal(result.fixedPrefix, "prefix content");
});

test("KvCacheLayerSchema accepts optional fields", () => {
  const result = KvCacheLayerSchema.parse({
    fixedPrefix: "prefix",
    domainBlock: "domain content",
    variableSuffix: "variable content",
  });
  assert.equal(result.domainBlock, "domain content");
  assert.equal(result.variableSuffix, "variable content");
});

test("KvCachePrefixConfigSchema parses valid config", () => {
  const result = KvCachePrefixConfigSchema.parse({
    cacheKeyPrefix: "kv_prefix",
    fixedPrefixTokens: 1024,
    domainBlockTokens: 384,
    variableSuffixTokens: 512,
    enabled: true,
    domainBlocks: { growth: "block1", ops: "block2" },
  });
  assert.equal(result.cacheKeyPrefix, "kv_prefix");
  assert.equal(result.fixedPrefixTokens, 1024);
  assert.equal(result.enabled, true);
});

test("KvCachePrefixConfigSchema applies defaults", () => {
  const result = KvCachePrefixConfigSchema.parse({
    cacheKeyPrefix: "default_prefix",
  });
  assert.equal(result.fixedPrefixTokens, 1024);
  assert.equal(result.domainBlockTokens, 384);
  assert.equal(result.variableSuffixTokens, 512);
  assert.equal(result.enabled, true);
  assert.deepEqual(result.domainBlocks, {});
});

test("KvCachePrefixConfigSchema rejects empty cacheKeyPrefix", () => {
  assert.throws(() => {
    KvCachePrefixConfigSchema.parse({
      cacheKeyPrefix: "",
    });
  });
});

test("buildCacheKey returns string starting with kv_", () => {
  const config = KvCachePrefixConfigSchema.parse({
    cacheKeyPrefix: "test_prefix",
  });
  const key = buildCacheKey(config, "growth");
  assert.ok(key.startsWith("kv_"));
});

test("buildCacheKey includes domain in key", () => {
  const config = KvCachePrefixConfigSchema.parse({
    cacheKeyPrefix: "test_prefix",
  });
  const key1 = buildCacheKey(config, "growth");
  const key2 = buildCacheKey(config, "operations");
  assert.ok(key1 !== key2);
});

test("buildCacheKey uses domain block if present", () => {
  const config = KvCachePrefixConfigSchema.parse({
    cacheKeyPrefix: "test_prefix",
    domainBlocks: { growth: "special_block" },
  });
  const keyWithBlock = buildCacheKey(config, "growth");
  const keyWithoutBlock = buildCacheKey({ ...config, domainBlocks: {} }, "growth");
  assert.ok(keyWithBlock !== keyWithoutBlock);
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
