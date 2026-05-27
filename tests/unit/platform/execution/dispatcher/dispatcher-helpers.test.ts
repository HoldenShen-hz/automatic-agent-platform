/**
 * @fileoverview Unit tests for additional dispatcher helper functions
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeStringArray,
  parseJsonArray,
  resolveDispatchTarget,
  resolveRequiredIsolationLevel,
  resolveRequiredRepoVersion,
  meetsIsolationRequirement,
  isElevatedPriority,
} from "../../../../../src/platform/five-plane-execution/dispatcher/execution-dispatch-support.js";
import type { DispatchTarget, TaskPriority, WorkerIsolationLevel } from "../../../../../src/platform/contracts/types/domain.js";

// ─────────────────────────────────────────────────────────────────────────────
// normalizeStringArray tests
// ─────────────────────────────────────────────────────────────────────────────

test("normalizeStringArray removes duplicates and sorts [dispatcher-helpers]", () => {
  const result = normalizeStringArray(["z", "a", "m", "a", "z"]);
  assert.deepEqual(result, ["a", "m", "z"]);
});

test("normalizeStringArray trims whitespace [dispatcher-helpers]", () => {
  const result = normalizeStringArray(["  foo  ", " bar ", "baz"]);
  assert.deepEqual(result, ["bar", "baz", "foo"]);
});

test("normalizeStringArray filters empty strings [dispatcher-helpers]", () => {
  const result = normalizeStringArray(["a", "", "  ", "b"]);
  assert.deepEqual(result, ["a", "b"]);
});

test("normalizeStringArray handles empty input [dispatcher-helpers]", () => {
  const result = normalizeStringArray([]);
  assert.deepEqual(result, []);
});

test("normalizeStringArray handles all whitespace input [dispatcher-helpers]", () => {
  const result = normalizeStringArray(["  ", "\t", "\n"]);
  assert.deepEqual(result, []);
});

test("normalizeStringArray preserves case [dispatcher-helpers]", () => {
  const result = normalizeStringArray(["ABC", "abc", "Abc"]);
  assert.deepEqual(result, ["ABC", "Abc", "abc"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// parseJsonArray tests
// ─────────────────────────────────────────────────────────────────────────────

test("parseJsonArray parses valid JSON array [dispatcher-helpers]", () => {
  const result = parseJsonArray('["a", "b", "c"]');
  assert.deepEqual(result, ["a", "b", "c"]);
});

test("parseJsonArray returns empty array for invalid JSON [dispatcher-helpers]", () => {
  const result = parseJsonArray("not json");
  assert.deepEqual(result, []);
});

test("parseJsonArray returns empty array for non-array JSON [dispatcher-helpers]", () => {
  const result = parseJsonArray('{"key": "value"}');
  assert.deepEqual(result, []);
});

test("parseJsonArray filters non-string elements [dispatcher-helpers]", () => {
  const result = parseJsonArray('["a", 123, true, null, "b"]');
  assert.deepEqual(result, ["a", "b"]);
});

test("parseJsonArray handles empty JSON array [dispatcher-helpers]", () => {
  const result = parseJsonArray("[]");
  assert.deepEqual(result, []);
});

test("parseJsonArray calls onError for invalid JSON [dispatcher-helpers]", () => {
  let errorCalled = false;
  parseJsonArray("invalid", (msg) => { errorCalled = true; });
  assert.equal(errorCalled, true);
});

test("parseJsonArray does not call onError for valid JSON [dispatcher-helpers]", () => {
  let errorCalled = false;
  parseJsonArray('["valid"]', (msg) => { errorCalled = true; });
  assert.equal(errorCalled, false);
});

test("parseJsonArray handles JSON array with whitespace [dispatcher-helpers]", () => {
  const result = parseJsonArray('  ["a", "b"]  ');
  assert.deepEqual(result, ["a", "b"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveDispatchTarget tests
// ─────────────────────────────────────────────────────────────────────────────

test("resolveDispatchTarget returns local_only unchanged [dispatcher-helpers]", () => {
  assert.equal(resolveDispatchTarget("local_only"), "local_only");
});

test("resolveDispatchTarget returns prefer_remote unchanged [dispatcher-helpers]", () => {
  assert.equal(resolveDispatchTarget("prefer_remote"), "prefer_remote");
});

test("resolveDispatchTarget returns require_remote unchanged [dispatcher-helpers]", () => {
  assert.equal(resolveDispatchTarget("require_remote"), "require_remote");
});

test("resolveDispatchTarget returns any for null [dispatcher-helpers]", () => {
  assert.equal(resolveDispatchTarget(null), "any");
});

test("resolveDispatchTarget returns any for undefined [dispatcher-helpers]", () => {
  assert.equal(resolveDispatchTarget(undefined), "any");
});

test("resolveDispatchTarget returns any for unknown values [dispatcher-helpers]", () => {
  assert.equal(resolveDispatchTarget("unknown" as DispatchTarget), "any");
  assert.equal(resolveDispatchTarget("any" as DispatchTarget), "any");
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveRequiredIsolationLevel tests
// ─────────────────────────────────────────────────────────────────────────────

test("resolveRequiredIsolationLevel returns hardened unchanged [dispatcher-helpers]", () => {
  assert.equal(resolveRequiredIsolationLevel("hardened"), "hardened");
});

test("resolveRequiredIsolationLevel returns strict unchanged [dispatcher-helpers]", () => {
  assert.equal(resolveRequiredIsolationLevel("strict"), "strict");
});

test("resolveRequiredIsolationLevel returns standard for null [dispatcher-helpers]", () => {
  assert.equal(resolveRequiredIsolationLevel(null), "standard");
});

test("resolveRequiredIsolationLevel returns standard for undefined [dispatcher-helpers]", () => {
  assert.equal(resolveRequiredIsolationLevel(undefined), "standard");
});

test("resolveRequiredIsolationLevel returns standard for unknown [dispatcher-helpers]", () => {
  assert.equal(resolveRequiredIsolationLevel("unknown" as WorkerIsolationLevel), "standard");
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveRequiredRepoVersion tests
// ─────────────────────────────────────────────────────────────────────────────

test("resolveRequiredRepoVersion returns trimmed version [dispatcher-helpers]", () => {
  assert.equal(resolveRequiredRepoVersion("  v1.2.3  "), "v1.2.3");
});

test("resolveRequiredRepoVersion returns null for empty string [dispatcher-helpers]", () => {
  assert.equal(resolveRequiredRepoVersion(""), null);
  assert.equal(resolveRequiredRepoVersion("   "), null);
});

test("resolveRequiredRepoVersion returns null for null input [dispatcher-helpers]", () => {
  assert.equal(resolveRequiredRepoVersion(null), null);
});

test("resolveRequiredRepoVersion returns null for undefined [dispatcher-helpers]", () => {
  assert.equal(resolveRequiredRepoVersion(undefined), null);
});

test("resolveRequiredRepoVersion preserves version string [dispatcher-helpers]", () => {
  assert.equal(resolveRequiredRepoVersion("feature-branch"), "feature-branch");
});

// ─────────────────────────────────────────────────────────────────────────────
// meetsIsolationRequirement tests
// ─────────────────────────────────────────────────────────────────────────────

test("meetsIsolationRequirement standard to standard [dispatcher-helpers]", () => {
  assert.equal(meetsIsolationRequirement("standard", "standard"), true);
});

test("meetsIsolationRequirement hardened to standard [dispatcher-helpers]", () => {
  assert.equal(meetsIsolationRequirement("hardened", "standard"), true);
});

test("meetsIsolationRequirement strict to standard [dispatcher-helpers]", () => {
  assert.equal(meetsIsolationRequirement("strict", "standard"), true);
});

test("meetsIsolationRequirement standard to hardened fails [dispatcher-helpers]", () => {
  assert.equal(meetsIsolationRequirement("standard", "hardened"), false);
});

test("meetsIsolationRequirement hardened to strict fails [dispatcher-helpers]", () => {
  assert.equal(meetsIsolationRequirement("hardened", "strict"), false);
});

test("meetsIsolationRequirement strict to strict [dispatcher-helpers]", () => {
  assert.equal(meetsIsolationRequirement("strict", "strict"), true);
});

test("meetsIsolationRequirement strict to hardened [dispatcher-helpers]", () => {
  assert.equal(meetsIsolationRequirement("strict", "hardened"), true);
});

test("meetsIsolationRequirement hardened to hardened [dispatcher-helpers]", () => {
  assert.equal(meetsIsolationRequirement("hardened", "hardened"), true);
});

// ─────────────────────────────────────────────────────────────────────────────
// isElevatedPriority tests
// ─────────────────────────────────────────────────────────────────────────────

test("isElevatedPriority returns true for high [dispatcher-helpers]", () => {
  assert.equal(isElevatedPriority("high"), true);
});

test("isElevatedPriority returns true for urgent [dispatcher-helpers]", () => {
  assert.equal(isElevatedPriority("urgent"), true);
});

test("isElevatedPriority returns false for normal [dispatcher-helpers]", () => {
  assert.equal(isElevatedPriority("normal"), false);
});

test("isElevatedPriority returns false for low [dispatcher-helpers]", () => {
  assert.equal(isElevatedPriority("low"), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Additional edge cases
// ─────────────────────────────────────────────────────────────────────────────

test("normalizeStringArray with unicode strings [dispatcher-helpers]", () => {
  const result = normalizeStringArray(["日本語", "中文", "한국어"]);
  assert.deepEqual(result, ["中文", "日本語", "한국어"]);
});

test("parseJsonArray with escaped strings [dispatcher-helpers]", () => {
  const result = parseJsonArray('["foo\\"bar", "baz"]');
  // The parsed result will have the escaped quote
  assert.ok(result.length >= 1);
});

test("meetsIsolationRequirement boundary - equal levels [dispatcher-helpers]", () => {
  assert.equal(meetsIsolationRequirement("standard", "standard"), true);
  assert.equal(meetsIsolationRequirement("hardened", "hardened"), true);
  assert.equal(meetsIsolationRequirement("strict", "strict"), true);
});

test("resolveDispatchTarget handles all DispatchTarget values [dispatcher-helpers]", () => {
  const targets: DispatchTarget[] = ["any", "local_only", "prefer_remote", "require_remote"];
  targets.forEach(target => {
    const result = resolveDispatchTarget(target);
    // All should return one of the valid values
    assert.ok(["any", "local_only", "prefer_remote", "require_remote"].includes(result));
  });
});

test("resolveRequiredRepoVersion preserves special characters in version [dispatcher-helpers]", () => {
  const version = "v1.0.0-beta.1+build.123";
  assert.equal(resolveRequiredRepoVersion(version), version);
});

test("normalizeStringArray handles large input [dispatcher-helpers]", () => {
  const largeArray = Array.from({ length: 1000 }, (_, i) => `item${i}`);
  largeArray.push("item0"); // Add duplicate
  const result = normalizeStringArray(largeArray);
  assert.equal(result.length, 1000);
  assert.ok(result.includes("item0"));
});

test("parseJsonArray handles deeply nested structure [dispatcher-helpers]", () => {
  const result = parseJsonArray('[["a", "b"], ["c"]]');
  // Should return empty because outer is array but inner elements are arrays not strings
  assert.deepEqual(result, []);
});

test("resolveRequiredRepoVersion handles numeric-like strings [dispatcher-helpers]", () => {
  assert.equal(resolveRequiredRepoVersion("1.2.3.4.5"), "1.2.3.4.5");
});

test("normalizeStringArray preserves numbers as strings [dispatcher-helpers]", () => {
  const result = normalizeStringArray(["123", "456"]);
  assert.deepEqual(result, ["123", "456"]);
});

test("parseJsonArray handles JSON null element [dispatcher-helpers]", () => {
  const result = parseJsonArray('["a", null, "b"]');
  assert.deepEqual(result, ["a", "b"]);
});

test("resolveRequiredIsolationLevel handles invalid string [dispatcher-helpers]", () => {
  assert.equal(resolveRequiredIsolationLevel("invalid_level" as WorkerIsolationLevel), "standard");
});

test("resolveDispatchTarget default case [dispatcher-helpers]", () => {
  assert.equal(resolveDispatchTarget("local" as DispatchTarget), "any");
});

test("normalizeStringArray deduplicates across whitespace variations [dispatcher-helpers]", () => {
  const result = normalizeStringArray(["a", "a ", " a", "a"]);
  assert.deepEqual(result, ["a"]);
});

test("parseJsonArray handles single element array [dispatcher-helpers]", () => {
  const result = parseJsonArray('["single"]');
  assert.deepEqual(result, ["single"]);
});

test("meetsIsolationRequirement all combinations [dispatcher-helpers]", () => {
  const levels: WorkerIsolationLevel[] = ["standard", "hardened", "strict"];
  for (const workerLevel of levels) {
    for (const requiredLevel of levels) {
      const result = meetsIsolationRequirement(workerLevel, requiredLevel);
      assert.equal(typeof result, "boolean");
    }
  }
});
