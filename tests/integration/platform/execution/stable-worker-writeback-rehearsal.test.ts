import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  runStableWorkerWritebackRehearsal,
  writeStableWorkerWritebackRehearsalReport,
} from "../../../../src/platform/shared/stability/stable-worker-writeback-rehearsal.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("stable worker writeback rehearsal validates completion, duplicate rejection, and stale fencing rejection", async () => {
  const workspace = createTempWorkspace("aa-stable-worker-writeback-");

  try {
    const report = await runStableWorkerWritebackRehearsal({
      outputDir: workspace,
    });
    const reportPath = join(workspace, "stable-worker-writeback-report.json");
    writeStableWorkerWritebackRehearsalReport(reportPath, report);

    assert.equal(report.totalScenarios, 3);
    assert.equal(report.failedScenarios, 0);
    assert.equal(report.passedScenarios, 3);
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "worker_writeback_completes_execution"));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "duplicate_writeback_rejected"));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "stale_fencing_writeback_rejected"));
    assert.equal(existsSync(reportPath), true);

    const persisted = JSON.parse(readFileSync(reportPath, "utf8")) as { failedScenarios: number };
    assert.equal(persisted.failedScenarios, 0);
  } finally {
    cleanupPath(workspace);
  }
});
