/**
 * Async Data Plane Flow Service
 *
 * Async version of DataPlaneFlowService that provides async/await interface.
 * This is a thin async wrapper around the sync DataPlaneFlowService,
 * intended to provide the async interface while the underlying store
 * operations remain sync (for SQLite compatibility).
 *
 * @see DataPlaneFlowService for the sync implementation
 */
import type { AuthoritativeSqlDatabase } from "../../platform/state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../platform/state-evidence/truth/authoritative-task-store.js";
/**
 * Async Data Plane Flow Service
 *
 * Data plane flow service for managing data flows and connections.
 *
 * This async version provides the same functionality as DataPlaneFlowService
 * but with async/await interface for modern async contexts.
 */
export declare class DataPlaneFlowServiceAsync {
    private readonly sync;
    /**
     * Creates a new DataPlaneFlowServiceAsync instance.
     *
     * @param db - SQLite database instance (sync mode)
     * @param store - AuthoritativeTaskStore for data access
     */
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore);
    /**
     * Gets the synchronous service instance for internal use.
     * @internal
     */
    getSyncService(): any;
}
