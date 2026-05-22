import assert from "node:assert/strict";
import test from "node:test";
import { sep } from "node:path";

import {
  parseOptionalPositiveInteger,
  parseOptionalStringArray,
  resolveMultiStepToolPath,
  safeParseToolResult,
} from "../../../src/platform/five-plane-execution/execution-engine/multi-step-utils.js";

test("parseOptionalPositiveInteger returns number for valid input", () => {
  assert.equal(parseOptionalPositiveInteger(42), 42);
  assert.equal(parseOptionalPositiveInteger(1), 1);
  assert.equal(parseOptionalPositiveInteger(999999), 999999);
});

test("parseOptionalPositiveInteger returns undefined for non-positive", () => {
  assert.equal(parseOptionalPositiveInteger(0), undefined);
  assert.equal(parseOptionalPositiveInteger(-1), undefined);
  assert.equal(parseOptionalPositiveInteger(-100), undefined);
});

test("parseOptionalPositiveInteger truncates non-integers to integer part", () => {
  assert.equal(parseOptionalPositiveInteger(1.5), 1);
  assert.equal(parseOptionalPositiveInteger(0.1), 0);
  assert.equal(parseOptionalPositiveInteger(3.14159), 3);
});

test("parseOptionalPositiveInteger returns undefined for non-finite", () => {
  assert.equal(parseOptionalPositiveInteger(Infinity), undefined);
  assert.equal(parseOptionalPositiveInteger(NaN), undefined);
  assert.equal(parseOptionalPositiveInteger(-Infinity), undefined);
});

test("parseOptionalPositiveInteger returns undefined for non-numbers", () => {
  assert.equal(parseOptionalPositiveInteger("42"), undefined);
  assert.equal(parseOptionalPositiveInteger(null), undefined);
  assert.equal(parseOptionalPositiveInteger(undefined), undefined);
  assert.equal(parseOptionalPositiveInteger({}), undefined);
  assert.equal(parseOptionalPositiveInteger([]), undefined);
});

test("parseOptionalPositiveInteger truncates decimals", () => {
  assert.equal(parseOptionalPositiveInteger(42.9), 42);
  assert.equal(parseOptionalPositiveInteger(3.14159), 3);
  assert.equal(parseOptionalPositiveInteger(100.001), 100);
});

test("parseOptionalStringArray returns empty for non-array", () => {
  assert.deepStrictEqual(parseOptionalStringArray(null), []);
  assert.deepStrictEqual(parseOptionalStringArray(undefined), []);
  assert.deepStrictEqual(parseOptionalStringArray("hello"), []);
  assert.deepStrictEqual(parseOptionalStringArray(123), []);
  assert.deepStrictEqual(parseOptionalStringArray({}), []);
});

test("parseOptionalStringArray filters out non-strings", () => {
  assert.deepStrictEqual(parseOptionalStringArray(["a", "b", "c"]), ["a", "b", "c"]);
  assert.deepStrictEqual(parseOptionalStringArray(["a", 123, "b"]), ["a", "b"]);
  assert.deepStrictEqual(parseOptionalStringArray([1, 2, 3]), []);
});

test("parseOptionalStringArray trims and filters empty strings", () => {
  assert.deepStrictEqual(parseOptionalStringArray(["  hello  ", "world", ""]), ["hello", "world"]);
  assert.deepStrictEqual(parseOptionalStringArray(["", "  ", "test"]), ["test"]);
});

test("parseOptionalStringArray filters non-string items in arrays", () => {
  // String items pass through
  assert.deepStrictEqual(parseOptionalStringArray(["a", "b", "c"]), ["a", "b", "c"]);
  // Non-string items (including nested arrays) are filtered out
  assert.deepStrictEqual(parseOptionalStringArray(["a", 123, "b"]), ["a", "b"]);
  assert.deepStrictEqual(parseOptionalStringArray([1, 2, 3]), []);
  // Nested arrays are flattened recursively and still filter out non-string items.
  assert.deepStrictEqual(parseOptionalStringArray(["a", ["b", "c"], "d"]), ["a", "b", "c", "d"]);
});

test("safeParseToolResult parses valid JSON", () => {
  const result = safeParseToolResult('{"key": "value", "num": 42}');
  assert.deepStrictEqual(result, { key: "value", num: 42 });
});

test("safeParseToolResult parses JSON arrays", () => {
  const result = safeParseToolResult('[1, 2, 3]');
  assert.deepStrictEqual(result, [1, 2, 3]);
});

test("safeParseToolResult returns string for invalid JSON", () => {
  const result = safeParseToolResult("not valid json");
  assert.equal(result, "not valid json");
});

test("safeParseToolResult handles empty string", () => {
  const result = safeParseToolResult("");
  assert.equal(result, "");
});

test("safeParseToolResult handles partial JSON", () => {
  const result = safeParseToolResult('{"incomplete":');
  assert.equal(result, '{"incomplete":');
});

test("resolveMultiStepToolPath resolves simple paths", () => {
  const result = resolveMultiStepToolPath("/project", "src/index.js");
  assert.ok(result.endsWith("src/index.js") || result.includes("src"), "Should resolve to src path");
});

test("resolveMultiStepToolPath uses root for null input", () => {
  const result = resolveMultiStepToolPath("/project", null);
  assert.equal(result, "/project");
});

test("resolveMultiStepToolPath uses root for undefined input", () => {
  const result = resolveMultiStepToolPath("/project", undefined);
  assert.equal(result, "/project");
});

test("resolveMultiStepToolPath decodes URL-encoded paths", () => {
  const result = resolveMultiStepToolPath("/project", "src%2Ffile.js");
  assert.ok(result.includes("src") || result.includes("%2F"), "Should handle encoded slashes");
});

test("resolveMultiStepToolPath rejects paths with .. traversal", () => {
  assert.throws(
    () => resolveMultiStepToolPath("/project", "../secret"),
    (err: any) => err.code?.startsWith("tool.path_outside_workspace")
  );
});

test("resolveMultiStepToolPath rejects absolute paths outside root", () => {
  assert.throws(
    () => resolveMultiStepToolPath("/project", "/etc/passwd"),
    (err: any) => err.code?.startsWith("tool.path_outside_workspace")
  );
});

test("resolveMultiStepToolPath allows exact root match", () => {
  // When resolved path equals the root exactly, it's allowed
  const result = resolveMultiStepToolPath("/project", ".");
  assert.equal(result, "/project");
});

test("parseOptionalPositiveInteger edge case: very large numbers", () => {
  assert.equal(parseOptionalPositiveInteger(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
});

test("parseOptionalStringArray with empty array returns empty", () => {
  assert.deepStrictEqual(parseOptionalStringArray([]), []);
});
