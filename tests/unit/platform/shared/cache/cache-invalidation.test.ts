import assert from "node:assert/strict";
import test from "node:test";

import { CacheInvalidationEngine } from "../../../../../src/platform/shared/cache/cache-invalidation.js";

class MockCacheFacade {
  invalidations: string[] = [];
  
  async invalidateByTag(tag: string): Promise<number> {
    this.invalidations.push(tag);
    return 1;
  }
  
  async invalidateNamespace(namespace: string): Promise<number> {
    this.invalidations.push(`namespace:${namespace}`);
    return 1;
  }
}

test("CacheInvalidationEngine.onFileChanged invalidates file tag", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache);
  
  await engine.onFileChanged("/path/to/file.ts");
  
  assert.deepEqual(mockCache.invalidations, ["file:/path/to/file.ts"]);
});

test("CacheInvalidationEngine.onSessionClosed invalidates session tag", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache);
  
  await engine.onSessionClosed("session123");
  
  assert.deepEqual(mockCache.invalidations, ["session:session123"]);
});

test("CacheInvalidationEngine.onInstructionChanged invalidates instruction tag", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache);
  
  await engine.onInstructionChanged("fingerprint123");
  
  assert.deepEqual(mockCache.invalidations, ["instruction:fingerprint123"]);
});

test("CacheInvalidationEngine.onRepoRebuilt invalidates repo tag", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache);
  
  await engine.onRepoRebuilt("repo456");
  
  assert.deepEqual(mockCache.invalidations, ["repo:repo456"]);
});

test("CacheInvalidationEngine.onToolUpdated invalidates tool tag", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache);
  
  await engine.onToolUpdated("myTool");
  
  assert.deepEqual(mockCache.invalidations, ["tool:myTool"]);
});

test("CacheInvalidationEngine.invalidateNamespace invalidates namespace", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache);
  
  await engine.invalidateNamespace("myNamespace");
  
  assert.deepEqual(mockCache.invalidations, ["namespace:myNamespace"]);
});

test("CacheInvalidationEngine.invalidateTags invalidates multiple tags", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache);
  
  await engine.invalidateTags(["tag1", "tag2", "tag3"]);
  
  assert.deepEqual(mockCache.invalidations, ["tag1", "tag2", "tag3"]);
});

test("CacheInvalidationEngine.invalidateTags handles empty array", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache);
  
  await engine.invalidateTags([]);
  
  assert.deepEqual(mockCache.invalidations, []);
});
