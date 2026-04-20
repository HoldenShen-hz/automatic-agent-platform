/**
 * Authoritative Storage Admin CLI
 *
 * This module provides the command-line entry point for authoritative storage administration.
 * It allows inspection of storage backend configuration, execution of migrations, and
 * retrieval of storage plan information.
 *
 * Environment Variables:
 *   - AA_DB_PATH: Path to the SQLite database (defaults to data/sqlite/authoritative-demo.db)
 *   - AA_AUTHORITATIVE_STORAGE_ACTION: Action to perform (summary, migrate, plan)
 *
 * Actions:
 *   - summary: Display storage configuration summary (default)
 *   - migrate: Run database migrations
 *   - plan: Display the storage backend plan
 *
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/architecture/00-platform-architecture.md | Architecture and Technical Design}
 * @see {@link https://github.com/anomalyco/automatic-agent/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
 */

import {
  describeCliAuthoritativeStoragePlan,
  withCliStorageBackendAsync,
} from "./authoritative-storage.js";
import { loadAuthoritativeStorageAdminCliEnv } from "../../platform/control-plane/config-center/ops-cli-env.js";
import { MigrationRunner } from "../../platform/state-evidence/truth/migration-runner.js";

/**
 * Main entry point for the authoritative storage admin CLI.
 *
 * Executes the requested storage administration action and outputs the result as JSON.
 */
async function main(): Promise<void> {
  const envConfig = loadAuthoritativeStorageAdminCliEnv();
  const dbPath = envConfig.dbPath;
  const action = envConfig.action;
  const plan = describeCliAuthoritativeStoragePlan(dbPath);
  if (action === "plan") {
    process.stdout.write(`${JSON.stringify({ dbPath, plan }, null, 2)}\n`);
    return;
  }

  await withCliStorageBackendAsync(async (storage) => {
    const migrationRunner = new MigrationRunner(storage);
    const migrationSummary =
      action === "summary"
        ? await migrationRunner.status()
        : action === "migrate" || action === "up"
          ? await migrationRunner.up()
          : action === "down"
            ? await migrationRunner.down()
            : await migrationRunner.status();

    process.stdout.write(
      `${JSON.stringify({
        action,
        dbPath,
        driver: storage.driver,
        environment: plan.environment,
        executable: plan.executable,
        runtimeProfile: plan.runtimeProfile,
        migration: migrationSummary,
      }, null, 2)}\n`,
    );
  }, { dbPath, migrate: false });
}

await main();
