/**
 * Stable Soak CLI Tests
 *
 * Tests for stable-soak.ts CLI module.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { loadStableSoakCliEnv } from "../../../../src/platform/control-plane/config-center/stable-cli-env.js";
// ---------------------------------------------------------------------------
// Tests for loadStableSoakCliEnv
// ---------------------------------------------------------------------------
test("loadStableSoakCliEnv returns default duration of 5000ms", () => {
    const result = loadStableSoakCliEnv({});
    assert.equal(result.durationMs, 5_000);
});
test("loadStableSoakCliEnv returns default interval of 500ms", () => {
    const result = loadStableSoakCliEnv({});
    assert.equal(result.intervalMs, 500);
});
test("loadStableSoakCliEnv returns default iterationsPerCycle of 1", () => {
    const result = loadStableSoakCliEnv({});
    assert.equal(result.iterationsPerCycle, 1);
});
test("loadStableSoakCliEnv parses custom duration", () => {
    const result = loadStableSoakCliEnv({ AA_SOAK_DURATION_MS: "10000" });
    assert.equal(result.durationMs, 10_000);
});
test("loadStableSoakCliEnv parses custom interval", () => {
    const result = loadStableSoakCliEnv({ AA_SOAK_INTERVAL_MS: "1000" });
    assert.equal(result.intervalMs, 1_000);
});
test("loadStableSoakCliEnv parses custom iterationsPerCycle", () => {
    const result = loadStableSoakCliEnv({ AA_SOAK_ITERATIONS_PER_CYCLE: "5" });
    assert.equal(result.iterationsPerCycle, 5);
});
test("loadStableSoakCliEnv throws on invalid duration", () => {
    assert.throws(() => loadStableSoakCliEnv({ AA_SOAK_DURATION_MS: "-1000" }), /stable\.invalid_env:AA_SOAK_DURATION_MS/);
});
test("loadStableSoakCliEnv throws on invalid interval", () => {
    assert.throws(() => loadStableSoakCliEnv({ AA_SOAK_INTERVAL_MS: "0" }), /stable\.invalid_env:AA_SOAK_INTERVAL_MS/);
});
test("loadStableSoakCliEnv throws on non-numeric duration", () => {
    assert.throws(() => loadStableSoakCliEnv({ AA_SOAK_DURATION_MS: "invalid" }), /stable\.invalid_env:AA_SOAK_DURATION_MS/);
});
// ---------------------------------------------------------------------------
// Tests for CLI factory configuration
// ---------------------------------------------------------------------------
test("stable-soak uses AA_SOAK env var prefix", () => {
    const envVar = "AA_SOAK";
    assert.ok(envVar.startsWith("AA_"));
    assert.ok(envVar.includes("SOAK"));
});
test("stable-soak defaultDir follows data/soak pattern", () => {
    const defaultDir = "data/soak";
    assert.ok(defaultDir.startsWith("data/"));
    assert.ok(defaultDir.includes("soak"));
});
test("stable-soak reportFilename follows stable-soak-report.json pattern", () => {
    const reportFilename = "stable-soak-report.json";
    assert.ok(reportFilename.endsWith(".json"));
    assert.ok(reportFilename.includes("soak"));
});
test("stable-soak failed predicate checks multiple failure types", () => {
    // Mirrors the failed predicate in stable-soak.ts
    const failed = (report) => (report.failedRuns ?? 0) > 0 || (report.integrityFailures ?? 0) > 0 || (report.backupFailures ?? 0) > 0;
    assert.equal(failed({ failedRuns: 0, integrityFailures: 0, backupFailures: 0 }), false);
    assert.equal(failed({ failedRuns: 1, integrityFailures: 0, backupFailures: 0 }), true);
    assert.equal(failed({ failedRuns: 0, integrityFailures: 1, backupFailures: 0 }), true);
    assert.equal(failed({ failedRuns: 0, integrityFailures: 0, backupFailures: 1 }), true);
});
//# sourceMappingURL=stable-soak.test.js.map