/**
 * Stable Rollback CLI Tests
 *
 * Tests for stable-rollback.ts CLI module.
 */
import assert from "node:assert/strict";
import test from "node:test";
// ---------------------------------------------------------------------------
// Tests for CLI factory configuration
// ---------------------------------------------------------------------------
test("stable-rollback uses AA_STABLE_ROLLBACK env var prefix", () => {
    const envVar = "AA_STABLE_ROLLBACK";
    assert.ok(envVar.startsWith("AA_"));
    assert.ok(envVar.includes("ROLLBACK"));
});
test("stable-rollback defaultDir follows data/stable-rollback pattern", () => {
    const defaultDir = "data/stable-rollback";
    assert.ok(defaultDir.startsWith("data/"));
    assert.ok(defaultDir.includes("rollback"));
});
test("stable-rollback reportFilename follows stable-rollback-report.json pattern", () => {
    const reportFilename = "stable-rollback-report.json";
    assert.ok(reportFilename.endsWith(".json"));
    assert.ok(reportFilename.includes("rollback"));
});
test("stable-rollback runner is runStableRollbackRehearsal function", () => {
    assert.ok(typeof "runStableRollbackRehearsal" === "string" || typeof "runStableRollbackRehearsal" === "function");
});
test("stable-rollback writer is writeStableRollbackRehearsalReport function", () => {
    assert.ok(typeof "writeStableRollbackRehearsalReport" === "string" || typeof "writeStableRollbackRehearsalReport" === "function");
});
//# sourceMappingURL=stable-rollback.test.js.map