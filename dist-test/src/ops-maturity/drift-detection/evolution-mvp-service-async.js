/**
 * Async Evolution MVP Service
 *
 * Async version of EvolutionMvpService that provides async/await interface.
 * This is a thin async wrapper around the sync EvolutionMvpService,
 * intended to provide the async interface while the underlying store
 * operations remain sync (for SQLite compatibility).
 *
 * @see EvolutionMvpService for the sync implementation
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
/**
 * Async Evolution MVP Service
 *
 * Evolution service for managing evolution proposals and migrations.
 *
 * This async version provides the same functionality as EvolutionMvpService
 * but with async/await interface for modern async contexts.
 */
export class EvolutionServiceAsync {
    sync;
    /**
     * Creates a new EvolutionServiceAsync instance.
     *
     * @param db - SQLite database instance (sync mode)
     * @param store - AuthoritativeTaskStore for data access
     */
    constructor(db, store) {
        const { EvolutionMvpService } = require("./evolution-mvp-service.js");
        this.sync = new EvolutionMvpService(db, store);
    }
    /**
     * Gets the synchronous service instance for internal use.
     * @internal
     */
    getSyncService() {
        return this.sync;
    }
}
//# sourceMappingURL=evolution-mvp-service-async.js.map