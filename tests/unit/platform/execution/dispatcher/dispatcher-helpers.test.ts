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
} from "../../../../../src/platform/execution/dispatcher/execution-dispatch-support.js";
import type { DispatchTarget, TaskPriority, WorkerIsolationLevel } from "../../../../../src/platform/contracts/types/domain.js";

// ─────────────────────────────────────────────────────────────────────────────
// normalizeStringArray tests
// ─────────────────────────────────────────────────────────────────────────────

test("normalizeStringArray removes duplicates and sorts", () => {
  const result = normalizeStringArray(["z", "a", "m", "a", "z"]);
  assert.deepEqual(result, ["a", "m", "z"]);
});

test("normalizeStringArray trims whitespace", () => {
  const result = normalizeStringArray(["  foo  ", " bar ", "baz"]);
  assert.deepEqual(result, ["bar", "baz", "foo"]);
});

test("normalizeStringArray filters empty strings", () => {
  const result = normalizeStringArray(["a", "", "  ", "b"]);
  assert.deepEqual(result, ["a", "b"]);
});

test("normalizeStringArray handles empty input", () => {
  const result = normalizeStringArray([]);
  assert.deepEqual(result, []);
});

test("normalizeStringArray handles all whitespace input", () => {
  const result = normalizeStringArray(["  ", "\t", "\n"]);
  assert.deepEqual(result, []);
});

test("normalizeStringArray preserves case", () => {
  const result = normalizeStringArray(["ABC", "abc", "Abc"]);
  assert.deepEqual(result, ["ABC", "Abc", "abc"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// parseJsonArray tests
// ─────────────────────────────────────────────────────────────────────────────

test("parseJsonArray parses valid JSON array", () => {
  const result = parseJsonArray('["a", "b", "c"]');
  assert.deepEqual(result, ["a", "b", "c"]);
});

test("parseJsonArray returns empty array for invalid JSON", () => {
  const result = parseJsonArray("not json");
  assert.deepEqual(result, []);
});

test("parseJsonArray returns empty array for non-array JSON", () => {
  const result = parseJsonArray('{"key": "value"}');
  assert.deepEqual(result, []);
});

test("parseJsonArray filters non-string elements", () => {
  const result = parseJsonArray('["a", 123, true, null, "b"]');
  assert.deepEqual(result, ["a", "b"]);
});

test("parseJsonArray handles empty JSON array", () => {
  const result = parseJsonArray("[]");
  assert.deepEqual(result, []);
});

test("parseJsonArray calls onError for invalid JSON", () => {
  let errorCalled = false;
  parseJsonArray("invalid", (msg) => { errorCalled = true; });
  assert.equal(errorCalled, true);
});

test("parseJsonArray does not call onError for valid JSON", () => {
  let errorCalled = false;
  parseJsonArray('["valid"]', (msg) => { errorCalled = true; });
  assert.equal(errorCalled, false);
});

test("parseJsonArray handles JSON array with whitespace", () => {
  const result = parseJsonArray('  ["a", "b"]  ');
  assert.deepEqual(result, ["a", "b"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveDispatchTarget tests
// ─────────────────────────────────────────────────────────────────────────────

test("resolveDispatchTarget returns local_only unchanged", () => {
  assert.equal(resolveDispatchTarget("local_only"), "local_only");
});

test("resolveDispatchTarget returns prefer_remote unchanged", () => {
  assert.equal(resolveDispatchTarget("prefer_remote"), "prefer_remote");
});

test("resolveDispatchTarget returns require_remote unchanged", () => {
  assert.equal(resolveDispatchTarget("require_remote"), "require_remote");
});

test("resolveDispatchTarget returns any for null", () => {
  assert.equal(resolveDispatchTarget(null), "any");
});

test("resolveDispatchTarget returns any for undefined", () => {
  assert.equal(resolveDispatchTarget(undefined), "any");
});

test("resolveDispatchTarget returns any for unknown values", () => {
  assert.equal(resolveDispatchTarget("unknown" as DispatchTarget), "any");
  assert.equal(resolveDispatchTarget("any" as DispatchTarget), "any");
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveRequiredIsolationLevel tests
// ─────────────────────────────────────────────────────────────────────────────

test("resolveRequiredIsolationLevel returns hardened unchanged", () => {
  assert.equal(resolveRequiredIsolationLevel("hardened"), "hardened");
});

test("resolveRequiredIsolationLevel returns strict unchanged", () => {
  assert.equal(resolveRequiredIsolationLevel("strict"), "strict");
});

test("resolveRequiredIsolationLevel returns standard for null", () => {
  assert.equal(resolveRequiredIsolationLevel(null), "standard");
});

test("resolveRequiredIsolationLevel returns standard for undefined", () => {
  assert.equal(resolveRequiredIsolationLevel(undefined), "standard");
});

test("resolveRequiredIsolationLevel returns standard for unknown", () => {
  assert.equal(resolveRequiredIsolationLevel("unknown" as WorkerIsolationLevel), "standard");
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveRequiredRepoVersion tests
// ─────────────────────────────────────────────────────────────────────────────

test("resolveRequiredRepoVersion returns trimmed version", () => {
  assert.equal(resolveRequiredRepoVersion("  v1.2.3  "), "v1.2.3");
});

test("resolveRequiredRepoVersion returns null for empty string", () => {
  assert.equal(resolveRequiredRepoVersion(""), null);
  assert.equal(resolveRequiredRepoVersion("   "), null);
});

test("resolveRequiredRepoVersion returns null for null input", () => {
  assert.equal(resolveRequiredRepoVersion(null), null);
});

test("resolveRequiredRepoVersion returns null for undefined", () => {
  assert.equal(resolveRequiredRepoVersion(undefined), null);
});

test("resolveRequiredRepoVersion preserves version string", () => {
  assert.equal(resolveRequiredRepoVersion("feature-branch"), "feature-branch");
});

// ─────────────────────────────────────────────────────────────────────────────
// meetsIsolationRequirement tests
// ─────────────────────────────────────────────────────────────────────────────

test("meetsIsolationRequirement standard to standard", () => {
  assert.equal(meetsIsolationRequirement("standard", "standard"), true);
});

test("meetsIsolationRequirement hardened to standard", () => {
  assert.equal(meetsIsolationRequirement("hardened", "standard"), true);
});

test("meetsIsolationRequirement strict to standard", () => {
  assert.equal(meetsIsolationRequirement("strict", "standard"), true);
});

test("meetsIsolationRequirement standard to hardened fails", () => {
  assert.equal(meetsIsolationRequirement("standard", "hardened"), false);
});

test("meetsIsolationRequirement hardened to strict fails", () => {
  assert.equal(meetsIsolationRequirement("hardened", "strict"), false);
});

test("meetsIsolationRequirement strict to strict", () => {
  assert.equal(meetsIsolationRequirement("strict", "strict"), true);
});

test("meetsIsolationRequirement strict to hardened", () => {
  assert.equal(meetsIsolationRequirement("strict", "hardened"), true);
});

test("meetsIsolationRequirement hardened to hardened", () => {
  assert.equal(meetsIsolationRequirement("hardened", "hardened"), true);
});

// ─────────────────────────────────────────────────────────────────────────────
// isElevatedPriority tests
// ─────────────────────────────────────────────────────────────────────────────

test("isElevatedPriority returns true for high", () => {
  assert.equal(isElevatedPriority("high"), true);
});

test("isElevatedPriority returns true for urgent", () => {
  assert.equal(isElevatedPriority("urgent"), true);
});

test("isElevatedPriority returns false for normal", () => {
  assert.equal(isElevatedPriority("normal"), false);
});

test("isElevatedPriority returns false for low", () => {
  assert.equal(isElevatedPriority("low"), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Additional edge cases
// ─────────────────────────────────────────────────────────────────────────────

test("normalizeStringArray with unicode strings", () => {
  const result = normalizeStringArray(["日本語", "中文", "한국어"]);
  assert.deepEqual(result, ["日本語", "中文", "한국어"]);
});

test("parseJsonArray with escaped strings", () => {
  const result = parseJsonArray('["foo\\"bar", "baz"]');
  // The parsed result will have the escaped quote
  assert.ok(result.length >= 1);
});

test("meetsIsolationRequirement boundary - equal levels", () => {
  assert.equal(meetsIsolationRequirement("standard", "standard"), true);
  assert.equal(meetsIsolationRequirement("hardened", "hardened"), true);
  assert.equal(meetsIsolationRequirement("strict", "strict"), true);
});

test("resolveDispatchTarget handles all DispatchTarget values", () => {
  const targets: DispatchTarget[] = ["any", "local_only", "prefer_remote", "require_remote"];
  targets.forEach(target => {
    const result = resolveDispatchTarget(target);
    // All should return one of the valid values
    assert.ok(["any", "local_only", "prefer_remote", "require_remote"].includes(result));
  });
});

test("resolveRequiredRepoVersion preserves special characters in version", () => {
  const version = "v1.0.0-beta.1+build.123";
  assert.equal(resolveRequiredRepoVersion(version), version);
});

test("normalizeStringArray handles large input", () => {
  const largeArray = Array.from({ length: 1000 }, (_, i) => `item${i}`);
  largeArray.push("item0"); // Add duplicate
  const result = normalizeStringArray(largeArray);
  assert.equal(result.length, 1000);
  assert.ok(result.includes("item0"));
});

test("parseJsonArray handles deeply nested structure", () => {
  const result = parseJsonArray('[["a", "b"], ["c"]]');
  // Should return empty because outer is array but inner elements are arrays not strings
  assert.deepEqual(result, []);
});

test("resolveRequiredRepoVersion handles numeric-like strings", () => {
  assert.equal(resolveRequiredRepoVersion("1.2.3.4.5"), "1.2.3.4.5");
});

test("normalizeStringArray preserves numbers as strings", () => {
  const result = normalizeStringArray(["123", "456"]);
  assert.deepEqual(result, ["123", "456"]);
});

test("parseJsonArray handles JSON null element", () => {
  const result = parseJsonArray('["a", null, "b"]');
  assert.deepEqual(result, ["a", "b"]);
});

test("resolveRequiredIsolationLevel handles invalid string", () => {
  assert.equal(resolveRequiredIsolationLevel("invalid_level" as WorkerIsolationLevel), "standard");
});

test("resolveDispatchTarget default case", () => {
  assert.equal(resolveDispatchTarget("local" as DispatchTarget), "any");
});

test("normalizeStringArray deduplicates across whitespace variations", () => {
  const result = normalizeStringArray(["a", "a ", " a", "a"]);
  assert.deepEqual(result, ["a"]);
});

test("parseJsonArray handles single element array", () => {
  const result = parseJsonArray('["single"]');
  assert.deepEqual(result, ["single"]);
});

test("meetsIsolationRequirement all combinations", () => {
  const levels: WorkerIsolationLevel[] = ["standard", "hardened", "strict"];
  for (const workerLevel of levels) {
    for (const requiredLevel of levels) {
      const result = meetsIsolationRequirement(workerLevel, requiredLevel);
      assert.equal(typeof result, "boolean");
    }
  }
});