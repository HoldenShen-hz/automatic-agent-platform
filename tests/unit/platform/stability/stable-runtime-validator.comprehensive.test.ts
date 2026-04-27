import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  summarizeStableValidationRuns,
  buildStableValidationBaseline,
  compareStableValidationToBaseline,
  mergeStableValidationReports,
  runStableValidation,
  type StableValidationOptions,
  type StableValidationRun,
  type StableValidationReport,
} from "../../../../src/platform/stability/stable-runtime-validator.js";
import type { GoldenTaskCase } from "../../../../src/platform/stability/golden-task-runner.js";

describe("stable-runtime-validator comprehensive", () => {
  describe("summarizeStableValidationRuns", () => {
    test("returns empty array for empty input", () => {
      const result = summarizeStableValidationRuns([]);
      assert.equal(result.length, 0);
    });

    test("computes correct statistics for single case multiple runs", () => {
      const runs: StableValidationRun[] = [
        { iteration: 1, caseId: "case_a", passed: true, durationMs: 100, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/1" },
        { iteration: 2, caseId: "case_a", passed: true, durationMs: 200, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/2" },
        { iteration: 3, caseId: "case_a", passed: false, durationMs: 150, dbIntegrityPassed: false, backupPassed: true, backupPath: "/tmp/3" },
      ];

      const result = summarizeStableValidationRuns(runs);

      assert.equal(result.length, 1);
      assert.equal(result[0]!.caseId, "case_a");
      assert.equal(result[0]!.totalRuns, 3);
      assert.equal(result[0]!.passedRuns, 2);
      assert.equal(result[0]!.failedRuns, 1);
      assert.equal(result[0]!.averageDurationMs, 150);
      assert.equal(result[0]!.maxDurationMs, 200);
    });

    test("handles multiple cases correctly", () => {
      const runs: StableValidationRun[] = [
        { iteration: 1, caseId: "case_x", passed: true, durationMs: 50, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/1" },
        { iteration: 1, caseId: "case_y", passed: true, durationMs: 100, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/2" },
        { iteration: 2, caseId: "case_x", passed: false, durationMs: 75, dbIntegrityPassed: true, backupPassed: false, backupPath: "/tmp/3" },
        { iteration: 2, caseId: "case_y", passed: true, durationMs: 120, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/4" },
      ];

      const result = summarizeStableValidationRuns(runs);

      assert.equal(result.length, 2);
      const caseX = result.find((r) => r.caseId === "case_x")!;
      const caseY = result.find((r) => r.caseId === "case_y")!;

      assert.equal(caseX.totalRuns, 2);
      assert.equal(caseX.passedRuns, 1);
      assert.equal(caseX.failedRuns, 1);
      assert.equal(caseX.averageDurationMs, 62.5);
      assert.equal(caseX.maxDurationMs, 75);

      assert.equal(caseY.totalRuns, 2);
      assert.equal(caseY.passedRuns, 2);
      assert.equal(caseY.failedRuns, 0);
      assert.equal(caseY.averageDurationMs, 110);
      assert.equal(caseY.maxDurationMs, 120);
    });

    test("rounds averageDurationMs to 2 decimal places", () => {
      const runs: StableValidationRun[] = [
        { iteration: 1, caseId: "case_1", passed: true, durationMs: 33, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/1" },
        { iteration: 2, caseId: "case_1", passed: true, durationMs: 33, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/2" },
        { iteration: 3, caseId: "case_1", passed: true, durationMs: 34, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/3" },
      ];

      const result = summarizeStableValidationRuns(runs);

      assert.equal(result[0]!.averageDurationMs, 33.33);
    });

    test("handles zero duration runs", () => {
      const runs: StableValidationRun[] = [
        { iteration: 1, caseId: "case_1", passed: true, durationMs: 0, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/1" },
      ];

      const result = summarizeStableValidationRuns(runs);

      assert.equal(result[0]!.averageDurationMs, 0);
      assert.equal(result[0]!.maxDurationMs, 0);
    });

    test("handles all failed runs", () => {
      const runs: StableValidationRun[] = [
        { iteration: 1, caseId: "case_1", passed: false, durationMs: 100, dbIntegrityPassed: false, backupPassed: false, backupPath: "/tmp/1" },
        { iteration: 2, caseId: "case_1", passed: false, durationMs: 200, dbIntegrityPassed: false, backupPassed: false, backupPath: "/tmp/2" },
      ];

      const result = summarizeStableValidationRuns(runs);

      assert.equal(result[0]!.passedRuns, 0);
      assert.equal(result[0]!.failedRuns, 2);
      assert.equal(result[0]!.averageDurationMs, 150);
      assert.equal(result[0]!.maxDurationMs, 200);
    });
  });

  describe("buildStableValidationBaseline", () => {
    test("creates baseline with correct fields from report", () => {
      const report = {
        startedAt: "2026-04-01T00:00:00.000Z",
        finishedAt: "2026-04-01T00:01:00.000Z",
        iterations: 3,
        totalRuns: 15,
        passedRuns: 12,
        failedRuns: 3,
        integrityFailures: 1,
        backupFailures: 2,
        averageDurationMs: 123.45,
        maxDurationMs: 456.78,
        caseSummaries: [
          { caseId: "case_1", totalRuns: 5, passedRuns: 4, failedRuns: 1, averageDurationMs: 100, maxDurationMs: 200 },
          { caseId: "case_2", totalRuns: 10, passedRuns: 8, failedRuns: 2, averageDurationMs: 150, maxDurationMs: 300 },
        ],
      };

      const result = buildStableValidationBaseline(report);

      assert.ok(result.createdAt.length > 0);
      assert.equal(result.sourceStartedAt, report.startedAt);
      assert.equal(result.sourceFinishedAt, report.finishedAt);
      assert.equal(result.iterations, 3);
      assert.equal(result.totalRuns, 15);
      assert.equal(result.passedRuns, 12);
      assert.equal(result.failedRuns, 3);
      assert.equal(result.integrityFailures, 1);
      assert.equal(result.backupFailures, 2);
      assert.equal(result.averageDurationMs, 123.45);
      assert.equal(result.maxDurationMs, 456.78);
      assert.equal(result.caseSummaries.length, 2);
    });

    test("handles report with empty caseSummaries", () => {
      const report = {
        startedAt: "2026-04-01T00:00:00.000Z",
        finishedAt: "2026-04-01T00:01:00.000Z",
        iterations: 1,
        totalRuns: 0,
        passedRuns: 0,
        failedRuns: 0,
        integrityFailures: 0,
        backupFailures: 0,
        averageDurationMs: 0,
        maxDurationMs: 0,
        caseSummaries: [],
      };

      const result = buildStableValidationBaseline(report);

      assert.equal(result.totalRuns, 0);
      assert.equal(result.caseSummaries.length, 0);
    });
  });

  describe("compareStableValidationToBaseline", () => {
    test("creates baseline when none exists", () => {
      const report = {
        failedRuns: 5,
        integrityFailures: 2,
        backupFailures: 1,
        averageDurationMs: 200,
        maxDurationMs: 400,
        caseSummaries: [],
      };

      const result = compareStableValidationToBaseline(report, null, "/tmp/baseline.json");

      assert.equal(result.baselineCreated, true);
      assert.equal(result.status, "baseline_created");
      assert.equal(result.regressionDetected, false);
      assert.equal(result.failedRunsDelta, 0);
      assert.equal(result.integrityFailuresDelta, 0);
      assert.equal(result.backupFailuresDelta, 0);
      assert.equal(result.averageDurationDeltaMs, 0);
      assert.equal(result.maxDurationDeltaMs, 0);
    });

    test("detects regression when failed runs increase", () => {
      const report = {
        failedRuns: 5,
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
        passedRuns: 8,
        failedRuns: 2,
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
      assert.equal(result.failedRunsDelta, 3);
    });

    test("detects regression when integrity failures increase", () => {
      const report = {
        failedRuns: 0,
        integrityFailures: 3,
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
        integrityFailures: 1,
        backupFailures: 0,
        averageDurationMs: 100,
        maxDurationMs: 200,
        caseSummaries: [],
      };

      const result = compareStableValidationToBaseline(report, baseline, "/tmp/baseline.json");

      assert.equal(result.regressionDetected, true);
      assert.equal(result.integrityFailuresDelta, 2);
    });

    test("detects regression when backup failures increase", () => {
      const report = {
        failedRuns: 0,
        integrityFailures: 0,
        backupFailures: 2,
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
        averageDurationMs: 100,
        maxDurationMs: 200,
        caseSummaries: [],
      };

      const result = compareStableValidationToBaseline(report, baseline, "/tmp/baseline.json");

      assert.equal(result.regressionDetected, true);
      assert.equal(result.backupFailuresDelta, 2);
    });

    test("detects duration drift when average duration increases significantly", () => {
      const report = {
        failedRuns: 0,
        integrityFailures: 0,
        backupFailures: 0,
        averageDurationMs: 500,
        maxDurationMs: 800,
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
      assert.equal(result.maxDurationDeltaMs, 600);
      assert.ok(result.averageDurationDeltaPct > 250);
    });

    test("returns match when within drift threshold", () => {
      const report = {
        failedRuns: 1,
        integrityFailures: 0,
        backupFailures: 0,
        averageDurationMs: 102,
        maxDurationMs: 205,
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

    test("detects per-case duration drift", () => {
      const report = {
        failedRuns: 0,
        integrityFailures: 0,
        backupFailures: 0,
        averageDurationMs: 200,
        maxDurationMs: 400,
        caseSummaries: [
          { caseId: "case_1", totalRuns: 1, passedRuns: 1, failedRuns: 0, averageDurationMs: 800, maxDurationMs: 800 },
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
      const caseDrift = result.caseDrifts.find((d) => d.caseId === "case_1");
      assert.ok(caseDrift);
      assert.equal(caseDrift!.status, "drift_detected");
      assert.ok(caseDrift!.durationDeltaMs >= 20);
      assert.ok(caseDrift!.durationDeltaPct >= 250);
    });

    test("handles zero baseline duration correctly", () => {
      const report = {
        failedRuns: 0,
        integrityFailures: 0,
        backupFailures: 0,
        averageDurationMs: 50,
        maxDurationMs: 100,
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

    test("handles both zero durations returns zero delta", () => {
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
      assert.equal(result.status, "match");
    });
  });

  describe("mergeStableValidationReports", () => {
    test("combines multiple reports correctly", () => {
      const reports: StableValidationReport[] = [
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
          runs: [
            { iteration: 1, caseId: "case_1", passed: true, durationMs: 80, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/1" },
            { iteration: 1, caseId: "case_2", passed: true, durationMs: 120, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/2" },
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
          runs: [
            { iteration: 1, caseId: "case_1", passed: true, durationMs: 180, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/3" },
            { iteration: 1, caseId: "case_2", passed: false, durationMs: 220, dbIntegrityPassed: false, backupPassed: true, backupPath: "/tmp/4" },
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

    test("handles empty reports array", () => {
      const result = mergeStableValidationReports([]);

      assert.equal(result.totalRuns, 0);
      assert.equal(result.passedRuns, 0);
      assert.equal(result.failedRuns, 0);
      assert.equal(result.integrityFailures, 0);
      assert.equal(result.backupFailures, 0);
      assert.equal(result.runs.length, 0);
      assert.equal(result.averageDurationMs, 0);
    });

    test("calculates correct duration statistics across reports", () => {
      const reports: StableValidationReport[] = [
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
          runs: [{ iteration: 1, caseId: "case_1", passed: true, durationMs: 100, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/1" }],
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
          runs: [{ iteration: 1, caseId: "case_2", passed: true, durationMs: 200, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/2" }],
        },
      ];

      const result = mergeStableValidationReports(reports);

      assert.equal(result.averageDurationMs, 150);
      assert.equal(result.maxDurationMs, 200);
    });

    test("uses first and last timestamps correctly", () => {
      const reports: StableValidationReport[] = [
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
          runs: [{ iteration: 1, caseId: "case_1", passed: true, durationMs: 100, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/1" }],
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
          runs: [{ iteration: 1, caseId: "case_2", passed: true, durationMs: 100, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/2" }],
        },
      ];

      const result = mergeStableValidationReports(reports);

      assert.equal(result.startedAt, "2026-04-01T00:00:00.000Z");
      assert.equal(result.finishedAt, "2026-04-01T00:20:00.000Z");
    });

    test("merges case summaries correctly", () => {
      const reports: StableValidationReport[] = [
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
          caseSummaries: [
            { caseId: "case_1", totalRuns: 2, passedRuns: 2, failedRuns: 0, averageDurationMs: 100, maxDurationMs: 150 },
          ],
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
          runs: [
            { iteration: 1, caseId: "case_1", passed: true, durationMs: 50, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/1" },
            { iteration: 2, caseId: "case_1", passed: true, durationMs: 150, dbIntegrityPassed: true, backupPassed: true, backupPath: "/tmp/2" },
          ],
        },
      ];

      const result = mergeStableValidationReports(reports);

      assert.equal(result.caseSummaries.length, 1);
      assert.equal(result.caseSummaries[0]!.caseId, "case_1");
    });
  });

  describe("runStableValidation", () => {
    test("creates output directory if it does not exist", async () => {
      const outputDir = mkdtempSync(join(tmpdir(), "stable-validator-test-"));

      const customCase: GoldenTaskCase = {
        id: "test_case_minimal",
        title: "Test case",
        request: "Test request",
        metadata: {
          expectedClass: "coding",
          successCriteria: ["test"],
          costCeilingUsd: 0.01,
          latencyBand: "interactive",
          approvalExpectation: "not_expected",
          recoveryExpectation: "not_required",
        },
        expected: {
          taskStatus: "done",
          workflowStatus: "completed",
          executionStatus: "succeeded",
          sessionStatus: "completed",
          eventTypes: [],
          stepOutputs: 0,
        },
      };

      const result = await runStableValidation({
        outputDir,
        iterations: 1,
        cases: [customCase],
      });

      assert.ok(existsSync(outputDir));
      assert.ok(result.artifacts.reportPath.length > 0);
      assert.ok(result.artifacts.baselinePath.length > 0);

      rmSync(outputDir, { recursive: true, force: true });
    });

    test("returns report with correct structure", async () => {
      const outputDir = mkdtempSync(join(tmpdir(), "stable-validator-test-"));

      const customCase: GoldenTaskCase = {
        id: "test_case_basic",
        title: "Test case basic",
        request: "Test request basic",
        metadata: {
          expectedClass: "coding",
          successCriteria: ["test"],
          costCeilingUsd: 0.01,
          latencyBand: "interactive",
          approvalExpectation: "not_expected",
          recoveryExpectation: "not_required",
        },
        expected: {
          taskStatus: "done",
          workflowStatus: "completed",
          executionStatus: "succeeded",
          sessionStatus: "completed",
          eventTypes: [],
          stepOutputs: 0,
        },
      };

      const result = await runStableValidation({
        outputDir,
        iterations: 1,
        cases: [customCase],
      });

      assert.ok(result.startedAt.length > 0);
      assert.ok(result.finishedAt.length > 0);
      assert.equal(result.iterations, 1);
      assert.ok(result.totalRuns >= 0);
      assert.ok(Array.isArray(result.runs));
      assert.ok(Array.isArray(result.caseSummaries));
      assert.ok(Array.isArray(result.baselineComparison.caseDrifts));

      rmSync(outputDir, { recursive: true, force: true });
    });

    test("uses default golden tasks when cases not specified", async () => {
      const outputDir = mkdtempSync(join(tmpdir(), "stable-validator-test-"));

      const result = await runStableValidation({
        outputDir,
        iterations: 1,
      });

      // Should have runs for each default golden task
      assert.ok(result.totalRuns > 0);
      assert.ok(result.caseSummaries.length > 0);

      rmSync(outputDir, { recursive: true, force: true });
    });

    test("writes report JSON to output directory", async () => {
      const outputDir = mkdtempSync(join(tmpdir(), "stable-validator-test-"));

      const customCase: GoldenTaskCase = {
        id: "test_case_write",
        title: "Test case write",
        request: "Test request write",
        metadata: {
          expectedClass: "coding",
          successCriteria: ["test"],
          costCeilingUsd: 0.01,
          latencyBand: "interactive",
          approvalExpectation: "not_expected",
          recoveryExpectation: "not_required",
        },
        expected: {
          taskStatus: "done",
          workflowStatus: "completed",
          executionStatus: "succeeded",
          sessionStatus: "completed",
          eventTypes: [],
          stepOutputs: 0,
        },
      };

      await runStableValidation({
        outputDir,
        iterations: 1,
        cases: [customCase],
      });

      const reportPath = join(outputDir, "stable-validation-report.json");
      assert.ok(existsSync(reportPath));

      const baselinePath = join(outputDir, "stable-validation-baseline.json");
      assert.ok(existsSync(baselinePath));

      const inventoryPath = join(outputDir, "golden-task-inventory.json");
      assert.ok(existsSync(inventoryPath));

      rmSync(outputDir, { recursive: true, force: true });
    });

    test("stores baseline on first run", async () => {
      const outputDir = mkdtempSync(join(tmpdir(), "stable-validator-test-"));

      const customCase: GoldenTaskCase = {
        id: "test_case_baseline",
        title: "Test case baseline",
        request: "Test request baseline",
        metadata: {
          expectedClass: "coding",
          successCriteria: ["test"],
          costCeilingUsd: 0.01,
          latencyBand: "interactive",
          approvalExpectation: "not_expected",
          recoveryExpectation: "not_required",
        },
        expected: {
          taskStatus: "done",
          workflowStatus: "completed",
          executionStatus: "succeeded",
          sessionStatus: "completed",
          eventTypes: [],
          stepOutputs: 0,
        },
      };

      const firstResult = await runStableValidation({
        outputDir,
        iterations: 1,
        cases: [customCase],
      });

      assert.equal(firstResult.baselineComparison.baselineCreated, true);

      rmSync(outputDir, { recursive: true, force: true });
    });

    test("compares to existing baseline on subsequent runs", async () => {
      const outputDir = mkdtempSync(join(tmpdir(), "stable-validator-test-"));

      const customCase: GoldenTaskCase = {
        id: "test_case_subsequent",
        title: "Test case subsequent",
        request: "Test request subsequent",
        metadata: {
          expectedClass: "coding",
          successCriteria: ["test"],
          costCeilingUsd: 0.01,
          latencyBand: "interactive",
          approvalExpectation: "not_expected",
          recoveryExpectation: "not_required",
        },
        expected: {
          taskStatus: "done",
          workflowStatus: "completed",
          executionStatus: "succeeded",
          sessionStatus: "completed",
          eventTypes: [],
          stepOutputs: 0,
        },
      };

      await runStableValidation({
        outputDir,
        iterations: 1,
        cases: [customCase],
      });

      const secondResult = await runStableValidation({
        outputDir,
        iterations: 1,
        cases: [customCase],
      });

      assert.equal(secondResult.baselineComparison.baselineCreated, false);

      rmSync(outputDir, { recursive: true, force: true });
    });
  });

  describe("StableValidationOptions interface", () => {
    test("accepts valid options structure", () => {
      const options: StableValidationOptions = {
        outputDir: "/tmp/test",
        iterations: 5,
      };

      assert.equal(options.outputDir, "/tmp/test");
      assert.equal(options.iterations, 5);
    });

    test("accepts options with custom cases", () => {
      const customCase: GoldenTaskCase = {
        id: "custom_case",
        title: "Custom case",
        request: "Custom request",
        metadata: {
          expectedClass: "coding",
          successCriteria: ["test"],
          costCeilingUsd: 0.01,
          latencyBand: "interactive",
          approvalExpectation: "not_expected",
          recoveryExpectation: "not_required",
        },
        expected: {
          taskStatus: "done",
          workflowStatus: "completed",
          executionStatus: "succeeded",
          sessionStatus: "completed",
          eventTypes: [],
          stepOutputs: 0,
        },
      };

      const options: StableValidationOptions = {
        outputDir: "/tmp/test",
        iterations: 3,
        cases: [customCase],
      };

      assert.equal(options.cases!.length, 1);
      assert.equal(options.cases![0].id, "custom_case");
    });
  });
});
