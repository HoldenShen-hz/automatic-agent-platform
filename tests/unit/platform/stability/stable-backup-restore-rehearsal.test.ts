import assert from "node:assert/strict";
import test from "node:test";
import { rmSync, mkdirSync } from "node:fs";

import { runStableBackupRestoreRehearsal, writeStableBackupRestoreRehearsalReport, buildStableDisasterRecoveryPlaybook } from "../../../../src/platform/stability/stable-backup-restore-rehearsal.js";

test("runStableBackupRestoreRehearsal runs the sqlite backup restore roundtrip scenario", async () => {
  const outputDir = "/tmp/stable-backup-restore-test";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableBackupRestoreRehearsal({ outputDir });

  assert.equal(report.totalScenarios, 1);
  assert.equal(report.scenarios.length, 1);
  assert.ok(report.startedAt);
  assert.ok(report.finishedAt);
  assert.equal(report.outputDir, outputDir);
  assert.ok(report.artifacts);
  assert.ok(report.artifacts.reportPath);
  assert.ok(report.artifacts.playbookPath);
});

test("runStableBackupRestoreRehearsal sqlite_backup_restore_roundtrip scenario passes", async () => {
  const outputDir = "/tmp/stable-backup-restore-test-roundtrip";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableBackupRestoreRehearsal({ outputDir });
  const scenario = report.scenarios.find((s) => s.scenarioId === "sqlite_backup_restore_roundtrip");

  assert.ok(scenario);
  assert.equal(scenario.passed, true);
  assert.ok(scenario.durationMs >= 0);
});

test("runStableBackupRestoreRehearsal playbook is built correctly", async () => {
  const outputDir = "/tmp/stable-backup-restore-test-playbook";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableBackupRestoreRehearsal({ outputDir });

  assert.ok(report.playbook);
  assert.equal(report.playbook.targetRpo, "15m");
  assert.equal(report.playbook.targetRto, "30m");
  assert.ok(report.playbook.runtimeVersionSnapshot);
  assert.ok(Array.isArray(report.playbook.targets));
  assert.ok(report.playbook.targets.length > 0);
});

test("buildStableDisasterRecoveryPlaybook returns valid playbook structure", () => {
  const outputDir = "/tmp/stable-backup-restore-playbook-build-test";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const playbook = buildStableDisasterRecoveryPlaybook({
    outputDir,
    reportPath: join(outputDir, "report.json"),
    playbookPath: join(outputDir, "playbook.json"),
  });

  assert.ok(playbook.generatedAt);
  assert.equal(playbook.recoveryOwner, "runtime_reliability_oncall");
  assert.ok(Array.isArray(playbook.prechecks));
  assert.ok(Array.isArray(playbook.restoreProcedure));
  assert.ok(Array.isArray(playbook.healthValidation));
  assert.ok(Array.isArray(playbook.auditRequirements));
  assert.ok(Array.isArray(playbook.targets));
});

test("writeStableBackupRestoreRehearsalReport is callable", () => {
  assert.equal(typeof writeStableBackupRestoreRehearsalReport, "function");
});

import { join } from "node:path";