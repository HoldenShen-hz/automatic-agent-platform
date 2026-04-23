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
import { withCliStorage } from "./authoritative-storage.js";
import { bootstrapGovernanceServices } from "./governance-bootstrap.js";
function installBrokenPipeHandler() {
    process.stdout.on("error", (error) => {
        const err = error;
        if (err.code === "EPIPE") {
            process.exit(0);
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
function main() {
    installBrokenPipeHandler();
    const output = withCliStorage((storage) => {
        const dbPath = storage.sql.filePath;
        const { doctor } = bootstrapGovernanceServices({ storage, dbPath });
        return doctor.run();
    });
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}
main();
//# sourceMappingURL=doctor.js.map