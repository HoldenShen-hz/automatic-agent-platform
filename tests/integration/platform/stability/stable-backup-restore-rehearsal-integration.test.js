import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { runStableBackupRestoreRehearsal, writeStableBackupRestoreRehearsalReport, buildStableDisasterRecoveryPlaybook, } from "../../../../src/platform/stability/stable-backup-restore-rehearsal.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
test("runStableBackupRestoreRehearsal passes sqlite_backup_restore_roundtrip scenario and produces artifacts", async () => {
    const workspace = createTempWorkspace("aa-backup-restore-");
    try {
        const report = await runStableBackupRestoreRehearsal({ outputDir: workspace });
        const reportPath = join(workspace, "stable-backup-restore-report.json");
        writeStableBackupRestoreRehearsalReport(reportPath, report);
        assert.equal(report.totalScenarios, 1);
        assert.equal(report.passedScenarios, 1);
        assert.equal(report.failedScenarios, 0);
        assert.ok(report.scenarios.every((s) => s.passed));
        const roundtripScenario = report.scenarios.find((s) => s.scenarioId === "sqlite_backup_restore_roundtrip");
        assert.ok(roundtripScenario);
        assert.equal(roundtripScenario.passed, true);
        assert.ok(roundtripScenario.durationMs >= 0);
        assert.ok(roundtripScenario.summary.length > 0);
        // Artifacts exist
        assert.equal(existsSync(report.artifacts.reportPath), true);
        assert.equal(existsSync(report.artifacts.playbookPath), true);
        // Playbook structure validation
        const playbook = JSON.parse(readFileSync(report.artifacts.playbookPath, "utf8"));
        assert.equal(playbook.generatedAt.length > 0, true);
        assert.equal(playbook.recoveryOwner, "runtime_reliability_oncall");
        assert.equal(playbook.targetRpo, "15m");
        assert.equal(playbook.targetRto, "30m");
        assert.ok(Array.isArray(playbook.prechecks));
        assert.ok(playbook.prechecks.length >= 4);
        assert.ok(Array.isArray(playbook.restoreProcedure));
        assert.ok(playbook.restoreProcedure.length >= 4);
        assert.ok(Array.isArray(playbook.healthValidation));
        assert.ok(playbook.healthValidation.length >= 4);
        assert.ok(Array.isArray(playbook.auditRequirements));
        assert.ok(playbook.auditRequirements.length >= 4);
        assert.ok(Array.isArray(playbook.targets));
        assert.equal(playbook.targets.length, 3);
        assert.deepEqual(playbook.targets.map((t) => t.targetId), ["runtime_sqlite", "runtime_backup", "restored_runtime"]);
        assert.ok(playbook.runtimeVersionSnapshot);
        // Report persisted correctly
        const saved = JSON.parse(readFileSync(reportPath, "utf8"));
        assert.equal(saved.totalScenarios, 1);
        assert.equal(saved.passedScenarios, 1);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("runStableBackupRestoreRehearsal backup and restore details contain valid counts", async () => {
    const workspace = createTempWorkspace("aa-backup-restore-details-");
    try {
        const report = await runStableBackupRestoreRehearsal({ outputDir: workspace });
        const roundtripScenario = report.scenarios.find((s) => s.scenarioId === "sqlite_backup_restore_roundtrip");
        assert.ok(roundtripScenario);
        // Details capture backup and restore information
        assert.ok(roundtripScenario.details);
        const details = roundtripScenario.details;
        assert.equal(details.backup.valid, true);
        assert.equal(details.restore.valid, true);
        assert.equal(details.countsMatch, true);
        assert.ok(details.sourceCounts);
        assert.ok(details.restoreCounts);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("buildStableDisasterRecoveryPlaybook generates valid playbook with all required targets", () => {
    const workspace = createTempWorkspace("aa-backup-playbook-");
    try {
        const reportPath = join(workspace, "report.json");
        const playbookPath = join(workspace, "playbook.json");
        const playbook = buildStableDisasterRecoveryPlaybook({
            outputDir: workspace,
            reportPath,
            playbookPath,
        });
        // Validate playbook has all required fields
        assert.ok(playbook.generatedAt);
        assert.equal(playbook.recoveryOwner, "runtime_reliability_oncall");
        assert.equal(playbook.targetRpo, "15m");
        assert.equal(playbook.targetRto, "30m");
        assert.ok(playbook.runtimeVersionSnapshot);
        // Validate prechecks
        assert.ok(Array.isArray(playbook.prechecks));
        assert.ok(playbook.prechecks.length >= 4);
        assert.ok(playbook.prechecks.some((p) => p.includes("integrity")));
        // Validate restore procedure
        assert.ok(Array.isArray(playbook.restoreProcedure));
        assert.ok(playbook.restoreProcedure.length >= 4);
        // Validate health validation
        assert.ok(Array.isArray(playbook.healthValidation));
        assert.ok(playbook.healthValidation.length >= 4);
        assert.ok(playbook.healthValidation.some((h) => h.includes("schema")));
        // Validate audit requirements
        assert.ok(Array.isArray(playbook.auditRequirements));
        assert.ok(playbook.auditRequirements.length >= 4);
        // Validate targets
        assert.ok(Array.isArray(playbook.targets));
        assert.equal(playbook.targets.length, 3);
        const targetIds = playbook.targets.map((t) => t.targetId);
        assert.ok(targetIds.includes("runtime_sqlite"));
        assert.ok(targetIds.includes("runtime_backup"));
        assert.ok(targetIds.includes("restored_runtime"));
        // Validate each target has validation checks
        for (const target of playbook.targets) {
            assert.ok(Array.isArray(target.validationChecks));
            assert.ok(target.validationChecks.length > 0);
        }
    }
    finally {
        cleanupPath(workspace);
    }
});
test("runStableBackupRestoreRehearsal creates separate source, backup, and restore databases", async () => {
    const workspace = createTempWorkspace("aa-backup-restore-dbs-");
    try {
        const report = await runStableBackupRestoreRehearsal({ outputDir: workspace });
        // Verify all required scenario details are present
        const roundtripScenario = report.scenarios.find((s) => s.scenarioId === "sqlite_backup_restore_roundtrip");
        assert.ok(roundtripScenario);
        assert.ok(roundtripScenario.details);
        const details = roundtripScenario.details;
        // Verify table counts exist for all expected tables
        const expectedTables = ["tasks", "workflow_state", "executions", "sessions", "workflow_step_outputs", "events", "event_consumer_acks"];
        for (const table of expectedTables) {
            assert.ok(table in details.sourceCounts, `sourceCounts should have ${table}`);
            assert.ok(table in details.restoreCounts, `restoreCounts should have ${table}`);
        }
        // Verify counts match between source and restored
        assert.equal(details.countsMatch, true);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("writeStableBackupRestoreRehearsalReport persists report correctly", async () => {
    const workspace = createTempWorkspace("aa-backup-restore-persist-");
    try {
        const report = await runStableBackupRestoreRehearsal({ outputDir: workspace });
        const reportPath = join(workspace, "persisted-report.json");
        writeStableBackupRestoreRehearsalReport(reportPath, report);
        // Verify file was created
        assert.equal(existsSync(reportPath), true);
        // Verify content matches original report
        const saved = JSON.parse(readFileSync(reportPath, "utf8"));
        assert.equal(saved.totalScenarios, report.totalScenarios);
        assert.equal(saved.passedScenarios, report.passedScenarios);
        assert.equal(saved.failedScenarios, report.failedScenarios);
        assert.equal(saved.startedAt, report.startedAt);
        assert.equal(saved.finishedAt, report.finishedAt);
        assert.equal(saved.outputDir, report.outputDir);
        assert.equal(saved.artifacts.reportPath, report.artifacts.reportPath);
        assert.equal(saved.artifacts.playbookPath, report.artifacts.playbookPath);
        assert.equal(saved.scenarios.length, report.scenarios.length);
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=stable-backup-restore-rehearsal-integration.test.js.map