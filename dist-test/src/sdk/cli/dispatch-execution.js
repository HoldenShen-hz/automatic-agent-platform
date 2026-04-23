/**
 * Dispatch Execution CLI Tool
 *
 * This module provides a command-line interface for creating and dispatching
 * execution tickets within the authoritative task queue system. It creates a ticket
 * based on environment variable configuration and optionally dispatches the
 * next available execution to a worker.
 *
 * Environment Variables:
 *   - AA_EXECUTION_ID (required): Unique identifier for the execution
 *   - AA_DB_PATH: Path to SQLite database (defaults to data/sqlite/authoritative-demo.db)
 *   - AA_QUEUE_NAME: Target queue name for the ticket
 *   - AA_PRIORITY: Ticket priority (low, normal, high, urgent)
 *   - AA_DISPATCH_TARGET: any, local_only, prefer_remote, require_remote
 *   - AA_REQUIRED_ISOLATION_LEVEL: standard, hardened, strict
 *   - AA_REQUIRED_REPO_VERSION: required repo/workspace version mounted by the worker
 *   - AA_REQUIRED_CAPABILITIES_JSON: JSON array of required capability strings
 *   - AA_DISPATCH_AFTER: ISO timestamp after which dispatch is allowed
 *   - AA_DISPATCH_CREATE_ONLY: Set to "1" to only create ticket without dispatching
 *   - AA_PREFERRED_WORKER_ID: Preferred worker for dispatch
 *   - AA_LEASE_TTL_MS: Lease TTL in milliseconds (default: 30000)
 *   - AA_INCLUDE_DEGRADED: Set to "1" to include degraded workers in dispatch
 *
 * Usage: npm run dispatch-execution
 *
 * @see {@link docs_zh/contracts/runtime_execution_contract.md} - Runtime execution dispatch
 * @see {@link docs_zh/contracts/task_lease_and_fencing_contract.md} - Lease and fencing
 * @see {@link docs_zh/contracts/execution_plane_contract.md} - Execution plane
 * @see {@link docs_zh/governance/glossary_and_terminology.md} - Glossary
 * @see {@link docs_zh/architecture/00-platform-architecture.md} - Architecture
 */
import { withCliStorage } from "./authoritative-storage.js";
import { loadDispatchExecutionCliEnv } from "../../platform/control-plane/config-center/runtime-ops-env.js";
import { ExecutionDispatchService } from "../../platform/execution/dispatcher/execution-dispatch-service.js";
/**
 * Main entry point for the dispatch execution CLI.
 *
 * Initializes the database and store, creates an execution ticket based on
 * environment variable configuration, and optionally dispatches the next
 * available execution. The result is output as formatted JSON containing
 * both the created ticket and dispatch information.
 */
function main() {
    const envConfig = loadDispatchExecutionCliEnv();
    const result = withCliStorage((storage) => {
        const dispatch = new ExecutionDispatchService(storage.sql, storage.store);
        const created = dispatch.createTicket({
            executionId: envConfig.executionId,
            ...(envConfig.priority ? { priority: envConfig.priority } : {}),
            queueName: envConfig.queueName,
            ...(envConfig.dispatchTarget ? { dispatchTarget: envConfig.dispatchTarget } : {}),
            ...(envConfig.requiredIsolationLevel ? { requiredIsolationLevel: envConfig.requiredIsolationLevel } : {}),
            requiredRepoVersion: envConfig.requiredRepoVersion,
            requiredCapabilities: envConfig.requiredCapabilities,
            dispatchAfter: envConfig.dispatchAfter,
        });
        return envConfig.createOnly
            ? { created, dispatched: null }
            : {
                created,
                dispatched: dispatch.dispatchNext({
                    queueName: envConfig.queueName,
                    preferredWorkerId: envConfig.preferredWorkerId,
                    leaseTtlMs: envConfig.leaseTtlMs,
                    includeDegraded: envConfig.includeDegraded,
                }),
            };
    }, envConfig.dbPath != null ? { dbPath: envConfig.dbPath } : {});
    console.log(JSON.stringify(result, null, 2));
}
main();
//# sourceMappingURL=dispatch-execution.js.map