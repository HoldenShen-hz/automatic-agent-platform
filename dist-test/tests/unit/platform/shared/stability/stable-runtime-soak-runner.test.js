import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { mergeStableSoakReports, writeStableSoakReport, } from "../../../../../src/platform/shared/stability/stable-runtime-soak-runner.js";
function makeMockValidationReport(overrides = {}) {
    return {
        startedAt: "2026-04-09T00:00:00.000Z",
        finishedAt: "2026-04-09T00:00:01.000Z",
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
        runs: [],
        ...overrides,
    };
}
function makeMockSoakReport(overrides = {}) {
    const defaultReport = {
        startedAt: "2026-04-09T00:00:00.000Z",
        finishedAt: "2026-04-09T00:01:00.000Z",
        durationMs: 60_000,
        wallClockDurationMs: 60_000,
        intervalMs: 5_000,
        iterationsPerCycle: 2,
        cycles: [],
        totalRuns: 10,
        failedRuns: 0,
        passedRuns: 10,
        integrityFailures: 0,
        backupFailures: 0,
    };
    return { ...defaultReport, ...overrides };
}
test("mergeStableSoakReports aggregates cycles correctly", () => {
    const report1 = makeMockSoakReport({
        startedAt: "2026-04-09T00:00:00.000Z",
        finishedAt: "2026-04-09T00:01:00.000Z",
        cycles: [
            {
                cycle: 1,
                startedAt: "2026-04-09T00:00:00.000Z",
                finishedAt: "2026-04-09T00:00:30.000Z",
                report: makeMockValidationReport({ totalRuns: 5, failedRuns: 1 }),
            },
        ],
        totalRuns: 5,
        failedRuns: 1,
        passedRuns: 4,
        integrityFailures: 0,
        backupFailures: 0,
    });
    const report2 = makeMockSoakReport({
        startedAt: "2026-04-09T00:01:00.000Z",
        finishedAt: "2026-04-09T00:02:00.000Z",
        cycles: [
            {
                cycle: 1,
                startedAt: "2026-04-09T00:01:00.000Z",
                finishedAt: "2026-04-09T00:01:30.000Z",
                report: makeMockValidationReport({ totalRuns: 5, failedRuns: 0 }),
            },
        ],
        totalRuns: 5,
        failedRuns: 0,
        passedRuns: 5,
        integrityFailures: 1,
        backupFailures: 0,
    });
    const merged = mergeStableSoakReports([report1, report2]);
    assert.equal(merged.totalRuns, 10);
    assert.equal(merged.failedRuns, 1);
    assert.equal(merged.passedRuns, 9);
    assert.equal(merged.integrityFailures, 1);
    assert.equal(merged.backupFailures, 0);
    assert.equal(merged.cycles.length, 2);
    // Cycle numbers should be renumbered sequentially
    assert.equal(merged.cycles[0].cycle, 1);
    assert.equal(merged.cycles[1].cycle, 2);
});
test("mergeStableSoakReports uses first report's start time", () => {
    const report1 = makeMockSoakReport({ startedAt: "2026-04-09T00:00:00.000Z" });
    const report2 = makeMockSoakReport({ startedAt: "2026-04-09T01:00:00.000Z" });
    const merged = mergeStableSoakReports([report1, report2]);
    assert.equal(merged.startedAt, "2026-04-09T00:00:00.000Z");
});
test("mergeStableSoakReports uses last report's finish time", () => {
    const report1 = makeMockSoakReport({ finishedAt: "2026-04-09T00:00:00.000Z" });
    const report2 = makeMockSoakReport({ finishedAt: "2026-04-09T02:00:00.000Z" });
    const merged = mergeStableSoakReports([report1, report2]);
    assert.equal(merged.finishedAt, "2026-04-09T02:00:00.000Z");
});
test("mergeStableSoakReports sums durationMs and wallClockDurationMs", () => {
    const report1 = makeMockSoakReport({ durationMs: 60_000, wallClockDurationMs: 60_000 });
    const report2 = makeMockSoakReport({ durationMs: 120_000, wallClockDurationMs: 120_000 });
    const merged = mergeStableSoakReports([report1, report2]);
    assert.equal(merged.durationMs, 180_000);
    assert.equal(merged.wallClockDurationMs, 180_000);
});
test("mergeStableSoakReports uses first report's intervalMs and iterationsPerCycle", () => {
    const report1 = makeMockSoakReport({ intervalMs: 5_000, iterationsPerCycle: 2 });
    const report2 = makeMockSoakReport({ intervalMs: 10_000, iterationsPerCycle: 4 });
    const merged = mergeStableSoakReports([report1, report2]);
    assert.equal(merged.intervalMs, 5_000);
    assert.equal(merged.iterationsPerCycle, 2);
});
test("mergeStableSoakReports handles single report", () => {
    const report = makeMockSoakReport({
        cycles: [
            {
                cycle: 1,
                startedAt: "2026-04-09T00:00:00.000Z",
                finishedAt: "2026-04-09T00:00:30.000Z",
                report: makeMockValidationReport({ totalRuns: 3, failedRuns: 0 }),
            },
        ],
        totalRuns: 3,
        failedRuns: 0,
        passedRuns: 3,
    });
    const merged = mergeStableSoakReports([report]);
    assert.equal(merged.totalRuns, 3);
    assert.equal(merged.failedRuns, 0);
    assert.equal(merged.passedRuns, 3);
    assert.equal(merged.cycles.length, 1);
});
test("mergeStableSoakReports handles empty array", () => {
    const before = Date.now();
    const merged = mergeStableSoakReports([]);
    const after = Date.now();
    // startedAt and finishedAt should be within a reasonable window of "now"
    const startedAtTime = new Date(merged.startedAt).getTime();
    const finishedAtTime = new Date(merged.finishedAt).getTime();
    assert.ok(startedAtTime >= before - 1000 && startedAtTime <= after + 1000, "startedAt should be close to current time");
    assert.ok(finishedAtTime >= before - 1000 && finishedAtTime <= after + 1000, "finishedAt should be close to current time");
    assert.equal(merged.durationMs, 0);
    assert.equal(merged.wallClockDurationMs, 0);
    assert.equal(merged.totalRuns, 0);
    assert.equal(merged.cycles.length, 0);
});
test("mergeStableSoakReports renumbers cycles sequentially", () => {
    const report1 = makeMockSoakReport({
        cycles: [
            {
                cycle: 5,
                startedAt: "2026-04-09T00:00:00.000Z",
                finishedAt: "2026-04-09T00:00:30.000Z",
                report: makeMockValidationReport(),
            },
            {
                cycle: 6,
                startedAt: "2026-04-09T00:00:30.000Z",
                finishedAt: "2026-04-09T00:01:00.000Z",
                report: makeMockValidationReport(),
            },
        ],
    });
    const report2 = makeMockSoakReport({
        cycles: [
            {
                cycle: 3,
                startedAt: "2026-04-09T00:01:00.000Z",
                finishedAt: "2026-04-09T00:01:30.000Z",
                report: makeMockValidationReport(),
            },
        ],
    });
    const merged = mergeStableSoakReports([report1, report2]);
    assert.equal(merged.cycles[0].cycle, 1);
    assert.equal(merged.cycles[1].cycle, 2);
    assert.equal(merged.cycles[2].cycle, 3);
});
test("writeStableSoakReport creates file with formatted JSON", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "aa-soak-write-"));
    try {
        const report = makeMockSoakReport();
        const filePath = join(tmpDir, "soak-report.json");
        writeStableSoakReport(filePath, report);
        assert.equal(existsSync(filePath), true);
        const content = JSON.parse(readFileSync(filePath, "utf8"));
        assert.equal(content.durationMs, 60_000);
        assert.equal(content.totalRuns, 10);
        assert.equal(Array.isArray(content.cycles), true);
    }
    finally {
        rmSync(tmpDir, { recursive: true, force: true });
    }
});
test("writeStableSoakReport creates parent directories", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "aa-soak-write-"));
    try {
        const report = makeMockSoakReport();
        const filePath = join(tmpDir, "sub", "deep", "report.json");
        writeStableSoakReport(filePath, report);
        assert.equal(existsSync(filePath), true);
        const content = JSON.parse(readFileSync(filePath, "utf8"));
        assert.equal(content.intervalMs, 5_000);
    }
    finally {
        rmSync(tmpDir, { recursive: true, force: true });
    }
});
// Memory sampling tests
test("StableSoakCycle accepts memorySnapshot field", () => {
    const snapshot = {
        heapUsedBytes: 50_000_000,
        heapTotalBytes: 100_000_000,
        rssBytes: 120_000_000,
        takenAt: "2026-04-15T10:00:00.000Z",
    };
    const cycle = {
        cycle: 1,
        startedAt: "2026-04-15T10:00:00.000Z",
        finishedAt: "2026-04-15T10:00:01.000Z",
        report: makeMockValidationReport(),
        memorySnapshot: snapshot,
    };
    assert.equal(cycle.memorySnapshot.heapUsedBytes, 50_000_000);
    assert.equal(cycle.memorySnapshot.heapTotalBytes, 100_000_000);
    assert.equal(cycle.memorySnapshot.rssBytes, 120_000_000);
    assert.equal(cycle.memorySnapshot.takenAt, "2026-04-15T10:00:00.000Z");
});
test("mergeStableSoakReports propagates initialHeapUsedBytes from first report", () => {
    const report1 = makeMockSoakReport({ initialHeapUsedBytes: 40_000_000, peakHeapUsedBytes: 60_000_000, memoryGrowthRatio: 1.5 });
    const report2 = makeMockSoakReport({ initialHeapUsedBytes: 55_000_000, peakHeapUsedBytes: 70_000_000, memoryGrowthRatio: 1.27 });
    const merged = mergeStableSoakReports([report1, report2]);
    assert.equal(merged.initialHeapUsedBytes, 40_000_000, "Should use first report's initialHeapUsedBytes");
});
test("mergeStableSoakReports uses peak heapUsed across all reports", () => {
    const report1 = makeMockSoakReport({ initialHeapUsedBytes: 40_000_000, peakHeapUsedBytes: 60_000_000 });
    const report2 = makeMockSoakReport({ initialHeapUsedBytes: 55_000_000, peakHeapUsedBytes: 80_000_000 });
    const merged = mergeStableSoakReports([report1, report2]);
    assert.equal(merged.peakHeapUsedBytes, 80_000_000, "Should use the higher peak across all reports");
});
test("mergeStableSoakReports computes memoryGrowthRatio correctly", () => {
    const report1 = makeMockSoakReport({ initialHeapUsedBytes: 50_000_000, peakHeapUsedBytes: 80_000_000 });
    const report2 = makeMockSoakReport({ initialHeapUsedBytes: 60_000_000, peakHeapUsedBytes: 100_000_000 });
    const merged = mergeStableSoakReports([report1, report2]);
    // ratio = peakHeap / initialHeap = 100_000_000 / 50_000_000 = 2.0
    assert.ok(merged.memoryGrowthRatio != null, "Should compute memoryGrowthRatio");
    assert.equal(merged.memoryGrowthRatio, 2.0);
});
test("mergeStableSoakReports handles missing memory metrics gracefully", () => {
    const report1 = makeMockSoakReport(); // no memory fields
    const report2 = makeMockSoakReport(); // no memory fields
    const merged = mergeStableSoakReports([report1, report2]);
    assert.equal(merged.initialHeapUsedBytes, undefined);
    assert.equal(merged.memoryGrowthRatio, undefined);
});
test("StableSoakReport memory growth ratio below 2x threshold indicates healthy run", () => {
    const report = makeMockSoakReport({
        initialHeapUsedBytes: 50_000_000,
        peakHeapUsedBytes: 90_000_000,
        memoryGrowthRatio: 1.8,
    });
    assert.ok(report.memoryGrowthRatio < 2.0, `Memory growth ratio ${report.memoryGrowthRatio} should be below 2.0 threshold`);
});
test("writeStableSoakReport persists memory metrics", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "aa-soak-mem-"));
    try {
        const report = makeMockSoakReport({
            initialHeapUsedBytes: 50_000_000,
            peakHeapUsedBytes: 75_000_000,
            memoryGrowthRatio: 1.5,
            cycles: [
                {
                    cycle: 1,
                    startedAt: "2026-04-15T10:00:00.000Z",
                    finishedAt: "2026-04-15T10:00:01.000Z",
                    report: makeMockValidationReport(),
                    memorySnapshot: {
                        heapUsedBytes: 50_000_000,
                        heapTotalBytes: 100_000_000,
                        rssBytes: 120_000_000,
                        takenAt: "2026-04-15T10:00:00.000Z",
                    },
                },
            ],
        });
        const filePath = join(tmpDir, "mem-report.json");
        writeStableSoakReport(filePath, report);
        const content = JSON.parse(readFileSync(filePath, "utf8"));
        assert.equal(content.initialHeapUsedBytes, 50_000_000);
        assert.equal(content.peakHeapUsedBytes, 75_000_000);
        assert.equal(content.memoryGrowthRatio, 1.5);
        assert.equal(content.cycles[0].memorySnapshot.heapUsedBytes, 50_000_000);
    }
    finally {
        rmSync(tmpDir, { recursive: true, force: true });
    }
});
//# sourceMappingURL=stable-runtime-soak-runner.test.js.map