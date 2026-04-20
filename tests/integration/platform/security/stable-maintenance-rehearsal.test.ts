import assert from "node:assert/strict";
import test from "node:test";

import { runStableMaintenanceRehearsal } from "../../../../src/platform/shared/stability/stable-maintenance-rehearsal.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("stable maintenance rehearsal fails closed on new dispatch and stale writes during worker drain", async () => {
  const workspace = createTempWorkspace("aa-maintenance-security-");

  try {
    const report = await runStableMaintenanceRehearsal({
      outputDir: workspace,
    });
    const drainScenario = report.scenarios.find((scenario) => scenario.scenarioId === "draining_worker_rejects_new_dispatches");
    const handoverScenario = report.scenarios.find(
      (scenario) => scenario.scenarioId === "step_boundary_handover_preserves_execution_lineage",
    );
    const drainingEvaluation = drainScenario?.details.drainingEvaluation as { rejectionReason: string } | null | undefined;
    const staleWrite = handoverScenario?.details.staleWrite as { allowed: boolean; reasonCode: string | null } | null | undefined;

    assert.equal(report.failedScenarios, 0);
    assert.equal(drainingEvaluation?.rejectionReason, "worker_draining");
    assert.equal(staleWrite?.allowed, false);
    assert.equal(staleWrite?.reasonCode, "stale_fencing_token");
  } finally {
    cleanupPath(workspace);
  }
});
