/**
 * Unit tests for planner cache policy constants.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { PLANNER_CACHE_POLICIES } from "../../../../../../src/platform/shared/cache/policies/planner-cache-policy.js";

test("PLANNER_CACHE_POLICIES contains planner.plan policy", () => {
  const policy = PLANNER_CACHE_POLICIES["planner.plan"];
  assert.ok(policy, "planner.plan policy should exist");
  assert.equal(policy.enabled, true);
  assert.equal(policy.scope, "session");
  assert.equal(policy.ttlMs, 15 * 60 * 1000);
  assert.equal(policy.version, "v1");
  assert.equal(policy.maxPayloadBytes, 256 * 1024);
  assert.deepEqual(policy.tags, ["planner:plan"]);
});

test("PLANNER_CACHE_POLICIES contains planner.decomposition policy", () => {
  const policy = PLANNER_CACHE_POLICIES["planner.decomposition"];
  assert.ok(policy, "planner.decomposition policy should exist");
  assert.equal(policy.enabled, true);
  assert.equal(policy.scope, "session");
  assert.equal(policy.ttlMs, 10 * 60 * 1000);
  assert.equal(policy.version, "v1");
  assert.equal(policy.maxPayloadBytes, 256 * 1024);
  assert.deepEqual(policy.tags, ["planner:decomposition"]);
});

test("PLANNER_CACHE_POLICIES contains planner.workflow policy", () => {
  const policy = PLANNER_CACHE_POLICIES["planner.workflow"];
  assert.ok(policy, "planner.workflow policy should exist");
  assert.equal(policy.enabled, true);
  assert.equal(policy.scope, "session");
  assert.equal(policy.ttlMs, 15 * 60 * 1000);
  assert.equal(policy.version, "v1");
  assert.equal(policy.maxPayloadBytes, 512 * 1024);
  assert.deepEqual(policy.tags, ["planner:workflow"]);
});

test("PLANNER_CACHE_POLICIES has three entries", () => {
  assert.equal(Object.keys(PLANNER_CACHE_POLICIES).length, 3);
});