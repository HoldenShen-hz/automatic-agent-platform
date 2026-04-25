import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStableEvidenceBundle } from "../../../../src/platform/stability/stable-evidence-bundle.js";
import type { StableSoakReport } from "../../../../src/platform/stability/stable-runtime-soak-runner.js";
import type { StableValidationReport } from "../../../../src/platform/stability/stable-runtime-validator.js";

test("createStableEvidenceBundle writes a full smoke bundle with provided validation and soak reports", async () => {
  const outputDir = mkdtempSync(join(tmpdir(), "stable-evidence-bundle-"));
  const validationReport: StableValidationReport = {
    startedAt: "2026-04-20T00:00:00.000Z",
    finishedAt: "2026-04-20T00:00:01.000Z",
    iterations: 1,
    totalRuns: 1,
    passedRuns: 1,
    failedRuns: 0,
    integrityFailures: 0,
    backupFailures: 0,
    averageDurationMs: 1,
    maxDurationMs: 1,
    caseSummaries: [],
    artifacts: {
      reportPath: join(outputDir, "validation-report.json"),
      baselinePath: join(outputDir, "validation-baseline.json"),
      inventoryPath: join(outputDir, "validation-inventory.json"),
    },
    baselineComparison: {
      baselinePath: join(outputDir, "validation-baseline.json"),
      baselineCreated: false,
      status: "match",
      regressionDetected: false,
      failedRunsDelta: 0,
      integrityFailuresDelta: 0,
      backupFailuresDelta: 0,
      averageDurationDeltaMs: 0,
      averageDurationDeltaPct: 0,
      maxDurationDeltaMs: 0,
      maxDurationDeltaPct: 0,
      caseDrifts: [],
    },
    runs: [],
  };
  const soakReport: StableSoakReport = {
    startedAt: "2026-04-20T00:00:02.000Z",
    finishedAt: "2026-04-20T00:00:02.000Z",
    durationMs: 0,
    wallClockDurationMs: 0,
    intervalMs: 0,
    iterationsPerCycle: 1,
    cycles: [],
    totalRuns: 1,
    failedRuns: 0,
    passedRuns: 1,
    integrityFailures: 0,
    backupFailures: 0,
  };

  try {
    const report = await createStableEvidenceBundle({
      outputDir,
      profileName: "smoke",
      validationReport,
      soakReport,
    });

    assert.equal(report.profile.name, "smoke");
    assert.equal(report.summary.passed, true);
    assert.equal(report.summary.totalValidationRuns, 1);
    assert.equal(report.summary.totalSoakRuns, 1);
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});
