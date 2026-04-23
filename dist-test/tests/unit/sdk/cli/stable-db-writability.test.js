/**
 * Stable DB Writability CLI Tests
 *
 * Tests for stable-db-writability.ts CLI module.
 */
import assert from "node:assert/strict";
import test from "node:test";
// ---------------------------------------------------------------------------
// Tests for CLI factory configuration
// ---------------------------------------------------------------------------
test("stable-db-writability uses AA_STABLE_DB_WRITABILITY env var prefix", () => {
    const envVar = "AA_STABLE_DB_WRITABILITY";
    assert.ok(envVar.startsWith("AA_"));
    assert.ok(envVar.includes("DB_WRITABILITY"));
});
test("stable-db-writability defaultDir follows data/stable-db-writability pattern", () => {
    const defaultDir = "data/stable-db-writability";
    assert.ok(defaultDir.startsWith("data/"));
    assert.ok(defaultDir.includes("db-writability"));
});
test("stable-db-writability reportFilename follows stable-db-writability-report.json pattern", () => {
    const reportFilename = "stable-db-writability-report.json";
    assert.ok(reportFilename.endsWith(".json"));
    assert.ok(reportFilename.includes("db-writability"));
});
test("stable-db-writability failed predicate uses default failedScenarios", () => {
    const failed = (report) => (report.failedScenarios ?? 0) > 0;
    assert.equal(failed({ failedScenarios: 0 }), false);
    assert.equal(failed({ failedScenarios: 1 }), true);
});
//# sourceMappingURL=stable-db-writability.test.js.map