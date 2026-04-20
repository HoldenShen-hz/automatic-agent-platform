import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  runStableCrossDivisionRecoveryDrill,
  writeStableCrossDivisionRecoveryDrillReport,
} from "../../../../src/platform/shared/stability/stable-cross-division-recovery-drill.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("stable cross-division recovery drill validates overview and replay outcomes across divisions", async () => {
  const workspace = createTempWorkspace("aa-cross-division-recovery-drill-");

  try {
    const report = await runStableCrossDivisionRecoveryDrill({
      outputDir: workspace,
    });
    const reportPath = join(workspace, "stable-recovery-drill-report.json");
    writeStableCrossDivisionRecoveryDrillReport(reportPath, report);

    assert.equal(report.totalScenarios, 2);
    assert.equal(report.failedScenarios, 0);
    assert.equal(report.passedScenarios, 2);
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "cross_division_overview"));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "cross_division_replay_matrix"));
    assert.equal(existsSync(reportPath), true);

    const persisted = JSON.parse(readFileSync(reportPath, "utf8")) as { failedScenarios: number };
    assert.equal(persisted.failedScenarios, 0);
  } finally {
    cleanupPath(workspace);
  }
});
