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

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  SINGLE_TASK_GOLDEN_TASKS,
  runGoldenTaskCase,
  writeGoldenTaskInventoryBaseline,
  type GoldenTaskCase,
} from "./golden-task-runner.js";
import { SqliteReliabilityService } from "../../state-evidence/truth/sqlite/sqlite-reliability-service.js";
import { SqliteDatabase } from "../../state-evidence/truth/sqlite-database.js";

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

/** File names for validation artifacts */
const STABLE_VALIDATION_REPORT_FILE = "stable-validation-report.json";
const STABLE_VALIDATION_BASELINE_FILE = "stable-validation-baseline.json";
const STABLE_VALIDATION_INVENTORY_FILE = "golden-task-inventory.json";

/** Duration drift threshold: 250% increase */
const DURATION_DRIFT_THRESHOLD_PCT = 250;
/** Minimum duration delta in ms to trigger drift detection */
const DURATION_DRIFT_MIN_DELTA_MS = 20;

/** Rounds a metric to 2 decimal places */
function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Writes a value as formatted JSON to a file */
function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2));
}

/** Safely reads and parses a JSON file, returning null if not found */
function safeReadJson<T>(path: string): T | null {
  if (!existsSync(path)) {
    return null;
  }
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

/**
 * Summarizes multiple validation runs into per-case statistics.
 *
 * @param runs - All validation runs to summarize
 * @returns Summary per case including pass/fail counts and duration stats
 */
export function summarizeStableValidationRuns(runs: readonly StableValidationRun[]): StableValidationCaseSummary[] {
  const caseIds = [...new Set(runs.map((run) => run.caseId))];
  return caseIds.map((caseId) => {
    const caseRuns = runs.filter((run) => run.caseId === caseId);
    const totalRuns = caseRuns.length;
    const totalDurationMs = caseRuns.reduce((sum, run) => sum + run.durationMs, 0);
    return {
      caseId,
      totalRuns,
      passedRuns: caseRuns.filter((run) => run.passed).length,
      failedRuns: caseRuns.filter((run) => !run.passed).length,
      averageDurationMs: totalRuns === 0 ? 0 : roundMetric(totalDurationMs / totalRuns),
      maxDurationMs: caseRuns.reduce((max, run) => Math.max(max, run.durationMs), 0),
    };
  });
}

/**
 * Builds a baseline record from a validation report.
 *
 * @param report - Validation report to convert to baseline
 * @returns Baseline record for future comparisons
 */
export function buildStableValidationBaseline(report: Pick<
  StableValidationReport,
  | "startedAt"
  | "finishedAt"
  | "iterations"
  | "totalRuns"
  | "passedRuns"
  | "failedRuns"
  | "integrityFailures"
  | "backupFailures"
  | "averageDurationMs"
  | "maxDurationMs"
  | "caseSummaries"
>): StableValidationBaseline {
  return {
    createdAt: new Date().toISOString(),
    sourceStartedAt: report.startedAt,
    sourceFinishedAt: report.finishedAt,
    iterations: report.iterations,
    totalRuns: report.totalRuns,
    passedRuns: report.passedRuns,
    failedRuns: report.failedRuns,
    integrityFailures: report.integrityFailures,
    backupFailures: report.backupFailures,
    averageDurationMs: report.averageDurationMs,
    maxDurationMs: report.maxDurationMs,
    caseSummaries: report.caseSummaries,
  };
}

/** Calculates percentage delta between current and baseline values */
function calculateDeltaPct(current: number, baseline: number): number {
  if (baseline <= 0) {
    return current <= 0 ? 0 : 100;
  }
  return roundMetric(((current - baseline) / baseline) * 100);
}

/** Determines if a duration drift is significant enough to report */
function resolveDriftStatus(deltaMs: number, deltaPct: number): "match" | "drift_detected" {
  return deltaMs >= DURATION_DRIFT_MIN_DELTA_MS && deltaPct >= DURATION_DRIFT_THRESHOLD_PCT ? "drift_detected" : "match";
}

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
export function compareStableValidationToBaseline(
  report: Pick<
    StableValidationReport,
    | "failedRuns"
    | "integrityFailures"
    | "backupFailures"
    | "averageDurationMs"
    | "maxDurationMs"
    | "caseSummaries"
  >,
  baseline: StableValidationBaseline | null,
  baselinePath: string,
): StableValidationBaselineComparison {
  // No baseline exists - this run becomes the baseline
  if (baseline == null) {
    return {
      baselinePath,
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
    };
  }

  // Calculate deltas from baseline
  const failedRunsDelta = report.failedRuns - baseline.failedRuns;
  const integrityFailuresDelta = report.integrityFailures - baseline.integrityFailures;
  const backupFailuresDelta = report.backupFailures - baseline.backupFailures;
  const averageDurationDeltaMs = roundMetric(report.averageDurationMs - baseline.averageDurationMs);
  const maxDurationDeltaMs = roundMetric(report.maxDurationMs - baseline.maxDurationMs);
  const averageDurationDeltaPct = calculateDeltaPct(report.averageDurationMs, baseline.averageDurationMs);
  const maxDurationDeltaPct = calculateDeltaPct(report.maxDurationMs, baseline.maxDurationMs);

  // Check per-case duration drift
  const caseDrifts = report.caseSummaries.map((summary) => {
    const baselineCase = baseline.caseSummaries.find((entry) => entry.caseId === summary.caseId);
    const durationDeltaMs = roundMetric(summary.averageDurationMs - (baselineCase?.averageDurationMs ?? 0));
    const durationDeltaPct = calculateDeltaPct(summary.averageDurationMs, baselineCase?.averageDurationMs ?? 0);
    return {
      caseId: summary.caseId,
      durationDeltaMs,
      durationDeltaPct,
      status: resolveDriftStatus(durationDeltaMs, durationDeltaPct),
    };
  });

  // Regression is detected if any failure/integrity/backup count increased
  const regressionDetected = failedRunsDelta > 0 || integrityFailuresDelta > 0 || backupFailuresDelta > 0;

  // Overall status is drift_detected if any drift threshold is crossed
  const status: StableValidationBaselineComparison["status"] =
    regressionDetected
    || resolveDriftStatus(averageDurationDeltaMs, averageDurationDeltaPct) === "drift_detected"
    || resolveDriftStatus(maxDurationDeltaMs, maxDurationDeltaPct) === "drift_detected"
    || caseDrifts.some((entry) => entry.status === "drift_detected")
      ? "drift_detected"
      : "match";

  return {
    baselinePath,
    baselineCreated: false,
    status,
    regressionDetected,
    failedRunsDelta,
    integrityFailuresDelta,
    backupFailuresDelta,
    averageDurationDeltaMs,
    averageDurationDeltaPct,
    maxDurationDeltaMs,
    maxDurationDeltaPct,
    caseDrifts,
  };
}

/**
 * Merges multiple validation reports into a single combined report.
 *
 * Used when a soak run produces multiple cycle reports that need to be
 * aggregated into one validation report.
 *
 * @param reports - Array of validation reports to merge
 * @returns Merged validation report with combined statistics
 */
export function mergeStableValidationReports(reports: readonly StableValidationReport[]): StableValidationReport {
  const runs = reports.flatMap((report) => report.runs);
  const totalRuns = runs.length;
  const passedRuns = runs.filter((run) => run.passed).length;
  const failedRuns = totalRuns - passedRuns;
  const integrityFailures = runs.filter((run) => !run.dbIntegrityPassed).length;
  const backupFailures = runs.filter((run) => !run.backupPassed).length;
  const totalDurationMs = runs.reduce((sum, run) => sum + run.durationMs, 0);
  const maxDurationMs = runs.reduce((max, run) => Math.max(max, run.durationMs), 0);
  const caseSummaries = summarizeStableValidationRuns(runs);
  const artifacts = {
    reportPath: "",
    baselinePath: "",
    inventoryPath: "",
  };

  return {
    startedAt: reports[0]?.startedAt ?? new Date().toISOString(),
    finishedAt: reports.at(-1)?.finishedAt ?? new Date().toISOString(),
    iterations: reports.reduce((sum, report) => sum + report.iterations, 0),
    totalRuns,
    passedRuns,
    failedRuns,
    integrityFailures,
    backupFailures,
    averageDurationMs: totalRuns === 0 ? 0 : roundMetric(totalDurationMs / totalRuns),
    maxDurationMs,
    caseSummaries,
    artifacts,
    baselineComparison: compareStableValidationToBaseline(
      {
        failedRuns,
        integrityFailures,
        backupFailures,
        averageDurationMs: totalRuns === 0 ? 0 : roundMetric(totalDurationMs / totalRuns),
        maxDurationMs,
        caseSummaries,
      },
      null,
      artifacts.baselinePath,
    ),
    runs,
  };
}

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
export async function runStableValidation(options: StableValidationOptions): Promise<StableValidationReport> {
  const cases = options.cases ?? SINGLE_TASK_GOLDEN_TASKS;
  mkdirSync(options.outputDir, { recursive: true });

  const reportPath = join(options.outputDir, STABLE_VALIDATION_REPORT_FILE);
  const baselinePath = join(options.outputDir, STABLE_VALIDATION_BASELINE_FILE);
  const inventoryPath = join(options.outputDir, STABLE_VALIDATION_INVENTORY_FILE);

  const startedAt = new Date().toISOString();
  const runs: StableValidationRun[] = [];

  // Run each iteration of each case
  for (let iteration = 1; iteration <= options.iterations; iteration += 1) {
    const runDir = join(options.outputDir, `iter-${iteration}`);
    rmSync(runDir, { recursive: true, force: true });
    mkdirSync(runDir, { recursive: true });

    for (const testCase of cases) {
      const started = performance.now();
      const result = await runGoldenTaskCase(runDir, testCase);
      const durationMs = Math.round((performance.now() - started) * 100) / 100;

      // Verify database integrity
      const db = new SqliteDatabase(result.dbPath);
      const reliability = new SqliteReliabilityService(db);
      const integrityReport = reliability.getReport();

      // Create and verify backup
      const backupPath = join(runDir, `${testCase.id}.backup.db`);
      const backupReport = reliability.createBackup(backupPath);
      db.close();

      runs.push({
        iteration,
        caseId: testCase.id,
        passed: result.passed,
        durationMs,
        dbIntegrityPassed: integrityReport.integrityPassed,
        backupPassed: backupReport.valid,
        backupPath,
      });
    }
  }

  // Compute aggregate statistics
  const totalRuns = runs.length;
  const passedRuns = runs.filter((run) => run.passed).length;
  const failedRuns = totalRuns - passedRuns;
  const integrityFailures = runs.filter((run) => !run.dbIntegrityPassed).length;
  const backupFailures = runs.filter((run) => !run.backupPassed).length;
  const totalDurationMs = runs.reduce((sum, run) => sum + run.durationMs, 0);
  const maxDurationMs = runs.reduce((max, run) => Math.max(max, run.durationMs), 0);
  const averageDurationMs = totalRuns === 0 ? 0 : roundMetric(totalDurationMs / totalRuns);
  const caseSummaries = summarizeStableValidationRuns(runs);

  // Compare against baseline
  const existingBaseline = safeReadJson<StableValidationBaseline>(baselinePath);
  const baselineComparison = compareStableValidationToBaseline(
    {
      failedRuns,
      integrityFailures,
      backupFailures,
      averageDurationMs,
      maxDurationMs,
      caseSummaries,
    },
    existingBaseline,
    baselinePath,
  );

  const report: StableValidationReport = {
    startedAt,
    finishedAt: new Date().toISOString(),
    iterations: options.iterations,
    totalRuns,
    passedRuns,
    failedRuns,
    integrityFailures,
    backupFailures,
    averageDurationMs,
    maxDurationMs,
    caseSummaries,
    artifacts: {
      reportPath,
      baselinePath,
      inventoryPath,
    },
    baselineComparison,
    runs,
  };

  // Write artifacts
  writeGoldenTaskInventoryBaseline(inventoryPath, cases);
  writeJson(reportPath, report);

  // Save baseline if this is the first run
  if (existingBaseline == null) {
    writeJson(baselinePath, buildStableValidationBaseline(report));
  }

  return report;
}
