/**
 * Async Perception Service
 *
 * Async version of PerceptionService that provides async/await interface.
 * This is a thin async wrapper around the sync PerceptionService,
 * intended to provide the async interface while the underlying store
 * operations remain sync (for SQLite compatibility).
 *
 * @see PerceptionService for the sync implementation
 */
import type { AuthoritativeSqlDatabase } from "../../platform/state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../platform/state-evidence/truth/authoritative-task-store.js";
/**
 * Async Perception Service
 *
 * Perception and intelligence service for gathering, processing, and acting on intel.
 *
 * This async version provides the same functionality as PerceptionService
 * but with async/await interface for modern async contexts.
 */
export declare class PerceptionServiceAsync {
    private readonly sync;
    /**
     * Creates a new PerceptionServiceAsync instance.
     *
     * @param db - SQLite database instance (sync mode)
     * @param store - AuthoritativeTaskStore for data access
     */
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore);
    /**
     * Ingests intel candidates into the system (async).
     */
    ingestIntelAsync(input: Parameters<import("./perception-service.js").PerceptionService["ingestIntel"]>[0]): Promise<ReturnType<import("./perception-service.js").PerceptionService["ingestIntel"]>>;
    /**
     * Gets the synchronous service instance for internal use.
     * @internal
     */
    getSyncService(): import("./perception-service.js").PerceptionService;
}
