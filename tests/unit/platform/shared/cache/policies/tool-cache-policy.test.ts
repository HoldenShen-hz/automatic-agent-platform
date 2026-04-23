/**
 * Unit tests for tool cache policy constants.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { TOOL_CACHE_POLICIES } from "../../../../../../src/platform/shared/cache/policies/tool-cache-policy.js";

test("TOOL_CACHE_POLICIES contains tool.read policy", () => {
  const policy = TOOL_CACHE_POLICIES["tool.read"];
  assert.ok(policy, "tool.read policy should exist");
  assert.equal(policy.enabled, true);
  assert.equal(policy.scope, "session");
  assert.equal(policy.ttlMs, 5 * 60 * 1000);
  assert.equal(policy.version, "v1");
  assert.equal(policy.maxPayloadBytes, 256 * 1024);
  assert.deepEqual(policy.tags, ["tool:read"]);
});

test("TOOL_CACHE_POLICIES contains tool.glob policy", () => {
  const policy = TOOL_CACHE_POLICIES["tool.glob"];
  assert.ok(policy, "tool.glob policy should exist");
  assert.equal(policy.enabled, true);
  assert.equal(policy.scope, "session");
  assert.equal(policy.ttlMs, 5 * 60 * 1000);
  assert.equal(policy.version, "v1");
  assert.equal(policy.maxPayloadBytes, 256 * 1024);
  assert.deepEqual(policy.tags, ["tool:glob"]);
});

test("TOOL_CACHE_POLICIES contains tool.grep policy", () => {
  const policy = TOOL_CACHE_POLICIES["tool.grep"];
  assert.ok(policy, "tool.grep policy should exist");
  assert.equal(policy.enabled, true);
  assert.equal(policy.scope, "session");
  assert.equal(policy.ttlMs, 3 * 60 * 1000);
  assert.equal(policy.version, "v1");
  assert.equal(policy.maxPayloadBytes, 256 * 1024);
  assert.deepEqual(policy.tags, ["tool:grep"]);
});

test("TOOL_CACHE_POLICIES contains tool.repo_map policy", () => {
  const policy = TOOL_CACHE_POLICIES["tool.repo_map"];
  assert.ok(policy, "tool.repo_map policy should exist");
  assert.equal(policy.enabled, true);
  assert.equal(policy.scope, "persistent");
  assert.equal(policy.ttlMs, 10 * 60 * 1000);
  assert.equal(policy.version, "v1");
  assert.equal(policy.maxPayloadBytes, 1024 * 1024);
  assert.deepEqual(policy.tags, ["tool:repo_map"]);
});

test("TOOL_CACHE_POLICIES contains tool.diagnostics policy", () => {
  const policy = TOOL_CACHE_POLICIES["tool.diagnostics"];
  assert.ok(policy, "tool.diagnostics policy should exist");
  assert.equal(policy.enabled, true);
  assert.equal(policy.scope, "session");
  assert.equal(policy.ttlMs, 5 * 60 * 1000);
  assert.equal(policy.version, "v1");
  assert.equal(policy.maxPayloadBytes, 256 * 1024);
  assert.deepEqual(policy.tags, ["tool:diagnostics"]);
});

test("TOOL_CACHE_POLICIES contains tool.web_fetch policy", () => {
  const policy = TOOL_CACHE_POLICIES["tool.web_fetch"];
  assert.ok(policy, "tool.web_fetch policy should exist");
  assert.equal(policy.enabled, true);
  assert.equal(policy.scope, "session");
  assert.equal(policy.ttlMs, 10 * 60 * 1000);
  assert.equal(policy.version, "v1");
  assert.equal(policy.maxPayloadBytes, 512 * 1024);
  assert.deepEqual(policy.tags, ["tool:web_fetch"]);
});

test("TOOL_CACHE_POLICIES has six entries", () => {
  assert.equal(Object.keys(TOOL_CACHE_POLICIES).length, 6);
});