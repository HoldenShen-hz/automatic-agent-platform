/**
 * Unit tests for CacheInvalidationEngine - covers all invalidation methods
 */

import assert from "node:assert/strict";
import test from "node:test";
import { CacheInvalidationEngine } from "../../../../../src/platform/shared/cache/cache-invalidation.js";

class MockCacheFacade {
  public invalidations: string[] = [];
  public namespaceInvalidations: string[] = [];

  async invalidateByTag(tag: string): Promise<number> {
    this.invalidations.push(tag);
    return 1;
  }

  async invalidateNamespace(namespace: string): Promise<number> {
    this.namespaceInvalidations.push(namespace);
    return 1;
  }
}

test("CacheInvalidationEngine.onFileChanged invalidates file tag", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache as any);

  await engine.onFileChanged("/path/to/file.ts");

  assert.deepEqual(mockCache.invalidations, ["file:/path/to/file.ts"]);
});

test("CacheInvalidationEngine.onSessionClosed invalidates session tag", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache as any);

  await engine.onSessionClosed("session123");

  assert.deepEqual(mockCache.invalidations, ["session:session123"]);
});

test("CacheInvalidationEngine.onInstructionChanged invalidates instruction tag", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache as any);

  await engine.onInstructionChanged("sha256:fingerprint");

  assert.deepEqual(mockCache.invalidations, ["instruction:sha256:fingerprint"]);
});

test("CacheInvalidationEngine.onRepoRebuilt invalidates repo tag", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache as any);

  await engine.onRepoRebuilt("github/owner/repo");

  assert.deepEqual(mockCache.invalidations, ["repo:github/owner/repo"]);
});

test("CacheInvalidationEngine.onToolUpdated invalidates tool tag", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache as any);

  await engine.onToolUpdated("read");

  assert.deepEqual(mockCache.invalidations, ["tool:read"]);
});

test("CacheInvalidationEngine.invalidateNamespace calls cache facade", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache as any);

  await engine.invalidateNamespace("planner");

  assert.deepEqual(mockCache.namespaceInvalidations, ["planner"]);
});

test("CacheInvalidationEngine.invalidateTags invalidates multiple tags", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache as any);

  await engine.invalidateTags(["tag1", "tag2", "tag3"]);

  assert.deepEqual(mockCache.invalidations, ["tag1", "tag2", "tag3"]);
});

test("CacheInvalidationEngine.invalidateTags with empty array returns 0", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache as any);

  const count = await engine.invalidateTags([]);

  assert.equal(count, 0);
  assert.deepEqual(mockCache.invalidations, []);
});

test("CacheInvalidationEngine handles relative file paths", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache as any);

  await engine.onFileChanged("relative/path.ts");

  assert.deepEqual(mockCache.invalidations, ["file:relative/path.ts"]);
});

test("CacheInvalidationEngine handles empty session ID", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache as any);

  await engine.onSessionClosed("");

  assert.deepEqual(mockCache.invalidations, ["session:"]);
});

test("CacheInvalidationEngine accumulates counts from invalidateTags", async () => {
  const mockCache = new MockCacheFacade();
  mockCache.invalidateByTag = async () => 2;
  const engine = new CacheInvalidationEngine(mockCache as any);

  const count = await engine.invalidateTags(["tag1", "tag2"]);

  assert.equal(count, 4);
});

test("CacheInvalidationEngine works with large number of tags", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache as any);

  const tags = Array.from({ length: 100 }, (_, i) => `tag${i}`);
  await engine.invalidateTags(tags);

  assert.equal(mockCache.invalidations.length, 100);
});