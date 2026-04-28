/**
 * Unit tests for CacheInvalidationEngine
 *
 * Tests centralized cache invalidation logic triggered by
 * file changes, session close, instruction updates, etc.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { CacheInvalidationEngine } from "../../../../../src/platform/shared/cache/cache-invalidation.js";

// Mock CacheFacade for testing the invalidation engine
class MockCacheFacade {
  public invalidations: Array<{ type: "tag" | "namespace"; value: string; count: number }> = [];

  async invalidateByTag(tag: string): Promise<number> {
    this.invalidations.push({ type: "tag", value: tag, count: 1 });
    return 1;
  }

  async invalidateNamespace(namespace: string): Promise<number> {
    this.invalidations.push({ type: "namespace", value: namespace, count: 1 });
    return 1;
  }
}

// ---------------------------------------------------------------------------
// onFileChanged
// ---------------------------------------------------------------------------

test("onFileChanged invalidates file tag", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache);

  await engine.onFileChanged("/path/to/file.ts");

  assert.strictEqual(mockCache.invalidations.length, 1);
  assert.strictEqual(mockCache.invalidations[0]!.type, "tag");
  assert.strictEqual(mockCache.invalidations[0]!.value, "file:/path/to/file.ts");
});

test("onFileChanged handles normalized paths", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache);

  await engine.onFileChanged("relative/path.ts");

  assert.strictEqual(mockCache.invalidations[0]!.value, "file:relative/path.ts");
});

// ---------------------------------------------------------------------------
// onSessionClosed
// ---------------------------------------------------------------------------

test("onSessionClosed invalidates session tag", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache);

  await engine.onSessionClosed("session-abc-123");

  assert.strictEqual(mockCache.invalidations.length, 1);
  assert.strictEqual(mockCache.invalidations[0]!.type, "tag");
  assert.strictEqual(mockCache.invalidations[0]!.value, "session:session-abc-123");
});

test("onSessionClosed handles UUID-style session IDs", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache);

  const uuidSession = "550e8400-e29b-41d4-a716-446655440000";
  await engine.onSessionClosed(uuidSession);

  assert.strictEqual(mockCache.invalidations[0]!.value, `session:${uuidSession}`);
});

// ---------------------------------------------------------------------------
// onInstructionChanged
// ---------------------------------------------------------------------------

test("onInstructionChanged invalidates instruction tag", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache);

  await engine.onInstructionChanged("sha256:fingerprint");

  assert.strictEqual(mockCache.invalidations[0]!.value, "instruction:sha256:fingerprint");
});

test("onInstructionChanged handles empty fingerprint", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache);

  await engine.onInstructionChanged("");

  assert.strictEqual(mockCache.invalidations[0]!.value, "instruction:");
});

// ---------------------------------------------------------------------------
// onRepoRebuilt
// ---------------------------------------------------------------------------

test("onRepoRebuilt invalidates repo tag", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache);

  await engine.onRepoRebuilt("github/owner/repo");

  assert.strictEqual(mockCache.invalidations[0]!.value, "repo:github/owner/repo");
});

test("onRepoRebuilt handles simple repo names", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache);

  await engine.onRepoRebuilt("my-project");

  assert.strictEqual(mockCache.invalidations[0]!.value, "repo:my-project");
});

// ---------------------------------------------------------------------------
// onToolUpdated
// ---------------------------------------------------------------------------

test("onToolUpdated invalidates tool tag", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache);

  await engine.onToolUpdated("read");

  assert.strictEqual(mockCache.invalidations[0]!.value, "tool:read");
});

test("onToolUpdated handles fully qualified tool names", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache);

  await engine.onToolUpdated("@org/package/read");

  assert.strictEqual(mockCache.invalidations[0]!.value, "tool:@org/package/read");
});

// ---------------------------------------------------------------------------
// invalidateNamespace
// ---------------------------------------------------------------------------

test("invalidateNamespace calls cache facade with namespace", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache);

  await engine.invalidateNamespace("planner");

  assert.strictEqual(mockCache.invalidations.length, 1);
  assert.strictEqual(mockCache.invalidations[0]!.type, "namespace");
  assert.strictEqual(mockCache.invalidations[0]!.value, "planner");
});

test("invalidateNamespace handles empty namespace", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache);

  await engine.invalidateNamespace("");

  assert.strictEqual(mockCache.invalidations[0]!.value, "");
});

// ---------------------------------------------------------------------------
// invalidateTags - bulk invalidation
// ---------------------------------------------------------------------------

test("invalidateTags invalidates multiple tags", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache);

  const count = await engine.invalidateTags(["tag1", "tag2", "tag3"]);

  assert.strictEqual(count, 3);
  assert.strictEqual(mockCache.invalidations.length, 3);
  assert.strictEqual(mockCache.invalidations[0]!.value, "tag1");
  assert.strictEqual(mockCache.invalidations[1]!.value, "tag2");
  assert.strictEqual(mockCache.invalidations[2]!.value, "tag3");
});

test("invalidateTags handles empty array", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache);

  const count = await engine.invalidateTags([]);

  assert.strictEqual(count, 0);
  assert.strictEqual(mockCache.invalidations.length, 0);
});

test("invalidateTags accumulates counts from each invalidation", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache);

  // Mock returns 2 for each tag
  mockCache.invalidateByTag = async () => 2;

  const count = await engine.invalidateTags(["tag1", "tag2"]);

  assert.strictEqual(count, 4); // 2 + 2
});

test("invalidateTags with large number of tags", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache);

  const tags = Array.from({ length: 100 }, (_, i) => `tag${i}`);
  const count = await engine.invalidateTags(tags);

  assert.strictEqual(count, 100);
  assert.strictEqual(mockCache.invalidations.length, 100);
});

// ---------------------------------------------------------------------------
// Edge Cases
// ---------------------------------------------------------------------------

test("engine handles rapid sequential invalidations", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache);

  await engine.onFileChanged("/path/file1.ts");
  await engine.onFileChanged("/path/file2.ts");
  await engine.onSessionClosed("session1");
  await engine.onToolUpdated("read");

  assert.strictEqual(mockCache.invalidations.length, 4);
});

test("engine produces correct tag format for different entity types", async () => {
  const mockCache = new MockCacheFacade();
  const engine = new CacheInvalidationEngine(mockCache);

  await engine.onFileChanged("/a/b/c.ts");
  await engine.onSessionClosed("s1");
  await engine.onInstructionChanged("fp");
  await engine.onRepoRebuilt("r1");
  await engine.onToolUpdated("t1");

  const tags = mockCache.invalidations.filter((i) => i.type === "tag").map((i) => i.value);

  assert.ok(tags.includes("file:/a/b/c.ts"));
  assert.ok(tags.includes("session:s1"));
  assert.ok(tags.includes("instruction:fp"));
  assert.ok(tags.includes("repo:r1"));
  assert.ok(tags.includes("tool:t1"));
});