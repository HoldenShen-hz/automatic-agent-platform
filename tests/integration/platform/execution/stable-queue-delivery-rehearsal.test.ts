import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  runStableQueueDeliveryRehearsal,
  writeStableQueueDeliveryRehearsalReport,
} from "../../../../src/platform/shared/stability/stable-queue-delivery-rehearsal.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("stable queue delivery rehearsal validates queue replay and duplicate delivery containment", async () => {
  const workspace = createTempWorkspace("aa-stable-queue-delivery-");

  try {
    const report = await runStableQueueDeliveryRehearsal({
      outputDir: workspace,
    });
    const outputFile = join(workspace, "stable-queue-delivery-report.json");
    writeStableQueueDeliveryRehearsalReport(outputFile, report);

    assert.equal(report.failedScenarios, 0);
    assert.equal(report.totalScenarios, 2);
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "queue_replay_rebuilds_dispatchable_ticket"));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "duplicate_delivery_blocked_and_reconciled"));
    assert.equal(existsSync(outputFile), true);
  } finally {
    cleanupPath(workspace);
  }
});
