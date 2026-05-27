import assert from "node:assert/strict";
import test from "node:test";

import { buildStableDisasterRecoveryPlaybook } from "../../../../../src/platform/shared/stability/stable-backup-restore-rehearsal.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

test("buildStableDisasterRecoveryPlaybook produces recovery ownership and validation targets [stable-backup-restore-rehearsal]", () => {
  const workspace = createTempWorkspace("aa-dr-playbook-");

  try {
    const reportPath = `${workspace}/stable-backup-restore-report.json`;
    const playbookPath = `${workspace}/stable-disaster-recovery-playbook.json`;
    const playbook = buildStableDisasterRecoveryPlaybook({
      outputDir: workspace,
      reportPath,
      playbookPath,
    });

    assert.equal(playbook.recoveryOwner, "runtime_reliability_oncall");
    assert.equal(playbook.targetRpo, "15m");
    assert.equal(playbook.targetRto, "30m");
    assert.equal(playbook.reportPath, reportPath);
    assert.equal(playbook.playbookPath, playbookPath);
    assert.equal(playbook.prechecks.length >= 4, true);
    assert.equal(playbook.restoreProcedure.length >= 4, true);
    assert.equal(playbook.healthValidation.length >= 4, true);
    assert.equal(playbook.auditRequirements.length >= 4, true);
    assert.deepEqual(
      playbook.targets.map((target) => target.targetId),
      ["runtime_sqlite", "runtime_backup", "restored_runtime"],
    );
    assert.equal(playbook.runtimeVersionSnapshot.schemaVersion.upToDate, true);
  } finally {
    cleanupPath(workspace);
  }
});

test("buildStableDisasterRecoveryPlaybook generates playbook with complete target validation checks [stable-backup-restore-rehearsal]", () => {
  const workspace = createTempWorkspace("aa-dr-playbook-validation-");

  try {
    const playbook = buildStableDisasterRecoveryPlaybook({
      outputDir: workspace,
      reportPath: `${workspace}/report.json`,
      playbookPath: `${workspace}/playbook.json`,
    });

    // Every target must have at least 2 validation checks
    assert.ok(playbook.targets.every((target) => target.validationChecks.length >= 2));

    // Verify specific validation checks for each target
    const runtimeSqlite = playbook.targets.find((t) => t.targetId === "runtime_sqlite");
    assert.ok(runtimeSqlite);
    assert.deepEqual(runtimeSqlite.validationChecks, ["integrity_ok", "schema_current", "checkpoint_completed"]);

    const runtimeBackup = playbook.targets.find((t) => t.targetId === "runtime_backup");
    assert.ok(runtimeBackup);
    assert.deepEqual(runtimeBackup.validationChecks, ["backup_integrity_ok", "backup_size_recorded"]);

    const restoredRuntime = playbook.targets.find((t) => t.targetId === "restored_runtime");
    assert.ok(restoredRuntime);
    assert.deepEqual(restoredRuntime.validationChecks, ["restore_integrity_ok", "table_counts_match", "runtime_reopenable"]);
  } finally {
    cleanupPath(workspace);
  }
});

test("buildStableDisasterRecoveryPlaybook generates playbook with all required procedure steps [stable-backup-restore-rehearsal]", () => {
  const workspace = createTempWorkspace("aa-dr-playbook-procedure-");

  try {
    const playbook = buildStableDisasterRecoveryPlaybook({
      outputDir: workspace,
      reportPath: `${workspace}/report.json`,
      playbookPath: `${workspace}/playbook.json`,
    });

    // Verify prechecks include key recovery preparation steps
    assert.ok(playbook.prechecks.some((step) => step.toLowerCase().includes("backup artifact")));
    assert.ok(playbook.prechecks.some((step) => step.toLowerCase().includes("snapshot")));
    assert.ok(playbook.prechecks.some((step) => step.toLowerCase().includes("freeze new writes")));

    // Verify restore procedure includes key steps
    assert.ok(playbook.restoreProcedure.some((step) => step.toLowerCase().includes("checkpoint")));
    assert.ok(playbook.restoreProcedure.some((step) => step.toLowerCase().includes("backup")));
    assert.ok(playbook.restoreProcedure.some((step) => step.toLowerCase().includes("integrity")));
    assert.ok(playbook.restoreProcedure.some((step) => step.toLowerCase().includes("promote")));

    // Verify health validation includes key checks
    assert.ok(playbook.healthValidation.some((step) => step.toLowerCase().includes("integrity")));
    assert.ok(playbook.healthValidation.some((step) => step.toLowerCase().includes("schema version")));
    assert.ok(playbook.healthValidation.some((step) => step.toLowerCase().includes("table count")));
    assert.ok(playbook.healthValidation.some((step) => step.toLowerCase().includes("reopen")));
  } finally {
    cleanupPath(workspace);
  }
});
