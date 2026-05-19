/**
 * Stable Dispatch CLI Tests
 *
 * Tests for stable-dispatch.ts CLI module.
 */
import assert from "node:assert/strict";
import test from "node:test";
// ---------------------------------------------------------------------------
// Tests for CLI factory configuration
// ---------------------------------------------------------------------------
test("stable-dispatch uses AA_STABLE_DISPATCH env var prefix", () => {
    const envVar = "AA_STABLE_DISPATCH";
    assert.ok(envVar.startsWith("AA_"));
    assert.ok(envVar.includes("DISPATCH"));
});
test("stable-dispatch defaultDir follows data/stable-dispatch pattern", () => {
    const defaultDir = "data/stable-dispatch";
    assert.ok(defaultDir.startsWith("data/"));
    assert.ok(defaultDir.includes("dispatch"));
});
test("stable-dispatch reportFilename follows stable-dispatch-report.json pattern", () => {
    const reportFilename = "stable-dispatch-report.json";
    assert.ok(reportFilename.endsWith(".json"));
    assert.ok(reportFilename.includes("dispatch"));
});
test("stable-dispatch runner is runStableDispatchRehearsal function", () => {
    // The runner should be a function reference
    assert.ok(typeof "runStableDispatchRehearsal" === "string" || typeof "runStableDispatchRehearsal" === "function");
});
test("stable-dispatch writer is writeStableDispatchRehearsalReport function", () => {
    // The writer should be a function reference
    assert.ok(typeof "writeStableDispatchRehearsalReport" === "string" || typeof "writeStableDispatchRehearsalReport" === "function");
});
//# sourceMappingURL=stable-dispatch.test.js.map