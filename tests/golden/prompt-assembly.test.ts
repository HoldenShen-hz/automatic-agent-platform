/**
 * Golden Test: Prompt Assembly Output
 *
 * Verifies prompt partition and assembly produces expected structure
 * and cache key generation is consistent.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  partitionPromptForCache,
  PromptPartitionCacheService,
  type PromptPartitionInput,
} from "../../src/platform/execution/execution-engine/prompt-partition-cache.js";

const PRIMARY_TEST_MODEL_ID = "test-model-primary";
const SECONDARY_TEST_MODEL_ID = "test-model-secondary";
const TERTIARY_TEST_MODEL_ID = "test-model-tertiary";

test("golden: partitionPromptForCache produces correct structure", () => {
  const input: PromptPartitionInput = {
    model: PRIMARY_TEST_MODEL_ID,
    profileId: "default",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Hello, how are you?" },
      { role: "assistant", content: "I'm doing well, thank you!" },
    ],
  };

  const result = partitionPromptForCache(input);

  // Verify structure
  assert.equal(result.model, PRIMARY_TEST_MODEL_ID);
  assert.equal(result.profileId, "default");
  assert.equal(result.staticMessageCount, 1, "Should have 1 static (system) message");
  assert.equal(result.dynamicMessageCount, 2, "Should have 2 dynamic (user/assistant) messages");
  assert.ok(result.stablePrefixBytes > 0, "Should calculate stable prefix bytes");
  assert.ok(result.staticDigest.length === 64, "SHA256 hex digest should be 64 chars");
  assert.ok(result.dynamicDigest.length === 64, "SHA256 hex digest should be 64 chars");
  assert.ok(result.staticCacheKey.length === 64, "Cache key should be SHA256 hex");
  assert.ok(result.dynamicCacheKey.length === 64, "Cache key should be SHA256 hex");
  assert.notEqual(result.staticCacheKey, result.dynamicCacheKey, "Static and dynamic keys should differ");
});

test("golden: partitionPromptForCache is deterministic", () => {
  const input: PromptPartitionInput = {
    model: PRIMARY_TEST_MODEL_ID,
    profileId: "test-profile",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Test message" },
    ],
  };

  const result1 = partitionPromptForCache(input);
  const result2 = partitionPromptForCache(input);

  assert.equal(result1.staticDigest, result2.staticDigest, "Static digest should be deterministic");
  assert.equal(result1.dynamicDigest, result2.dynamicDigest, "Dynamic digest should be deterministic");
  assert.equal(result1.staticCacheKey, result2.staticCacheKey, "Static cache key should be deterministic");
  assert.equal(result1.dynamicCacheKey, result2.dynamicCacheKey, "Dynamic cache key should be deterministic");
});

test("golden: partitionPromptForCache separates system from user messages", () => {
  const input: PromptPartitionInput = {
    model: SECONDARY_TEST_MODEL_ID,
    profileId: "division-executor",
    messages: [
      { role: "system", content: "You are a coding assistant." },
      { role: "system", content: "Always follow security guidelines." },
      { role: "user", content: "Write a hello world program" },
      { role: "assistant", content: "Here is a simple hello world in Python:" },
      { role: "user", content: "Make it print to a file instead" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.staticMessageCount, 2, "Both system messages should be static");
  assert.equal(result.dynamicMessageCount, 3, "User/assistant messages should be dynamic");
});

test("golden: partitionPromptForCache handles empty messages", () => {
  const input: PromptPartitionInput = {
    model: null,
    profileId: null,
    messages: [],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.model, null);
  assert.equal(result.profileId, null);
  assert.equal(result.staticMessageCount, 0);
  assert.equal(result.dynamicMessageCount, 0);
  assert.ok(result.staticDigest.length === 64);
  assert.ok(result.dynamicDigest.length === 64);
});

test("golden: partitionPromptForCache handles null/undefined fields in messages", () => {
  const input: PromptPartitionInput = {
    model: TERTIARY_TEST_MODEL_ID,
    profileId: "test",
    messages: [
      { role: null, content: undefined },
      { role: "system", content: "Valid system" },
      { role: "user", parts: ["array", "parts"] },
    ],
  };

  const result = partitionPromptForCache(input);

  // Note: Once a non-system message appears at the start,
  // all subsequent messages (including system) go to dynamic
  assert.equal(result.staticMessageCount, 0, "First non-system breaks static prefix");
  assert.equal(result.dynamicMessageCount, 3, "All messages become dynamic after prefix breaks");
  assert.ok(result.staticCacheKey.length === 64);
  assert.ok(result.dynamicCacheKey.length === 64);
});

test("golden: PromptPartitionCacheService records and retrieves usage", () => {
  const service = new PromptPartitionCacheService();

  const input: PromptPartitionInput = {
    model: "test-model",
    profileId: "test-profile",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "First message" },
    ],
  };

  // First call - creates new record
  const usage1 = service.record(input);
  assert.equal(usage1.reuseCount, 0, "First record should have reuseCount 0");
  assert.ok(usage1.firstSeenAt.length > 0);
  assert.ok(usage1.lastSeenAt.length > 0);

  // Second call with same input - increments reuse count
  const usage2 = service.record(input);
  assert.equal(usage2.reuseCount, 1, "Second record should have reuseCount 1");
  assert.equal(usage2.firstSeenAt, usage1.firstSeenAt, "firstSeenAt should not change");
  assert.ok(usage2.lastSeenAt >= usage1.lastSeenAt, "lastSeenAt should be updated");

  service.clear();
});

test("golden: PromptPartitionCacheService lists all tracked usage", () => {
  const service = new PromptPartitionCacheService();

  const input1: PromptPartitionInput = {
    model: "model-a",
    profileId: "profile-1",
    messages: [{ role: "system", content: "System A" }, { role: "user", content: "User 1" }],
  };

  const input2: PromptPartitionInput = {
    model: "model-b",
    profileId: "profile-2",
    messages: [{ role: "system", content: "System B" }, { role: "user", content: "User 2" }],
  };

  service.record(input1);
  service.record(input2);

  const allUsage = service.listUsage();
  assert.equal(allUsage.length, 2, "Should track 2 different prompt partitions");

  service.clear();
});

test("golden: PromptPartitionCacheService getUsage returns correct record", () => {
  const service = new PromptPartitionCacheService();

  const input: PromptPartitionInput = {
    model: "test-model",
    profileId: "test-profile",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Hello" },
    ],
  };

  service.record(input);
  const partition = partitionPromptForCache(input);

  const retrieved = service.getUsage(partition.dynamicCacheKey);
  assert.ok(retrieved, "Should retrieve usage record");
  assert.equal(retrieved!.reuseCount, 0);
  assert.equal(retrieved!.partition.model, "test-model");

  service.clear();
});

test("golden: different model/profile combinations produce different cache keys", () => {
  const baseMessages = [{ role: "system", content: "Same system prompt" }, { role: "user", content: "Same user" }];

  const partition1 = partitionPromptForCache({ model: "model-a", profileId: "profile-1", messages: baseMessages });
  const partition2 = partitionPromptForCache({ model: "model-b", profileId: "profile-1", messages: baseMessages });
  const partition3 = partitionPromptForCache({ model: "model-a", profileId: "profile-2", messages: baseMessages });

  assert.notEqual(partition1.staticCacheKey, partition2.staticCacheKey, "Different models should have different keys");
  assert.notEqual(partition1.staticCacheKey, partition3.staticCacheKey, "Different profiles should have different keys");
  assert.notEqual(partition2.staticCacheKey, partition3.staticCacheKey, "Different model+profile combos should differ");
});

test("golden: same content different order produces different digest", () => {
  const messages1 = [
    { role: "system", content: "System first" },
    { role: "user", content: "User second" },
  ];

  const messages2 = [
    { role: "user", content: "User second" },
    { role: "system", content: "System first" },
  ];

  const partition1 = partitionPromptForCache({ model: "test", profileId: "test", messages: messages1 });
  const partition2 = partitionPromptForCache({ model: "test", profileId: "test", messages: messages2 });

  assert.notEqual(partition1.dynamicDigest, partition2.dynamicDigest, "Different message order should produce different digest");
});
