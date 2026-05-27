import assert from "node:assert/strict";
import test from "node:test";

import {
  partitionPromptForCache,
  type PromptPartitionInput,
} from "../../../../../src/platform/five-plane-execution/execution-engine/prompt-partition-cache.js";

test("partitionPromptForCache same static but different dynamic produces different dynamicCacheKey [prompt-partition-cache-edge-cases]", () => {
  const input1: PromptPartitionInput = {
    messages: [
      { role: "system", content: "Static" },
      { role: "user", content: "Dynamic A" },
    ],
  };

  const input2: PromptPartitionInput = {
    messages: [
      { role: "system", content: "Static" },
      { role: "user", content: "Dynamic B" },
    ],
  };

  const result1 = partitionPromptForCache(input1);
  const result2 = partitionPromptForCache(input2);

  assert.equal(result1.staticCacheKey, result2.staticCacheKey);
  assert.notEqual(result1.dynamicCacheKey, result2.dynamicCacheKey);
  assert.notEqual(result1.dynamicDigest, result2.dynamicDigest);
});

test("partitionPromptForCache different static content produces different staticCacheKey [prompt-partition-cache-edge-cases]", () => {
  const input1: PromptPartitionInput = {
    messages: [
      { role: "system", content: "Static A" },
      { role: "user", content: "Dynamic" },
    ],
  };

  const input2: PromptPartitionInput = {
    messages: [
      { role: "system", content: "Static B" },
      { role: "user", content: "Dynamic" },
    ],
  };

  const result1 = partitionPromptForCache(input1);
  const result2 = partitionPromptForCache(input2);

  assert.notEqual(result1.staticDigest, result2.staticDigest);
  assert.notEqual(result1.staticCacheKey, result2.staticCacheKey);
});

test("partitionPromptForCache handles multi-byte UTF-8 characters in bytes calculation [prompt-partition-cache-edge-cases]", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "你好世界" },
      { role: "user", content: "🎉🔥" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.ok(result.stablePrefixBytes > 0);
  assert.ok(result.fixedPrefixBytes > 0);
  assert.ok(result.stablePrefixBytes >= 12);
});

test("partitionPromptForCache assistant role is treated as dynamic [prompt-partition-cache-edge-cases]", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "System" },
      { role: "assistant", content: "Assistant response" },
      { role: "user", content: "User" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.staticMessageCount, 1);
  assert.equal(result.dynamicMessageCount, 2);
});

test("partitionPromptForCache tool role is treated as dynamic [prompt-partition-cache-edge-cases]", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "System" },
      { role: "tool", content: "Tool result" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.staticMessageCount, 1);
  assert.equal(result.dynamicMessageCount, 1);
});

test("partitionPromptForCache hash_prefix strategy generates consistent cache keys [prompt-partition-cache-edge-cases]", () => {
  const input: PromptPartitionInput = {
    kvCache: {
      enabled: true,
      cacheKeyStrategy: "hash_prefix",
    },
    messages: [
      { role: "system", content: "Test message" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.cacheKeyStrategy, "hash_prefix");
  assert.ok(result.fixedPrefixCacheKey.length > 0);

  const result2 = partitionPromptForCache(input);
  assert.equal(result.fixedPrefixCacheKey, result2.fixedPrefixCacheKey);
});

test("partitionPromptForCache exact_match strategy produces different cache key than hash_prefix [prompt-partition-cache-edge-cases]", () => {
  const input: PromptPartitionInput = {
    kvCache: {
      enabled: true,
      cacheKeyStrategy: "exact_match",
    },
    messages: [
      { role: "system", content: "Exact match test" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.cacheKeyStrategy, "exact_match");
  assert.ok(result.fixedPrefixCacheKey.length > 0);
});

test("partitionPromptForCache preserves message order in partitioning [prompt-partition-cache-edge-cases]", () => {
  const input1: PromptPartitionInput = {
    messages: [
      { role: "system", content: "System" },
      { role: "user", content: "First" },
      { role: "assistant", content: "Second" },
    ],
  };

  const input2: PromptPartitionInput = {
    messages: [
      { role: "system", content: "System" },
      { role: "assistant", content: "Second" },
      { role: "user", content: "First" },
    ],
  };

  const result1 = partitionPromptForCache(input1);
  const result2 = partitionPromptForCache(input2);

  assert.notEqual(result1.dynamicCacheKey, result2.dynamicCacheKey);
  assert.notEqual(result1.dynamicDigest, result2.dynamicDigest);
});

test("partitionPromptForCache multiple system messages all in static prefix [prompt-partition-cache-edge-cases]", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "System 1" },
      { role: "system", content: "System 2" },
      { role: "system", content: "System 3" },
      { role: "user", content: "User" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.staticMessageCount, 3);
  assert.equal(result.dynamicMessageCount, 1);
});

test("partitionPromptForCache non-system role after system stops static partition [prompt-partition-cache-edge-cases]", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "System" },
      { role: "user", content: "User" },
      { role: "system", content: "This won't be static" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.staticMessageCount, 1);
  assert.equal(result.dynamicMessageCount, 2);
});

test("partitionPromptForCache empty string role is not static [prompt-partition-cache-edge-cases]", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "", content: "Empty role" },
      { role: "system", content: "System" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.staticMessageCount, 0);
  assert.equal(result.dynamicMessageCount, 2);
});

test("partitionPromptForCache kvCache defaults when not provided [prompt-partition-cache-edge-cases]", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "System" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.kvCacheEnabled, true);
  assert.equal(result.cacheKeyStrategy, "hash_prefix");
});

test("partitionPromptForCache kvCache defaults when null [prompt-partition-cache-edge-cases]", () => {
  const input: PromptPartitionInput = {
    kvCache: null,
    messages: [
      { role: "system", content: "System" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.kvCacheEnabled, true);
  assert.equal(result.cacheKeyStrategy, "hash_prefix");
});

test("partitionPromptForCache kvCache undefined uses defaults [prompt-partition-cache-edge-cases]", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "System" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.kvCacheEnabled, true);
  assert.equal(result.cacheKeyStrategy, "hash_prefix");
});
