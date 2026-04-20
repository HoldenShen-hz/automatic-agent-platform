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

import type { AuthoritativeSqlDatabase } from "../../platform/state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../platform/state-evidence/truth/authoritative-task-store.js";

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
  private readonly sync: any;

  /**
   * Creates a new BillingServiceAsync instance.
   *
   * @param db - SQLite database instance (sync mode)
   * @param store - AuthoritativeTaskStore for data access
   */
  public constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore, options?: any) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BillingService } = require("./billing-service.js");
    this.sync = new BillingService(db, store, options);
  }

  /**
   * Creates a new billing account (async).
   */
  public async createAccount(input: any): Promise<any> {
    return Promise.resolve(this.sync.createAccount(input));
  }

  /**
   * Evaluates feature entitlement for a billing account (async).
   */
  public async evaluateEntitlement(input: any): Promise<any> {
    return Promise.resolve(this.sync.evaluateEntitlement(input));
  }

  /**
   * Records usage for a billing account (async).
   */
  public async recordUsage(input: any): Promise<any> {
    return Promise.resolve(this.sync.recordUsage(input));
  }

  /**
   * Gets the synchronous service instance for internal use.
   * @internal
   */
  public getSyncService(): any {
    return this.sync;
  }
}
