import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  runStableSoak,
  writeStableSoakReport,
} from "../../../../src/platform/shared/stability/stable-runtime-soak-runner.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("stable soak runner writes a reproducible short-run evidence report", async () => {
  const workspace = createTempWorkspace("aa-soak-");

  try {
    const report = await runStableSoak({
      outputDir: workspace,
      durationMs: 25,
      intervalMs: 5,
      iterationsPerCycle: 1,
    });

    const outputFile = join(workspace, "stable-soak-report.json");
    writeStableSoakReport(outputFile, report);

    assert.ok(report.cycles.length >= 1);
    assert.ok(report.totalRuns >= 2);
    assert.equal(report.failedRuns, 0);
    assert.equal(report.integrityFailures, 0);
    assert.equal(report.backupFailures, 0);
    assert.equal(existsSync(outputFile), true);

    const persisted = JSON.parse(readFileSync(outputFile, "utf8")) as { totalRuns: number };
    assert.equal(persisted.totalRuns, report.totalRuns);
  } finally {
    cleanupPath(workspace);
  }
});
