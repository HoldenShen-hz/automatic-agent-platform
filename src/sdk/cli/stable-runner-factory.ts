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
}

/** Runner function — accepts any options object and returns any report (sync or async) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type StableRunner = (opts: any) => any;

/** Writer function — accepts any report */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type StableReportWriter = (path: string, report: any) => void;

/** Predicate that determines process exit code — return true = exit 1 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FailedPredicate = (report: any) => boolean;

// ---------------------------------------------------------------------------
// createStableCli — main factory
// ---------------------------------------------------------------------------

/**
 * Creates a stable CLI entry point with the standard pattern:
 *
 * 1. Resolve output directory from `AA_STABLE_<NAME>_OUTPUT_DIR` or default
 * 2. Call `runner({ outputDir })`
 * 3. Call `writer(join(outputDir, reportFilename), report)`
 * 4. `process.stdout.write(JSON.stringify(report, null, 2))`
 * 5. Call `failed(report)` — set exit code 1 if true
 */
export function createStableCli(opts: {
  /**
   * Environment variable prefix (e.g. "AA_STABLE_CHAOS").
   * The OUTPUT_DIR suffix is appended automatically.
   */
  envVar: string;

  /** Default data directory relative to cwd (e.g. "data/stable-chaos") */
  defaultDir: string;

  /** Filename written inside outputDir (e.g. "stable-chaos-report.json") */
  reportFilename?: string;

  /**
   * Runner function. Receives `{ outputDir }` by default.
   * For CLIs that need extra args (soak, validate), supply `prepare` instead.
   */
  runner: StableRunner;

  /** Report serialiser */
  writer?: StableReportWriter;

  /**
   * Determines whether the run should be considered failed (exit code 1).
   * Default: `(r) => (r.failedScenarios ?? 0) > 0`
   */
  failed?: FailedPredicate;

  /**
   * Override argument resolution. When supplied, `runner` receives
   * the return value of `prepare` instead of just `{ outputDir }`.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prepare?: (outputDir: string) => Record<string, any>;

  /**
   * When false, do not inject outputDir into runner args.
   * Useful for CLIs that only accept evidenceRootDir or similar inputs.
   */
  includeOutputDir?: boolean;
}): void {
  const {
    envVar,
    defaultDir,
    reportFilename,
    runner,
    writer,
    failed = (r) => (r.failedScenarios ?? 0) > 0,
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
    const runnerArgs = includeOutputDir
      ? { ...preparedArgs, outputDir }
      : preparedArgs;
    // Support both sync and async runners (stable-package is sync)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (runner as any)(runnerArgs);
    const report = result instanceof Promise ? await result : result;

    if (writer && reportFilename) {
      const reportPath = join(outputDir, reportFilename);
      writer(reportPath, report);
    }
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

    if (failed(report)) {
      process.exitCode = 1;
    }
  }

  // -------------------------------------------------------------------------
  // Entry point — always use .catch() so rejections don't silently disappear
  // -------------------------------------------------------------------------
  main().catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exitCode = 1;
  });
}
