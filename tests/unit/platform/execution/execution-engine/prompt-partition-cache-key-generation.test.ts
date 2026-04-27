/**
 * @fileoverview Unit tests for prompt partition cache key generation.
 *
 * Tests cache key format, collision resistance, partition boundaries,
 * and byte calculation accuracy.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";

import {
  partitionPromptForCache,
  PromptPartitionCacheService,
  type PromptPartitionInput,
} from "../../../../../src/platform/execution/execution-engine/prompt-partition-cache.js";

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// ---------------------------------------------------------------------------
// Cache Key Format Verification
// ---------------------------------------------------------------------------

test("staticCacheKey is a valid SHA256 hex string (64 chars)", () => {
  const input: PromptPartitionInput = {
    model: "claude-3-5-sonnet",
    messages: [{ role: "system", content: "Test" }],
  };

  const result = partitionPromptForCache(input);

  // SHA256 produces 64 character hex string
  assert.equal(result.staticCacheKey.length, 64);
  assert.match(result.staticCacheKey, /^[a-f0-9]{64}$/);
});

test("dynamicCacheKey is a valid SHA256 hex string (64 chars)", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "System" },
      { role: "user", content: "Test" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.dynamicCacheKey.length, 64);
  assert.match(result.dynamicCacheKey, /^[a-f0-9]{64}$/);
});

test("fixedPrefixCacheKey is a valid SHA256 hex string (64 chars)", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "Fixed prefix" },
      { role: "system", content: "Domain block" },
      { role: "user", content: "Dynamic" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.fixedPrefixCacheKey.length, 64);
  assert.match(result.fixedPrefixCacheKey, /^[a-f0-9]{64}$/);
});

test("domainBlockCacheKey is a valid SHA256 hex string when present", () => {
  const input: PromptPartitionInput = {
    domainId: "coding",
    messages: [
      { role: "system", content: "Base" },
      { role: "system", content: "Domain" },
      { role: "user", content: "Test" },
    ],
  };

  const result = partitionPromptForCache(input);

  if (result.domainBlockCacheKey) {
    assert.equal(result.domainBlockCacheKey.length, 64);
    assert.match(result.domainBlockCacheKey, /^[a-f0-9]{64}$/);
  }
});

test("digests are valid SHA256 hex strings (64 chars)", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "System message" },
      { role: "user", content: "User message" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.staticDigest.length, 64);
  assert.equal(result.dynamicDigest.length, 64);
  assert.equal(result.fixedPrefixDigest.length, 64);
  assert.equal(result.domainBlockDigest.length, 64);
  assert.equal(result.variableSuffixDigest.length, 64);
});

// ---------------------------------------------------------------------------
// Cache Key Collision Resistance
// ---------------------------------------------------------------------------

test("different models produce different staticCacheKey even with same messages", () => {
  const input1: PromptPartitionInput = {
    model: "claude-3-5-sonnet",
    messages: [{ role: "system", content: "Same system prompt" }],
  };

  const input2: PromptPartitionInput = {
    model: "gpt-4o",
    messages: [{ role: "system", content: "Same system prompt" }],
  };

  const result1 = partitionPromptForCache(input1);
  const result2 = partitionPromptForCache(input2);

  assert.notEqual(result1.staticCacheKey, result2.staticCacheKey);
});

test("different profileIds produce different staticCacheKey even with same messages", () => {
  const input1: PromptPartitionInput = {
    model: "claude-3-5-sonnet",
    profileId: "profile-a",
    messages: [{ role: "system", content: "Same" }],
  };

  const input2: PromptPartitionInput = {
    model: "claude-3-5-sonnet",
    profileId: "profile-b",
    messages: [{ role: "system", content: "Same" }],
  };

  const result1 = partitionPromptForCache(input1);
  const result2 = partitionPromptForCache(input2);

  assert.notEqual(result1.staticCacheKey, result2.staticCacheKey);
});

test("different fixedPrefixMessageCount produces different fixedPrefixCacheKey", () => {
  const input1: PromptPartitionInput = {
    kvCache: { enabled: true, fixedPrefixMessageCount: 1 },
    messages: [
      { role: "system", content: "First" },
      { role: "system", content: "Second" },
      { role: "user", content: "Dynamic" },
    ],
  };

  const input2: PromptPartitionInput = {
    kvCache: { enabled: true, fixedPrefixMessageCount: 2 },
    messages: [
      { role: "system", content: "First" },
      { role: "system", content: "Second" },
      { role: "user", content: "Dynamic" },
    ],
  };

  const result1 = partitionPromptForCache(input1);
  const result2 = partitionPromptForCache(input2);

  assert.notEqual(result1.fixedPrefixCacheKey, result2.fixedPrefixCacheKey);
});

test("same dynamic content with different static content produces different dynamicCacheKey", () => {
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

  assert.notEqual(result1.dynamicCacheKey, result2.dynamicCacheKey);
});

test("same static content with different dynamic content produces different dynamicCacheKey", () => {
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

  assert.notEqual(result1.dynamicCacheKey, result2.dynamicCacheKey);
});

// ---------------------------------------------------------------------------
// Cache Key Scope Isolation
// ---------------------------------------------------------------------------

test("staticCacheKey depends on model and profileId scope", () => {
  const input1: PromptPartitionInput = {
    model: "claude-3-5-sonnet",
    profileId: "default",
    messages: [{ role: "system", content: "System" }],
  };

  const input2: PromptPartitionInput = {
    model: "claude-3-5-sonnet",
    profileId: "default",
    messages: [{ role: "system", content: "System" }],
  };

  const result1 = partitionPromptForCache(input1);
  const result2 = partitionPromptForCache(input2);

  // Same input should produce same keys
  assert.equal(result1.staticCacheKey, result2.staticCacheKey);
  assert.equal(result1.dynamicCacheKey, result2.dynamicCacheKey);
});

test("dynamicCacheKey incorporates both static and dynamic digests", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "Static" },
      { role: "user", content: "Dynamic" },
    ],
  };

  const result = partitionPromptForCache(input);

  // dynamicCacheKey should be a hash of static:digest:dynamic:digest format
  const expectedKey = sha256Hex(
    `dynamic:${JSON.stringify({ model: null, profileId: null })}:${result.staticDigest}:${result.dynamicDigest}`
  );

  assert.equal(result.dynamicCacheKey, expectedKey);
});

// ---------------------------------------------------------------------------
// Partition Boundary Behavior
// ---------------------------------------------------------------------------

test("once dynamic starts, no more static messages even if role is system", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "First system" },
      { role: "user", content: "User message" },
      { role: "system", content: "Second system should be dynamic" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.staticMessageCount, 1);
  assert.equal(result.dynamicMessageCount, 2);
});

test("mixed roles at start - only leading system messages are static", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "System 1" },
      { role: "assistant", content: "Assistant message" },
      { role: "system", content: "This becomes dynamic" },
      { role: "system", content: "This also becomes dynamic" },
    ],
  };

  const result = partitionPromptForCache(input);

  // Only the first system message is static since assistant appears before subsequent systems
  assert.equal(result.staticMessageCount, 1);
  assert.equal(result.dynamicMessageCount, 3);
});

test("empty static prefix - all messages dynamic", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "user", content: "User 1" },
      { role: "assistant", content: "Assistant 1" },
      { role: "user", content: "User 2" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.staticMessageCount, 0);
  assert.equal(result.dynamicMessageCount, 3);
  assert.equal(result.fixedPrefixMessageCount, 0);
  assert.equal(result.domainBlockMessageCount, 0);
});

test("all static - no dynamic messages", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "System 1" },
      { role: "system", content: "System 2" },
      { role: "system", content: "System 3" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.staticMessageCount, 3);
  assert.equal(result.dynamicMessageCount, 0);
  assert.equal(result.variableMessageCount, 0);
  assert.equal(result.variableSuffixBytes, 0);
});

// ---------------------------------------------------------------------------
// Byte Count Accuracy
// ---------------------------------------------------------------------------

test("stablePrefixBytes equals sum of static message canonical bytes", () => {
  const messages = [
    { role: "system", content: "Hello" },
    { role: "system", content: "World" },
  ];

  const input: PromptPartitionInput = { messages };
  const result = partitionPromptForCache(input);

  const expected = messages
    .map((m) =>
      JSON.stringify({
        role: m.role ?? null,
        content: m.content ?? null,
        parts: m.parts ?? null,
      })
    )
    .join("\n");

  assert.equal(result.stablePrefixBytes, Buffer.byteLength(expected, "utf8"));
});

test("fixedPrefixBytes counts only fixed prefix messages", () => {
  const input: PromptPartitionInput = {
    kvCache: { enabled: true, fixedPrefixMessageCount: 1 },
    messages: [
      { role: "system", content: "Fixed" },
      { role: "system", content: "Domain" },
      { role: "user", content: "Dynamic" },
    ],
  };

  const result = partitionPromptForCache(input);

  // Only the first system message should be in fixed prefix
  const expectedBytes = Buffer.byteLength(
    JSON.stringify({ role: "system", content: "Fixed", parts: null }),
    "utf8"
  );

  assert.equal(result.fixedPrefixBytes, expectedBytes);
});

test("domainBlockBytes counts only domain block messages", () => {
  const input: PromptPartitionInput = {
    kvCache: { enabled: true, fixedPrefixMessageCount: 1 },
    messages: [
      { role: "system", content: "Fixed" },
      { role: "system", content: "Domain block" },
      { role: "user", content: "Dynamic" },
    ],
  };

  const result = partitionPromptForCache(input);

  // Only the second system message should be in domain block
  const expectedBytes = Buffer.byteLength(
    JSON.stringify({ role: "system", content: "Domain block", parts: null }),
    "utf8"
  );

  assert.equal(result.domainBlockBytes, expectedBytes);
});

test("variableSuffixBytes counts only dynamic messages", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "System" },
      { role: "user", content: "Hello" },
    ],
  };

  const result = partitionPromptForCache(input);

  // Only the user message should be in dynamic
  const expectedBytes = Buffer.byteLength(
    JSON.stringify({ role: "user", content: "Hello", parts: null }),
    "utf8"
  );

  assert.equal(result.variableSuffixBytes, expectedBytes);
});

// ---------------------------------------------------------------------------
// Digest Consistency
// ---------------------------------------------------------------------------

test("fixedPrefixDigest is hash of fixed prefix payload", () => {
  const input: PromptPartitionInput = {
    kvCache: { enabled: true, fixedPrefixMessageCount: 1 },
    messages: [
      { role: "system", content: "Fixed" },
      { role: "system", content: "Domain" },
    ],
  };

  const result = partitionPromptForCache(input);

  const expectedDigest = sha256Hex(
    JSON.stringify({ role: "system", content: "Fixed", parts: null })
  );

  assert.equal(result.fixedPrefixDigest, expectedDigest);
});

test("domainBlockDigest is hash of domain block payload (empty when no domain block)", () => {
  const input: PromptPartitionInput = {
    kvCache: { enabled: true, fixedPrefixMessageCount: 2 },
    messages: [
      { role: "system", content: "Fixed1" },
      { role: "system", content: "Fixed2" },
    ],
  };

  const result = partitionPromptForCache(input);

  // When no domain block, the digest is still computed (empty string)
  assert.equal(result.domainBlockDigest, sha256Hex(""));
  assert.equal(result.domainBlockMessageCount, 0);
});

test("variableSuffixDigest equals dynamicDigest", () => {
  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "System" },
      { role: "user", content: "Dynamic" },
    ],
  };

  const result = partitionPromptForCache(input);

  assert.equal(result.variableSuffixDigest, result.dynamicDigest);
});

// ---------------------------------------------------------------------------
// Service Cache Key Tracking
// ---------------------------------------------------------------------------

test("PromptPartitionCacheService uses dynamicCacheKey for tracking", () => {
  const service = new PromptPartitionCacheService();

  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "Same system" },
      { role: "user", content: "Dynamic A" },
    ],
  };

  const partition = partitionPromptForCache(input);
  const usage1 = service.record(input);

  // Record same dynamic content again
  const input2: PromptPartitionInput = {
    messages: [
      { role: "system", content: "Same system" },
      { role: "user", content: "Dynamic A" },
    ],
  };

  const usage2 = service.record(input2);

  assert.equal(usage2.reuseCount, 1);
  assert.equal(usage1.partition.dynamicCacheKey, usage2.partition.dynamicCacheKey);
});

test("PromptPartitionCacheService different dynamic keys tracked separately", () => {
  const service = new PromptPartitionCacheService();

  service.record({
    messages: [
      { role: "system", content: "System" },
      { role: "user", content: "Dynamic A" },
    ],
  });

  service.record({
    messages: [
      { role: "system", content: "System" },
      { role: "user", content: "Dynamic B" },
    ],
  });

  assert.equal(service.listUsage().length, 2);
});

test("PromptPartitionCacheService returns usage by exact dynamicCacheKey", () => {
  const service = new PromptPartitionCacheService();

  const input: PromptPartitionInput = {
    messages: [
      { role: "system", content: "System" },
      { role: "user", content: "Test" },
    ],
  };

  service.record(input);
  const partition = partitionPromptForCache(input);

  // Try with wrong key
  const wrongKey = partition.dynamicCacheKey.replace("a", "b");
  const notFound = service.getUsage(wrongKey);
  assert.equal(notFound, null);

  // Record again to get reuseCount of 1
  service.record(input);

  // Try with correct key
  const found = service.getUsage(partition.dynamicCacheKey);
  assert.ok(found);
  assert.equal(found!.reuseCount, 1);
});
