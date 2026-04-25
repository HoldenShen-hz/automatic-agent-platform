import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  mergeStableSoakReports,
  runStableSoak,
  writeStableSoakReport,
  type StableSoakReport,
  type StableSoakCycle,
} from "../../../../src/platform/stability/stable-runtime-soak-runner.js";
import type {
  StableValidationReport,
  StableValidationRun,
  StableValidationCaseSummary,
  StableValidationBaselineComparison,
} from "../../../../src/platform/stability/stable-runtime-validator.js";

describe("stable-runtime-soak-runner", () => {
  describe("mergeStableSoakReports", () => {
    test("merges empty array returns default report", () => {
      const result = mergeStableSoakReports([]);
      assert.equal(result.totalRuns, 0);
      assert.equal(result.failedRuns, 0);
      assert.equal(result.passedRuns, 0);
      assert.equal(result.durationMs, 0);
      assert.equal(result.wallClockDurationMs, 0);
    });

    test("merges single report correctly", () => {
      const reports: StableSoakReport[] = [
        {
          startedAt: "2024-01-01T00:00:00Z",
          finishedAt: "2024-01-01T01:00:00Z",
          durationMs: 3600000,
          wallClockDurationMs: 3600000,
          intervalMs: 500,
          iterationsPerCycle: 2,
          cycles: [],
          totalRuns: 10,
          failedRuns: 1,
          passedRuns: 9,
          integrityFailures: 0,
          backupFailures: 0,
        },
      ];
      const result = mergeStableSoakReports(reports);
      assert.equal(result.totalRuns, 10);
      assert.equal(result.failedRuns, 1);
      assert.equal(result.passedRuns, 9);
    });

    test("sums total runs across multiple reports", () => {
      const reports: StableSoakReport[] = [
        createMockSoakReport({ totalRuns: 10, failedRuns: 1, passedRuns: 9 }),
        createMockSoakReport({ totalRuns: 20, failedRuns: 2, passedRuns: 18 }),
        createMockSoakReport({ totalRuns: 15, failedRuns: 0, passedRuns: 15 }),
      ];
      const result = mergeStableSoakReports(reports);
      assert.equal(result.totalRuns, 45);
      assert.equal(result.failedRuns, 3);
      assert.equal(result.passedRuns, 42);
    });

    test("sums integrity failures across reports", () => {
      const reports: StableSoakReport[] = [
        createMockSoakReport({ integrityFailures: 2 }),
        createMockSoakReport({ integrityFailures: 3 }),
      ];
      const result = mergeStableSoakReports(reports);
      assert.equal(result.integrityFailures, 5);
    });

    test("sums backup failures across reports", () => {
      const reports: StableSoakReport[] = [
        createMockSoakReport({ backupFailures: 1 }),
        createMockSoakReport({ backupFailures: 4 }),
      ];
      const result = mergeStableSoakReports(reports);
      assert.equal(result.backupFailures, 5);
    });

    test("flattens and re-cycles cycles", () => {
      const cycle1: StableSoakCycle = {
        cycle: 1,
        startedAt: "2024-01-01T00:00:00Z",
        finishedAt: "2024-01-01T00:01:00Z",
        report: createMockValidationReport(),
      };
      const cycle2: StableSoakCycle = {
        cycle: 2,
        startedAt: "2024-01-01T00:01:00Z",
        finishedAt: "2024-01-01T00:02:00Z",
        report: createMockValidationReport(),
      };
      const reports: StableSoakReport[] = [
        createMockSoakReport({ cycles: [cycle1] }),
        createMockSoakReport({ cycles: [cycle2] }),
      ];
      const result = mergeStableSoakReports(reports);
      assert.equal(result.cycles.length, 2);
      assert.equal(result.cycles[0]!.cycle, 1);
      assert.equal(result.cycles[1]!.cycle, 2);
    });

    test("uses first report's intervalMs and iterationsPerCycle", () => {
      const reports: StableSoakReport[] = [
        createMockSoakReport({ intervalMs: 500, iterationsPerCycle: 3 }),
        createMockSoakReport({ intervalMs: 1000, iterationsPerCycle: 5 }),
      ];
      const result = mergeStableSoakReports(reports);
      assert.equal(result.intervalMs, 500);
      assert.equal(result.iterationsPerCycle, 3);
    });

    test("computes memoryGrowthRatio from first report initial and peak across all", () => {
      const reports: StableSoakReport[] = [
        createMockSoakReport({ initialHeapUsedBytes: 100, peakHeapUsedBytes: 150 }),
        createMockSoakReport({ initialHeapUsedBytes: 100, peakHeapUsedBytes: 200 }),
      ];
      const result = mergeStableSoakReports(reports);
      assert.equal(result.initialHeapUsedBytes, 100);
      assert.equal(result.peakHeapUsedBytes, 200);
      assert.equal(result.memoryGrowthRatio, 2.0);
    });

    test("does not include memory fields when initialHeapUsedBytes is undefined", () => {
      const { initialHeapUsedBytes: _ie, peakHeapUsedBytes: _pe, ...memorylessReport } = createMockSoakReport({});
      const reports: StableSoakReport[] = [
        { ...memorylessReport },
      ];
      const result = mergeStableSoakReports(reports);
      assert.equal(result.initialHeapUsedBytes, undefined);
      assert.equal(result.peakHeapUsedBytes, undefined);
    });

    test("uses startedAt from first report and finishedAt from last report", () => {
      const reports: StableSoakReport[] = [
        createMockSoakReport({ startedAt: "2024-01-01T00:00:00Z" }),
        createMockSoakReport({ startedAt: "2024-01-02T00:00:00Z", finishedAt: "2024-01-02T12:00:00Z" }),
      ];
      const result = mergeStableSoakReports(reports);
      assert.equal(result.startedAt, "2024-01-01T00:00:00Z");
      assert.equal(result.finishedAt, "2024-01-02T12:00:00Z");
    });

    test("runStableSoak produces at least one validation cycle", async () => {
      const outputDir = mkdtempSync(join(tmpdir(), "stable-soak-runner-"));
      try {
        const report = await runStableSoak({
          outputDir,
          durationMs: 0,
          intervalMs: 0,
          iterationsPerCycle: 1,
        });

        assert.equal(report.durationMs, 0);
        assert.equal(report.cycles.length > 0, true);
        assert.equal(report.totalRuns >= 1, true);
        assert.equal(report.passedRuns + report.failedRuns, report.totalRuns);
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    });

    test("writeStableSoakReport writes JSON to disk", () => {
      const outputDir = mkdtempSync(join(tmpdir(), "stable-soak-report-"));
      const reportPath = join(outputDir, "stable-soak-report.json");
      const report = createMockSoakReport({});

      try {
        writeStableSoakReport(reportPath, report);

        const written = JSON.parse(readFileSync(reportPath, "utf8")) as StableSoakReport;
        assert.equal(written.totalRuns, report.totalRuns);
        assert.equal(written.failedRuns, report.failedRuns);
      } finally {
        rmSync(outputDir, { recursive: true, force: true });
      }
    });
  });
});

function createMockValidationReport(overrides: Partial<StableValidationReport> = {}): StableValidationReport {
  const mockRuns: StableValidationRun[] = [];
  const mockCaseSummaries: StableValidationCaseSummary[] = [];
  const mockBaselineComparison: StableValidationBaselineComparison = {
    baselinePath: "/tmp/baseline",
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
  };
  return {
    startedAt: "2024-01-01T00:00:00Z",
    finishedAt: "2024-01-01T00:10:00Z",
    iterations: 2,
    totalRuns: 10,
    passedRuns: 9,
    failedRuns: 1,
    integrityFailures: 0,
    backupFailures: 0,
    averageDurationMs: 100,
    maxDurationMs: 200,
    caseSummaries: mockCaseSummaries,
    artifacts: {
      reportPath: "/tmp/report",
      baselinePath: "/tmp/baseline",
      inventoryPath: "/tmp/inventory",
    },
    baselineComparison: mockBaselineComparison,
    runs: mockRuns,
    ...overrides,
  };
}

function createMockSoakReport(overrides: Partial<StableSoakReport> = {}): StableSoakReport {
  return {
    startedAt: "2024-01-01T00:00:00Z",
    finishedAt: "2024-01-01T01:00:00Z",
    durationMs: 3600000,
    wallClockDurationMs: 3600000,
    intervalMs: 500,
    iterationsPerCycle: 2,
    cycles: [],
    totalRuns: 10,
    failedRuns: 0,
    passedRuns: 10,
    integrityFailures: 0,
    backupFailures: 0,
    ...overrides,
  };
}
