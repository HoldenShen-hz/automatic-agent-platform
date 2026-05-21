/**
 * Infrastructure: Cache Invalidation Tests
 *
 * Tests for the CacheInvalidationEngine that provides centralized
 * cache invalidation logic triggered by file changes, session close, etc.
 */

import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";

// Cache Invalidation Engine
import { CacheInvalidationEngine } from "../../../src/platform/shared/cache/cache-invalidation.js";

// Mock CacheFacade
class MockCacheFacade {
  invalidations = new Map<string, number>();

  async invalidateByTag(tag: string): Promise<number> {
    return this.invalidations.get(tag) ?? 0;
  }

  async invalidateNamespace(namespace: string): Promise<number> {
    return this.invalidations.get(`namespace:${namespace}`) ?? 0;
  }

  setInvalidation(tag: string, count: number) {
    this.invalidations.set(tag, count);
  }
}

describe("CacheInvalidationEngine", () => {
  let cache: MockCacheFacade;
  let engine: CacheInvalidationEngine;

  beforeEach(() => {
    cache = new MockCacheFacade();
    engine = new CacheInvalidationEngine(cache);
  });

  describe("onFileChanged", () => {
    it("invalidates cache entries for file path", async () => {
      cache.setInvalidation("file:/workspace/src/index.ts", 5);

      const count = await engine.onFileChanged("/workspace/src/index.ts");

      assert.equal(count, 5);
    });

    it("calls invalidateByTag with file prefix", async () => {
      let capturedTag: string | undefined;
      const customCache = new MockCacheFacade();
      customCache.invalidateByTag = async (tag: string) => {
        capturedTag = tag;
        return 0;
      };

      const customEngine = new CacheInvalidationEngine(customCache as unknown as import("../../../src/platform/shared/cache/cache-facade.js").CacheFacade);
      await customEngine.onFileChanged("/workspace/src/app.ts");

      assert.equal(capturedTag, "file:/workspace/src/app.ts");
    });

    it("handles normalized paths", async () => {
      const normalizedPath = "/workspace/src/components/Button.tsx";
      cache.setInvalidation(`file:${normalizedPath}`, 3);

      const count = await engine.onFileChanged(normalizedPath);

      assert.equal(count, 3);
    });
  });

  describe("onSessionClosed", () => {
    it("invalidates cache entries for session", async () => {
      cache.setInvalidation("session:session-123", 10);

      const count = await engine.onSessionClosed("session-123");

      assert.equal(count, 10);
    });

    it("calls invalidateByTag with session prefix", async () => {
      let capturedTag: string | undefined;
      const customCache = new MockCacheFacade();
      customCache.invalidateByTag = async (tag: string) => {
        capturedTag = tag;
        return 0;
      };

      const customEngine = new CacheInvalidationEngine(customCache as unknown as import("../../../src/platform/shared/cache/cache-facade.js").CacheFacade);
      await customEngine.onSessionClosed("my-session-id");

      assert.equal(capturedTag, "session:my-session-id");
    });
  });

  describe("onInstructionChanged", () => {
    it("invalidates cache entries for instruction fingerprint", async () => {
      const fingerprint = "abc123def456";
      cache.setInvalidation(`instruction:${fingerprint}`, 7);

      const count = await engine.onInstructionChanged(fingerprint);

      assert.equal(count, 7);
    });

    it("calls invalidateByTag with instruction prefix", async () => {
      let capturedTag: string | undefined;
      const customCache = new MockCacheFacade();
      customCache.invalidateByTag = async (tag: string) => {
        capturedTag = tag;
        return 0;
      };

      const customEngine = new CacheInvalidationEngine(customCache as unknown as import("../../../src/platform/shared/cache/cache-facade.js").CacheFacade);
      await customEngine.onInstructionChanged("instr-fingerprint");

      assert.equal(capturedTag, "instruction:instr-fingerprint");
    });
  });

  describe("onRepoRebuilt", () => {
    it("invalidates cache entries for repo", async () => {
      const repoId = "my-repo-001";
      cache.setInvalidation(`repo:${repoId}`, 25);

      const count = await engine.onRepoRebuilt(repoId);

      assert.equal(count, 25);
    });

    it("calls invalidateByTag with repo prefix", async () => {
      let capturedTag: string | undefined;
      const customCache = new MockCacheFacade();
      customCache.invalidateByTag = async (tag: string) => {
        capturedTag = tag;
        return 0;
      };

      const customEngine = new CacheInvalidationEngine(customCache as unknown as import("../../../src/platform/shared/cache/cache-facade.js").CacheFacade);
      await customEngine.onRepoRebuilt("repo-id");

      assert.equal(capturedTag, "repo:repo-id");
    });
  });

  describe("onToolUpdated", () => {
    it("invalidates cache entries for tool", async () => {
      const toolName = "read";
      cache.setInvalidation(`tool:${toolName}`, 15);

      const count = await engine.onToolUpdated(toolName);

      assert.equal(count, 15);
    });

    it("calls invalidateByTag with tool prefix", async () => {
      let capturedTag: string | undefined;
      const customCache = new MockCacheFacade();
      customCache.invalidateByTag = async (tag: string) => {
        capturedTag = tag;
        return 0;
      };

      const customEngine = new CacheInvalidationEngine(customCache as unknown as import("../../../src/platform/shared/cache/cache-facade.js").CacheFacade);
      await customEngine.onToolUpdated("grep");

      assert.equal(capturedTag, "tool:grep");
    });
  });

  describe("invalidateNamespace", () => {
    it("invalidates all entries in a namespace", async () => {
      cache.setInvalidation("namespace:tool.read", 20);

      const count = await engine.invalidateNamespace("tool.read");

      assert.equal(count, 20);
    });

    it("delegates to cache.invalidateNamespace", async () => {
      let capturedNamespace: string | undefined;
      const customCache = new MockCacheFacade();
      customCache.invalidateNamespace = async (namespace: string) => {
        capturedNamespace = namespace;
        return 0;
      };

      const customEngine = new CacheInvalidationEngine(customCache as unknown as import("../../../src/platform/shared/cache/cache-facade.js").CacheFacade);
      await customEngine.invalidateNamespace("tool.glob");

      assert.equal(capturedNamespace, "tool.glob");
    });
  });

  describe("invalidateTags", () => {
    it("invalidates multiple tags and sums results", async () => {
      cache.setInvalidation("file:/workspace/a.ts", 2);
      cache.setInvalidation("file:/workspace/b.ts", 3);
      cache.setInvalidation("session:123", 5);

      const count = await engine.invalidateTags([
        "file:/workspace/a.ts",
        "file:/workspace/b.ts",
        "session:123",
      ]);

      assert.equal(count, 10);
    });

    it("handles empty tag array", async () => {
      const count = await engine.invalidateTags([]);

      assert.equal(count, 0);
    });

    it("handles tags with zero invalidations", async () => {
      const count = await engine.invalidateTags([
        "file:/workspace/nonexistent.ts",
        "session:no-such-session",
      ]);

      assert.equal(count, 0);
    });

    it("accumulates count even when some tags have no invalidations", async () => {
      cache.setInvalidation("tool:read", 5);

      const count = await engine.invalidateTags([
        "tool:read",
        "tool:nonexistent",
      ]);

      assert.equal(count, 5);
    });
  });
});