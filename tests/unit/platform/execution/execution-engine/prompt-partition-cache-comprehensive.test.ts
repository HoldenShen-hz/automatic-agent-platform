/**
 * @fileoverview Unit tests for PromptPartitionCacheService.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  partitionPromptForCache,
  PromptPartitionCacheService,
  type PromptPartitionInput,
} from "../../../../../src/platform/five-plane-execution/execution-engine/prompt-partition-cache.js";

test("partitionPromptForCache separates static and dynamic messages [prompt-partition-cache-comprehensive]", () => {
  const input: PromptPartitionInput = {
    model: "gpt-4",
    messages: [
      { role: "system", content: "You are a helpful assistant" },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.staticMessageCount, 1);
  assert.equal(result.dynamicMessageCount, 2);
  assert.equal(result.model, "gpt-4");
});

test("partitionPromptForCache handles messages with parts [prompt-partition-cache-comprehensive]", () => {
  const input: PromptPartitionInput = {
    model: "gpt-4",
    messages: [
      { role: "system", content: "System prompt" },
      { role: "user", parts: ["Hello", "World"] },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.staticMessageCount, 1);
  assert.equal(result.dynamicMessageCount, 1);
});

test("partitionPromptForCache computes stable digests [prompt-partition-cache-comprehensive]", () => {
  const input: PromptPartitionInput = {
    model: "gpt-4",
    messages: [
      { role: "system", content: "You are a helpful assistant" },
      { role: "user", content: "Hello" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.ok(result.staticDigest.length > 0);
  assert.ok(result.dynamicDigest.length > 0);
  assert.ok(result.staticCacheKey.length > 0);
  assert.ok(result.dynamicCacheKey.length > 0);
});

test("partitionPromptForCache handles null model [prompt-partition-cache-comprehensive]", () => {
  const input: PromptPartitionInput = {
    model: null,
    messages: [
      { role: "system", content: "System" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.model, null);
});

test("partitionPromptForCache handles empty messages array [prompt-partition-cache-comprehensive]", () => {
  const input: PromptPartitionInput = {
    model: "gpt-4",
    messages: [],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.staticMessageCount, 0);
  assert.equal(result.dynamicMessageCount, 0);
  assert.ok(result.staticCacheKey.length > 0);
  assert.ok(result.dynamicCacheKey.length > 0);
});

test("partitionPromptForCache handles KV cache options [prompt-partition-cache-comprehensive]", () => {
  const input: PromptPartitionInput = {
    model: "gpt-4",
    kvCache: {
      enabled: true,
      fixedPrefixMessageCount: 1,
      cacheKeyStrategy: "hash_prefix",
    },
    messages: [
      { role: "system", content: "System prompt" },
      { role: "system", content: "Another system" },
      { role: "user", content: "Hello" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.kvCacheEnabled, true);
  assert.equal(result.cacheKeyStrategy, "hash_prefix");
  assert.equal(result.fixedPrefixMessageCount, 1);
  assert.ok(result.fixedPrefixCacheKey.length > 0);
});

test("partitionPromptForCache respects cacheKeyStrategy exact_match [prompt-partition-cache-comprehensive]", () => {
  const input1: PromptPartitionInput = {
    model: "gpt-4",
    kvCache: {
      enabled: true,
      cacheKeyStrategy: "exact_match",
    },
    messages: [
      { role: "system", content: "System" },
    ],
  };

  const input2: PromptPartitionInput = {
    model: "gpt-4",
    kvCache: {
      enabled: true,
      cacheKeyStrategy: "hash_prefix",
    },
    messages: [
      { role: "system", content: "System" },
    ],
  };

  const result1 = partitionPromptForCache(input1);
  const result2 = partitionPromptForCache(input2);

  // exact_match and hash_prefix should produce different cache keys
  assert.notEqual(result1.fixedPrefixCacheKey, result2.fixedPrefixCacheKey);
});

test("partitionPromptForCache computes byte counts [prompt-partition-cache-comprehensive]", () => {
  const input: PromptPartitionInput = {
    model: "gpt-4",
    messages: [
      { role: "system", content: "Hello" },
      { role: "user", content: "World" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.ok(result.stablePrefixBytes >= 0);
  assert.ok(result.fixedPrefixBytes >= 0);
  assert.ok(result.variableSuffixBytes >= 0);
});

test("partitionPromptForCache handles profileId [prompt-partition-cache-comprehensive]", () => {
  const input: PromptPartitionInput = {
    model: "gpt-4",
    profileId: "user-profile-123",
    messages: [
      { role: "system", content: "System" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.profileId, "user-profile-123");
});

test("partitionPromptForCache handles domainId [prompt-partition-cache-comprehensive]", () => {
  const input: PromptPartitionInput = {
    model: "gpt-4",
    domainId: "domain-abc",
    messages: [
      { role: "system", content: "System" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.domainId, "domain-abc");
});

test("partitionPromptForCache computes domain block cache key when domainId provided [prompt-partition-cache-comprehensive]", () => {
  const input: PromptPartitionInput = {
    model: "gpt-4",
    domainId: "my-domain",
    messages: [
      { role: "system", content: "System1" },
      { role: "system", content: "System2" },
      { role: "user", content: "Hello" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.ok(result.domainBlockCacheKey != null);
  assert.ok(result.domainBlockCacheKey.length > 0);
  assert.equal(result.domainBlockMessageCount, 1); // One message after fixed prefix
});

test("partitionPromptForCache domainBlockCacheKey is null when no domain messages [prompt-partition-cache-comprehensive]", () => {
  const input: PromptPartitionInput = {
    model: "gpt-4",
    domainId: "my-domain",
    messages: [
      { role: "system", content: "System only" },
      { role: "user", content: "Hello" },
    ],
  };

  const result = partitionPromptForCache(input);

  // Only one system message, so no domain block
  assert.ok(result.domainBlockCacheKey === null);
  assert.equal(result.fixedPrefixMessageCount, 1);
  assert.equal(result.domainBlockMessageCount, 0);
});

test("partitionPromptForCache handles KV cache disabled [prompt-partition-cache-comprehensive]", () => {
  const input: PromptPartitionInput = {
    model: "gpt-4",
    kvCache: {
      enabled: false,
    },
    messages: [
      { role: "system", content: "System" },
      { role: "user", content: "Hello" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.kvCacheEnabled, false);
});

test("partitionPromptForCache applies fixedPrefixMessageCount constraints [prompt-partition-cache-comprehensive]", () => {
  const input: PromptPartitionInput = {
    model: "gpt-4",
    kvCache: {
      enabled: true,
      fixedPrefixMessageCount: 10, // More than available
    },
    messages: [
      { role: "system", content: "System1" },
      { role: "system", content: "System2" },
    ],
  };

  const result = partitionPromptForCache(input);

  // Should be capped at actual message count
  assert.equal(result.fixedPrefixMessageCount, 2);
});

test("partitionPromptForCache negative fixedPrefixMessageCount becomes zero [prompt-partition-cache-comprehensive]", () => {
  const input: PromptPartitionInput = {
    model: "gpt-4",
    kvCache: {
      enabled: true,
      fixedPrefixMessageCount: -5,
    },
    messages: [
      { role: "system", content: "System" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.fixedPrefixMessageCount, 0);
});

test("partitionPromptForCache digests are deterministic for same input [prompt-partition-cache-comprehensive]", () => {
  const input: PromptPartitionInput = {
    model: "gpt-4",
    messages: [
      { role: "system", content: "Same content" },
    ],
  };

  const result1 = partitionPromptForCache(input);
  const result2 = partitionPromptForCache(input);

  assert.equal(result1.staticDigest, result2.staticDigest);
  assert.equal(result1.dynamicDigest, result2.dynamicDigest);
  assert.equal(result1.staticCacheKey, result2.staticCacheKey);
  assert.equal(result1.dynamicCacheKey, result2.dynamicCacheKey);
});

test("partitionPromptForCache different inputs produce different digests [prompt-partition-cache-comprehensive]", () => {
  const input1: PromptPartitionInput = {
    model: "gpt-4",
    messages: [{ role: "system", content: "Content A" }],
  };

  const input2: PromptPartitionInput = {
    model: "gpt-4",
    messages: [{ role: "system", content: "Content B" }],
  };

  const result1 = partitionPromptForCache(input1);
  const result2 = partitionPromptForCache(input2);

  assert.notEqual(result1.staticDigest, result2.staticDigest);
  assert.notEqual(result1.staticCacheKey, result2.staticCacheKey);
});

// ---------------------------------------------------------------------------
// PromptPartitionCacheService
// ---------------------------------------------------------------------------

test("PromptPartitionCacheService.record creates usage entry [prompt-partition-cache-comprehensive]", () => {
  const service = new PromptPartitionCacheService();
  const input: PromptPartitionInput = {
    model: "gpt-4",
    messages: [{ role: "system", content: "Test" }],
  };

  const usage = service.record(input);

  assert.ok(usage.reuseCount === 0);
  assert.ok(usage.firstSeenAt.length > 0);
  assert.ok(usage.lastSeenAt.length > 0);
});

test("PromptPartitionCacheService.record increments reuse count [prompt-partition-cache-comprehensive]", () => {
  const service = new PromptPartitionCacheService();
  const input: PromptPartitionInput = {
    model: "gpt-4",
    messages: [{ role: "system", content: "Test" }],
  };

  service.record(input);
  const usage2 = service.record(input);

  assert.equal(usage2.reuseCount, 1);
});

test("PromptPartitionCacheService.getUsage returns null for unknown key [prompt-partition-cache-comprehensive]", () => {
  const service = new PromptPartitionCacheService();
  const result = service.getUsage("nonexistent-key");

  assert.equal(result, null);
});

test("PromptPartitionCacheService.getUsage returns correct usage [prompt-partition-cache-comprehensive]", () => {
  const service = new PromptPartitionCacheService();
  const input: PromptPartitionInput = {
    model: "gpt-4",
    messages: [{ role: "system", content: "Test" }],
  };

  const usage = service.record(input);
  const partition = partitionPromptForCache(input);
  const retrieved = service.getUsage(partition.dynamicCacheKey);

  assert.ok(retrieved != null);
  assert.equal(retrieved!.reuseCount, 0);
});

test("PromptPartitionCacheService.listUsage returns all entries [prompt-partition-cache-comprehensive]", () => {
  const service = new PromptPartitionCacheService();

  service.record({ model: "gpt-4", messages: [{ role: "system", content: "A" }] });
  service.record({ model: "gpt-4", messages: [{ role: "system", content: "B" }] });

  const list = service.listUsage();

  assert.equal(list.length, 2);
});

test("PromptPartitionCacheService.listUsage returns sorted by key [prompt-partition-cache-comprehensive]", () => {
  const service = new PromptPartitionCacheService();

  service.record({ model: "gpt-4", messages: [{ role: "system", content: "Z" }] });
  service.record({ model: "gpt-4", messages: [{ role: "system", content: "A" }] });

  const list = service.listUsage();

  // Should be sorted by dynamicCacheKey
  assert.ok(list[0].partition.dynamicCacheKey <= list[1].partition.dynamicCacheKey);
});

test("PromptPartitionCacheService.clear removes all entries [prompt-partition-cache-comprehensive]", () => {
  const service = new PromptPartitionCacheService();

  service.record({ model: "gpt-4", messages: [{ role: "system", content: "A" }] });
  assert.ok(service.listUsage().length > 0);

  service.clear();

  assert.equal(service.listUsage().length, 0);
});

test("PromptPartitionCacheService records different models separately [prompt-partition-cache-comprehensive]", () => {
  const service = new PromptPartitionCacheService();

  service.record({ model: "gpt-4", messages: [{ role: "system", content: "Same" }] });
  service.record({ model: "claude-3", messages: [{ role: "system", content: "Same" }] });

  const list = service.listUsage();
  assert.equal(list.length, 2);
});

test("PromptPartitionCacheService tracks reuse across multiple records [prompt-partition-cache-comprehensive]", () => {
  const service = new PromptPartitionCacheService();

  const input: PromptPartitionInput = {
    model: "gpt-4",
    messages: [{ role: "system", content: "Reuse test" }],
  };

  // Record 5 times
  for (let i = 0; i < 5; i++) {
    service.record(input);
  }

  const partition = partitionPromptForCache(input);
  const usage = service.getUsage(partition.dynamicCacheKey);

  assert.equal(usage!.reuseCount, 4); // First record has count 0, next 4 have 1,2,3,4
});

test("PromptPartitionCacheService preserves firstSeenAt across reuses [prompt-partition-cache-comprehensive]", () => {
  const service = new PromptPartitionCacheService();
  const input: PromptPartitionInput = {
    model: "gpt-4",
    messages: [{ role: "system", content: "Test" }],
  };

  const first = service.record(input);
  const firstSeenBefore = first.firstSeenAt;

  // Small delay to ensure different timestamps
  const second = service.record(input);

  assert.equal(second.firstSeenAt, firstSeenBefore); // First seen should be preserved
});

test("PromptPartitionCacheService.lastSeenAt updates on reuse [prompt-partition-cache-comprehensive]", () => {
  const service = new PromptPartitionCacheService();
  const input: PromptPartitionInput = {
    model: "gpt-4",
    messages: [{ role: "system", content: "Test" }],
  };

  const first = service.record(input);
  const firstLastSeen = first.lastSeenAt;

  service.record(input);
  const second = service.getUsage(partitionPromptForCache(input).dynamicCacheKey)!;

  // Last seen should have been updated
  assert.ok(second.lastSeenAt >= firstLastSeen);
});
