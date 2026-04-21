/**
 * Async Tenant Platform Service
 *
 * Async version of TenantPlatformService that provides async/await interface.
 * This is a thin async wrapper around the sync TenantPlatformService,
 * intended to provide the async interface while the underlying store
 * operations remain sync (for SQLite compatibility).
 *
 * @see TenantPlatformService for the sync implementation
 */
import type { AuthoritativeSqlDatabase } from "../../platform/state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../platform/state-evidence/truth/authoritative-task-store.js";
/**
 * Async Tenant Platform Service
 *
 * Multi-tenant platform service for managing tenants, workspaces, and quotas.
 *
 * This async version provides the same functionality as TenantPlatformService
 * but with async/await interface for modern async contexts.
 */
export declare class TenantPlatformServiceAsync {
    private readonly sync;
    /**
     * Creates a new TenantPlatformServiceAsync instance.
     *
     * @param db - SQLite database instance (sync mode)
     * @param store - AuthoritativeTaskStore for data access
     */
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore);
    /**
     * Creates a new tenant (async).
     */
    createTenantAsync(input: Parameters<import("./tenant-platform-service.js").TenantPlatformService["createTenant"]>[0]): Promise<ReturnType<import("./tenant-platform-service.js").TenantPlatformService["createTenant"]>>;
    /**
     * Gets the synchronous service instance for internal use.
     * @internal
     */
    getSyncService(): import("./tenant-platform-service.js").TenantPlatformService;
}
