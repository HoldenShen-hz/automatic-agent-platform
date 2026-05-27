import assert from "node:assert/strict";
import test from "node:test";

import { partitionPromptForCache, PromptPartitionCacheService } from "../../../src/platform/five-plane-execution/execution-engine/prompt-partition-cache.js";

test("partitionPromptForCache keeps leading system messages in the static prefix [prompt-partition-cache]", () => {
  const result = partitionPromptForCache({
    model: "minimax-2.7",
    profileId: "default",
    domainId: "coding",
    kvCache: {
      enabled: true,
      fixedPrefixMessageCount: 1,
    },
    messages: [
      { role: "system", content: "global system" },
      { role: "system", content: "division prompt" },
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
    ],
  });

  assert.equal(result.staticMessageCount, 2);
  assert.equal(result.dynamicMessageCount, 2);
  assert.equal(result.fixedPrefixMessageCount, 1);
  assert.equal(result.domainBlockMessageCount, 1);
  assert.ok(result.stablePrefixBytes > 0);
  assert.notEqual(result.staticCacheKey, result.dynamicCacheKey);
  assert.notEqual(result.fixedPrefixCacheKey, result.domainBlockCacheKey);
});

test("PromptPartitionCacheService tracks reuse count for identical dynamic partitions [prompt-partition-cache]", () => {
  const service = new PromptPartitionCacheService();
  const first = service.record({
    model: "reasoning-medium",
    messages: [{ role: "system", content: "sys" }, { role: "user", content: "hi" }],
  });
  const second = service.record({
    model: "reasoning-medium",
    messages: [{ role: "system", content: "sys" }, { role: "user", content: "hi" }],
  });

  assert.equal(first.partition.dynamicCacheKey, second.partition.dynamicCacheKey);
  assert.equal(second.reuseCount, 1);
});

test("partitionPromptForCache handles empty messages array [prompt-partition-cache]", () => {
  const result = partitionPromptForCache({
    model: "minimax-2.7",
    profileId: "default",
    domainId: "coding",
    kvCache: {
      enabled: true,
      fixedPrefixMessageCount: 0,
    },
    messages: [],
  });

  assert.equal(result.staticMessageCount, 0);
  assert.equal(result.dynamicMessageCount, 0);
  assert.equal(result.fixedPrefixMessageCount, 0);
  assert.equal(result.domainBlockMessageCount, 0);
});

test("partitionPromptForCache handles different models produce different cache keys [prompt-partition-cache]", () => {
  const baseMessages = [{ role: "system", content: "same" }, { role: "user", content: "hello" }];

  const result1 = partitionPromptForCache({
    model: "minimax-2.7",
    profileId: "default",
    domainId: "coding",
    kvCache: { enabled: true, fixedPrefixMessageCount: 1 },
    messages: baseMessages,
  });

  const result2 = partitionPromptForCache({
    model: "claude-3.5",
    profileId: "default",
    domainId: "coding",
    kvCache: { enabled: true, fixedPrefixMessageCount: 1 },
    messages: baseMessages,
  });

  assert.notEqual(result1.dynamicCacheKey, result2.dynamicCacheKey);
  assert.notEqual(result1.staticCacheKey, result2.staticCacheKey);
});

test("PromptPartitionCacheService records different messages as separate partitions [prompt-partition-cache]", () => {
  const service = new PromptPartitionCacheService();
  const first = service.record({
    model: "minimax-2.7",
    messages: [{ role: "user", content: "first message" }],
  });
  const second = service.record({
    model: "minimax-2.7",
    messages: [{ role: "user", content: "second message" }],
  });

  assert.notEqual(first.partition.dynamicCacheKey, second.partition.dynamicCacheKey);
  assert.equal(second.reuseCount, 0);
});
