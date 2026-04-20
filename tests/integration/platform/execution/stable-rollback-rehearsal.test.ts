import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  runStableRollbackRehearsal,
  writeStableRollbackRehearsalReport,
} from "../../../../src/platform/shared/stability/stable-rollback-rehearsal.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("stable rollback rehearsal exercises repair and manual takeover recovery paths", async () => {
  const workspace = createTempWorkspace("aa-rollback-rehearsal-");

  try {
    const report = await runStableRollbackRehearsal({
      outputDir: workspace,
    });
    const reportPath = join(workspace, "stable-rollback-report.json");
    writeStableRollbackRehearsalReport(reportPath, report);

    assert.equal(report.totalScenarios, 2);
    assert.equal(report.failedScenarios, 0);
    assert.equal(report.passedScenarios, 2);
    assert.equal(report.artifacts.reportPath, reportPath);
    assert.equal(report.artifacts.playbookPath, join(workspace, "stable-rollback-playbook.json"));
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "runtime_repair_rehearsal"));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "manual_takeover_rehearsal"));
    assert.equal(existsSync(reportPath), true);
    assert.equal(existsSync(report.artifacts.playbookPath), true);
    assert.equal(report.playbook.rollbackOwner, "release_manager_oncall");
    assert.ok(report.playbook.targets.some((target) => target.targetId === "config_bundle"));
    assert.ok(report.playbook.targets.some((target) => target.targetId === "feature_flag"));
    assert.ok(report.playbook.targets.some((target) => target.targetId === "worker_version"));
    assert.ok(report.playbook.targets.some((target) => target.targetId === "prompt_bundle"));
    assert.equal(report.playbook.prechecks.length >= 4, true);
    assert.equal(report.playbook.healthValidation.length >= 4, true);

    const persisted = JSON.parse(readFileSync(reportPath, "utf8")) as {
      failedScenarios: number;
      playbook: { rollbackOwner: string };
    };
    const playbook = JSON.parse(readFileSync(report.artifacts.playbookPath, "utf8")) as {
      rollbackOwner: string;
      targets: Array<{ targetId: string }>;
    };
    assert.equal(persisted.failedScenarios, 0);
    assert.equal(persisted.playbook.rollbackOwner, "release_manager_oncall");
    assert.ok(playbook.targets.some((target) => target.targetId === "config_bundle"));
  } finally {
    cleanupPath(workspace);
  }
});
