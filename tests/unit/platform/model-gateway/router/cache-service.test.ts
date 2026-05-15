import assert from "node:assert/strict";
import test from "node:test";

import { ModelGatewayCacheService, type ModelGatewayCacheEntry } from "../../../../../src/platform/model-gateway/cache/index.js";

test("ModelGatewayCacheService.buildCacheKey creates deterministic key", () => {
  const cache = new ModelGatewayCacheService<string>();
  const messages = [{ role: "user", content: "Hello" }];

  const key1 = cache.buildCacheKey({ tenantId: "tenant-1", model: "gpt-4", routeClass: "default", messages });
  const key2 = cache.buildCacheKey({ tenantId: "tenant-1", model: "gpt-4", routeClass: "default", messages });

  assert.equal(key1, key2);
  assert.equal(key1.length, 64); // SHA-256 hex
});

test("ModelGatewayCacheService.buildCacheKey different tenant produces different key", () => {
  const cache = new ModelGatewayCacheService<string>();
  const messages = [{ role: "user", content: "Hello" }];

  const key1 = cache.buildCacheKey({ tenantId: "tenant-1", model: "gpt-4", routeClass: "default", messages });
  const key2 = cache.buildCacheKey({ tenantId: "tenant-2", model: "gpt-4", routeClass: "default", messages });

  assert.notEqual(key1, key2);
});

test("ModelGatewayCacheService.buildCacheKey different model produces different key", () => {
  const cache = new ModelGatewayCacheService<string>();
  const messages = [{ role: "user", content: "Hello" }];

  const key1 = cache.buildCacheKey({ tenantId: "tenant-1", model: "gpt-4", routeClass: "default", messages });
  const key2 = cache.buildCacheKey({ tenantId: "tenant-1", model: "gpt-4o", routeClass: "default", messages });

  assert.notEqual(key1, key2);
});

test("ModelGatewayCacheService.buildCacheKey different routeClass produces different key", () => {
  const cache = new ModelGatewayCacheService<string>();
  const messages = [{ role: "user", content: "Hello" }];

  const key1 = cache.buildCacheKey({ tenantId: "tenant-1", model: "gpt-4", routeClass: "default", messages });
  const key2 = cache.buildCacheKey({ tenantId: "tenant-1", model: "gpt-4", routeClass: "coding", messages });

  assert.notEqual(key1, key2);
});

test("ModelGatewayCacheService.buildCacheKey trims message content", () => {
  const cache = new ModelGatewayCacheService<string>();
  const messages1 = [{ role: "user", content: "Hello   " }];
  const messages2 = [{ role: "user", content: "Hello" }];

  const key1 = cache.buildCacheKey({ tenantId: "tenant-1", model: "gpt-4", routeClass: "default", messages: messages1 });
  const key2 = cache.buildCacheKey({ tenantId: "tenant-1", model: "gpt-4", routeClass: "default", messages: messages2 });

  assert.equal(key1, key2);
});

test("ModelGatewayCacheService.put stores entry and returns it", () => {
  const cache = new ModelGatewayCacheService<string>();
  const now = new Date().toISOString();

  const entry = cache.put({
    cacheKey: "test-key",
    tenantId: "tenant-1",
    model: "gpt-4",
    routeClass: "default",
    value: "test value",
    createdAt: now,
    ttlMs: 60000,
  });

  assert.equal(entry.cacheKey, "test-key");
  assert.equal(entry.tenantId, "tenant-1");
  assert.equal(entry.model, "gpt-4");
  assert.equal(entry.routeClass, "default");
  assert.equal(entry.value, "test value");
  assert.equal(entry.createdAt, now);
  assert.ok(entry.expiresAt != null);
});

test("ModelGatewayCacheService.put sets expiresAt based on ttlMs", () => {
  const cache = new ModelGatewayCacheService<string>();
  const before = Date.now();

  const entry = cache.put({
    cacheKey: "test-key",
    tenantId: "tenant-1",
    model: "gpt-4",
    routeClass: "default",
    value: "test value",
    ttlMs: 5000,
  });

  const expiresAtTime = new Date(entry.expiresAt!).getTime();
  assert.ok(expiresAtTime >= before + 5000);
  assert.ok(expiresAtTime <= Date.now() + 6000);
});

test("ModelGatewayCacheService.put without ttlMs sets expiresAt to null", () => {
  const cache = new ModelGatewayCacheService<string>();

  const entry = cache.put({
    cacheKey: "test-key",
    tenantId: "tenant-1",
    model: "gpt-4",
    routeClass: "default",
    value: "test value",
  });

  assert.equal(entry.expiresAt, null);
});

test("ModelGatewayCacheService.get retrieves stored entry", () => {
  const cache = new ModelGatewayCacheService<string>();

  cache.put({
    cacheKey: "test-key",
    tenantId: "tenant-1",
    model: "gpt-4",
    routeClass: "default",
    value: "stored value",
  });

  const entry = cache.get("test-key");
  assert.ok(entry != null);
  assert.equal(entry.value, "stored value");
});

test("ModelGatewayCacheService.get returns null for missing key", () => {
  const cache = new ModelGatewayCacheService<string>();

  const entry = cache.get("nonexistent-key");
  assert.equal(entry, null);
});

test("ModelGatewayCacheService.get returns null for expired entry", () => {
  const cache = new ModelGatewayCacheService<string>();
  const past = new Date(Date.now() - 10000).toISOString();

  cache.put({
    cacheKey: "test-key",
    tenantId: "tenant-1",
    model: "gpt-4",
    routeClass: "default",
    value: "expired value",
    createdAt: past,
    ttlMs: 1000,
  });

  const entry = cache.get("test-key");
  assert.equal(entry, null);
});

test("ModelGatewayCacheService.invalidate removes entry and returns true", () => {
  const cache = new ModelGatewayCacheService<string>();

  cache.put({
    cacheKey: "test-key",
    tenantId: "tenant-1",
    model: "gpt-4",
    routeClass: "default",
    value: "to be deleted",
  });

  const result = cache.invalidate("test-key");
  assert.equal(result, true);

  const entry = cache.get("test-key");
  assert.equal(entry, null);
});

test("ModelGatewayCacheService.invalidate returns false for nonexistent key", () => {
  const cache = new ModelGatewayCacheService<string>();

  const result = cache.invalidate("nonexistent-key");
  assert.equal(result, false);
});

test("ModelGatewayCacheService.listEntries returns all stored entries", () => {
  const cache = new ModelGatewayCacheService<string>();

  cache.put({
    cacheKey: "key-1",
    tenantId: "tenant-1",
    model: "gpt-4",
    routeClass: "default",
    value: "value-1",
  });
  cache.put({
    cacheKey: "key-2",
    tenantId: "tenant-2",
    model: "gpt-4o",
    routeClass: "coding",
    value: "value-2",
  });

  const entries = cache.listEntries();
  assert.equal(entries.length, 2);
});

test("ModelGatewayCacheService handles multiple put for same key", () => {
  const cache = new ModelGatewayCacheService<string>();

  cache.put({
    cacheKey: "test-key",
    tenantId: "tenant-1",
    model: "gpt-4",
    routeClass: "default",
    value: "first",
  });
  cache.put({
    cacheKey: "test-key",
    tenantId: "tenant-1",
    model: "gpt-4",
    routeClass: "default",
    value: "second",
  });

  const entry = cache.get("test-key");
  assert.ok(entry != null);
  assert.equal(entry.value, "second");
});

test("ModelGatewayCacheService works with different value types", () => {
  const cache = new ModelGatewayCacheService<{ count: number; name: string }>();

  cache.put({
    cacheKey: "complex-key",
    tenantId: "tenant-1",
    model: "gpt-4",
    routeClass: "default",
    value: { count: 42, name: "test" },
  });

  const entry = cache.get("complex-key");
  assert.ok(entry != null);
  assert.equal(entry.value.count, 42);
  assert.equal(entry.value.name, "test");
});

test("ModelGatewayCacheService.get uses custom now parameter for expiration check", () => {
  const cache = new ModelGatewayCacheService<string>();
  const now = new Date().toISOString();

  cache.put({
    cacheKey: "test-key",
    tenantId: "tenant-1",
    model: "gpt-4",
    routeClass: "default",
    value: "stored value",
    createdAt: now,
    ttlMs: 5000,
  });

  // Using same time should still be valid
  const entry = cache.get("test-key", now);
  assert.ok(entry != null);

  // Using time far in the future should be expired
  const future = new Date(Date.now() + 10000).toISOString();
  const expiredEntry = cache.get("test-key", future);
  assert.equal(expiredEntry, null);
});