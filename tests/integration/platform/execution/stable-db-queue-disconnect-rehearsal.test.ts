import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  runStableDbQueueDisconnectRehearsal,
  writeStableDbQueueDisconnectRehearsalReport,
} from "../../../../src/platform/shared/stability/stable-db-queue-disconnect-rehearsal.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("stable DB queue disconnect rehearsal validates degrade, repair, and fail-closed writeback behavior", async () => {
  const workspace = createTempWorkspace("aa-stable-db-queue-disconnect-");

  try {
    const report = await runStableDbQueueDisconnectRehearsal({
      outputDir: workspace,
    });
    const outputFile = join(workspace, "stable-db-queue-disconnect-report.json");
    writeStableDbQueueDisconnectRehearsalReport(outputFile, report);

    assert.equal(report.failedScenarios, 0);
    assert.equal(report.totalScenarios, 3);
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "queue_disconnect_degrades_without_silent_drop"));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "missing_dispatch_ticket_rebuilt_after_queue_reconnect"));
    assert.ok(
      report.scenarios.some(
        (scenario) => scenario.scenarioId === "authoritative_writeback_failure_fails_closed_until_store_recovers",
      ),
    );
    assert.equal(existsSync(outputFile), true);
  } finally {
    cleanupPath(workspace);
  }
});
