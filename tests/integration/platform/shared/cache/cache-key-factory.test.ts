/**
 * Cache Key Factory Integration Tests
 *
 * Tests deterministic cache key generation, fingerprint extraction,
 * and key parsing across various input types.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { CacheKeyFactory } from "../../../../../src/platform/shared/cache/cache-key-factory.js";
import { stableHash, shortHash, buildCacheKey } from "../../../../../src/platform/shared/cache/utils/stable-hash.js";

test("CacheKeyFactory.create generates consistent keys for equal inputs", () => {
  const input = { query: "test", page: 1 };

  const key1 = CacheKeyFactory.create("ns", "v1", input);
  const key2 = CacheKeyFactory.create("ns", "v1", input);

  assert.equal(key1, key2);
});

test("CacheKeyFactory.create generates different keys for different namespaces", () => {
  const input = { query: "test" };

  const key1 = CacheKeyFactory.create("ns1", "v1", input);
  const key2 = CacheKeyFactory.create("ns2", "v1", input);

  assert.notEqual(key1, key2);
});

test("CacheKeyFactory.create generates different keys for different versions", () => {
  const input = { query: "test" };

  const key1 = CacheKeyFactory.create("ns", "v1", input);
  const key2 = CacheKeyFactory.create("ns", "v2", input);

  assert.notEqual(key1, key2);
});

test("CacheKeyFactory.create generates different keys for different inputs", () => {
  const input1 = { query: "test1" };
  const input2 = { query: "test2" };

  const key1 = CacheKeyFactory.create("ns", "v1", input1);
  const key2 = CacheKeyFactory.create("ns", "v1", input2);

  assert.notEqual(key1, key2);
});

test("CacheKeyFactory.create handles complex nested objects", () => {
  const input = {
    filters: {
      status: ["active", "pending"],
      tags: { priority: "high", owner: "team-a" },
    },
    pagination: { page: 2, limit: 50 },
  };

  const key = CacheKeyFactory.create("ns", "v1", input);

  assert.ok(key.startsWith("ns:v1:"));
  assert.equal(key.split(":").length, 3);
});

test("CacheKeyFactory.create handles array inputs", () => {
  const input1 = ["a", "b", "c"];
  const input2 = ["a", "b", "c"];
  const input3 = ["a", "b", "d"];

  const key1 = CacheKeyFactory.create("ns", "v1", input1);
  const key2 = CacheKeyFactory.create("ns", "v1", input2);
  const key3 = CacheKeyFactory.create("ns", "v1", input3);

  assert.equal(key1, key2);
  assert.notEqual(key1, key3);
});

test("CacheKeyFactory.create handles primitive inputs", () => {
  const keyString = CacheKeyFactory.create("ns", "v1", "test");
  const keyNumber = CacheKeyFactory.create("ns", "v1", 42);
  const keyNull = CacheKeyFactory.create("ns", "v1", null);

  assert.ok(keyString.startsWith("ns:v1:"));
  assert.ok(keyNumber.startsWith("ns:v1:"));
  assert.ok(keyNull.startsWith("ns:v1:"));

  // Different primitives should produce different keys
  assert.notEqual(keyString, keyNumber);
  assert.notEqual(keyNumber, keyNull);
});

test("CacheKeyFactory.create handles undefined inputs", () => {
  const key1 = CacheKeyFactory.create("ns", "v1", undefined);
  const key2 = CacheKeyFactory.create("ns", "v1", undefined);

  assert.equal(key1, key2);
  assert.ok(key1.startsWith("ns:v1:"));
});

test("CacheKeyFactory.getFingerprint extracts fingerprint correctly", () => {
  const input = { query: "test" };
  const key = CacheKeyFactory.create("ns", "v1", input);
  const expectedFingerprint = stableHash(input);

  const fingerprint = CacheKeyFactory.getFingerprint(key);

  assert.equal(fingerprint, expectedFingerprint);
});

test("CacheKeyFactory.getFingerprint returns null for malformed keys", () => {
  assert.equal(CacheKeyFactory.getFingerprint(""), null);
  assert.equal(CacheKeyFactory.getFingerprint("no-colons"), null);
  assert.equal(CacheKeyFactory.getFingerprint("one:colon"), null);
});

test("CacheKeyFactory.getVersion extracts version correctly", () => {
  const key = "ns:v2:abc123";

  const version = CacheKeyFactory.getVersion(key);

  assert.equal(version, "v2");
});

test("CacheKeyFactory.getVersion returns null for malformed keys", () => {
  assert.equal(CacheKeyFactory.getVersion(""), null);
  assert.equal(CacheKeyFactory.getVersion("no-colons"), null);
  assert.equal(CacheKeyFactory.getVersion("only-one"), null);
});

test("CacheKeyFactory.getNamespace extracts namespace correctly", () => {
  const key = "myns:v1:abc123";

  const namespace = CacheKeyFactory.getNamespace(key);

  assert.equal(namespace, "myns");
});

test("CacheKeyFactory.getNamespace handles key with colons in fingerprint", () => {
  // Fingerprint could theoretically contain colons if the hash format changes
  const key = "ns:v1:fp:with:colons";

  const namespace = CacheKeyFactory.getNamespace(key);

  assert.equal(namespace, "ns");
});

test("CacheKeyFactory.parse extracts all components correctly", () => {
  const input = { query: "test" };
  const key = CacheKeyFactory.create("ns", "v1", input);

  const parsed = CacheKeyFactory.parse(key);

  assert.notEqual(parsed, null);
  assert.equal(parsed!.namespace, "ns");
  assert.equal(parsed!.version, "v1");
  assert.equal(parsed!.fingerprint, stableHash(input));
});

test("CacheKeyFactory.parse handles fingerprints with colons", () => {
  const key = "ns:v1:fp:with:colons";

  const parsed = CacheKeyFactory.parse(key);

  assert.notEqual(parsed, null);
  assert.equal(parsed!.namespace, "ns");
  assert.equal(parsed!.version, "v1");
  assert.equal(parsed!.fingerprint, "fp:with:colons");
});

test("CacheKeyFactory.parse returns null for malformed keys", () => {
  assert.equal(CacheKeyFactory.parse(""), null);
  assert.equal(CacheKeyFactory.parse("no-colons"), null);
  assert.equal(CacheKeyFactory.parse("one:colon"), null);
});

test("CacheKeyFactory round-trip: create then parse yields original components", () => {
  const input = { data: [1, 2, 3], nested: { a: true } };

  const key = CacheKeyFactory.create("test-ns", "v3", input);
  const parsed = CacheKeyFactory.parse(key);

  assert.notEqual(parsed, null);
  assert.equal(parsed!.namespace, "test-ns");
  assert.equal(parsed!.version, "v3");
  assert.equal(parsed!.fingerprint, stableHash(input));
});

test("stableHash produces consistent output for object key ordering", () => {
  const input1 = { a: 1, b: 2 };
  const input2 = { b: 2, a: 1 };

  const hash1 = stableHash(input1);
  const hash2 = stableHash(input2);

  // stableStringify should handle object key ordering consistently
  assert.equal(hash1, hash2);
});

test("shortHash returns first 16 characters of stableHash", () => {
  const input = { query: "test" };

  const full = stableHash(input);
  const short = shortHash(input);

  assert.equal(short, full.slice(0, 16));
  assert.equal(short.length, 16);
});

test("buildCacheKey produces same output as CacheKeyFactory.create", () => {
  const input = { query: "test" };

  const factoryKey = CacheKeyFactory.create("ns", "v1", input);
  const utilKey = buildCacheKey("ns", "v1", input);

  assert.equal(factoryKey, utilKey);
});
