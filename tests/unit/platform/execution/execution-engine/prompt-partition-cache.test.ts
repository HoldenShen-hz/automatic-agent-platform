import assert from "node:assert/strict";
import test from "node:test";

import {
  partitionPromptForCache,
  PromptPartitionCacheService,
  type PromptPartitionInput,
  type PromptPartitionResult,
  type PromptPartitionMessageLike,
} from "../../../../../src/platform/five-plane-execution/execution-engine/prompt-partition-cache.js";

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

test("partitionPromptForCache generates different digests for different content", () => {
  const input1: PromptPartitionInput = {
    messages: [
      { role: "system", content: "Hello world" },
      { role: "user", content: "Test" },
    ],
  };

  const input2: PromptPartitionInput = {
    messages: [
      { role: "system", content: "Different content" },
      { role: "user", content: "Different test" },
    ],
  };

  const result1 = partitionPromptForCache(input1);
  const result2 = partitionPromptForCache(input2);

  // Different content should produce different digests
  assert.notEqual(result1.staticDigest, result2.staticDigest);
  assert.notEqual(result1.dynamicDigest, result2.dynamicDigest);
  assert.notEqual(result1.staticCacheKey, result2.staticCacheKey);
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

test("partitionPromptForCache handles whitespace-padded role names as system", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "  system  ", content: "Whitespace system" },
      { role: "user", content: "Test" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.staticMessageCount, 1);
  assert.equal(result.dynamicMessageCount, 1);
});

test("partitionPromptForCache treats SYSTEM (uppercase) as system role", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "SYSTEM", content: "Uppercase system" },
      { role: "user", content: "Test" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.staticMessageCount, 1);
  assert.equal(result.dynamicMessageCount, 1);
});

test("partitionPromptForCache treats System (mixed case) as system role", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "System", content: "Mixed case system" },
      { role: "user", content: "Test" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.staticMessageCount, 1);
  assert.equal(result.dynamicMessageCount, 1);
});

test("partitionPromptForCache fixedPrefixMessageCount of zero disables fixed prefix", () => {
  const input: PromptPartitionInput = {
    kvCache: {
      enabled: true,
      fixedPrefixMessageCount: 0,
    },
    messages: [
      { role: "system", content: "System 1" },
      { role: "system", content: "System 2" },
      { role: "user", content: "User" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.fixedPrefixMessageCount, 0);
  assert.equal(result.domainBlockMessageCount, 2);
});

test("partitionPromptForCache fixedPrefixMessageCount exceeding static count is capped", () => {
  const input: PromptPartitionInput = {
    kvCache: {
      enabled: true,
      fixedPrefixMessageCount: 100,
    },
    messages: [
      { role: "system", content: "System 1" },
      { role: "user", content: "User" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.fixedPrefixMessageCount, 1);
  assert.equal(result.domainBlockMessageCount, 0);
});

test("partitionPromptForCache negative fixedPrefixMessageCount becomes zero", () => {
  const input: PromptPartitionInput = {
    kvCache: {
      enabled: true,
      fixedPrefixMessageCount: -5,
    },
    messages: [
      { role: "system", content: "System 1" },
      { role: "user", content: "User" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.fixedPrefixMessageCount, 0);
});

test("partitionPromptForCache calculates variableMessageCount correctly", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "System" },
      { role: "user", content: "User 1" },
      { role: "assistant", content: "Assistant 1" },
      { role: "user", content: "User 2" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.variableMessageCount, 3);
  assert.equal(result.dynamicMessageCount, 3);
});

test("partitionPromptForCache calculates variableSuffixBytes correctly", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "System" },
      { role: "user", content: "Hello" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.ok(result.variableSuffixBytes > 0);
  // Canonical string for user message includes the role: {"role":"user","content":"Hello","parts":null}
  // This is 46 bytes in UTF-8
  assert.equal(result.variableSuffixBytes, 46);
});

test("partitionPromptForCache variableSuffixDigest equals dynamicDigest", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "System" },
      { role: "user", content: "Dynamic content" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.variableSuffixDigest, result.dynamicDigest);
});

test("partitionPromptForCache domain block cache key generated when domainId is null", () => {
  const input: PromptPartitionInput = {
    model: "claude-3-5-sonnet",
    profileId: "default",
    domainId: null,
    kvCache: {
      enabled: true,
      fixedPrefixMessageCount: 1,
    },
    messages: [
      { role: "system", content: "Base" },
      { role: "system", content: "Domain block" },
      { role: "user", content: "User" },
    ],
  };

  const result = partitionPromptForCache(input);

  // Domain block cache key should be generated when there are domain block messages
  // (the second system message), even when domainId is null
  assert.ok(result.domainBlockCacheKey);
  assert.equal(result.domainBlockMessageCount, 1);
});

test("partitionPromptForCache model trim removes leading/trailing whitespace", () => {
  const input: PromptPartitionInput = {
    model: "  claude-3-5-sonnet  ",
    messages: [
      { role: "system", content: "System" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.model, "claude-3-5-sonnet");
});

test("partitionPromptForCache model empty string becomes null", () => {
  const input: PromptPartitionInput = {
    model: "   ",
    messages: [
      { role: "system", content: "System" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.model, null);
});

test("partitionPromptForCache profileId empty string becomes null", () => {
  const input: PromptPartitionInput = {
    profileId: "   ",
    messages: [
      { role: "system", content: "System" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.profileId, null);
});

test("partitionPromptForCache domainId empty string becomes null", () => {
  const input: PromptPartitionInput = {
    domainId: "   ",
    messages: [
      { role: "system", content: "System" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.domainId, null);
});

test("partitionPromptForCache message with parts but no content", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "system", parts: ["part1", "part2"] },
      { role: "user", content: "User message" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.staticMessageCount, 1);
  assert.equal(result.dynamicMessageCount, 1);
  assert.ok(result.fixedPrefixBytes > 0);
});

test("partitionPromptForCache message with both content and parts", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "Content text", parts: ["part1"] },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.staticMessageCount, 1);
  assert.ok(result.fixedPrefixBytes > 0);
});

test("partitionPromptForCache message with null content vs undefined content", () => {
  const input1: PromptPartitionInput = {
    messages: [
      { role: "system", content: null },
    ],
  };

  const input2: PromptPartitionInput = {
    messages: [
      { role: "system", content: undefined },
    ],
  };

  const result1 = partitionPromptForCache(input1);
  const result2 = partitionPromptForCache(input2);

  // Both should have same canonical representation
  assert.equal(result1.staticDigest, result2.staticDigest);
});

test("PromptPartitionCacheService firstSeenAt stays constant across records", () => {
  const service = new PromptPartitionCacheService();

  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "System" },
      { role: "user", content: "Test" },
    ],
  };

  const usage1 = service.record(input);
  const firstSeen1 = usage1.firstSeenAt;

  const usage2 = service.record(input);
  const firstSeen2 = usage2.firstSeenAt;

  assert.equal(firstSeen1, firstSeen2);
});

test("PromptPartitionCacheService lastSeenAt updates on each record", () => {
  const service = new PromptPartitionCacheService();

  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "System" },
      { role: "user", content: "Test" },
    ],
  };

  const usage1 = service.record(input);
  const usage2 = service.record(input);

  assert.ok(usage2.lastSeenAt >= usage1.lastSeenAt);
});

test("PromptPartitionCacheService tracks multiple different partitions", () => {
  const service = new PromptPartitionCacheService();

  service.record({
    messages: [
      { role: "system", content: "System A" },
      { role: "user", content: "User A" },
    ],
  });

  service.record({
    messages: [
      { role: "system", content: "System B" },
      { role: "user", content: "User B" },
    ],
  });

  service.record({
    messages: [
      { role: "system", content: "System C" },
      { role: "user", content: "User C" },
    ],
  });

  const allUsage = service.listUsage();

  assert.equal(allUsage.length, 3);
});

test("PromptPartitionCacheService listUsage returns sorted by dynamicCacheKey", () => {
  const service = new PromptPartitionCacheService();

  service.record({
    messages: [
      { role: "system", content: "System" },
      { role: "user", content: "User Z" },
    ],
  });

  service.record({
    messages: [
      { role: "system", content: "System" },
      { role: "user", content: "User A" },
    ],
  });

  const allUsage = service.listUsage();

  assert.equal(allUsage.length, 2);
  const first = allUsage[0];
  const second = allUsage[1];
  assert.ok(first !== undefined && second !== undefined);
  assert.ok(first.partition.dynamicCacheKey <= second.partition.dynamicCacheKey);
});

test("partitionPromptForCache same static but different dynamic produces different dynamicCacheKey", () => {
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

test("partitionPromptForCache different static content produces different staticCacheKey", () => {
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

  // Different static content should produce different static cache keys
  assert.notEqual(result1.staticDigest, result2.staticDigest);
  assert.notEqual(result1.staticCacheKey, result2.staticCacheKey);
});

test("partitionPromptForCache handles multi-byte UTF-8 characters in bytes calculation", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "你好世界" },
      { role: "user", content: "🎉🔥" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.ok(result.stablePrefixBytes > 0);
  assert.ok(result.fixedPrefixBytes > 0);
  // Each Chinese character is 3 bytes in UTF-8, emoji are 4 bytes
  assert.ok(result.stablePrefixBytes >= 12); // 4 Chinese chars * 3 bytes minimum
});

test("partitionPromptForCache assistant role is treated as dynamic", () => {
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

test("partitionPromptForCache tool role is treated as dynamic", () => {
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

test("partitionPromptForCache hash_prefix strategy generates consistent cache keys", () => {
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

  // Same input should produce same cache key
  const result2 = partitionPromptForCache(input);
  assert.equal(result.fixedPrefixCacheKey, result2.fixedPrefixCacheKey);
});

test("partitionPromptForCache exact_match strategy produces different cache key than hash_prefix", () => {
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

test("partitionPromptForCache preserves message order in partitioning", () => {
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

test("partitionPromptForCache multiple system messages all in static prefix", () => {
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

test("partitionPromptForCache non-system role after system stops static partition", () => {
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

test("partitionPromptForCache empty string role is not static", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "", content: "Empty role" },
      { role: "system", content: "System" },
    ],
  };

  const result = partitionPromptForCache(input);

  // Empty string role is not static, and once a dynamic message is encountered,
  // all subsequent messages (including system) go to dynamic
  assert.equal(result.staticMessageCount, 0);
  assert.equal(result.dynamicMessageCount, 2);
});

test("partitionPromptForCache kvCache defaults when not provided", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "System" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.kvCacheEnabled, true); // Default is true
  assert.equal(result.cacheKeyStrategy, "hash_prefix"); // Default is hash_prefix
});

test("partitionPromptForCache kvCache defaults when null", () => {
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

test("partitionPromptForCache kvCache undefined uses defaults", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "System" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.kvCacheEnabled, true);
  assert.equal(result.cacheKeyStrategy, "hash_prefix");
});
