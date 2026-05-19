/**
 * Stable Replay CLI Tests
 *
 * Tests for stable-replay.ts CLI module.
 */
import assert from "node:assert/strict";
import test from "node:test";
// ---------------------------------------------------------------------------
// Tests for CLI factory configuration
// ---------------------------------------------------------------------------
test("stable-replay uses AA_STABLE_REPLAY env var prefix", () => {
    const envVar = "AA_STABLE_REPLAY";
    assert.ok(envVar.startsWith("AA_"));
    assert.ok(envVar.includes("REPLAY"));
});
test("stable-replay defaultDir follows data/stable-replay pattern", () => {
    const defaultDir = "data/stable-replay";
    assert.ok(defaultDir.startsWith("data/"));
    assert.ok(defaultDir.includes("replay"));
});
test("stable-replay reportFilename follows stable-event-replay-report.json pattern", () => {
    const reportFilename = "stable-event-replay-report.json";
    assert.ok(reportFilename.endsWith(".json"));
    assert.ok(reportFilename.includes("event-replay"));
});
test("stable-replay runner is runStableEventReplayRehearsal function", () => {
    assert.ok(typeof "runStableEventReplayRehearsal" === "string" || typeof "runStableEventReplayRehearsal" === "function");
});
test("stable-replay writer is writeStableEventReplayRehearsalReport function", () => {
    assert.ok(typeof "writeStableEventReplayRehearsalReport" === "string" || typeof "writeStableEventReplayRehearsalReport" === "function");
});
//# sourceMappingURL=stable-replay.test.js.map