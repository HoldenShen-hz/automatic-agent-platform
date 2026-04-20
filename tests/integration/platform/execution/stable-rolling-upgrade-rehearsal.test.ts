import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  runStableRollingUpgradeRehearsal,
  writeStableRollingUpgradeRehearsalReport,
} from "../../../../src/platform/shared/stability/stable-rolling-upgrade-rehearsal.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("stable rolling upgrade rehearsal validates canary repo routing and step-boundary handover", async () => {
  const workspace = createTempWorkspace("aa-stable-upgrade-");

  try {
    const report = await runStableRollingUpgradeRehearsal({
      outputDir: workspace,
    });
    const outputFile = join(workspace, "stable-rolling-upgrade-report.json");
    writeStableRollingUpgradeRehearsalReport(outputFile, report);

    assert.equal(report.failedScenarios, 0);
    assert.equal(report.totalScenarios, 2);
    assert.equal(report.artifacts.reportPath, outputFile);
    assert.equal(report.artifacts.playbookPath, join(workspace, "stable-rolling-upgrade-playbook.json"));
    assert.equal(report.playbook.upgradeOwner, "release_manager_oncall");
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "repo_version_canary_routes_to_upgraded_worker"));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "lease_handover_supports_step_boundary_upgrade"));
    assert.equal(existsSync(outputFile), true);
    assert.equal(existsSync(report.artifacts.playbookPath), true);

    const playbook = JSON.parse(readFileSync(report.artifacts.playbookPath, "utf8")) as {
      upgradeOwner: string;
      targets: Array<{ targetId: string }>;
    };
    assert.equal(playbook.upgradeOwner, "release_manager_oncall");
    assert.ok(playbook.targets.some((target) => target.targetId === "dispatch_policy"));
  } finally {
    cleanupPath(workspace);
  }
});
