import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  runStableDispatchReconciliationRehearsal,
  writeStableDispatchReconciliationRehearsalReport,
} from "../../../../src/platform/shared/stability/stable-dispatch-reconciliation-rehearsal.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("stable dispatch reconciliation rehearsal validates orphan claim recovery and terminal ticket cancellation", async () => {
  const workspace = createTempWorkspace("aa-stable-dispatch-reconcile-");

  try {
    const report = await runStableDispatchReconciliationRehearsal({
      outputDir: workspace,
    });
    const reportPath = join(workspace, "stable-dispatch-reconcile-report.json");
    writeStableDispatchReconciliationRehearsalReport(reportPath, report);

    assert.equal(report.totalScenarios, 2);
    assert.equal(report.failedScenarios, 0);
    assert.equal(report.passedScenarios, 2);
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "orphan_claim_requeued"));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "terminal_execution_ticket_cancelled"));
    assert.equal(existsSync(reportPath), true);

    const persisted = JSON.parse(readFileSync(reportPath, "utf8")) as { failedScenarios: number };
    assert.equal(persisted.failedScenarios, 0);
  } finally {
    cleanupPath(workspace);
  }
});
