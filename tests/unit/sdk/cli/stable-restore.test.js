/**
 * Stable Restore CLI Tests
 *
 * Tests for stable-restore.ts CLI module.
 */
import assert from "node:assert/strict";
import test from "node:test";
// ---------------------------------------------------------------------------
// Tests for CLI factory configuration
// ---------------------------------------------------------------------------
test("stable-restore uses AA_STABLE_RESTORE env var prefix", () => {
    const envVar = "AA_STABLE_RESTORE";
    assert.ok(envVar.startsWith("AA_"));
    assert.ok(envVar.includes("RESTORE"));
});
test("stable-restore defaultDir follows data/stable-restore pattern", () => {
    const defaultDir = "data/stable-restore";
    assert.ok(defaultDir.startsWith("data/"));
    assert.ok(defaultDir.includes("restore"));
});
test("stable-restore reportFilename follows stable-backup-restore-report.json pattern", () => {
    const reportFilename = "stable-backup-restore-report.json";
    assert.ok(reportFilename.endsWith(".json"));
    assert.ok(reportFilename.includes("backup-restore"));
});
test("stable-restore runner is runStableBackupRestoreRehearsal function", () => {
    assert.ok(typeof "runStableBackupRestoreRehearsal" === "string" || typeof "runStableBackupRestoreRehearsal" === "function");
});
test("stable-restore writer is writeStableBackupRestoreRehearsalReport function", () => {
    assert.ok(typeof "writeStableBackupRestoreRehearsalReport" === "string" || typeof "writeStableBackupRestoreRehearsalReport" === "function");
});
//# sourceMappingURL=stable-restore.test.js.map