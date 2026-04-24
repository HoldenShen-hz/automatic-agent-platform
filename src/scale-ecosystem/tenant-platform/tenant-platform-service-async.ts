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

import { SyncBackedAsyncService } from "../../platform/shared/async/sync-backed-async-service.js";
import type { AuthoritativeSqlDatabase } from "../../platform/state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../platform/state-evidence/truth/authoritative-task-store.js";

const require = createRequire(import.meta.url);

/**
 * Async Tenant Platform Service
 *
 * Multi-tenant platform service for managing tenants, workspaces, and quotas.
 *
 * This async version provides the same functionality as TenantPlatformService
 * but with async/await interface for modern async contexts.
 */
type TenantPlatformServiceSync = import("./tenant-platform-service.js").TenantPlatformService;

export class TenantPlatformServiceAsync extends SyncBackedAsyncService<TenantPlatformServiceSync> {

  /**
   * Creates a new TenantPlatformServiceAsync instance.
   *
   * @param db - SQLite database instance (sync mode)
   * @param store - AuthoritativeTaskStore for data access
   */
  public constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore) {
    super(() => {
      const { TenantPlatformService } = require("./tenant-platform-service.js");
      return new TenantPlatformService(db, store);
    });
  }

  public async createWorkspaceAsync(
    input: Parameters<import("./tenant-platform-service.js").TenantPlatformService["createWorkspace"]>[0],
  ): Promise<ReturnType<import("./tenant-platform-service.js").TenantPlatformService["createWorkspace"]>> {
    return this.asPromise((sync) => sync.createWorkspace(input));
  }

  public async createOrganizationAsync(
    input: Parameters<import("./tenant-platform-service.js").TenantPlatformService["createOrganization"]>[0],
  ): Promise<ReturnType<import("./tenant-platform-service.js").TenantPlatformService["createOrganization"]>> {
    return this.asPromise((sync) => sync.createOrganization(input));
  }

  public async createTenant(
    input: Parameters<import("./tenant-platform-service.js").TenantPlatformService["createTenant"]>[0],
  ): Promise<ReturnType<import("./tenant-platform-service.js").TenantPlatformService["createTenant"]>> {
    return this.asPromise((sync) => sync.createTenant(input));
  }

  /**
   * Creates a new tenant (async).
   */
  public async createTenantAsync(
    input: Parameters<import("./tenant-platform-service.js").TenantPlatformService["createTenant"]>[0],
  ): Promise<ReturnType<import("./tenant-platform-service.js").TenantPlatformService["createTenant"]>> {
    return this.createTenant(input);
  }

  public async createDataNamespaceAsync(
    input: Parameters<import("./tenant-platform-service.js").TenantPlatformService["createDataNamespace"]>[0],
  ): Promise<ReturnType<import("./tenant-platform-service.js").TenantPlatformService["createDataNamespace"]>> {
    return this.asPromise((sync) => sync.createDataNamespace(input));
  }
}
