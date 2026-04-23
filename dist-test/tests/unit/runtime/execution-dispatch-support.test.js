import test from "node:test";
import assert from "node:assert/strict";
import { normalizeStringArray, parseJsonArray, resolveDispatchTarget, resolveRequiredIsolationLevel, resolveRequiredRepoVersion, meetsIsolationRequirement, } from "../../../src/platform/execution/dispatcher/execution-dispatch-support.js";
// isRemoteSessionReadyForDispatch and listEligibleWorkers require database setup.
// These functions are tested indirectly via execution-dispatch-service integration tests.
// The pure utility functions below provide direct unit coverage.
test("normalizeStringArray deduplicates and sorts", () => {
    const result = normalizeStringArray(["  bar  ", "foo", "baz", "  bar  ", "qux"]);
    assert.deepEqual(result, ["bar", "baz", "foo", "qux"]);
});
test("normalizeStringArray filters empty strings", () => {
    const result = normalizeStringArray(["foo", "", "  ", "bar"]);
    assert.deepEqual(result, ["bar", "foo"]);
});
test("normalizeStringArray returns empty array for all empty", () => {
    assert.deepEqual(normalizeStringArray([]), []);
    assert.deepEqual(normalizeStringArray(["", "  "]), []);
});
test("parseJsonArray parses valid JSON array", () => {
    const result = parseJsonArray('["a", "b", "c"]');
    assert.deepEqual(result, ["a", "b", "c"]);
});
test("parseJsonArray returns empty for invalid JSON", () => {
    const errors = [];
    const result = parseJsonArray("not json", (msg) => errors.push(msg));
    assert.deepEqual(result, []);
    assert.equal(errors.length, 1);
});
test("parseJsonArray returns empty for non-array JSON", () => {
    const result = parseJsonArray('{"key":"value"}');
    assert.deepEqual(result, []);
});
test("parseJsonArray filters non-string elements", () => {
    const result = parseJsonArray('["a", 123, null, "b"]');
    assert.deepEqual(result, ["a", "b"]);
});
test("resolveDispatchTarget returns exact values for valid targets", () => {
    assert.equal(resolveDispatchTarget("local_only"), "local_only");
    assert.equal(resolveDispatchTarget("prefer_remote"), "prefer_remote");
    assert.equal(resolveDispatchTarget("require_remote"), "require_remote");
    assert.equal(resolveDispatchTarget("any"), "any");
    assert.equal(resolveDispatchTarget(null), "any");
    assert.equal(resolveDispatchTarget(undefined), "any");
});
test("resolveRequiredIsolationLevel returns exact values for valid levels", () => {
    assert.equal(resolveRequiredIsolationLevel("hardened"), "hardened");
    assert.equal(resolveRequiredIsolationLevel("strict"), "strict");
    assert.equal(resolveRequiredIsolationLevel("standard"), "standard");
    assert.equal(resolveRequiredIsolationLevel(null), "standard");
    assert.equal(resolveRequiredIsolationLevel(undefined), "standard");
});
test("resolveRequiredRepoVersion trims and returns non-empty strings", () => {
    assert.equal(resolveRequiredRepoVersion("  v1.0.0  "), "v1.0.0");
    assert.equal(resolveRequiredRepoVersion(null), null);
    assert.equal(resolveRequiredRepoVersion(undefined), null);
    assert.equal(resolveRequiredRepoVersion(""), null);
    assert.equal(resolveRequiredRepoVersion("   "), null);
});
test("meetsIsolationRequirement compares isolation levels correctly", () => {
    assert.equal(meetsIsolationRequirement("standard", "standard"), true);
    assert.equal(meetsIsolationRequirement("hardened", "standard"), true);
    assert.equal(meetsIsolationRequirement("strict", "standard"), true);
    assert.equal(meetsIsolationRequirement("standard", "hardened"), false);
    assert.equal(meetsIsolationRequirement("hardened", "strict"), false);
    assert.equal(meetsIsolationRequirement("strict", "strict"), true);
});
//# sourceMappingURL=execution-dispatch-support.test.js.map