import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  runStableRollbackRehearsal,
  writeStableRollbackRehearsalReport,
  type StableRollbackRehearsalReport,
} from "../../../../../src/platform/stability/stable-rollback-rehearsal.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("runStableRollbackRehearsal passes runtime repair and manual takeover scenarios and produces artifacts", async () => {
  const workspace = createTempWorkspace("aa-rollback-rehearsal-");

  try {
    const report = await runStableRollbackRehearsal({ outputDir: workspace });
    const reportPath = join(workspace, "stable-rollback-report.json");
    writeStableRollbackRehearsalReport(reportPath, report);

    assert.equal(report.totalScenarios, 2);
    assert.equal(report.passedScenarios, 2);
    assert.equal(report.failedScenarios, 0);
    assert.ok(report.scenarios.every((s) => s.passed));

    const runtimeRepairScenario = report.scenarios.find((s) => s.scenarioId === "runtime_repair_rehearsal");
    assert.ok(runtimeRepairScenario);
    assert.equal(runtimeRepairScenario.passed, true);
    assert.ok(runtimeRepairScenario.durationMs >= 0);
    assert.ok(runtimeRepairScenario.summary.length > 0);

    const manualTakeoverScenario = report.scenarios.find((s) => s.scenarioId === "manual_takeover_rehearsal");
    assert.ok(manualTakeoverScenario);
    assert.equal(manualTakeoverScenario.passed, true);
    assert.ok(manualTakeoverScenario.durationMs >= 0);
    assert.ok(manualTakeoverScenario.summary.length > 0);

    // Artifacts exist
    assert.equal(existsSync(report.artifacts.reportPath), true);
    assert.equal(existsSync(report.artifacts.playbookPath), true);

    // Playbook structure
    const playbook = JSON.parse(readFileSync(report.artifacts.playbookPath, "utf8"));
    assert.equal(playbook.rollbackOwner, "release_manager_oncall");
    assert.ok(playbook.prechecks.length >= 4);
    assert.ok(playbook.healthValidation.length >= 4);
    assert.ok(playbook.auditRequirements.length >= 4);
    assert.ok(playbook.rollbackEntryPoints.length, 3);
    assert.ok(playbook.runtimeVersionSnapshot);
    assert.equal(playbook.scenarioEvidence.length, 2);

    // Report persisted correctly
    const saved = JSON.parse(readFileSync(reportPath, "utf8")) as StableRollbackRehearsalReport;
    assert.equal(saved.totalScenarios, 2);
    assert.equal(saved.passedScenarios, 2);
  } finally {
    cleanupPath(workspace);
  }
});

test("runStableRollbackRehearsal runtime repair scenario requeues stale execution", async () => {
  const workspace = createTempWorkspace("aa-rollback-runtime-repair-");

  try {
    const report = await runStableRollbackRehearsal({ outputDir: workspace });
    const runtimeRepairScenario = report.scenarios.find((s) => s.scenarioId === "runtime_repair_rehearsal");
    assert.ok(runtimeRepairScenario);
    assert.equal(runtimeRepairScenario.passed, true);

    // Details capture repair behavior
    const details = runtimeRepairScenario.details as {
      beforeStatus: string;
      afterStatus: string;
      taskStatusAfter: string;
      executionStatusAfter: string;
    };
    assert.equal(details.beforeStatus, "fail");
    assert.equal(details.afterStatus, "pass");
    assert.equal(details.taskStatusAfter, "pending");
    assert.equal(details.executionStatusAfter, "created");

    // Repair applied requeue action
    const applied = details as { applied: Array<{ action: string; applied: boolean }> };
    assert.ok(applied.applied.some((a) => a.action === "requeue_execution" && a.applied));
  } finally {
    cleanupPath(workspace);
  }
});

test("runStableRollbackRehearsal manual takeover scenario closes task with complete audit trail", async () => {
  const workspace = createTempWorkspace("aa-rollback-takeover-");

  try {
    const report = await runStableRollbackRehearsal({ outputDir: workspace });
    const manualTakeoverScenario = report.scenarios.find((s) => s.scenarioId === "manual_takeover_rehearsal");
    assert.ok(manualTakeoverScenario);
    assert.equal(manualTakeoverScenario.passed, true);

    const details = manualTakeoverScenario.details as {
      taskStatus: string;
      executionStatus: string;
      sessionStatus: string;
      operatorActionCount: number;
    };
    assert.equal(details.taskStatus, "done");
    assert.equal(details.executionStatus, "succeeded");
    assert.equal(details.sessionStatus, "completed");
    assert.ok(details.operatorActionCount >= 4);
  } finally {
    cleanupPath(workspace);
  }
});

test("runStableRollbackRehearsal playbook contains all required rollback targets", async () => {
  const workspace = createTempWorkspace("aa-rollback-playbook-");

  try {
    const report = await runStableRollbackRehearsal({ outputDir: workspace });
    const playbook = JSON.parse(readFileSync(report.artifacts.playbookPath, "utf8"));

    const targetIds = playbook.targets.map((t) => t.targetId);
    assert.ok(targetIds.includes("application_binary"));
    assert.ok(targetIds.includes("config_bundle"));
    assert.ok(targetIds.includes("feature_flag"));
    assert.ok(targetIds.includes("worker_version"));
    assert.ok(targetIds.includes("prompt_bundle"));

    // Each target has required fields
    for (const target of playbook.targets) {
      assert.equal(target.rollbackOwner, "release_manager_oncall");
      assert.ok(target.rollbackSteps.length >= 2);
      assert.ok(target.healthValidation.length >= 2);
      assert.ok(target.auditRequirements.length >= 1);
      assert.ok(target.rollbackTrigger.length > 0);
    }
  } finally {
    cleanupPath(workspace);
  }
});

test("runStableRollbackRehearsal playbook rollback entry points are valid", async () => {
  const workspace = createTempWorkspace("aa-rollback-entrypoints-");

  try {
    const report = await runStableRollbackRehearsal({ outputDir: workspace });
    const playbook = JSON.parse(readFileSync(report.artifacts.playbookPath, "utf8"));

    assert.equal(playbook.rollbackEntryPoints.length, 3);

    const cliEntry = playbook.rollbackEntryPoints.find((e) => e.entryPointId === "stable_rollback_cli");
    assert.ok(cliEntry);
    assert.equal(cliEntry.command, "npm run rollback:stable");

    const repairEntry = playbook.rollbackEntryPoints.find((e) => e.entryPointId === "runtime_repair_service");
    assert.ok(repairEntry);
    assert.equal(repairEntry.command, null);

    const takeoverEntry = playbook.rollbackEntryPoints.find((e) => e.entryPointId === "human_takeover_service");
    assert.ok(takeoverEntry);
    assert.equal(takeoverEntry.command, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("runStableRollbackRehearsal playbook prechecks and health validation cover rollback readiness", async () => {
  const workspace = createTempWorkspace("aa-rollback-checks-");

  try {
    const report = await runStableRollbackRehearsal({ outputDir: workspace });
    const playbook = JSON.parse(readFileSync(report.artifacts.playbookPath, "utf8"));

    // Prechecks cover freeze, schema, version capture, and entry points
    assert.ok(playbook.prechecks.some((p) => p.toLowerCase().includes("freeze")));
    assert.ok(playbook.prechecks.some((p) => p.toLowerCase().includes("schema")));
    assert.ok(playbook.prechecks.some((p) => p.toLowerCase().includes("version")));
    assert.ok(playbook.prechecks.some((p) => p.toLowerCase().includes("entry point")));

    // Health validation covers doctor, regression, resumability, and schema
    assert.ok(playbook.healthValidation.some((h) => h.toLowerCase().includes("doctor")));
    assert.ok(playbook.healthValidation.some((h) => h.toLowerCase().includes("regression")));
    assert.ok(playbook.healthValidation.some((h) => h.toLowerCase().includes("resumable")));
    assert.ok(playbook.healthValidation.some((h) => h.toLowerCase().includes("schema")));

    // Audit requirements cover incident, artifacts, operator identity, and snapshots
    assert.ok(playbook.auditRequirements.some((a) => a.toLowerCase().includes("incident") || a.toLowerCase().includes("release batch")));
    assert.ok(playbook.auditRequirements.some((a) => a.toLowerCase().includes("persist") || a.toLowerCase().includes("artifact")));
    assert.ok(playbook.auditRequirements.some((a) => a.toLowerCase().includes("operator")));
    assert.ok(playbook.auditRequirements.some((a) => a.toLowerCase().includes("snapshot")));
  } finally {
    cleanupPath(workspace);
  }
});

test("runStableRollbackRehearsal report contains correct metadata and timestamps", async () => {
  const workspace = createTempWorkspace("aa-rollback-metadata-");

  try {
    const report = await runStableRollbackRehearsal({ outputDir: workspace });

    assert.ok(report.startedAt.length > 0);
    assert.ok(report.finishedAt.length > 0);
    assert.ok(new Date(report.startedAt) <= new Date(report.finishedAt));
    assert.equal(report.outputDir, workspace);
    assert.equal(report.artifacts.reportPath, join(workspace, "stable-rollback-report.json"));
    assert.equal(report.artifacts.playbookPath, join(workspace, "stable-rollback-playbook.json"));
  } finally {
    cleanupPath(workspace);
  }
});
