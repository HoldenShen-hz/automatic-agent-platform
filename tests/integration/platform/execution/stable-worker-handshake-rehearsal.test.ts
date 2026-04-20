import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  runStableWorkerHandshakeRehearsal,
  writeStableWorkerHandshakeRehearsalReport,
} from "../../../../src/platform/shared/stability/stable-worker-handshake-rehearsal.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("stable worker handshake rehearsal validates claim, heartbeat renewal, and stale fencing rejection", async () => {
  const workspace = createTempWorkspace("aa-stable-worker-handshake-");

  try {
    const report = await runStableWorkerHandshakeRehearsal({
      outputDir: workspace,
    });
    const reportPath = join(workspace, "stable-worker-handshake-report.json");
    writeStableWorkerHandshakeRehearsalReport(reportPath, report);

    assert.equal(report.totalScenarios, 3);
    assert.equal(report.failedScenarios, 0);
    assert.equal(report.passedScenarios, 3);
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "worker_claim_consumes_ticket"));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "worker_heartbeat_renews_lease"));
    assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "stale_fencing_handshake_rejected"));
    assert.equal(existsSync(reportPath), true);

    const persisted = JSON.parse(readFileSync(reportPath, "utf8")) as { failedScenarios: number };
    assert.equal(persisted.failedScenarios, 0);
  } finally {
    cleanupPath(workspace);
  }
});
