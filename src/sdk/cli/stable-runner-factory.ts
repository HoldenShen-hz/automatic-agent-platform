/**
 * Stable CLI Runner Factory
 *
 * Eliminates ~80% boilerplate duplication across the 26 stable-*.ts CLI entry points.
 * Each stable CLI follows the same pattern: resolve output dir → run runner → write report →
 * print JSON → set exit code based on failure predicate.
 *
 * ## Usage
 *
 * Instead of ~60 lines per CLI file, each stable entry point becomes:
 *
 * ```typescript
 * import { createStableCli } from "./stable-runner-factory.js";
 * import { runStableXxx, writeStableXxxReport } from "../core/stability/stable-x.js";
 *
 * createStableCli({
 *   envVar: "AA_STABLE_XXX",
 *   defaultDir: "data/stable-xxx",
 *   reportFilename: "stable-xxx-report.json",
 *   runner: runStableXxx,
 *   writer: writeStableXxxReport,
 *   failed: (report) => report.failedScenarios > 0,
 * });
 * ```
 *
 * For CLIs with non-standard arguments (soak, validate), pass a custom `prepare` function:
 *
 * ```typescript
 * createStableCli({
 *   envVar: "AA_SOAK",
 *   defaultDir: "data/soak",
 *   reportFilename: "stable-soak-report.json",
 *   prepare: () => ({
 *     outputDir: resolveOutputDir(),
 *     durationMs: numberFromEnv("AA_SOAK_DURATION_MS", 5_000),
 *     intervalMs: numberFromEnv("AA_SOAK_INTERVAL_MS", 500),
 *   }),
 *   runner: runStableSoak,
 *   writer: writeStableSoakReport,
 *   failed: (report) =>
 *     report.failedRuns > 0 ||
 *     report.integrityFailures > 0 ||
 *     report.backupFailures > 0,
 * });
 * ```
 *
 * @module
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Standard runner options (output dir only) */
export interface StableRunnerOptions {
  outputDir: string;
  [key: string]: unknown;
}

/** Runner function — strongly typed by argument shape and report payload. */
export type StableRunner<
  RunnerArgs extends object = StableRunnerOptions,
  Report = unknown,
> = (opts: RunnerArgs) => Report | Promise<Report>;

/** Writer function — accepts the same report shape produced by the runner. */
export type StableReportWriter<Report = unknown> = (path: string, report: Report) => void;

/** Predicate that determines process exit code — return true = exit 1. */
export type FailedPredicate<Report = unknown> = (report: Report) => boolean;

function defaultFailed(report: unknown): boolean {
  if (typeof report !== "object" || report === null) {
    return false;
  }
  const failedScenarios = (report as { failedScenarios?: unknown }).failedScenarios;
  return typeof failedScenarios === "number" && failedScenarios > 0;
}

// ---------------------------------------------------------------------------
// createStableCli — main factory
// ---------------------------------------------------------------------------

/**
 * Creates a stable CLI entry point with the standard pattern:
 *
 * 1. Resolve output directory from `AA_STABLE_<NAME>_OUTPUT_DIR` or default
 * 2. Call `runner({ outputDir })`
 * 3. Call `writer(join(outputDir, reportFilename), report)`
 * 4. `console.log(JSON.stringify(report, null, 2))`
 * 5. Call `failed(report)` — set exit code 1 if true
 */
export function createStableCli<
  RunnerArgs extends object = StableRunnerOptions,
  Report = unknown,
>(opts: {
  envVar: string;
  defaultDir: string;
  reportFilename?: string;
  runner: StableRunner<RunnerArgs, Report>;
  writer?: StableReportWriter<Report>;
  failed?: FailedPredicate<Report>;
  prepare?: (outputDir: string) => Partial<RunnerArgs> | RunnerArgs;
  includeOutputDir?: boolean;
}): void {
  const {
    envVar,
    defaultDir,
    reportFilename,
    runner,
    writer,
    failed = defaultFailed as FailedPredicate<Report>,
    prepare,
    includeOutputDir = true,
  } = opts;

  // -------------------------------------------------------------------------
  // resolveOutputDir — shared by all variants
  // -------------------------------------------------------------------------
  function resolveOutputDir(): string {
    const envKey = `${envVar}_OUTPUT_DIR`;
    const fromEnv = process.env[envKey];
    if (fromEnv && fromEnv.length > 0) {
      return fromEnv;
    }
    const outputDir = join(process.cwd(), defaultDir);
    mkdirSync(outputDir, { recursive: true });
    return outputDir;
  }

  // -------------------------------------------------------------------------
  // main
  // -------------------------------------------------------------------------
  async function main(): Promise<void> {
    const outputDir = resolveOutputDir();

    // prepare() allows callers like soak/validate to add extra arguments
    const preparedArgs = prepare ? prepare(outputDir) : {};
    const runnerArgs = (
      includeOutputDir
        ? { ...preparedArgs, outputDir }
        : preparedArgs
    ) as RunnerArgs;
    // Support both sync and async runners (stable-package is sync)
    const result = runner(runnerArgs);
    const report = result instanceof Promise ? await result : result;

    if (writer && reportFilename) {
      const reportPath = join(outputDir, reportFilename);
      writer(reportPath, report);
    }
    console.log(JSON.stringify(report, null, 2));

    if (failed(report)) {
      process.exitCode = 1;
    }
  }

  // -------------------------------------------------------------------------
  // Entry point — always use .catch() so rejections don't silently disappear
  // -------------------------------------------------------------------------
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
