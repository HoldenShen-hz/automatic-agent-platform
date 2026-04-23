/**
 * Replay Events CLI
 *
 * This module provides a command-line entry point for replaying event sequences from the
 * SQLite database. It allows selective replay of events for specific consumers or all
 * registered consumers, enabling debugging and state reconstruction scenarios.
 *
 * Usage: Run via `npm run replay-events` or similar npm script
 * Environment Variables:
 *   - AA_DB_PATH: Optional custom path to the SQLite database file
 *   - AA_EVENT_CONSUMER_ID: Optional specific consumer ID to replay events for
 *
 * @see {@link docs_zh/architecture/00-platform-architecture.md} for event store architecture
 * @see {@link docs_zh/governance/glossary_and_terminology.md} for event consumer terminology
 * @see {@link docs_zh/contracts/} for event-related contracts
 */
import { withCliStorageAsync } from "./authoritative-storage.js";
import { loadEventOpsCliEnv } from "../../platform/control-plane/config-center/ops-cli-env.js";
import { EventOpsService } from "../../platform/state-evidence/events/event-ops-service.js";
/**
 * Main entry point for the replay events CLI.
 *
 * Initializes the SQLite database and event store, then either replays events for a
 * specific consumer (if AA_EVENT_CONSUMER_ID is set) or all registered default consumers.
 * Prints results to stdout and sets exit code to 1 if any replay outcomes failed.
 */
async function main() {
    const envConfig = loadEventOpsCliEnv();
    const results = await withCliStorageAsync(async (storage) => {
        const ops = new EventOpsService(storage.sql, storage.store);
        return envConfig.consumerId
            ? [await ops.replayConsumer(envConfig.consumerId)]
            : await ops.replayDefaultConsumers();
    }, { dbPath: envConfig.dbPath });
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
    // Set non-zero exit code if any replay operation encountered a failure
    if (results.some((result) => result.outcome === "failed")) {
        process.exitCode = 1;
    }
}
void main();
//# sourceMappingURL=replay-events.js.map