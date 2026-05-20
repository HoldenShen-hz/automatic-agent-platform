/**
 * Doctor CLI Tool
 *
 * This module provides a diagnostic utility that checks the health and consistency
 * of the authoritative SQLite database and runtime components. It aggregates checks from
 * multiple services (HealthService, StartupConsistencyChecker, StalledExecutionDetector,
 * etc.) and outputs a comprehensive JSON report of system state.
 *
 * Usage: AA_DB_PATH=/path/to/db npm run doctor
 *
 * @see {@link docs_zh/contracts/runtime_execution_contract.md} - Runtime execution model
 * @see {@link docs_zh/contracts/observability_contract.md} - Health and observability
 * @see {@link docs_zh/contracts/debug_inspect_health_backpressure_contract.md} - Health diagnostics
 * @see {@link docs_zh/contracts/startup_consistency_and_recovery_drill_contract.md} - Startup consistency
 * @see {@link docs_zh/contracts/storage_schema_contract.md} - SQLite schema
 * @see {@link docs_zh/governance/glossary_and_terminology.md} - Glossary
 * @see {@link docs_zh/architecture/00-platform-architecture.md} - Architecture
 */

import { pathToFileURL } from "node:url";
import { withCliStorage } from "./authoritative-storage.js";
import { CLI_EXIT_SUCCESS, runCliMain } from "./cli-exit.js";
import { bootstrapGovernanceServices } from "./governance-bootstrap.js";

export function installBrokenPipeHandler(): void {
  process.stdout.once("error", (error) => {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "EPIPE") {
      process.exitCode = 141;
      process.stdout.destroy();
      return;
    }
    setImmediate(() => {
      throw error;
    });
  });
}

/**
 * Main entry point for the doctor diagnostic tool.
 *
 * Initializes all required services with the resolved database path,
 * runs the comprehensive health and consistency checks via DoctorService,
 * outputs the results as formatted JSON, and ensures the database connection
 * is properly closed before exiting.
 */
export function main(): number {
  installBrokenPipeHandler();

  const output = withCliStorage((storage) => {
    const dbPath = storage.sql.filePath;
    const { doctor } = bootstrapGovernanceServices({ storage, dbPath });
    return doctor.run();
  });

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  return CLI_EXIT_SUCCESS;
}

if (process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runCliMain(main);
}
