import assert from "node:assert/strict";
import test from "node:test";
import { platform } from "node:os";
import { sep } from "node:path";

import {
  normalizeToolPathScopeRoots,
  hasToolPathScopeRestrictions,
  checkToolPathScope,
  type ToolPathScopeCheckResult,
} from "../../../../../src/platform/five-plane-execution/tool-executor/tool-path-scope.js";

test("normalizeToolPathScopeRoots returns empty array for null input", () => {
  const result = normalizeToolPathScopeRoots(null);
  assert.deepEqual(result, []);
});

test("normalizeToolPathScopeRoots returns empty array for undefined input", () => {
  const result = normalizeToolPathScopeRoots(undefined);
  assert.deepEqual(result, []);
});

test("normalizeToolPathScopeRoots returns empty array for empty array", () => {
  const result = normalizeToolPathScopeRoots([]);
  assert.deepEqual(result, []);
});

test("normalizeToolPathScopeRoots filters out empty strings", () => {
  const result = normalizeToolPathScopeRoots(["", "  ", "/valid"]);
  // normalizeRoot adds trailing separator, so "/valid" becomes "/valid/"
  assert.equal(result[0], "/valid/");
  assert.equal(result.length, 1);
});

test("normalizeToolPathScopeRoots removes duplicates", () => {
  const result = normalizeToolPathScopeRoots(["/same", "/same", "/other"]);
  // Deduplication uses path comparison, which on Windows handles differently
  assert.ok(result.length === 2);
});

test("normalizeToolPathScopeRoots normalizes paths with trailing separators", () => {
  const input = `/test${sep}path${sep}`;
  const result = normalizeToolPathScopeRoots([input]);
  assert.equal(result[0]!.endsWith(sep), true);
});

test("hasToolPathScopeRestrictions returns false for null", () => {
  assert.equal(hasToolPathScopeRestrictions(null), false);
});

test("hasToolPathScopeRestrictions returns false for empty array", () => {
  assert.equal(hasToolPathScopeRestrictions([]), false);
});

test("hasToolPathScopeRestrictions returns true when roots exist", () => {
  assert.equal(hasToolPathScopeRestrictions(["/allowed"]), true);
});

test("checkToolPathScope allows path when no roots specified", () => {
  const result = checkToolPathScope("/any/path", null);
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, null);
});

test("checkToolPathScope allows path when no roots specified (empty array)", () => {
  const result = checkToolPathScope("/any/path", []);
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, null);
});

test("checkToolPathScope allows path within root", () => {
  const result = checkToolPathScope("/allowed/subdir/file.txt", ["/allowed"]);
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, null);
});

test("checkToolPathScope allows path equal to root", () => {
  const result = checkToolPathScope("/allowed", ["/allowed"]);
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, null);
});

test("checkToolPathScope denies path outside root", () => {
  const result = checkToolPathScope("/denied/file.txt", ["/allowed"]);
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "tool.path_scope_denied");
});

test("checkToolPathScope allows path within any of multiple roots", () => {
  const result = checkToolPathScope("/other/path", ["/allowed", "/other"]);
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, null);
});

test("checkToolPathScope normalizes paths before checking", () => {
  // On Unix systems, /allowed/../allowed is normalized to /allowed
  const result = checkToolPathScope("/allowed/../allowed/file.txt", ["/allowed"]);
  assert.equal(result.allowed, true);
});

test("checkToolPathScope returns normalizedPath in result", () => {
  const result = checkToolPathScope("/input/path", ["/allowed"]);
  assert.ok(result.normalizedPath.length > 0);
  assert.equal(typeof result.normalizedPath, "string");
});

test("checkToolPathScope is case-sensitive on Unix", () => {
  // Unix is case-sensitive, so /Allowed is different from /allowed
  const result = checkToolPathScope("/Allowed/file.txt", ["/allowed"]);
  assert.equal(result.allowed, false);
});

test("ToolPathScopeCheckResult type accepts valid results", () => {
  const allowedResult: ToolPathScopeCheckResult = {
    allowed: true,
    normalizedPath: "/test/path",
    reasonCode: null,
  };
  const deniedResult: ToolPathScopeCheckResult = {
    allowed: false,
    normalizedPath: "/test/path",
    reasonCode: "tool.path_scope_denied",
  };
  assert.equal(allowedResult.allowed, true);
  assert.equal(deniedResult.allowed, false);
});
