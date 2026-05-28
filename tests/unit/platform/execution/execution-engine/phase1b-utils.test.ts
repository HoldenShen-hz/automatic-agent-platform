/**
 * Unit Tests: Multi-step utility functions
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  parseOptionalPositiveInteger,
  parseOptionalStringArray,
  resolveMultiStepToolPath,
  safeParseToolResult,
} from "../../../../../src/platform/five-plane-execution/execution-engine/multi-step-utils.js";

test("parseOptionalPositiveInteger accepts positive finite numbers [phase1b-utils]", () => {
  assert.equal(parseOptionalPositiveInteger(42), 42);
  assert.equal(parseOptionalPositiveInteger(1.9), 1);
  assert.equal(parseOptionalPositiveInteger(0), undefined);
  assert.equal(parseOptionalPositiveInteger(-1), undefined);
  assert.equal(parseOptionalPositiveInteger("42"), undefined);
});

test("parseOptionalStringArray normalizes nested arrays [phase1b-utils]", () => {
  assert.deepEqual(parseOptionalStringArray([" a ", ["b", "", 1], "c"]), ["a", "b", "c"]);
  assert.deepEqual(parseOptionalStringArray("not-an-array"), []);
});

test("resolveMultiStepToolPath rejects parent traversal [phase1b-utils]", () => {
  assert.throws(() => resolveMultiStepToolPath("/tmp/workspace", "../escape"));
});

test("resolveMultiStepToolPath resolves in-workspace paths [phase1b-utils]", () => {
  const resolved = resolveMultiStepToolPath("/tmp/workspace", "folder/file.txt");
  assert.equal(resolved, "/tmp/workspace/folder/file.txt");
});

test("safeParseToolResult parses JSON and falls back to raw string [phase1b-utils]", () => {
  assert.deepEqual(safeParseToolResult("{\"key\":\"value\"}"), { key: "value" });
  assert.equal(safeParseToolResult("not json"), "not json");
});
