import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isCacheableTool,
  isUncacheableTool,
  CACHEABLE_TOOLS,
  UNCACHEABLE_TOOLS,
} from "../../../../src/platform/shared/cache/cache-types.js";

test("CacheTypes - isCacheableTool returns true for cacheable tools", () => {
  assert.equal(isCacheableTool("read"), true);
  assert.equal(isCacheableTool("glob"), true);
  assert.equal(isCacheableTool("grep"), true);
  assert.equal(isCacheableTool("repo_map"), true);
  assert.equal(isCacheableTool("diagnostics"), true);
  assert.equal(isCacheableTool("web_fetch"), true);
  assert.equal(isCacheableTool("memory_summary"), true);
  assert.equal(isCacheableTool("memory_retrieval"), true);
  assert.equal(isCacheableTool("planner_plan"), true);
});

test("CacheTypes - isCacheableTool returns false for uncacheable tools", () => {
  assert.equal(isCacheableTool("bash"), false);
  assert.equal(isCacheableTool("write"), false);
  assert.equal(isCacheableTool("edit"), false);
  assert.equal(isCacheableTool("apply_patch"), false);
  assert.equal(isCacheableTool("git_commit"), false);
  assert.equal(isCacheableTool("git_push"), false);
});

test("CacheTypes - isCacheableTool returns false for unknown tools", () => {
  assert.equal(isCacheableTool("unknown_tool"), false);
  assert.equal(isCacheableTool(""), false);
  assert.equal(isCacheableTool("CACHEABLE_TOOLS"), false);
});

test("CacheTypes - isUncacheableTool returns true for uncacheable tools", () => {
  assert.equal(isUncacheableTool("bash"), true);
  assert.equal(isUncacheableTool("write"), true);
  assert.equal(isUncacheableTool("edit"), true);
  assert.equal(isUncacheableTool("apply_patch"), true);
  assert.equal(isUncacheableTool("git_commit"), true);
  assert.equal(isUncacheableTool("git_push"), true);
});

test("CacheTypes - isUncacheableTool returns false for cacheable tools", () => {
  assert.equal(isUncacheableTool("read"), false);
  assert.equal(isUncacheableTool("glob"), false);
  assert.equal(isUncacheableTool("grep"), false);
  assert.equal(isUncacheableTool("unknown_tool"), false);
});

test("CacheTypes - CACHEABLE_TOOLS is readonly array", () => {
  assert.equal(Array.isArray(CACHEABLE_TOOLS), true);
  assert.equal(CACHEABLE_TOOLS.length, 9);
});

test("CacheTypes - UNCACHEABLE_TOOLS is readonly array", () => {
  assert.equal(Array.isArray(UNCACHEABLE_TOOLS), true);
  assert.equal(UNCACHEABLE_TOOLS.length, 6);
});

test("CacheTypes - tool lists are mutually exclusive", () => {
  for (const tool of CACHEABLE_TOOLS) {
    assert.equal(isUncacheableTool(tool), false, `${tool} should not be uncacheable`);
  }
  for (const tool of UNCACHEABLE_TOOLS) {
    assert.equal(isCacheableTool(tool), false, `${tool} should not be cacheable`);
  }
});