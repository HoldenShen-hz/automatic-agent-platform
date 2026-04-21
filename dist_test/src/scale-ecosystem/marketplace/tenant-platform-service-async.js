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
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
/**
 * Async Tenant Platform Service
 *
 * Multi-tenant platform service for managing tenants, workspaces, and quotas.
 *
 * This async version provides the same functionality as TenantPlatformService
 * but with async/await interface for modern async contexts.
 */
export class TenantPlatformServiceAsync {
    sync;
    /**
     * Creates a new TenantPlatformServiceAsync instance.
     *
     * @param db - SQLite database instance (sync mode)
     * @param store - AuthoritativeTaskStore for data access
     */
    constructor(db, store) {
        const { TenantPlatformService } = require("./tenant-platform-service.js");
        this.sync = new TenantPlatformService(db, store);
    }
    /**
     * Creates a new tenant (async).
     */
    async createTenantAsync(input) {
        return Promise.resolve(this.sync.createTenant(input));
    }
    /**
     * Gets the synchronous service instance for internal use.
     * @internal
     */
    getSyncService() {
        return this.sync;
    }
}
//# sourceMappingURL=tenant-platform-service-async.js.map