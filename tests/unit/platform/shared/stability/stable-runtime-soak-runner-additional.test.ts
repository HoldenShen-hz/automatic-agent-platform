/**
 * Unit tests for Stable Runtime Soak Runner Module.
 *
 * Tests the long-duration soak testing functionality:
 * - Soak report merging
 * - Memory tracking
 * - Duration tracking
 */

import assert from "node:assert/strict";
import test from "node:test";

import { mergeStableSoakReports, type StableSoakReport } from "../../../../../src/platform/shared/stability/stable-runtime-soak-runner.js";
import type { StableValidationReport } from "../../../../../src/platform/shared/stability/stable-runtime-validator.js";

function createValidationReport(caseId: string, durationMs: number): StableValidationReport {
  return {
    startedAt: "2026-04-07T00:00:00.000Z",
    finishedAt: "2026-04-07T00:00:10.000Z",
    iterations: 1,
    totalRuns: 1,
    passedRuns: 1,
    failedRuns: 0,
    integrityFailures: 0,
    backupFailures: 0,
    averageDurationMs: durationMs,
    maxDurationMs: durationMs,
    caseSummaries: [
      {
        caseId,
        totalRuns: 1,
        passedRuns: 1,
        failedRuns: 0,
        averageDurationMs: durationMs,
        maxDurationMs: durationMs,
      },
    ],
    artifacts: {
      reportPath: "/tmp/validation.json",
      baselinePath: "/tmp/validation-baseline.json",
      inventoryPath: "/tmp/inventory.json",
    },
    baselineComparison: {
      baselinePath: "/tmp/validation-baseline.json",
      baselineCreated: true,
      status: "baseline_created",
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
    runs: [
      {
        iteration: 1,
        caseId,
        passed: true,
        durationMs,
        dbIntegrityPassed: true,
        backupPassed: true,
        backupPath: "/tmp/case.backup.db",
      },
    ],
  };
}

function createSoakReport(
  startedAt: string,
  durationMs: number,
  wallClockMs: number,
  cycles: number,
  totalRuns: number,
  failedRuns: number,
  initialHeap?: number,
  peakHeap?: number,
): StableSoakReport {
  return {
    startedAt,
    finishedAt: "2026-04-07T00:10:00.000Z",
    durationMs,
    wallClockDurationMs: wallClockMs,
    intervalMs: 1_000,
    iterationsPerCycle: 1,
    cycles: Array.from({ length: cycles }, (_, i) => ({
      cycle: i + 1,
      startedAt: "2026-04-07T00:00:00.000Z",
      finishedAt: "2026-04-07T00:10:00.000Z",
      report: createValidationReport(`case-${i + 1}`, 100 + i * 10),
    })),
    totalRuns,
    failedRuns,
    passedRuns: totalRuns - failedRuns,
    integrityFailures: 0,
    backupFailures: 0,
    ...(initialHeap != null ? { initialHeapUsedBytes: initialHeap } : {}),
    ...(peakHeap != null ? { peakHeapUsedBytes: peakHeap } : {}),
  };
}

test("mergeStableSoakReports combines cycles and renumbers them [stable-runtime-soak-runner-additional]", () => {
  const report1 = createSoakReport("2026-04-07T00:00:00.000Z", 60_000, 60_000, 2, 2, 0);
  const report2 = createSoakReport("2026-04-07T00:01:00.000Z", 60_000, 60_000, 2, 2, 0);

  const merged = mergeStableSoakReports([report1, report2]);

  assert.equal(merged.cycles.length, 4);
  assert.equal(merged.cycles[0]!.cycle, 1);
  assert.equal(merged.cycles[1]!.cycle, 2);
  assert.equal(merged.cycles[2]!.cycle, 3);
  assert.equal(merged.cycles[3]!.cycle, 4);
});

test("mergeStableSoakReports aggregates total runs and failures [stable-runtime-soak-runner-additional]", () => {
  const report1 = createSoakReport("2026-04-07T00:00:00.000Z", 60_000, 60_000, 2, 2, 1);
  const report2 = createSoakReport("2026-04-07T00:01:00.000Z", 60_000, 60_000, 2, 2, 0);

  const merged = mergeStableSoakReports([report1, report2]);

  assert.equal(merged.totalRuns, 4);
  assert.equal(merged.failedRuns, 1);
  assert.equal(merged.passedRuns, 3);
});

test("mergeStableSoakReports aggregates duration and wallClockDurationMs [stable-runtime-soak-runner-additional]", () => {
  const report1 = createSoakReport("2026-04-07T00:00:00.000Z", 60_000, 60_000, 2, 2, 0);
  const report2 = createSoakReport("2026-04-07T00:01:00.000Z", 90_000, 90_000, 2, 2, 0);

  const merged = mergeStableSoakReports([report1, report2]);

  assert.equal(merged.durationMs, 150_000);
  assert.equal(merged.wallClockDurationMs, 150_000);
});

test("mergeStableSoakReports computes memory growth ratio [stable-runtime-soak-runner-additional]", () => {
  const report1 = createSoakReport(
    "2026-04-07T00:00:00.000Z",
    60_000,
    60_000,
    1,
    1,
    0,
    10_000_000,
    15_000_000,
  );
  const report2 = createSoakReport(
    "2026-04-07T00:01:00.000Z",
    60_000,
    60_000,
    1,
    1,
    0,
    10_000_000,
    20_000_000,
  );

  const merged = mergeStableSoakReports([report1, report2]);

  assert.equal(merged.initialHeapUsedBytes, 10_000_000);
  assert.equal(merged.peakHeapUsedBytes, 20_000_000);
  assert.equal(merged.memoryGrowthRatio, 2.0);
});

test("mergeStableSoakReports handles empty array gracefully [stable-runtime-soak-runner-additional]", () => {
  const merged = mergeStableSoakReports([]);

  assert.equal(merged.cycles.length, 0);
  assert.equal(merged.totalRuns, 0);
});

test("mergeStableSoakReports uses first report's interval and iterationsPerCycle [stable-runtime-soak-runner-additional]", () => {
  const report1 = createSoakReport("2026-04-07T00:00:00.000Z", 60_000, 60_000, 2, 2, 0);
  report1.intervalMs = 5_000;
  report1.iterationsPerCycle = 3;

  const report2 = createSoakReport("2026-04-07T00:01:00.000Z", 60_000, 60_000, 2, 2, 0);
  report2.intervalMs = 10_000;
  report2.iterationsPerCycle = 5;

  const merged = mergeStableSoakReports([report1, report2]);

  assert.equal(merged.intervalMs, 5_000);
  assert.equal(merged.iterationsPerCycle, 3);
});

test("mergeStableSoakReports preserves startedAt from first report [stable-runtime-soak-runner-additional]", () => {
  const report1 = createSoakReport("2026-04-07T00:00:00.000Z", 60_000, 60_000, 2, 2, 0);
  const report2 = createSoakReport("2026-04-07T01:00:00.000Z", 60_000, 60_000, 2, 2, 0);

  const merged = mergeStableSoakReports([report1, report2]);

  assert.equal(merged.startedAt, "2026-04-07T00:00:00.000Z");
});

test("mergeStableSoakReports uses last report's finishedAt [stable-runtime-soak-runner-additional]", () => {
  const report1 = createSoakReport("2026-04-07T00:00:00.000Z", 60_000, 60_000, 2, 2, 0);
  const report2 = createSoakReport("2026-04-07T01:00:00.000Z", 60_000, 60_000, 2, 2, 0);
  report2.finishedAt = "2026-04-07T02:00:00.000Z";

  const merged = mergeStableSoakReports([report1, report2]);

  assert.equal(merged.finishedAt, "2026-04-07T02:00:00.000Z");
});

test("mergeStableSoakReports aggregates integrityFailures and backupFailures [stable-runtime-soak-runner-additional]", () => {
  const report1 = createSoakReport("2026-04-07T00:00:00.000Z", 60_000, 60_000, 2, 2, 0);
  report1.integrityFailures = 2;
  report1.backupFailures = 1;

  const report2 = createSoakReport("2026-04-07T00:01:00.000Z", 60_000, 60_000, 2, 2, 0);
  report2.integrityFailures = 1;
  report2.backupFailures = 3;

  const merged = mergeStableSoakReports([report1, report2]);

  assert.equal(merged.integrityFailures, 3);
  assert.equal(merged.backupFailures, 4);
});
