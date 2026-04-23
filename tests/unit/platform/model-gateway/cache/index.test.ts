import assert from "node:assert/strict";
import test from "node:test";

import { ModelGatewayCacheEntry, ModelGatewayCacheService } from "../../../../../src/platform/model-gateway/cache/index.js";

test("ModelGatewayCacheService builds stable keys and expires entries", () => {
  const service = new ModelGatewayCacheService<{ text: string }>();
  const cacheKey = service.buildCacheKey({
    tenantId: "tenant-1",
    model: "gpt-5.4",
    routeClass: "reasoning",
    messages: [{ role: "user", content: " Hello " }],
  });
  service.put({
    cacheKey,
    tenantId: "tenant-1",
    model: "gpt-5.4",
    routeClass: "reasoning",
    value: { text: "cached" },
    createdAt: "2026-04-20T00:00:00.000Z",
    ttlMs: 1000,
  });

  assert.equal(service.get(cacheKey, "2026-04-20T00:00:00.500Z")?.value.text, "cached");
  assert.equal(service.get(cacheKey, "2026-04-20T00:00:02.000Z"), null);
});

test("ModelGatewayCacheService invalidate removes entry", () => {
  const service = new ModelGatewayCacheService<{ text: string }>();
  const cacheKey = service.buildCacheKey({
    tenantId: "tenant-1",
    model: "gpt-5.4",
    routeClass: "reasoning",
    messages: [{ role: "user", content: "test" }],
  });
  service.put({
    cacheKey,
    tenantId: "tenant-1",
    model: "gpt-5.4",
    routeClass: "reasoning",
    value: { text: "cached" },
  });

  assert.equal(service.get(cacheKey)?.value.text, "cached");
  const result = service.invalidate(cacheKey);
  assert.equal(result, true);
  assert.equal(service.get(cacheKey), null);
});

test("ModelGatewayCacheService invalidate returns false for non-existent key", () => {
  const service = new ModelGatewayCacheService<{ text: string }>();
  const result = service.invalidate("non-existent-key");
  assert.equal(result, false);
});

test("ModelGatewayCacheService listEntries returns all entries", () => {
  const service = new ModelGatewayCacheService<{ text: string }>();
  const cacheKey1 = service.buildCacheKey({
    tenantId: "tenant-1",
    model: "gpt-5.4",
    routeClass: "reasoning",
    messages: [{ role: "user", content: "test1" }],
  });
  const cacheKey2 = service.buildCacheKey({
    tenantId: "tenant-1",
    model: "gpt-5.4",
    routeClass: "coding",
    messages: [{ role: "user", content: "test2" }],
  });
  service.put({
    cacheKey: cacheKey1,
    tenantId: "tenant-1",
    model: "gpt-5.4",
    routeClass: "reasoning",
    value: { text: "cached1" },
  });
  service.put({
    cacheKey: cacheKey2,
    tenantId: "tenant-1",
    model: "gpt-5.4",
    routeClass: "coding",
    value: { text: "cached2" },
  });

  const entries = service.listEntries();
  assert.equal(entries.length, 2);
});

test("ModelGatewayCacheService listEntries returns empty array when no entries", () => {
  const service = new ModelGatewayCacheService<{ text: string }>();
  const entries = service.listEntries();
  assert.deepEqual(entries, []);
});

test("ModelGatewayCacheService put without ttl creates entry without expiry", () => {
  const service = new ModelGatewayCacheService<{ text: string }>();
  const cacheKey = service.buildCacheKey({
    tenantId: "tenant-1",
    model: "gpt-5.4",
    routeClass: "reasoning",
    messages: [{ role: "user", content: "test" }],
  });
  const entry = service.put({
    cacheKey,
    tenantId: "tenant-1",
    model: "gpt-5.4",
    routeClass: "reasoning",
    value: { text: "cached" },
  });

  assert.equal(entry.expiresAt, null);
});

test("ModelGatewayCacheService get returns null for non-existent key", () => {
  const service = new ModelGatewayCacheService<{ text: string }>();
  const result = service.get("non-existent-key");
  assert.equal(result, null);
});

test("ModelGatewayCacheService buildCacheKey normalizes message content", () => {
  const service = new ModelGatewayCacheService<{ text: string }>();
  const key1 = service.buildCacheKey({
    tenantId: "tenant-1",
    model: "gpt-5.4",
    routeClass: "reasoning",
    messages: [{ role: "user", content: "Hello" }],
  });
  const key2 = service.buildCacheKey({
    tenantId: "tenant-1",
    model: "gpt-5.4",
    routeClass: "reasoning",
    messages: [{ role: "user", content: "  Hello  " }],
  });
  // Whitespace should be trimmed, so keys should be equal
  assert.equal(key1, key2);
});

test("ModelGatewayCacheService buildCacheKey produces consistent sha256 hash", () => {
  const service = new ModelGatewayCacheService<{ text: string }>();
  const key1 = service.buildCacheKey({
    tenantId: "tenant-1",
    model: "gpt-5.4",
    routeClass: "reasoning",
    messages: [{ role: "user", content: "test message" }],
  });
  const key2 = service.buildCacheKey({
    tenantId: "tenant-1",
    model: "gpt-5.4",
    routeClass: "reasoning",
    messages: [{ role: "user", content: "test message" }],
  });
  assert.equal(key1, key2);
  assert.equal(key1.length, 64); // SHA256 hex is 64 characters
});

test("ModelGatewayCacheService put uses current time when createdAt not provided", () => {
  const service = new ModelGatewayCacheService<{ text: string }>();
  const cacheKey = service.buildCacheKey({
    tenantId: "tenant-1",
    model: "gpt-5.4",
    routeClass: "reasoning",
    messages: [{ role: "user", content: "test" }],
  });
  const before = new Date().toISOString();
  const entry = service.put({
    cacheKey,
    tenantId: "tenant-1",
    model: "gpt-5.4",
    routeClass: "reasoning",
    value: { text: "cached" },
  });
  const after = new Date().toISOString();

  assert.ok(entry.createdAt >= before);
  assert.ok(entry.createdAt <= after);
});

test("ModelGatewayCacheService put handles null tenantId", () => {
  const service = new ModelGatewayCacheService<{ text: string }>();
  const cacheKey = service.buildCacheKey({
    tenantId: null,
    model: "gpt-5.4",
    routeClass: "reasoning",
    messages: [{ role: "user", content: "test" }],
  });
  const entry = service.put({
    cacheKey,
    tenantId: null,
    model: "gpt-5.4",
    routeClass: "reasoning",
    value: { text: "cached" },
  });

  assert.equal(entry.tenantId, null);
});

test("ModelGatewayCacheService entry contains all required fields", () => {
  const service = new ModelGatewayCacheService<{ text: string }>();
  const cacheKey = service.buildCacheKey({
    tenantId: "tenant-1",
    model: "gpt-5.4",
    routeClass: "reasoning",
    messages: [{ role: "user", content: "test" }],
  });
  const entry = service.put({
    cacheKey,
    tenantId: "tenant-1",
    model: "gpt-5.4",
    routeClass: "reasoning",
    value: { text: "cached" },
    ttlMs: 5000,
  });

  assert.equal(entry.cacheKey, cacheKey);
  assert.equal(entry.tenantId, "tenant-1");
  assert.equal(entry.model, "gpt-5.4");
  assert.equal(entry.routeClass, "reasoning");
  assert.deepEqual(entry.value, { text: "cached" });
  assert.ok(entry.createdAt);
  assert.ok(entry.expiresAt);
});
