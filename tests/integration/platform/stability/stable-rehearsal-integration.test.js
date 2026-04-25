import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  buildStableDisasterRecoveryPlaybook,
  runStableBackupRestoreRehearsal,
  writeStableBackupRestoreRehearsalReport,
  type StableBackupRestoreRehearsalReport,
  type StableDisasterRecoveryPlaybook,
} from "../../../../src/platform/shared/stability/stable-backup-restore-rehearsal.js";
import {
  runStableEventReplayRehearsal,
  writeStableEventReplayRehearsalReport,
} from "../../../../src/platform/shared/stability/stable-event-replay-rehearsal.js";
import {
  runStableDbWritabilityRehearsal,
  writeStableDbWritabilityRehearsalReport,
} from "../../../../src/platform/shared/stability/stable-db-writability-rehearsal.js";
import {
  runStableDbQueueDisconnectRehearsal,
  writeStableDbQueueDisconnectRehearsalReport,
} from "../../../../src/platform/shared/stability/stable-db-queue-disconnect-rehearsal.js";
import {
  runStableQueueDeliveryRehearsal,
  writeStableQueueDeliveryRehearsalReport,
} from "../../../../src/platform/shared/stability/stable-queue-delivery-rehearsal.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("stable backup/restore rehearsal produces playbook and passes roundtrip scenario", async () => {
  const workspace = createTempWorkspace("aa-stable-backup-restore-");

  try {
    const report = await runStableBackupRestoreRehearsal({ outputDir: workspace });
    const reportPath = join(workspace, "stable-backup-restore-report.json");
    const playbookPath = join(workspace, "stable-disaster-recovery-playbook.json");
    writeStableBackupRestoreRehearsalReport(reportPath, report);

    assert.equal(report.totalScenarios, 1);
    assert.equal(report.passedScenarios, 1);
    assert.equal(report.failedScenarios, 0);
    assert.ok(report.scenarios.every((s) => s.passed));
    assert.equal(report.scenarios[0].scenarioId, "sqlite_backup_restore_roundtrip");

    const playbook = JSON.parse(readFileSync(playbookPath, "utf8")) as StableDisasterRecoveryPlaybook;
    assert.equal(playbook.targetRpo, "15m");
    assert.equal(playbook.targetRto, "30m");
    assert.ok(playbook.prechecks.length > 0);
    assert.ok(playbook.restoreProcedure.length > 0);
    assert.ok(playbook.healthValidation.length > 0);
    assert.equal(playbook.targets.length, 3);
    assert.ok(playbook.targets.some((t) => t.targetId === "runtime_sqlite"));
    assert.ok(playbook.targets.some((t) => t.targetId === "runtime_backup"));
    assert.ok(playbook.targets.some((t) => t.targetId === "restored_runtime"));
  } finally {
    cleanupPath(workspace);
  }
});

test("stable backup/restore rehearsal builds disaster recovery playbook with runtime version snapshot", async () => {
  const workspace = createTempWorkspace("aa-stable-dr-playbook-");
  const reportPath = join(workspace, "report.json");
  const playbookPath = join(workspace, "playbook.json");

  try {
    const playbook = buildStableDisasterRecoveryPlaybook({ outputDir: workspace, reportPath, playbookPath });
    assert.ok(playbook.generatedAt.length > 0);
    assert.equal(playbook.recoveryOwner, "runtime_reliability_oncall");
    assert.ok(playbook.runtimeVersionSnapshot);
    assert.equal(playbook.targets.length, 3);
    assert.ok(playbook.prechecks.length > 0);
    assert.ok(playbook.restoreProcedure.length > 0);
    assert.ok(playbook.healthValidation.length > 0);
    assert.ok(playbook.auditRequirements.length > 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("stable event replay rehearsal passes event recovery scenario", async () => {
  const workspace = createTempWorkspace("aa-stable-event-replay-");

  try {
    const report = await runStableEventReplayRehearsal({ outputDir: workspace });
    const reportPath = join(workspace, "stable-event-replay-report.json");
    writeStableEventReplayRehearsalReport(reportPath, report);

    assert.equal(report.totalScenarios, 1);
    assert.equal(report.passedScenarios, 1);
    assert.equal(report.failedScenarios, 0);
    assert.equal(report.scenarios[0].scenarioId, "failed_consumer_ack_recovery");
  } finally {
    cleanupPath(workspace);
  }
});

test("stable DB writability rehearsal passes read-only admission scenario", async () => {
  const workspace = createTempWorkspace("aa-stable-db-writability-");

  try {
    const report = await runStableDbWritabilityRehearsal({ outputDir: workspace });
    const reportPath = join(workspace, "stable-db-writability-report.json");
    writeStableDbWritabilityRehearsalReport(reportPath, report);

    assert.equal(report.totalScenarios, 1);
    assert.equal(report.passedScenarios, 1);
    assert.equal(report.failedScenarios, 0);
    assert.equal(report.scenarios[0].scenarioId, "db_readonly_admission_control");
  } finally {
    cleanupPath(workspace);
  }
});

test("stable DB/queue disconnect rehearsal passes fail-closed scenario", async () => {
  const workspace = createTempWorkspace("aa-stable-db-queue-disconnect-");

  try {
    const report = await runStableDbQueueDisconnectRehearsal({ outputDir: workspace });
    const reportPath = join(workspace, "stable-db-queue-disconnect-report.json");
    writeStableDbQueueDisconnectRehearsalReport(reportPath, report);

    assert.ok(report.totalScenarios >= 1);
    assert.equal(report.passedScenarios, report.totalScenarios);
    assert.equal(report.failedScenarios, 0);
    assert.ok(report.scenarios.every((s) => s.passed));
  } finally {
    cleanupPath(workspace);
  }
});

test("stable queue delivery rehearsal passes replay and deduplication scenarios", async () => {
  const workspace = createTempWorkspace("aa-stable-queue-delivery-");

  try {
    const report = await runStableQueueDeliveryRehearsal({ outputDir: workspace });
    const reportPath = join(workspace, "stable-queue-delivery-report.json");
    writeStableQueueDeliveryRehearsalReport(reportPath, report);

    assert.ok(report.totalScenarios >= 1);
    assert.equal(report.passedScenarios, report.totalScenarios);
    assert.equal(report.failedScenarios, 0);
    assert.ok(report.scenarios.every((s) => s.passed));
    assert.ok(report.scenarios.some((s) => s.scenarioId === "queue_replay_after_disconnect"));
    assert.ok(report.scenarios.some((s) => s.scenarioId === "duplicate_delivery_detection"));
  } finally {
    cleanupPath(workspace);
  }
});