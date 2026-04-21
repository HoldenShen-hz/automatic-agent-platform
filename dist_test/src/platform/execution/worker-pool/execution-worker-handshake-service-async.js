/**
 * Async Execution Worker Handshake Service
 *
 * Async version of ExecutionWorkerHandshakeService that provides async/await interface.
 * This is a thin async wrapper around the sync ExecutionWorkerHandshakeService,
 * intended to provide the async interface while the underlying store
 * operations remain sync (for SQLite compatibility).
 *
 * For true PostgreSQL async support, the underlying store operations
 * would need to use AsyncSqlDatabase.transaction() with async repository methods.
 *
 * @see ExecutionWorkerHandshakeService for the sync implementation
 */
import { ExecutionWorkerHandshakeService } from "./execution-worker-handshake-service.js";
/**
 * Async Execution Worker Handshake Service
 *
 * Handles the handshake between the authoritative system and workers -
 * including lease acquisition, heartbeat, and execution claim.
 *
 * This async version provides the same functionality as ExecutionWorkerHandshakeService
 * but with async/await interface for modern async contexts.
 */
export class ExecutionWorkerHandshakeServiceAsync {
    sync;
    /**
     * Creates a new ExecutionWorkerHandshakeServiceAsync instance.
     *
     * @param db - SQLite database instance (sync mode)
     * @param store - AuthoritativeTaskStore for data access
     * @param options - Optional service configuration
     */
    constructor(db, store, options = {}) {
        this.sync = new ExecutionWorkerHandshakeService(db, store, options);
    }
    /**
     * Handles a worker's request to claim an execution ticket.
     */
    claimExecution(input) {
        return Promise.resolve(this.sync.claimExecution(input));
    }
    /**
     * Records a heartbeat from a worker.
     */
    recordHeartbeat(input) {
        return Promise.resolve(this.sync.recordHeartbeat(input));
    }
    /**
     * Gets the synchronous service instance for internal use.
     * @internal
     */
    getSyncService() {
        return this.sync;
    }
}
//# sourceMappingURL=execution-worker-handshake-service-async.js.map