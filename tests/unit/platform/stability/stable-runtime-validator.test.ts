import assert from "node:assert/strict";
import test from "node:test";

import {
  summarizeStableValidationRuns,
  buildStableValidationBaseline,
  compareStableValidationToBaseline,
  mergeStableValidationReports,
} from "../../../../src/platform/stability/stable-runtime-validator.js";

test("summarizeStableValidationRuns returns empty array for no runs", () => {
  const result = summarizeStableValidationRuns([]);

  assert.equal(result.length, 0);
});

test("summarizeStableValidationRuns summarizes single case runs", () => {
  const runs = [
    { iteration: 1, caseId: "case_1", passed: true, durationMs: 100, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/backup1" },
    { iteration: 2, caseId: "case_1", passed: true, durationMs: 120, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/backup2" },
    { iteration: 3, caseId: "case_1", passed: false, durationMs: 80, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/backup3" },
  ];

  const result = summarizeStableValidationRuns(runs);

  assert.equal(result.length, 1);
  assert.equal(result[0]!.caseId, "case_1");
  assert.equal(result[0]!.totalRuns, 3);
  assert.equal(result[0]!.passedRuns, 2);
  assert.equal(result[0]!.failedRuns, 1);
  assert.equal(result[0]!.averageDurationMs, 100);
  assert.equal(result[0]!.maxDurationMs, 120);
});

test("summarizeStableValidationRuns handles multiple cases", () => {
  const runs = [
    { iteration: 1, caseId: "case_a", passed: true, durationMs: 100, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/backup1" },
    { iteration: 1, caseId: "case_b", passed: true, durationMs: 200, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/backup2" },
    { iteration: 2, caseId: "case_a", passed: false, durationMs: 110, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/backup3" },
    { iteration: 2, caseId: "case_b", passed: true, durationMs: 180, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/backup4" },
  ];

  const result = summarizeStableValidationRuns(runs);

  assert.equal(result.length, 2);

  const caseA = result.find((r) => r.caseId === "case_a")!;
  assert.equal(caseA.totalRuns, 2);
  assert.equal(caseA.passedRuns, 1);
  assert.equal(caseA.failedRuns, 1);
  assert.equal(caseA.averageDurationMs, 105);
  assert.equal(caseA.maxDurationMs, 110);

  const caseB = result.find((r) => r.caseId === "case_b")!;
  assert.equal(caseB.totalRuns, 2);
  assert.equal(caseB.passedRuns, 2);
  assert.equal(caseB.failedRuns, 0);
  assert.equal(caseB.averageDurationMs, 190);
  assert.equal(caseB.maxDurationMs, 200);
});

test("summarizeStableValidationRuns handles all failed runs", () => {
  const runs = [
    { iteration: 1, caseId: "case_1", passed: false, durationMs: 100, dbIntegrityPassed: false, backupPassed: false, backupPath: "/tmp/backup1" },
    { iteration: 2, caseId: "case_1", passed: false, durationMs: 120, dbIntegrityPassed: false, backupPassed: false, backupPath: "/tmp/backup2" },
  ];

  const result = summarizeStableValidationRuns(runs);

  assert.equal(result[0]!.passedRuns, 0);
  assert.equal(result[0]!.failedRuns, 2);
});

test("summarizeStableValidationRuns handles zero duration runs", () => {
  const runs = [
    { iteration: 1, caseId: "case_1", passed: true, durationMs: 0, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/backup1" },
  ];

  const result = summarizeStableValidationRuns(runs);

  assert.equal(result[0]!.averageDurationMs, 0);
  assert.equal(result[0]!.maxDurationMs, 0);
});

test("buildStableValidationBaseline creates correct baseline", () => {
  const report = {
    startedAt: "2026-04-01T00:00:00.000Z",
    finishedAt: "2026-04-01T00:01:00.000Z",
    iterations: 2,
    totalRuns: 10,
    passedRuns: 9,
    failedRuns: 1,
    integrityFailures: 0,
    backupFailures: 1,
    averageDurationMs: 150.5,
    maxDurationMs: 300,
    caseSummaries: [
      { caseId: "case_1", totalRuns: 5, passedRuns: 5, failedRuns: 0, averageDurationMs: 100, maxDurationMs: 150 },
    ],
  };

  const result = buildStableValidationBaseline(report);

  assert.ok(result.createdAt.length > 0);
  assert.equal(result.sourceStartedAt, report.startedAt);
  assert.equal(result.sourceFinishedAt, report.finishedAt);
  assert.equal(result.iterations, 2);
  assert.equal(result.totalRuns, 10);
  assert.equal(result.passedRuns, 9);
  assert.equal(result.failedRuns, 1);
  assert.equal(result.integrityFailures, 0);
  assert.equal(result.backupFailures, 1);
  assert.equal(result.averageDurationMs, 150.5);
  assert.equal(result.maxDurationMs, 300);
  assert.equal(result.caseSummaries.length, 1);
});

test("compareStableValidationToBaseline creates baseline when none exists", () => {
  const report = {
    failedRuns: 1,
    integrityFailures: 0,
    backupFailures: 1,
    averageDurationMs: 150,
    maxDurationMs: 300,
    caseSummaries: [],
  };

  const result = compareStableValidationToBaseline(report, null, "/tmp/baseline.json");

  assert.equal(result.baselineCreated, true);
  assert.equal(result.status, "baseline_created");
  assert.equal(result.regressionDetected, false);
  assert.equal(result.failedRunsDelta, 0);
  assert.equal(result.integrityFailuresDelta, 0);
  assert.equal(result.backupFailuresDelta, 0);
});

test("compareStableValidationToBaseline detects regression in failed runs", () => {
  const report = {
    failedRuns: 3,
    integrityFailures: 0,
    backupFailures: 0,
    averageDurationMs: 150,
    maxDurationMs: 300,
    caseSummaries: [],
  };

  const baseline = {
    createdAt: "2026-04-01T00:00:00.000Z",
    sourceStartedAt: "2026-04-01T00:00:00.000Z",
    sourceFinishedAt: "2026-04-01T00:01:00.000Z",
    iterations: 1,
    totalRuns: 10,
    passedRuns: 9,
    failedRuns: 1,
    integrityFailures: 0,
    backupFailures: 0,
    averageDurationMs: 100,
    maxDurationMs: 200,
    caseSummaries: [],
  };

  const result = compareStableValidationToBaseline(report, baseline, "/tmp/baseline.json");

  assert.equal(result.baselineCreated, false);
  assert.equal(result.status, "drift_detected");
  assert.equal(result.regressionDetected, true);
  assert.equal(result.failedRunsDelta, 2);
});

test("compareStableValidationToBaseline detects regression in integrity failures", () => {
  const report = {
    failedRuns: 0,
    integrityFailures: 2,
    backupFailures: 0,
    averageDurationMs: 150,
    maxDurationMs: 300,
    caseSummaries: [],
  };

  const baseline = {
    createdAt: "2026-04-01T00:00:00.000Z",
    sourceStartedAt: "2026-04-01T00:00:00.000Z",
    sourceFinishedAt: "2026-04-01T00:01:00.000Z",
    iterations: 1,
    totalRuns: 10,
    passedRuns: 10,
    failedRuns: 0,
    integrityFailures: 0,
    backupFailures: 0,
    averageDurationMs: 100,
    maxDurationMs: 200,
    caseSummaries: [],
  };

  const result = compareStableValidationToBaseline(report, baseline, "/tmp/baseline.json");

  assert.equal(result.regressionDetected, true);
  assert.equal(result.integrityFailuresDelta, 2);
});

test("compareStableValidationToBaseline detects duration drift", () => {
  const report = {
    failedRuns: 0,
    integrityFailures: 0,
    backupFailures: 0,
    averageDurationMs: 500,
    maxDurationMs: 1000,
    caseSummaries: [],
  };

  const baseline = {
    createdAt: "2026-04-01T00:00:00.000Z",
    sourceStartedAt: "2026-04-01T00:00:00.000Z",
    sourceFinishedAt: "2026-04-01T00:01:00.000Z",
    iterations: 1,
    totalRuns: 10,
    passedRuns: 10,
    failedRuns: 0,
    integrityFailures: 0,
    backupFailures: 0,
    averageDurationMs: 100,
    maxDurationMs: 200,
    caseSummaries: [],
  };

  const result = compareStableValidationToBaseline(report, baseline, "/tmp/baseline.json");

  assert.equal(result.status, "drift_detected");
  assert.equal(result.averageDurationDeltaMs, 400);
  assert.equal(result.maxDurationDeltaMs, 800);
});

test("compareStableValidationToBaseline matches when within threshold", () => {
  const report = {
    failedRuns: 1,
    integrityFailures: 0,
    backupFailures: 0,
    averageDurationMs: 105,
    maxDurationMs: 210,
    caseSummaries: [],
  };

  const baseline = {
    createdAt: "2026-04-01T00:00:00.000Z",
    sourceStartedAt: "2026-04-01T00:00:00.000Z",
    sourceFinishedAt: "2026-04-01T00:01:00.000Z",
    iterations: 1,
    totalRuns: 10,
    passedRuns: 9,
    failedRuns: 1,
    integrityFailures: 0,
    backupFailures: 0,
    averageDurationMs: 100,
    maxDurationMs: 200,
    caseSummaries: [],
  };

  const result = compareStableValidationToBaseline(report, baseline, "/tmp/baseline.json");

  assert.equal(result.status, "match");
  assert.equal(result.regressionDetected, false);
});

test("compareStableValidationToBaseline detects per-case duration drift", () => {
  const report = {
    failedRuns: 0,
    integrityFailures: 0,
    backupFailures: 0,
    averageDurationMs: 150,
    maxDurationMs: 300,
    caseSummaries: [
      { caseId: "case_1", totalRuns: 1, passedRuns: 1, failedRuns: 0, averageDurationMs: 600, maxDurationMs: 600 },
    ],
  };

  const baseline = {
    createdAt: "2026-04-01T00:00:00.000Z",
    sourceStartedAt: "2026-04-01T00:00:00.000Z",
    sourceFinishedAt: "2026-04-01T00:01:00.000Z",
    iterations: 1,
    totalRuns: 1,
    passedRuns: 1,
    failedRuns: 0,
    integrityFailures: 0,
    backupFailures: 0,
    averageDurationMs: 100,
    maxDurationMs: 100,
    caseSummaries: [
      { caseId: "case_1", totalRuns: 1, passedRuns: 1, failedRuns: 0, averageDurationMs: 100, maxDurationMs: 100 },
    ],
  };

  const result = compareStableValidationToBaseline(report, baseline, "/tmp/baseline.json");

  assert.equal(result.status, "drift_detected");
  assert.ok(result.caseDrifts.length > 0);
  const case1Drift = result.caseDrifts.find((d) => d.caseId === "case_1");
  assert.ok(case1Drift);
  assert.equal(case1Drift!.status, "drift_detected");
});

test("mergeStableValidationReports combines multiple reports", () => {
  const reports = [
    {
      startedAt: "2026-04-01T00:00:00.000Z",
      finishedAt: "2026-04-01T00:05:00.000Z",
      iterations: 1,
      totalRuns: 2,
      passedRuns: 2,
      failedRuns: 0,
      integrityFailures: 0,
      backupFailures: 0,
      averageDurationMs: 100,
      maxDurationMs: 150,
      caseSummaries: [],
      artifacts: { reportPath: "", baselinePath: "", inventoryPath: "" },
      baselineComparison: null as never,
      runs: [
        { iteration: 1, caseId: "case_1", passed: true, durationMs: 80, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/backup1" },
        { iteration: 1, caseId: "case_2", passed: true, durationMs: 120, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/backup2" },
      ],
    },
    {
      startedAt: "2026-04-01T00:10:00.000Z",
      finishedAt: "2026-04-01T00:15:00.000Z",
      iterations: 1,
      totalRuns: 2,
      passedRuns: 1,
      failedRuns: 1,
      integrityFailures: 1,
      backupFailures: 0,
      averageDurationMs: 200,
      maxDurationMs: 300,
      caseSummaries: [],
      artifacts: { reportPath: "", baselinePath: "", inventoryPath: "" },
      baselineComparison: null as never,
      runs: [
        { iteration: 1, caseId: "case_1", passed: true, durationMs: 180, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/backup3" },
        { iteration: 1, caseId: "case_2", passed: false, durationMs: 220, dbIntegrityPassed: false, backupPassed: true, backupPath: "/tmp/backup4" },
      ],
    },
  ];

  const result = mergeStableValidationReports(reports);

  assert.equal(result.totalRuns, 4);
  assert.equal(result.passedRuns, 3);
  assert.equal(result.failedRuns, 1);
  assert.equal(result.integrityFailures, 1);
  assert.equal(result.backupFailures, 0);
  assert.equal(result.iterations, 2);
  assert.equal(result.runs.length, 4);
});

test("mergeStableValidationReports handles empty reports array", () => {
  const result = mergeStableValidationReports([]);

  assert.equal(result.totalRuns, 0);
  assert.equal(result.passedRuns, 0);
  assert.equal(result.failedRuns, 0);
  assert.equal(result.integrityFailures, 0);
  assert.equal(result.backupFailures, 0);
  assert.equal(result.runs.length, 0);
});

test("mergeStableValidationReports calculates correct duration stats", () => {
  const reports = [
    {
      startedAt: "2026-04-01T00:00:00.000Z",
      finishedAt: "2026-04-01T00:05:00.000Z",
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
      baselineComparison: null as never,
      runs: [{ iteration: 1, caseId: "case_1", passed: true, durationMs: 100, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/backup1" }],
    },
    {
      startedAt: "2026-04-01T00:10:00.000Z",
      finishedAt: "2026-04-01T00:15:00.000Z",
      iterations: 1,
      totalRuns: 1,
      passedRuns: 1,
      failedRuns: 0,
      integrityFailures: 0,
      backupFailures: 0,
      averageDurationMs: 200,
      maxDurationMs: 200,
      caseSummaries: [],
      artifacts: { reportPath: "", baselinePath: "", inventoryPath: "" },
      baselineComparison: null as never,
      runs: [{ iteration: 1, caseId: "case_2", passed: true, durationMs: 200, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/backup2" }],
    },
  ];

  const result = mergeStableValidationReports(reports);

  assert.equal(result.averageDurationMs, 150);
  assert.equal(result.maxDurationMs, 200);
});

test("mergeStableValidationReports uses first and last timestamps", () => {
  const reports = [
    {
      startedAt: "2026-04-01T00:00:00.000Z",
      finishedAt: "2026-04-01T00:05:00.000Z",
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
      baselineComparison: null as never,
      runs: [{ iteration: 1, caseId: "case_1", passed: true, durationMs: 100, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/backup1" }],
    },
    {
      startedAt: "2026-04-01T00:10:00.000Z",
      finishedAt: "2026-04-01T00:20:00.000Z",
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
      baselineComparison: null as never,
      runs: [{ iteration: 1, caseId: "case_2", passed: true, durationMs: 100, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/backup2" }],
    },
  ];

  const result = mergeStableValidationReports(reports);

  assert.equal(result.startedAt, "2026-04-01T00:00:00.000Z");
  assert.equal(result.finishedAt, "2026-04-01T00:20:00.000Z");
});

test("compareStableValidationToBaseline handles zero baseline duration", () => {
  const report = {
    failedRuns: 0,
    integrityFailures: 0,
    backupFailures: 0,
    averageDurationMs: 100,
    maxDurationMs: 200,
    caseSummaries: [],
  };

  const baseline = {
    createdAt: "2026-04-01T00:00:00.000Z",
    sourceStartedAt: "2026-04-01T00:00:00.000Z",
    sourceFinishedAt: "2026-04-01T00:01:00.000Z",
    iterations: 1,
    totalRuns: 10,
    passedRuns: 10,
    failedRuns: 0,
    integrityFailures: 0,
    backupFailures: 0,
    averageDurationMs: 0,
    maxDurationMs: 0,
    caseSummaries: [],
  };

  const result = compareStableValidationToBaseline(report, baseline, "/tmp/baseline.json");

  assert.equal(result.averageDurationDeltaPct, 100);
  assert.equal(result.maxDurationDeltaPct, 100);
});

test("compareStableValidationToBaseline handles both zero durations", () => {
  const report = {
    failedRuns: 0,
    integrityFailures: 0,
    backupFailures: 0,
    averageDurationMs: 0,
    maxDurationMs: 0,
    caseSummaries: [],
  };

  const baseline = {
    createdAt: "2026-04-01T00:00:00.000Z",
    sourceStartedAt: "2026-04-01T00:00:00.000Z",
    sourceFinishedAt: "2026-04-01T00:01:00.000Z",
    iterations: 1,
    totalRuns: 10,
    passedRuns: 10,
    failedRuns: 0,
    integrityFailures: 0,
    backupFailures: 0,
    averageDurationMs: 0,
    maxDurationMs: 0,
    caseSummaries: [],
  };

  const result = compareStableValidationToBaseline(report, baseline, "/tmp/baseline.json");

  assert.equal(result.averageDurationDeltaPct, 0);
  assert.equal(result.maxDurationDeltaPct, 0);
});
