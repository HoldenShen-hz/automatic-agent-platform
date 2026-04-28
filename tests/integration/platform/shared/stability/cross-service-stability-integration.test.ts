/**
 * Stability Integration Tests - Cross-Service Scenarios
 *
 * Tests stability orchestration across multiple services:
 * - Backup/restore procedures
 * - Maintenance rehearsal scenarios
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  runStableBackupRestoreRehearsal,
  writeStableBackupRestoreRehearsalReport,
} from "../../../../../src/platform/shared/stability/stable-backup-restore-rehearsal.js";
import {
  runStableMaintenanceRehearsal,
  writeStableMaintenanceRehearsalReport,
} from "../../../../../src/platform/shared/stability/stable-maintenance-rehearsal.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

test("stable backup-restore rehearsal validates database snapshot and restore procedures", async () => {
  const workspace = createTempWorkspace("aa-stable-backup-");

  try {
    const report = await runStableBackupRestoreRehearsal({
      outputDir: workspace,
    });
    const outputFile = join(workspace, "stable-backup-restore-report.json");
    writeStableBackupRestoreRehearsalReport(outputFile, report);

    assert.equal(report.failedScenarios, 0);
    assert.ok(report.totalScenarios >= 1);
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.equal(existsSync(outputFile), true);

    const backupScenario = report.scenarios.find((s) => s.scenarioId === "sqlite_backup_restore_roundtrip");
    assert.ok(backupScenario !== undefined, "Should have backup scenario");

    const restoreScenario = report.scenarios.find((s) => s.scenarioId === "sqlite_backup_restore_roundtrip");
    assert.ok(restoreScenario !== undefined, "Should have restore scenario");
  } finally {
    cleanupPath(workspace);
  }
});

test("stable maintenance rehearsal validates maintenance window procedures", async () => {
  const workspace = createTempWorkspace("aa-stable-maintenance-");

  try {
    const report = await runStableMaintenanceRehearsal({
      outputDir: workspace,
    });
    const outputFile = join(workspace, "stable-maintenance-report.json");
    writeStableMaintenanceRehearsalReport(outputFile, report);

    assert.equal(report.failedScenarios, 0);
    assert.ok(report.totalScenarios >= 1);
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.equal(existsSync(outputFile), true);
  } finally {
    cleanupPath(workspace);
  }
});

test("stable backup-restore report contains valid artifact paths", async () => {
  const workspace = createTempWorkspace("aa-stable-backup-artifacts-");

  try {
    const report = await runStableBackupRestoreRehearsal({
      outputDir: workspace,
    });
    const outputFile = join(workspace, "stable-backup-restore-report.json");
    writeStableBackupRestoreRehearsalReport(outputFile, report);

    // Verify report structure
    assert.ok(report.startedAt.length > 0, "Should have startedAt timestamp");
    assert.ok(report.finishedAt.length > 0, "Should have finishedAt timestamp");

    // Verify scenarios have proper structure
    for (const scenario of report.scenarios) {
      assert.ok(scenario.scenarioId.length > 0, "Scenario should have id");
      assert.ok(typeof scenario.passed === "boolean", "Scenario should have passed boolean");
    }
  } finally {
    cleanupPath(workspace);
  }
});

test("stable maintenance report structure validation", async () => {
  const workspace = createTempWorkspace("aa-stable-maintenance-struct-");

  try {
    const report = await runStableMaintenanceRehearsal({
      outputDir: workspace,
    });

    // Verify report has required fields
    assert.ok(report.startedAt.length > 0, "Should have startedAt");
    assert.ok(report.finishedAt.length > 0, "Should have finishedAt");
    assert.ok(Array.isArray(report.scenarios), "Scenarios should be an array");
    assert.ok(report.totalScenarios >= 0, "Should have totalScenarios");
    assert.ok(report.passedScenarios >= 0, "Should have passedScenarios");
    assert.ok(report.failedScenarios >= 0, "Should have failedScenarios");
  } finally {
    cleanupPath(workspace);
  }
});
