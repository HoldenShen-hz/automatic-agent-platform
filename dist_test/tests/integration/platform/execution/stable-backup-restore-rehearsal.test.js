import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { runStableBackupRestoreRehearsal, writeStableBackupRestoreRehearsalReport, } from "../../../../src/platform/shared/stability/stable-backup-restore-rehearsal.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
test("stable backup restore rehearsal validates sqlite roundtrip restore", async () => {
    const workspace = createTempWorkspace("aa-stable-restore-");
    try {
        const report = await runStableBackupRestoreRehearsal({
            outputDir: workspace,
        });
        const outputFile = join(workspace, "stable-backup-restore-report.json");
        writeStableBackupRestoreRehearsalReport(outputFile, report);
        assert.equal(report.failedScenarios, 0);
        assert.equal(report.totalScenarios, 1);
        assert.equal(report.artifacts.reportPath, outputFile);
        assert.equal(report.artifacts.playbookPath, join(workspace, "stable-disaster-recovery-playbook.json"));
        assert.equal(report.playbook.recoveryOwner, "runtime_reliability_oncall");
        assert.equal(report.playbook.targetRpo, "15m");
        assert.equal(report.playbook.targetRto, "30m");
        assert.equal(report.playbook.targets.length, 3);
        assert.ok(report.scenarios.every((scenario) => scenario.passed));
        assert.equal(existsSync(outputFile), true);
        assert.equal(existsSync(report.artifacts.playbookPath), true);
        const playbook = JSON.parse(readFileSync(report.artifacts.playbookPath, "utf8"));
        assert.equal(playbook.recoveryOwner, "runtime_reliability_oncall");
        assert.equal(playbook.targetRpo, "15m");
        assert.ok(playbook.targets.some((target) => target.targetId === "restored_runtime"));
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=stable-backup-restore-rehearsal.test.js.map