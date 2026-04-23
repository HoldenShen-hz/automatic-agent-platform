/**
 * Unit tests for memory cache policy constants.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { MEMORY_CACHE_POLICIES } from "../../../../../../src/platform/shared/cache/policies/memory-cache-policy.js";

test("MEMORY_CACHE_POLICIES contains memory.summary policy", () => {
  const policy = MEMORY_CACHE_POLICIES["memory.summary"];
  assert.ok(policy, "memory.summary policy should exist");
  assert.equal(policy.enabled, true);
  assert.equal(policy.scope, "persistent");
  assert.equal(policy.ttlMs, 24 * 60 * 60 * 1000);
  assert.equal(policy.version, "v1");
  assert.equal(policy.maxPayloadBytes, 256 * 1024);
  assert.deepEqual(policy.tags, ["memory:summary"]);
});

test("MEMORY_CACHE_POLICIES contains memory.retrieval policy", () => {
  const policy = MEMORY_CACHE_POLICIES["memory.retrieval"];
  assert.ok(policy, "memory.retrieval policy should exist");
  assert.equal(policy.enabled, true);
  assert.equal(policy.scope, "session");
  assert.equal(policy.ttlMs, 5 * 60 * 1000);
  assert.equal(policy.version, "v1");
  assert.equal(policy.maxPayloadBytes, 256 * 1024);
  assert.deepEqual(policy.tags, ["memory:retrieval"]);
});

test("MEMORY_CACHE_POLICIES contains memory.compressed policy", () => {
  const policy = MEMORY_CACHE_POLICIES["memory.compressed"];
  assert.ok(policy, "memory.compressed policy should exist");
  assert.equal(policy.enabled, true);
  assert.equal(policy.scope, "persistent");
  assert.equal(policy.ttlMs, 12 * 60 * 60 * 1000);
  assert.equal(policy.version, "v1");
  assert.equal(policy.maxPayloadBytes, 512 * 1024);
  assert.deepEqual(policy.tags, ["memory:compressed"]);
});

test("MEMORY_CACHE_POLICIES has three entries", () => {
  assert.equal(Object.keys(MEMORY_CACHE_POLICIES).length, 3);
});