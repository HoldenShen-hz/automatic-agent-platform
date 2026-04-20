import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  runStableGrayReleaseRehearsal,
  writeStableGrayReleaseRehearsalReport,
} from "../../../../src/platform/shared/stability/stable-gray-release-rehearsal.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("stable gray release rehearsal validates cohort isolation and rollback switches", async () => {
  const workspace = createTempWorkspace("aa-stable-gray-");

  try {
    const report = await runStableGrayReleaseRehearsal({
      outputDir: workspace,
    });
    const outputFile = join(workspace, "stable-gray-release-report.json");
    writeStableGrayReleaseRehearsalReport(outputFile, report);

    assert.equal(report.failedScenarios, 0);
    assert.equal(report.totalScenarios, 2);
    assert.equal(report.artifacts.reportPath, outputFile);
    assert.equal(report.artifacts.playbookPath, join(workspace, "stable-gray-release-playbook.json"));
    assert.equal(report.playbook.rolloutOwner, "release_manager_oncall");
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "gray_cohort_routes_only_to_canary_worker_group"));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "gray_rollback_switch_restores_stable_routing"));
    assert.equal(existsSync(outputFile), true);
    assert.equal(existsSync(report.artifacts.playbookPath), true);

    const playbook = JSON.parse(readFileSync(report.artifacts.playbookPath, "utf8")) as {
      rolloutOwner: string;
      cohorts: Array<{ cohortId: string }>;
    };
    assert.equal(playbook.rolloutOwner, "release_manager_oncall");
    assert.ok(playbook.cohorts.some((cohort) => cohort.cohortId === "tenant_gray_design_partners"));
  } finally {
    cleanupPath(workspace);
  }
});
