import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import {
  parseOptionalPositiveInteger,
  parseOptionalStringArray,
  resolveMultiStepToolPath,
  safeParseToolResult,
} from "../../../src/platform/five-plane-execution/execution-engine/multi-step-utils.js";

// parseOptionalPositiveInteger tests

test("parseOptionalPositiveInteger returns integer for positive number", () => {
  assert.equal(parseOptionalPositiveInteger(5), 5);
  assert.equal(parseOptionalPositiveInteger(100), 100);
  assert.equal(parseOptionalPositiveInteger(1), 1);
});

test("parseOptionalPositiveInteger truncates to integer", () => {
  assert.equal(parseOptionalPositiveInteger(3.7), 3);
  assert.equal(parseOptionalPositiveInteger(9.99), 9);
});

test("parseOptionalPositiveInteger returns undefined for zero", () => {
  assert.equal(parseOptionalPositiveInteger(0), undefined);
});

test("parseOptionalPositiveInteger returns undefined for negative", () => {
  assert.equal(parseOptionalPositiveInteger(-1), undefined);
  assert.equal(parseOptionalPositiveInteger(-100), undefined);
});

test("parseOptionalPositiveInteger returns undefined for NaN", () => {
  assert.equal(parseOptionalPositiveInteger(NaN), undefined);
});

test("parseOptionalPositiveInteger returns undefined for Infinity", () => {
  assert.equal(parseOptionalPositiveInteger(Infinity), undefined);
});

test("parseOptionalPositiveInteger returns undefined for string", () => {
  assert.equal(parseOptionalPositiveInteger("5"), undefined);
  assert.equal(parseOptionalPositiveInteger("hello"), undefined);
});

test("parseOptionalPositiveInteger returns undefined for null", () => {
  assert.equal(parseOptionalPositiveInteger(null), undefined);
});

test("parseOptionalPositiveInteger returns undefined for undefined", () => {
  assert.equal(parseOptionalPositiveInteger(undefined), undefined);
});

test("parseOptionalPositiveInteger returns undefined for object", () => {
  assert.equal(parseOptionalPositiveInteger({}), undefined);
});

// parseOptionalStringArray tests

test("parseOptionalStringArray returns string array for valid input", () => {
  const result = parseOptionalStringArray(["a", "b", "c"]);
  assert.deepEqual(result, ["a", "b", "c"]);
});

test("parseOptionalStringArray filters out non-string values", () => {
  const result = parseOptionalStringArray(["a", 1, true, null, "b"]);
  assert.deepEqual(result, ["a", "b"]);
});

test("parseOptionalStringArray filters out whitespace-only strings", () => {
  const result = parseOptionalStringArray(["a", "  ", "\t", "b"]);
  assert.deepEqual(result, ["a", "b"]);
});

test("parseOptionalStringArray returns empty array for non-array", () => {
  assert.deepEqual(parseOptionalStringArray("string"), []);
  assert.deepEqual(parseOptionalStringArray(123), []);
  assert.deepEqual(parseOptionalStringArray({}), []);
  assert.deepEqual(parseOptionalStringArray(null), []);
  assert.deepEqual(parseOptionalStringArray(undefined), []);
});

test("parseOptionalStringArray returns empty array for empty array", () => {
  assert.deepEqual(parseOptionalStringArray([]), []);
});

test("parseOptionalStringArray preserves non-whitespace strings", () => {
  const result = parseOptionalStringArray(["hello world", " spaces ", "  leading"]);
  assert.deepEqual(result, ["hello world", "spaces", "leading"]);
});

// resolveMultiStepToolPath tests

test("resolveMultiStepToolPath returns rootPath for null input", () => {
  const rootPath = "/workspace/project";
  const result = resolveMultiStepToolPath(rootPath, null);
  assert.equal(result, rootPath);
});

test("resolveMultiStepToolPath returns rootPath for undefined input", () => {
  const rootPath = "/workspace/project";
  const result = resolveMultiStepToolPath(rootPath, undefined);
  assert.equal(result, rootPath);
});

test("resolveMultiStepToolPath returns rootPath for dot input", () => {
  const rootPath = "/workspace/project";
  const result = resolveMultiStepToolPath(rootPath, ".");
  assert.equal(result, rootPath);
});

test("resolveMultiStepToolPath resolves relative path within workspace", () => {
  const rootPath = "/workspace/project";
  const result = resolveMultiStepToolPath(rootPath, "src/main.ts");
  assert.equal(result, "/workspace/project/src/main.ts");
});

test("resolveMultiStepToolPath resolves nested relative path", () => {
  const rootPath = "/workspace/project";
  const result = resolveMultiStepToolPath(rootPath, "a/b/c");
  assert.equal(result, "/workspace/project/a/b/c");
});

test("resolveMultiStepToolPath throws for path outside workspace", () => {
  const rootPath = "/workspace/project";
  assert.throws(
    () => resolveMultiStepToolPath(rootPath, "../secret"),
    (err: any) => err.code.startsWith("tool.path_outside_workspace"),
  );
});

test("resolveMultiStepToolPath throws for absolute path outside workspace", () => {
  const rootPath = "/workspace/project";
  assert.throws(
    () => resolveMultiStepToolPath(rootPath, "/etc/passwd"),
    (err: any) => err.code.startsWith("tool.path_outside_workspace"),
  );
});

// safeParseToolResult tests

test("safeParseToolResult parses valid JSON object", () => {
  const result = safeParseToolResult('{"key": "value", "num": 42}');
  assert.deepEqual(result, { key: "value", num: 42 });
});

test("safeParseToolResult parses valid JSON array", () => {
  const result = safeParseToolResult("[1, 2, 3]");
  assert.deepEqual(result, [1, 2, 3]);
});

test("safeParseToolResult parses JSON string", () => {
  const result = safeParseToolResult('"hello"');
  assert.equal(result, "hello");
});

test("safeParseToolResult parses JSON number", () => {
  const result = safeParseToolResult("42");
  assert.equal(result, 42);
});

test("safeParseToolResult parses JSON boolean", () => {
  assert.equal(safeParseToolResult("true"), true);
  assert.equal(safeParseToolResult("false"), false);
});

test("safeParseToolResult returns raw string for invalid JSON", () => {
  const result = safeParseToolResult("not valid json");
  assert.equal(result, "not valid json");
});

test("safeParseToolResult returns raw string for partial JSON", () => {
  const result = safeParseToolResult("{broken");
  assert.equal(result, "{broken");
});

test("safeParseToolResult handles empty string as invalid JSON", () => {
  const result = safeParseToolResult("");
  assert.equal(result, "");
});

test("safeParseToolResult parses JSON null", () => {
  const result = safeParseToolResult("null");
  assert.equal(result, null);
});
