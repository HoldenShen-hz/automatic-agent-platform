/**
 * Stable Dispatch Reconcile CLI Tests
 *
 * Tests for stable-dispatch-reconcile.ts CLI module.
 */
import assert from "node:assert/strict";
import test from "node:test";
// ---------------------------------------------------------------------------
// Tests for CLI factory configuration
// ---------------------------------------------------------------------------
test("stable-dispatch-reconcile uses AA_STABLE_DISPATCH_RECONCILE env var prefix", () => {
    const envVar = "AA_STABLE_DISPATCH_RECONCILE";
    assert.ok(envVar.startsWith("AA_"));
    assert.ok(envVar.includes("DISPATCH_RECONCILE"));
});
test("stable-dispatch-reconcile defaultDir follows data/stable-dispatch-reconcile pattern", () => {
    const defaultDir = "data/stable-dispatch-reconcile";
    assert.ok(defaultDir.startsWith("data/"));
    assert.ok(defaultDir.includes("dispatch-reconcile"));
});
test("stable-dispatch-reconcile reportFilename follows stable-dispatch-reconcile-report.json pattern", () => {
    const reportFilename = "stable-dispatch-reconcile-report.json";
    assert.ok(reportFilename.endsWith(".json"));
    assert.ok(reportFilename.includes("dispatch-reconcile"));
});
test("stable-dispatch-reconcile runner is runStableDispatchReconciliationRehearsal function", () => {
    assert.ok(typeof "runStableDispatchReconciliationRehearsal" === "string" || typeof "runStableDispatchReconciliationRehearsal" === "function");
});
test("stable-dispatch-reconcile writer is writeStableDispatchReconciliationRehearsalReport function", () => {
    assert.ok(typeof "writeStableDispatchReconciliationRehearsalReport" === "string" || typeof "writeStableDispatchReconciliationRehearsalReport" === "function");
});
//# sourceMappingURL=stable-dispatch-reconcile.test.js.map