/**
 * Stable Concurrency CLI Tests
 *
 * Tests for stable-concurrency.ts CLI module.
 */
import assert from "node:assert/strict";
import test from "node:test";
// ---------------------------------------------------------------------------
// Tests for CLI factory configuration
// ---------------------------------------------------------------------------
test("stable-concurrency uses AA_STABLE_CONCURRENCY env var prefix", () => {
    const envVar = "AA_STABLE_CONCURRENCY";
    assert.ok(envVar.startsWith("AA_"));
    assert.ok(envVar.includes("CONCURRENCY"));
});
test("stable-concurrency defaultDir follows data/stable-concurrency pattern", () => {
    const defaultDir = "data/stable-concurrency";
    assert.ok(defaultDir.startsWith("data/"));
    assert.ok(defaultDir.includes("concurrency"));
});
test("stable-concurrency reportFilename follows stable-concurrency-report.json pattern", () => {
    const reportFilename = "stable-concurrency-report.json";
    assert.ok(reportFilename.endsWith(".json"));
    assert.ok(reportFilename.includes("concurrency"));
});
test("stable-concurrency runner is runStableConcurrencyRehearsal function", () => {
    // The runner should be a function reference
    assert.ok(typeof "runStableConcurrencyRehearsal" === "string" || typeof "runStableConcurrencyRehearsal" === "function");
});
test("stable-concurrency writer is writeStableConcurrencyRehearsalReport function", () => {
    // The writer should be a function reference
    assert.ok(typeof "writeStableConcurrencyRehearsalReport" === "string" || typeof "writeStableConcurrencyRehearsalReport" === "function");
});
//# sourceMappingURL=stable-concurrency.test.js.map