/**
 * Async Billing Service
 *
 * Async version of BillingService that provides async/await interface.
 * This is a thin async wrapper around the sync BillingService,
 * intended to provide the async interface while the underlying store
 * operations remain sync (for SQLite compatibility).
 *
 * @see BillingService for the sync implementation
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
/**
 * Async Billing Service
 *
 * Core billing and monetization engine.
 *
 * This async version provides the same functionality as BillingService
 * but with async/await interface for modern async contexts.
 */
export class BillingServiceAsync {
    sync;
    /**
     * Creates a new BillingServiceAsync instance.
     *
     * @param db - SQLite database instance (sync mode)
     * @param store - AuthoritativeTaskStore for data access
     */
    constructor(db, store, options) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { BillingService } = require("./billing-service.js");
        this.sync = new BillingService(db, store, options);
    }
    /**
     * Creates a new billing account (async).
     */
    async createAccount(input) {
        return Promise.resolve(this.sync.createAccount(input));
    }
    /**
     * Evaluates feature entitlement for a billing account (async).
     */
    async evaluateEntitlement(input) {
        return Promise.resolve(this.sync.evaluateEntitlement(input));
    }
    /**
     * Records usage for a billing account (async).
     */
    async recordUsage(input) {
        return Promise.resolve(this.sync.recordUsage(input));
    }
    /**
     * Gets the synchronous service instance for internal use.
     * @internal
     */
    getSyncService() {
        return this.sync;
    }
}
//# sourceMappingURL=billing-service-async.js.map