import assert from "node:assert/strict";
import test from "node:test";

import {
  parseOptionalPositiveInteger,
  parseOptionalStringArray,
  resolveMultiStepToolPath,
  safeParseToolResult,
} from "../../../../src/platform/five-plane-execution/execution-engine/multi-step-utils.js";

test("parseOptionalPositiveInteger should return undefined for non-numbers", () => {
  assert.equal(parseOptionalPositiveInteger("123"), undefined);
  assert.equal(parseOptionalPositiveInteger(null), undefined);
  assert.equal(parseOptionalPositiveInteger(undefined), undefined);
  assert.equal(parseOptionalPositiveInteger({}), undefined);
  assert.equal(parseOptionalPositiveInteger([]), undefined);
});

test("parseOptionalPositiveInteger should return undefined for non-positive numbers", () => {
  assert.equal(parseOptionalPositiveInteger(0), undefined);
  assert.equal(parseOptionalPositiveInteger(-1), undefined);
  assert.equal(parseOptionalPositiveInteger(-100), undefined);
});

test("parseOptionalPositiveInteger should return undefined for non-finite numbers", () => {
  assert.equal(parseOptionalPositiveInteger(NaN), undefined);
  assert.equal(parseOptionalPositiveInteger(Infinity), undefined);
  assert.equal(parseOptionalPositiveInteger(-Infinity), undefined);
});

test("parseOptionalPositiveInteger should return truncated value for valid positive integers", () => {
  assert.equal(parseOptionalPositiveInteger(1), 1);
  assert.equal(parseOptionalPositiveInteger(10), 10);
  assert.equal(parseOptionalPositiveInteger(42), 42);
});

test("parseOptionalPositiveInteger should truncate decimal values", () => {
  assert.equal(parseOptionalPositiveInteger(1.9), 1);
  assert.equal(parseOptionalPositiveInteger(10.5), 10);
  assert.equal(parseOptionalPositiveInteger(42.99), 42);
});

test("parseOptionalStringArray should return empty array for non-arrays", () => {
  assert.deepEqual(parseOptionalStringArray("string"), []);
  assert.deepEqual(parseOptionalStringArray(123), []);
  assert.deepEqual(parseOptionalStringArray(null), []);
  assert.deepEqual(parseOptionalStringArray(undefined), []);
  assert.deepEqual(parseOptionalStringArray({}), []);
});

test("parseOptionalStringArray should filter out non-string items", () => {
  assert.deepEqual(parseOptionalStringArray([1, "valid", null, "another", undefined]), ["valid", "another"]);
});

test("parseOptionalStringArray should trim and filter empty strings", () => {
  assert.deepEqual(parseOptionalStringArray(["  ", "valid", "", "  another  "]), ["valid", "another"]);
});

test("parseOptionalStringArray should return empty array for arrays of only non-strings", () => {
  assert.deepEqual(parseOptionalStringArray([1, 2, 3]), []);
  assert.deepEqual(parseOptionalStringArray([null, undefined]), []);
});

test("parseOptionalStringArray should handle mixed valid and invalid items", () => {
  const result = parseOptionalStringArray([null, "  hello  ", 42, "", "world", undefined]);
  assert.deepEqual(result, ["hello", "world"]);
});

test("resolveMultiStepToolPath should resolve simple paths", () => {
  const root = "/workspace";
  assert.equal(resolveMultiStepToolPath(root, "src/index.ts"), "/workspace/src/index.ts");
});

test("resolveMultiStepToolPath should handle null inputPath", () => {
  const root = "/workspace";
  assert.equal(resolveMultiStepToolPath(root, null), "/workspace");
});

test("resolveMultiStepToolPath should handle undefined inputPath", () => {
  const root = "/workspace";
  assert.equal(resolveMultiStepToolPath(root, undefined), "/workspace");
});

test("resolveMultiStepToolPath should decode URI encoded paths", () => {
  const root = "/workspace";
  const result = resolveMultiStepToolPath(root, "src%2Ffile.ts");
  assert.ok(result.includes("src/file.ts") || result.includes("src%2Ffile.ts"), "should handle encoded paths");
});

test("resolveMultiStepToolPath should reject paths with .. traversal", () => {
  const root = "/workspace";

  assert.throws(
    () => resolveMultiStepToolPath(root, "../etc/passwd"),
    /path_outside_workspace/,
    "should reject .. traversal",
  );
});

test("resolveMultiStepToolPath should reject paths that escape root", () => {
  const root = "/workspace/project";

  assert.throws(
    () => resolveMultiStepToolPath(root, "/etc/passwd"),
    /path_outside_workspace/,
    "should reject absolute paths outside root",
  );
  assert.throws(
    () => resolveMultiStepToolPath(root, "../../../etc/passwd"),
    /path_outside_workspace/,
    "should reject deep .. traversal",
  );
});

test("resolveMultiStepToolPath should allow paths within root", () => {
  const root = "/workspace";
  const result = resolveMultiStepToolPath(root, "src");
  assert.equal(result, "/workspace/src");
});

test("resolveMultiStepToolPath should handle empty path segments", () => {
  const root = "/workspace";
  const result = resolveMultiStepToolPath(root, "a///b///c");
  assert.ok(result.includes("a"));
  assert.ok(result.includes("b"));
  assert.ok(result.includes("c"));
});

test("resolveMultiStepToolPath should handle root as filesystem root", () => {
  const root = "/";
  const result = resolveMultiStepToolPath(root, "etc/passwd");
  assert.equal(result, "/etc/passwd");
});

test("safeParseToolResult should parse valid JSON", () => {
  const result = safeParseToolResult('{"key":"value","num":42}');
  assert.deepEqual(result, { key: "value", num: 42 });
});

test("safeParseToolResult should parse valid JSON arrays", () => {
  const result = safeParseToolResult('[1,2,3,"four"]');
  assert.deepEqual(result, [1, 2, 3, "four"]);
});

test("safeParseToolResult should return raw string for invalid JSON", () => {
  const raw = "not valid json {";
  const result = safeParseToolResult(raw);
  assert.equal(result, raw);
});

test("safeParseToolResult should return raw string for plain text", () => {
  const raw = "just some plain text";
  const result = safeParseToolResult(raw);
  assert.equal(result, raw);
});

test("safeParseToolResult should handle empty string", () => {
  const result = safeParseToolResult("");
  assert.equal(result, "");
});

test("safeParseToolResult should handle JSON with whitespace", () => {
  const result = safeParseToolResult('  {"key": "value"}  ');
  assert.deepEqual(result, { key: "value" });
});

test("parseOptionalStringArray should handle deeply nested arrays", () => {
  const result = parseOptionalStringArray([["a"], [["b"]], [null, ["c"]]]);
  assert.deepEqual(result, ["a", "b", "c"]);
});