import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  runStableMaintenanceRehearsal,
  writeStableMaintenanceRehearsalReport,
} from "../../../../src/platform/shared/stability/stable-maintenance-rehearsal.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("stable maintenance rehearsal validates drain rejection and controlled handover", async () => {
  const workspace = createTempWorkspace("aa-stable-maintenance-");

  try {
    const report = await runStableMaintenanceRehearsal({
      outputDir: workspace,
    });
    const outputFile = join(workspace, "stable-maintenance-report.json");
    writeStableMaintenanceRehearsalReport(outputFile, report);

    assert.equal(report.failedScenarios, 0);
    assert.equal(report.totalScenarios, 2);
    assert.equal(report.artifacts.reportPath, outputFile);
    assert.equal(report.artifacts.playbookPath, join(workspace, "stable-maintenance-playbook.json"));
    assert.equal(report.playbook.maintenanceOwner, "runtime_reliability_oncall");
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "draining_worker_rejects_new_dispatches"));
    assert.ok(
      report.scenarios.some((scenario) => scenario.scenarioId === "step_boundary_handover_preserves_execution_lineage"),
    );
    assert.equal(existsSync(outputFile), true);
    assert.equal(existsSync(report.artifacts.playbookPath), true);

    const playbook = JSON.parse(readFileSync(report.artifacts.playbookPath, "utf8")) as {
      maintenanceOwner: string;
      targets: Array<{ targetId: string }>;
    };
    assert.equal(playbook.maintenanceOwner, "runtime_reliability_oncall");
    assert.ok(playbook.targets.some((target) => target.targetId === "dispatch_policy"));
  } finally {
    cleanupPath(workspace);
  }
});
