import test from "node:test";
import assert from "node:assert/strict";
import {
  parseOptionalPositiveInteger,
  parseOptionalStringArray,
  resolveMultiStepToolPath,
  safeParseToolResult,
} from "../../../../src/platform/execution/execution-engine/multi-step-utils.js";

test("parseOptionalPositiveInteger accepts positive finite numbers", () => {
  assert.equal(parseOptionalPositiveInteger(1), 1);
  assert.equal(parseOptionalPositiveInteger(100), 100);
  assert.equal(parseOptionalPositiveInteger(0.5), 0); // truncated
});

test("parseOptionalPositiveInteger returns undefined for non-positive", () => {
  assert.equal(parseOptionalPositiveInteger(0), undefined);
  assert.equal(parseOptionalPositiveInteger(-1), undefined);
  assert.equal(parseOptionalPositiveInteger(-100), undefined);
});

test("parseOptionalPositiveInteger returns undefined for non-numbers", () => {
  assert.equal(parseOptionalPositiveInteger("100"), undefined);
  assert.equal(parseOptionalPositiveInteger(null), undefined);
  assert.equal(parseOptionalPositiveInteger(undefined), undefined);
  assert.equal(parseOptionalPositiveInteger(NaN), undefined);
  assert.equal(parseOptionalPositiveInteger(Infinity), undefined);
});

test("parseOptionalStringArray filters valid strings", () => {
  assert.deepEqual(parseOptionalStringArray(["a", "b", "c"]), ["a", "b", "c"]);
  assert.deepEqual(parseOptionalStringArray(["  hello  ", "world"]), ["hello", "world"]);
  assert.deepEqual(parseOptionalStringArray(["", "  ", "valid"]), ["valid"]);
});

test("parseOptionalStringArray returns empty array for non-array", () => {
  assert.deepEqual(parseOptionalStringArray(null), []);
  assert.deepEqual(parseOptionalStringArray(undefined), []);
  assert.deepEqual(parseOptionalStringArray("not an array"), []);
  assert.deepEqual(parseOptionalStringArray({}), []);
});

test("parseOptionalStringArray filters empty and whitespace-only strings", () => {
  assert.deepEqual(parseOptionalStringArray(["", "  "]), []);
  assert.deepEqual(parseOptionalStringArray(["a", "", "b"]), ["a", "b"]);
});

test("resolveMultiStepToolPath resolves within workspace", () => {
  const root = "/workspace/agent";
  assert.equal(resolveMultiStepToolPath(root, "file.txt"), "/workspace/agent/file.txt");
  assert.equal(resolveMultiStepToolPath(root, "./file.txt"), "/workspace/agent/file.txt");
});

test("resolveMultiStepToolPath rejects path outside workspace", () => {
  const root = "/workspace/agent";
  assert.throws(
    () => resolveMultiStepToolPath(root, "/etc/passwd"),
    /tool\.path_outside_workspace/,
  );
  assert.throws(
    () => resolveMultiStepToolPath(root, "../../../etc/passwd"),
    /tool\.path_outside_workspace/,
  );
});

test("resolveMultiStepToolPath handles null/undefined inputPath", () => {
  const root = "/workspace/agent";
  assert.equal(resolveMultiStepToolPath(root, null), "/workspace/agent");
  assert.equal(resolveMultiStepToolPath(root, undefined), "/workspace/agent");
});

test("safeParseToolResult parses valid JSON strings", () => {
  assert.deepEqual(safeParseToolResult('{"key":"value"}'), { key: "value" });
  assert.deepEqual(safeParseToolResult('["a","b"]'), ["a", "b"]);
  assert.deepEqual(safeParseToolResult("123"), 123);
  assert.deepEqual(safeParseToolResult("null"), null);
});

test("safeParseToolResult returns raw string on invalid JSON", () => {
  assert.equal(safeParseToolResult("not json"), "not json");
  assert.equal(safeParseToolResult("{broken"), "{broken");
  assert.equal(safeParseToolResult(""), "");
});