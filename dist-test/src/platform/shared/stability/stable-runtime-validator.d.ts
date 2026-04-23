/**
 * Stable Runtime Validator
 *
 * Runs golden task cases and checks database integrity and backup roundtrip
 * for each iteration. This is the core validation module used by both
 * standalone validation runs and by the soak runner for long-duration testing.
 *
 * Each validation run:
 * 1. Runs a golden task case using the single-task execution path
 * 2. Verifies the database passes integrity checks
 * 3. Creates a backup and verifies it is valid
 *
 * Results are compared against an existing baseline to detect regressions
 * in duration, failure rate, integrity, or backup reliability.
 *
 * @see stable-runtime-soak-runner.ts for long-running soak iteration built on this module
 * @see golden-task-runner.ts for golden task definitions
 * @see docs_zh/contracts/quality_engineering_and_chaos_testing_contract.md for chaos testing
 */
import { type GoldenTaskCase } from "./golden-task-runner.js";
/** Options for a validation run */
export interface StableValidationOptions {
    /** Output directory for reports and artifacts */
    outputDir: string;
    /** Number of iterations to run each golden task */
    iterations: number;
    /** Optional override for which golden task cases to run */
    cases?: readonly GoldenTaskCase[];
}
/** Result of a single golden task run */
export interface StableValidationRun {
    iteration: number;
    caseId: string;
    passed: boolean;
    durationMs: number;
    dbIntegrityPassed: boolean;
    backupPassed: boolean;
    backupPath: string;
}
/** Summary statistics for a single golden task case */
export interface StableValidationCaseSummary {
    caseId: string;
    totalRuns: number;
    passedRuns: number;
    failedRuns: number;
    averageDurationMs: number;
    maxDurationMs: number;
}
/** Stored baseline for comparison */
export interface StableValidationBaseline {
    createdAt: string;
    sourceStartedAt: string;
    sourceFinishedAt: string;
    iterations: number;
    totalRuns: number;
    passedRuns: number;
    failedRuns: number;
    integrityFailures: number;
    backupFailures: number;
    averageDurationMs: number;
    maxDurationMs: number;
    caseSummaries: StableValidationCaseSummary[];
}
/** Drift detected for a specific case */
export interface StableValidationCaseDrift {
    caseId: string;
    durationDeltaMs: number;
    durationDeltaPct: number;
    status: "match" | "drift_detected";
}
/** Result of comparing current report to baseline */
export interface StableValidationBaselineComparison {
    baselinePath: string;
    baselineCreated: boolean;
    status: "baseline_created" | "match" | "drift_detected";
    regressionDetected: boolean;
    failedRunsDelta: number;
    integrityFailuresDelta: number;
    backupFailuresDelta: number;
    averageDurationDeltaMs: number;
    averageDurationDeltaPct: number;
    maxDurationDeltaMs: number;
    maxDurationDeltaPct: number;
    caseDrifts: StableValidationCaseDrift[];
}
/** Complete validation report */
export interface StableValidationReport {
    startedAt: string;
    finishedAt: string;
    iterations: number;
    totalRuns: number;
    passedRuns: number;
    failedRuns: number;
    integrityFailures: number;
    backupFailures: number;
    averageDurationMs: number;
    maxDurationMs: number;
    caseSummaries: StableValidationCaseSummary[];
    artifacts: {
        reportPath: string;
        baselinePath: string;
        inventoryPath: string;
    };
    baselineComparison: StableValidationBaselineComparison;
    runs: StableValidationRun[];
}
/**
 * Summarizes multiple validation runs into per-case statistics.
 *
 * @param runs - All validation runs to summarize
 * @returns Summary per case including pass/fail counts and duration stats
 */
export declare function summarizeStableValidationRuns(runs: readonly StableValidationRun[]): StableValidationCaseSummary[];
/**
 * Builds a baseline record from a validation report.
 *
 * @param report - Validation report to convert to baseline
 * @returns Baseline record for future comparisons
 */
export declare function buildStableValidationBaseline(report: Pick<StableValidationReport, "startedAt" | "finishedAt" | "iterations" | "totalRuns" | "passedRuns" | "failedRuns" | "integrityFailures" | "backupFailures" | "averageDurationMs" | "maxDurationMs" | "caseSummaries">): StableValidationBaseline;
/**
 * Compares a validation report against an existing baseline.
 *
 * Detects regressions in:
 * - Failed run count
 * - Integrity failures
 * - Backup failures
 * - Duration (average and max)
 * - Per-case duration drift
 *
 * @param report - Current validation report
 * @param baseline - Existing baseline to compare against (null if no baseline)
 * @param baselinePath - Where to store the new baseline
 * @returns Comparison result with deltas and drift detection
 */
export declare function compareStableValidationToBaseline(report: Pick<StableValidationReport, "failedRuns" | "integrityFailures" | "backupFailures" | "averageDurationMs" | "maxDurationMs" | "caseSummaries">, baseline: StableValidationBaseline | null, baselinePath: string): StableValidationBaselineComparison;
/**
 * Merges multiple validation reports into a single combined report.
 *
 * Used when a soak run produces multiple cycle reports that need to be
 * aggregated into one validation report.
 *
 * @param reports - Array of validation reports to merge
 * @returns Merged validation report with combined statistics
 */
export declare function mergeStableValidationReports(reports: readonly StableValidationReport[]): StableValidationReport;
/**
 * Runs golden task validation with database integrity and backup checks.
 *
 * For each iteration and each golden task case:
 * 1. Creates a fresh database directory
 * 2. Runs the golden task using Phase 1A happy path
 * 3. Opens the database and runs integrity checks
 * 4. Creates a backup and verifies its validity
 *
 * Results are compared against any existing baseline to detect regressions.
 *
 * @param options - Validation options including output dir and iterations
 * @returns Complete validation report with all run results
 */
export declare function runStableValidation(options: StableValidationOptions): Promise<StableValidationReport>;
