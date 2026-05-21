/**
 * Infrastructure: Stable Hash Tests
 *
 * Tests for the stable hash utility that creates deterministic
 * SHA-256 hashes of serializable values.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

// Stable Hash
import { stableHash, shortHash, buildCacheKey } from "../../../src/platform/shared/cache/utils/stable-hash.js";

describe("stableHash", () => {
  it("produces a 64-character hex string (SHA-256)", () => {
    const hash = stableHash("test");
    assert.equal(hash.length, 64);
    assert.ok(/^[a-f0-9]+$/.test(hash));
  });

  it("produces same hash for same input", () => {
    const hash1 = stableHash({ a: 1, b: 2 });
    const hash2 = stableHash({ a: 1, b: 2 });
    assert.equal(hash1, hash2);
  });

  it("produces different hashes for different inputs", () => {
    const hash1 = stableHash({ a: 1 });
    const hash2 = stableHash({ a: 2 });
    assert.notEqual(hash1, hash2);
  });

  it("produces same hash regardless of key order", () => {
    const hash1 = stableHash({ a: 1, b: 2 });
    const hash2 = stableHash({ b: 2, a: 1 });
    assert.equal(hash1, hash2);
  });

  it("handles string input", () => {
    const hash = stableHash("hello world");
    assert.equal(hash.length, 64);
  });

  it("handles number input", () => {
    const hash = stableHash(42);
    assert.equal(hash.length, 64);
  });

  it("handles boolean input", () => {
    const hash = stableHash(true);
    assert.equal(hash.length, 64);
  });

  it("handles array input", () => {
    const hash = stableHash([1, 2, 3]);
    assert.equal(hash.length, 64);
  });

  it("handles nested objects", () => {
    const hash = stableHash({ outer: { inner: { deep: 42 } } });
    assert.equal(hash.length, 64);
  });

  it("handles empty object", () => {
    const hash = stableHash({});
    assert.equal(hash.length, 64);
  });

  it("handles empty string", () => {
    const hash = stableHash("");
    assert.equal(hash.length, 64);
  });

  it("is deterministic across calls", () => {
    const results = new Set<string>();
    for (let i = 0; i < 10; i++) {
      results.add(stableHash({ test: "value" }));
    }
    assert.equal(results.size, 1);
  });
});

describe("shortHash", () => {
  it("returns first 16 characters of stable hash", () => {
    const full = stableHash("test");
    const short = shortHash("test");
    assert.equal(short.length, 16);
    assert.equal(short, full.slice(0, 16));
  });

  it("produces same short hash for same input", () => {
    const hash1 = shortHash({ a: 1, b: 2 });
    const hash2 = shortHash({ a: 1, b: 2 });
    assert.equal(hash1, hash2);
  });

  it("produces different short hashes for different inputs", () => {
    const hash1 = shortHash({ a: 1 });
    const hash2 = shortHash({ a: 2 });
    assert.notEqual(hash1, hash2);
  });

  it("is consistent with stableHash", () => {
    const input = { path: "/workspace/test.ts" };
    const shortFromFull = stableHash(input).slice(0, 16);
    const short = shortHash(input);
    assert.equal(short, shortFromFull);
  });
});

describe("buildCacheKey", () => {
  it("creates a key with namespace version and hash", () => {
    const key = buildCacheKey("tool.read", "v1", { path: "/test.ts" });
    assert.ok(key.startsWith("tool.read:v1:"));
  });

  it("creates different keys for different inputs", () => {
    const key1 = buildCacheKey("tool.read", "v1", { path: "/a.ts" });
    const key2 = buildCacheKey("tool.read", "v1", { path: "/b.ts" });
    assert.notEqual(key1, key2);
  });

  it("creates same key for identical inputs", () => {
    const input = { path: "/workspace/src/index.ts" };
    const key1 = buildCacheKey("tool.read", "v1", input);
    const key2 = buildCacheKey("tool.read", "v1", input);
    assert.equal(key1, key2);
  });

  it("creates different keys for different namespaces", () => {
    const input = { path: "/workspace/src/index.ts" };
    const key1 = buildCacheKey("tool.read", "v1", input);
    const key2 = buildCacheKey("tool.glob", "v1", input);
    assert.notEqual(key1, key2);
  });

  it("creates different keys for different versions", () => {
    const input = { path: "/workspace/src/index.ts" };
    const key1 = buildCacheKey("tool.read", "v1", input);
    const key2 = buildCacheKey("tool.read", "v2", input);
    assert.notEqual(key1, key2);
  });

  it("handles complex nested input", () => {
    const input = {
      path: "/workspace",
      options: {
        recursive: true,
        include: ["*.ts", "*.js"],
      },
    };
    const key = buildCacheKey("tool.glob", "v1", input);
    assert.ok(key.startsWith("tool.glob:v1:"));
    assert.ok(key.length > "tool.glob:v1:".length);
  });
});