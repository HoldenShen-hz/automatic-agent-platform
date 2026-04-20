/**
 * Drain Events CLI
 *
 * This module provides a command-line entry point for draining event queues from
 * registered consumers in the SQLite database. It processes and clears event backlog
 * for all default consumers, supporting operational cleanup and queue management.
 *
 * Usage: Run via `npm run drain-events` or similar npm script
 * Environment Variables:
 *   - AA_DB_PATH: Optional custom path to the SQLite database file
 *
 * @see {@link docs_zh/automatic_agent_patform_arthitecture_design.md} for event architecture
 * @see {@link docs_zh/governance/glossary_and_terminology.md} for event consumer terminology
 * @see {@link docs_zh/contracts/} for event-related contracts
 */
import { withCliStorageAsync } from "./authoritative-storage.js";
import { loadEventOpsCliEnv } from "../../platform/control-plane/config-center/ops-cli-env.js";
import { EventOpsService } from "../../platform/state-evidence/events/event-ops-service.js";

/**
 * Main entry point for the drain events CLI.
 *
 * Initializes the SQLite database and event store, then drains event backlog
 * from all default consumers. Outputs results as formatted JSON and ensures
 * the database connection is properly closed before exiting.
 */
async function main(): Promise<void> {
  const envConfig = loadEventOpsCliEnv();
  const results = await withCliStorageAsync(async (storage) => {
    const ops = new EventOpsService(storage.sql, storage.store);
    return ops.drainDefaultConsumers();
  }, { dbPath: envConfig.dbPath });

  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
}

void main();
