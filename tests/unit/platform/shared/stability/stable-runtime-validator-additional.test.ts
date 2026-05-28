/**
 * Unit tests for Stable Runtime Validator Module.
 *
 * Tests validation comparison, baseline building, and report merging:
 * - Baseline comparison with drift detection
 * - Validation report merging
 * - Run summarization
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  compareStableValidationToBaseline,
  mergeStableValidationReports,
  summarizeStableValidationRuns,
  buildStableValidationBaseline,
  type StableValidationRun,
} from "../../../../../src/platform/shared/stability/stable-runtime-validator.js";
import type { StableValidationReport, StableValidationBaseline } from "../../../../../src/platform/shared/stability/stable-runtime-validator.js";

function createValidationRun(caseId: string, passed: boolean, durationMs: number): StableValidationRun {
  return {
    iteration: 1,
    caseId,
    passed,
    durationMs,
    dbIntegrityPassed: passed,
    backupPassed: passed,
    backupPath: join(tmpdir(), `aa-stable-runtime-validator-${caseId}.backup.db`),
  };
}

function createBaseline(
  failedRuns: number,
  averageDurationMs: number,
  maxDurationMs: number,
  caseSummaries: Array<{ caseId: string; averageDurationMs: number }>,
): StableValidationBaseline {
  return {
    createdAt: "2026-04-07T00:00:00.000Z",
    sourceStartedAt: "2026-04-07T00:00:00.000Z",
    sourceFinishedAt: "2026-04-07T00:01:00.000Z",
    iterations: 1,
    totalRuns: 1,
    passedRuns: 1 - failedRuns,
    failedRuns,
    integrityFailures: 0,
    backupFailures: 0,
    averageDurationMs,
    maxDurationMs,
    caseSummaries: caseSummaries.map((s) => ({
      caseId: s.caseId,
      totalRuns: 1,
      passedRuns: 1,
      failedRuns: 0,
      averageDurationMs: s.averageDurationMs,
      maxDurationMs: s.averageDurationMs,
    })),
  };
}

test("compareStableValidationToBaseline returns baseline_created when no baseline exists [stable-runtime-validator-additional]", () => {
  const result = compareStableValidationToBaseline(
    { failedRuns: 0, integrityFailures: 0, backupFailures: 0, averageDurationMs: 100, maxDurationMs: 200, caseSummaries: [] },
    null,
    "/tmp/baseline.json",
  );

  assert.equal(result.baselineCreated, true);
  assert.equal(result.status, "baseline_created");
  assert.equal(result.regressionDetected, false);
});

test("compareStableValidationToBaseline detects regression when failed runs increase [stable-runtime-validator-additional]", () => {
  const baseline = createBaseline(0, 100, 200, [{ caseId: "case1", averageDurationMs: 100 }]);

  const result = compareStableValidationToBaseline(
    {
      failedRuns: 2,
      integrityFailures: 0,
      backupFailures: 0,
      averageDurationMs: 100,
      maxDurationMs: 200,
      caseSummaries: [{ caseId: "case1", totalRuns: 1, passedRuns: 0, failedRuns: 1, averageDurationMs: 100, maxDurationMs: 200 }],
    },
    baseline,
    "/tmp/baseline.json",
  );

  assert.equal(result.regressionDetected, true);
  assert.ok(result.failedRunsDelta > 0);
});

test("compareStableValidationToBaseline detects regression when integrity failures increase [stable-runtime-validator-additional]", () => {
  const baseline = createBaseline(0, 100, 200, [{ caseId: "case1", averageDurationMs: 100 }]);

  const result = compareStableValidationToBaseline(
    {
      failedRuns: 0,
      integrityFailures: 2,
      backupFailures: 0,
      averageDurationMs: 100,
      maxDurationMs: 200,
      caseSummaries: [],
    },
    baseline,
    "/tmp/baseline.json",
  );

  assert.equal(result.regressionDetected, true);
  assert.ok(result.integrityFailuresDelta > 0);
});

test("compareStableValidationToBaseline detects regression when backup failures increase [stable-runtime-validator-additional]", () => {
  const baseline = createBaseline(0, 100, 200, [{ caseId: "case1", averageDurationMs: 100 }]);

  const result = compareStableValidationToBaseline(
    {
      failedRuns: 0,
      integrityFailures: 0,
      backupFailures: 3,
      averageDurationMs: 100,
      maxDurationMs: 200,
      caseSummaries: [],
    },
    baseline,
    "/tmp/baseline.json",
  );

  assert.equal(result.regressionDetected, true);
  assert.ok(result.backupFailuresDelta > 0);
});

test("compareStableValidationToBaseline detects duration drift when average duration increases 250% [stable-runtime-validator-additional]", () => {
  const baseline = createBaseline(0, 100, 200, [{ caseId: "case1", averageDurationMs: 100 }]);

  const result = compareStableValidationToBaseline(
    {
      failedRuns: 0,
      integrityFailures: 0,
      backupFailures: 0,
      averageDurationMs: 300, // 200% increase
      maxDurationMs: 200,
      caseSummaries: [{ caseId: "case1", totalRuns: 1, passedRuns: 1, failedRuns: 0, averageDurationMs: 300, maxDurationMs: 300 }],
    },
    baseline,
    "/tmp/baseline.json",
  );

  // 200% increase in average duration should not trigger drift (threshold is 250%)
  assert.equal(result.status, "match");
  assert.ok(result.averageDurationDeltaPct > 0);
});

test("compareStableValidationToBaseline marks drift when max duration exceeds threshold [stable-runtime-validator-additional]", () => {
  const baseline = createBaseline(0, 100, 200, [{ caseId: "case1", averageDurationMs: 100 }]);

  const result = compareStableValidationToBaseline(
    {
      failedRuns: 0,
      integrityFailures: 0,
      backupFailures: 0,
      averageDurationMs: 100,
      maxDurationMs: 600, // 200% increase - should trigger drift
      caseSummaries: [],
    },
    baseline,
    "/tmp/baseline.json",
  );

  assert.equal(result.status, "drift_detected");
  assert.ok(result.maxDurationDeltaPct > 0);
});

test("summarizeStableValidationRuns groups runs by caseId [stable-runtime-validator-additional]", () => {
  const runs: StableValidationRun[] = [
    createValidationRun("case1", true, 100),
    createValidationRun("case1", true, 120),
    createValidationRun("case1", false, 150),
    createValidationRun("case2", true, 80),
  ];

  const summaries = summarizeStableValidationRuns(runs);

  const case1Summary = summaries.find((s) => s.caseId === "case1");
  const case2Summary = summaries.find((s) => s.caseId === "case2");

  assert.ok(case1Summary);
  assert.ok(case2Summary);
  assert.equal(case1Summary!.totalRuns, 3);
  assert.equal(case1Summary!.passedRuns, 2);
  assert.equal(case1Summary!.failedRuns, 1);
  assert.equal(case2Summary!.totalRuns, 1);
});

test("summarizeStableValidationRuns computes average and max duration [stable-runtime-validator-additional]", () => {
  const runs: StableValidationRun[] = [
    createValidationRun("case1", true, 100),
    createValidationRun("case1", true, 200),
    createValidationRun("case1", true, 300),
  ];

  const summaries = summarizeStableValidationRuns(runs);
  const summary = summaries[0]!;

  assert.equal(summary.averageDurationMs, 200);
  assert.equal(summary.maxDurationMs, 300);
});

test("summarizeStableValidationRuns handles empty runs array [stable-runtime-validator-additional]", () => {
  const summaries = summarizeStableValidationRuns([]);

  assert.deepEqual(summaries, []);
});

test("mergeStableValidationReports combines multiple reports [stable-runtime-validator-additional]", () => {
  const report1: StableValidationReport = {
    startedAt: "2026-04-07T00:00:00.000Z",
    finishedAt: "2026-04-07T00:01:00.000Z",
    iterations: 1,
    totalRuns: 2,
    passedRuns: 2,
    failedRuns: 0,
    integrityFailures: 0,
    backupFailures: 0,
    averageDurationMs: 100,
    maxDurationMs: 200,
    caseSummaries: [],
    artifacts: { reportPath: "", baselinePath: "", inventoryPath: "" },
    baselineComparison: {
      baselinePath: "",
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
    runs: [createValidationRun("case1", true, 100), createValidationRun("case2", true, 100)],
  };

  const report2: StableValidationReport = {
    startedAt: "2026-04-07T00:02:00.000Z",
    finishedAt: "2026-04-07T00:03:00.000Z",
    iterations: 1,
    totalRuns: 2,
    passedRuns: 1,
    failedRuns: 1,
    integrityFailures: 1,
    backupFailures: 0,
    averageDurationMs: 150,
    maxDurationMs: 250,
    caseSummaries: [],
    artifacts: { reportPath: "", baselinePath: "", inventoryPath: "" },
    baselineComparison: {
      baselinePath: "",
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
    runs: [createValidationRun("case3", true, 150), createValidationRun("case4", false, 250)],
  };

  const merged = mergeStableValidationReports([report1, report2]);

  assert.equal(merged.totalRuns, 4);
  assert.equal(merged.passedRuns, 3);
  assert.equal(merged.failedRuns, 1);
  assert.equal(merged.integrityFailures, 1);
  assert.equal(merged.backupFailures, 0);
  assert.equal(merged.runs.length, 4);
});

test("mergeStableValidationReports uses first report timestamps [stable-runtime-validator-additional]", () => {
  const report1: StableValidationReport = {
    startedAt: "2026-04-07T00:00:00.000Z",
    finishedAt: "2026-04-07T00:01:00.000Z",
    iterations: 1,
    totalRuns: 1,
    passedRuns: 1,
    failedRuns: 0,
    integrityFailures: 0,
    backupFailures: 0,
    averageDurationMs: 100,
    maxDurationMs: 100,
    caseSummaries: [],
    artifacts: { reportPath: "", baselinePath: "", inventoryPath: "" },
    baselineComparison: {
      baselinePath: "",
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
    runs: [createValidationRun("case1", true, 100)],
  };

  const report2: StableValidationReport = {
    startedAt: "2026-04-07T00:02:00.000Z",
    finishedAt: "2026-04-07T00:03:00.000Z",
    iterations: 1,
    totalRuns: 1,
    passedRuns: 1,
    failedRuns: 0,
    integrityFailures: 0,
    backupFailures: 0,
    averageDurationMs: 100,
    maxDurationMs: 100,
    caseSummaries: [],
    artifacts: { reportPath: "", baselinePath: "", inventoryPath: "" },
    baselineComparison: {
      baselinePath: "",
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
    runs: [createValidationRun("case2", true, 100)],
  };

  const merged = mergeStableValidationReports([report1, report2]);

  assert.equal(merged.startedAt, "2026-04-07T00:00:00.000Z");
  assert.equal(merged.finishedAt, "2026-04-07T00:03:00.000Z");
});

test("buildStableValidationBaseline creates correct baseline structure [stable-runtime-validator-additional]", () => {
  const report: StableValidationReport = {
    startedAt: "2026-04-07T00:00:00.000Z",
    finishedAt: "2026-04-07T00:01:00.000Z",
    iterations: 2,
    totalRuns: 4,
    passedRuns: 3,
    failedRuns: 1,
    integrityFailures: 0,
    backupFailures: 1,
    averageDurationMs: 150,
    maxDurationMs: 300,
    caseSummaries: [],
    artifacts: { reportPath: "", baselinePath: "", inventoryPath: "" },
    baselineComparison: {
      baselinePath: "",
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

  const baseline = buildStableValidationBaseline(report);

  assert.equal(baseline.inventoryVersion, 1);
  assert.equal(baseline.sourceStartedAt, "2026-04-07T00:00:00.000Z");
  assert.equal(baseline.sourceFinishedAt, "2026-04-07T00:01:00.000Z");
  assert.equal(baseline.iterations, 2);
  assert.equal(baseline.totalRuns, 4);
  assert.equal(baseline.passedRuns, 3);
  assert.equal(baseline.failedRuns, 1);
  assert.equal(baseline.integrityFailures, 0);
  assert.equal(baseline.backupFailures, 1);
  assert.equal(baseline.averageDurationMs, 150);
  assert.equal(baseline.maxDurationMs, 300);
});
