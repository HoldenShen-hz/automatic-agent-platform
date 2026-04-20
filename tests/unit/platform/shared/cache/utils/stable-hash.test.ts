import assert from "node:assert/strict";
import test from "node:test";

import {
  stableHash,
  shortHash,
  buildCacheKey,
} from "../../../../../../src/platform/shared/cache/utils/stable-hash.js";

test("stableHash produces deterministic hash for same input", () => {
  const input = { a: 1, b: 2 };
  const hash1 = stableHash(input);
  const hash2 = stableHash(input);
  assert.equal(hash1, hash2);
});

test("stableHash produces different hash for different input", () => {
  const hash1 = stableHash({ a: 1 });
  const hash2 = stableHash({ a: 2 });
  assert.notEqual(hash1, hash2);
});

test("stableHash is 64 characters (SHA-256 hex)", () => {
  const hash = stableHash("test");
  assert.equal(hash.length, 64);
  assert.match(hash, /^[a-f0-9]+$/);
});

test("stableHash normalizes object key order", () => {
  const hash1 = stableHash({ a: 1, b: 2, c: 3 });
  const hash2 = stableHash({ c: 3, a: 1, b: 2 });
  assert.equal(hash1, hash2);
});

test("stableHash handles primitives", () => {
  assert.equal(stableHash("hello").length, 64);
  assert.equal(stableHash(42).length, 64);
  assert.equal(stableHash(true).length, 64);
  assert.equal(stableHash(null).length, 64);
});

test("stableHash handles arrays", () => {
  const hash1 = stableHash([1, 2, 3]);
  const hash2 = stableHash([1, 2, 3]);
  assert.equal(hash1, hash2);
  assert.notEqual(stableHash([1, 2]), hash1);
});

test("shortHash takes first 16 characters of stableHash", () => {
  const full = stableHash("test input");
  const short = shortHash("test input");
  assert.equal(short, full.slice(0, 16));
  assert.equal(short.length, 16);
});

test("buildCacheKey creates namespace-qualified key", () => {
  const key = buildCacheKey("prompt", "v1", { query: "test" });
  assert.ok(key.startsWith("prompt:v1:"));
  assert.equal(key.split(":").length, 3);
});

test("buildCacheKey uses stable hash for fingerprint", () => {
  const input = { a: 1 };
  const key1 = buildCacheKey("ns", "v1", input);
  const key2 = buildCacheKey("ns", "v1", input);
  assert.equal(key1, key2);
});

test("buildCacheKey different namespaces produce different keys", () => {
  const key1 = buildCacheKey("ns1", "v1", { a: 1 });
  const key2 = buildCacheKey("ns2", "v1", { a: 1 });
  assert.notEqual(key1, key2);
});

test("buildCacheKey different versions produce different keys", () => {
  const key1 = buildCacheKey("ns", "v1", { a: 1 });
  const key2 = buildCacheKey("ns", "v2", { a: 1 });
  assert.notEqual(key1, key2);
});
