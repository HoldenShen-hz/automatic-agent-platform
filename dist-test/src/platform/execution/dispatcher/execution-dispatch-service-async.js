/**
 * Async Execution Dispatch Service
 *
 * Async version of ExecutionDispatchService that provides async/await interface.
 * This is a thin async wrapper around the sync ExecutionDispatchService,
 * intended to provide the async interface while the underlying store
 * operations remain sync (for SQLite compatibility).
 *
 * For true PostgreSQL async support, the underlying store operations
 * would need to use AsyncSqlDatabase.transaction() with async repository methods.
 *
 * @see ExecutionDispatchService for the sync implementation
 */
import { ExecutionDispatchService } from "./execution-dispatch-service.js";
/**
 * Async Execution Dispatch Service
 *
 * Manages execution dispatch - the process of selecting and assigning
 * work to available workers.
 *
 * This async version provides the same functionality as ExecutionDispatchService
 * but with async/await interface for modern async contexts.
 */
export class ExecutionDispatchServiceAsync {
    sync;
    /**
     * Creates a new ExecutionDispatchServiceAsync instance.
     *
     * @param db - SQLite database instance (sync mode)
     * @param store - AuthoritativeTaskStore for data access
     * @param backpressureSnapshot - Optional backpressure snapshot function
     * @param queueAvailabilitySnapshot - Optional queue availability snapshot function
     */
    constructor(db, store, backpressureSnapshot = null, queueAvailabilitySnapshot = null) {
        this.sync = new ExecutionDispatchService(db, store, backpressureSnapshot, queueAvailabilitySnapshot);
    }
    /**
     * Creates a new execution ticket for an execution.
     */
    createTicket(input) {
        return Promise.resolve(this.sync.createTicket(input));
    }
    /**
     * Dispatches the next available ticket to an available worker.
     */
    dispatchNext(options) {
        return Promise.resolve(this.sync.dispatchNext(options));
    }
    /**
     * Gets the synchronous service instance for internal use.
     * @internal
     */
    getSyncService() {
        return this.sync;
    }
}
//# sourceMappingURL=execution-dispatch-service-async.js.map