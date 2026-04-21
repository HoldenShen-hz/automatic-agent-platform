import assert from "node:assert/strict";
import test from "node:test";
import { compareStableValidationToBaseline, summarizeStableValidationRuns, } from "../../../../../src/platform/shared/stability/stable-runtime-validator.js";
test("stable validation summarization aggregates runs by case", () => {
    const summaries = summarizeStableValidationRuns([
        {
            iteration: 1,
            caseId: "case-a",
            passed: true,
            durationMs: 10,
            dbIntegrityPassed: true,
            backupPassed: true,
            backupPath: "/tmp/case-a-1.db",
        },
        {
            iteration: 2,
            caseId: "case-a",
            passed: false,
            durationMs: 20,
            dbIntegrityPassed: true,
            backupPassed: true,
            backupPath: "/tmp/case-a-2.db",
        },
        {
            iteration: 1,
            caseId: "case-b",
            passed: true,
            durationMs: 7,
            dbIntegrityPassed: true,
            backupPassed: true,
            backupPath: "/tmp/case-b-1.db",
        },
    ]);
    assert.deepEqual(summaries, [
        {
            caseId: "case-a",
            totalRuns: 2,
            passedRuns: 1,
            failedRuns: 1,
            averageDurationMs: 15,
            maxDurationMs: 20,
        },
        {
            caseId: "case-b",
            totalRuns: 1,
            passedRuns: 1,
            failedRuns: 0,
            averageDurationMs: 7,
            maxDurationMs: 7,
        },
    ]);
});
test("stable validation baseline comparison marks the first run as baseline creation", () => {
    const comparison = compareStableValidationToBaseline({
        failedRuns: 0,
        integrityFailures: 0,
        backupFailures: 0,
        averageDurationMs: 11,
        maxDurationMs: 14,
        caseSummaries: [
            {
                caseId: "case-a",
                totalRuns: 1,
                passedRuns: 1,
                failedRuns: 0,
                averageDurationMs: 11,
                maxDurationMs: 14,
            },
        ],
    }, null, "/tmp/stable-validation-baseline.json");
    assert.deepEqual(comparison, {
        baselinePath: "/tmp/stable-validation-baseline.json",
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
    });
});
test("stable validation baseline comparison flags correctness regressions and timing drift", () => {
    const baseline = {
        createdAt: "2026-04-06T00:00:00.000Z",
        sourceStartedAt: "2026-04-06T00:00:00.000Z",
        sourceFinishedAt: "2026-04-06T00:00:10.000Z",
        iterations: 1,
        totalRuns: 2,
        passedRuns: 2,
        failedRuns: 0,
        integrityFailures: 0,
        backupFailures: 0,
        averageDurationMs: 10,
        maxDurationMs: 12,
        caseSummaries: [
            {
                caseId: "case-a",
                totalRuns: 1,
                passedRuns: 1,
                failedRuns: 0,
                averageDurationMs: 5,
                maxDurationMs: 5,
            },
            {
                caseId: "case-b",
                totalRuns: 1,
                passedRuns: 1,
                failedRuns: 0,
                averageDurationMs: 15,
                maxDurationMs: 15,
            },
        ],
    };
    const comparison = compareStableValidationToBaseline({
        failedRuns: 1,
        integrityFailures: 1,
        backupFailures: 0,
        averageDurationMs: 40,
        maxDurationMs: 50,
        caseSummaries: [
            {
                caseId: "case-a",
                totalRuns: 1,
                passedRuns: 0,
                failedRuns: 1,
                averageDurationMs: 30,
                maxDurationMs: 30,
            },
            {
                caseId: "case-b",
                totalRuns: 1,
                passedRuns: 1,
                failedRuns: 0,
                averageDurationMs: 10,
                maxDurationMs: 10,
            },
        ],
    }, baseline, "/tmp/stable-validation-baseline.json");
    assert.equal(comparison.baselineCreated, false);
    assert.equal(comparison.status, "drift_detected");
    assert.equal(comparison.regressionDetected, true);
    assert.equal(comparison.failedRunsDelta, 1);
    assert.equal(comparison.integrityFailuresDelta, 1);
    assert.equal(comparison.backupFailuresDelta, 0);
    assert.equal(comparison.averageDurationDeltaMs, 30);
    assert.equal(comparison.averageDurationDeltaPct, 300);
    assert.equal(comparison.maxDurationDeltaMs, 38);
    assert.equal(comparison.maxDurationDeltaPct, 316.67);
    assert.deepEqual(comparison.caseDrifts, [
        {
            caseId: "case-a",
            durationDeltaMs: 25,
            durationDeltaPct: 500,
            status: "drift_detected",
        },
        {
            caseId: "case-b",
            durationDeltaMs: -5,
            durationDeltaPct: -33.33,
            status: "match",
        },
    ]);
});
//# sourceMappingURL=stable-runtime-validator.test.js.map