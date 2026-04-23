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
import type { AuthoritativeSqlDatabase } from "../../platform/state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../platform/state-evidence/truth/authoritative-task-store.js";
/**
 * Async Billing Service
 *
 * Core billing and monetization engine.
 *
 * This async version provides the same functionality as BillingService
 * but with async/await interface for modern async contexts.
 */
export declare class BillingServiceAsync {
    private readonly sync;
    /**
     * Creates a new BillingServiceAsync instance.
     *
     * @param db - SQLite database instance (sync mode)
     * @param store - AuthoritativeTaskStore for data access
     */
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore, options?: any);
    /**
     * Creates a new billing account (async).
     */
    createAccount(input: any): Promise<any>;
    /**
     * Evaluates feature entitlement for a billing account (async).
     */
    evaluateEntitlement(input: any): Promise<any>;
    /**
     * Records usage for a billing account (async).
     */
    recordUsage(input: any): Promise<any>;
    /**
     * Gets the synchronous service instance for internal use.
     * @internal
     */
    getSyncService(): any;
}
