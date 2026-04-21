/**
 * Stable Runtime Soak Runner
 *
 * Long-duration validation loop built on stable-runtime-validator. Runs continuous
 * validation cycles for a specified duration, executing golden task cases repeatedly
 * and checking database integrity and backup roundtrip throughout.
 *
 * The soak runner is designed for overnight or multi-day stability testing,
 * running validation cycles continuously until the target duration is reached.
 * Each cycle runs the full golden task validation suite.
 *
 * @see stable-runtime-validator.ts for the per-cycle validation logic
 * @see docs_zh/contracts/quality_engineering_and_chaos_testing_contract.md for testing
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { memoryUsage } from "node:process";
import { runStableValidation, } from "./stable-runtime-validator.js";
/**
 * Merges multiple soak reports into a single combined report.
 *
 * Used when multiple soak runs need to be aggregated, such as when
 * resuming an interrupted soak or combining results from parallel runs.
 *
 * @param reports - Array of soak reports to merge
 * @returns Combined soak report with aggregated statistics
 */
export function mergeStableSoakReports(reports) {
    const cycles = reports.flatMap((report) => report.cycles);
    // Carry forward the first report's initialHeapUsedBytes and compute peak across all
    const initialHeapUsedBytes = reports[0]?.initialHeapUsedBytes;
    const peakHeapUsedBytes = reports.reduce((peak, r) => {
        return r.peakHeapUsedBytes != null && r.peakHeapUsedBytes > peak ? r.peakHeapUsedBytes : peak;
    }, 0) || undefined;
    const memoryGrowthRatio = initialHeapUsedBytes != null && initialHeapUsedBytes > 0 && peakHeapUsedBytes != null
        ? peakHeapUsedBytes / initialHeapUsedBytes
        : undefined;
    return {
        startedAt: reports[0]?.startedAt ?? new Date().toISOString(),
        finishedAt: reports.at(-1)?.finishedAt ?? new Date().toISOString(),
        durationMs: reports.reduce((sum, report) => sum + report.durationMs, 0),
        wallClockDurationMs: reports.reduce((sum, report) => sum + report.wallClockDurationMs, 0),
        intervalMs: reports[0]?.intervalMs ?? 0,
        iterationsPerCycle: reports[0]?.iterationsPerCycle ?? 0,
        cycles: cycles.map((cycle, index) => ({
            ...cycle,
            cycle: index + 1,
        })),
        totalRuns: reports.reduce((sum, report) => sum + report.totalRuns, 0),
        failedRuns: reports.reduce((sum, report) => sum + report.failedRuns, 0),
        passedRuns: reports.reduce((sum, report) => sum + report.passedRuns, 0),
        integrityFailures: reports.reduce((sum, report) => sum + report.integrityFailures, 0),
        backupFailures: reports.reduce((sum, report) => sum + report.backupFailures, 0),
        ...(initialHeapUsedBytes != null ? { initialHeapUsedBytes } : {}),
        ...(peakHeapUsedBytes != null && peakHeapUsedBytes > 0 ? { peakHeapUsedBytes } : {}),
        ...(memoryGrowthRatio != null ? { memoryGrowthRatio } : {}),
    };
}
/**
 * Runs a long-duration soak test by executing validation cycles
 * until the target duration is reached.
 *
 * Each cycle runs the full golden task validation suite and waits
 * for the specified interval before starting the next cycle. The
 * wall-clock duration is tracked to ensure the target soak duration
 * is met even if individual cycles take variable time.
 *
 * @param options - Soak runner configuration
 * @returns Complete soak report with all cycle results
 */
export async function runStableSoak(options) {
    mkdirSync(options.outputDir, { recursive: true });
    const startedAtMs = Date.now();
    const startedAt = new Date().toISOString();
    const deadline = Date.now() + options.durationMs;
    const cycles = [];
    let initialHeapUsedBytes;
    let peakHeapUsedBytes = 0;
    let cycle = 0;
    do {
        cycle += 1;
        const cycleStartedAt = new Date().toISOString();
        // Capture memory snapshot before running this cycle
        const mem = memoryUsage();
        const memorySnapshot = {
            heapUsedBytes: mem.heapUsed,
            heapTotalBytes: mem.heapTotal,
            rssBytes: mem.rss,
            takenAt: cycleStartedAt,
        };
        if (cycle === 1) {
            initialHeapUsedBytes = mem.heapUsed;
        }
        if (mem.heapUsed > peakHeapUsedBytes) {
            peakHeapUsedBytes = mem.heapUsed;
        }
        // Run validation for this cycle
        const report = await runStableValidation({
            outputDir: join(options.outputDir, `cycle-${cycle}`),
            iterations: options.iterationsPerCycle,
        });
        const cycleFinishedAt = new Date().toISOString();
        cycles.push({
            cycle,
            startedAt: cycleStartedAt,
            finishedAt: cycleFinishedAt,
            report,
            memorySnapshot,
        });
        // Check if we've reached the target duration
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) {
            break;
        }
        // Wait before starting next cycle, but don't wait beyond the deadline
        await sleep(Math.min(options.intervalMs, remainingMs));
    } while (Date.now() < deadline);
    // Aggregate statistics across all cycles
    const totalRuns = cycles.reduce((sum, item) => sum + item.report.totalRuns, 0);
    const failedRuns = cycles.reduce((sum, item) => sum + item.report.failedRuns, 0);
    const passedRuns = totalRuns - failedRuns;
    const integrityFailures = cycles.reduce((sum, item) => sum + item.report.integrityFailures, 0);
    const backupFailures = cycles.reduce((sum, item) => sum + item.report.backupFailures, 0);
    const memoryGrowthRatio = initialHeapUsedBytes != null && initialHeapUsedBytes > 0
        ? peakHeapUsedBytes / initialHeapUsedBytes
        : undefined;
    return {
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: options.durationMs,
        wallClockDurationMs: Date.now() - startedAtMs,
        intervalMs: options.intervalMs,
        iterationsPerCycle: options.iterationsPerCycle,
        cycles,
        totalRuns,
        failedRuns,
        passedRuns,
        integrityFailures,
        backupFailures,
        ...(initialHeapUsedBytes != null ? { initialHeapUsedBytes } : {}),
        ...(peakHeapUsedBytes > 0 ? { peakHeapUsedBytes } : {}),
        ...(memoryGrowthRatio != null ? { memoryGrowthRatio } : {}),
    };
}
/**
 * Writes a soak report to a JSON file.
 *
 * @param outputFile - Path to write the report
 * @param report - Soak report to persist
 */
export function writeStableSoakReport(outputFile, report) {
    mkdirSync(dirname(outputFile), { recursive: true });
    writeFileSync(outputFile, JSON.stringify(report, null, 2));
}
//# sourceMappingURL=stable-runtime-soak-runner.js.map