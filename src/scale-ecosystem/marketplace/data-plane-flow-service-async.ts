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

import { createRequire } from "node:module";

import type { AuthoritativeSqlDatabase } from "../../platform/state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../platform/state-evidence/truth/authoritative-task-store.js";

const require = createRequire(import.meta.url);

/**
 * Async Data Plane Flow Service
 *
 * Data plane flow service for managing data flows and connections.
 *
 * This async version provides the same functionality as DataPlaneFlowService
 * but with async/await interface for modern async contexts.
 */
export class DataPlaneFlowServiceAsync {
  private readonly sync: any;

  /**
   * Creates a new DataPlaneFlowServiceAsync instance.
   *
   * @param db - SQLite database instance (sync mode)
   * @param store - AuthoritativeTaskStore for data access
   */
  public constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DataPlaneFlowService } = require("./data-plane-flow-service.js");
    this.sync = new DataPlaneFlowService(db, store);
  }

  /**
   * Gets the synchronous service instance for internal use.
   * @internal
   */
  public getSyncService(): any {
    return this.sync;
  }
}
