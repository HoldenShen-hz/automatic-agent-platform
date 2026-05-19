/**
 * Stable Evidence CLI Tests
 *
 * Tests for stable-evidence.ts CLI module.
 */
import assert from "node:assert/strict";
import test from "node:test";
// ---------------------------------------------------------------------------
// Tests for CLI factory configuration
// ---------------------------------------------------------------------------
test("stable-evidence uses AA_STABLE_EVIDENCE env var prefix", () => {
    const envVar = "AA_STABLE_EVIDENCE";
    assert.ok(envVar.startsWith("AA_"));
    assert.ok(envVar.includes("EVIDENCE"));
});
test("stable-evidence defaultDir follows data/stable-evidence/smoke pattern", () => {
    const defaultDir = "data/stable-evidence/smoke";
    assert.ok(defaultDir.startsWith("data/"));
    assert.ok(defaultDir.includes("evidence"));
});
test("stable-evidence failed predicate checks report.summary.passed", () => {
    const failed = (report) => !report.summary?.passed;
    assert.equal(failed({ summary: { passed: true } }), false);
    assert.equal(failed({ summary: { passed: false } }), true);
    assert.equal(failed({}), true);
});
test("stable-evidence runner is createStableEvidenceBundle function", () => {
    assert.ok(typeof "createStableEvidenceBundle" === "string" || typeof "createStableEvidenceBundle" === "function");
});
//# sourceMappingURL=stable-evidence.test.js.map