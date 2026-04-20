/**
 * Async Human Takeover Service
 *
 * Async version of HumanTakeoverService that provides async/await interface.
 * This is a thin async wrapper around the sync HumanTakeoverService,
 * intended to provide the async interface while the underlying store
 * operations remain sync (for SQLite compatibility).
 *
 * @see HumanTakeoverService for the sync implementation
 */

import { createRequire } from "node:module";

import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";

const require = createRequire(import.meta.url);

/**
 * Async Human Takeover Service
 *
 * Service for managing human-in-the-loop takeover requests.
 *
 * This async version provides the same functionality as HumanTakeoverService
 * but with async/await interface for modern async contexts.
 */
export class HumanTakeoverServiceAsync {
  private readonly sync: import("./human-takeover-service.js").HumanTakeoverService;

  /**
   * Creates a new HumanTakeoverServiceAsync instance.
   *
   * @param db - SQLite database instance (sync mode)
   * @param store - AuthoritativeTaskStore for data access
   */
  public constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore) {
    const { HumanTakeoverService } = require("./human-takeover-service.js");
    this.sync = new HumanTakeoverService(db, store);
  }

  /**
   * Gets the synchronous service instance for internal use.
   * @internal
   */
  public getSyncService(): import("./human-takeover-service.js").HumanTakeoverService {
    return this.sync;
  }
}
