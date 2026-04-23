/**
 * Unit tests for prompt cache policy constants.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { PROMPT_CACHE_POLICIES } from "../../../../../../src/platform/shared/cache/policies/prompt-cache-policy.js";

test("PROMPT_CACHE_POLICIES contains prompt.prefix policy", () => {
  const policy = PROMPT_CACHE_POLICIES["prompt.prefix"];
  assert.ok(policy, "prompt.prefix policy should exist");
  assert.equal(policy.enabled, true);
  assert.equal(policy.scope, "persistent");
  assert.equal(policy.ttlMs, 24 * 60 * 60 * 1000);
  assert.equal(policy.version, "v1");
  assert.equal(policy.maxPayloadBytes, 512 * 1024);
  assert.deepEqual(policy.tags, ["prompt:prefix"]);
});

test("PROMPT_CACHE_POLICIES contains prompt.full policy", () => {
  const policy = PROMPT_CACHE_POLICIES["prompt.full"];
  assert.ok(policy, "prompt.full policy should exist");
  assert.equal(policy.enabled, true);
  assert.equal(policy.scope, "session");
  assert.equal(policy.ttlMs, 30 * 60 * 1000);
  assert.equal(policy.version, "v1");
  assert.equal(policy.maxPayloadBytes, 512 * 1024);
  assert.deepEqual(policy.tags, ["prompt:full"]);
});

test("PROMPT_CACHE_POLICIES contains prompt.static policy", () => {
  const policy = PROMPT_CACHE_POLICIES["prompt.static"];
  assert.ok(policy, "prompt.static policy should exist");
  assert.equal(policy.enabled, true);
  assert.equal(policy.scope, "persistent");
  assert.equal(policy.ttlMs, 7 * 24 * 60 * 60 * 1000);
  assert.equal(policy.version, "v1");
  assert.equal(policy.maxPayloadBytes, 1024 * 1024);
  assert.deepEqual(policy.tags, ["prompt:static"]);
});

test("PROMPT_CACHE_POLICIES has three entries", () => {
  assert.equal(Object.keys(PROMPT_CACHE_POLICIES).length, 3);
});