import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  runStableConcurrencyRehearsal,
  writeStableConcurrencyRehearsalReport,
} from "../../../../src/platform/shared/stability/stable-concurrency-rehearsal.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("stable concurrency rehearsal validates lock recovery and execution conflict fail-close", async () => {
  const workspace = createTempWorkspace("aa-stable-concurrency-");

  try {
    const report = await runStableConcurrencyRehearsal({
      outputDir: workspace,
    });
    const outputFile = join(workspace, "stable-concurrency-report.json");
    writeStableConcurrencyRehearsalReport(outputFile, report);

    assert.equal(report.failedScenarios, 0);
    assert.equal(report.totalScenarios, 3);
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.equal(existsSync(outputFile), true);
  } finally {
    cleanupPath(workspace);
  }
});
