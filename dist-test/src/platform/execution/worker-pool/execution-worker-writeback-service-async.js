/**
 * Async Execution Worker Writeback Service
 *
 * Async version of ExecutionWorkerWritebackService that provides async/await interface.
 * This is a thin async wrapper around the sync ExecutionWorkerWritebackService,
 * intended to provide the async interface while the underlying store
 * operations remain sync (for SQLite compatibility).
 *
 * For true PostgreSQL async support, the underlying store operations
 * would need to use AsyncSqlDatabase.transaction() with async repository methods.
 *
 * @see ExecutionWorkerWritebackService for the sync implementation
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
/**
 * Async Execution Worker Writeback Service
 *
 * Handles result reporting from workers - when a worker completes or fails
 * an execution, it reports back through this writeback service.
 *
 * This async version provides the same functionality as ExecutionWorkerWritebackService
 * but with async/await interface for modern async contexts.
 */
export class ExecutionWorkerWritebackServiceAsync {
    sync;
    /**
     * Creates a new ExecutionWorkerWritebackServiceAsync instance.
     *
     * @param db - SQLite database instance (sync mode)
     * @param store - AuthoritativeTaskStore for data access
     */
    constructor(db, store) {
        // Import dynamically to avoid circular dependency
        const { ExecutionWorkerWritebackService } = require("./execution-worker-writeback-service.js");
        this.sync = new ExecutionWorkerWritebackService(db, store);
    }
    /**
     * Records a writeback from a worker reporting execution completion or failure.
     */
    async recordWriteback(input) {
        return Promise.resolve(this.sync.recordWriteback(input));
    }
}
//# sourceMappingURL=execution-worker-writeback-service-async.js.map