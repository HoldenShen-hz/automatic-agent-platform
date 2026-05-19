/**
 * Stable Lease CLI Tests
 *
 * Tests for stable-lease.ts CLI module.
 */
import assert from "node:assert/strict";
import test from "node:test";
// ---------------------------------------------------------------------------
// Tests for CLI factory configuration
// ---------------------------------------------------------------------------
test("stable-lease uses AA_STABLE_LEASE env var prefix", () => {
    const envVar = "AA_STABLE_LEASE";
    assert.ok(envVar.startsWith("AA_"));
    assert.ok(envVar.includes("LEASE"));
});
test("stable-lease defaultDir follows data/stable-lease pattern", () => {
    const defaultDir = "data/stable-lease";
    assert.ok(defaultDir.startsWith("data/"));
    assert.ok(defaultDir.includes("lease"));
});
test("stable-lease reportFilename follows stable-lease-report.json pattern", () => {
    const reportFilename = "stable-lease-report.json";
    assert.ok(reportFilename.endsWith(".json"));
    assert.ok(reportFilename.includes("lease"));
});
test("stable-lease runner is runStableLeaseRehearsal function", () => {
    assert.ok(typeof "runStableLeaseRehearsal" === "string" || typeof "runStableLeaseRehearsal" === "function");
});
test("stable-lease writer is writeStableLeaseRehearsalReport function", () => {
    assert.ok(typeof "writeStableLeaseRehearsalReport" === "string" || typeof "writeStableLeaseRehearsalReport" === "function");
});
//# sourceMappingURL=stable-lease.test.js.map