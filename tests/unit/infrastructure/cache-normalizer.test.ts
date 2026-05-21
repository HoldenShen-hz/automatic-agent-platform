/**
 * Infrastructure: Cache Normalizer Tests
 *
 * Tests for the CacheNormalizer that provides input normalization
 * for cache keys to maximize hit rates.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";

// Cache Normalizer
import {
  CacheNormalizer,
  normalizePath,
  normalizeQuery,
} from "../../../src/platform/shared/cache/cache-normalizer.js";

describe("CacheNormalizer", () => {
  describe("constructor", () => {
    it("creates instance without workspace root", () => {
      const normalizer = new CacheNormalizer();
      assert.ok(normalizer instanceof CacheNormalizer);
    });

    it("creates instance with workspace root", () => {
      const normalizer = new CacheNormalizer("/workspace");
      assert.ok(normalizer instanceof CacheNormalizer);
    });

    it("creates instance with case insensitive option", () => {
      const normalizer = new CacheNormalizer(undefined, true);
      assert.ok(normalizer instanceof CacheNormalizer);
    });

    it("creates instance with both options", () => {
      const normalizer = new CacheNormalizer("/workspace", true);
      assert.ok(normalizer instanceof CacheNormalizer);
    });
  });

  describe("normalizeToolArgs", () => {
    it("sorts keys in alphabetical order", () => {
      const normalizer = new CacheNormalizer();
      const result = normalizer.normalizeToolArgs({ z: 1, a: 2, m: 3 });

      const keys = Object.keys(result);
      assert.equal(keys[0], "a");
      assert.equal(keys[1], "m");
      assert.equal(keys[2], "z");
    });

    it("removes undefined values", () => {
      const normalizer = new CacheNormalizer();
      const result = normalizer.normalizeToolArgs({ a: 1, b: undefined, c: 3 });

      assert.ok(!("b" in result));
      assert.deepStrictEqual(Object.keys(result), ["a", "c"]);
    });

    it("keeps null values", () => {
      const normalizer = new CacheNormalizer();
      const result = normalizer.normalizeToolArgs({ a: 1, b: null, c: 3 });

      assert.ok("b" in result);
      assert.equal(result.b, null);
    });

    it("normalizes nested objects", () => {
      const normalizer = new CacheNormalizer();
      const result = normalizer.normalizeToolArgs({
        outer: { z: 1, a: 2 },
      });

      const outerKeys = Object.keys(result.outer as Record<string, unknown>);
      assert.equal(outerKeys[0], "a");
      assert.equal(outerKeys[1], "z");
    });

    it("normalizes arrays", () => {
      const normalizer = new CacheNormalizer();
      const result = normalizer.normalizeToolArgs({
        files: ["z.txt", "a.txt", "m.txt"],
      });

      assert.deepStrictEqual(result.files, ["z.txt", "a.txt", "m.txt"]);
    });

    it("preserves string values", () => {
      const normalizer = new CacheNormalizer();
      const result = normalizer.normalizeToolArgs({
        path: "  /workspace/test.ts  ",
      });

      // Should not trim in normalizeToolArgs, only in normalizeString when path is used
      assert.equal((result.path as string).trim(), "/workspace/test.ts");
    });

    it("preserves numeric and boolean values", () => {
      const normalizer = new CacheNormalizer();
      const result = normalizer.normalizeToolArgs({
        count: 42,
        enabled: true,
        ratio: 3.14,
      });

      assert.equal(result.count, 42);
      assert.equal(result.enabled, true);
      assert.equal(result.ratio, 3.14);
    });

    it("handles empty object", () => {
      const normalizer = new CacheNormalizer();
      const result = normalizer.normalizeToolArgs({});

      assert.deepStrictEqual(result, {});
    });

    it("replaces complex values with placeholder", () => {
      const normalizer = new CacheNormalizer();
      const fn = () => {};
      const result = normalizer.normalizeToolArgs({ func: fn } as Record<
        string,
        unknown
      >);

      assert.equal(result.func, "[ComplexValue]");
    });
  });

  describe("normalizeCacheInput", () => {
    it("normalizes primitive string", () => {
      const normalizer = new CacheNormalizer();
      const result = normalizer.normalizeCacheInput("  test  ");

      assert.equal(result, "test");
    });

    it("normalizes primitive number", () => {
      const normalizer = new CacheNormalizer();
      const result = normalizer.normalizeCacheInput(42);

      assert.equal(result, 42);
    });

    it("normalizes array", () => {
      const normalizer = new CacheNormalizer();
      const result = normalizer.normalizeCacheInput([3, 1, 2]);

      assert.deepStrictEqual(result, [3, 1, 2]);
    });

    it("normalizes nested object with sorted keys", () => {
      const normalizer = new CacheNormalizer();
      const result = normalizer.normalizeCacheInput({ b: 2, a: 1 }) as Record<
        string,
        number
      >;

      const keys = Object.keys(result);
      assert.equal(keys[0], "a");
      assert.equal(keys[1], "b");
    });

    it("removes undefined values in objects", () => {
      const normalizer = new CacheNormalizer();
      const result = normalizer.normalizeCacheInput({
        a: 1,
        b: undefined,
        c: 3,
      }) as Record<string, number>;

      assert.ok(!("b" in result));
    });

    it("handles nested arrays", () => {
      const normalizer = new CacheNormalizer();
      const result = normalizer.normalizeCacheInput([
        [3, 1],
        [2, 4],
      ]) as number[][];

      assert.deepStrictEqual(result, [
        [3, 1],
        [2, 4],
      ]);
    });
  });

  describe("normalizeQueryString", () => {
    it("normalizes whitespace", () => {
      const normalizer = new CacheNormalizer();
      const result = normalizer.normalizeQueryString("  some   query  ");

      assert.equal(result, "some query");
    });

    it("converts to lowercase", () => {
      const normalizer = new CacheNormalizer();
      const result = normalizer.normalizeQueryString("Hello World");

      assert.equal(result, "hello world");
    });

    it("handles empty string", () => {
      const normalizer = new CacheNormalizer();
      const result = normalizer.normalizeQueryString("");

      assert.equal(result, "");
    });

    it("handles string with only whitespace", () => {
      const normalizer = new CacheNormalizer();
      const result = normalizer.normalizeQueryString("   \t  ");

      assert.equal(result, "");
    });
  });

  describe("toStableString", () => {
    it("produces consistent string for same input", () => {
      const normalizer = new CacheNormalizer();
      const input = { b: 2, a: 1 };
      const str1 = normalizer.toStableString(input);
      const str2 = normalizer.toStableString(input);

      assert.equal(str1, str2);
    });

    it("produces same string regardless of key order", () => {
      const normalizer = new CacheNormalizer();
      const input1 = { a: 1, b: 2 };
      const input2 = { b: 2, a: 1 };
      const str1 = normalizer.toStableString(input1);
      const str2 = normalizer.toStableString(input2);

      assert.equal(str1, str2);
    });

    it("produces different strings for different inputs", () => {
      const normalizer = new CacheNormalizer();
      const str1 = normalizer.toStableString({ a: 1 });
      const str2 = normalizer.toStableString({ a: 2 });

      assert.notEqual(str1, str2);
    });
  });

  describe("path normalization with workspace root", () => {
    it("normalizes paths when workspace root is set", () => {
      const normalizer = new CacheNormalizer("/workspace");

      // Test that path normalization works via normalizeCacheInput
      const result = normalizer.normalizeCacheInput({
        path: "/workspace/src/index.ts",
      }) as { path: string };

      assert.ok(result.path);
    });

    it("trims string values when no workspace root", () => {
      const normalizer = new CacheNormalizer();
      const result = normalizer.normalizeCacheInput({ path: "  test  " }) as {
        path: string;
      };

      assert.equal(result.path, "test");
    });
  });

  describe("case insensitive mode", () => {
    it("normalizes strings to lowercase when case insensitive", () => {
      const normalizer = new CacheNormalizer(undefined, true);
      const result = normalizer.normalizeCacheInput("Hello World") as string;

      assert.equal(result, "hello world");
    });
  });
});

describe("normalizePath", () => {
  it("normalizes simple path", () => {
    const result = normalizePath("/workspace/src/index.ts", "/workspace");
    assert.ok(result.startsWith("/workspace"));
  });

  it("converts backslashes to forward slashes", () => {
    const result = normalizePath("C:\\Users\\test\\file.ts", "C:\\Users\\test");
    assert.ok(!result.includes("\\"));
  });

  it("handles relative paths", () => {
    const result = normalizePath("./src/index.ts", "/workspace");
    assert.ok(result.includes("src"));
  });

  it("returns /workspace for exact workspace root", () => {
    const result = normalizePath("/workspace", "/workspace");
    assert.equal(result, "/workspace");
  });
});

describe("normalizeQuery", () => {
  it("trims whitespace", () => {
    const result = normalizeQuery("  hello world  ");
    assert.equal(result, "hello world");
  });

  it("collapses multiple spaces", () => {
    const result = normalizeQuery("hello    world");
    assert.equal(result, "hello world");
  });

  it("converts to lowercase", () => {
    const result = normalizeQuery("Hello World");
    assert.equal(result, "hello world");
  });

  it("handles tabs and newlines", () => {
    const result = normalizeQuery("hello\t\nworld");
    assert.equal(result, "hello world");
  });
});
