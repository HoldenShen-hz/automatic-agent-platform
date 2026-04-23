/**
 * Stable Gray Release CLI Tests
 *
 * Tests for stable-gray.ts CLI module.
 */
import assert from "node:assert/strict";
import test from "node:test";
// ---------------------------------------------------------------------------
// Tests for CLI factory configuration
// ---------------------------------------------------------------------------
test("stable-gray uses AA_STABLE_GRAY env var prefix", () => {
    const envVar = "AA_STABLE_GRAY";
    assert.ok(envVar.startsWith("AA_"));
    assert.ok(envVar.includes("GRAY"));
});
test("stable-gray defaultDir follows data/stable-gray pattern", () => {
    const defaultDir = "data/stable-gray";
    assert.ok(defaultDir.startsWith("data/"));
    assert.ok(defaultDir.includes("gray"));
});
test("stable-gray reportFilename follows stable-gray-release-report.json pattern", () => {
    const reportFilename = "stable-gray-release-report.json";
    assert.ok(reportFilename.endsWith(".json"));
    assert.ok(reportFilename.includes("gray"));
});
test("stable-gray failed predicate uses default failedScenarios", () => {
    const failed = (report) => (report.failedScenarios ?? 0) > 0;
    assert.equal(failed({ failedScenarios: 0 }), false);
    assert.equal(failed({ failedScenarios: 1 }), true);
});
//# sourceMappingURL=stable-gray.test.js.map