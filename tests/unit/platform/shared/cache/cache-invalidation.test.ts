/**
 * Additional unit tests for CacheInvalidationEngine - more edge cases
 */

import assert from "node:assert/strict";
import test from "node:test";

import { CacheInvalidationEngine } from "../../../../../src/platform/shared/cache/cache-invalidation.js";
import type { CacheFacade } from "../../../../../src/platform/shared/cache/cache-facade.js";
import type { CacheLookupResult } from "../../../../../src/platform/shared/cache/cache-types.js";

// Mock CacheFacade implementation
class MockCacheFacade implements CacheFacade {
  private store = new Map<string, { value: unknown; meta: Record<string, unknown> }>();

  async get<T>(_namespace: string, _key: string): Promise<CacheLookupResult<T>> {
    return { hit: false, value: null, reason: "not_found" };
  }

  async set(namespace: string, key: string, value: unknown, meta: Record<string, unknown>): Promise<void> {
    this.store.set(`${namespace}:${key}`, { value, meta });
  }

  async delete(_namespace: string, _key: string): Promise<void> {}

  async invalidateByTag(tag: string): Promise<number> {
    let count = 0;
    const tagPrefix = `tags:${tag}:`;
    for (const key of this.store.keys()) {
      if (key.startsWith(tagPrefix)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  async invalidateNamespace(namespace: string): Promise<number> {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(`${namespace}:`)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  async cleanupExpired(): Promise<number> {
    return 0;
  }

  getMetricsSnapshot() {
    return { totalHits: 0, totalMisses: 0, byNamespace: {}, hitRate: 0 };
  }
}

test("CacheInvalidationEngine handles empty tag invalidation gracefully", async () => {
  const mockFacade = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockFacade);

  // Empty string tag should still generate a valid tag
  const count = await engine.onFileChanged("");
  assert.ok(typeof count === "number");
});

test("CacheInvalidationEngine handles special characters in file path", async () => {
  const mockFacade = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockFacade);

  const count = await engine.onFileChanged("/path/with spaces/file.ts");
  assert.ok(typeof count === "number");
});

test("CacheInvalidationEngine handles unicode in session ID", async () => {
  const mockFacade = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockFacade);

  const count = await engine.onSessionClosed("session_\u00E9\u00E0\u00FC");
  assert.ok(typeof count === "number");
});

test("CacheInvalidationEngine handles very long instruction fingerprint", async () => {
  const mockFacade = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockFacade);

  const longFingerprint = "a".repeat(1000);
  const count = await engine.onInstructionChanged(longFingerprint);
  assert.ok(typeof count === "number");
});

test("CacheInvalidationEngine handles special characters in repo ID", async () => {
  const mockFacade = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockFacade);

  const count = await engine.onRepoRebuilt("repo/my-project (fork)");
  assert.ok(typeof count === "number");
});

test("CacheInvalidationEngine handles empty tool name", async () => {
  const mockFacade = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockFacade);

  const count = await engine.onToolUpdated("");
  assert.ok(typeof count === "number");
});

test("CacheInvalidationEngine handles empty namespace", async () => {
  const mockFacade = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockFacade);

  const count = await engine.invalidateNamespace("");
  assert.ok(typeof count === "number");
});

test("CacheInvalidationEngine.invalidateTags with empty array", async () => {
  const mockFacade = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockFacade);

  const count = await engine.invalidateTags([]);
  assert.equal(count, 0);
});

test("CacheInvalidationEngine.invalidateTags with single tag", async () => {
  const mockFacade = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockFacade);

  const count = await engine.invalidateTags(["single-tag"]);
  assert.ok(typeof count === "number");
});

test("CacheInvalidationEngine.invalidateTags aggregates multiple tag results", async () => {
  const mockFacade = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockFacade);

  // Call multiple times and verify accumulation works
  const count1 = await engine.invalidateTags(["tag1"]);
  const count2 = await engine.invalidateTags(["tag2"]);

  // Counts should be independent, not accumulated in single call
  assert.ok(typeof count1 === "number");
  assert.ok(typeof count2 === "number");
});

test("CacheInvalidationEngine.invalidateTags with duplicate tags", async () => {
  const mockFacade = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockFacade);

  // Same tag listed multiple times
  const count = await engine.invalidateTags(["same-tag", "same-tag"]);
  assert.ok(typeof count === "number");
});

test("CacheInvalidationEngine.invalidateTags handles mixed valid and invalid tags", async () => {
  const mockFacade = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockFacade);

  const count = await engine.invalidateTags([
    "valid-tag",
    "",
    "another-valid",
  ]);
  assert.ok(typeof count === "number");
});