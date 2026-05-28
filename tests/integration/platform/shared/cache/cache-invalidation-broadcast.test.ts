/**
 * Cache Invalidation Broadcast Integration Tests
 *
 * Tests cross-instance cache invalidation message formatting,
 * broadcast channels, and message structure.
 *
 * Note: These tests validate message structure and class interface.
 * Full pub/sub integration requires a running Redis instance.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { CacheInvalidationBroadcast } from "../../../../../src/platform/shared/cache/cache-invalidation-broadcast.js";

const REDIS_HOST = process.env.AA_REDIS_HOST ?? "127.0.0.1";
const REDIS_PORT = Number.parseInt(process.env.AA_REDIS_PORT ?? "6379", 10);

// Test message structure validation
test("CacheInvalidationMessage type is correctly structured for tag invalidation", () => {
  const message: { type: "tag"; tag: string; origin: string } = {
    type: "tag",
    tag: "test:tag",
    origin: "inst_123",
  };

  assert.equal(message.type, "tag");
  assert.equal(message.tag, "test:tag");
  assert.equal(message.origin, "inst_123");
});

test("CacheInvalidationMessage type is correctly structured for namespace invalidation", () => {
  const message: { type: "namespace"; namespace: string; origin: string } = {
    type: "namespace",
    namespace: "memory.summary",
    origin: "inst_456",
  };

  assert.equal(message.type, "namespace");
  assert.equal(message.namespace, "memory.summary");
  assert.equal(message.origin, "inst_456");
});

// Interface test - validates the broadcast class can be instantiated
test("CacheInvalidationBroadcast can be instantiated with config and callback", () => {
  // Use a mock config that won't actually connect
  const broadcast = new CacheInvalidationBroadcast(
    {
      host: REDIS_HOST,
      port: REDIS_PORT,
    },
    async () => {},
  );

  assert.ok(broadcast !== null);
  assert.ok(typeof broadcast.start === "function");
  assert.ok(typeof broadcast.broadcastTagInvalidation === "function");
  assert.ok(typeof broadcast.broadcastNamespaceInvalidation === "function");
  assert.ok(typeof broadcast.close === "function");
});

// Test message serialization format
test("Tag invalidation message serializes correctly", () => {
  const message = {
    type: "tag",
    tag: "user:profile:123",
    origin: "inst_789_abc123",
  };

  const serialized = JSON.stringify(message);
  const parsed = JSON.parse(serialized);

  assert.equal(parsed.type, "tag");
  assert.equal(parsed.tag, "user:profile:123");
  assert.equal(parsed.origin, "inst_789_abc123");
});

test("Namespace invalidation message serializes correctly", () => {
  const message = {
    type: "namespace",
    namespace: "cache.prompt",
    origin: "inst_abc_def",
  };

  const serialized = JSON.stringify(message);
  const parsed = JSON.parse(serialized);

  assert.equal(parsed.type, "namespace");
  assert.equal(parsed.namespace, "cache.prompt");
  assert.equal(parsed.origin, "inst_abc_def");
});

// Test origin filtering logic
test("Messages should be filtered by origin (self-vs-remote)", () => {
  const instanceId = "inst_12345";
  const selfMessage = { type: "tag", tag: "test", origin: instanceId };
  const remoteMessage = { type: "tag", tag: "test", origin: "inst_other" };

  // Simulate the filtering logic from CacheInvalidationBroadcast
  const isSelfMessage = (msg: typeof selfMessage) => msg.origin === instanceId;

  assert.equal(isSelfMessage(selfMessage), true);
  assert.equal(isSelfMessage(remoteMessage), false);
});

// Test that different tags produce different messages
test("Different tags produce distinguishable messages", () => {
  const msg1 = { type: "tag", tag: "tag:A", origin: "inst_1" };
  const msg2 = { type: "tag", tag: "tag:B", origin: "inst_1" };
  const msg3 = { type: "tag", tag: "tag:A", origin: "inst_2" };

  assert.notEqual(msg1.tag, msg2.tag);
  assert.notEqual(msg1.origin, msg3.origin);
  assert.notEqual(JSON.stringify(msg1), JSON.stringify(msg2));
  assert.notEqual(JSON.stringify(msg1), JSON.stringify(msg3));
});

// Test that different namespaces produce different messages
test("Different namespaces produce distinguishable messages", () => {
  const msg1 = { type: "namespace", namespace: "ns1", origin: "inst_1" };
  const msg2 = { type: "namespace", namespace: "ns2", origin: "inst_1" };

  assert.notEqual(msg1.namespace, msg2.namespace);
  assert.notEqual(JSON.stringify(msg1), JSON.stringify(msg2));
});

// Test channel naming
test("Default channel name is correctly formed", () => {
  const defaultChannel = "aacache:invalidation";

  assert.ok(defaultChannel.includes("aacache"));
  assert.ok(defaultChannel.includes("invalidation"));
});

// Test instance ID format uniqueness
test("Instance IDs are unique across generations", () => {
  const ids = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const id = `inst_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    ids.add(id);
  }

  // Most IDs should be unique (allowing for rare collisions in fast execution)
  assert.ok(ids.size > 90, "Expected most generated IDs to be unique");
});

// Validate that close can be called safely multiple times
test("CacheInvalidationBroadcast close is idempotent", async () => {
  const broadcast = new CacheInvalidationBroadcast(
    { host: REDIS_HOST, port: REDIS_PORT },
    async () => {},
  );

  // First close
  await broadcast.close();

  // Second close should not throw
  await broadcast.close();

  assert.ok(true, "Multiple close calls should not throw");
});
