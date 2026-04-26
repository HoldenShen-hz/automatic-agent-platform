/**
 * Unit tests for CacheInvalidationEngine - additional edge cases
 */

import assert from "node:assert/strict";
import test from "node:test";
import { CacheInvalidationEngine } from "../../../../../src/platform/shared/cache/cache-invalidation.js";
import type { CacheFacade } from "../../../../../src/platform/shared/cache/cache-facade.js";

// Mock CacheFacade that tracks all operations
class TrackingCacheFacade implements CacheFacade {
  public invalidations: Array<{ type: string; tag?: string; namespace?: string }> = [];
  private data = new Map<string, unknown>();

  async get<T>(_namespace: string, _key: string): Promise<{ hit: boolean; value: T | null; reason?: string }> {
    return { hit: false, value: null, reason: "not_found" };
  }

  async set(namespace: string, key: string, value: unknown): Promise<void> {
    this.data.set(`${namespace}:${key}`, value);
  }

  async delete(_namespace: string, _key: string): Promise<void> {}

  async invalidateByTag(tag: string): Promise<number> {
    this.invalidations.push({ type: "tag", tag });
    return 1;
  }

  async invalidateNamespace(namespace: string): Promise<number> {
    this.invalidations.push({ type: "namespace", namespace });
    return 1;
  }

  async cleanupExpired(): Promise<number> {
    return 0;
  }

  getMetricsSnapshot() {
    return { totalHits: 0, totalMisses: 0, byNamespace: {}, hitRate: 0 };
  }
}

test("CacheInvalidationEngine.onFileChanged generates correct tag format", async () => {
  const cache = new TrackingCacheFacade();
  const engine = new CacheInvalidationEngine(cache);

  await engine.onFileChanged("/src/utils/helper.ts");

  assert.equal(cache.invalidations.length, 1);
  assert.equal(cache.invalidations[0]!.type, "tag");
  assert.equal(cache.invalidations[0]!.tag, "file:/src/utils/helper.ts");
});

test("CacheInvalidationEngine.onSessionClosed generates correct tag format", async () => {
  const cache = new TrackingCacheFacade();
  const engine = new CacheInvalidationEngine(cache);

  await engine.onSessionClosed("sess_abc123");

  assert.equal(cache.invalidations.length, 1);
  assert.equal(cache.invalidations[0]!.type, "tag");
  assert.equal(cache.invalidations[0]!.tag, "session:sess_abc123");
});

test("CacheInvalidationEngine.onInstructionChanged generates correct tag format", async () => {
  const cache = new TrackingCacheFacade();
  const engine = new CacheInvalidationEngine(cache);

  await engine.onInstructionChanged("instr_fingerprint_xyz");

  assert.equal(cache.invalidations.length, 1);
  assert.equal(cache.invalidations[0]!.type, "tag");
  assert.equal(cache.invalidations[0]!.tag, "instruction:instr_fingerprint_xyz");
});

test("CacheInvalidationEngine.onRepoRebuilt generates correct tag format", async () => {
  const cache = new TrackingCacheFacade();
  const engine = new CacheInvalidationEngine(cache);

  await engine.onRepoRebuilt("my-org/my-repo");

  assert.equal(cache.invalidations.length, 1);
  assert.equal(cache.invalidations[0]!.type, "tag");
  assert.equal(cache.invalidations[0]!.tag, "repo:my-org/my-repo");
});

test("CacheInvalidationEngine.onToolUpdated generates correct tag format", async () => {
  const cache = new TrackingCacheFacade();
  const engine = new CacheInvalidationEngine(cache);

  await engine.onToolUpdated("read");

  assert.equal(cache.invalidations.length, 1);
  assert.equal(cache.invalidations[0]!.type, "tag");
  assert.equal(cache.invalidations[0]!.tag, "tool:read");
});

test("CacheInvalidationEngine.invalidateNamespace delegates correctly", async () => {
  const cache = new TrackingCacheFacade();
  const engine = new CacheInvalidationEngine(cache);

  await engine.invalidateNamespace("planner");

  assert.equal(cache.invalidations.length, 1);
  assert.equal(cache.invalidations[0]!.type, "namespace");
  assert.equal(cache.invalidations[0]!.namespace, "planner");
});

test("CacheInvalidationEngine.invalidateTags processes multiple tags sequentially", async () => {
  const cache = new TrackingCacheFacade();
  const engine = new CacheInvalidationEngine(cache);

  const total = await engine.invalidateTags(["tag1", "tag2", "tag3"]);

  assert.equal(cache.invalidations.length, 3);
  assert.equal(total, 3);
});

test("CacheInvalidationEngine.invalidateTags returns total count from all invalidations", async () => {
  const cache = new TrackingCacheFacade();
  const engine = new CacheInvalidationEngine(cache);

  // Each invalidation returns 1
  const count = await engine.invalidateTags(["a", "b"]);

  assert.equal(count, 2);
});

test("CacheInvalidationEngine handles paths with special characters", async () => {
  const cache = new TrackingCacheFacade();
  const engine = new CacheInvalidationEngine(cache);

  await engine.onFileChanged("/path/with spaces/file[1].ts");

  assert.ok(cache.invalidations[0]!.tag!.includes("spaces"));
});

test("CacheInvalidationEngine handles paths with unicode", async () => {
  const cache = new TrackingCacheFacade();
  const engine = new CacheInvalidationEngine(cache);

  await engine.onFileChanged("/path/文件.ts");

  assert.ok(cache.invalidations[0]!.tag!.includes("文件"));
});

test("CacheInvalidationEngine handles empty strings gracefully", async () => {
  const cache = new TrackingCacheFacade();
  const engine = new CacheInvalidationEngine(cache);

  // Empty file path generates empty tag
  await engine.onFileChanged("");
  await engine.onSessionClosed("");
  await engine.onInstructionChanged("");
  await engine.onRepoRebuilt("");
  await engine.onToolUpdated("");

  // All should complete without error
  assert.equal(cache.invalidations.length, 5);
});

test("CacheInvalidationEngine handles very long strings", async () => {
  const cache = new TrackingCacheFacade();
  const engine = new CacheInvalidationEngine(cache);

  const longString = "a".repeat(10000);
  await engine.onFileChanged(longString);

  assert.ok(cache.invalidations[0]!.tag!.startsWith("file:"));
});

test("CacheInvalidationEngine multiple calls accumulate invalidations", async () => {
  const cache = new TrackingCacheFacade();
  const engine = new CacheInvalidationEngine(cache);

  await engine.onFileChanged("/path1");
  await engine.onFileChanged("/path2");
  await engine.onSessionClosed("session1");
  await engine.onSessionClosed("session2");
  await engine.onToolUpdated("tool1");
  await engine.onToolUpdated("tool2");

  assert.equal(cache.invalidations.length, 6);
});

test("CacheInvalidationEngine.invalidateNamespace with special characters", async () => {
  const cache = new TrackingCacheFacade();
  const engine = new CacheInvalidationEngine(cache);

  await engine.invalidateNamespace("planner:v2:execution");

  assert.equal(cache.invalidations[0]!.namespace, "planner:v2:execution");
});

test("CacheInvalidationEngine returns 0 for empty invalidTags array", async () => {
  const cache = new TrackingCacheFacade();
  const engine = new CacheInvalidationEngine(cache);

  const result = await engine.invalidateTags([]);

  assert.equal(result, 0);
});

test("CacheInvalidationEngine can be instantiated with any CacheFacade implementation", () => {
  class CustomCacheFacade implements CacheFacade {
    async get<T>(): Promise<{ hit: boolean; value: T | null }> {
      return { hit: false, value: null };
    }
    async set(): Promise<void> {}
    async delete(): Promise<void> {}
    async invalidateByTag(tag: string): Promise<number> {
      return tag === "valid" ? 1 : 0;
    }
    async invalidateNamespace(namespace: string): Promise<number> {
      return namespace === "valid" ? 1 : 0;
    }
    async cleanupExpired(): Promise<number> { return 0; }
    getMetricsSnapshot() {
      return { totalHits: 0, totalMisses: 0, byNamespace: {}, hitRate: 0 };
    }
  }

  const customCache = new CustomCacheFacade();
  const engine = new CacheInvalidationEngine(customCache);

  // Should work with custom implementation
  assert.ok(engine instanceof CacheInvalidationEngine);
});