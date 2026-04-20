import assert from "node:assert/strict";
import test from "node:test";

import { MEMORY_CACHE_POLICIES } from "../../../../../src/platform/shared/cache/policies/memory-cache-policy.js";
import { PLANNER_CACHE_POLICIES } from "../../../../../src/platform/shared/cache/policies/planner-cache-policy.js";
import { PROMPT_CACHE_POLICIES } from "../../../../../src/platform/shared/cache/policies/prompt-cache-policy.js";
import { TOOL_CACHE_POLICIES } from "../../../../../src/platform/shared/cache/policies/tool-cache-policy.js";

test("memory cache policies expose the expected namespaces and retention windows", () => {
  assert.deepEqual(Object.keys(MEMORY_CACHE_POLICIES).sort(), [
    "memory.compressed",
    "memory.retrieval",
    "memory.summary",
  ]);
  assert.equal(MEMORY_CACHE_POLICIES["memory.summary"]?.scope, "persistent");
  assert.equal(MEMORY_CACHE_POLICIES["memory.retrieval"]?.ttlMs, 5 * 60 * 1000);
  assert.equal(MEMORY_CACHE_POLICIES["memory.compressed"]?.maxPayloadBytes, 512 * 1024);
});

test("planner cache policies keep planner artifacts session-scoped", () => {
  assert.deepEqual(Object.keys(PLANNER_CACHE_POLICIES).sort(), [
    "planner.decomposition",
    "planner.plan",
    "planner.workflow",
  ]);
  assert.equal(PLANNER_CACHE_POLICIES["planner.plan"]?.scope, "session");
  assert.equal(PLANNER_CACHE_POLICIES["planner.decomposition"]?.ttlMs, 10 * 60 * 1000);
  assert.equal(PLANNER_CACHE_POLICIES["planner.workflow"]?.maxPayloadBytes, 512 * 1024);
});

test("prompt cache policies separate persistent prefixes from session full prompts", () => {
  assert.deepEqual(Object.keys(PROMPT_CACHE_POLICIES).sort(), [
    "prompt.full",
    "prompt.prefix",
    "prompt.static",
  ]);
  assert.equal(PROMPT_CACHE_POLICIES["prompt.prefix"]?.scope, "persistent");
  assert.equal(PROMPT_CACHE_POLICIES["prompt.full"]?.scope, "session");
  assert.equal(PROMPT_CACHE_POLICIES["prompt.static"]?.ttlMs, 7 * 24 * 60 * 60 * 1000);
});

test("tool cache policies cover read, search, repo map, diagnostics, and web fetch", () => {
  assert.deepEqual(Object.keys(TOOL_CACHE_POLICIES).sort(), [
    "tool.diagnostics",
    "tool.glob",
    "tool.grep",
    "tool.read",
    "tool.repo_map",
    "tool.web_fetch",
  ]);
  assert.equal(TOOL_CACHE_POLICIES["tool.read"]?.scope, "session");
  assert.equal(TOOL_CACHE_POLICIES["tool.repo_map"]?.scope, "persistent");
  assert.equal(TOOL_CACHE_POLICIES["tool.web_fetch"]?.ttlMs, 10 * 60 * 1000);
});
