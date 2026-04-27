/**
 * Additional ModelGatewayCacheService edge case tests for increased coverage
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ModelGatewayCacheService, type ModelGatewayCacheEntry } from "../../../../src/platform/model-gateway/cache/index.js";

test("ModelGatewayCacheService buildCacheKey with undefined tenantId", () => {
  const service = new ModelGatewayCacheService<string>();
  const key = service.buildCacheKey({
    model: "gpt-4o",
    routeClass: "default",
    messages: [{ role: "user", content: "Hello" }],
  });

  assert.ok(key.length === 64);
});

test("ModelGatewayCacheService buildCacheKey with different models", () => {
  const service = new ModelGatewayCacheService<string>();
  const key1 = service.buildCacheKey({
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "default",
    messages: [{ role: "user", content: "Hello" }],
  });
  const key2 = service.buildCacheKey({
    tenantId: "tenant-1",
    model: "gpt-4.5",
    routeClass: "default",
    messages: [{ role: "user", content: "Hello" }],
  });

  assert.notEqual(key1, key2);
});

test("ModelGatewayCacheService buildCacheKey with different routeClasses", () => {
  const service = new ModelGatewayCacheService<string>();
  const key1 = service.buildCacheKey({
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "coding",
    messages: [{ role: "user", content: "Hello" }],
  });
  const key2 = service.buildCacheKey({
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "reasoning",
    messages: [{ role: "user", content: "Hello" }],
  });

  assert.notEqual(key1, key2);
});

test("ModelGatewayCacheService buildCacheKey with different tenantIds", () => {
  const service = new ModelGatewayCacheService<string>();
  const key1 = service.buildCacheKey({
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "default",
    messages: [{ role: "user", content: "Hello" }],
  });
  const key2 = service.buildCacheKey({
    tenantId: "tenant-2",
    model: "gpt-4o",
    routeClass: "default",
    messages: [{ role: "user", content: "Hello" }],
  });

  assert.notEqual(key1, key2);
});

test("ModelGatewayCacheService buildCacheKey with different message contents", () => {
  const service = new ModelGatewayCacheService<string>();
  const key1 = service.buildCacheKey({
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "default",
    messages: [{ role: "user", content: "Hello" }],
  });
  const key2 = service.buildCacheKey({
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "default",
    messages: [{ role: "user", content: "Goodbye" }],
  });

  assert.notEqual(key1, key2);
});

test("ModelGatewayCacheService buildCacheKey with different roles", () => {
  const service = new ModelGatewayCacheService<string>();
  const key1 = service.buildCacheKey({
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "default",
    messages: [{ role: "user", content: "Hello" }],
  });
  const key2 = service.buildCacheKey({
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "default",
    messages: [{ role: "assistant", content: "Hello" }],
  });

  assert.notEqual(key1, key2);
});

test("ModelGatewayCacheService buildCacheKey with multiple messages", () => {
  const service = new ModelGatewayCacheService<string>();
  const key = service.buildCacheKey({
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "default",
    messages: [
      { role: "system", content: "You are a helpful assistant" },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" },
      { role: "user", content: "How are you?" },
    ],
  });

  assert.ok(key.length === 64);
});

test("ModelGatewayCacheService put with ttlMs 0", () => {
  const service = new ModelGatewayCacheService<string>();
  const entry = service.put({
    cacheKey: "test-key",
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "default",
    value: "test value",
    ttlMs: 0,
  });

  // ttlMs of 0 means expires immediately
  assert.ok(entry.expiresAt !== null);
});

test("ModelGatewayCacheService get at exact expiration time", () => {
  const service = new ModelGatewayCacheService<string>();
  const createdAt = "2026-04-20T00:00:00.000Z";

  service.put({
    cacheKey: "test-key",
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "default",
    value: "test value",
    createdAt,
    ttlMs: 1000,
  });

  // At exactly the expiration time, should return null
  const result = service.get("test-key", "2026-04-20T00:00:01.000Z");
  assert.equal(result, null);
});

test("ModelGatewayCacheService get just before expiration", () => {
  const service = new ModelGatewayCacheService<string>();
  const createdAt = "2026-04-20T00:00:00.000Z";

  service.put({
    cacheKey: "test-key",
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "default",
    value: "test value",
    createdAt,
    ttlMs: 1000,
  });

  // Just before expiration, should still return entry
  const result = service.get("test-key", "2026-04-20T00:00:00.999Z");
  assert.ok(result !== null);
  assert.equal(result?.value, "test value");
});

test("ModelGatewayCacheService get with custom now parameter", () => {
  const service = new ModelGatewayCacheService<string>();
  const createdAt = "2026-04-20T00:00:00.000Z";

  service.put({
    cacheKey: "test-key",
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "default",
    value: "test value",
    createdAt,
    ttlMs: 1000,
  });

  // Using the same timestamp should work
  const result = service.get("test-key", createdAt);
  assert.ok(result !== null);
});

test("ModelGatewayCacheService put uses provided createdAt", () => {
  const service = new ModelGatewayCacheService<string>();
  const customDate = "2025-01-01T00:00:00.000Z";

  const entry = service.put({
    cacheKey: "test-key",
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "default",
    value: "test value",
    createdAt: customDate,
  });

  assert.equal(entry.createdAt, customDate);
});

test("ModelGatewayCacheService put handles undefined ttlMs", () => {
  const service = new ModelGatewayCacheService<string>();

  const entry = service.put({
    cacheKey: "test-key",
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "default",
    value: "test value",
  });

  assert.equal(entry.expiresAt, null);
});

test("ModelGatewayCacheService put handles null ttlMs", () => {
  const service = new ModelGatewayCacheService<string>();

  const entry = service.put({
    cacheKey: "test-key",
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "default",
    value: "test value",
    ttlMs: null,
  });

  assert.equal(entry.expiresAt, null);
});

test("ModelGatewayCacheService listEntries returns copy not reference", () => {
  const service = new ModelGatewayCacheService<string>();
  service.put({
    cacheKey: "key1",
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "default",
    value: "value1",
  });

  const entries1 = service.listEntries();
  const entries2 = service.listEntries();

  assert.deepEqual(entries1, entries2);
  // Should be equal but not same reference
  entries1.push({} as ModelGatewayCacheEntry<string>);
  assert.notEqual(service.listEntries().length, entries1.length);
});

test("ModelGatewayCacheService buildCacheKey trims whitespace in content", () => {
  const service = new ModelGatewayCacheService<string>();
  const key1 = service.buildCacheKey({
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "default",
    messages: [{ role: "user", content: "Hello World" }],
  });
  const key2 = service.buildCacheKey({
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "default",
    messages: [{ role: "user", content: "  Hello World  " }],
  });

  assert.equal(key1, key2);
});

test("ModelGatewayCacheService buildCacheKey handles empty messages array", () => {
  const service = new ModelGatewayCacheService<string>();
  const key = service.buildCacheKey({
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "default",
    messages: [],
  });

  assert.ok(key.length === 64);
});

test("ModelGatewayCacheService buildCacheKey handles very long content", () => {
  const service = new ModelGatewayCacheService<string>();
  const longContent = "a".repeat(100000);

  const key = service.buildCacheKey({
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "default",
    messages: [{ role: "user", content: longContent }],
  });

  assert.ok(key.length === 64);
});

test("ModelGatewayCacheService put with complex object value", () => {
  const service = new ModelGatewayCacheService<{ nested: { data: string[] }; count: number }>();

  const entry = service.put({
    cacheKey: "test-key",
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "default",
    value: { nested: { data: ["a", "b", "c"] }, count: 42 },
  });

  const retrieved = service.get("test-key");
  assert.deepEqual(retrieved?.value, { nested: { data: ["a", "b", "c"] }, count: 42 });
});

test("ModelGatewayCacheService get after invalidation returns null", () => {
  const service = new ModelGatewayCacheService<string>();
  service.put({
    cacheKey: "test-key",
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "default",
    value: "test value",
  });

  assert.ok(service.get("test-key") !== null);

  service.invalidate("test-key");

  assert.equal(service.get("test-key"), null);
});

test("ModelGatewayCacheService listEntries is empty initially", () => {
  const service = new ModelGatewayCacheService<string>();
  const entries = service.listEntries();
  assert.deepEqual(entries, []);
});

test("ModelGatewayCacheService put returns entry with all fields", () => {
  const service = new ModelGatewayCacheService<string>();
  const entry = service.put({
    cacheKey: "my-key",
    tenantId: "my-tenant",
    model: "my-model",
    routeClass: "my-class",
    value: "my-value",
    ttlMs: 5000,
  });

  assert.equal(entry.cacheKey, "my-key");
  assert.equal(entry.tenantId, "my-tenant");
  assert.equal(entry.model, "my-model");
  assert.equal(entry.routeClass, "my-class");
  assert.equal(entry.value, "my-value");
  assert.ok(entry.createdAt !== null);
  assert.ok(entry.expiresAt !== null);
});

test("ModelGatewayCacheService entry type allows any value type", () => {
  const service = new ModelGatewayCacheService<number>();
  service.put({
    cacheKey: "number-key",
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "default",
    value: 42,
  });

  const retrieved = service.get("number-key");
  assert.equal(retrieved?.value, 42);
});

test("ModelGatewayCacheService entry type allows array value type", () => {
  const service = new ModelGatewayCacheService<string[]>();
  service.put({
    cacheKey: "array-key",
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "default",
    value: ["a", "b", "c"],
  });

  const retrieved = service.get("array-key");
  assert.deepEqual(retrieved?.value, ["a", "b", "c"]);
});

test("ModelGatewayCacheService entry type allows null value", () => {
  const service = new ModelGatewayCacheService<null>();
  service.put({
    cacheKey: "null-key",
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "default",
    value: null,
  });

  const retrieved = service.get("null-key");
  assert.equal(retrieved?.value, null);
});

test("ModelGatewayCacheService entry type allows undefined value", () => {
  const service = new ModelGatewayCacheService<undefined>();
  service.put({
    cacheKey: "undefined-key",
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "default",
    value: undefined,
  });

  const retrieved = service.get("undefined-key");
  assert.equal(retrieved?.value, undefined);
});

test("ModelGatewayCacheService handles put with string routeClass", () => {
  const service = new ModelGatewayCacheService<string>();
  const entry = service.put({
    cacheKey: "test-key",
    tenantId: "tenant-1",
    model: "gpt-4o",
    routeClass: "coding",
    value: "test value",
  });

  assert.equal(entry.routeClass, "coding");
});
