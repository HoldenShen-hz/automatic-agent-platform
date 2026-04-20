import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  runStableLeaseRehearsal,
  writeStableLeaseRehearsalReport,
} from "../../../../src/platform/shared/stability/stable-lease-rehearsal.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("stable lease rehearsal validates reclaim, fencing, handover, and worker registry behavior", async () => {
  const workspace = createTempWorkspace("aa-stable-lease-");

  try {
    const report = await runStableLeaseRehearsal({
      outputDir: workspace,
    });
    const outputFile = join(workspace, "stable-lease-report.json");
    writeStableLeaseRehearsalReport(outputFile, report);

    assert.equal(report.failedScenarios, 0);
    assert.equal(report.totalScenarios, 4);
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "lease_handover_preserves_lineage"));
    assert.equal(existsSync(outputFile), true);
  } finally {
    cleanupPath(workspace);
  }
});
