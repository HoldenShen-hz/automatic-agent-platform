/**
 * Integration Test: Prompt Partition Cache
 *
 * Verifies prompt partition cache service correctly partitions prompts
 * into static/dynamic parts and tracks reuse statistics for cache efficiency.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  partitionPromptForCache,
  PromptPartitionCacheService,
  type PromptPartitionInput,
} from "../../../../../src/platform/five-plane-execution/execution-engine/prompt-partition-cache.js";

test("prompt partition cache: system message is classified as static", () => {
  const input: PromptPartitionInput = {
    model: "claude-3-5",
    profileId: "default",
    domainId: "general",
    messages: [
      { role: "system", content: "You are a helpful assistant" },
      { role: "user", content: "Hello" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.staticMessageCount, 1, "Should have 1 static message");
  assert.equal(result.dynamicMessageCount, 1, "Should have 1 dynamic message");
  assert.equal(result.model, "claude-3-5");
  assert.equal(result.profileId, "default");
  assert.equal(result.domainId, "general");
});

test("prompt partition cache: only initial system messages are static", () => {
  const input: PromptPartitionInput = {
    model: "claude-3-5",
    messages: [
      { role: "system", content: "System prompt" },
      { role: "system", content: "Additional system context" },
      { role: "user", content: "User message" },
      { role: "assistant", content: "Assistant response" },
      { role: "system", content: "Late system" }, // This should be dynamic since it appears after user
    ],
  };

  const result = partitionPromptForCache(input);

  // Only the first consecutive system messages are static
  assert.equal(result.staticMessageCount, 2, "First two system messages should be static");
  assert.equal(result.dynamicMessageCount, 3, "Rest should be dynamic");
});

test("prompt partition cache: generates stable cache keys", () => {
  const input1: PromptPartitionInput = {
    model: "claude-3-5",
    profileId: "default",
    messages: [{ role: "system", content: "You are helpful" }],
  };

  const input2: PromptPartitionInput = {
    model: "claude-3-5",
    profileId: "default",
    messages: [{ role: "system", content: "You are helpful" }],
  };

  const result1 = partitionPromptForCache(input1);
  const result2 = partitionPromptForCache(input2);

  assert.equal(result1.staticCacheKey, result2.staticCacheKey, "Identical prompts should have same static cache key");
  assert.equal(result1.dynamicCacheKey, result2.dynamicCacheKey, "Identical prompts should have same dynamic cache key");
});

test("prompt partition cache: different content produces different keys", () => {
  const input1: PromptPartitionInput = {
    model: "claude-3-5",
    messages: [{ role: "system", content: "You are helpful" }],
  };

  const input2: PromptPartitionInput = {
    model: "claude-3-5",
    messages: [{ role: "system", content: "You are different" }],
  };

  const result1 = partitionPromptForCache(input1);
  const result2 = partitionPromptForCache(input2);

  assert.notEqual(result1.staticCacheKey, result2.staticCacheKey, "Different content should produce different keys");
});

test("prompt partition cache: model affects cache key", () => {
  const input1: PromptPartitionInput = {
    model: "claude-3-5",
    messages: [{ role: "system", content: "You are helpful" }],
  };

  const input2: PromptPartitionInput = {
    model: "claude-4",
    messages: [{ role: "system", content: "You are helpful" }],
  };

  const result1 = partitionPromptForCache(input1);
  const result2 = partitionPromptForCache(input2);

  assert.notEqual(result1.staticCacheKey, result2.staticCacheKey, "Different models should produce different keys");
});

test("prompt partition cache: profileId affects cache key", () => {
  const input1: PromptPartitionInput = {
    model: "claude-3-5",
    profileId: "profile-a",
    messages: [{ role: "system", content: "You are helpful" }],
  };

  const input2: PromptPartitionInput = {
    model: "claude-3-5",
    profileId: "profile-b",
    messages: [{ role: "system", content: "You are helpful" }],
  };

  const result1 = partitionPromptForCache(input1);
  const result2 = partitionPromptForCache(input2);

  assert.notEqual(result1.staticCacheKey, result2.staticCacheKey, "Different profiles should produce different keys");
});

test("prompt partition cache: computes correct byte sizes", () => {
  const input: PromptPartitionInput = {
    model: "claude-3-5",
    messages: [
      { role: "system", content: "System" },
      { role: "user", content: "User message" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.ok(result.stablePrefixBytes > 0, "Should compute stable prefix bytes");
  assert.ok(result.fixedPrefixBytes > 0, "Should compute fixed prefix bytes");
  assert.ok(result.variableSuffixBytes > 0, "Should compute variable suffix bytes");
  // Dynamic part should include the user message
  assert.ok(result.variableSuffixBytes > result.domainBlockBytes, "Variable suffix should be larger for user content");
});

test("prompt partition cache: kv cache can be disabled", () => {
  const input: PromptPartitionInput = {
    model: "claude-3-5",
    kvCache: { enabled: false },
    messages: [{ role: "system", content: "Test" }],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.kvCacheEnabled, false, "KV cache should be disabled");
});

test("prompt partition cache: cache key strategy can be exact match", () => {
  const input: PromptPartitionInput = {
    model: "claude-3-5",
    kvCache: { cacheKeyStrategy: "exact_match" },
    messages: [{ role: "system", content: "Test content" }],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.cacheKeyStrategy, "exact_match", "Cache key strategy should be exact_match");
  assert.ok(result.fixedPrefixCacheKey.length > 0, "Should have fixed prefix cache key");
});

test("prompt partition cache: empty messages are handled", () => {
  const input: PromptPartitionInput = {
    model: "claude-3-5",
    messages: [],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.staticMessageCount, 0, "Should have 0 static messages");
  assert.equal(result.dynamicMessageCount, 0, "Should have 0 dynamic messages");
  assert.ok(result.staticCacheKey.length > 0, "Should still generate cache key");
});

test("prompt partition cache: null role is treated as non-system", () => {
  const input: PromptPartitionInput = {
    model: "claude-3-5",
    messages: [
      { role: null, content: "Null role" },
      { role: "user", content: "User message" },
    ],
  };

  const result = partitionPromptForCache(input);

  // Null role should not be treated as system
  assert.equal(result.staticMessageCount, 0, "Null role should not be static");
  assert.equal(result.dynamicMessageCount, 2, "All messages should be dynamic");
});

test("prompt partition cache service: records usage and tracks reuse", () => {
  const service = new PromptPartitionCacheService();

  // Use identical messages to test reuse tracking
  const sharedInput: PromptPartitionInput = {
    model: "claude-3-5",
    profileId: "test",
    messages: [
      { role: "system", content: "Shared prompt" },
      { role: "user", content: "Same message" },
    ],
  };

  const usage1 = service.record(sharedInput);
  const usage2 = service.record(sharedInput);

  assert.equal(usage1.reuseCount, 0, "First record should have reuse count 0");
  assert.equal(usage2.reuseCount, 1, "Second record should have reuse count 1");
  assert.ok(usage2.firstSeenAt <= usage2.lastSeenAt, "firstSeenAt should be <= lastSeenAt");
});

test("prompt partition cache service: getUsage returns correct stats", () => {
  const service = new PromptPartitionCacheService();

  const input: PromptPartitionInput = {
    model: "claude-3-5",
    messages: [{ role: "system", content: "Test" }],
  };

  service.record(input);
  const usage = service.getUsage(partitionPromptForCache(input).dynamicCacheKey);

  assert.ok(usage != null, "Should return usage for known key");
  assert.equal(usage!.reuseCount, 0, "Should have correct reuse count");
});

test("prompt partition cache service: getUsage returns null for unknown key", () => {
  const service = new PromptPartitionCacheService();
  const usage = service.getUsage("unknown-key");
  assert.equal(usage, null, "Should return null for unknown key");
});

test("prompt partition cache service: listUsage returns all tracked partitions", () => {
  const service = new PromptPartitionCacheService();

  service.record({ model: "model-a", messages: [{ role: "system", content: "A" }] });
  service.record({ model: "model-b", messages: [{ role: "system", content: "B" }] });
  service.record({ model: "model-c", messages: [{ role: "system", content: "C" }] });

  const all = service.listUsage();
  assert.equal(all.length, 3, "Should track 3 partitions");
});

test("prompt partition cache service: clear removes all usage", () => {
  const service = new PromptPartitionCacheService();

  service.record({ model: "test", messages: [{ role: "system", content: "Test" }] });
  assert.equal(service.listUsage().length, 1, "Should have 1 tracked partition");

  service.clear();
  assert.equal(service.listUsage().length, 0, "Should have 0 tracked partitions after clear");
});

test("prompt partition cache: domain block is separated from fixed prefix", () => {
  const input: PromptPartitionInput = {
    model: "claude-3-5",
    profileId: "default",
    domainId: "engineering",
    kvCache: { fixedPrefixMessageCount: 1 },
    messages: [
      { role: "system", content: "Base system prompt" },
      { role: "system", content: "Domain-specific instructions" },
      { role: "user", content: "Task request" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.fixedPrefixMessageCount, 1, "Should have 1 fixed prefix message");
  assert.equal(result.domainBlockMessageCount, 1, "Should have 1 domain block message");
  assert.equal(result.variableMessageCount, 1, "Should have 1 variable message");
  assert.ok(result.domainBlockCacheKey != null, "Should have domain block cache key");
});

test("prompt partition cache: digests are computed correctly", () => {
  const input: PromptPartitionInput = {
    model: "claude-3-5",
    messages: [
      { role: "system", content: "System" },
      { role: "user", content: "User" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.ok(result.staticDigest.length > 0, "Should have static digest");
  assert.ok(result.dynamicDigest.length > 0, "Should have dynamic digest");
  assert.ok(result.fixedPrefixDigest.length > 0, "Should have fixed prefix digest");
  assert.ok(result.domainBlockDigest.length > 0, "Domain block digest should be computed even if empty");
  assert.ok(result.variableSuffixDigest.length > 0, "Should have variable suffix digest");
});
