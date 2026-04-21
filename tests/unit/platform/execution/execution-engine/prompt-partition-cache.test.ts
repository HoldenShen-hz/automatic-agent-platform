import assert from "node:assert/strict";
import test from "node:test";

import {
  partitionPromptForCache,
  PromptPartitionCacheService,
  type PromptPartitionInput,
  type PromptPartitionResult,
  type PromptPartitionMessageLike,
} from "../../../../../src/platform/execution/execution-engine/prompt-partition-cache.js";

test("partitionPromptForCache exports partitionPromptForCache function", () => {
  assert.equal(typeof partitionPromptForCache, "function");
});

test("partitionPromptForCache partitions system and user messages", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "You are a helpful assistant" },
      { role: "user", content: "Hello" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.staticMessageCount, 1);
  assert.equal(result.dynamicMessageCount, 1);
  assert.equal(result.staticDigest.length > 0, true);
  assert.equal(result.dynamicDigest.length > 0, true);
});

test("partitionPromptForCache generates stable cache keys", () => {
  const input1: PromptPartitionInput = {
    model: "claude-3-5-sonnet",
    profileId: "default",
    messages: [
      { role: "system", content: "You are helpful" },
      { role: "user", content: "Test" },
    ],
  };

  const input2: PromptPartitionInput = {
    model: "claude-3-5-sonnet",
    profileId: "default",
    messages: [
      { role: "system", content: "You are helpful" },
      { role: "user", content: "Test" },
    ],
  };

  const result1 = partitionPromptForCache(input1);
  const result2 = partitionPromptForCache(input2);

  assert.equal(result1.staticCacheKey, result2.staticCacheKey);
  assert.equal(result1.dynamicCacheKey, result2.dynamicCacheKey);
});

test("partitionPromptForCache different content produces different keys", () => {
  const input1: PromptPartitionInput = {
    messages: [
      { role: "system", content: "You are helpful" },
      { role: "user", content: "First message" },
    ],
  };

  const input2: PromptPartitionInput = {
    messages: [
      { role: "system", content: "You are helpful" },
      { role: "user", content: "Different message" },
    ],
  };

  const result1 = partitionPromptForCache(input1);
  const result2 = partitionPromptForCache(input2);

  assert.notEqual(result1.dynamicCacheKey, result2.dynamicCacheKey);
});

test("partitionPromptForCache calculates byte sizes", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "You are a helpful assistant" },
      { role: "user", content: "Hello world" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.ok(result.stablePrefixBytes > 0);
  assert.ok(result.fixedPrefixBytes > 0);
  assert.ok(result.dynamicMessageCount >= 0);
});

test("partitionPromptForCache handles null/undefined roles", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: null as unknown as string, content: "No role" },
      { role: undefined as unknown as string, content: "Undefined role" },
      { role: "user", content: "User message" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.staticMessageCount, 0);
  assert.equal(result.dynamicMessageCount, 3);
});

test("partitionPromptForCache handles kvCache options", () => {
  const input: PromptPartitionInput = {
    model: "claude-3-5-sonnet",
    kvCache: {
      enabled: true,
      fixedPrefixMessageCount: 1,
      cacheKeyStrategy: "hash_prefix",
    },
    messages: [
      { role: "system", content: "System 1" },
      { role: "system", content: "System 2" },
      { role: "user", content: "User" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.kvCacheEnabled, true);
  assert.equal(result.cacheKeyStrategy, "hash_prefix");
  assert.equal(result.fixedPrefixMessageCount, 1);
  assert.equal(result.domainBlockMessageCount, 1); // Second system message
});

test("partitionPromptForCache exact_match strategy uses payload", () => {
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

test("partitionPromptForCache handles model and profileId", () => {
  const input: PromptPartitionInput = {
    model: "claude-3-5-sonnet-20250514",
    profileId: "enterprise_user",
    domainId: "coding",
    messages: [
      { role: "system", content: "You are a coding assistant" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.model, "claude-3-5-sonnet-20250514");
  assert.equal(result.profileId, "enterprise_user");
  assert.equal(result.domainId, "coding");
});

test("PromptPartitionCacheService records partition and tracks usage", () => {
  const service = new PromptPartitionCacheService();

  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "System prompt" },
      { role: "user", content: "Test" },
    ],
  };

  const usage1 = service.record(input);
  assert.equal(usage1.reuseCount, 0);

  const usage2 = service.record(input);
  assert.equal(usage2.reuseCount, 1);

  const usage3 = service.record(input);
  assert.equal(usage3.reuseCount, 2);
});

test("PromptPartitionCacheService getUsage returns usage stats", () => {
  const service = new PromptPartitionCacheService();

  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "System" },
      { role: "user", content: "Test" },
    ],
  };

  const recorded = service.record(input);
  const usage = service.getUsage(recorded.partition.dynamicCacheKey);

  assert.ok(usage);
  assert.equal(usage!.reuseCount, 0);
  assert.ok(usage!.firstSeenAt);
  assert.ok(usage!.lastSeenAt);
});

test("PromptPartitionCacheService getUsage returns null for unknown key", () => {
  const service = new PromptPartitionCacheService();

  const usage = service.getUsage("nonexistent_key");

  assert.equal(usage, null);
});

test("PromptPartitionCacheService listUsage returns all tracked usage", () => {
  const service = new PromptPartitionCacheService();

  service.record({
    messages: [{ role: "system", content: "System1" }, { role: "user", content: "Test1" }],
  });

  service.record({
    messages: [{ role: "system", content: "System2" }, { role: "user", content: "Test2" }],
  });

  const allUsage = service.listUsage();

  assert.equal(allUsage.length, 2);
});

test("PromptPartitionCacheService clear removes all tracked usage", () => {
  const service = new PromptPartitionCacheService();

  service.record({
    messages: [{ role: "system", content: "System" }, { role: "user", content: "Test" }],
  });

  assert.equal(service.listUsage().length, 1);

  service.clear();

  assert.equal(service.listUsage().length, 0);
});

test("partitionPromptForCache handles empty messages", () => {
  const input: PromptPartitionInput = {
    messages: [],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.staticMessageCount, 0);
  assert.equal(result.dynamicMessageCount, 0);
  assert.equal(result.staticDigest.length > 0, true);
  assert.equal(result.dynamicDigest.length > 0, true);
});

test("partitionPromptForCache handles only system messages", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "System 1" },
      { role: "system", content: "System 2" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.staticMessageCount, 2);
  assert.equal(result.dynamicMessageCount, 0);
});

test("partitionPromptForCache handles only dynamic messages", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "user", content: "User 1" },
      { role: "assistant", content: "Assistant 1" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.staticMessageCount, 0);
  assert.equal(result.dynamicMessageCount, 2);
});

test("partitionPromptForCache normalizes whitespace in content", () => {
  const input1: PromptPartitionInput = {
    messages: [
      { role: "system", content: "Hello    world" },
      { role: "user", content: "Test" },
    ],
  };

  const input2: PromptPartitionInput = {
    messages: [
      { role: "system", content: "Hello world" },
      { role: "user", content: "Test" },
    ],
  };

  const result1 = partitionPromptForCache(input1);
  const result2 = partitionPromptForCache(input2);

  // Note: The content itself is preserved, but cache key is based on canonical form
  assert.equal(result1.fixedPrefixDigest, result2.fixedPrefixDigest);
});

test("partitionPromptForCache generates domain block cache key when domainId provided", () => {
  const input: PromptPartitionInput = {
    model: "claude-3-5-sonnet",
    profileId: "default",
    domainId: "coding",
    kvCache: {
      enabled: true,
      fixedPrefixMessageCount: 1,
    },
    messages: [
      { role: "system", content: "Base system" },
      { role: "system", content: "Domain-specific" },
      { role: "user", content: "Test" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.ok(result.domainBlockCacheKey);
  assert.equal(result.domainBlockMessageCount, 1);
});

test("partitionPromptForCache domainBlockCacheKey is null when no domain block", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "Only one system message" },
      { role: "user", content: "Test" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.domainBlockCacheKey, null);
  assert.equal(result.domainBlockMessageCount, 0);
});

test("PromptPartitionCacheService tracks firstSeenAt and lastSeenAt", async () => {
  const service = new PromptPartitionCacheService();

  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "System" },
      { role: "user", content: "Test" },
    ],
  };

  const usage1 = service.record(input);
  const firstSeen = usage1.firstSeenAt;

  // Record again after a small delay (simulated)
  const usage2 = service.record(input);
  const lastSeen = usage2.lastSeenAt;

  assert.ok(usage2.firstSeenAt <= usage2.lastSeenAt);
});

test("PromptPartitionCacheService handles parts in messages", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "System", parts: ["part1", "part2"] },
      { role: "user", content: "Test", parts: null },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.staticMessageCount, 1);
  assert.equal(result.dynamicMessageCount, 1);
});

test("partitionPromptForCache kvCache disabled uses all static as fixed", () => {
  const input: PromptPartitionInput = {
    kvCache: {
      enabled: false,
    },
    messages: [
      { role: "system", content: "System 1" },
      { role: "system", content: "System 2" },
      { role: "user", content: "User" },
    ],
  };

  const result = partitionPromptForCache(input);

  // When kvCache disabled, all static messages become fixed prefix
  assert.equal(result.fixedPrefixMessageCount, 2);
  assert.equal(result.domainBlockMessageCount, 0);
});

test("PromptPartitionCacheService different dynamic parts get different keys", () => {
  const service = new PromptPartitionCacheService();

  const usage1 = service.record({
    messages: [
      { role: "system", content: "System" },
      { role: "user", content: "Message A" },
    ],
  });

  const usage2 = service.record({
    messages: [
      { role: "system", content: "System" },
      { role: "user", content: "Message B" },
    ],
  });

  assert.notEqual(usage1.partition.dynamicCacheKey, usage2.partition.dynamicCacheKey);
});
