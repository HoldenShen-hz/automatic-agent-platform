/**
 * Infrastructure: Cache Key Factory Tests
 *
 * Tests for the CacheKeyFactory that creates deterministic cache keys
 * from namespace, version, and normalized input using stable hashing.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";

// Cache Key Factory
import { CacheKeyFactory } from "../../../src/platform/shared/cache/cache-key-factory.js";

describe("CacheKeyFactory", () => {
  describe("create", () => {
    it("creates a key with namespace version and fingerprint", () => {
      const input = { path: "/workspace/src/index.ts", line: 1 };
      const key = CacheKeyFactory.create("tool.read", "v1", input);

      assert.ok(key.startsWith("tool.read:v1:"));
      assert.ok(key.length > "tool.read:v1:".length);
    });

    it("creates different keys for different inputs", () => {
      const key1 = CacheKeyFactory.create("tool.read", "v1", { path: "/a.ts" });
      const key2 = CacheKeyFactory.create("tool.read", "v1", { path: "/b.ts" });

      assert.notEqual(key1, key2);
    });

    it("creates same key for identical inputs", () => {
      const input = { path: "/workspace/src/index.ts", line: 1 };
      const key1 = CacheKeyFactory.create("tool.read", "v1", input);
      const key2 = CacheKeyFactory.create("tool.read", "v1", input);

      assert.equal(key1, key2);
    });

    it("creates different keys for different namespaces", () => {
      const input = { path: "/workspace/src/index.ts" };
      const key1 = CacheKeyFactory.create("tool.read", "v1", input);
      const key2 = CacheKeyFactory.create("tool.glob", "v1", input);

      assert.notEqual(key1, key2);
    });

    it("creates different keys for different versions", () => {
      const input = { path: "/workspace/src/index.ts" };
      const key1 = CacheKeyFactory.create("tool.read", "v1", input);
      const key2 = CacheKeyFactory.create("tool.read", "v2", input);

      assert.notEqual(key1, key2);
    });

    it("handles complex nested objects as input", () => {
      const input = {
        path: "/workspace/src",
        options: {
          recursive: true,
          maxDepth: 10,
          include: ["*.ts", "*.js"],
        },
      };
      const key = CacheKeyFactory.create("tool.glob", "v1", input);

      assert.ok(key.includes("tool.glob:v1:"));
      assert.ok(key.length > 30);
    });

    it("handles array inputs", () => {
      const key = CacheKeyFactory.create("tool.read", "v1", [
        "file1.ts",
        "file2.ts",
      ]);

      assert.ok(key.startsWith("tool.read:v1:"));
    });

    it("handles string inputs", () => {
      const key = CacheKeyFactory.create(
        "planner.plan",
        "v1",
        "find and fix bug",
      );

      assert.ok(key.startsWith("planner.plan:v1:"));
    });

    it("handles empty object input", () => {
      const key = CacheKeyFactory.create("tool.read", "v1", {});

      assert.ok(key.startsWith("tool.read:v1:"));
    });
  });

  describe("getFingerprint", () => {
    it("extracts fingerprint from valid key", () => {
      const input = { path: "/workspace/src/index.ts" };
      const key = CacheKeyFactory.create("tool.read", "v1", input);
      const fingerprint = CacheKeyFactory.getFingerprint(key);

      assert.ok(fingerprint != null);
      assert.ok(fingerprint.length > 0);
      assert.ok(!fingerprint.includes(":"));
    });

    it("returns null for invalid keys with fewer than 3 parts", () => {
      assert.equal(CacheKeyFactory.getFingerprint("invalid"), null);
      assert.equal(CacheKeyFactory.getFingerprint("tool:v1"), null);
      assert.equal(CacheKeyFactory.getFingerprint(""), null);
    });

    it("handles keys with colons in fingerprint", () => {
      const key = "namespace:v1:a:b:c";
      const fingerprint = CacheKeyFactory.getFingerprint(key);

      assert.ok(fingerprint != null);
      // Fingerprint should contain everything after namespace:version:
      assert.ok(fingerprint.includes("a:b:c"));
    });
  });

  describe("getVersion", () => {
    it("extracts version from valid key", () => {
      const key = "tool.read:v1:abc123";
      const version = CacheKeyFactory.getVersion(key);

      assert.equal(version, "v1");
    });

    it("extracts multi-segment version", () => {
      const key = "tool.read:v1.2.3:abc123";
      const version = CacheKeyFactory.getVersion(key);

      assert.equal(version, "v1.2.3");
    });

    it("returns null for invalid keys", () => {
      assert.equal(CacheKeyFactory.getVersion("invalid"), null);
      assert.equal(CacheKeyFactory.getVersion("tool"), null);
    });

    it("returns null for empty string", () => {
      assert.equal(CacheKeyFactory.getVersion(""), null);
    });
  });

  describe("getNamespace", () => {
    it("extracts namespace from valid key", () => {
      const key = "tool.read:v1:abc123";
      const namespace = CacheKeyFactory.getNamespace(key);

      assert.equal(namespace, "tool.read");
    });

    it("extracts nested namespace", () => {
      const key = "planner.decomposition:v1:abc123";
      const namespace = CacheKeyFactory.getNamespace(key);

      assert.equal(namespace, "planner.decomposition");
    });

    it("returns empty string for key with no colon", () => {
      const namespace = CacheKeyFactory.getNamespace("noversion");

      assert.equal(namespace, "noversion");
    });

    it("returns empty string for empty input", () => {
      assert.equal(CacheKeyFactory.getNamespace(""), "");
    });
  });

  describe("parse", () => {
    it("parses a valid key into components", () => {
      const input = { path: "/workspace/src/index.ts" };
      const key = CacheKeyFactory.create("tool.read", "v1", input);
      const parsed = CacheKeyFactory.parse(key);

      assert.ok(parsed != null);
      assert.equal(parsed.namespace, "tool.read");
      assert.equal(parsed.version, "v1");
      assert.ok(parsed.fingerprint.length > 0);
    });

    it("returns null for invalid key format", () => {
      assert.equal(CacheKeyFactory.parse("invalid"), null);
      assert.equal(CacheKeyFactory.parse("tool"), null);
      assert.equal(CacheKeyFactory.parse("tool:v1"), null);
    });

    it("roundtrip: create then parse produces same components", () => {
      const original = { path: "/workspace/test.ts", line: 42 };
      const key = CacheKeyFactory.create("tool.read", "v1", original);
      const parsed = CacheKeyFactory.parse(key);

      assert.ok(parsed != null);
      assert.equal(parsed.namespace, "tool.read");
      assert.equal(parsed.version, "v1");

      // Verify fingerprint is consistent by recreating
      const recreatedKey = CacheKeyFactory.create(
        parsed.namespace,
        parsed.version,
        original,
      );
      assert.equal(key, recreatedKey);
    });

    it("handles namespace with dots and underscores", () => {
      const key = "my.namespace.v2:test_key:abc123";
      const parsed = CacheKeyFactory.parse(key);

      assert.ok(parsed != null);
      assert.equal(parsed.namespace, "my.namespace.v2");
      assert.equal(parsed.version, "test_key");
      assert.equal(parsed.fingerprint, "abc123");
    });
  });
});
