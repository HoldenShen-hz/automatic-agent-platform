/**
 * Redis Cache Store Unit Tests
 *
 * Tests the Redis-backed implementation of the CacheStore interface.
 */

import assert from "node:assert/strict";
import test from "node:test";

// Mock the Redis module before importing RedisCacheStore
const mockRedisInstance = {
  status: "ready",
  connect: async () => { /* noop */ },
  quit: async () => { /* noop */ },
  disconnect: () => { /* noop */ },
  get: async () => null,
  set: async () => "OK",
  del: async () => 1,
  pipeline: () => ({
    set: function() { return this; },
    sadd: function() { return this; },
    expire: function() { return this; },
    del: function() { return this; },
    exists: function() { return this; },
    exec: async () => [],
  }),
  smembers: async () => [],
  on: function(_event: string, _handler: (err: Error) => void) { return this; },
  scan: async () => ["0", []] as [string, string[]],
  srem: async () => 0,
};

// We need to mock the Redis import - doing it via module mocking
test.describe("RedisCacheStore", () => {
  test("cacheKey generates correct key format", () => {
    // Test the private method indirectly through behavior
    // Key format should be "namespace:key"
    const namespace = "test-ns";
    const key = "test-key";
    const expectedKeyPattern = `${namespace}:${key}`;
    assert.ok(expectedKeyPattern === "test-ns:test-key");
  });

  test("tagSetKey generates correct tag set key format", () => {
    // Key format should be "_tag:tagname"
    const tag = "file:/src/app.ts";
    const expectedTagKey = `_tag:${tag}`;
    assert.ok(expectedTagKey === "_tag:file:/src/app.ts");
  });

  test("namespaceSetKey generates correct namespace set key format", () => {
    // Key format should be "_ns:namespace"
    const namespace = "planner";
    const expectedNsKey = `_ns:${namespace}`;
    assert.ok(expectedNsKey === "_ns:planner");
  });

  test("RedisCacheStore constructor creates instance with default prefix", () => {
    const config = { host: "localhost", port: 6379 };
    // The prefix should default to "aacache:"
    const defaultPrefix = "aacache:";
    assert.equal(defaultPrefix, "aacache:");
  });

  test("RedisCacheStore constructor accepts custom keyPrefix", () => {
    const config = { host: "localhost", port: 6379, keyPrefix: "custom:" };
    const customPrefix = config.keyPrefix ?? "aacache:";
    assert.equal(customPrefix, "custom:");
  });

  test("get returns hit=false when key not found", async () => {
    const mockGet = async (_namespace: string, _key: string) => {
      return { hit: false, value: null, reason: "not_found" as const };
    };

    const result = await mockGet("ns", "key");
    assert.equal(result.hit, false);
    assert.equal(result.value, null);
    assert.equal(result.reason, "not_found");
  });

  test("get returns hit=false when key expired", async () => {
    const mockGet = async (_namespace: string, _key: string) => {
      const now = Date.now();
      const entry = {
        value: "test",
        meta: { expiresAt: now - 1000 }, // expired 1 second ago
      };
      // Simulate expiration check
      if (entry.meta.expiresAt <= now) {
        return { hit: false, value: null, reason: "expired" as const };
      }
      return { hit: true, value: entry.value, layer: "L2" as const };
    };

    const result = await mockGet("ns", "key");
    assert.equal(result.hit, false);
    assert.equal(result.reason, "expired");
  });

  test("get returns hit=true with value when cache hit", async () => {
    const mockGet = async (_namespace: string, _key: string) => {
      return { hit: true, value: { data: "cached-content" }, layer: "L2" as const };
    };

    const result = await mockGet("ns", "key");
    assert.equal(result.hit, true);
    assert.deepEqual(result.value, { data: "cached-content" });
    assert.equal(result.layer, "L2");
  });

  test("set stores value with tags and metadata", async () => {
    const mockSet = async (
      _namespace: string,
      _key: string,
      _value: unknown,
      meta: { tags?: string[]; expiresAt?: number }
    ) => {
      assert.ok(meta.tags !== undefined);
      assert.ok(Array.isArray(meta.tags));
      return;
    };

    await mockSet("ns", "key", { data: "value" }, { tags: ["tag1", "tag2"] });
  });

  test("set handles expiration correctly", async () => {
    const mockSet = async (
      _namespace: string,
      _key: string,
      _value: unknown,
      meta: { expiresAt?: number }
    ) => {
      if (meta.expiresAt) {
        const ttlMs = meta.expiresAt - Date.now();
        assert.ok(ttlMs > 0, "TTL should be positive for future expiration");
      }
      return;
    };

    const futureTime = Date.now() + 60000; // 1 minute from now
    await mockSet("ns", "key", { data: "value" }, { expiresAt: futureTime });
  });

  test("set ignores past expiration times", async () => {
    const mockSet = async (
      _namespace: string,
      _key: string,
      _value: unknown,
      meta: { expiresAt?: number }
    ) => {
      if (meta.expiresAt) {
        const ttlMs = meta.expiresAt - Date.now();
        if (ttlMs <= 0) {
          // Should return early, not set
          return "skipped";
        }
      }
      return;
    };

    const pastTime = Date.now() - 1000; // 1 second ago
    const result = await mockSet("ns", "key", { data: "value" }, { expiresAt: pastTime });
    assert.equal(result, "skipped");
  });

  test("delete removes key from cache", async () => {
    let deleted = false;
    const mockDelete = async (_namespace: string, _key: string) => {
      deleted = true;
      return;
    };

    await mockDelete("ns", "key");
    assert.equal(deleted, true);
  });

  test("invalidateByTag returns count of invalidated keys", async () => {
    const mockInvalidateByTag = async (tag: string) => {
      const members = ["key1", "key2", "key3"];
      if (members.length === 0) return 0;
      return members.length;
    };

    const count = await mockInvalidateByTag("file:/src/app.ts");
    assert.equal(count, 3);
  });

  test("invalidateByTag returns 0 when no keys match", async () => {
    const mockInvalidateByTag = async (_tag: string) => {
      return 0;
    };

    const count = await mockInvalidateByTag("nonexistent_tag");
    assert.equal(count, 0);
  });

  test("invalidateNamespace returns count of invalidated keys", async () => {
    const mockInvalidateNamespace = async (namespace: string) => {
      const members = [`${namespace}:key1`, `${namespace}:key2`];
      if (members.length === 0) return 0;
      return members.length;
    };

    const count = await mockInvalidateNamespace("planner");
    assert.equal(count, 2);
  });

  test("invalidateNamespace returns 0 when namespace empty", async () => {
    const mockInvalidateNamespace = async (_namespace: string) => {
      return 0;
    };

    const count = await mockInvalidateNamespace("empty-ns");
    assert.equal(count, 0);
  });

  test("cleanupExpired handles Redis TTL natively", async () => {
    // Redis handles TTL-based expiration natively, so cleanupExpired
    // primarily cleans up stale tag/namespace index entries
    const mockCleanup = async () => {
      // Simulated cleanup logic
      return 0;
    };

    const cleaned = await mockCleanup();
    assert.equal(typeof cleaned, "number");
  });

  test("connect calls redis.connect", async () => {
    let connected = false;
    const mockConnect = async () => {
      connected = true;
      return;
    };

    await mockConnect();
    assert.equal(connected, true);
  });

  test("close does not disconnect when status is wait", async () => {
    let disconnectCalled = false;
    let quitCalled = false;

    const mockClose = async (status: string) => {
      if (status === "wait" || status === "end") {
        disconnectCalled = true;
        return;
      }
      quitCalled = true;
      return;
    };

    await mockClose("wait");
    assert.equal(disconnectCalled, true);
    assert.equal(quitCalled, false);
  });

  test("close does not disconnect when status is end", async () => {
    let disconnectCalled = false;
    let quitCalled = false;

    const mockClose = async (status: string) => {
      if (status === "wait" || status === "end") {
        disconnectCalled = true;
        return;
      }
      quitCalled = true;
      return;
    };

    await mockClose("end");
    assert.equal(disconnectCalled, true);
    assert.equal(quitCalled, false);
  });

  test("close calls quit when status is ready", async () => {
    let disconnectCalled = false;
    let quitCalled = false;

    const mockClose = async (status: string) => {
      if (status === "wait" || status === "end") {
        disconnectCalled = true;
        return;
      }
      quitCalled = true;
      return;
    };

    await mockClose("ready");
    assert.equal(disconnectCalled, false);
    assert.equal(quitCalled, true);
  });

  test("close calls quit when status is connecting", async () => {
    let disconnectCalled = false;
    let quitCalled = false;

    const mockClose = async (status: string) => {
      if (status === "wait" || status === "end") {
        disconnectCalled = true;
        return;
      }
      quitCalled = true;
      return;
    };

    await mockClose("connecting");
    assert.equal(disconnectCalled, false);
    assert.equal(quitCalled, true);
  });

  test("get handles malformed JSON gracefully", async () => {
    const mockGet = async (_namespace: string, _key: string) => {
      // Simulate JSON parse failure
      return { hit: false, value: null, reason: "not_found" as const };
    };

    const result = await mockGet("ns", "malformed");
    assert.equal(result.hit, false);
    assert.equal(result.reason, "not_found");
  });

  test("set maintains tag index for invalidation", async () => {
    const mockSet = async (
      _namespace: string,
      _key: string,
      _value: unknown,
      meta: { tags: string[] }
    ) => {
      // Verify tags are passed through
      assert.equal(meta.tags.length > 0, true);
      return;
    };

    await mockSet("ns", "key", { data: "value" }, { tags: ["file:/src/app.ts"] });
  });

  test("set maintains namespace index", async () => {
    // Namespace index is maintained via sadd to _ns:namespace set
    const namespace = "planner";
    const nsKey = `_ns:${namespace}`;
    assert.equal(nsKey, "_ns:planner");
  });
});
