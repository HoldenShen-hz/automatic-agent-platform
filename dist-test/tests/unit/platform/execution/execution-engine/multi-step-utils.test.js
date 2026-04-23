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
import { parseOptionalPositiveInteger, parseOptionalStringArray, resolveMultiStepToolPath, safeParseToolResult, } from "../../../../../src/platform/execution/execution-engine/multi-step-utils.js";
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
    assert.throws(() => resolveMultiStepToolPath("/workspace", "../etc/passwd"), ToolExecutionError);
});
test("resolveMultiStepToolPath throws for absolute path outside workspace", () => {
    assert.throws(() => resolveMultiStepToolPath("/workspace", "/tmp/evil"), ToolExecutionError);
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
    }
    catch (error) {
        const isToolError = error instanceof ToolExecutionError;
        assert.ok(isToolError, "Expected ToolExecutionError to be thrown");
        if (isToolError) {
            assert.ok(error.code.includes("path_outside_workspace"));
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
//# sourceMappingURL=multi-step-utils.test.js.map