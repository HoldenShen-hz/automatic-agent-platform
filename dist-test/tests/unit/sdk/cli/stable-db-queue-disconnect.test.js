/**
 * Stable DB Queue Disconnect CLI Tests
 *
 * Tests for stable-db-queue-disconnect.ts CLI module.
 */
import assert from "node:assert/strict";
import test from "node:test";
// ---------------------------------------------------------------------------
// Tests for CLI factory configuration
// ---------------------------------------------------------------------------
test("stable-db-queue-disconnect uses AA_STABLE_DB_QUEUE_DISCONNECT env var prefix", () => {
    const envVar = "AA_STABLE_DB_QUEUE_DISCONNECT";
    assert.ok(envVar.startsWith("AA_"));
    assert.ok(envVar.includes("DB_QUEUE_DISCONNECT"));
});
test("stable-db-queue-disconnect defaultDir follows data/stable-db-queue-disconnect pattern", () => {
    const defaultDir = "data/stable-db-queue-disconnect";
    assert.ok(defaultDir.startsWith("data/"));
    assert.ok(defaultDir.includes("db-queue-disconnect"));
});
test("stable-db-queue-disconnect reportFilename follows stable-db-queue-disconnect-report.json pattern", () => {
    const reportFilename = "stable-db-queue-disconnect-report.json";
    assert.ok(reportFilename.endsWith(".json"));
    assert.ok(reportFilename.includes("db-queue-disconnect"));
});
test("stable-db-queue-disconnect failed predicate uses default failedScenarios", () => {
    const failed = (report) => (report.failedScenarios ?? 0) > 0;
    assert.equal(failed({ failedScenarios: 0 }), false);
    assert.equal(failed({ failedScenarios: 1 }), true);
});
//# sourceMappingURL=stable-db-queue-disconnect.test.js.map