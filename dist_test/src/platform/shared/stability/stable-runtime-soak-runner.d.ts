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
import { type StableValidationReport } from "./stable-runtime-validator.js";
/** Memory usage snapshot captured at a point in time */
export interface MemorySnapshot {
    /** Heap bytes used by live JS objects */
    heapUsedBytes: number;
    /** Total heap size in bytes */
    heapTotalBytes: number;
    /** Resident set size in bytes */
    rssBytes: number;
    /** ISO timestamp when the snapshot was taken */
    takenAt: string;
}
/** Options for the soak runner */
export interface StableSoakRunnerOptions {
    /** Output directory for cycle reports and final soak report */
    outputDir: string;
    /** Target duration to run soak testing in milliseconds */
    durationMs: number;
    /** Milliseconds to wait between cycles */
    intervalMs: number;
    /** Number of golden task iterations per cycle */
    iterationsPerCycle: number;
}
/** Result of a single soak cycle */
export interface StableSoakCycle {
    cycle: number;
    startedAt: string;
    finishedAt: string;
    report: StableValidationReport;
    /** Memory snapshot taken at the start of this cycle */
    memorySnapshot?: MemorySnapshot;
}
/** Complete soak test report */
export interface StableSoakReport {
    startedAt: string;
    finishedAt: string;
    /** Target duration that was requested */
    durationMs: number;
    /** Actual wall-clock duration that elapsed */
    wallClockDurationMs: number;
    intervalMs: number;
    iterationsPerCycle: number;
    cycles: StableSoakCycle[];
    totalRuns: number;
    failedRuns: number;
    passedRuns: number;
    integrityFailures: number;
    backupFailures: number;
    /** Heap used (bytes) at the start of the first cycle */
    initialHeapUsedBytes?: number;
    /** Peak heap used (bytes) across all cycles */
    peakHeapUsedBytes?: number;
    /** Ratio of peak heap to initial heap (should stay below 2.0 for healthy runs) */
    memoryGrowthRatio?: number;
}
/**
 * Merges multiple soak reports into a single combined report.
 *
 * Used when multiple soak runs need to be aggregated, such as when
 * resuming an interrupted soak or combining results from parallel runs.
 *
 * @param reports - Array of soak reports to merge
 * @returns Combined soak report with aggregated statistics
 */
export declare function mergeStableSoakReports(reports: readonly StableSoakReport[]): StableSoakReport;
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
export declare function runStableSoak(options: StableSoakRunnerOptions): Promise<StableSoakReport>;
/**
 * Writes a soak report to a JSON file.
 *
 * @param outputFile - Path to write the report
 * @param report - Soak report to persist
 */
export declare function writeStableSoakReport(outputFile: string, report: StableSoakReport): void;
