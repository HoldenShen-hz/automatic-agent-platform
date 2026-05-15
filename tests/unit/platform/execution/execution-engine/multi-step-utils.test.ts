/**
 * Unit Tests: Multi-Step Utility Functions
 *
 * Tests for utility functions in multi-step-utils.ts:
 * - parseOptionalPositiveInteger
 * - parseOptionalStringArray
 * - resolveMultiStepToolPath
 * - safeParseToolResult
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  parseOptionalPositiveInteger,
  parseOptionalStringArray,
  resolveMultiStepToolPath,
  safeParseToolResult,
} from "../../../../../src/platform/five-plane-execution/execution-engine/multi-step-utils.js";
import { ToolExecutionError } from "../../../../../src/platform/contracts/errors.js";

// =============================================================================
// parseOptionalPositiveInteger tests
// =============================================================================

test("parseOptionalPositiveInteger returns number for valid positive integer", () => {
  assert.equal(parseOptionalPositiveInteger(42), 42);
  assert.equal(parseOptionalPositiveInteger(1), 1);
  assert.equal(parseOptionalPositiveInteger(1000), 1000);
});

test("parseOptionalPositiveInteger returns number for float (truncates)", () => {
  assert.equal(parseOptionalPositiveInteger(3.9), 3);
  assert.equal(parseOptionalPositiveInteger(10.5), 10);
  assert.equal(parseOptionalPositiveInteger(1.1), 1);
});

test("parseOptionalPositiveInteger returns undefined for zero", () => {
  assert.equal(parseOptionalPositiveInteger(0), undefined);
});

test("parseOptionalPositiveInteger returns undefined for negative numbers", () => {
  assert.equal(parseOptionalPositiveInteger(-1), undefined);
  assert.equal(parseOptionalPositiveInteger(-100), undefined);
});

test("parseOptionalPositiveInteger returns undefined for non-finite numbers", () => {
  assert.equal(parseOptionalPositiveInteger(NaN), undefined);
  assert.equal(parseOptionalPositiveInteger(Infinity), undefined);
  assert.equal(parseOptionalPositiveInteger(-Infinity), undefined);
});

test("parseOptionalPositiveInteger returns undefined for non-number types", () => {
  assert.equal(parseOptionalPositiveInteger("42"), undefined);
  assert.equal(parseOptionalPositiveInteger(null), undefined);
  assert.equal(parseOptionalPositiveInteger(undefined), undefined);
  assert.equal(parseOptionalPositiveInteger({}), undefined);
  assert.equal(parseOptionalPositiveInteger([]), undefined);
});

test("parseOptionalPositiveInteger handles large numbers", () => {
  assert.equal(parseOptionalPositiveInteger(2147483647), 2147483647);
});

test("parseOptionalPositiveInteger handles very small positive decimals", () => {
  assert.equal(parseOptionalPositiveInteger(0.1), 0, "Should truncate 0.1 to 0");
  assert.equal(parseOptionalPositiveInteger(0.9), 0, "Should truncate 0.9 to 0");
  assert.equal(parseOptionalPositiveInteger(0.01), 0, "Should truncate 0.01 to 0");
});

test("parseOptionalPositiveInteger handles very large numbers", () => {
  assert.equal(parseOptionalPositiveInteger(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
  assert.equal(parseOptionalPositiveInteger(1e15), 1e15);
});

test("parseOptionalPositiveInteger handles Number.MIN_VALUE", () => {
  // Number.MIN_VALUE is the smallest positive number, greater than zero
  assert.equal(parseOptionalPositiveInteger(Number.MIN_VALUE), 0, "Should truncate MIN_VALUE to 0");
});

test("parseOptionalPositiveInteger handles boundary values", () => {
  assert.equal(parseOptionalPositiveInteger(0.9999999999), 0, "Should truncate near-zero decimals");
  assert.equal(parseOptionalPositiveInteger(1.9999999999), 1, "Should truncate near-one decimals");
});

// =============================================================================
// parseOptionalStringArray tests
// =============================================================================

test("parseOptionalStringArray returns filtered array for valid input", () => {
  const result = parseOptionalStringArray(["a", "b", "c"]);
  assert.deepEqual(result, ["a", "b", "c"]);
});

test("parseOptionalStringArray filters out empty strings", () => {
  const result = parseOptionalStringArray(["a", "", "b", "   ", "c"]);
  assert.deepEqual(result, ["a", "b", "c"]);
});

test("parseOptionalStringArray filters out non-string items", () => {
  const result = parseOptionalStringArray(["a", 123, null, "b", undefined, "c"]);
  assert.deepEqual(result, ["a", "b", "c"]);
});

test("parseOptionalStringArray returns empty array for non-array input", () => {
  assert.deepEqual(parseOptionalStringArray("abc"), []);
  assert.deepEqual(parseOptionalStringArray(123), []);
  assert.deepEqual(parseOptionalStringArray(null), []);
  assert.deepEqual(parseOptionalStringArray(undefined), []);
  assert.deepEqual(parseOptionalStringArray({}), []);
});

test("parseOptionalStringArray returns empty array for empty array", () => {
  assert.deepEqual(parseOptionalStringArray([]), []);
});

test("parseOptionalStringArray handles mixed valid and invalid items", () => {
  const result = parseOptionalStringArray([
    "valid1",
    "",
    123,
    "valid2",
    null,
    "   ",
    undefined,
    "valid3",
  ]);
  assert.deepEqual(result, ["valid1", "valid2", "valid3"]);
});

test("parseOptionalStringArray trims whitespace strings", () => {
  const result = parseOptionalStringArray(["  ", "\t", "\n", "valid"]);
  assert.deepEqual(result, ["valid"]);
});

test("parseOptionalStringArray filters strings with only tabs and newlines", () => {
  const result = parseOptionalStringArray(["\t", "\n", "\r\n", "valid"]);
  assert.deepEqual(result, ["valid"]);
});

test("parseOptionalStringArray handles mixed whitespace strings", () => {
  const result = parseOptionalStringArray(["  leading", "trailing  ", "  both  ", "valid"]);
  assert.deepEqual(result, ["leading", "trailing", "both", "valid"]);
});

test("parseOptionalStringArray handles empty string as item", () => {
  const result = parseOptionalStringArray(["", "", ""]);
  assert.deepEqual(result, []);
});

test("parseOptionalStringArray preserves string order", () => {
  const result = parseOptionalStringArray(["z", "a", "m", "b"]);
  assert.deepEqual(result, ["z", "a", "m", "b"]);
});

test("parseOptionalStringArray handles boolean false as non-string", () => {
  const result = parseOptionalStringArray(["a", false, "b"]);
  assert.deepEqual(result, ["a", "b"]);
});

test("parseOptionalStringArray handles zero as non-string", () => {
  const result = parseOptionalStringArray(["a", 0, "b"]);
  assert.deepEqual(result, ["a", "b"]);
});

// =============================================================================
// resolveMultiStepToolPath tests
// =============================================================================

test("resolveMultiStepToolPath returns resolved path for valid input", () => {
  const result = resolveMultiStepToolPath("/workspace", "src/index.js");
  assert.ok(result.endsWith("src/index.js") || result.includes("src"));
});

test("resolveMultiStepToolPath handles null inputPath", () => {
  const result = resolveMultiStepToolPath("/workspace", null);
  assert.equal(result, "/workspace");
});

test("resolveMultiStepToolPath handles undefined inputPath", () => {
  const result = resolveMultiStepToolPath("/workspace", undefined);
  assert.equal(result, "/workspace");
});

test("resolveMultiStepToolPath handles empty string inputPath", () => {
  const result = resolveMultiStepToolPath("/workspace", "");
  assert.ok(result.length > 0);
});

test("resolveMultiStepToolPath throws for path outside workspace", () => {
  assert.throws(
    () => resolveMultiStepToolPath("/workspace", "../etc/passwd"),
    ToolExecutionError,
  );
});

test("resolveMultiStepToolPath throws for absolute path outside workspace", () => {
  assert.throws(
    () => resolveMultiStepToolPath("/workspace", "/tmp/evil"),
    ToolExecutionError,
  );
});

test("resolveMultiStepToolPath allows path within workspace subdirectory", () => {
  // This should not throw - path is within workspace
  const result = resolveMultiStepToolPath("/workspace", "src/utils");
  assert.ok(result.includes("src"));
});

test("resolveMultiStepToolPath error code contains path_outside_workspace", () => {
  try {
    resolveMultiStepToolPath("/workspace", "../evil");
    assert.fail("Should have thrown");
  } catch (error: unknown) {
    const isToolError = error instanceof ToolExecutionError;
    assert.ok(isToolError, "Expected ToolExecutionError to be thrown");
    if (isToolError) {
      assert.ok((error as ToolExecutionError).code.includes("path_outside_workspace"));
    }
  }
});

test("resolveMultiStepToolPath allows deep nested paths within workspace", () => {
  const result = resolveMultiStepToolPath("/workspace", "a/b/c/d/e");
  assert.ok(result.includes("a/b/c/d/e") || result.endsWith("a/b/c/d/e"));
});

test("resolveMultiStepToolPath rejects path with encoded traversal", () => {
  assert.throws(
    () => resolveMultiStepToolPath("/workspace", "foo/../bar"),
    ToolExecutionError,
  );
});

test("resolveMultiStepToolPath allows absolute path at workspace boundary", () => {
  assert.equal(resolveMultiStepToolPath("/workspace", "/workspace"), "/workspace");
});

test("resolveMultiStepToolPath handles relative paths with current directory", () => {
  const result = resolveMultiStepToolPath("/workspace", "./src");
  assert.ok(result.includes("src"));
});

test("resolveMultiStepToolPath handles relative paths with parent traversal attempt", () => {
  assert.throws(
    () => resolveMultiStepToolPath("/workspace", "foo/../../bar"),
    ToolExecutionError,
  );
});

test("resolveMultiStepToolPath handles root path as workspace", () => {
  // When rootPath is root, any absolute path should work (since it starts with root)
  const result = resolveMultiStepToolPath("/", "/usr/local");
  assert.ok(result.includes("usr/local") || result.endsWith("usr/local"));
});

test("resolveMultiStepToolPath error message contains the problematic path", () => {
  try {
    resolveMultiStepToolPath("/workspace", "../malicious");
    assert.fail("Should have thrown");
  } catch (error: unknown) {
    assert.ok(error instanceof ToolExecutionError);
    if (error instanceof ToolExecutionError) {
      assert.ok(error.code.includes("path_outside_workspace"));
      assert.ok(error.message.includes("../malicious") || error.message.includes(".."));
    }
  }
});

// =============================================================================
// safeParseToolResult tests
// =============================================================================

test("safeParseToolResult parses valid JSON string", () => {
  const result = safeParseToolResult('{"key": "value"}');
  assert.deepEqual(result, { key: "value" });
});

test("safeParseToolResult parses valid JSON array", () => {
  const result = safeParseToolResult('[1, 2, 3]');
  assert.deepEqual(result, [1, 2, 3]);
});

test("safeParseToolResult parses nested JSON", () => {
  const result = safeParseToolResult('{"a": {"b": [1, 2, 3]}}');
  assert.deepEqual(result, { a: { b: [1, 2, 3] } });
});

test("safeParseToolResult parses JSON primitives", () => {
  assert.equal(safeParseToolResult('"string"'), "string");
  assert.equal(safeParseToolResult("42"), 42);
  assert.equal(safeParseToolResult("true"), true);
  assert.equal(safeParseToolResult("null"), null);
});

test("safeParseToolResult returns raw string for invalid JSON", () => {
  const invalidInputs = [
    "not json",
    "{invalid}",
    "[1, 2,}",
    "just text",
    "",
  ];

  for (const input of invalidInputs) {
    const result = safeParseToolResult(input);
    assert.equal(result, input, `Should return raw string for: ${input}`);
  }
});

test("safeParseToolResult handles whitespace-only string", () => {
  const result = safeParseToolResult("   \n\t  ");
  assert.equal(result, "   \n\t  ");
});

test("safeParseToolResult handles deeply nested JSON", () => {
  const input = '{"a":{"b":{"c":{"d":{"e":"value"}}}}}';
  const result = safeParseToolResult(input);
  assert.deepEqual(result, { a: { b: { c: { d: { e: "value" } } } } });
});

test("safeParseToolResult handles JSON with special characters", () => {
  const result = safeParseToolResult('{"message": "Hello\\nWorld"}');
  assert.deepEqual(result, { message: "Hello\nWorld" });
});

test("safeParseToolResult parses JSON primitives correctly", () => {
  // JSON.parse("123") returns number 123
  const numResult = safeParseToolResult("123");
  assert.strictEqual(numResult, 123);
  assert.strictEqual(typeof numResult, "number");

  // JSON.parse("true") returns boolean true
  const boolResult = safeParseToolResult("true");
  assert.strictEqual(boolResult, true);
  assert.strictEqual(typeof boolResult, "boolean");
});

test("safeParseToolResult handles unicode characters", () => {
  const result = safeParseToolResult('{"message": "こんにちは"}');
  assert.deepEqual(result, { message: "こんにちは" });
});

test("safeParseToolResult handles escaped quotes", () => {
  const result = safeParseToolResult('{"message": "He said \\"Hello\\""}');
  assert.deepEqual(result, { message: 'He said "Hello"' });
});

test("safeParseToolResult handles scientific notation", () => {
  const result = safeParseToolResult("1e10");
  assert.strictEqual(result, 1e10);
  assert.strictEqual(typeof result, "number");
});

test("safeParseToolResult handles negative numbers", () => {
  const result = safeParseToolResult("-42");
  assert.strictEqual(result, -42);
});

test("safeParseToolResult handles JSON false", () => {
  const result = safeParseToolResult("false");
  assert.strictEqual(result, false);
  assert.strictEqual(typeof result, "boolean");
});

test("safeParseToolResult handles JSON array with mixed types", () => {
  const result = safeParseToolResult('[1, "string", true, null, {"key": "value"}]');
  assert.deepEqual(result, [1, "string", true, null, { key: "value" }]);
});

test("safeParseToolResult handles empty JSON object", () => {
  const result = safeParseToolResult("{}");
  assert.deepEqual(result, {});
});

test("safeParseToolResult handles empty JSON array", () => {
  const result = safeParseToolResult("[]");
  assert.deepEqual(result, []);
});

test("safeParseToolResult handles special JSON numbers", () => {
  const result = safeParseToolResult("[0, -0, 1.5, -1.5, 1e-5, 1E+5]");
  assert.deepEqual(result, [0, -0, 1.5, -1.5, 1e-5, 1E+5]);
});

test("safeParseToolResult handles escaped slashes", () => {
  const result = safeParseToolResult('{"path": "C:\\\\Users\\\\test"}');
  assert.deepEqual(result, { path: "C:\\Users\\test" });
});

test("safeParseToolResult handles unicode escape sequences", () => {
  const result = safeParseToolResult('{"emoji": "\\uD83D\\uDE00"}');
  assert.deepEqual(result, { emoji: "😀" });
});

test("safeParseToolResult returns raw string for incomplete JSON objects", () => {
  const result = safeParseToolResult('{"key": "value"');
  assert.equal(result, '{"key": "value"');
});

test("safeParseToolResult returns raw string for incomplete JSON arrays", () => {
  const result = safeParseToolResult('[1, 2, 3');
  assert.equal(result, '[1, 2, 3');
});

test("safeParseToolResult handles JSON with trailing comma", () => {
  const result = safeParseToolResult('{"key": "value",}');
  // JSON.parse would fail on trailing comma
  assert.equal(result, '{"key": "value",}');
});
