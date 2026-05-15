/**
 * Integration Test: Multi-Step Utilities
 *
 * Verifies multi-step orchestration utility functions for path resolution,
 * tool result parsing, and input validation.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  parseOptionalPositiveInteger,
  parseOptionalStringArray,
  resolveMultiStepToolPath,
  safeParseToolResult,
} from "../../../../../src/platform/five-plane-execution/execution-engine/multi-step-utils.js";

test("parseOptionalPositiveInteger: returns number for valid positive integers", () => {
  assert.equal(parseOptionalPositiveInteger(1), 1);
  assert.equal(parseOptionalPositiveInteger(100), 100);
  assert.equal(parseOptionalPositiveInteger(999999), 999999);
});

test("parseOptionalPositiveInteger: truncates floating point numbers", () => {
  assert.equal(parseOptionalPositiveInteger(1.9), 1);
  assert.equal(parseOptionalPositiveInteger(10.5), 10);
  assert.equal(parseOptionalPositiveInteger(100.1), 100);
});

test("parseOptionalPositiveInteger: returns undefined for zero", () => {
  assert.equal(parseOptionalPositiveInteger(0), undefined);
});

test("parseOptionalPositiveInteger: returns undefined for negative numbers", () => {
  assert.equal(parseOptionalPositiveInteger(-1), undefined);
  assert.equal(parseOptionalPositiveInteger(-100), undefined);
});

test("parseOptionalPositiveInteger: returns undefined for non-numbers", () => {
  assert.equal(parseOptionalPositiveInteger("1"), undefined);
  assert.equal(parseOptionalPositiveInteger(null), undefined);
  assert.equal(parseOptionalPositiveInteger(undefined), undefined);
  assert.equal(parseOptionalPositiveInteger({}), undefined);
  assert.equal(parseOptionalPositiveInteger([]), undefined);
  assert.equal(parseOptionalPositiveInteger(NaN), undefined);
  assert.equal(parseOptionalPositiveInteger(Infinity), undefined);
});

test("parseOptionalStringArray: returns strings from valid array", () => {
  const result = parseOptionalStringArray(["a", "b", "c"]);
  assert.deepEqual(result, ["a", "b", "c"]);
});

test("parseOptionalStringArray: filters out empty strings", () => {
  const result = parseOptionalStringArray(["a", "", "b", "  ", "c"]);
  assert.deepEqual(result, ["a", "b", "c"]);
});

test("parseOptionalStringArray: returns empty array for non-array input", () => {
  assert.deepEqual(parseOptionalStringArray("abc"), []);
  assert.deepEqual(parseOptionalStringArray(123), []);
  assert.deepEqual(parseOptionalStringArray(null), []);
  assert.deepEqual(parseOptionalStringArray(undefined), []);
  assert.deepEqual(parseOptionalStringArray({}), []);
});

test("parseOptionalStringArray: filters out non-string elements", () => {
  const result = parseOptionalStringArray(["a", 1, "b", null, "c", undefined, "d"]);
  assert.deepEqual(result, ["a", "b", "c", "d"]);
});

test("parseOptionalStringArray: handles mixed valid and invalid", () => {
  const result = parseOptionalStringArray([
    "valid1",
    "",
    "valid2",
    "  ",
    42,
    null,
    "valid3",
  ]);
  assert.deepEqual(result, ["valid1", "valid2", "valid3"]);
});

test("resolveMultiStepToolPath: resolves relative paths within workspace", () => {
  const root = "/workspace";
  const result = resolveMultiStepToolPath(root, "src/index.ts");
  assert.equal(result, "/workspace/src/index.ts");
});

test("resolveMultiStepToolPath: resolves null to root", () => {
  const root = "/workspace";
  const result = resolveMultiStepToolPath(root, null);
  assert.equal(result, root);
});

test("resolveMultiStepToolPath: resolves undefined to root", () => {
  const root = "/workspace";
  const result = resolveMultiStepToolPath(root, undefined);
  assert.equal(result, root);
});

test("resolveMultiStepToolPath: rejects paths outside workspace", () => {
  const root = "/workspace";

  assert.throws(
    () => resolveMultiStepToolPath(root, "../etc/passwd"),
    /path_outside_workspace/,
    "Should reject path traversal outside workspace",
  );

  assert.throws(
    () => resolveMultiStepToolPath(root, "/etc/passwd"),
    /path_outside_workspace/,
    "Should reject absolute paths outside workspace",
  );

  assert.throws(
    () => resolveMultiStepToolPath(root, "foo/../../../etc/passwd"),
    /path_outside_workspace/,
    "Should reject deep path traversal outside workspace",
  );
});

test("resolveMultiStepToolPath: allows exact workspace path", () => {
  const root = "/workspace";
  const result = resolveMultiStepToolPath(root, "/workspace");
  assert.equal(result, "/workspace");
});

test("resolveMultiStepToolPath: allows subdirectory of workspace", () => {
  const root = "/workspace";
  const result = resolveMultiStepToolPath(root, "subdir/nested/file.txt");
  assert.equal(result, "/workspace/subdir/nested/file.txt");
});

test("resolveMultiStepToolPath: handles nested paths correctly", () => {
  const root = "/workspace";
  const result = resolveMultiStepToolPath(root, "src/nested/deep/path/file.ts");
  assert.equal(result, "/workspace/src/nested/deep/path/file.ts");
});

test("safeParseToolResult: parses valid JSON", () => {
  const result = safeParseToolResult('{"key": "value", "num": 42}');
  assert.deepEqual(result, { key: "value", num: 42 });
});

test("safeParseToolResult: parses JSON arrays", () => {
  const result = safeParseToolResult('["a", "b", "c"]');
  assert.deepEqual(result, ["a", "b", "c"]);
});

test("safeParseToolResult: returns raw string for invalid JSON", () => {
  const raw = "not valid json { missing quotes";
  const result = safeParseToolResult(raw);
  assert.equal(result, raw);
});

test("safeParseToolResult: handles empty string", () => {
  const result = safeParseToolResult("");
  assert.equal(result, "");
});

test("safeParseToolResult: handles whitespace-only string", () => {
  const result = safeParseToolResult("   \n\t  ");
  assert.equal(result, "   \n\t  ");
});

test("safeParseToolResult: parses nested JSON", () => {
  const input = JSON.stringify({
    outer: {
      inner: {
        deeply: {
          nested: [1, 2, 3],
        },
      },
    },
  });
  const result = safeParseToolResult(input);
  assert.deepEqual(result, JSON.parse(input));
});

test("safeParseToolResult: handles JSON with special characters", () => {
  const input = '{"message": "Hello\\nWorld\\t!"}';
  const result = safeParseToolResult(input);
  assert.deepEqual(result, { message: "Hello\nWorld\t!" });
});

test("parseOptionalPositiveInteger: handles boundary values", () => {
  assert.equal(parseOptionalPositiveInteger(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
  assert.equal(parseOptionalPositiveInteger(1), 1);
});

test("parseOptionalStringArray: handles empty array", () => {
  const result = parseOptionalStringArray([]);
  assert.deepEqual(result, []);
});

test("parseOptionalStringArray: handles single valid string", () => {
  const result = parseOptionalStringArray(["only"]);
  assert.deepEqual(result, ["only"]);
});

test("resolveMultiStepToolPath: handles empty string as input", () => {
  const root = "/workspace";
  const result = resolveMultiStepToolPath(root, "");
  // Empty string resolves to root
  assert.equal(result, root);
});

test("safeParseToolResult: handles valid JSON with trailing whitespace", () => {
  const result = safeParseToolResult('{"key": "value"}\n\n  ');
  assert.deepEqual(result, { key: "value" });
});
