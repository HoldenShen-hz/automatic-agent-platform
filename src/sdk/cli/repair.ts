/**
 * Repair CLI
 *
 * This module provides a command-line interface for running consistency checks and
 * applying runtime repairs to the SQLite database. It detects inconsistencies via the
 * StartupConsistencyChecker and applies fixes via RuntimeRepairService.
 *
 * Usage: Run via `npm run repair` or similar npm script
 * Environment Variables:
 *   - AA_DB_PATH: Optional custom path to the SQLite database file
 *
 * @see {@link docs_zh/architecture/00-platform-architecture.md} for runtime repair architecture
 * @see {@link docs_zh/governance/glossary_and_terminology.md} for consistency and repair terminology
 * @see {@link docs_zh/contracts/} for stability and repair-related contracts
 */
import { withCliStorageAsync } from "./authoritative-storage.js";
import { RuntimeRepairService } from "../../platform/five-plane-execution/recovery/runtime-repair-service.js";
import { StartupConsistencyChecker } from "../../platform/five-plane-execution/startup/startup-consistency-checker.js";

/**
 * Main entry point for the repair CLI.
 *
 * Runs consistency checks via StartupConsistencyChecker to detect database
 * inconsistencies, applies repairs via RuntimeRepairService, then re-runs
 * checks to verify the repairs were successful. Outputs before/after reports
 * and list of applied fixes as formatted JSON.
 */
async function main(): Promise<void> {
  const output = await withCliStorageAsync(async (storage) => {
    const checker = new StartupConsistencyChecker(storage.sql, storage.store);
    const report = checker.run();
    const repair = new RuntimeRepairService(storage.sql, storage.store);
    const applied = await repair.apply(report);
    const after = checker.run();

    return {
      before: report,
      applied,
      after,
    };
  });

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

void main();
