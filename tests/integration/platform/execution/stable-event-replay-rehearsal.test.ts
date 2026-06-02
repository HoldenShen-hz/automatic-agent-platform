import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  runStableEventReplayRehearsal,
  writeStableEventReplayRehearsalReport,
} from "../../../../src/platform/shared/stability/stable-event-replay-rehearsal.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

process.env["AA_AUDIT_INTEGRITY_HMAC_KEY"] ??= "testing-audit-integrity-key-012345";

test("stable event replay rehearsal clears failed consumer acknowledgements via replay", async () => {
  const workspace = createTempWorkspace("aa-stable-replay-");

  try {
    const report = await runStableEventReplayRehearsal({
      outputDir: workspace,
    });
    const outputFile = join(workspace, "stable-event-replay-report.json");
    writeStableEventReplayRehearsalReport(outputFile, report);

    assert.equal(report.failedScenarios, 0);
    assert.equal(report.totalScenarios, 1);
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.equal(existsSync(outputFile), true);
  } finally {
    cleanupPath(workspace);
  }
});
