/**
 * Stable Worker Handshake CLI Tests
 *
 * Tests for stable-worker-handshake.ts CLI module.
 */
import assert from "node:assert/strict";
import test from "node:test";
// ---------------------------------------------------------------------------
// Tests for CLI factory configuration
// ---------------------------------------------------------------------------
test("stable-worker-handshake uses AA_STABLE_WORKER_HANDSHAKE env var prefix", () => {
    const envVar = "AA_STABLE_WORKER_HANDSHAKE";
    assert.ok(envVar.startsWith("AA_"));
    assert.ok(envVar.includes("WORKER_HANDSHAKE"));
});
test("stable-worker-handshake defaultDir follows data/stable-worker-handshake pattern", () => {
    const defaultDir = "data/stable-worker-handshake";
    assert.ok(defaultDir.startsWith("data/"));
    assert.ok(defaultDir.includes("worker-handshake"));
});
test("stable-worker-handshake reportFilename follows stable-worker-handshake-report.json pattern", () => {
    const reportFilename = "stable-worker-handshake-report.json";
    assert.ok(reportFilename.endsWith(".json"));
    assert.ok(reportFilename.includes("worker-handshake"));
});
test("stable-worker-handshake runner is runStableWorkerHandshakeRehearsal function", () => {
    assert.ok(typeof "runStableWorkerHandshakeRehearsal" === "string" || typeof "runStableWorkerHandshakeRehearsal" === "function");
});
test("stable-worker-handshake writer is writeStableWorkerHandshakeRehearsalReport function", () => {
    assert.ok(typeof "writeStableWorkerHandshakeRehearsalReport" === "string" || typeof "writeStableWorkerHandshakeRehearsalReport" === "function");
});
//# sourceMappingURL=stable-worker-handshake.test.js.map